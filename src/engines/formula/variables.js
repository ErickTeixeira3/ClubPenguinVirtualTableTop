import { RESERVED_FORMULA_KEYS } from "../../domain/constants.js";
import {
  AppError,
  ERROR_CODES,
  validationFail,
  validationOk
} from "../../domain/errors.js";
import { normalizeFormulaKey, UNSAFE_KEYS } from "./normalize.js";

const RESERVED_KEY_SET = new Set(
  RESERVED_FORMULA_KEYS.map((key) => normalizeFormulaKey(key))
);

function toFiniteNumber(value, fallback = 0) {
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

function extractEntries(collection, kind, errors) {
  if (collection === null || collection === undefined) {
    return [];
  }
  if (Array.isArray(collection)) {
    return collection.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { kind, rawKey: null, value: 0, index };
      }
      const rawKey = kind === "attribute" ? item.key : (item.key ?? item.id);
      const value =
        kind === "attribute" ? item.value : (item.bonus ?? item.value);
      return { kind, rawKey, value, index };
    });
  }
  if (typeof collection === "object") {
    return Object.entries(collection).map(([mapKey, entry]) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const rawKey = entry.key !== undefined ? entry.key : mapKey;
        const value =
          kind === "attribute" ? entry.value : (entry.bonus ?? entry.value);
        return { kind, rawKey, value, mapKey };
      }
      return { kind, rawKey: mapKey, value: entry, mapKey };
    });
  }
  errors.push(
    new AppError(
      ERROR_CODES.INVALID_TYPE,
      `${kind} collection must be an array or object`,
      { kind, received: typeof collection }
    )
  );
  return [];
}

function validateCategoryEntries(entries, seenOwn, seenCross, errors) {
  const validEntries = [];

  for (const entry of entries) {
    const rawKey = typeof entry.rawKey === "string" ? entry.rawKey.trim() : "";
    const normalized = rawKey ? normalizeFormulaKey(rawKey) : "";

    if (!rawKey || !normalized) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          `Missing or invalid ${entry.kind} key`,
          { kind: entry.kind, rawKey: entry.rawKey ?? null }
        )
      );
      continue;
    }

    if (
      UNSAFE_KEYS.has(rawKey) ||
      UNSAFE_KEYS.has(normalized) ||
      (typeof entry.mapKey === "string" && UNSAFE_KEYS.has(entry.mapKey))
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.RESERVED_KEY,
          `Unsafe prototype key "${normalized}" is not allowed`,
          {
            kind: entry.kind,
            key: normalized,
            reason: "unsafe_prototype_key"
          }
        )
      );
      continue;
    }

    if (RESERVED_KEY_SET.has(normalized)) {
      errors.push(
        new AppError(
          ERROR_CODES.RESERVED_KEY,
          `Formula key "${normalized}" is reserved`,
          { kind: entry.kind, key: normalized }
        )
      );
      continue;
    }

    if (seenOwn.has(normalized)) {
      errors.push(
        new AppError(
          ERROR_CODES.KEY_COLLISION,
          `Duplicate ${entry.kind} key "${normalized}"`,
          { kind: entry.kind, key: normalized, conflictWith: entry.kind }
        )
      );
      continue;
    }

    if (seenCross && seenCross.has(normalized)) {
      errors.push(
        new AppError(
          ERROR_CODES.KEY_COLLISION,
          `Skill key "${normalized}" collides with an attribute key`,
          { kind: entry.kind, key: normalized, conflictWith: "attribute" }
        )
      );
      continue;
    }

    seenOwn.add(normalized);
    validEntries.push({
      key: normalized,
      value: toFiniteNumber(entry.value, 0)
    });
  }

  return validEntries;
}

function collectValidatedVariables(character) {
  if (character === null || character === undefined) {
    return { validation: validationOk(), entries: [] };
  }
  if (typeof character !== "object" || Array.isArray(character)) {
    return {
      validation: validationFail(
        new AppError(ERROR_CODES.INVALID_TYPE, "character must be an object", {
          received: Array.isArray(character) ? "array" : typeof character
        })
      ),
      entries: []
    };
  }

  const errors = [];
  const attrEntries = extractEntries(character.attributes, "attribute", errors);
  const skillEntries = extractEntries(character.skills, "skill", errors);

  const seenAttrs = new Set();
  const seenSkills = new Set();

  const validAttrs = validateCategoryEntries(
    attrEntries,
    seenAttrs,
    null,
    errors
  );
  const validSkills = validateCategoryEntries(
    skillEntries,
    seenSkills,
    seenAttrs,
    errors
  );

  if (errors.length > 0) {
    return { validation: validationFail(errors), entries: [] };
  }

  return {
    validation: validationOk(),
    entries: [...validAttrs, ...validSkills]
  };
}

export function validateFormulaKeys(character) {
  return collectValidatedVariables(character).validation;
}

export function buildCharacterVariableMap(character) {
  if (character === null || character === undefined) {
    return {};
  }

  const { validation, entries } = collectValidatedVariables(character);
  if (!validation.ok) {
    throw validation.errors[0];
  }

  const vars = {};
  for (const entry of entries) {
    vars[entry.key] = entry.value;
  }

  const defense = toFiniteNumber(character.defense, 0);
  const hpCurrent = toFiniteNumber(
    character.resources?.hp?.current ??
      character.hp?.current ??
      character.hp,
    0
  );
  const mpCurrent = toFiniteNumber(
    character.resources?.mp?.current ??
      character.mp?.current ??
      character.mp,
    0
  );
  const rawLevel = toFiniteNumber(character.level ?? character.nivel, 1);
  const level = rawLevel > 0 ? rawLevel : 1;

  vars.defesa = defense;
  vars.defense = defense;
  vars.hp = hpCurrent;
  vars.vida = hpCurrent;
  vars.mp = mpCurrent;
  vars.energia = mpCurrent;
  vars.nivel = level;

  return vars;
}
