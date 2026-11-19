import { assertAudience } from "../audience.js";
import {
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  RESOURCE_KEYS,
  ROLL_KINDS,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../constants.js";
import {
  DEFAULT_COLORS,
  DEFAULT_NAMES,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultRange,
  createDefaultSavingThrow
} from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_COMPENDIUM_TYPES = new Set(Object.values(COMPENDIUM_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_TRIGGER_TYPES = new Set(Object.values(TRIGGER_TYPES));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));
const VALID_RANGE_TYPES = new Set(Object.values(SKILL_RANGE_TYPES));
const VALID_AOE_TYPES = new Set(Object.values(SKILL_AOE_TYPES));

export const LEGACY_COMPENDIUM_KEYS = Object.freeze([
  "visibleToPlayers",
  "costResource",
  "costAmount",
  "attribute",
  "rangeType",
  "rangeMeters",
  "aoeType",
  "aoeRadiusMeters",
  "aoeConeAngleDeg",
  "coneAngleDeg",
  "rollFormula",
  "saveEnabled",
  "saveDc",
  "saveAttr",
  "saveAttribute",
  "saveEffect"
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

export function normalizeCompendiumEntry(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const campaignId = trimOrNull(src.campaignId ?? ctx.campaignId);

  const type =
    src.type === undefined || src.type === null
      ? COMPENDIUM_TYPES.ABILITY
      : trimOrEmpty(src.type);

  const name =
    src.name === undefined || src.name === null
      ? DEFAULT_NAMES.compendiumEntry
      : typeof src.name === "string"
        ? src.name.trim()
        : "";

  const icon =
    src.icon === undefined || src.icon === null
      ? "sword"
      : typeof src.icon === "string"
        ? src.icon.trim()
        : "";

  const elementColor =
    src.elementColor === undefined || src.elementColor === null
      ? DEFAULT_COLORS.compendiumElement
      : typeof src.elementColor === "string"
        ? src.elementColor.trim()
        : "";

  const costDefaults = createDefaultAbilityCost();
  const rawCost = isPlainRecord(src.cost) ? src.cost : {};
  const cost = {
    resource:
      rawCost.resource !== undefined && rawCost.resource !== null
        ? trimOrEmpty(rawCost.resource)
        : costDefaults.resource,
    amount: resolveNumber(rawCost.amount, costDefaults.amount)
  };

  const rangeDefaults = createDefaultRange();
  const rawRange = isPlainRecord(src.range) ? src.range : {};
  const range = {
    type:
      rawRange.type !== undefined && rawRange.type !== null
        ? trimOrEmpty(rawRange.type)
        : rangeDefaults.type,
    distanceMeters: resolveNumber(
      rawRange.distanceMeters,
      rangeDefaults.distanceMeters
    )
  };

  const aoeDefaults = createDefaultAoe();
  const rawAoe = isPlainRecord(src.aoe) ? src.aoe : {};
  const aoe = {
    type:
      rawAoe.type !== undefined && rawAoe.type !== null
        ? trimOrEmpty(rawAoe.type)
        : aoeDefaults.type,
    radiusMeters: resolveNumber(rawAoe.radiusMeters, aoeDefaults.radiusMeters),
    coneAngleDeg: resolveNumber(rawAoe.coneAngleDeg, aoeDefaults.coneAngleDeg)
  };

  const rawSave = isPlainRecord(src.savingThrow) ? src.savingThrow : {};
  const savingThrow = createDefaultSavingThrow(rawSave);
  if (rawSave.attributeKey === "") {
    savingThrow.attributeKey = "";
  }
  if (
    rawSave.enabled === true &&
    typeof rawSave.dcFormula === "string" &&
    rawSave.dcFormula.trim() === ""
  ) {
    savingThrow.dcFormula = "";
  }

  const attributeKey =
    src.attributeKey === undefined || src.attributeKey === null
      ? "forca"
      : typeof src.attributeKey === "string"
        ? src.attributeKey.trim()
        : "";

  const deletedBy =
    src.deletedBy !== undefined && src.deletedBy !== null
      ? typeof src.deletedBy === "string"
        ? trimOrNull(src.deletedBy)
        : src.deletedBy
      : null;

  return {
    id,
    campaignId,
    type,
    name,
    category: typeof src.category === "string" ? src.category : "",
    icon,
    elementColor,
    visibleTo: cleanStringList(src.visibleTo),
    cost,
    hitFormula: typeof src.hitFormula === "string" ? src.hitFormula : "",
    effectFormula:
      typeof src.effectFormula === "string" ? src.effectFormula : "",
    rollKind:
      src.rollKind === undefined || src.rollKind === null
        ? null
        : trimOrEmpty(src.rollKind),
    trigger:
      src.trigger === undefined || src.trigger === null
        ? TRIGGER_TYPES.ACTIVE
        : trimOrEmpty(src.trigger),
    effectType:
      src.effectType === undefined || src.effectType === null
        ? EFFECT_TYPES.DAMAGE
        : trimOrEmpty(src.effectType),
    range,
    aoe,
    savingThrow,
    bonus: resolveNumber(src.bonus, 0),
    attributeKey,
    description: typeof src.description === "string" ? src.description : "",
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateCompendiumEntry(entry) {
  const errors = [];

  if (!isPlainRecord(entry)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry must be a non-null plain object.",
        { field: "compendiumEntry" }
      )
    ]);
  }

  for (const reqField of [
    "campaignId",
    "name",
    "icon",
    "elementColor",
    "attributeKey"
  ]) {
    if (!isTrimmedNonEmpty(entry[reqField])) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `CompendiumEntry ${reqField} must be a trimmed non-empty string.`,
          { field: reqField }
        )
      );
    }
  }

  if (!VALID_COMPENDIUM_TYPES.has(entry.type)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `CompendiumEntry type "${String(entry.type)}" is invalid.`,
        { field: "type", value: entry.type }
      )
    );
  }

  const audienceRes = assertAudience(entry, { entityType: "compendiumEntry" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  if (!isPlainRecord(entry.cost)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry cost must be a plain object.",
        { field: "cost" }
      )
    );
  } else {
    if (!VALID_RESOURCE_KEYS.has(entry.cost.resource)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `CompendiumEntry cost.resource "${String(entry.cost.resource)}" is invalid.`,
          { field: "cost.resource", value: entry.cost.resource }
        )
      );
    }
    if (
      typeof entry.cost.amount !== "number" ||
      !Number.isFinite(entry.cost.amount) ||
      entry.cost.amount < 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "CompendiumEntry cost.amount must be a finite number >= 0.",
          { field: "cost.amount", value: entry.cost.amount }
        )
      );
    }
  }

  if (entry.rollKind !== null && !VALID_ROLL_KINDS.has(entry.rollKind)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `CompendiumEntry rollKind "${String(entry.rollKind)}" is invalid.`,
        { field: "rollKind", value: entry.rollKind }
      )
    );
  }

  if (!VALID_TRIGGER_TYPES.has(entry.trigger)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `CompendiumEntry trigger "${String(entry.trigger)}" is invalid.`,
        { field: "trigger", value: entry.trigger }
      )
    );
  }

  if (!VALID_EFFECT_TYPES.has(entry.effectType)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `CompendiumEntry effectType "${String(entry.effectType)}" is invalid.`,
        { field: "effectType", value: entry.effectType }
      )
    );
  }

  if (!isPlainRecord(entry.range)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry range must be a plain object.",
        { field: "range" }
      )
    );
  } else {
    if (!VALID_RANGE_TYPES.has(entry.range.type)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `CompendiumEntry range.type "${String(entry.range.type)}" is invalid.`,
          { field: "range.type", value: entry.range.type }
        )
      );
    }
    if (
      typeof entry.range.distanceMeters !== "number" ||
      !Number.isFinite(entry.range.distanceMeters) ||
      entry.range.distanceMeters < 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "CompendiumEntry range.distanceMeters must be >= 0.",
          { field: "range.distanceMeters", value: entry.range.distanceMeters }
        )
      );
    }
  }

  if (!isPlainRecord(entry.aoe)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry aoe must be a plain object.",
        { field: "aoe" }
      )
    );
  } else {
    if (!VALID_AOE_TYPES.has(entry.aoe.type)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `CompendiumEntry aoe.type "${String(entry.aoe.type)}" is invalid.`,
          { field: "aoe.type", value: entry.aoe.type }
        )
      );
    }
    if (
      typeof entry.aoe.radiusMeters !== "number" ||
      !Number.isFinite(entry.aoe.radiusMeters) ||
      entry.aoe.radiusMeters < 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "CompendiumEntry aoe.radiusMeters must be >= 0.",
          { field: "aoe.radiusMeters", value: entry.aoe.radiusMeters }
        )
      );
    }
    if (
      typeof entry.aoe.coneAngleDeg !== "number" ||
      !Number.isFinite(entry.aoe.coneAngleDeg) ||
      entry.aoe.coneAngleDeg <= 0 ||
      entry.aoe.coneAngleDeg > 360
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "CompendiumEntry aoe.coneAngleDeg must be > 0 and <= 360.",
          { field: "aoe.coneAngleDeg", value: entry.aoe.coneAngleDeg }
        )
      );
    }
  }

  if (!isPlainRecord(entry.savingThrow)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry savingThrow must be a plain object.",
        { field: "savingThrow" }
      )
    );
  } else {
    if (Object.hasOwn(entry.savingThrow, "attribute")) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "Legacy savingThrow.attribute is not allowed in v2.",
          { field: "savingThrow.attribute" }
        )
      );
    }
    if (typeof entry.savingThrow.enabled !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "CompendiumEntry savingThrow.enabled must be a boolean.",
          { field: "savingThrow.enabled" }
        )
      );
    }
    if (typeof entry.savingThrow.dcFormula !== "string") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "CompendiumEntry savingThrow.dcFormula must be a string.",
          { field: "savingThrow.dcFormula" }
        )
      );
    } else if (
      entry.savingThrow.enabled === true &&
      entry.savingThrow.dcFormula.trim().length === 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "CompendiumEntry savingThrow.dcFormula must be non-empty when enabled.",
          { field: "savingThrow.dcFormula" }
        )
      );
    }
    if (!isTrimmedNonEmpty(entry.savingThrow.attributeKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "CompendiumEntry savingThrow.attributeKey must be a trimmed non-empty string.",
          { field: "savingThrow.attributeKey" }
        )
      );
    }
    if (typeof entry.savingThrow.effectDescription !== "string") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "CompendiumEntry savingThrow.effectDescription must be a string.",
          { field: "savingThrow.effectDescription" }
        )
      );
    }
  }

  if (typeof entry.bonus !== "number" || !Number.isFinite(entry.bonus)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry bonus must be a finite number.",
        { field: "bonus", value: entry.bonus }
      )
    );
  }

  for (const strField of ["category", "hitFormula", "effectFormula", "description"]) {
    if (typeof entry[strField] !== "string") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `CompendiumEntry ${strField} must be a string.`,
          { field: strField }
        )
      );
    }
  }

  if (typeof entry.isDeleted !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "CompendiumEntry isDeleted must be a boolean.",
        { field: "isDeleted" }
      )
    );
  }

  for (const legacyKey of LEGACY_COMPENDIUM_KEYS) {
    if (Object.hasOwn(entry, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy compendiumEntry field "${legacyKey}" is not allowed in v2.`,
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

  let visibleTo = cleanStringList(src.visibleTo);
  if (typeof src.visibleToPlayers === "boolean") {
    if (src.visibleToPlayers) {
      visibleTo = ["ALL"];
    } else {
      visibleTo = visibleTo.filter((entry) => entry !== "ALL");
      if (visibleTo.length === 0 && isTrimmedNonEmpty(ctx.gmId)) {
        visibleTo = [trimOrEmpty(ctx.gmId)];
      }
    }
  }

  const cost = isPlainRecord(src.cost)
    ? src.cost
    : {
        resource: src.costResource ?? "mp",
        amount: src.costAmount ?? 0
      };

  const range = isPlainRecord(src.range)
    ? {
        ...src.range,
        type: src.range.type ?? src.rangeType,
        distanceMeters:
          src.range.distanceMeters ?? src.rangeMeters ?? src.distanceMeters
      }
    : src.rangeType !== undefined ||
        src.rangeMeters !== undefined ||
        src.distanceMeters !== undefined
      ? {
          type: src.rangeType,
          distanceMeters: src.rangeMeters ?? src.distanceMeters
        }
      : undefined;

  const aoe = isPlainRecord(src.aoe)
    ? {
        ...src.aoe,
        type: src.aoe.type ?? src.aoeType,
        radiusMeters: src.aoe.radiusMeters ?? src.aoeRadiusMeters,
        coneAngleDeg:
          src.aoe.coneAngleDeg ?? src.coneAngleDeg ?? src.aoeConeAngleDeg
      }
    : src.aoeType !== undefined ||
        src.aoeRadiusMeters !== undefined ||
        src.aoeConeAngleDeg !== undefined ||
        src.coneAngleDeg !== undefined
      ? {
          type: src.aoeType,
          radiusMeters: src.aoeRadiusMeters,
          coneAngleDeg: src.coneAngleDeg ?? src.aoeConeAngleDeg
        }
      : undefined;

  const hitFormula =
    (typeof src.hitFormula === "string" && src.hitFormula.trim().length > 0
      ? src.hitFormula
      : undefined) ??
    (src.type === COMPENDIUM_TYPES.SKILL ? src.formula : undefined) ??
    src.hitFormula ??
    "";
  const effectFormula =
    (typeof src.effectFormula === "string" && src.effectFormula.trim().length > 0
      ? src.effectFormula
      : undefined) ??
    src.rollFormula ??
    src.effectFormula ??
    "";

  return normalizeCompendiumEntry(
    {
      ...src,
      visibleTo,
      cost,
      hitFormula,
      effectFormula,
      range,
      aoe,
      attributeKey: src.attributeKey ?? src.attribute
    },
    { ...ctx, id: id ?? ctx.id ?? src.id ?? null }
  );
}

export function toDoc(entry) {
  const normalized = normalizeCompendiumEntry(entry);
  return {
    campaignId: normalized.campaignId,
    type: normalized.type,
    name: normalized.name,
    category: normalized.category,
    icon: normalized.icon,
    elementColor: normalized.elementColor,
    visibleTo: normalized.visibleTo,
    cost: normalized.cost,
    hitFormula: normalized.hitFormula,
    effectFormula: normalized.effectFormula,
    rollKind: normalized.rollKind,
    trigger: normalized.trigger,
    effectType: normalized.effectType,
    range: normalized.range,
    aoe: normalized.aoe,
    savingThrow: normalized.savingThrow,
    bonus: normalized.bonus,
    attributeKey: normalized.attributeKey,
    description: normalized.description,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toCompendiumEntryDoc, fromDoc as fromCompendiumEntryDoc };
