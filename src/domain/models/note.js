import { assertAudience, computeAudience } from "../audience.js";
import { FOLDER_DOMAINS, NOTE_SCOPES, NOTE_TYPES } from "../constants.js";
import { DEFAULT_NAMES } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));

const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

export const LEGACY_NOTE_KEYS = Object.freeze([
  "content",
  "aliasesNormalized",
  "mentionedNoteIds",
  "folder",
  "graphNode",
  "imageMediaId",
  "linkedCharacterSheetId",
  "updatedAtMs",
  "sharedWithPlayerIds",
  "isFolder",
  "migratedToFoldersCollection",
  "visibleToPlayers"
]);

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) {
        seen.add(clean);
      }
    }
  }
  return Array.from(seen);
}

function normalizeSections(rawSections) {
  if (!rawSections) {
    return {};
  }
  const result = {};
  if (Array.isArray(rawSections)) {
    rawSections.forEach((entry, index) => {
      if (!isPlainRecord(entry)) {
        return;
      }
      const key = trimOrEmpty(entry.id) || `sec_${index + 1}`;
      if (UNSAFE_KEYS.has(key)) {
        return;
      }
      result[key] = {
        id: key,
        title: typeof entry.title === "string" ? entry.title : "",
        content: typeof entry.content === "string" ? entry.content : "",
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : index
      };
    });
    return result;
  }

  if (isPlainRecord(rawSections)) {
    let fallbackOrder = 0;
    for (const [key, entry] of Object.entries(rawSections)) {
      if (UNSAFE_KEYS.has(key) || !isPlainRecord(entry)) {
        continue;
      }
      const cleanKey = key.trim();
      if (!cleanKey || UNSAFE_KEYS.has(cleanKey)) {
        continue;
      }
      const entryId = trimOrEmpty(entry.id) || cleanKey;
      result[cleanKey] = {
        id: entryId,
        title: typeof entry.title === "string" ? entry.title : "",
        content: typeof entry.content === "string" ? entry.content : "",
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : fallbackOrder
      };
      fallbackOrder += 1;
    }
  }
  return result;
}

function normalizeGraphPosition(rawPos) {
  const src = isPlainRecord(rawPos) ? rawPos : {};
  let x = null;
  if (src.x !== undefined && src.x !== null) {
    x = typeof src.x === "number" ? src.x : Number(src.x);
  }
  let y = null;
  if (src.y !== undefined && src.y !== null) {
    y = typeof src.y === "number" ? src.y : Number(src.y);
  }
  return {
    x,
    y,
    pinned: Boolean(src.pinned)
  };
}

export function normalizeNote(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrEmpty(ctx.id ?? src.id ?? "");
  const campaignId = trimOrEmpty(src.campaignId ?? ctx.campaignId ?? "");

  const scope =
    src.scope === undefined || src.scope === null
      ? NOTE_SCOPES.PLAYER
      : trimOrEmpty(src.scope);

  const noteType =
    src.noteType === undefined || src.noteType === null
      ? NOTE_TYPES.LORE
      : trimOrEmpty(src.noteType);

  const ownerId = trimOrEmpty(src.ownerId ?? ctx.ownerId ?? "");

  let visibleTo;
  let editableBy;
  if (src.visibleTo === undefined && src.editableBy === undefined) {
    if (VALID_NOTE_SCOPES.has(scope)) {
      const computed = computeAudience({
        ownerId,
        scope,
        gmId: ctx.gmId
      });
      visibleTo = computed.visibleTo;
      editableBy = computed.editableBy;
    } else {
      visibleTo = ownerId ? [ownerId] : [];
      editableBy = ownerId ? [ownerId] : [];
    }
  } else {
    visibleTo = cleanStringList(src.visibleTo);
    editableBy = cleanStringList(src.editableBy);
  }

  let folderId = null;
  if (src.folderId !== undefined && src.folderId !== null) {
    folderId =
      typeof src.folderId === "string"
        ? trimOrNull(src.folderId)
        : src.folderId;
  }

  let title;
  if (src.title === undefined || src.title === null) {
    title = DEFAULT_NAMES.note;
  } else {
    title = typeof src.title === "string" ? src.title.trim() : "";
  }

  let linkedCharacterId = null;
  if (src.linkedCharacterId !== undefined && src.linkedCharacterId !== null) {
    linkedCharacterId =
      typeof src.linkedCharacterId === "string"
        ? trimOrNull(src.linkedCharacterId)
        : src.linkedCharacterId;
  }

  let clonedFromNoteId = null;
  if (src.clonedFromNoteId !== undefined && src.clonedFromNoteId !== null) {
    clonedFromNoteId =
      typeof src.clonedFromNoteId === "string"
        ? trimOrNull(src.clonedFromNoteId)
        : src.clonedFromNoteId;
  }

  let rev = 0;
  if (src.rev !== undefined && src.rev !== null) {
    rev = typeof src.rev === "number" ? src.rev : Number(src.rev);
  }

  const deletedBy =
    src.deletedBy !== undefined && src.deletedBy !== null
      ? typeof src.deletedBy === "string"
        ? trimOrNull(src.deletedBy)
        : src.deletedBy
      : null;

  return {
    id,
    campaignId,
    scope,
    ownerId,
    visibleTo,
    editableBy,
    noteType,
    folderId,
    title,
    aliases: cleanStringList(src.aliases),
    ignoredAliases: cleanStringList(src.ignoredAliases),
    sections: normalizeSections(src.sections),
    relatedNoteIds: cleanStringList(src.relatedNoteIds),
    linkedCharacterId,
    image: normalizeImageRef(src.image),
    graphPosition: normalizeGraphPosition(src.graphPosition),
    clonedFromNoteId,
    rev,
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateNote(entity, context = {}) {
  const errors = [];
  const ctx = isPlainRecord(context) ? context : {};

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Note must be a non-null plain object.",
        { field: "note" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Note id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Note campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!VALID_NOTE_SCOPES.has(entity.scope)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Note scope "${String(entity.scope)}" is invalid.`,
        { field: "scope", value: entity.scope }
      )
    );
  }

  if (!VALID_NOTE_TYPES.has(entity.noteType)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Note noteType "${String(entity.noteType)}" is invalid.`,
        { field: "noteType", value: entity.noteType }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.title)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Note title must be a trimmed non-empty string.",
        { field: "title" }
      )
    );
  }

  const audienceRes = assertAudience(entity, { entityType: "note" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  for (const refField of ["folderId", "linkedCharacterId", "clonedFromNoteId"]) {
    const val = entity[refField];
    if (val !== null) {
      if (!isTrimmedNonEmpty(val)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Note ${refField} must be null or a trimmed non-empty string.`,
            { field: refField }
          )
        );
      } else if (val.includes("/")) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Note ${refField} must not contain "/".`,
            { field: refField }
          )
        );
      }
    }
  }

  if (
    isTrimmedNonEmpty(entity.id) &&
    entity.clonedFromNoteId === entity.id
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Note clonedFromNoteId cannot reference itself.",
        { field: "clonedFromNoteId", id: entity.id }
      )
    );
  }

  for (const arrField of ["aliases", "ignoredAliases", "relatedNoteIds"]) {
    const arr = entity[arrField];
    if (!Array.isArray(arr)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `Note ${arrField} must be an array.`,
          { field: arrField }
        )
      );
    } else {
      for (let i = 0; i < arr.length; i += 1) {
        if (!isTrimmedNonEmpty(arr[i])) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              `Note ${arrField}[${i}] must be a trimmed non-empty string.`,
              { field: arrField, index: i }
            )
          );
        }
      }
    }
  }

  if (
    Array.isArray(entity.relatedNoteIds) &&
    isTrimmedNonEmpty(entity.id) &&
    entity.relatedNoteIds.includes(entity.id)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Note relatedNoteIds cannot contain its own id.",
        { field: "relatedNoteIds", id: entity.id }
      )
    );
  }

  if (!isPlainRecord(entity.sections)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Note sections must be a plain object map.",
        { field: "sections" }
      )
    );
  } else {
    for (const key of Object.keys(entity.sections)) {
      if (UNSAFE_KEYS.has(key) || !isTrimmedNonEmpty(key)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "Note sections contains an invalid key.",
            { field: "sections", key }
          )
        );
        continue;
      }
      const sec = entity.sections[key];
      if (!isPlainRecord(sec)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Note section "${key}" must be a plain object.`,
            { field: `sections.${key}` }
          )
        );
        continue;
      }
      if (!isTrimmedNonEmpty(sec.id) || sec.id !== key) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Note section "${key}" must have id matching its map key.`,
            { field: `sections.${key}.id` }
          )
        );
      }
      if (typeof sec.title !== "string") {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Note section "${key}" title must be a string.`,
            { field: `sections.${key}.title` }
          )
        );
      }
      if (typeof sec.content !== "string") {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Note section "${key}" content must be a string.`,
            { field: `sections.${key}.content` }
          )
        );
      }
      if (typeof sec.order !== "number" || !Number.isFinite(sec.order)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Note section "${key}" order must be a finite number.`,
            { field: `sections.${key}.order` }
          )
        );
      }
    }
  }

  const imgRes = validateImageRef(entity.image, { fieldName: "image" });
  if (!imgRes.ok) {
    errors.push(...imgRes.errors);
  }

  if (!isPlainRecord(entity.graphPosition)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Note graphPosition must be a plain object.",
        { field: "graphPosition" }
      )
    );
  } else {
    const { x, y, pinned } = entity.graphPosition;
    if (x !== null && (typeof x !== "number" || !Number.isFinite(x))) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Note graphPosition.x must be null or a finite number.",
          { field: "graphPosition.x" }
        )
      );
    }
    if (y !== null && (typeof y !== "number" || !Number.isFinite(y))) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Note graphPosition.y must be null or a finite number.",
          { field: "graphPosition.y" }
        )
      );
    }
    if (typeof pinned !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Note graphPosition.pinned must be a boolean.",
          { field: "graphPosition.pinned" }
        )
      );
    }
  }

  if (typeof entity.rev !== "number" || !Number.isInteger(entity.rev) || entity.rev < 0) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Note rev must be a non-negative integer.",
        { field: "rev", value: entity.rev }
      )
    );
  }

  if (typeof entity.isDeleted !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Note isDeleted must be a boolean.",
        { field: "isDeleted" }
      )
    );
  }

  if (isPlainRecord(ctx.folder)) {
    const folder = ctx.folder;
    if (
      folder.domain !== FOLDER_DOMAINS.JOURNAL ||
      folder.scope !== entity.scope ||
      folder.noteType !== entity.noteType ||
      (entity.scope === NOTE_SCOPES.PLAYER && folder.ownerId !== entity.ownerId)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Note is not compatible with the target journal folder.",
          { field: "folderId", folderId: entity.folderId }
        )
      );
    }
  }

  for (const legacyKey of LEGACY_NOTE_KEYS) {
    if (Object.hasOwn(entity, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy note field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};

  const resolvedId = id ?? ctx.id ?? src.id ?? "";

  return normalizeNote(
    {
      ...src,
      folderId: src.folderId ?? ctx.folderId ?? null,
      image: fromImageRefDoc(src.image)
    },
    { ...ctx, id: resolvedId }
  );
}

export function toDoc(entity) {
  const normalized = normalizeNote(entity);
  return {
    campaignId: normalized.campaignId,
    scope: normalized.scope,
    ownerId: normalized.ownerId,
    visibleTo: normalized.visibleTo,
    editableBy: normalized.editableBy,
    noteType: normalized.noteType,
    folderId: normalized.folderId,
    title: normalized.title,
    aliases: normalized.aliases,
    ignoredAliases: normalized.ignoredAliases,
    sections: normalized.sections,
    relatedNoteIds: normalized.relatedNoteIds,
    linkedCharacterId: normalized.linkedCharacterId,
    image: toImageRefDoc(normalized.image),
    graphPosition: normalized.graphPosition,
    clonedFromNoteId: normalized.clonedFromNoteId,
    rev: normalized.rev,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toNoteDoc, fromDoc as fromNoteDoc };
