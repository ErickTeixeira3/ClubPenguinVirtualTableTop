import { PENDING_COST_STATUS, RESOURCE_KEYS } from "../constants.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_STATUSES = new Set(Object.values(PENDING_COST_STATUS));
const VALID_COST_KEYS = new Set(Object.values(RESOURCE_KEYS));

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

function normalizeCosts(rawCosts) {
  if (!isPlainRecord(rawCosts)) {
    return {};
  }
  const costs = {};
  for (const [key, val] of Object.entries(rawCosts)) {
    if (UNSAFE_KEYS.has(key)) {
      continue;
    }
    const cleanKey = key.trim();
    if (!cleanKey || UNSAFE_KEYS.has(cleanKey)) {
      continue;
    }
    if (val === undefined || val === null) {
      continue;
    }
    costs[cleanKey] = typeof val === "number" ? val : Number(val);
  }
  return costs;
}

export function normalizePendingCost(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const opId = trimOrEmpty(src.opId ?? ctx.id ?? src.id ?? "");
  const id = trimOrNull(ctx.id ?? src.id ?? opId);
  const campaignId = trimOrNull(src.campaignId ?? ctx.campaignId);

  let itemId = null;
  if (src.itemId !== undefined && src.itemId !== null) {
    itemId =
      typeof src.itemId === "string" ? trimOrNull(src.itemId) : src.itemId;
  }

  let appliedBy = null;
  if (src.appliedBy !== undefined && src.appliedBy !== null) {
    appliedBy =
      typeof src.appliedBy === "string"
        ? trimOrNull(src.appliedBy)
        : src.appliedBy;
  }

  return {
    id,
    opId,
    campaignId,
    characterId: trimOrEmpty(src.characterId),
    sourceMessageId: trimOrEmpty(src.sourceMessageId),
    costs: normalizeCosts(src.costs),
    itemId,
    createdBy: trimOrEmpty(src.createdBy),
    status:
      src.status === undefined || src.status === null
        ? PENDING_COST_STATUS.PENDING
        : trimOrEmpty(src.status),
    appliedBy,
    appliedAt: src.appliedAt ?? null,
    createdAt: src.createdAt ?? null
  };
}

export function validatePendingCost(pendingCost) {
  const errors = [];

  if (!isPlainRecord(pendingCost)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "PendingCost must be a non-null plain object.",
        { field: "pendingCost" }
      )
    ]);
  }

  for (const reqField of [
    "opId",
    "campaignId",
    "characterId",
    "sourceMessageId",
    "createdBy"
  ]) {
    if (!isTrimmedNonEmpty(pendingCost[reqField])) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `PendingCost ${reqField} must be a trimmed non-empty string.`,
          { field: reqField }
        )
      );
    }
  }

  if (pendingCost.itemId !== null && !isTrimmedNonEmpty(pendingCost.itemId)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "PendingCost itemId must be null or a trimmed non-empty string.",
        { field: "itemId" }
      )
    );
  }

  if (!isPlainRecord(pendingCost.costs)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "PendingCost costs must be a plain object.",
        { field: "costs" }
      )
    );
  } else {
    let hasPositiveCost = false;
    for (const [key, val] of Object.entries(pendingCost.costs)) {
      if (UNSAFE_KEYS.has(key) || !VALID_COST_KEYS.has(key)) {
        errors.push(
          new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            `PendingCost costs key "${key}" is not allowed (only hp/mp).`,
            { field: `costs.${key}` }
          )
        );
        continue;
      }
      if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
        errors.push(
          new AppError(
            ERROR_CODES.OUT_OF_RANGE,
            `PendingCost costs.${key} must be a finite number >= 0.`,
            { field: `costs.${key}`, value: val }
          )
        );
      } else if (val > 0) {
        hasPositiveCost = true;
      }
    }

    if (!hasPositiveCost && !isTrimmedNonEmpty(pendingCost.itemId)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "PendingCost must specify at least one positive mp/hp cost or an itemId.",
          { field: "costs" }
        )
      );
    }
  }

  if (!VALID_STATUSES.has(pendingCost.status)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `PendingCost status "${String(pendingCost.status)}" is invalid.`,
        { field: "status", value: pendingCost.status }
      )
    );
  } else if (pendingCost.status === PENDING_COST_STATUS.APPLIED) {
    if (!isTrimmedNonEmpty(pendingCost.appliedBy)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "PendingCost appliedBy is required when status is applied.",
          { field: "appliedBy" }
        )
      );
    }
  } else if (pendingCost.status === PENDING_COST_STATUS.PENDING) {
    if (pendingCost.appliedBy !== null || pendingCost.appliedAt !== null) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "PendingCost appliedBy and appliedAt must be null when status is pending.",
          { field: "status" }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};
  return normalizePendingCost(src, {
    ...ctx,
    id: id ?? ctx.id ?? src.id ?? src.opId ?? null
  });
}

export function toDoc(pendingCost) {
  const normalized = normalizePendingCost(pendingCost);
  return {
    opId: normalized.opId,
    campaignId: normalized.campaignId,
    characterId: normalized.characterId,
    sourceMessageId: normalized.sourceMessageId,
    costs: normalized.costs,
    itemId: normalized.itemId,
    createdBy: normalized.createdBy,
    status: normalized.status,
    appliedBy: normalized.appliedBy,
    appliedAt: normalized.appliedAt,
    createdAt: normalized.createdAt
  };
}

export { toDoc as toPendingCostDoc, fromDoc as fromPendingCostDoc };
