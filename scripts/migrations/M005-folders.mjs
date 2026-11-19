import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { computeAudience } from "../../src/domain/audience.js";
import {
  FOLDER_DOMAINS,
  ID_PREFIXES,
  NOTE_SCOPES,
  NOTE_TYPES
} from "../../src/domain/constants.js";
import {
  LEGACY_FOLDER_KEYS as MODEL_LEGACY_FOLDER_KEYS,
  fromFolderDoc,
  normalizeFolder,
  toFolderDoc
} from "../../src/domain/models/folder.js";

const LEGACY_FOLDER_STRIP_KEYS = ["id", ...MODEL_LEGACY_FOLDER_KEYS];
const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

function hasAnyKey(obj, keys) {
  return keys.some((k) => Object.hasOwn(obj, k));
}

function stableEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (typeof a.toMillis === "function" && typeof b.toMillis === "function") {
    return a.toMillis() === b.toMillis();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((v, idx) => stableEquals(v, b[idx]));
  }
  const keysA = Object.keys(a).filter((k) => a[k] !== undefined).sort();
  const keysB = Object.keys(b).filter((k) => b[k] !== undefined).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, idx) => k === keysB[idx] && stableEquals(a[k], b[k]));
}

function deterministicFolderId(parts) {
  const hash = createHash("sha1").update(parts.join("|")).digest("hex");
  return `${ID_PREFIXES.FOLDER}_m005_${hash.slice(0, 12)}`;
}

function splitPathSegments(rawName) {
  return String(rawName || "")
    .split("/")
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function sanitizeSingleFolderName(rawName, fallback = "Pasta") {
  const clean = String(rawName || "")
    .replaceAll("/", " - ")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback;
}

function resolveFolderDomain(raw) {
  if (raw.domain === FOLDER_DOMAINS.CHARACTER || raw.domain === FOLDER_DOMAINS.JOURNAL) {
    return raw.domain;
  }
  if (raw.folderType === FOLDER_DOMAINS.CHARACTER || raw.folderType === FOLDER_DOMAINS.JOURNAL) {
    return raw.folderType;
  }
  if (typeof raw.noteType === "string" && raw.noteType.trim()) {
    return FOLDER_DOMAINS.JOURNAL;
  }
  return FOLDER_DOMAINS.CHARACTER;
}

function resolveJournalScope(raw) {
  if (VALID_NOTE_SCOPES.has(raw.scope)) return raw.scope;
  if (raw.scope === "ALL") return NOTE_SCOPES.PARTY;
  const visibleTo = Array.isArray(raw.visibleTo) ? raw.visibleTo : [];
  if (visibleTo.includes("ALL")) return NOTE_SCOPES.PARTY;
  return NOTE_SCOPES.PLAYER;
}

function resolveJournalNoteType(raw) {
  if (VALID_NOTE_TYPES.has(raw.noteType)) return raw.noteType;
  return NOTE_TYPES.LORE;
}

function isParentCompatible(folder, parentFolder) {
  if (!parentFolder || parentFolder.id === folder.id) return false;
  if (parentFolder.domain !== folder.domain) return false;
  if (!folder.isDeleted && parentFolder.isDeleted) return false;
  if (folder.domain === FOLDER_DOMAINS.CHARACTER) {
    return (parentFolder.ownerId || null) === (folder.ownerId || null);
  }
  if (parentFolder.scope !== folder.scope) return false;
  if (parentFolder.noteType !== folder.noteType) return false;
  if (folder.scope === NOTE_SCOPES.PLAYER) {
    return (parentFolder.ownerId || null) === (folder.ownerId || null);
  }
  return true;
}

function isCharacterFolderCompatible(charDoc, folder) {
  if (!folder) return false;
  if (folder.domain !== FOLDER_DOMAINS.CHARACTER) return false;
  if ((folder.ownerId || null) !== (charDoc.ownerId || null)) return false;
  if (!charDoc.isDeleted && folder.isDeleted) return false;
  return true;
}

function isNoteFolderCompatible(noteDoc, folder) {
  if (!folder) return false;
  if (folder.domain !== FOLDER_DOMAINS.JOURNAL) return false;
  const noteScope = VALID_NOTE_SCOPES.has(noteDoc.scope) ? noteDoc.scope : NOTE_SCOPES.PARTY;
  const noteType = VALID_NOTE_TYPES.has(noteDoc.noteType) ? noteDoc.noteType : NOTE_TYPES.LORE;
  if (folder.scope !== noteScope) return false;
  if (folder.noteType !== noteType) return false;
  if (noteScope === NOTE_SCOPES.PLAYER) {
    if ((folder.ownerId || null) !== (noteDoc.ownerId || null)) return false;
  }
  if (!noteDoc.isDeleted && folder.isDeleted) return false;
  return true;
}

function normalizeFolderCandidate({ id, campaignId, raw, gmUid }) {
  const domain = resolveFolderDomain(raw);
  const scope = domain === FOLDER_DOMAINS.JOURNAL ? resolveJournalScope(raw) : null;
  const noteType = domain === FOLDER_DOMAINS.JOURNAL ? resolveJournalNoteType(raw) : null;
  let ownerId = trimOrEmpty(raw.ownerId) || gmUid || "system";
  if (domain === FOLDER_DOMAINS.JOURNAL && scope === NOTE_SCOPES.GM && gmUid) {
    ownerId = gmUid;
  }

  const parsed = fromFolderDoc(
    {
      ...raw,
      domain,
      scope,
      noteType,
      ownerId
    },
    id,
    { campaignId, gmId: gmUid || undefined }
  );

  const audience = computeAudience({
    ownerId,
    scope: domain === FOLDER_DOMAINS.JOURNAL ? scope : undefined,
    gmId: gmUid || undefined,
    visibleTo:
      Array.isArray(raw.visibleTo)
        ? raw.visibleTo
        : raw.visibleToPlayers === false
          ? [ownerId]
          : domain === FOLDER_DOMAINS.CHARACTER
            ? ["ALL"]
            : undefined,
    editableBy:
      Array.isArray(raw.editableBy)
        ? raw.editableBy
        : domain === FOLDER_DOMAINS.CHARACTER
          ? [ownerId]
          : undefined
  });

  return {
    ...parsed,
    id,
    campaignId,
    domain,
    scope,
    noteType,
    ownerId,
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    parentId: trimOrEmpty(raw.parentId) || null,
    isDeleted: Boolean(raw.isDeleted),
    deletedAt: raw.isDeleted ? raw.deletedAt ?? null : null,
    deletedBy: raw.isDeleted ? trimOrEmpty(raw.deletedBy) || gmUid || ownerId : null,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
    order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : 0
  };
}

export default {
  id: "M005-folders",
  description:
    "Unifica pastas legadas de characters/ e notes/ em folders/ v2, resolve path->parentId e mapeia note.folder -> note.folderId.",
  async plan({ firestore }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      legacyCharacterFoldersMigrated: 0,
      legacyNoteFoldersMigrated: 0,
      foldersNormalized: 0,
      foldersCreatedFromPaths: 0,
      folderCyclesBroken: 0,
      notesScanned: 0,
      notesUpdated: 0,
      charactersFolderChecked: 0,
      characterFolderIdsReset: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();

    for (const campDoc of campaignsSnap.docs) {
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};
      const gmUid = trimOrEmpty(campData.gmId) || null;
      summary.campaignsProcessed += 1;

      const [charsSnap, notesSnap, foldersSnap] = await Promise.all([
        firestore.collection(`campaigns/${campaignId}/characters`).get(),
        firestore.collection(`campaigns/${campaignId}/notes`).get(),
        firestore.collection(`campaigns/${campaignId}/folders`).get()
      ]);

      const existingFolderRawById = new Map();
      const workingFoldersById = new Map();

      for (const fDoc of foldersSnap.docs) {
        const raw = fDoc.data() || {};
        existingFolderRawById.set(fDoc.id, raw);
        workingFoldersById.set(
          fDoc.id,
          normalizeFolderCandidate({ id: fDoc.id, campaignId, raw, gmUid })
        );
      }

      for (const cDoc of charsSnap.docs) {
        const raw = cDoc.data() || {};
        if (raw.isFolder !== true) continue;
        summary.legacyCharacterFoldersMigrated += 1;
        operations.push({ kind: "fs.delete", path: cDoc.ref.path });

        if (!workingFoldersById.has(cDoc.id)) {
          workingFoldersById.set(
            cDoc.id,
            normalizeFolderCandidate({
              id: cDoc.id,
              campaignId,
              raw: { ...raw, folderType: FOLDER_DOMAINS.CHARACTER },
              gmUid
            })
          );
        }
      }

      for (const nDoc of notesSnap.docs) {
        const raw = nDoc.data() || {};
        if (raw.isFolder !== true) continue;
        summary.legacyNoteFoldersMigrated += 1;
        operations.push({ kind: "fs.delete", path: nDoc.ref.path });

        if (!workingFoldersById.has(nDoc.id)) {
          workingFoldersById.set(
            nDoc.id,
            normalizeFolderCandidate({
              id: nDoc.id,
              campaignId,
              raw: {
                ...raw,
                folderType: FOLDER_DOMAINS.JOURNAL,
                noteType: raw.noteType || NOTE_TYPES.LORE,
                scope: raw.scope || NOTE_SCOPES.PARTY
              },
              gmUid
            })
          );
        }
      }

      // Garante ou encontra cadeia hierárquica de pastas para um caminho "A/B" no Diário
      const findMatchingJournalFolder = ({
        scope,
        ownerId,
        noteType,
        parentId,
        name,
        allowDeleted = false
      }) => {
        for (const candidate of workingFoldersById.values()) {
          if (candidate.domain !== FOLDER_DOMAINS.JOURNAL) continue;
          if (!allowDeleted && candidate.isDeleted) continue;
          if (candidate.scope !== scope || candidate.noteType !== noteType) continue;
          if (scope === NOTE_SCOPES.PLAYER && (candidate.ownerId || null) !== (ownerId || null)) {
            continue;
          }
          if ((candidate.parentId || null) !== (parentId || null)) continue;
          if (trimOrEmpty(candidate.name) === name) {
            return candidate;
          }
        }
        return null;
      };

      const ensureJournalHierarchy = ({
        segments,
        initialParentId = null,
        scope,
        ownerId,
        noteType,
        leafFolderId = null,
        baseVisibleTo,
        baseEditableBy,
        allowDeleted = false
      }) => {
        let currentParentId = initialParentId || null;
        let pathAccum = currentParentId ? `parent:${currentParentId}` : "";

        for (let i = 0; i < segments.length; i += 1) {
          const isLeaf = i === segments.length - 1;
          const cleanSeg = sanitizeSingleFolderName(segments[i]);
          pathAccum = pathAccum ? `${pathAccum}/${cleanSeg}` : cleanSeg;

          if (isLeaf && leafFolderId) {
            const leafFolder = workingFoldersById.get(leafFolderId);
            if (leafFolder) {
              leafFolder.name = cleanSeg;
              leafFolder.parentId = currentParentId;
              currentParentId = leafFolder.id;
              continue;
            }
          }

          const existingMatch = findMatchingJournalFolder({
            scope,
            ownerId,
            noteType,
            parentId: currentParentId,
            name: cleanSeg,
            allowDeleted
          });
          if (existingMatch) {
            currentParentId = existingMatch.id;
            continue;
          }

          const ownerPartition = scope === NOTE_SCOPES.PLAYER ? ownerId : "*";
          const newId = deterministicFolderId([
            campaignId,
            scope,
            ownerPartition,
            noteType,
            pathAccum
          ]);
          const created = normalizeFolderCandidate({
            id: newId,
            campaignId,
            raw: {
              domain: FOLDER_DOMAINS.JOURNAL,
              name: cleanSeg,
              parentId: currentParentId,
              ownerId,
              scope,
              noteType,
              visibleTo: baseVisibleTo,
              editableBy: baseEditableBy,
              order: 0,
              isDeleted: false
            },
            gmUid
          });
          workingFoldersById.set(newId, created);
          summary.foldersCreatedFromPaths += 1;
          currentParentId = newId;
        }

        return currentParentId;
      };

      // Passo A: divide pastas de Diário com "/" no nome em hierarquia parentId real
      for (const folder of Array.from(workingFoldersById.values())) {
        if (folder.domain === FOLDER_DOMAINS.CHARACTER) {
          folder.name = sanitizeSingleFolderName(folder.name);
          continue;
        }
        const segments = splitPathSegments(folder.name);
        if (segments.length <= 1) {
          folder.name = sanitizeSingleFolderName(segments[0] || folder.name);
          continue;
        }
        ensureJournalHierarchy({
          segments,
          initialParentId: folder.parentId || null,
          scope: folder.scope,
          ownerId: folder.ownerId,
          noteType: folder.noteType,
          leafFolderId: folder.id,
          baseVisibleTo: folder.visibleTo,
          baseEditableBy: folder.editableBy,
          allowDeleted: folder.isDeleted
        });
      }

      // Passo B: mapeia notas de Diário para folderId canônico e remove campo legado `folder`
      const pendingNoteUpdates = [];
      for (const nDoc of notesSnap.docs) {
        const raw = nDoc.data() || {};
        if (raw.isFolder === true) continue;
        summary.notesScanned += 1;

        const noteScope = resolveJournalScope(raw);
        const noteType = resolveJournalNoteType(raw);
        const noteOwnerId =
          noteScope === NOTE_SCOPES.GM
            ? gmUid || trimOrEmpty(raw.ownerId) || "system"
            : trimOrEmpty(raw.ownerId) || gmUid || "system";
        const noteProxy = {
          scope: noteScope,
          noteType,
          ownerId: noteOwnerId,
          isDeleted: Boolean(raw.isDeleted)
        };

        let targetFolderId = trimOrEmpty(raw.folderId) || null;
        if (targetFolderId) {
          const folderTarget = workingFoldersById.get(targetFolderId) || null;
          if (!isNoteFolderCompatible(noteProxy, folderTarget)) {
            targetFolderId = null;
          }
        }

        if (!targetFolderId && typeof raw.folder === "string" && raw.folder.trim()) {
          const segments = splitPathSegments(raw.folder);
          if (segments.length > 0) {
            targetFolderId = ensureJournalHierarchy({
              segments,
              initialParentId: null,
              scope: noteScope,
              ownerId: noteOwnerId,
              noteType,
              allowDeleted: Boolean(raw.isDeleted)
            });
          }
        }

        const hasLegacyNoteFolderKeys =
          Object.hasOwn(raw, "folder") ||
          Object.hasOwn(raw, "isFolder") ||
          Object.hasOwn(raw, "migratedToFoldersCollection");
        const currentFolderId = raw.folderId === undefined ? "__MISSING__" : raw.folderId;

        if (hasLegacyNoteFolderKeys || currentFolderId !== targetFolderId) {
          const noteUpdate = {
            folderId: targetFolderId
          };
          if (Object.hasOwn(raw, "folder")) noteUpdate.folder = FieldValue.delete();
          if (Object.hasOwn(raw, "isFolder")) noteUpdate.isFolder = FieldValue.delete();
          if (Object.hasOwn(raw, "migratedToFoldersCollection")) {
            noteUpdate.migratedToFoldersCollection = FieldValue.delete();
          }
          if (!raw.updatedAt) {
            noteUpdate.updatedAt = FieldValue.serverTimestamp();
          }
          pendingNoteUpdates.push({
            kind: "fs.update",
            path: nDoc.ref.path,
            data: noteUpdate
          });
        }
      }

      // Passo C: valida parentId compatível e quebra ciclos nas pastas
      for (const folder of workingFoldersById.values()) {
        if (!folder.parentId) continue;
        const parent = workingFoldersById.get(folder.parentId) || null;
        if (!isParentCompatible(folder, parent)) {
          folder.parentId = null;
        }
      }

      for (const folder of workingFoldersById.values()) {
        if (!folder.parentId) continue;
        const seen = new Set([folder.id]);
        let curr = folder;
        while (curr?.parentId) {
          if (seen.has(curr.parentId)) {
            curr.parentId = null;
            summary.folderCyclesBroken += 1;
            break;
          }
          seen.add(curr.parentId);
          curr = workingFoldersById.get(curr.parentId) || null;
        }
      }

      // Passo D: planeja set/update das pastas em campaigns/{campaignId}/folders
      for (const folder of workingFoldersById.values()) {
        const canonical = normalizeFolder(folder, {
          campaignId,
          id: folder.id,
          gmId: gmUid || undefined
        });
        const targetDoc = toFolderDoc(canonical);
        const existingRaw = existingFolderRawById.get(folder.id);

        if (!existingRaw) {
          operations.push({
            kind: "fs.set",
            path: `campaigns/${campaignId}/folders/${folder.id}`,
            data: {
              ...targetDoc,
              createdAt: targetDoc.createdAt ?? FieldValue.serverTimestamp(),
              updatedAt: targetDoc.updatedAt ?? FieldValue.serverTimestamp()
            }
          });
          summary.foldersNormalized += 1;
          continue;
        }

        const comparableTarget = {
          ...targetDoc,
          createdAt: existingRaw.createdAt ?? targetDoc.createdAt,
          updatedAt: existingRaw.updatedAt ?? targetDoc.updatedAt,
          deletedAt: existingRaw.deletedAt ?? targetDoc.deletedAt
        };
        const hasLegacyFolderKey = hasAnyKey(existingRaw, LEGACY_FOLDER_STRIP_KEYS);
        const hasCharScopeLeak =
          canonical.domain === FOLDER_DOMAINS.CHARACTER &&
          (Object.hasOwn(existingRaw, "scope") || Object.hasOwn(existingRaw, "noteType"));

        if (
          hasLegacyFolderKey ||
          hasCharScopeLeak ||
          !stableEquals(existingRaw, comparableTarget)
        ) {
          const updateData = { ...comparableTarget };
          if (!updateData.updatedAt) {
            updateData.updatedAt = FieldValue.serverTimestamp();
          }
          for (const legacyKey of LEGACY_FOLDER_STRIP_KEYS) {
            if (Object.hasOwn(existingRaw, legacyKey)) {
              updateData[legacyKey] = FieldValue.delete();
            }
          }
          if (canonical.domain === FOLDER_DOMAINS.CHARACTER) {
            if (Object.hasOwn(existingRaw, "scope")) {
              updateData.scope = FieldValue.delete();
            }
            if (Object.hasOwn(existingRaw, "noteType")) {
              updateData.noteType = FieldValue.delete();
            }
          }
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/folders/${folder.id}`,
            data: updateData
          });
          summary.foldersNormalized += 1;
        }
      }

      for (const op of pendingNoteUpdates) {
        operations.push(op);
        summary.notesUpdated += 1;
      }

      // Passo E: valida character.folderId contra folders v2
      for (const cDoc of charsSnap.docs) {
        const raw = cDoc.data() || {};
        if (raw.isFolder === true) continue;
        summary.charactersFolderChecked += 1;

        const currentFolderId = trimOrEmpty(raw.folderId) || null;
        if (!currentFolderId) {
          if (raw.folderId !== null && raw.folderId !== undefined && typeof raw.folderId === "string") {
            operations.push({
              kind: "fs.update",
              path: cDoc.ref.path,
              data: {
                folderId: null,
                updatedAt: raw.updatedAt ?? FieldValue.serverTimestamp()
              }
            });
            summary.characterFolderIdsReset += 1;
          }
          continue;
        }

        const targetFolder = workingFoldersById.get(currentFolderId) || null;
        const charProxy = {
          ownerId: trimOrEmpty(raw.ownerId) || gmUid || "system",
          isDeleted: Boolean(raw.isDeleted)
        };
        if (!isCharacterFolderCompatible(charProxy, targetFolder)) {
          operations.push({
            kind: "fs.update",
            path: cDoc.ref.path,
            data: {
              folderId: null,
              updatedAt: raw.updatedAt ?? FieldValue.serverTimestamp()
            }
          });
          summary.characterFolderIdsReset += 1;
        }
      }
    }

    return { operations, summary };
  }
};
