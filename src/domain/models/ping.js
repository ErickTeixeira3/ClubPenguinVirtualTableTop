import { PING_KINDS, PING_LIFETIME_MS } from "../constants.js";
import { DEFAULT_COLORS } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_PING_KINDS = new Set(Object.values(PING_KINDS));

export const LEGACY_PING_KEYS = Object.freeze([
  "expiresAt",
  "campaignId",
  "sceneId",
  "timestamp",
  "senderId",
  "senderName",
  "authorName",
  "startX",
  "startY"
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

export function normalizePing(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  let from = null;
  if (src.from !== undefined && src.from !== null) {
    from = isPlainRecord(src.from)
      ? {
          x: resolveNumber(src.from.x, Number.NaN),
          y: resolveNumber(src.from.y, Number.NaN)
        }
      : src.from;
  }

  const kind =
    src.kind === undefined || src.kind === null
      ? from !== null
        ? PING_KINDS.SNOWBALL
        : PING_KINDS.PING
      : trimOrEmpty(src.kind);

  const createdAt =
    src.createdAt === undefined || src.createdAt === null
      ? null
      : typeof src.createdAt === "number"
        ? src.createdAt
        : Number(src.createdAt);

  return {
    id: trimOrNull(ctx.id ?? src.id),
    authorId: trimOrNull(src.authorId ?? ctx.authorId),
    kind,
    x: resolveNumber(src.x, 0),
    y: resolveNumber(src.y, 0),
    from,
    color:
      src.color === undefined || src.color === null
        ? DEFAULT_COLORS.ping
        : typeof src.color === "string"
          ? src.color.trim()
          : "",
    createdAt
  };
}

export function validatePing(ping) {
  const errors = [];

  if (!isPlainRecord(ping)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Ping must be a non-null plain object.",
        { field: "ping" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(ping.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Ping id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!isTrimmedNonEmpty(ping.authorId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Ping authorId must be a trimmed non-empty string.",
        { field: "authorId" }
      )
    );
  }

  if (!VALID_PING_KINDS.has(ping.kind)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Ping kind "${String(ping.kind)}" is invalid.`,
        { field: "kind", value: ping.kind }
      )
    );
  }

  for (const coord of ["x", "y"]) {
    if (typeof ping[coord] !== "number" || !Number.isFinite(ping[coord])) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `Ping ${coord} must be a finite number.`,
          { field: coord }
        )
      );
    }
  }

  if (ping.kind === PING_KINDS.SNOWBALL) {
    if (
      !isPlainRecord(ping.from) ||
      typeof ping.from.x !== "number" ||
      !Number.isFinite(ping.from.x) ||
      typeof ping.from.y !== "number" ||
      !Number.isFinite(ping.from.y)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Snowball ping requires valid from { x, y } coordinates.",
          { field: "from" }
        )
      );
    }
  } else if (ping.kind === PING_KINDS.PING && ping.from !== null) {
    errors.push(
      new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Standard ping must have from === null.",
        { field: "from" }
      )
    );
  }

  if (!isTrimmedNonEmpty(ping.color)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Ping color must be a trimmed non-empty string.",
        { field: "color" }
      )
    );
  }

  if (
    ping.createdAt !== null &&
    (typeof ping.createdAt !== "number" ||
      !Number.isFinite(ping.createdAt) ||
      ping.createdAt < 0)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Ping createdAt must be null or a finite number >= 0.",
        { field: "createdAt", value: ping.createdAt }
      )
    );
  }

  for (const legacyKey of LEGACY_PING_KEYS) {
    if (Object.hasOwn(ping, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy ping field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function isPingExpired(ping, nowMs, lifetimeMs = PING_LIFETIME_MS) {
  if (
    !isPlainRecord(ping) ||
    typeof ping.createdAt !== "number" ||
    !Number.isFinite(ping.createdAt) ||
    typeof nowMs !== "number" ||
    !Number.isFinite(nowMs) ||
    typeof lifetimeMs !== "number" ||
    !Number.isFinite(lifetimeMs)
  ) {
    return false;
  }
  return nowMs > ping.createdAt + lifetimeMs;
}

export function fromDoc(docData, id = undefined) {
  const src = isPlainRecord(docData) ? docData : {};
  const resolvedId = id ?? src.id ?? null;

  let from = src.from;
  if (
    from === undefined &&
    typeof src.startX === "number" &&
    Number.isFinite(src.startX) &&
    typeof src.startY === "number" &&
    Number.isFinite(src.startY)
  ) {
    from = { x: src.startX, y: src.startY };
  }

  return normalizePing(
    {
      ...src,
      authorId: src.authorId ?? src.senderId ?? null,
      createdAt: src.createdAt ?? src.timestamp ?? null,
      from: from ?? null
    },
    { id: resolvedId }
  );
}

export function toDoc(ping) {
  const normalized = normalizePing(ping);
  const payload = {
    id: normalized.id,
    authorId: normalized.authorId,
    kind: normalized.kind,
    x: normalized.x,
    y: normalized.y,
    color: normalized.color,
    createdAt: normalized.createdAt
  };
  if (normalized.from !== null) {
    payload.from = normalized.from;
  }
  return payload;
}

export { toDoc as toPingDoc, fromDoc as fromPingDoc };
