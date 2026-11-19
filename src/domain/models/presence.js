import { PRESENCE_KINDS } from "../constants.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_PRESENCE_KINDS = new Set(Object.values(PRESENCE_KINDS));

const LEGACY_PRESENCE_KEYS = [
  "uid",
  "connId",
  "campaignId",
  "sceneId",
  "displayName",
  "avatarMediaId",
  "photoURL",
  "avatarRemoved",
  "role",
  "online",
  "updatedAt"
];

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

export function normalizePresence(raw = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const kind =
    src.kind === undefined || src.kind === null
      ? PRESENCE_KINDS.MAIN
      : trimOrEmpty(src.kind);

  let sheetId = null;
  if (src.sheetId !== undefined && src.sheetId !== null) {
    sheetId =
      typeof src.sheetId === "string"
        ? trimOrNull(src.sheetId)
        : src.sheetId;
  }

  const connectedAt =
    src.connectedAt === undefined || src.connectedAt === null
      ? null
      : typeof src.connectedAt === "number"
        ? src.connectedAt
        : Number(src.connectedAt);

  return {
    kind,
    sheetId,
    connectedAt
  };
}

export function validatePresence(presence) {
  const errors = [];

  if (!isPlainRecord(presence)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Presence must be a non-null plain object.",
        { field: "presence" }
      )
    ]);
  }

  if (!VALID_PRESENCE_KINDS.has(presence.kind)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Presence kind "${String(presence.kind)}" is invalid.`,
        { field: "kind", value: presence.kind }
      )
    );
  } else if (presence.kind === PRESENCE_KINDS.SHEET) {
    if (!isTrimmedNonEmpty(presence.sheetId)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Sheet presence requires a trimmed non-empty sheetId.",
          { field: "sheetId" }
        )
      );
    }
  } else if (presence.sheetId !== null) {
    errors.push(
      new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Main presence must have sheetId === null.",
        { field: "sheetId", value: presence.sheetId }
      )
    );
  }

  if (
    presence.connectedAt !== null &&
    (typeof presence.connectedAt !== "number" ||
      !Number.isFinite(presence.connectedAt) ||
      presence.connectedAt < 0)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Presence connectedAt must be null or a finite number >= 0.",
        { field: "connectedAt", value: presence.connectedAt }
      )
    );
  }

  for (const legacyKey of LEGACY_PRESENCE_KEYS) {
    if (Object.hasOwn(presence, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy presence field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData) {
  const src = isPlainRecord(docData) ? docData : {};
  return normalizePresence({
    kind: src.kind ?? PRESENCE_KINDS.MAIN,
    sheetId: src.sheetId ?? null,
    connectedAt: src.connectedAt ?? src.updatedAt ?? null
  });
}

export function toDoc(presence) {
  return normalizePresence(presence);
}

export { toDoc as toPresenceDoc, fromDoc as fromPresenceDoc };
