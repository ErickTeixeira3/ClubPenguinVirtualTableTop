import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const EMAIL_PATTERN = /^[^\s@/#$[\]]+@[^\s@/#$[\]]+\.[^\s@/#$[\]]+$/;
const RTDB_FORBIDDEN_KEY_CHARS = /[/#$[\]]/;

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

export function normalizeInviteEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function toInviteEmailKey(email) {
  const clean = normalizeInviteEmail(email);
  if (
    !clean ||
    /\s/.test(clean) ||
    RTDB_FORBIDDEN_KEY_CHARS.test(clean) ||
    !EMAIL_PATTERN.test(clean)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Invite email must be a valid email address without RTDB forbidden characters.",
      { field: "email", value: email ?? null }
    );
  }
  return clean.replaceAll(".", ",");
}

export function normalizeInvite(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const email = normalizeInviteEmail(
    src.email ?? ctx.emailLower ?? ctx.id ?? src.id ?? ""
  );
  const id = normalizeInviteEmail(src.id ?? email);
  const campaignId = trimOrEmpty(src.campaignId ?? ctx.campaignId ?? "");

  let defaultDisplayName = trimOrEmpty(src.defaultDisplayName);
  if (!defaultDisplayName && email.includes("@")) {
    defaultDisplayName = email.split("@")[0];
  }

  let acceptedBy = null;
  if (src.acceptedBy !== undefined && src.acceptedBy !== null) {
    acceptedBy =
      typeof src.acceptedBy === "string"
        ? trimOrNull(src.acceptedBy)
        : src.acceptedBy;
  }

  return {
    id: id || email,
    email,
    campaignId,
    defaultDisplayName,
    acceptedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateInvite(entity) {
  const errors = [];

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Invite must be a non-null plain object.",
        { field: "invite" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.email)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Invite email must be a trimmed non-empty string.",
        { field: "email" }
      )
    );
  } else if (
    entity.email !== entity.email.trim().toLowerCase() ||
    !EMAIL_PATTERN.test(entity.email)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Invite email must be a normalized lowercase email address.",
        { field: "email", value: entity.email }
      )
    );
  }

  if (entity.id !== undefined && entity.id !== null) {
    if (
      !isTrimmedNonEmpty(entity.id) ||
      (isTrimmedNonEmpty(entity.email) && entity.id !== entity.email)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          "Invite id must match normalized email.",
          { field: "id", id: entity.id, email: entity.email }
        )
      );
    }
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Invite campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.defaultDisplayName)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Invite defaultDisplayName must be a trimmed non-empty string.",
        { field: "defaultDisplayName" }
      )
    );
  }

  if (entity.acceptedBy !== null && !isTrimmedNonEmpty(entity.acceptedBy)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Invite acceptedBy must be null or a trimmed non-empty string.",
        { field: "acceptedBy" }
      )
    );
  }

  if (Object.hasOwn(entity, "role")) {
    errors.push(
      new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Legacy invite field "role" is not allowed in v2.',
        { field: "role" }
      )
    );
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, emailLower = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};
  return normalizeInvite(src, {
    ...ctx,
    emailLower: emailLower ?? ctx.emailLower ?? src.email ?? src.id ?? ""
  });
}

export function toDoc(entity) {
  const normalized = normalizeInvite(entity);
  return {
    email: normalized.email,
    campaignId: normalized.campaignId,
    defaultDisplayName: normalized.defaultDisplayName,
    acceptedBy: normalized.acceptedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toInviteDoc, fromDoc as fromInviteDoc };
