import {
  collection,
  deleteField,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import { db, DEFAULT_CAMPAIGN_ID } from "../infra/firebase.js";
import { normalizeText } from "../utils/stringUtils";
import { isCustomAttributeShortcutIcon } from "./rollService";
import { withRequiredAudience } from "./visibilityService";

const migratedCampaignsSession = new Set();
// Fase 6.2 (A5): última falha por campanha, para tentar de novo sem martelar o Firestore
const failedMigrationAt = new Map();
const MIGRATION_RETRY_MS = 60 * 1000;
const MAX_BATCH_OPS = 400;

/**
 * Fase 6.2 (A8): devolve a lista com Mestre e dono quando falta algum deles; senão, null.
 */
function audienceRepair(visibleTo, { gmUid, ownerId }) {
  if (!Array.isArray(visibleTo) || visibleTo.length === 0) return null;
  const missing = [gmUid, ownerId].filter(Boolean).some((id) => !visibleTo.includes(id));
  return missing ? withRequiredAudience(visibleTo, { gmUid, ownerId }) : null;
}

/**
 * Fase 4: scenes e compêndio usam apenas `visibleTo`. Se ainda restar `visibleToPlayers`
 * legado, calcula a audiência canônica pela regra A6 para remoção pelo chamador.
 */
function releasedAudienceRepair(data, gmUid) {
  const vis = Array.isArray(data.visibleTo) ? data.visibleTo : [];
  if (typeof data.visibleToPlayers !== "boolean") {
    return vis.length === 0 ? [gmUid] : null;
  }
  const expected = data.visibleToPlayers ? ["ALL"] : [gmUid];
  const diverges = vis.length === 0 || vis.includes("ALL") !== data.visibleToPlayers;
  return diverges ? expected : null;
}

function defaultFolderEditableBy({ folderType, scope, ownerId, gmUid }) {
  return computeAudience({
    ownerId: ownerId || gmUid,
    scope: folderType === "journal" ? scope || "player" : undefined,
    gmId: gmUid
  }).editableBy;
}

function normalizeFormula(formula) {
  return normalizeText(formula).replace(/\s+/g, "");
}

function sameFormula(a, b) {
  return normalizeFormula(a) === normalizeFormula(b);
}

function matchesSourceFormula(entry, sourceType, source) {
  if (!entry || !source) return false;
  if (sourceType === "ability") {
    return (
      sameFormula(entry.hitFormula, source.hitFormula) &&
      sameFormula(entry.effectFormula, source.effectFormula)
    );
  }
  if (sourceType === "skill") {
    const expectedHit =
      source.formula || `1d20 + @${source.attribute || "forca"} + ${Number(source.bonus) || 0}`;
    return sameFormula(entry.hitFormula, expectedHit) && !String(entry.effectFormula || "").trim();
  }
  if (sourceType === "item") {
    const itemFormula = source.rollFormula || "";
    const matchesHit =
      sameFormula(entry.hitFormula, itemFormula || "1d20") ||
      (Boolean(itemFormula) && sameFormula(entry.hitFormula, itemFormula));
    return matchesHit && !String(entry.effectFormula || "").trim();
  }
  if (sourceType === "attribute") {
    return (
      sameFormula(entry.hitFormula, `1d20 + @${source.key}`) &&
      !String(entry.effectFormula || "").trim()
    );
  }
  return false;
}

function findSourceByRef(character, sourceType, sourceId) {
  if (!character || !sourceType || !sourceId) return null;
  if (sourceType === "ability") {
    return (character.abilities || []).find((a) => a?.id === sourceId) || null;
  }
  if (sourceType === "skill") {
    return (character.skills || []).find((s) => s?.id === sourceId) || null;
  }
  if (sourceType === "item") {
    return (character.inventory || []).find((it) => it?.id === sourceId) || null;
  }
  if (sourceType === "attribute") {
    const attrs = Array.isArray(character.attributes) ? character.attributes : [];
    return attrs.find((a) => a?.key === sourceId) || null;
  }
  return null;
}

/**
 * Fase 3.1 (V-09d): vincula por nome um atalho legado (copiado por valor antes da Fase 3,
 * sem `sourceType`/`sourceId`) à habilidade, perícia, item ou atributo de origem da ficha.
 * Fase 6.3 (A16): só vincula quando a fórmula salva coincide com a da origem; caso contrário
 * preserva o atalho como `custom` para não substituir fórmulas próprias.
 * Fase 6.3 (A17): preserva `customIcon: true` em atalhos de atributo cujo ícone não seja padrão.
 */
function linkLegacyRollEntry(entry, character) {
  if (!entry || typeof entry !== "object" || entry.sourceType) return null;
  const target = normalizeText(entry.name);
  const sameName = (name) => Boolean(target) && normalizeText(name) === target;

  const ability = (character.abilities || []).find(
    (a) => sameName(a?.name) && matchesSourceFormula(entry, "ability", a)
  );
  const skill = (character.skills || []).find(
    (s) =>
      (sameName(s?.name) || sameName(`Perícia ${s?.name || ""}`)) &&
      matchesSourceFormula(entry, "skill", s)
  );
  const item = (character.inventory || []).find(
    (it) => sameName(it?.name) && matchesSourceFormula(entry, "item", it)
  );
  const attrs = Array.isArray(character.attributes) ? character.attributes : [];
  const attribute = attrs.find(
    (a) => sameName(`Teste ${a?.label || ""}`) && matchesSourceFormula(entry, "attribute", a)
  );

  let link = null;
  if (ability) link = { sourceType: "ability", sourceId: ability.id, sourceIcon: ability.icon };
  else if (skill) link = { sourceType: "skill", sourceId: skill.id, sourceIcon: skill.icon };
  else if (item) link = { sourceType: "item", sourceId: item.id, sourceIcon: item.icon };
  else if (attribute) link = { sourceType: "attribute", sourceId: attribute.key, sourceIcon: null };

  if (!link || !link.sourceId) {
    return { ...entry, sourceType: "custom", sourceId: null };
  }
  const customIcon =
    link.sourceType === "attribute"
      ? isCustomAttributeShortcutIcon(entry)
      : Boolean(entry.icon && link.sourceIcon && entry.icon !== link.sourceIcon);

  return {
    ...entry,
    sourceType: link.sourceType,
    sourceId: link.sourceId,
    customIcon
  };
}

function repairMigratedRollEntry(entry, character) {
  if (!entry || typeof entry !== "object" || !entry.sourceType || entry.sourceType === "custom") {
    return null;
  }
  // Reparo A16: atalho vinculado automaticamente pela Fase 3.1 (sem rollKind nem customName)
  // cuja fórmula própria diverge da origem volta a ser custom.
  if (
    entry.rollKind == null &&
    typeof entry.customName !== "boolean" &&
    entry.hitFormula !== undefined
  ) {
    const source = findSourceByRef(character, entry.sourceType, entry.sourceId);
    if (source && !matchesSourceFormula(entry, entry.sourceType, source)) {
      return { ...entry, sourceType: "custom", sourceId: null };
    }
  }
  // Reparo A17: atalho de atributo migrado antes desta correção com ícone personalizado
  if (
    entry.sourceType === "attribute" &&
    !entry.customIcon &&
    isCustomAttributeShortcutIcon(entry)
  ) {
    return { ...entry, customIcon: true };
  }
  return null;
}

function migrateLegacyShortcuts(character) {
  const result = {};
  const rollGroups = Array.isArray(character.rollGroups) ? character.rollGroups : null;
  const linkedRollsById = new Map();
  let groupsChanged = false;

  const nextGroups = rollGroups
    ? rollGroups.map((grp) => {
        const rolls = Array.isArray(grp?.rolls) ? grp.rolls : [];
        let changed = false;
        const nextRolls = rolls.map((r) => {
          const updated = r?.sourceType
            ? repairMigratedRollEntry(r, character)
            : linkLegacyRollEntry(r, character);
          const finalRoll = updated || r;
          if (finalRoll?.id) linkedRollsById.set(finalRoll.id, finalRoll);
          if (updated) changed = true;
          return finalRoll;
        });
        if (!changed) return grp;
        groupsChanged = true;
        return { ...grp, rolls: nextRolls };
      })
    : null;
  if (groupsChanged) result.rollGroups = nextGroups;

  if (Array.isArray(character.hotbar)) {
    let hotbarChanged = false;
    const nextHotbar = character.hotbar.map((slot) => {
      if (!slot || typeof slot !== "object") return slot;
      const fromGroup = slot.rollId ? linkedRollsById.get(slot.rollId) : null;
      if (!slot.sourceType) {
        hotbarChanged = true;
        if (fromGroup) {
          return {
            ...slot,
            sourceType: fromGroup.sourceType || "custom",
            sourceId: fromGroup.sourceId || null,
            customIcon: Boolean(fromGroup.customIcon)
          };
        }
        return linkLegacyRollEntry(slot, character) || slot;
      }

      if (
        fromGroup?.sourceType === "custom" &&
        slot.sourceType !== "custom" &&
        slot.rollKind == null &&
        typeof slot.customName !== "boolean"
      ) {
        hotbarChanged = true;
        return { ...slot, sourceType: "custom", sourceId: null };
      }

      const repaired = repairMigratedRollEntry(slot, character);
      if (repaired) {
        hotbarChanged = true;
        return repaired;
      }
      return slot;
    });
    if (hotbarChanged) result.hotbar = nextHotbar;
  }

  return result;
}

function isLegacyFishItem(item) {
  if (!item || typeof item !== "object") return false;
  const name = String(item.name || "").toLowerCase();
  const id = String(item.id || "").toLowerCase();
  const icon = String(item.icon || "").toLowerCase();
  const matchesFish =
    name.includes("peixe") ||
    name.includes("fish") ||
    name.includes("fluffy") ||
    id.includes("peixe") ||
    id.includes("fish");
  if (!matchesFish) return false;
  return (
    !icon ||
    icon === "meat" ||
    icon === "carne" ||
    icon === "fish" ||
    icon === "sword"
  );
}

export async function runCampaignMigrations({
  campaignId = DEFAULT_CAMPAIGN_ID,
  gmUid
}) {
  if (!campaignId || !gmUid) return;
  const sessionKey = `${campaignId}:${gmUid}`;
  if (migratedCampaignsSession.has(sessionKey)) return;
  const lastFailure = failedMigrationAt.get(sessionKey);
  if (lastFailure && Date.now() - lastFailure < MIGRATION_RETRY_MS) return;
  migratedCampaignsSession.add(sessionKey);

  try {
    let batch = writeBatch(db);
    let opCount = 0;

    const flushIfFull = async () => {
      if (opCount >= MAX_BATCH_OPS) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    };

    const queueSet = async (ref, data, options) => {
      batch.set(ref, data, options);
      opCount += 1;
      await flushIfFull();
    };

    const queueUpdate = async (ref, data) => {
      batch.update(ref, data);
      opCount += 1;
      await flushIfFull();
    };

    // 1. Migrar e normalizar Characters + Pastas legadas de Personagens
    const charsCol = collection(db, "campaigns", campaignId, "characters");
    const charsSnap = await getDocs(charsCol);
    // Fase 3.1 (V-07): documentos legados de pasta (já migrados ou não), por id, para
    // recuperar `editableBy` de pastas copiadas antes desta correção.
    const legacyFolderDocsById = new Map();

    for (const d of charsSnap.docs) {
      const data = d.data() || {};

      if (data.isFolder) {
        legacyFolderDocsById.set(d.id, data);
        if (!data.migratedToFoldersCollection) {
          const folderRef = doc(db, "campaigns", campaignId, "folders", d.id);
          const visibleTo =
            Array.isArray(data.visibleTo) && data.visibleTo.length > 0
              ? data.visibleTo
              : ["ALL"];
          const ownerId = data.ownerId || gmUid;
          await queueSet(
            folderRef,
            {
              id: d.id,
              campaignId,
              folderType: "character",
              isFolder: true,
              name: data.name || "Nova Pasta",
              parentId: data.parentId || null,
              ownerId,
              visibleTo,
              editableBy: Array.isArray(data.editableBy)
                ? data.editableBy
                : defaultFolderEditableBy({ folderType: "character", ownerId, gmUid }),
              isDeleted: Boolean(data.isDeleted),
              createdAt: data.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
          await queueUpdate(d.ref, {
            campaignId,
            isDeleted: Boolean(data.isDeleted),
            migratedToFoldersCollection: true
          });
        }
        continue;
      }

      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }
      if (!Array.isArray(data.visibleTo) || data.visibleTo.length === 0) {
        updates.visibleTo =
          data.type === "npc"
            ? Array.from(new Set([gmUid, data.ownerId].filter(Boolean)))
            : ["ALL"];
      }
      // Fase 6.2 (A8): o dono e o Mestre sempre fazem parte da audiência da ficha
      const repairedCharVis = audienceRepair(updates.visibleTo || data.visibleTo, {
        gmUid,
        ownerId: data.ownerId
      });
      if (repairedCharVis) updates.visibleTo = repairedCharVis;

      if (Array.isArray(data.inventory)) {
        let invChanged = false;
        const nextInv = data.inventory.map((it) => {
          if (isLegacyFishItem(it)) {
            invChanged = true;
            return { ...it, icon: "fluffy_fish" };
          }
          return it;
        });
        if (invChanged) {
          updates.inventory = nextInv;
        }
      }

      // Fase 3.1 (V-09d): atalhos legados (rollGroups/hotbar) passam a ter vínculo dinâmico
      Object.assign(updates, migrateLegacyShortcuts(data));

      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    // 2. Migrar e normalizar Notes + Pastas legadas do Diário
    const notesCol = collection(db, "campaigns", campaignId, "notes");
    const notesSnap = await getDocs(notesCol);

    for (const d of notesSnap.docs) {
      const data = d.data() || {};

      if (data.isFolder) {
        legacyFolderDocsById.set(d.id, data);
        if (!data.migratedToFoldersCollection) {
          const folderRef = doc(db, "campaigns", campaignId, "folders", d.id);
          const scope = data.scope || "player";
          const ownerId = data.ownerId || gmUid;
          const visibleTo =
            Array.isArray(data.visibleTo) && data.visibleTo.length > 0
              ? data.visibleTo
              : scope === "party"
              ? ["ALL"]
              : scope === "gm"
              ? [gmUid]
              : Array.from(new Set([gmUid, data.ownerId].filter(Boolean)));

          await queueSet(
            folderRef,
            {
              id: d.id,
              campaignId,
              folderType: "journal",
              isFolder: true,
              name: data.name || "",
              title: data.title || data.name || "",
              noteType: data.noteType || "lore",
              scope,
              ownerId,
              visibleTo,
              editableBy: Array.isArray(data.editableBy)
                ? data.editableBy
                : defaultFolderEditableBy({ folderType: "journal", scope, ownerId, gmUid }),
              isDeleted: Boolean(data.isDeleted),
              createdAt: data.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
          await queueUpdate(d.ref, {
            campaignId,
            isDeleted: Boolean(data.isDeleted),
            migratedToFoldersCollection: true
          });
        }
        continue;
      }

      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }

      const scope = data.scope || "player";
      const expectedVisibleTo =
        scope === "party"
          ? ["ALL"]
          : scope === "gm"
          ? [gmUid]
          : Array.from(
              new Set(
                [
                  gmUid,
                  data.ownerId,
                  ...(Array.isArray(data.sharedWithPlayerIds)
                    ? data.sharedWithPlayerIds
                    : [])
                ].filter(Boolean)
              )
            );

      if (!Array.isArray(data.visibleTo) || data.visibleTo.length === 0) {
        updates.visibleTo = expectedVisibleTo;
      }
      // Fase 6.2 (A8/A9): fora do escopo "gm", o dono e o Mestre sempre veem o card
      if (scope !== "gm") {
        const repairedNoteVis = audienceRepair(updates.visibleTo || data.visibleTo, {
          gmUid,
          ownerId: data.ownerId
        });
        if (repairedNoteVis) updates.visibleTo = repairedNoteVis;
      }

      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    // 3. Normalizar coleção dedicada Folders
    const foldersCol = collection(db, "campaigns", campaignId, "folders");
    const foldersSnap = await getDocs(foldersCol);
    for (const d of foldersSnap.docs) {
      const data = d.data() || {};
      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }
      if (!data.folderType) {
        updates.folderType = data.noteType ? "journal" : "character";
      }
      // Fase 3.1 (V-07): repara pastas copiadas antes desta correção (sem editableBy/isFolder/title)
      const folderType = data.folderType || updates.folderType;
      if (!Array.isArray(data.editableBy)) {
        const legacy = legacyFolderDocsById.get(d.id);
        updates.editableBy = Array.isArray(legacy?.editableBy)
          ? legacy.editableBy
          : defaultFolderEditableBy({
              folderType,
              scope: data.scope,
              ownerId: data.ownerId || gmUid,
              gmUid
            });
      }
      if (data.isFolder !== true) {
        updates.isFolder = true;
      }
      if (folderType === "journal" && !data.title && data.name) {
        updates.title = data.name;
      }
      if (!Array.isArray(data.visibleTo) || data.visibleTo.length === 0) {
        updates.visibleTo =
          data.scope === "gm"
            ? [gmUid]
            : data.scope === "player"
            ? Array.from(new Set([gmUid, data.ownerId].filter(Boolean)))
            : ["ALL"];
      }
      // Fase 6.2 (A7/A8): fora do escopo "gm", o dono e o Mestre sempre veem a pasta
      if (data.scope !== "gm") {
        const repairedFolderVis = audienceRepair(updates.visibleTo || data.visibleTo, {
          gmUid,
          ownerId: data.ownerId
        });
        if (repairedFolderVis) updates.visibleTo = repairedFolderVis;
      }
      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    // 4. Normalizar Scenes
    const scenesCol = collection(db, "campaigns", campaignId, "scenes");
    const scenesSnap = await getDocs(scenesCol);
    for (const d of scenesSnap.docs) {
      const data = d.data() || {};
      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }
      const releasedVis = releasedAudienceRepair(data, gmUid);
      if (releasedVis) {
        updates.visibleTo = releasedVis;
      }
      if (Object.hasOwn(data, "visibleToPlayers")) {
        updates.visibleToPlayers = deleteField();
      }
      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    // 5. Normalizar Compendium (e corrigir ícone Peixe Fluffy se existir)
    const compCol = collection(db, "campaigns", campaignId, "compendium");
    const compSnap = await getDocs(compCol);
    for (const d of compSnap.docs) {
      const data = d.data() || {};
      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }
      const releasedVis = releasedAudienceRepair(data, gmUid);
      if (releasedVis) {
        updates.visibleTo = releasedVis;
      }
      if (Object.hasOwn(data, "visibleToPlayers")) {
        updates.visibleToPlayers = deleteField();
      }
      const isV2CompendiumDoc =
        data.cost && typeof data.cost === "object" && !Array.isArray(data.cost);
      if (!isV2CompendiumDoc && isLegacyFishItem(data)) {
        updates.icon = "fluffy_fish";
      }
      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    // 6. Normalizar Messages
    const msgCol = collection(db, "campaigns", campaignId, "messages");
    const msgSnap = await getDocs(msgCol);
    for (const d of msgSnap.docs) {
      const data = d.data() || {};
      const updates = {};
      if (data.campaignId !== campaignId) {
        updates.campaignId = campaignId;
      }
      if (typeof data.isDeleted !== "boolean") {
        updates.isDeleted = false;
      }
      if (!Array.isArray(data.visibleTo) || data.visibleTo.length === 0) {
        updates.visibleTo =
          data.visibility === "gm_only"
            ? Array.from(new Set([gmUid, data.senderId].filter(Boolean)))
            : ["ALL"];
      }
      if (Object.keys(updates).length > 0) {
        await queueUpdate(d.ref, updates);
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
    failedMigrationAt.delete(sessionKey);
  } catch (err) {
    // Fase 6.2 (A5): a migração só fica marcada como feita quando termina; após falha, a próxima
    // atualização da campanha tenta de novo (no mínimo MIGRATION_RETRY_MS depois). As escritas são idempotentes.
    migratedCampaignsSession.delete(sessionKey);
    failedMigrationAt.set(sessionKey, Date.now());
    console.warn("Aviso ao executar migração de campanha:", err);
  }
}

