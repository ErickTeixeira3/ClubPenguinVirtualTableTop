import { assertAudience } from "../audience.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const LEGACY_MEDIA_KEYS = [
  "isDeleted",
  "deletedAt",
  "deletedBy",
  "updatedAt",
  "chunks",
  "sizeBytes"
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

function resolveNumber(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
  }
  return Number.NaN;
}

export function normalizeMedia(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const campaignId = trimOrNull(src.campaignId ?? ctx.campaignId);
  const category = trimOrEmpty(src.category);
  const mimeType =
    src.mimeType === undefined || src.mimeType === null
      ? "image/webp"
      : trimOrEmpty(src.mimeType);
  const dataUrl = typeof src.dataUrl === "string" ? src.dataUrl : "";
  const uploadedBy = trimOrEmpty(src.uploadedBy ?? ctx.uploadedBy ?? "");

  let visibleTo;
  if (src.visibleTo === undefined || src.visibleTo === null) {
    visibleTo = uploadedBy ? [uploadedBy] : [];
  } else {
    visibleTo = cleanStringList(src.visibleTo);
  }

  return {
    id,
    campaignId,
    category,
    mimeType,
    widthPx: resolveNumber(src.widthPx, 0),
    heightPx: resolveNumber(src.heightPx, 0),
    byteLength: resolveNumber(src.byteLength, 0),
    dataUrl,
    uploadedBy,
    visibleTo,
    createdAt: src.createdAt ?? null
  };
}

export function validateMedia(media) {
  const errors = [];

  if (!isPlainRecord(media)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Media must be a non-null plain object.",
        { field: "media" }
      )
    ]);
  }

  for (const reqField of ["campaignId", "category", "mimeType"]) {
    if (!isTrimmedNonEmpty(media[reqField])) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `Media ${reqField} must be a trimmed non-empty string.`,
          { field: reqField }
        )
      );
    }
  }

  for (const dimField of ["widthPx", "heightPx"]) {
    if (
      typeof media[dimField] !== "number" ||
      !Number.isFinite(media[dimField]) ||
      media[dimField] <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `Media ${dimField} must be a finite number > 0.`,
          { field: dimField, value: media[dimField] }
        )
      );
    }
  }

  if (
    typeof media.byteLength !== "number" ||
    !Number.isInteger(media.byteLength) ||
    media.byteLength <= 0
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Media byteLength must be a positive integer.",
        { field: "byteLength", value: media.byteLength }
      )
    );
  }

  if (
    typeof media.dataUrl !== "string" ||
    media.dataUrl.length === 0 ||
    !/^data:/i.test(media.dataUrl)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Media dataUrl must be a non-empty data: URL.",
        { field: "dataUrl" }
      )
    );
  }

  if (!isTrimmedNonEmpty(media.uploadedBy)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_AUDIENCE,
        "Media uploadedBy must be a trimmed non-empty string.",
        { field: "uploadedBy" }
      )
    );
  }

  const audienceRes = assertAudience(media, { entityType: "media" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  for (const legacyKey of LEGACY_MEDIA_KEYS) {
    if (Object.hasOwn(media, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy media field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function expandMediaVisibleTo(currentVisibleTo, additions) {
  return cleanStringList([
    ...(Array.isArray(currentVisibleTo) ? currentVisibleTo : []),
    ...(Array.isArray(additions) ? additions : [])
  ]);
}

export function validateMediaAudienceExpansion(previousVisibleTo, nextVisibleTo) {
  const errors = [];
  if (!Array.isArray(previousVisibleTo)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_AUDIENCE,
        "previousVisibleTo must be an array.",
        { field: "previousVisibleTo" }
      )
    );
    return validationFail(errors);
  }
  if (!Array.isArray(nextVisibleTo) || nextVisibleTo.length === 0) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_AUDIENCE,
        "nextVisibleTo must be a non-empty array.",
        { field: "visibleTo" }
      )
    );
    return validationFail(errors);
  }

  for (let i = 0; i < nextVisibleTo.length; i += 1) {
    if (!isTrimmedNonEmpty(nextVisibleTo[i])) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_AUDIENCE,
          `visibleTo[${i}] must be a trimmed non-empty string.`,
          { field: "visibleTo", index: i }
        )
      );
    }
  }

  const nextSet = new Set(nextVisibleTo);
  for (const prev of previousVisibleTo) {
    if (!nextSet.has(prev)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_AUDIENCE,
          `Media visibleTo cannot remove existing audience entry "${String(prev)}".`,
          { field: "visibleTo", removed: prev }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function hasRequiredMediaAudience(media, requiredVisibleTo) {
  if (!isPlainRecord(media) || !Array.isArray(media.visibleTo)) {
    return false;
  }
  if (media.visibleTo.includes("ALL")) {
    return true;
  }
  if (!Array.isArray(requiredVisibleTo) || requiredVisibleTo.length === 0) {
    return media.visibleTo.length > 0;
  }
  const mediaSet = new Set(media.visibleTo);
  return requiredVisibleTo.every((entry) => mediaSet.has(entry));
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};

  const byteLength =
    src.byteLength ??
    src.sizeBytes ??
    (typeof src.dataUrl === "string" ? src.dataUrl.length : 0);

  return normalizeMedia(
    {
      ...src,
      byteLength
    },
    { ...ctx, id: id ?? ctx.id ?? src.id ?? null }
  );
}

export function toDoc(media) {
  const normalized = normalizeMedia(media);
  return {
    campaignId: normalized.campaignId,
    category: normalized.category,
    mimeType: normalized.mimeType,
    widthPx: normalized.widthPx,
    heightPx: normalized.heightPx,
    byteLength: normalized.byteLength,
    dataUrl: normalized.dataUrl,
    uploadedBy: normalized.uploadedBy,
    visibleTo: normalized.visibleTo,
    createdAt: normalized.createdAt
  };
}

export { toDoc as toMediaDoc, fromDoc as fromMediaDoc };
