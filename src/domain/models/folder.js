import { assertAudience, computeAudience } from "../audience.js";
import { FOLDER_DOMAINS, NOTE_SCOPES, NOTE_TYPES } from "../constants.js";
import { DEFAULT_NAMES } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_FOLDER_DOMAINS = new Set(Object.values(FOLDER_DOMAINS));
const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));

export const LEGACY_FOLDER_KEYS = Object.freeze([
  "isFolder",
  "folderType",
  "migratedToFoldersCollection",
  "title",
  "updatedAtMs",
  "path",
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

export function normalizeFolder(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrEmpty(ctx.id ?? src.id ?? "");
  const campaignId = trimOrEmpty(src.campaignId ?? ctx.campaignId ?? "");

  let domain;
  if (src.domain === undefined || src.domain === null) {
    domain = FOLDER_DOMAINS.CHARACTER;
  } else {
    domain = trimOrEmpty(src.domain);
  }

  let name;
  if (src.name === undefined || src.name === null) {
    name = DEFAULT_NAMES.folder;
  } else {
    name = typeof src.name === "string" ? src.name.trim() : "";
  }

  let parentId = null;
  if (src.parentId !== undefined && src.parentId !== null) {
    parentId =
      typeof src.parentId === "string"
        ? trimOrNull(src.parentId)
        : src.parentId;
  }

  const ownerId = trimOrEmpty(src.ownerId ?? ctx.ownerId ?? "");

  let scope = null;
  let noteType = null;
  if (domain === FOLDER_DOMAINS.JOURNAL) {
    scope =
      src.scope === undefined || src.scope === null
        ? NOTE_SCOPES.PLAYER
        : trimOrEmpty(src.scope);
    noteType =
      src.noteType === undefined || src.noteType === null
        ? NOTE_TYPES.LORE
        : trimOrEmpty(src.noteType);
  } else if (src.scope !== undefined && src.scope !== null) {
    scope = src.scope;
  }
  if (domain !== FOLDER_DOMAINS.JOURNAL && src.noteType !== undefined && src.noteType !== null) {
    noteType = src.noteType;
  }

  let visibleTo;
  let editableBy;
  if (src.visibleTo === undefined && src.editableBy === undefined) {
    if (
      domain === FOLDER_DOMAINS.JOURNAL &&
      !VALID_NOTE_SCOPES.has(scope)
    ) {
      visibleTo = ownerId ? [ownerId] : [];
      editableBy = ownerId ? [ownerId] : [];
    } else {
      const computed = computeAudience({
        ownerId,
        scope: domain === FOLDER_DOMAINS.JOURNAL ? scope : undefined,
        gmId: ctx.gmId
      });
      visibleTo = computed.visibleTo;
      editableBy = computed.editableBy;
    }
  } else {
    visibleTo = cleanStringList(src.visibleTo);
    editableBy = cleanStringList(src.editableBy);
  }

  let order = 0;
  if (src.order !== undefined && src.order !== null) {
    order = typeof src.order === "number" ? src.order : Number(src.order);
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
    domain,
    name,
    parentId,
    ownerId,
    scope,
    noteType,
    visibleTo,
    editableBy,
    order,
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateFolder(entity, context = {}) {
  const errors = [];
  const ctx = isPlainRecord(context) ? context : {};

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Folder must be a non-null plain object.",
        { field: "folder" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Folder id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Folder campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!VALID_FOLDER_DOMAINS.has(entity.domain)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Folder domain "${String(entity.domain)}" is invalid.`,
        { field: "domain", value: entity.domain }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.name)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Folder name must be a trimmed non-empty string.",
        { field: "name" }
      )
    );
  } else if (entity.name.includes("/")) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_FOLDER_NAME,
        'Folder name must not contain "/".',
        { field: "name", value: entity.name }
      )
    );
  }

  if (entity.parentId !== null) {
    if (!isTrimmedNonEmpty(entity.parentId)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Folder parentId must be null or a trimmed non-empty string.",
          { field: "parentId" }
        )
      );
    } else if (entity.parentId.includes("/")) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          'Folder parentId must not contain "/".',
          { field: "parentId" }
        )
      );
    } else if (isTrimmedNonEmpty(entity.id) && entity.parentId === entity.id) {
      errors.push(
        new AppError(
          ERROR_CODES.CYCLE_DETECTED,
          "Folder cannot be its own parent.",
          { field: "parentId", id: entity.id }
        )
      );
    }
  }

  if (entity.domain === FOLDER_DOMAINS.JOURNAL) {
    if (!VALID_NOTE_SCOPES.has(entity.scope)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `Journal folder scope "${String(entity.scope)}" is invalid.`,
          { field: "scope", value: entity.scope }
        )
      );
    }
    if (!VALID_NOTE_TYPES.has(entity.noteType)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `Journal folder noteType "${String(entity.noteType)}" is invalid.`,
          { field: "noteType", value: entity.noteType }
        )
      );
    }
  } else if (entity.domain === FOLDER_DOMAINS.CHARACTER) {
    if (entity.scope !== null && entity.scope !== undefined) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "Character folder must not define scope.",
          { field: "scope", value: entity.scope }
        )
      );
    }
    if (entity.noteType !== null && entity.noteType !== undefined) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "Character folder must not define noteType.",
          { field: "noteType", value: entity.noteType }
        )
      );
    }
  }

  const audienceRes = assertAudience(entity, { entityType: "folder" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  if (typeof entity.order !== "number" || !Number.isFinite(entity.order)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Folder order must be a finite number.",
        { field: "order", value: entity.order }
      )
    );
  }

  if (typeof entity.isDeleted !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Folder isDeleted must be a boolean.",
        { field: "isDeleted" }
      )
    );
  }

  const parentFolder = isPlainRecord(ctx.parentFolder)
    ? ctx.parentFolder
    : isPlainRecord(ctx.foldersById) &&
        entity.parentId &&
        Object.hasOwn(ctx.foldersById, entity.parentId)
      ? ctx.foldersById[entity.parentId]
      : null;

  if (parentFolder) {
    if (parentFolder.domain !== entity.domain) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Folder and parent folder must belong to the same domain.",
          { field: "parentId", domain: entity.domain, parentDomain: parentFolder.domain }
        )
      );
    } else if (entity.domain === FOLDER_DOMAINS.CHARACTER) {
      if (parentFolder.ownerId !== entity.ownerId) {
        errors.push(
          new AppError(
            ERROR_CODES.INCOMPATIBLE_FOLDER,
            "Character folders in the same hierarchy must share the same ownerId.",
            { field: "parentId" }
          )
        );
      }
    } else if (entity.domain === FOLDER_DOMAINS.JOURNAL) {
      if (
        parentFolder.scope !== entity.scope ||
        parentFolder.noteType !== entity.noteType
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INCOMPATIBLE_FOLDER,
            "Journal folders in the same hierarchy must share scope and noteType.",
            { field: "parentId" }
          )
        );
      } else if (
        entity.scope === NOTE_SCOPES.PLAYER &&
        parentFolder.ownerId !== entity.ownerId
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INCOMPATIBLE_FOLDER,
            "Player-scoped journal folders in the same hierarchy must share ownerId.",
            { field: "parentId" }
          )
        );
      }
    }
  }

  if (isPlainRecord(ctx.foldersById) && isTrimmedNonEmpty(entity.id)) {
    const visited = new Set([entity.id]);
    let cursor = entity.parentId;
    while (typeof cursor === "string" && cursor.length > 0) {
      if (visited.has(cursor)) {
        errors.push(
          new AppError(
            ERROR_CODES.CYCLE_DETECTED,
            "Folder hierarchy contains a cycle.",
            { field: "parentId", cycleId: cursor }
          )
        );
        break;
      }
      visited.add(cursor);
      const node = Object.hasOwn(ctx.foldersById, cursor)
        ? ctx.foldersById[cursor]
        : null;
      cursor = node && typeof node.parentId === "string" ? node.parentId : null;
    }
  }

  for (const legacyKey of LEGACY_FOLDER_KEYS) {
    if (Object.hasOwn(entity, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy folder field "${legacyKey}" is not allowed in v2.`,
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

  const domain =
    src.domain ??
    src.folderType ??
    (src.noteType ? FOLDER_DOMAINS.JOURNAL : FOLDER_DOMAINS.CHARACTER);

  const name = src.name ?? src.title;
  const resolvedId = id ?? ctx.id ?? src.id ?? "";

  const normalizedInput = {
    ...src,
    domain,
    name,
    scope: domain === FOLDER_DOMAINS.CHARACTER ? null : src.scope,
    noteType: domain === FOLDER_DOMAINS.CHARACTER ? null : src.noteType,
    createdAt: src.createdAt ?? src.updatedAtMs ?? null,
    updatedAt: src.updatedAt ?? src.updatedAtMs ?? null
  };

  return normalizeFolder(normalizedInput, { ...ctx, id: resolvedId });
}

export function toDoc(entity) {
  const normalized = normalizeFolder(entity);
  const payload = {
    campaignId: normalized.campaignId,
    domain: normalized.domain,
    name: normalized.name,
    parentId: normalized.parentId,
    ownerId: normalized.ownerId,
    visibleTo: normalized.visibleTo,
    editableBy: normalized.editableBy,
    order: normalized.order,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };

  if (normalized.domain === FOLDER_DOMAINS.JOURNAL) {
    payload.scope = normalized.scope;
    payload.noteType = normalized.noteType;
  }

  return payload;
}

export { toDoc as toFolderDoc, fromDoc as fromFolderDoc };
