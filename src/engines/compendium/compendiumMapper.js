import {
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  ID_PREFIXES,
  RESERVED_FORMULA_KEYS,
  RESOURCE_KEYS,
  ROLL_KINDS,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../domain/constants.js";
import {
  DEFAULT_COLORS,
  DEFAULT_NAMES,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultRange,
  createDefaultSavingThrow
} from "../../domain/defaults.js";
import { AppError, ERROR_CODES } from "../../domain/errors.js";

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

const VALID_COMPENDIUM_TYPES = new Set(Object.values(COMPENDIUM_TYPES));
const VALID_TRIGGERS = new Set(Object.values(TRIGGER_TYPES));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_RANGE_TYPES = new Set(Object.values(SKILL_RANGE_TYPES));
const VALID_AOE_TYPES = new Set(Object.values(SKILL_AOE_TYPES));
const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));

function resolveNonEmptyString(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveFiniteNumber(value, fallback) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function resolvePositiveInt(value, fallback = 1) {
  const num = resolveFiniteNumber(value, fallback);
  if (num < 1) {
    return fallback;
  }
  return Math.trunc(num);
}

export function normalizeSkillKey(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function resolveUniqueSkillKey(rawNameOrKey, existingKeys = []) {
  let base = normalizeSkillKey(rawNameOrKey);
  if (!base) {
    base = "skill";
  }
  if (/^[0-9]/.test(base)) {
    base = `sk_${base}`;
  }

  const taken = new Set([...RESERVED_FORMULA_KEYS, ...UNSAFE_KEYS]);

  const addExisting = (rawKey) => {
    if (typeof rawKey !== "string") {
      return;
    }
    const lower = rawKey.trim().toLowerCase();
    if (lower) {
      taken.add(lower);
    }
    const norm = normalizeSkillKey(rawKey);
    if (norm) {
      taken.add(norm);
    }
  };

  if (existingKeys instanceof Set || Array.isArray(existingKeys)) {
    for (const key of existingKeys) {
      addExisting(key);
    }
  } else if (existingKeys && typeof existingKeys === "object") {
    for (const key of Object.keys(existingKeys)) {
      if (!UNSAFE_KEYS.has(key)) {
        addExisting(key);
      }
    }
  }

  if (!taken.has(base)) {
    return base;
  }

  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) {
    suffix += 1;
  }
  return `${base}_${suffix}`;
}

function resolveOrder(existingOrder) {
  if (typeof existingOrder === "number" && Number.isFinite(existingOrder)) {
    return Math.max(0, Math.trunc(existingOrder));
  }
  if (Array.isArray(existingOrder)) {
    const orders = [];
    for (const item of existingOrder) {
      if (typeof item === "number" && Number.isFinite(item)) {
        orders.push(item);
      } else if (
        item &&
        typeof item === "object" &&
        typeof item.order === "number" &&
        Number.isFinite(item.order)
      ) {
        orders.push(item.order);
      }
    }
    return orders.length > 0 ? Math.max(0, Math.trunc(Math.max(...orders)) + 1) : 0;
  }
  return 0;
}

function requireId(createId, prefix) {
  if (typeof createId !== "function") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "createId function is required",
      { prefix }
    );
  }
  const id = createId(prefix);
  if (typeof id !== "string" || !id.trim()) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "createId must return a non-empty string",
      { prefix, id }
    );
  }
  return id.trim();
}

function mapEffectTypeToRollKind(effectType) {
  switch (effectType) {
    case EFFECT_TYPES.HEAL:
      return ROLL_KINDS.HEAL;
    case EFFECT_TYPES.MP_HEAL:
      return ROLL_KINDS.MP_HEAL;
    case EFFECT_TYPES.MP_DAMAGE:
      return ROLL_KINDS.MP_DAMAGE;
    case EFFECT_TYPES.UTILITY:
      return ROLL_KINDS.UTILITY;
    default:
      return ROLL_KINDS.DAMAGE;
  }
}

export function mapCompendiumEntryToCharacterEntry(entry, options = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      "Compendium entry must be an object",
      { entry }
    );
  }

  const type = entry.type;
  if (!VALID_COMPENDIUM_TYPES.has(type)) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      "Invalid compendium entry type",
      { type }
    );
  }

  const opts = options && typeof options === "object" ? options : {};
  const { createId, existingKeys, existingOrder } = opts;
  const order = resolveOrder(existingOrder);

  if (type === COMPENDIUM_TYPES.ABILITY || type === COMPENDIUM_TYPES.SPELL) {
    const id = requireId(createId, ID_PREFIXES.ABILITY);
    const hitFormula = trimString(entry.hitFormula);
    const effectFormula = trimString(entry.effectFormula);
    const trigger = VALID_TRIGGERS.has(entry.trigger)
      ? entry.trigger
      : TRIGGER_TYPES.ACTIVE;
    const effectType = VALID_EFFECT_TYPES.has(entry.effectType)
      ? entry.effectType
      : EFFECT_TYPES.DAMAGE;

    let rollKind;
    if (VALID_ROLL_KINDS.has(entry.rollKind)) {
      rollKind = entry.rollKind;
    } else if (hitFormula) {
      rollKind = ROLL_KINDS.ATTACK;
    } else if (effectFormula) {
      rollKind = mapEffectTypeToRollKind(effectType);
    } else {
      rollKind = ROLL_KINDS.CHECK;
    }

    const rawCost =
      entry.cost && typeof entry.cost === "object" && !Array.isArray(entry.cost)
        ? entry.cost
        : { resource: entry.costResource, amount: entry.costAmount };
    const cost = createDefaultAbilityCost(rawCost);
    if (!VALID_RESOURCE_KEYS.has(cost.resource)) {
      cost.resource = RESOURCE_KEYS.MP;
    }

    const range = createDefaultRange(entry.range);
    if (!VALID_RANGE_TYPES.has(range.type)) {
      range.type = SKILL_RANGE_TYPES.RANGED;
    }

    const aoe = createDefaultAoe(entry.aoe);
    if (!VALID_AOE_TYPES.has(aoe.type)) {
      aoe.type = SKILL_AOE_TYPES.SINGLE;
    }

    const mapped = {
      id,
      name: resolveNonEmptyString(entry.name, DEFAULT_NAMES.compendiumEntry),
      icon: resolveNonEmptyString(entry.icon, "sword"),
      elementColor: resolveNonEmptyString(
        entry.elementColor,
        DEFAULT_COLORS.abilityElement
      ),
      cost,
      hitFormula,
      effectFormula,
      trigger,
      effectType,
      rollKind,
      range,
      aoe,
      savingThrow: createDefaultSavingThrow(entry.savingThrow),
      description: trimString(entry.description),
      order
    };

    return {
      collection: "abilities",
      entryKey: id,
      entry: mapped
    };
  }

  if (type === COMPENDIUM_TYPES.SKILL) {
    const key = resolveUniqueSkillKey(entry.key || entry.name, existingKeys);
    const attributeKey = resolveNonEmptyString(
      entry.attributeKey,
      resolveNonEmptyString(entry.attribute, "forca")
    );

    const mapped = {
      key,
      name: resolveNonEmptyString(entry.name, DEFAULT_NAMES.compendiumEntry),
      attributeKey,
      bonus: resolveFiniteNumber(entry.bonus, 0),
      order
    };

    return {
      collection: "skills",
      entryKey: key,
      entry: mapped
    };
  }

  const id = requireId(createId, ID_PREFIXES.INVENTORY);
  const trigger = VALID_TRIGGERS.has(entry.trigger)
    ? entry.trigger
    : TRIGGER_TYPES.ACTIVE;
  const effectType = VALID_EFFECT_TYPES.has(entry.effectType)
    ? entry.effectType
    : EFFECT_TYPES.HEAL;
  const rollKind = VALID_ROLL_KINDS.has(entry.rollKind)
    ? entry.rollKind
    : mapEffectTypeToRollKind(effectType);
  const rollFormula =
    trimString(entry.rollFormula) ||
    trimString(entry.effectFormula) ||
    trimString(entry.hitFormula);

  const mapped = {
    id,
    name: resolveNonEmptyString(entry.name, DEFAULT_NAMES.compendiumEntry),
    icon: resolveNonEmptyString(entry.icon, "sword"),
    qty: resolvePositiveInt(entry.qty, 1),
    elementColor: resolveNonEmptyString(
      entry.elementColor,
      DEFAULT_COLORS.itemElement
    ),
    rollFormula,
    trigger,
    effectType,
    rollKind,
    consumeOnUse: Boolean(entry.consumeOnUse),
    savingThrow: createDefaultSavingThrow(entry.savingThrow),
    description: trimString(entry.description),
    order
  };

  return {
    collection: "inventory",
    entryKey: id,
    entry: mapped
  };
}
