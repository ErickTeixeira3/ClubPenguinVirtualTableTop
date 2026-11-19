import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

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

export function normalizePlatformAdmin(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  return {
    uid: trimOrEmpty(src.uid ?? ctx.uid ?? ctx.id ?? ""),
    createdAt: src.createdAt ?? null
  };
}

export function validatePlatformAdmin(admin, context = {}) {
  const errors = [];
  const ctx = isPlainRecord(context) ? context : {};

  if (!isPlainRecord(admin)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "PlatformAdmin must be a non-null plain object.",
        { field: "platformAdmin" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(admin.uid)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "PlatformAdmin uid must be a trimmed non-empty string.",
        { field: "uid" }
      )
    );
  } else if (isTrimmedNonEmpty(ctx.docId) && admin.uid !== ctx.docId) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "PlatformAdmin uid must match document ID.",
        { field: "uid", uid: admin.uid, docId: ctx.docId }
      )
    );
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};
  return normalizePlatformAdmin(
    {
      ...src,
      uid: src.uid ?? id ?? ctx.uid ?? ""
    },
    ctx
  );
}

export function toDoc(admin) {
  const normalized = normalizePlatformAdmin(admin);
  return {
    uid: normalized.uid,
    createdAt: normalized.createdAt
  };
}

export { toDoc as toPlatformAdminDoc, fromDoc as fromPlatformAdminDoc };
