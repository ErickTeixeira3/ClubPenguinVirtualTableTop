import { DEFAULT_NAMES } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const LEGACY_MEMBER_KEYS = [
  "role",
  "email",
  "avatarMediaId",
  "photoURL",
  "avatarRemoved"
];

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

export function normalizeMember(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const uid = trimOrEmpty(ctx.uid ?? ctx.id ?? src.uid ?? src.id ?? "");
  const id = trimOrEmpty(src.id ?? uid);
  const campaignId = trimOrEmpty(src.campaignId ?? ctx.campaignId ?? "");

  let displayName;
  if (src.displayName === undefined || src.displayName === null) {
    displayName = DEFAULT_NAMES.member;
  } else if (typeof src.displayName === "string") {
    const trimmed = src.displayName.trim();
    displayName = trimmed.length > 0 ? trimmed : DEFAULT_NAMES.member;
  } else {
    displayName = "";
  }

  let activeCharacterId = null;
  if (src.activeCharacterId !== undefined && src.activeCharacterId !== null) {
    activeCharacterId =
      typeof src.activeCharacterId === "string"
        ? trimOrNull(src.activeCharacterId)
        : src.activeCharacterId;
  }

  return {
    id: id || uid,
    uid,
    campaignId,
    displayName,
    avatar: normalizeImageRef(src.avatar),
    activeCharacterId,
    joinedAt: src.joinedAt ?? null,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateMember(entity) {
  const errors = [];

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Member must be a non-null plain object.",
        { field: "member" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.uid)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Member uid must be a trimmed non-empty string.",
        { field: "uid" }
      )
    );
  }

  if (entity.id !== undefined && entity.id !== null && entity.id !== entity.uid) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Member id must match uid.",
        { field: "id", id: entity.id, uid: entity.uid }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Member campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.displayName)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Member displayName must be a trimmed non-empty string.",
        { field: "displayName" }
      )
    );
  }

  const avatarRes = validateImageRef(entity.avatar, { fieldName: "avatar" });
  if (!avatarRes.ok) {
    errors.push(...avatarRes.errors);
  }

  if (entity.activeCharacterId !== null) {
    if (!isTrimmedNonEmpty(entity.activeCharacterId)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Member activeCharacterId must be null or a trimmed non-empty string.",
          { field: "activeCharacterId" }
        )
      );
    } else if (entity.activeCharacterId.includes("/")) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          'Member activeCharacterId must not contain "/".',
          { field: "activeCharacterId" }
        )
      );
    }
  }

  for (const legacyKey of LEGACY_MEMBER_KEYS) {
    if (Object.hasOwn(entity, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy member field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, uid = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};
  const resolvedUid = uid ?? ctx.uid ?? src.uid ?? src.id ?? "";
  const avatar = isPlainRecord(src.avatar)
    ? fromImageRefDoc(src.avatar)
    : fromImageRefDoc(src);

  return normalizeMember(
    {
      ...src,
      avatar
    },
    { ...ctx, uid: resolvedUid }
  );
}

export function toDoc(entity) {
  const normalized = normalizeMember(entity);
  return {
    uid: normalized.uid,
    campaignId: normalized.campaignId,
    displayName: normalized.displayName,
    avatar: toImageRefDoc(normalized.avatar),
    activeCharacterId: normalized.activeCharacterId,
    joinedAt: normalized.joinedAt,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toMemberDoc, fromDoc as fromMemberDoc };
