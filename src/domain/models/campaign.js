import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

export const DEFAULT_CAMPAIGN_SCHEMA_VERSION = 2;

const LEGACY_CAMPAIGN_KEYS = [
  "players",
  "authorizedUsers",
  "authorizedEmails",
  "combatState"
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

export function normalizeCampaign(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const resolvedId = trimOrEmpty(
    ctx.id ?? src.id ?? src.campaignId ?? ""
  );
  const resolvedCampaignId = trimOrEmpty(
    src.campaignId !== undefined && src.campaignId !== null
      ? src.campaignId
      : resolvedId
  );

  let schemaVersion = DEFAULT_CAMPAIGN_SCHEMA_VERSION;
  if (src.schemaVersion !== undefined && src.schemaVersion !== null) {
    schemaVersion =
      typeof src.schemaVersion === "number"
        ? src.schemaVersion
        : Number(src.schemaVersion);
  }

  let activeSceneId = null;
  if (src.activeSceneId !== undefined && src.activeSceneId !== null) {
    activeSceneId =
      typeof src.activeSceneId === "string"
        ? trimOrNull(src.activeSceneId)
        : src.activeSceneId;
  }

  return {
    id: resolvedId,
    campaignId: resolvedCampaignId,
    name: trimOrEmpty(src.name),
    gmId: trimOrEmpty(src.gmId),
    activeSceneId,
    schemaVersion,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateCampaign(entity) {
  const errors = [];

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Campaign must be a non-null plain object.",
        { field: "campaign" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Campaign id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Campaign campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  } else if (
    isTrimmedNonEmpty(entity.id) &&
    entity.campaignId !== entity.id
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Campaign campaignId must equal id.",
        { field: "campaignId", id: entity.id, campaignId: entity.campaignId }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.name)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Campaign name must be a trimmed non-empty string.",
        { field: "name" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.gmId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Campaign gmId must be a trimmed non-empty string.",
        { field: "gmId" }
      )
    );
  }

  if (entity.activeSceneId !== null) {
    if (!isTrimmedNonEmpty(entity.activeSceneId)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Campaign activeSceneId must be null or a trimmed non-empty string.",
          { field: "activeSceneId" }
        )
      );
    } else if (entity.activeSceneId.includes("/")) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          'Campaign activeSceneId must not contain "/".',
          { field: "activeSceneId" }
        )
      );
    }
  }

  if (
    typeof entity.schemaVersion !== "number" ||
    !Number.isInteger(entity.schemaVersion)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Campaign schemaVersion must be an integer.",
        { field: "schemaVersion", value: entity.schemaVersion }
      )
    );
  } else if (entity.schemaVersion < 1) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Campaign schemaVersion must be >= 1.",
        { field: "schemaVersion", value: entity.schemaVersion }
      )
    );
  }

  for (const legacyKey of LEGACY_CAMPAIGN_KEYS) {
    if (Object.hasOwn(entity, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy campaign field "${legacyKey}" is not allowed in v2.`,
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
  const resolvedId = id ?? ctx.id ?? src.id ?? src.campaignId ?? "";
  return normalizeCampaign(src, { ...ctx, id: resolvedId });
}

export function toDoc(entity) {
  const normalized = normalizeCampaign(entity);
  return {
    campaignId: normalized.campaignId,
    name: normalized.name,
    gmId: normalized.gmId,
    activeSceneId: normalized.activeSceneId,
    schemaVersion: normalized.schemaVersion,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toCampaignDoc, fromDoc as fromCampaignDoc };
