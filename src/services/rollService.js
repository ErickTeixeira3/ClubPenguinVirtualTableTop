import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  ROLL_KINDS,
  buildTargetInfo,
  evaluateDcFormula,
} from "../engines/combatEngine";
import { evaluateFormula } from "../engines/formulaEngine";
import { normalizeText } from "../utils/stringUtils";

/**
 * Indica se o jogador removeu explicitamente a própria foto de perfil (A26),
 * bloqueando o fallback automático para `user.photoURL` do provedor de auth.
 */
export function isPlayerAvatarRemoved(playerRecord) {
  if (!playerRecord || typeof playerRecord !== "object") return false;
  if (playerRecord.avatarRemoved === true) return true;
  return (
    Object.hasOwn(playerRecord, "photoURL") &&
    playerRecord.photoURL === null &&
    !playerRecord.avatarMediaId
  );
}

const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));

/**
 * Fase 6.3 (A17): ícones que o código grava por padrão num atalho de atributo
 * ("sword" no 711451e, "clover" a partir da Fase 3.1). Qualquer outro foi escolhido pelo usuário.
 */
const DEFAULT_ATTRIBUTE_SHORTCUT_ICONS = new Set(["sword", "clover"]);

export function isCustomAttributeShortcutIcon(entry) {
  if (!entry) return false;
  if (entry.customIcon) return true;
  const icon = String(entry.icon || "").trim();
  if (!icon || DEFAULT_ATTRIBUTE_SHORTCUT_ICONS.has(icon)) return false;
  return normalizeText(icon) !== normalizeText(entry.name);
}

/**
 * Fase 6.3 (A18): nome exibido de um atalho vinculado.
 * - `customName === true`: nome salvo no atalho;
 * - `customName === false`: nome atual da origem (renomear a origem propaga);
 * - sem o campo (vinculado pela migração da Fase 3.1): nome salvo quando difere da origem
 *   (ex.: "Perícia Luta" do 711451e continua "Perícia Luta").
 */
export function resolveLinkedShortcutName(entry, sourceName) {
  const saved = String(entry?.name || "").trim();
  if (!sourceName) return saved || sourceName || "";
  if (!saved || entry?.customName === false) return sourceName;
  if (entry?.customName === true) return saved;
  return normalizeText(saved) === normalizeText(sourceName) ? sourceName : saved;
}

/**
 * Fase 3.1 (V-08): somente URLs HTTP(S) curtas podem ser persistidas em mensagens.
 * DataURLs (Base64) resolvidas para a tela nunca são gravadas no Firestore; a foto do
 * jogador é persistida por referência (`senderAvatarMediaId`) e resolvida na renderização.
 */
export function toPersistablePhotoUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && url.length < 2000
    ? url
    : null;
}

/**
 * Resolve identidade unificada do emissor (personagem ativo ou perfil do jogador).
 * Ponto único de verdade usado em useChatRolls, VTTLayout e ChatSidebarPanel.
 * - `photoURL`: URL para exibição imediata na UI (pode ser DataURL resolvida).
 * - `senderPhotoURL`: valor seguro para persistir (apenas HTTP(S) ou null).
 * - `senderAvatarMediaId`: referência à foto do jogador em media/{mediaId} (mensagens sem personagem).
 */
export function resolveSpeakerIdentity({
  character = null,
  user = null,
  myPlayerProfile = null,
  playersMap = null,
  senderName = null,
  senderPhotoURL = null,
  resolvedAvatarUrl = null,
}) {
  const playerProfile =
    myPlayerProfile || (user?.uid && playersMap?.[user.uid]) || null;

  const fallbackPlayerName =
    playerProfile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pinguim";

  const resolvedName = senderName || character?.name || fallbackPlayerName;

  if (!character) {
    const allowAuthPhotoFallback = !isPlayerAvatarRemoved(playerProfile);
    const playerPhoto =
      senderPhotoURL !== null && senderPhotoURL !== undefined
        ? senderPhotoURL
        : playerProfile?.photoURL ||
          (allowAuthPhotoFallback ? user?.photoURL : null) ||
          null;

    return {
      type: "player",
      name: resolvedName,
      senderName: resolvedName,
      photoURL: playerPhoto,
      senderPhotoURL: toPersistablePhotoUrl(playerPhoto),
      senderAvatarMediaId: playerProfile?.avatarMediaId || null,
      character: null,
      characterId: null,
      characterMediaId: null,
    };
  }

  const externalPhoto =
    character.avatarExternalUrl ||
    character.defaultToken?.externalUrl ||
    character.tokenImage ||
    character.avatarImage ||
    null;

  const charMediaId =
    character.avatarMediaId || character.defaultToken?.mediaId || null;

  const uiPhotoUrl = resolvedAvatarUrl || externalPhoto || null;
  const persistedPhotoUrl =
    senderPhotoURL !== null && senderPhotoURL !== undefined
      ? senderPhotoURL
      : character.avatarMediaId
      ? null
      : character.avatarExternalUrl
      ? character.avatarExternalUrl
      : charMediaId
      ? null
      : externalPhoto;

  return {
    type: "character",
    name: resolvedName,
    senderName: resolvedName,
    photoURL: uiPhotoUrl,
    senderPhotoURL: toPersistablePhotoUrl(persistedPhotoUrl),
    senderAvatarMediaId: null,
    character,
    characterId: character.id || null,
    characterMediaId: charMediaId,
  };
}

/**
 * Fase 3.1 (V-11): tipo de rolagem de um EFEITO (sem rolagem de acerto) conforme effectType.
 */
export function effectRollKind(effectType) {
  if (effectType === "heal" || effectType === "mp_heal") return ROLL_KINDS.HEAL;
  if (effectType === "utility") return ROLL_KINDS.UTILITY;
  return ROLL_KINDS.DAMAGE;
}

/**
 * Fase 3.1 (V-11): ponto único para o `rollKind` de habilidades/magias/perícias.
 * - Perícia sem fórmula de efeito => CHECK (teste, nunca ataque).
 * - Com acerto => ATTACK (comparado contra a Defesa do alvo).
 * - Só efeito => DAMAGE/HEAL/UTILITY conforme effectType.
 */
export function inferAbilityRollKind({
  hitFormula = "",
  effectFormula = "",
  effectType = null,
  isSkill = false,
} = {}) {
  const hasHit = Boolean(String(hitFormula || "").trim());
  const hasEffect = Boolean(String(effectFormula || "").trim());
  if (isSkill && !hasEffect) return ROLL_KINDS.CHECK;
  if (hasHit) return ROLL_KINDS.ATTACK;
  if (hasEffect) return effectRollKind(effectType);
  return ROLL_KINDS.CHECK;
}

/**
 * Classifica explicitamente o tipo de rolagem sem depender de heurística frágil por nome em português
 * (mantém fallback apenas para registros antigos sem metadado `rollKind`).
 */
export function classifyRollKind({
  rollKind = null,
  primaryFormula = "",
  secondaryFormula = "",
  effectType = null,
  deferSecondaryDamage = true,
  primaryLabel = "",
  title = "",
} = {}) {
  if (rollKind && VALID_ROLL_KINDS.has(rollKind)) {
    return rollKind;
  }

  const hasPrimary = Boolean(String(primaryFormula || "").trim());
  const hasSecondary = Boolean(String(secondaryFormula || "").trim());

  if (deferSecondaryDamage && hasPrimary && hasSecondary) {
    return ROLL_KINDS.ATTACK;
  }

  if (effectType === "heal" || effectType === "mp_heal") {
    return ROLL_KINDS.HEAL;
  }
  if (effectType === "mp_damage") {
    return ROLL_KINDS.MP_DAMAGE;
  }
  if (effectType === "damage") {
    return ROLL_KINDS.DAMAGE;
  }
  if (effectType === "utility") {
    return ROLL_KINDS.UTILITY;
  }

  // Fallback por rótulo apenas quando nenhum metadado foi informado.
  // Fase 3.1 (V-03): removido o ramo "d20 + alvo selecionado => ATAQUE" (introduzido na Fase 3),
  // que transformava rolagens livres de d20 em ataques contra a Defesa.
  if (
    primaryLabel === "Acerto" ||
    primaryLabel === "Ataque" ||
    /^(acerto|ataque|tiro|golpe)/i.test(primaryLabel || "") ||
    /^(ataque|tiro|golpe)/i.test(title || "")
  ) {
    return ROLL_KINDS.ATTACK;
  }

  return ROLL_KINDS.CHECK;
}

/**
 * Determina se uma mensagem de chat representa uma rolagem de ataque (comparada contra Defesa).
 * Usa metadados estruturais (`rollKind` e `damageConfig`), restringindo regex apenas a mensagens históricas legadas.
 */
export function isAttackRollMessage({ rollData = null, targetedToken = null } = {}) {
  if (!rollData) return false;

  const explicitKind = rollData.rollKind || null;
  if (
    explicitKind === ROLL_KINDS.DAMAGE ||
    explicitKind === ROLL_KINDS.HEAL ||
    explicitKind === ROLL_KINDS.MP_DAMAGE ||
    explicitKind === ROLL_KINDS.MP_HEAL ||
    explicitKind === ROLL_KINDS.SAVING_THROW ||
    Boolean(rollData.parentMessageId && !rollData.savingThrowOutcome)
  ) {
    return false;
  }

  if (
    explicitKind === ROLL_KINDS.ATTACK ||
    Boolean(rollData.damageConfig) ||
    Boolean(rollData.targetInfo?.isAttackRoll)
  ) {
    return true;
  }

  if (explicitKind) {
    return false;
  }

  // Retrocompatibilidade estrita com rolagens persistidas antes da Fase 3 sem `rollKind`
  const primaryRoll = rollData.primary || rollData.rolls?.[0] || null;
  return (
    /^(acerto|ataque|tiro|golpe)/i.test(primaryRoll?.label || "") ||
    /^(ataque|tiro|golpe)/i.test(rollData.title || "") ||
    (Boolean(targetedToken) && /\b1?d20\b/i.test(primaryRoll?.formulaOriginal || ""))
  );
}

/**
 * Resolve dinamicamente um atalho de `rollGroups` com vínculo por referência (`sourceType` + `sourceId`)
 * contra a entidade original da ficha (habilidade, perícia, item ou atributo).
 */
export function resolveDynamicRollEntry(entry, character) {
  if (!entry) return null;

  const sourceType = entry.sourceType || null;
  const sourceId = entry.sourceId || null;

  if (character && sourceType && sourceId) {
    if (sourceType === "ability") {
      const ab = (character.abilities || []).find((a) => a.id === sourceId);
      if (ab) {
        const hitFormula = ab.hitFormula || "";
        const effectFormula = ab.effectFormula || "";
        const effectType = ab.effectType || (effectFormula ? "damage" : null);
        const rollKind = inferAbilityRollKind({ hitFormula, effectFormula, effectType });

        return {
          ...entry,
          sourceType,
          sourceId,
          name: resolveLinkedShortcutName(entry, ab.name),
          color: ab.elementColor || entry.color || "#e53935",
          icon: entry.customIcon && entry.icon ? entry.icon : ab.icon || entry.icon || ab.name,
          description: ab.description || "",
          hitFormula,
          effectFormula,
          effectType,
          savingThrow: ab.savingThrow || null,
          range: ab.range || null,
          aoe: ab.aoe || null,
          trigger: ab.trigger || "active",
          costResource: ab.cost?.resource || "mp",
          costAmount: Number(ab.cost?.amount) || 0,
          rollKind,
          isLinkedMissing: false,
        };
      }
    } else if (sourceType === "skill") {
      const sk = (character.skills || []).find((s) => s.id === sourceId);
      if (sk) {
        const hitFormula =
          sk.formula || `1d20 + @${sk.attribute || "forca"} + ${Number(sk.bonus) || 0}`;
        return {
          ...entry,
          sourceType,
          sourceId,
          name: resolveLinkedShortcutName(entry, sk.name),
          color: entry.color || "#02529c",
          icon: entry.customIcon && entry.icon ? entry.icon : sk.icon || entry.icon || sk.name,
          description: `Perícia (${sk.attribute || "atributo"} +${Number(sk.bonus) || 0})`,
          hitFormula,
          effectFormula: "",
          effectType: null,
          savingThrow: null,
          costResource: "mp",
          costAmount: 0,
          rollKind: ROLL_KINDS.CHECK,
          isLinkedMissing: false,
        };
      }
    } else if (sourceType === "item") {
      const item = (character.inventory || []).find((it) => it.id === sourceId);
      if (item) {
        const hitFormula = item.rollFormula || "";
        const effectType = item.effectType || "heal";
        const rollKind = classifyRollKind({
          rollKind:
            effectType === "heal" || effectType === "mp_heal"
              ? ROLL_KINDS.HEAL
              : effectType === "damage" || effectType === "mp_damage"
              ? ROLL_KINDS.DAMAGE
              : effectType === "utility"
              ? ROLL_KINDS.UTILITY
              : ROLL_KINDS.CHECK,
          primaryFormula: hitFormula,
          effectType,
          deferSecondaryDamage: false,
        });

        return {
          ...entry,
          sourceType,
          sourceId,
          name: resolveLinkedShortcutName(entry, item.name),
          color: item.elementColor || entry.color || "#38c172",
          icon: entry.customIcon && entry.icon ? entry.icon : item.icon || entry.icon || item.name,
          description: item.description || "",
          hitFormula: hitFormula || "1d20",
          effectFormula: "",
          effectType,
          savingThrow: item.savingThrow || null,
          trigger: item.trigger || "active",
          consumeOnUse: Boolean(item.consumeOnUse),
          qty: Number(item.qty) || 0,
          costResource: "mp",
          costAmount: 0,
          rollKind,
          isLinkedMissing: false,
        };
      }
    } else if (sourceType === "attribute") {
      const attrList = Array.isArray(character.attributes) ? character.attributes : [];
      const attr = attrList.find((a) => a.key === sourceId);
      if (attr) {
        return {
          ...entry,
          sourceType,
          sourceId,
          name: resolveLinkedShortcutName(entry, `Teste ${attr.label}`),
          color: entry.color || "#02529c",
          // Fase 3.1 (V-19): atributo usa sempre o ícone "clover", salvo ícone personalizado.
          // Fase 6.3 (A17): ícone salvo diferente do padrão ("sword"/"clover") conta como personalizado.
          icon: isCustomAttributeShortcutIcon(entry) ? entry.icon : "clover",
          hitFormula: `1d20 + @${attr.key}`,
          effectFormula: "",
          effectType: null,
          savingThrow: null,
          costResource: "mp",
          costAmount: 0,
          rollKind: ROLL_KINDS.CHECK,
          isLinkedMissing: false,
        };
      }
    }
  }

  // Fase 3.1 (V-11): rolagem personalizada só de acerto (sem fórmula de efeito) não herda
  // o effectType "damage" padrão do formulário — passa a ser CHECK, não DAMAGE.
  const hasEffectFormula = Boolean(String(entry.effectFormula || "").trim());
  const effectiveEffectType =
    !hasEffectFormula && entry.effectType === "damage" ? null : entry.effectType || null;

  const inferredKind = classifyRollKind({
    rollKind: entry.rollKind || null,
    primaryFormula: entry.hitFormula || "",
    secondaryFormula: entry.effectFormula || "",
    effectType: effectiveEffectType,
    deferSecondaryDamage: Boolean(entry.hitFormula && entry.effectFormula),
    title: entry.name || "",
  });

  // Fase 6.3 (A15): rolagem personalizada antiga só de acerto, sem `rollKind` salvo
  // (ex.: "Disparo", "Espada"), vira ataque quando houver alvo no momento da rolagem.
  // Rolagens novas gravam o tipo escolhido no formulário (Ataque ou Teste).
  const hasExplicitKind = Boolean(
    entry.rollKind && VALID_ROLL_KINDS.has(entry.rollKind) && !entry.attackWhenTargeted
  );
  const attackWhenTargeted =
    (!sourceType || sourceType === "custom") &&
    !hasExplicitKind &&
    !hasEffectFormula &&
    !effectiveEffectType &&
    Boolean(String(entry.hitFormula || "").trim()) &&
    inferredKind === ROLL_KINDS.CHECK;

  return {
    ...entry,
    effectType: effectiveEffectType,
    rollKind: inferredKind,
    attackWhenTargeted,
    // Vínculo com a fonte original (sourceType + sourceId) que não existe mais na ficha
    isLinkedMissing: Boolean(sourceType && sourceId),
  };
}

/**
 * Fase 3.1 (V-03 / V-09b): monta os parâmetros de execução de um atalho já resolvido
 * (aba Rolagens & Ações e Hotbar de Bolas de Neve usam exatamente a mesma montagem).
 */
export function buildShortcutRollParams(resolvedRoll, character = null) {
  if (!resolvedRoll) return null;
  const costAmt = Number(resolvedRoll.costAmount) || 0;
  const effectType =
    resolvedRoll.effectType || (resolvedRoll.effectFormula ? "damage" : null);
  const rollKind =
    resolvedRoll.rollKind ||
    inferAbilityRollKind({
      hitFormula: resolvedRoll.hitFormula,
      effectFormula: resolvedRoll.effectFormula,
      effectType,
    });
  const primaryLabel =
    rollKind === ROLL_KINDS.ATTACK
      ? "Acerto"
      : rollKind === ROLL_KINDS.SAVING_THROW
        ? "Resistência"
        : "Rolagem";

  return {
    title: resolvedRoll.name,
    categoryColor: resolvedRoll.color || "#3090f0",
    description: resolvedRoll.description || "",
    primaryFormula: resolvedRoll.hitFormula ?? "1d20",
    primaryLabel,
    rollKind,
    trigger: resolvedRoll.trigger || null,
    range: resolvedRoll.range || null,
    aoe: resolvedRoll.aoe || null,
    secondaryFormula: resolvedRoll.effectFormula || "",
    secondaryLabel: "Efeito / Dano",
    character,
    cost: costAmt > 0 ? { resource: resolvedRoll.costResource || "mp", amount: costAmt } : null,
    costResource: resolvedRoll.costResource,
    costAmount: resolvedRoll.costAmount,
    effectType,
    savingThrow: resolvedRoll.savingThrow || null,
    icon: resolvedRoll.icon || resolvedRoll.name,
    // Fase 6.3 (A15): decidido em handleExecuteSheetRoll, conforme haja alvo
    attackWhenTargeted: Boolean(resolvedRoll.attackWhenTargeted),
  };
}

/**
 * Fase 3.1 (V-09b): ponto único para gravar um atalho num slot da Hotbar (ficha e barra rápida).
 * O slot guarda a referência (`rollId` + `sourceType`/`sourceId`) e uma cópia apenas de reserva;
 * na execução, resolveHotbarSlot sempre relê o atalho e a fonte original da ficha.
 */
export function buildHotbarSlotFromRoll(resolvedRoll) {
  if (!resolvedRoll) return null;
  return {
    rollId: resolvedRoll.id,
    sourceType: resolvedRoll.sourceType || "custom",
    sourceId: resolvedRoll.sourceId || null,
    customIcon: Boolean(resolvedRoll.customIcon),
    ...(typeof resolvedRoll.customName === "boolean" ? { customName: resolvedRoll.customName } : {}),
    name: resolvedRoll.name,
    color: resolvedRoll.color || "#02529c",
    icon: resolvedRoll.icon || resolvedRoll.name,
    hitFormula: resolvedRoll.hitFormula ?? "1d20",
    effectFormula: resolvedRoll.effectFormula || "",
    effectType: resolvedRoll.effectType || (resolvedRoll.effectFormula ? "damage" : null),
    rollKind: resolvedRoll.attackWhenTargeted ? null : (resolvedRoll.rollKind || null),
    range: resolvedRoll.range || null,
    aoe: resolvedRoll.aoe || null,
    trigger: resolvedRoll.trigger || null,
    savingThrow: resolvedRoll.savingThrow || null,
    costResource: resolvedRoll.costResource || "mp",
    costAmount: resolvedRoll.costAmount || 0,
  };
}

/**
 * Resolve um slot da Hotbar 3x3 em duas camadas:
 * slot.rollId -> item atualizado em rollGroups -> fonte original (habilidade/perícia/item).
 */
export function resolveHotbarSlot(slot, character) {
  if (!slot) return null;

  let baseEntry = slot;
  if (character && slot.rollId) {
    const rollGroups = Array.isArray(character.rollGroups) ? character.rollGroups : [];
    for (const grp of rollGroups) {
      const found = (grp.rolls || []).find((r) => r.id === slot.rollId);
      if (found) {
        // Fase 6.3 (A19): o resultado preserva o `rollId` do slot salvo (o atalho do grupo só
        // tem `id`), para a ficha reconhecer o slot do atalho e oferecer "Remover".
        baseEntry = {
          ...found,
          rollId: slot.rollId,
          sourceType: found.sourceType || slot.sourceType || null,
          sourceId: found.sourceId || slot.sourceId || null,
        };
        break;
      }
    }
  }

  return resolveDynamicRollEntry(baseEntry, character);
}

/**
 * Fase 3.1 (errata Fase 3 §4.2): escritas de mensagens que ainda estavam no hook useChatRolls.
 * Mescla `partialRollData` no rollData atual da mensagem (aplicação de efeitos pelo Mestre).
 */
export async function updateChatMessageRollData({ campaignId, message, partialRollData = {} }) {
  if (!campaignId || !message?.id) return;
  await updateDoc(doc(db, "campaigns", campaignId, "messages", message.id), {
    campaignId,
    rollData: {
      ...(message.rollData || {}),
      ...partialRollData,
    },
  });
}

/** Soft Delete de mensagem (D-3: somente o Mestre apaga mensagens; garantido também pela rule). */
export async function softDeleteChatMessage({ campaignId, user, msgId }) {
  if (!campaignId || !msgId) return;
  await updateDoc(doc(db, "campaigns", campaignId, "messages", msgId), {
    campaignId,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user?.uid || "gm",
  });
}

export function buildVisibilityAudience(visibility, campaign, user) {
  const gmUid = campaign?.gmId;
  if (visibility === "gm_only") {
    return Array.from(new Set([gmUid, user?.uid].filter(Boolean)));
  }
  if (visibility === "self") {
    return [user?.uid].filter(Boolean);
  }
  return ["ALL"];
}

export async function sendEmoteChatMessage({
  campaignId,
  campaign,
  user,
  icon,
  senderName = null,
  senderPhotoURL = null,
  character = null,
  characterId = null,
  characterMediaId = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !icon) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character: character || (characterId ? { id: characterId, name: senderName, avatarMediaId: characterMediaId } : null),
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  const emoteMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: characterId || identity.characterId,
    characterMediaId: characterMediaId || identity.characterMediaId,
    type: "emote",
    visibility,
    visibleTo: buildVisibilityAudience(visibility, campaign, user),
    icon,
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, emoteMessage);
  return emoteMessage;
}

export async function sendTextChatMessage({
  campaignId,
  campaign,
  user,
  content,
  senderName = null,
  senderPhotoURL = null,
  character = null,
  characterId = null,
  characterMediaId = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !content?.trim()) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character: character || (characterId ? { id: characterId, name: senderName, avatarMediaId: characterMediaId } : null),
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  const payload = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: characterId || identity.characterId,
    characterMediaId: characterMediaId || identity.characterMediaId,
    type: "text",
    visibility,
    visibleTo: buildVisibilityAudience(visibility, campaign, user),
    content: content.trim(),
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, payload);
  return payload;
}

export async function sendSkillPingChatMessage({
  campaignId,
  campaign,
  user,
  character = null,
  skill = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !skill) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character,
    user,
    playersMap: campaign?.players,
  });

  const pingMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: identity.characterId,
    characterMediaId: identity.characterMediaId,
    type: "skill_ping",
    visibility,
    visibleTo: buildVisibilityAudience(visibility, campaign, user),
    content: skill.description || "",
    skillData: {
      id: skill.id || `sk_${Date.now()}`,
      name: skill.name || "Habilidade",
      elementColor: skill.elementColor || "#02529c",
      cost: skill.cost || null,
      hitFormula: skill.hitFormula || skill.formula || "",
      effectFormula: skill.effectFormula || "",
      trigger: skill.trigger || null,
      effectType: skill.effectType || null,
      savingThrow: skill.savingThrow || null,
      range: skill.range || null,
      aoe: skill.aoe || null,
      description: skill.description || "",
      icon: skill.icon || skill.name || null,
      attribute: skill.attribute || null,
      bonus: skill.bonus !== undefined ? skill.bonus : null,
    },
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, pingMessage);
  return pingMessage;
}

export async function executeChatRollMessage({
  campaignId,
  campaign,
  user,
  title = "Rolagem",
  categoryColor = "#3090f0",
  description = "",
  character = null,
  senderName = null,
  senderPhotoURL = null,
  primaryFormula = "1d20",
  primaryLabel = "Resultado",
  secondaryFormula = "",
  secondaryLabel = "Efeito / Dano",
  cost = null,
  visibility = "public",
  onDeductResource = null,
  icon = null,
  targetedToken = null,
  targetedTokens = [],
  allCharacters = [],
  effectType = null,
  savingThrow = null,
  rollKind = null,
  deferSecondaryDamage = true,
  targetInfoOverride = null,
  parentMessageId = null,
  respondedToSaveId = null,
  savingThrowOutcome = null,
}) {
  if (!user || !campaignId) return null;

  let costPaid = null;
  if (
    cost &&
    Number(cost.amount) > 0 &&
    cost.resource &&
    character &&
    onDeductResource
  ) {
    const resKey = cost.resource;
    const currentVal = Number(character.resources?.[resKey]?.current) || 0;
    const amount = Number(cost.amount) || 0;
    const nextVal = Math.max(0, currentVal - amount);
    // Fase 3.1 (V-05): o 4º argumento informa o custo bruto para que o chamador possa
    // descontar da instância do token (matriz GM/NPC) em vez da ficha-matriz.
    // Fase 6.4 (A21): só registra costPaid quando o desconto realmente ocorreu.
    const deductResult = await onDeductResource(character.id, resKey, nextVal, { amount });
    const didDeduct =
      deductResult === undefined
        ? true
        : typeof deductResult === "boolean"
        ? deductResult
        : Boolean(deductResult?.deducted);
    if (didDeduct) {
      costPaid = {
        resource: resKey.toUpperCase(),
        amount,
      };
    }
  }

  const hasPrimary = Boolean(primaryFormula?.trim());
  const hasSecondary = Boolean(secondaryFormula?.trim());
  const resolvedEffectType = effectType || (hasSecondary ? "damage" : null);

  const isAttackWithDamage = deferSecondaryDamage && hasPrimary && hasSecondary;
  const isStandaloneDamageAbility =
    deferSecondaryDamage &&
    !hasPrimary &&
    hasSecondary &&
    resolvedEffectType === "damage";

  const rolls = [];
  let primaryResult = null;

  if (hasPrimary && !isStandaloneDamageAbility) {
    const r1 = evaluateFormula(primaryFormula, character);
    primaryResult = {
      label: primaryLabel || (hasSecondary ? "Ataque" : "Rolagem"),
      ...r1,
    };
    rolls.push(primaryResult);
  }

  if (hasSecondary && !isAttackWithDamage && !isStandaloneDamageAbility) {
    const r2 = evaluateFormula(secondaryFormula, character);
    rolls.push({
      label: secondaryLabel || "Efeito",
      ...r2,
    });
  }

  const effectiveTargetedTokens =
    Array.isArray(targetedTokens) && targetedTokens.length > 0
      ? targetedTokens
      : targetedToken
      ? [targetedToken]
      : [];
  const effectiveTargetedToken = effectiveTargetedTokens[0] || null;

  const resolvedRollKind = classifyRollKind({
    rollKind,
    primaryFormula,
    secondaryFormula,
    effectType: resolvedEffectType,
    deferSecondaryDamage,
    primaryLabel,
    title,
    hasTarget: Boolean(effectiveTargetedToken),
  });

  const isAttackRoll = resolvedRollKind === ROLL_KINDS.ATTACK;

  const targetInfo =
    targetInfoOverride ||
    (effectiveTargetedTokens.length > 0
      ? buildTargetInfo({
          targetedToken: effectiveTargetedToken,
          targetedTokens: effectiveTargetedTokens,
          allCharacters,
          attackTotal: isAttackRoll ? primaryResult?.total ?? null : null,
          isAttackRoll,
        })
      : null);

  let damageConfig = null;
  if (isAttackWithDamage || isStandaloneDamageAbility) {
    damageConfig = {
      formula: secondaryFormula.trim(),
      label: secondaryLabel || "Dano",
      effectType: resolvedEffectType || "damage",
      isCritSuggested: Boolean(primaryResult?.isCrit),
      savingThrow: savingThrow?.enabled ? savingThrow : null,
    };
  }

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character,
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  let savingThrowRequest = null;
  if (
    savingThrow?.enabled &&
    (!isAttackRoll || !targetInfo || targetInfo.isHit !== false)
  ) {
    const dcVal = evaluateDcFormula(savingThrow.dcFormula, character);
    savingThrowRequest = {
      id: `save_${msgId}`,
      parentMessageId: msgId,
      dc: dcVal,
      dcFormula: savingThrow.dcFormula || String(dcVal),
      attribute: savingThrow.attribute || "resistencia",
      effectDescription: savingThrow.effectDescription || "",
      sourceRollName: title,
      sourceCharacterId: character?.id || null,
      sourceCharacterName: identity.senderName,
      targetTokenId: targetInfo?.tokenId || null,
      targetSceneId: targetInfo?.sceneId || null,
      targetCharacterId: targetInfo?.characterId || null,
      targetName: targetInfo?.name || "Alvo",
      targetOwnerId: targetInfo?.ownerId || null,
      targetEditableBy: targetInfo?.editableBy || [],
      targetCharacterType: targetInfo?.characterType || "npc",
    };
  }

  const effectiveRollForEffect =
    rolls.length > 1 ? rolls[rolls.length - 1] : rolls[0] || null;
  const effectValue =
    !damageConfig &&
    effectiveRollForEffect &&
    (resolvedRollKind === ROLL_KINDS.DAMAGE ||
      resolvedRollKind === ROLL_KINDS.HEAL ||
      resolvedRollKind === ROLL_KINDS.MP_DAMAGE ||
      resolvedRollKind === ROLL_KINDS.MP_HEAL ||
      resolvedEffectType === "damage" ||
      resolvedEffectType === "heal" ||
      resolvedEffectType === "mp_damage" ||
      resolvedEffectType === "mp_heal")
      ? Number(effectiveRollForEffect.total) || 0
      : null;

  const resolvedSavingThrowOutcome =
    savingThrowOutcome && primaryResult
      ? {
          ...savingThrowOutcome,
          total: primaryResult.total,
          passed: Number(primaryResult.total) >= Number(savingThrowOutcome.dc || 10),
          categoryColor:
            Number(primaryResult.total) >= Number(savingThrowOutcome.dc || 10)
              ? "#16a34a"
              : "#dc2626",
        }
      : savingThrowOutcome;

  const rollMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: identity.characterId,
    characterMediaId: identity.characterMediaId,
    type: "ability_roll",
    visibility,
    visibleTo: buildVisibilityAudience(visibility, campaign, user),
    content: description || "",
    icon: icon || null,
    isDeleted: false,
    rollData: {
      title,
      categoryColor: resolvedSavingThrowOutcome?.categoryColor || categoryColor,
      costPaid,
      rolls,
      primary: primaryResult,
      icon: icon || null,
      characterId: identity.characterId,
      rollKind: resolvedRollKind,
      effectType: resolvedEffectType,
      effectValue,
      targetInfo,
      damageConfig,
      savingThrowRequest,
      parentMessageId,
      respondedToSaveId,
      savingThrowOutcome: resolvedSavingThrowOutcome,
    },
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, rollMessage);
  return rollMessage;
}
