import { DEFAULT_FOG_DEFAULTS } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_FOG_OPS = new Set(["reveal", "hide"]);

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

export const LEGACY_FOG_KEYS = Object.freeze([
  "drawings",
  "pings",
  "campaignId",
  "sceneId"
]);

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function normalizeFogArea(raw = {}, areaId = undefined) {
  const src = isPlainRecord(raw) ? raw : {};
  const id = trimOrNull(areaId ?? src.id);
  const op =
    src.op === undefined || src.op === null ? "reveal" : trimOrEmpty(src.op);
  const createdAt =
    src.createdAt === undefined || src.createdAt === null
      ? null
      : typeof src.createdAt === "number"
        ? src.createdAt
        : Number(src.createdAt);

  return {
    id,
    op,
    x: resolveNumber(src.x, 0),
    y: resolveNumber(src.y, 0),
    w: resolveNumber(src.w, 0),
    h: resolveNumber(src.h, 0),
    createdAt
  };
}

export function validateFogArea(area, expectedId = undefined) {
  const errors = [];

  if (!isPlainRecord(area)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "FogArea must be a non-null plain object.",
        { field: "area" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(area.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "FogArea id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  } else if (expectedId !== undefined && area.id !== expectedId) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        `FogArea id "${area.id}" must match map key "${expectedId}".`,
        { field: "id", id: area.id, expectedId }
      )
    );
  }

  if (!VALID_FOG_OPS.has(area.op)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `FogArea op "${String(area.op)}" is invalid.`,
        { field: "op", value: area.op }
      )
    );
  }

  for (const coord of ["x", "y"]) {
    if (typeof area[coord] !== "number" || !Number.isFinite(area[coord])) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `FogArea ${coord} must be a finite number.`,
          { field: coord }
        )
      );
    }
  }

  for (const dim of ["w", "h"]) {
    if (
      typeof area[dim] !== "number" ||
      !Number.isFinite(area[dim]) ||
      area[dim] <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `FogArea ${dim} must be a finite number > 0.`,
          { field: dim, value: area[dim] }
        )
      );
    }
  }

  if (
    area.createdAt !== null &&
    (typeof area.createdAt !== "number" ||
      !Number.isFinite(area.createdAt) ||
      area.createdAt < 0)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "FogArea createdAt must be null or a finite number >= 0.",
        { field: "createdAt", value: area.createdAt }
      )
    );
  }

  for (const legacyKey of ["campaignId", "sceneId"]) {
    if (Object.hasOwn(area, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy FogArea field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function normalizeFog(raw = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const enabled =
    src.enabled !== undefined
      ? Boolean(src.enabled)
      : DEFAULT_FOG_DEFAULTS.enabled;

  const areas = {};
  if (Array.isArray(src.areas)) {
    for (const entry of src.areas) {
      if (!isPlainRecord(entry)) {
        continue;
      }
      const key = trimOrNull(entry.id);
      if (!key || UNSAFE_KEYS.has(key)) {
        continue;
      }
      areas[key] = normalizeFogArea(entry, key);
    }
  } else if (isPlainRecord(src.areas)) {
    for (const [key, entry] of Object.entries(src.areas)) {
      if (UNSAFE_KEYS.has(key) || !isPlainRecord(entry)) {
        continue;
      }
      const cleanKey = key.trim();
      if (!cleanKey || UNSAFE_KEYS.has(cleanKey)) {
        continue;
      }
      const normalizedArea = normalizeFogArea(entry);
      if (normalizedArea.id === null) {
        normalizedArea.id = cleanKey;
      }
      areas[cleanKey] = normalizedArea;
    }
  }

  const updatedAt =
    src.updatedAt === undefined || src.updatedAt === null
      ? null
      : typeof src.updatedAt === "number"
        ? src.updatedAt
        : Number(src.updatedAt);

  return {
    enabled,
    areas,
    updatedAt
  };
}

export function validateFog(fog) {
  const errors = [];

  if (!isPlainRecord(fog)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Fog must be a non-null plain object.",
        { field: "fog" }
      )
    ]);
  }

  if (typeof fog.enabled !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Fog enabled must be a boolean.",
        { field: "enabled" }
      )
    );
  }

  if (!isPlainRecord(fog.areas)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Fog areas must be a plain object map.",
        { field: "areas" }
      )
    );
  } else {
    for (const key of Object.keys(fog.areas)) {
      if (UNSAFE_KEYS.has(key) || !isTrimmedNonEmpty(key)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "Fog areas contains an invalid key.",
            { field: "areas", key }
          )
        );
        continue;
      }
      const areaRes = validateFogArea(fog.areas[key], key);
      if (!areaRes.ok) {
        errors.push(...areaRes.errors);
      }
    }
  }

  if (
    fog.updatedAt !== null &&
    (typeof fog.updatedAt !== "number" ||
      !Number.isFinite(fog.updatedAt) ||
      fog.updatedAt < 0)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Fog updatedAt must be null or a finite number >= 0.",
        { field: "updatedAt", value: fog.updatedAt }
      )
    );
  }

  for (const legacyKey of LEGACY_FOG_KEYS) {
    if (Object.hasOwn(fog, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy fog field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function getOrderedFogAreas(fog) {
  if (!isPlainRecord(fog) || !isPlainRecord(fog.areas)) {
    return [];
  }
  return Object.values(fog.areas)
    .filter(isPlainRecord)
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export function fromDoc(docData) {
  return normalizeFog(docData);
}

export function toDoc(fog) {
  return normalizeFog(fog);
}

export { toDoc as toFogDoc, fromDoc as fromFogDoc };
