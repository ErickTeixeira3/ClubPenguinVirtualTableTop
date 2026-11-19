import { FieldValue } from "firebase-admin/firestore";
import { assertAudience, computeAudience } from "../../src/domain/audience.js";
import { FOLDER_DOMAINS, NOTE_SCOPES } from "../../src/domain/constants.js";

const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));

function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringArray(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) seen.add(clean);
    }
  }
  return Array.from(seen);
}

function sameStringArray(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, idx) => value === b[idx])
  );
}

function resolveReleasedVisibleTo(data, gmUid) {
  if (typeof data.visibleToPlayers === "boolean") {
    if (data.visibleToPlayers) {
      return ["ALL"];
    }
    const nonAll = cleanStringArray(data.visibleTo).filter((id) => id !== "ALL");
    if (nonAll.length > 0) {
      return gmUid ? cleanStringArray([gmUid, ...nonAll]) : nonAll;
    }
    return gmUid ? [gmUid] : [];
  }

  const current = cleanStringArray(data.visibleTo);
  if (current.length > 0) {
    return current.includes("ALL") ? ["ALL"] : current;
  }
  return gmUid ? [gmUid] : [];
}

function stripAll(list) {
  return cleanStringArray(list).filter((entry) => entry !== "ALL");
}

function inferNoteScope(data) {
  if (VALID_NOTE_SCOPES.has(data.scope)) {
    return data.scope;
  }
  if (data.visibleToPlayers === true) {
    return NOTE_SCOPES.PARTY;
  }
  const currentVis = cleanStringArray(data.visibleTo);
  if (currentVis.includes("ALL")) {
    return NOTE_SCOPES.PARTY;
  }
  return NOTE_SCOPES.PLAYER;
}

export default {
  id: "M002-audience",
  description:
    "Normaliza audiência canônica (visibleTo, editableBy, scope) em characters, folders, notes, scenes e compendium, garantindo dono e removendo visibleToPlayers.",

  async plan({ firestore }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      charactersUpdated: 0,
      foldersUpdated: 0,
      notesUpdated: 0,
      scenesUpdated: 0,
      compendiumUpdated: 0,
      campaignsUpdated: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();

    for (const campDoc of campaignsSnap.docs) {
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};
      const gmUid = trimOrNull(campData.gmId);
      summary.campaignsProcessed += 1;

      // 1. Characters
      const charsSnap = await firestore
        .collection(`campaigns/${campaignId}/characters`)
        .get();
      for (const charDoc of charsSnap.docs) {
        const data = charDoc.data() || {};
        const ownerId = trimOrNull(data.ownerId) || gmUid;
        if (!ownerId) {
          throw new Error(
            `M002-audience: campaigns/${campaignId}/characters/${charDoc.id} sem ownerId e campanha sem gmId.`
          );
        }

        const rawVisible =
          typeof data.visibleToPlayers === "boolean"
            ? data.visibleToPlayers
              ? ["ALL", ...cleanStringArray(data.visibleTo)]
              : stripAll(data.visibleTo)
            : data.visibleTo;

        const audience = computeAudience({
          ownerId,
          visibleTo: rawVisible,
          editableBy: data.editableBy,
          gmId: gmUid
        });

        assertAudience(
          {
            ...data,
            ownerId,
            visibleTo: audience.visibleTo,
            editableBy: audience.editableBy
          },
          {
            entityType: data.isFolder ? "folder" : "character",
            throwOnError: true
          }
        );

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (typeof data.isDeleted !== "boolean") updates.isDeleted = false;
        if (data.ownerId !== ownerId) updates.ownerId = ownerId;
        if (!sameStringArray(data.visibleTo, audience.visibleTo)) {
          updates.visibleTo = audience.visibleTo;
        }
        if (!sameStringArray(data.editableBy, audience.editableBy)) {
          updates.editableBy = audience.editableBy;
        }
        if (Object.hasOwn(data, "visibleToPlayers")) {
          updates.visibleToPlayers = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp();
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/characters/${charDoc.id}`,
            data: updates
          });
          summary.charactersUpdated += 1;
        }
      }

      // 2. Folders
      const foldersSnap = await firestore
        .collection(`campaigns/${campaignId}/folders`)
        .get();
      for (const folderDoc of foldersSnap.docs) {
        const data = folderDoc.data() || {};
        const isJournalFolder =
          data.folderType === FOLDER_DOMAINS.JOURNAL ||
          data.domain === FOLDER_DOMAINS.JOURNAL ||
          Boolean(data.noteType) ||
          (data.folderType !== FOLDER_DOMAINS.CHARACTER &&
            data.domain !== FOLDER_DOMAINS.CHARACTER &&
            VALID_NOTE_SCOPES.has(data.scope));

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (typeof data.isDeleted !== "boolean") updates.isDeleted = false;

        if (isJournalFolder) {
          const scope = inferNoteScope(data);
          const ownerId =
            scope === NOTE_SCOPES.GM
              ? gmUid || trimOrNull(data.ownerId)
              : trimOrNull(data.ownerId) || gmUid;
          if (!ownerId) {
            throw new Error(
              `M002-audience: campaigns/${campaignId}/folders/${folderDoc.id} sem ownerId e campanha sem gmId.`
            );
          }

          const rawVisible =
            typeof data.visibleToPlayers === "boolean"
              ? data.visibleToPlayers
                ? ["ALL", ...cleanStringArray(data.visibleTo)]
                : stripAll(data.visibleTo)
              : data.visibleTo;

          const audience = computeAudience({
            ownerId,
            scope,
            visibleTo: rawVisible,
            editableBy: data.editableBy,
            gmId: gmUid
          });

          assertAudience(
            {
              domain: FOLDER_DOMAINS.JOURNAL,
              scope,
              ownerId,
              visibleTo: audience.visibleTo,
              editableBy: audience.editableBy
            },
            { entityType: "folder", throwOnError: true }
          );

          if (data.scope !== scope) updates.scope = scope;
          if (data.ownerId !== ownerId) updates.ownerId = ownerId;
          if (!sameStringArray(data.visibleTo, audience.visibleTo)) {
            updates.visibleTo = audience.visibleTo;
          }
          if (!sameStringArray(data.editableBy, audience.editableBy)) {
            updates.editableBy = audience.editableBy;
          }
        } else {
          const ownerId = trimOrNull(data.ownerId) || gmUid;
          if (!ownerId) {
            throw new Error(
              `M002-audience: campaigns/${campaignId}/folders/${folderDoc.id} sem ownerId e campanha sem gmId.`
            );
          }

          const rawVisible =
            typeof data.visibleToPlayers === "boolean"
              ? data.visibleToPlayers
                ? ["ALL", ...cleanStringArray(data.visibleTo)]
                : stripAll(data.visibleTo)
              : data.visibleTo;

          const audience = computeAudience({
            ownerId,
            visibleTo: rawVisible,
            editableBy: data.editableBy,
            gmId: gmUid
          });

          assertAudience(
            {
              domain: FOLDER_DOMAINS.CHARACTER,
              ownerId,
              visibleTo: audience.visibleTo,
              editableBy: audience.editableBy
            },
            { entityType: "folder", throwOnError: true }
          );

          if (Object.hasOwn(data, "scope")) {
            updates.scope = FieldValue.delete();
          }
          if (data.ownerId !== ownerId) updates.ownerId = ownerId;
          if (!sameStringArray(data.visibleTo, audience.visibleTo)) {
            updates.visibleTo = audience.visibleTo;
          }
          if (!sameStringArray(data.editableBy, audience.editableBy)) {
            updates.editableBy = audience.editableBy;
          }
        }

        if (Object.hasOwn(data, "visibleToPlayers")) {
          updates.visibleToPlayers = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp();
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/folders/${folderDoc.id}`,
            data: updates
          });
          summary.foldersUpdated += 1;
        }
      }

      // 3. Notes
      const notesSnap = await firestore
        .collection(`campaigns/${campaignId}/notes`)
        .get();
      for (const noteDoc of notesSnap.docs) {
        const data = noteDoc.data() || {};
        const scope = inferNoteScope(data);
        const ownerId =
          scope === NOTE_SCOPES.GM
            ? trimOrNull(data.ownerId) || gmUid
            : trimOrNull(data.ownerId) || gmUid;
        if (!ownerId) {
          throw new Error(
            `M002-audience: campaigns/${campaignId}/notes/${noteDoc.id} sem ownerId e campanha sem gmId.`
          );
        }

        const legacyShared =
          scope !== NOTE_SCOPES.GM && Array.isArray(data.sharedWithPlayerIds)
            ? cleanStringArray(data.sharedWithPlayerIds)
            : [];
        const baseVisible =
          typeof data.visibleToPlayers === "boolean"
            ? data.visibleToPlayers
              ? ["ALL", ...cleanStringArray(data.visibleTo)]
              : stripAll(data.visibleTo)
            : cleanStringArray(data.visibleTo);
        const mergedVisible = [...baseVisible, ...legacyShared];

        const audience = computeAudience({
          ownerId,
          scope,
          visibleTo: mergedVisible,
          editableBy: data.editableBy,
          gmId: gmUid
        });

        assertAudience(
          {
            scope,
            ownerId,
            visibleTo: audience.visibleTo,
            editableBy: audience.editableBy
          },
          { entityType: "note", throwOnError: true }
        );

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (typeof data.isDeleted !== "boolean") updates.isDeleted = false;
        if (data.scope !== scope) updates.scope = scope;
        if (data.ownerId !== ownerId) updates.ownerId = ownerId;
        if (!sameStringArray(data.visibleTo, audience.visibleTo)) {
          updates.visibleTo = audience.visibleTo;
        }
        if (!sameStringArray(data.editableBy, audience.editableBy)) {
          updates.editableBy = audience.editableBy;
        }
        if (Object.hasOwn(data, "visibleToPlayers")) {
          updates.visibleToPlayers = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp();
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/notes/${noteDoc.id}`,
            data: updates
          });
          summary.notesUpdated += 1;
        }
      }

      // 4. Scenes (regra A6: visibleToPlayers booleano tem prioridade quando presente e é removido)
      const scenesSnap = await firestore
        .collection(`campaigns/${campaignId}/scenes`)
        .get();
      for (const sceneDoc of scenesSnap.docs) {
        const data = sceneDoc.data() || {};
        const nextVisibleTo = resolveReleasedVisibleTo(data, gmUid);
        assertAudience(
          { visibleTo: nextVisibleTo },
          { entityType: "scene", throwOnError: true }
        );

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (typeof data.isDeleted !== "boolean") updates.isDeleted = false;
        if (!sameStringArray(data.visibleTo, nextVisibleTo)) {
          updates.visibleTo = nextVisibleTo;
        }
        if (Object.hasOwn(data, "visibleToPlayers")) {
          updates.visibleToPlayers = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp();
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/scenes/${sceneDoc.id}`,
            data: updates
          });
          summary.scenesUpdated += 1;
        }
      }

      // 5. Compendium (regra A6: visibleToPlayers booleano tem prioridade quando presente e é removido)
      const compSnap = await firestore
        .collection(`campaigns/${campaignId}/compendium`)
        .get();
      for (const compDoc of compSnap.docs) {
        const data = compDoc.data() || {};
        const nextVisibleTo = resolveReleasedVisibleTo(data, gmUid);
        assertAudience(
          { visibleTo: nextVisibleTo },
          { entityType: "compendiumEntry", throwOnError: true }
        );

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (typeof data.isDeleted !== "boolean") updates.isDeleted = false;
        if (!sameStringArray(data.visibleTo, nextVisibleTo)) {
          updates.visibleTo = nextVisibleTo;
        }
        if (Object.hasOwn(data, "visibleToPlayers")) {
          updates.visibleToPlayers = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = FieldValue.serverTimestamp();
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/compendium/${compDoc.id}`,
            data: updates
          });
          summary.compendiumUpdated += 1;
        }
      }

      if (typeof campData.schemaVersion !== "number" || campData.schemaVersion < 2) {
        operations.push({
          kind: "fs.update",
          path: `campaigns/${campaignId}`,
          data: {
            schemaVersion: 2,
            updatedAt: FieldValue.serverTimestamp()
          }
        });
        summary.campaignsUpdated += 1;
      }
    }

    return { operations, summary };
  }
};
