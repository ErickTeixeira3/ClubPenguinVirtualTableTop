import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { computeAudience } from "../../src/domain/audience.js";
import {
  FOLDER_DOMAINS,
  NOTE_SCOPES,
  NOTE_TYPES
} from "../../src/domain/constants.js";
import { DEFAULT_NAMES } from "../../src/domain/defaults.js";
import { fromDoc as fromImageRefDoc } from "../../src/domain/models/imageRef.js";
import {
  LEGACY_NOTE_KEYS,
  normalizeNote,
  toNoteDoc
} from "../../src/domain/models/note.js";

const LEGACY_NOTE_STRIP_KEYS = ["id", ...LEGACY_NOTE_KEYS];
const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
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
  const keysA = Object.keys(a)
    .filter((k) => a[k] !== undefined)
    .sort();
  const keysB = Object.keys(b)
    .filter((k) => b[k] !== undefined)
    .sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, idx) => k === keysB[idx] && stableEquals(a[k], b[k]));
}

export function parseContentToSections(content) {
  if (typeof content !== "string" || !content.trim()) {
    return {};
  }
  const lines = content.split("\n");
  const blocks = [];
  let current = { title: "", lines: [] };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current.title || current.lines.join("\n").trim()) {
        blocks.push(current);
      }
      current = { title: match[1].trim() || "Seção", lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.join("\n").trim()) {
    blocks.push(current);
  }

  const sections = {};
  blocks.forEach((blk, idx) => {
    const key = `sec_${idx + 1}`;
    sections[key] = {
      id: key,
      title: blk.title || "Notas",
      content: blk.lines.join("\n").trim(),
      order: idx
    };
  });
  return sections;
}

function resolveNoteScope(raw) {
  if (VALID_NOTE_SCOPES.has(raw.scope)) return raw.scope;
  if (raw.scope === "ALL" || raw.visibleToPlayers === true) {
    return NOTE_SCOPES.PARTY;
  }
  const vis = Array.isArray(raw.visibleTo) ? raw.visibleTo : [];
  if (vis.includes("ALL")) return NOTE_SCOPES.PARTY;
  return NOTE_SCOPES.PLAYER;
}

function resolveNoteType(raw) {
  if (VALID_NOTE_TYPES.has(raw.noteType)) return raw.noteType;
  return NOTE_TYPES.LORE;
}

function isCompatibleJournalFolder(folder, { scope, noteType, ownerId, isDeleted }) {
  if (!folder) return false;
  if (folder.domain !== FOLDER_DOMAINS.JOURNAL) return false;
  if (folder.scope !== scope) return false;
  if (folder.noteType !== noteType) return false;
  if (scope === NOTE_SCOPES.PLAYER && (folder.ownerId || null) !== (ownerId || null)) {
    return false;
  }
  if (!isDeleted && folder.isDeleted === true) return false;
  return true;
}

function hasNonEmptySections(sections) {
  return Object.values(sections || {}).some(
    (sec) =>
      sec &&
      ((typeof sec.title === "string" && sec.title.trim().length > 0) ||
        (typeof sec.content === "string" && sec.content.trim().length > 0))
  );
}

function normalizeImageCandidate(raw) {
  const fromModern = fromImageRefDoc(raw.image);
  if (fromModern.mediaId || fromModern.url) {
    return fromModern;
  }
  const legacyMediaId = trimOrNull(raw.imageMediaId);
  if (legacyMediaId) {
    return { mediaId: legacyMediaId, url: null };
  }
  return fromModern;
}

function normalizeGraphPositionCandidate(raw) {
  const source =
    raw.graphPosition && typeof raw.graphPosition === "object"
      ? raw.graphPosition
      : raw.graphNode && typeof raw.graphNode === "object"
        ? raw.graphNode
        : {};
  const x =
    typeof source.x === "number" && Number.isFinite(source.x)
      ? source.x
      : typeof source.x === "string" && source.x.trim() && Number.isFinite(Number(source.x))
        ? Number(source.x)
        : null;
  const y =
    typeof source.y === "number" && Number.isFinite(source.y)
      ? source.y
      : typeof source.y === "string" && source.y.trim() && Number.isFinite(Number(source.y))
        ? Number(source.y)
        : null;
  return {
    x,
    y,
    pinned: Boolean(source.pinned)
  };
}

export default {
  id: "M006-notes-v2",
  description:
    "Converte notas legadas para schema v2 (sections, graphPosition, image, linkedCharacterId, audiência) e remove campos derivados/legados.",

  async plan({ firestore }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      notesScanned: 0,
      notesUpdated: 0,
      sectionsParsedFromContent: 0,
      legacyFieldsRemoved: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();

    for (const campDoc of campaignsSnap.docs) {
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};
      const gmUid = trimOrEmpty(campData.gmId) || null;
      summary.campaignsProcessed += 1;

      const [notesSnap, foldersSnap] = await Promise.all([
        firestore.collection(`campaigns/${campaignId}/notes`).get(),
        firestore.collection(`campaigns/${campaignId}/folders`).get()
      ]);

      const foldersById = new Map();
      for (const fDoc of foldersSnap.docs) {
        foldersById.set(fDoc.id, { id: fDoc.id, ...(fDoc.data() || {}) });
      }

      for (const nDoc of notesSnap.docs) {
        const raw = nDoc.data() || {};
        if (raw.isFolder === true) continue;
        summary.notesScanned += 1;

        const noteId = nDoc.id;
        const scope = resolveNoteScope(raw);
        const noteType = resolveNoteType(raw);
        let ownerId = trimOrEmpty(raw.ownerId) || gmUid || "system";
        if (scope === NOTE_SCOPES.GM && gmUid) {
          ownerId = gmUid;
        }

        const sharedPlayers = Array.isArray(raw.sharedWithPlayerIds)
          ? raw.sharedWithPlayerIds
          : [];
        const rawVisible = Array.isArray(raw.visibleTo) ? raw.visibleTo : [];
        const rawEditable = Array.isArray(raw.editableBy) ? raw.editableBy : [];

        const audience = computeAudience({
          ownerId,
          scope,
          gmId: gmUid || undefined,
          visibleTo:
            scope === NOTE_SCOPES.PLAYER
              ? [...rawVisible, ...sharedPlayers]
              : [...rawVisible, ...sharedPlayers],
          editableBy: rawEditable
        });

        const baseNormalized = normalizeNote(
          {
            ...raw,
            campaignId,
            scope,
            noteType,
            ownerId
          },
          { id: noteId, campaignId, gmId: gmUid || undefined }
        );

        let sections = baseNormalized.sections;
        if (
          !hasNonEmptySections(sections) &&
          typeof raw.content === "string" &&
          raw.content.trim().length > 0
        ) {
          sections = parseContentToSections(raw.content);
          summary.sectionsParsedFromContent += 1;
        }

        const isDeleted = Boolean(raw.isDeleted);
        const rawFolderId = trimOrNull(raw.folderId);
        const targetFolder = rawFolderId ? foldersById.get(rawFolderId) || null : null;
        const folderId = isCompatibleJournalFolder(targetFolder, {
          scope,
          noteType,
          ownerId,
          isDeleted
        })
          ? rawFolderId
          : null;

        const linkedCharacterId = trimOrNull(
          raw.linkedCharacterId ?? raw.linkedCharacterSheetId
        );

        const rawCloneSource = trimOrNull(raw.clonedFromNoteId);
        const clonedFromNoteId =
          rawCloneSource && rawCloneSource !== noteId && !rawCloneSource.includes("/")
            ? rawCloneSource
            : null;

        const relatedNoteIds = baseNormalized.relatedNoteIds.filter(
          (id) => id && id !== noteId
        );

        const title = trimOrEmpty(raw.title) || DEFAULT_NAMES.note;

        const rawRev = typeof raw.rev === "number" ? raw.rev : Number(raw.rev);
        const rev =
          Number.isFinite(rawRev) && rawRev >= 0 ? Math.floor(rawRev) : 0;

        const fallbackTs =
          typeof raw.updatedAtMs === "number" && Number.isFinite(raw.updatedAtMs)
            ? Timestamp.fromMillis(raw.updatedAtMs)
            : null;
        const createdAt = raw.createdAt ?? fallbackTs ?? null;
        const updatedAt = raw.updatedAt ?? fallbackTs ?? null;
        const deletedAt = isDeleted ? raw.deletedAt ?? null : null;
        const deletedBy = isDeleted
          ? trimOrNull(raw.deletedBy) || gmUid || ownerId
          : null;

        const canonical = normalizeNote(
          {
            id: noteId,
            campaignId,
            scope,
            ownerId,
            visibleTo: audience.visibleTo,
            editableBy: audience.editableBy,
            noteType,
            folderId: folderId && !folderId.includes("/") ? folderId : null,
            title,
            aliases: baseNormalized.aliases,
            ignoredAliases: baseNormalized.ignoredAliases,
            sections,
            relatedNoteIds,
            linkedCharacterId:
              linkedCharacterId && !linkedCharacterId.includes("/")
                ? linkedCharacterId
                : null,
            image: normalizeImageCandidate(raw),
            graphPosition: normalizeGraphPositionCandidate(raw),
            clonedFromNoteId,
            rev,
            isDeleted,
            deletedAt,
            deletedBy,
            createdAt,
            updatedAt
          },
          { id: noteId, campaignId, gmId: gmUid || undefined }
        );

        const targetDoc = toNoteDoc(canonical);
        const comparableTarget = {
          ...targetDoc,
          createdAt: raw.createdAt ?? targetDoc.createdAt,
          updatedAt: raw.updatedAt ?? targetDoc.updatedAt,
          deletedAt: raw.deletedAt ?? targetDoc.deletedAt
        };

        const presentLegacyKeys = LEGACY_NOTE_STRIP_KEYS.filter((key) =>
          Object.hasOwn(raw, key)
        );
        const needsUpdate =
          presentLegacyKeys.length > 0 || !stableEquals(raw, comparableTarget);

        if (needsUpdate) {
          const updateData = { ...comparableTarget };
          if (!updateData.createdAt) {
            updateData.createdAt = FieldValue.serverTimestamp();
          }
          if (!updateData.updatedAt) {
            updateData.updatedAt = FieldValue.serverTimestamp();
          }
          if (isDeleted && !updateData.deletedAt) {
            updateData.deletedAt = FieldValue.serverTimestamp();
          }
          for (const legacyKey of presentLegacyKeys) {
            updateData[legacyKey] = FieldValue.delete();
          }
          operations.push({
            kind: "fs.update",
            path: nDoc.ref.path,
            data: updateData
          });
          summary.notesUpdated += 1;
          if (presentLegacyKeys.length > 0) {
            summary.legacyFieldsRemoved += 1;
          }
        }
      }
    }

    return { operations, summary };
  }
};
