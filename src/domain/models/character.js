import { assertAudience, computeAudience } from "../audience.js";
import {
  CHARACTER_TYPES,
  DEFAULT_MOVEMENT_BUDGET_METERS,
  EFFECT_TYPES,
  RECENT_OPS_LIMIT,
  RESERVED_FORMULA_KEYS,
  ROLL_KINDS,
  ROLL_SOURCE_TYPES,
  SAVE_ATTRIBUTES,
  TRIGGER_TYPES,
  RESOURCE_KEYS
} from "../constants.js";
import {
  DEFAULT_CHARACTER_DEFENSE,
  DEFAULT_COLORS,
  DEFAULT_NAMES,
  DEFAULT_ROLL_GROUP_ID,
  createDefaultAbilityCost,
  createDefaultAttributesMap,
  createDefaultAoe,
  createDefaultCharacterResources,
  createDefaultHotbar,
  createDefaultRange,
  createDefaultRollGroup,
  createDefaultSavingThrow
} from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const VALID_CHARACTER_TYPES = new Set(Object.values(CHARACTER_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_TRIGGER_TYPES = new Set(Object.values(TRIGGER_TYPES));
const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));
const VALID_ROLL_SOURCE_TYPES = new Set(Object.values(ROLL_SOURCE_TYPES));
const VALID_SAVE_ATTR_IDS = new Set(SAVE_ATTRIBUTES.map((a) => a.id));
const RESERVED_KEY_SET = new Set(RESERVED_FORMULA_KEYS);
const HOTBAR_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const FORMULA_KEY_PATTERN = /^[a-z0-9_]+$/;

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

const LEGACY_CHARACTER_KEYS = [
  "avatarMediaId",
  "avatarExternalUrl",
  "defaultToken",
  "isFolder",
  "migratedToFoldersCollection"
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

function resolveNumberPreservingInvalid(value, fallback) {
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

export function normalizeFormulaKey(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function normalizeCharacterAttributes(raw) {
  if (raw === undefined || raw === null) {
    return createDefaultAttributesMap();
  }

  const map = {};
  if (Array.isArray(raw)) {
    raw.forEach((entry, index) => {
      if (!isPlainRecord(entry)) {
        return;
      }
      const rawKey = trimOrEmpty(entry.key || entry.label || "");
      const normKey = normalizeFormulaKey(rawKey);
      if (!normKey || UNSAFE_KEYS.has(normKey)) {
        return;
      }
      map[normKey] = {
        key: normKey,
        label: trimOrEmpty(entry.label) || normKey,
        value: resolveNumberPreservingInvalid(entry.value, 0),
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : index
      };
    });
    return map;
  }

  if (isPlainRecord(raw)) {
    let fallbackOrder = 0;
    for (const [rawMapKey, entry] of Object.entries(raw)) {
      if (UNSAFE_KEYS.has(rawMapKey)) {
        continue;
      }
      const cleanMapKey = rawMapKey.trim();
      if (!cleanMapKey || UNSAFE_KEYS.has(cleanMapKey)) {
        continue;
      }
      if (typeof entry === "number") {
        map[cleanMapKey] = {
          key: cleanMapKey,
          label: cleanMapKey,
          value: entry,
          order: fallbackOrder
        };
        fallbackOrder += 1;
        continue;
      }
      if (!isPlainRecord(entry)) {
        continue;
      }
      const entryKey =
        entry.key !== undefined && entry.key !== null
          ? trimOrEmpty(entry.key)
          : cleanMapKey;
      map[cleanMapKey] = {
        key: entryKey,
        label:
          typeof entry.label === "string"
            ? entry.label.trim()
            : cleanMapKey,
        value: resolveNumberPreservingInvalid(entry.value, 0),
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : fallbackOrder
      };
      fallbackOrder += 1;
    }
  }
  return map;
}

export function normalizeCharacterSkills(raw, { legacyMode = false } = {}) {
  if (raw === undefined || raw === null) {
    return {};
  }

  const map = {};
  if (Array.isArray(raw)) {
    raw.forEach((entry, index) => {
      if (!isPlainRecord(entry)) {
        return;
      }
      const key = normalizeFormulaKey(
        entry.key || entry.name || entry.id || ""
      );
      if (!key || UNSAFE_KEYS.has(key)) {
        return;
      }
      map[key] = {
        key,
        name: trimOrEmpty(entry.name) || key,
        attributeKey:
          trimOrEmpty(entry.attributeKey ?? entry.attribute) || "forca",
        bonus: resolveNumberPreservingInvalid(entry.bonus, 0),
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : index
      };
    });
    return map;
  }

  if (isPlainRecord(raw)) {
    let fallbackOrder = 0;
    for (const [rawMapKey, entry] of Object.entries(raw)) {
      if (UNSAFE_KEYS.has(rawMapKey) || !isPlainRecord(entry)) {
        continue;
      }
      const mapKey = legacyMode
        ? normalizeFormulaKey(entry.key || entry.name || rawMapKey)
        : rawMapKey.trim();
      if (!mapKey || UNSAFE_KEYS.has(mapKey)) {
        continue;
      }
      const entryKey =
        entry.key !== undefined && entry.key !== null
          ? trimOrEmpty(entry.key)
          : mapKey;
      map[mapKey] = {
        key: legacyMode ? mapKey : entryKey,
        name: trimOrEmpty(entry.name) || mapKey,
        attributeKey:
          trimOrEmpty(entry.attributeKey ?? entry.attribute) || "forca",
        bonus: resolveNumberPreservingInvalid(entry.bonus, 0),
        order:
          typeof entry.order === "number" && Number.isFinite(entry.order)
            ? entry.order
            : fallbackOrder
      };
      fallbackOrder += 1;
    }
  }
  return map;
}

function normalizeCostPreservingInvalid(rawCost, legacyResource, legacyAmount) {
  const src = isPlainRecord(rawCost) ? rawCost : {};
  const defaults = createDefaultAbilityCost();
  const resource =
    src.resource !== undefined && src.resource !== null
      ? trimOrEmpty(src.resource)
      : legacyResource !== undefined && legacyResource !== null
        ? trimOrEmpty(legacyResource)
        : defaults.resource;
  const amount =
    src.amount !== undefined && src.amount !== null
      ? resolveNumberPreservingInvalid(src.amount, defaults.amount)
      : legacyAmount !== undefined && legacyAmount !== null
        ? resolveNumberPreservingInvalid(legacyAmount, defaults.amount)
        : defaults.amount;
  return { resource, amount };
}

function normalizeRangePreservingInvalid(rawRange, legacyType, legacyMeters) {
  const src = isPlainRecord(rawRange) ? rawRange : {};
  const defaults = createDefaultRange();
  const type =
    src.type !== undefined && src.type !== null
      ? trimOrEmpty(src.type)
      : legacyType !== undefined && legacyType !== null
        ? trimOrEmpty(legacyType)
        : defaults.type;
  const distanceMeters =
    src.distanceMeters !== undefined && src.distanceMeters !== null
      ? resolveNumberPreservingInvalid(src.distanceMeters, defaults.distanceMeters)
      : legacyMeters !== undefined && legacyMeters !== null
        ? resolveNumberPreservingInvalid(legacyMeters, defaults.distanceMeters)
        : defaults.distanceMeters;
  return { type, distanceMeters };
}

function normalizeAoePreservingInvalid(
  rawAoe,
  legacyType,
  legacyRadius,
  legacyConeAngle
) {
  const src = isPlainRecord(rawAoe) ? rawAoe : {};
  const defaults = createDefaultAoe();
  const type =
    src.type !== undefined && src.type !== null
      ? trimOrEmpty(src.type)
      : legacyType !== undefined && legacyType !== null
        ? trimOrEmpty(legacyType)
        : defaults.type;
  const radiusMeters =
    src.radiusMeters !== undefined && src.radiusMeters !== null
      ? resolveNumberPreservingInvalid(src.radiusMeters, defaults.radiusMeters)
      : legacyRadius !== undefined && legacyRadius !== null
        ? resolveNumberPreservingInvalid(legacyRadius, defaults.radiusMeters)
        : defaults.radiusMeters;
  const coneAngleDeg =
    src.coneAngleDeg !== undefined && src.coneAngleDeg !== null
      ? resolveNumberPreservingInvalid(src.coneAngleDeg, defaults.coneAngleDeg)
      : legacyConeAngle !== undefined && legacyConeAngle !== null
        ? resolveNumberPreservingInvalid(legacyConeAngle, defaults.coneAngleDeg)
        : defaults.coneAngleDeg;
  return { type, radiusMeters, coneAngleDeg };
}

function normalizeSavingThrowForModel(rawSave) {
  if (!isPlainRecord(rawSave)) {
    return createDefaultSavingThrow();
  }
  const base = createDefaultSavingThrow(rawSave);
  if (rawSave.attributeKey === "") {
    base.attributeKey = "";
  }
  if (rawSave.enabled === true && typeof rawSave.dcFormula === "string" && rawSave.dcFormula.trim() === "") {
    base.dcFormula = "";
  }
  return base;
}

function normalizeAbilities(rawAbilities) {
  if (rawAbilities === undefined || rawAbilities === null) {
    return {};
  }
  const map = {};
  const entries = Array.isArray(rawAbilities)
    ? rawAbilities.map((ab, idx) => [
        isPlainRecord(ab) ? trimOrEmpty(ab.id) || `ab_${idx}` : `ab_${idx}`,
        ab,
        idx
      ])
    : isPlainRecord(rawAbilities)
      ? Object.entries(rawAbilities).map(([k, v], idx) => [k.trim(), v, idx])
      : [];

  for (const [mapKey, entry, idx] of entries) {
    if (!mapKey || UNSAFE_KEYS.has(mapKey) || !isPlainRecord(entry)) {
      continue;
    }
    const id =
      entry.id !== undefined && entry.id !== null
        ? trimOrEmpty(entry.id)
        : mapKey;
    map[mapKey] = {
      id,
      name: trimOrEmpty(entry.name) || "Habilidade",
      icon: trimOrEmpty(entry.icon) || "sword",
      elementColor:
        trimOrEmpty(entry.elementColor) || DEFAULT_COLORS.abilityElement,
      cost: normalizeCostPreservingInvalid(
        entry.cost,
        entry.costResource,
        entry.costAmount
      ),
      hitFormula: typeof entry.hitFormula === "string" ? entry.hitFormula : "",
      effectFormula:
        typeof entry.effectFormula === "string" ? entry.effectFormula : "",
      trigger:
        entry.trigger !== undefined && entry.trigger !== null
          ? trimOrEmpty(entry.trigger)
          : TRIGGER_TYPES.ACTIVE,
      effectType:
        entry.effectType !== undefined && entry.effectType !== null
          ? trimOrEmpty(entry.effectType)
          : EFFECT_TYPES.DAMAGE,
      rollKind:
        entry.rollKind === undefined || entry.rollKind === null
          ? null
          : trimOrEmpty(entry.rollKind),
      range: normalizeRangePreservingInvalid(
        entry.range,
        entry.rangeType,
        entry.rangeMeters
      ),
      aoe: normalizeAoePreservingInvalid(
        entry.aoe,
        entry.aoeType,
        entry.aoeRadiusMeters,
        entry.aoeConeAngleDeg
      ),
      savingThrow: normalizeSavingThrowForModel(entry.savingThrow),
      description:
        typeof entry.description === "string" ? entry.description : "",
      order:
        typeof entry.order === "number" && Number.isFinite(entry.order)
          ? entry.order
          : idx
    };
  }
  return map;
}

function normalizeInventory(rawInventory) {
  if (rawInventory === undefined || rawInventory === null) {
    return {};
  }
  const map = {};
  const entries = Array.isArray(rawInventory)
    ? rawInventory.map((it, idx) => [
        isPlainRecord(it) ? trimOrEmpty(it.id) || `inv_${idx}` : `inv_${idx}`,
        it,
        idx
      ])
    : isPlainRecord(rawInventory)
      ? Object.entries(rawInventory).map(([k, v], idx) => [k.trim(), v, idx])
      : [];

  for (const [mapKey, entry, idx] of entries) {
    if (!mapKey || UNSAFE_KEYS.has(mapKey) || !isPlainRecord(entry)) {
      continue;
    }
    const id =
      entry.id !== undefined && entry.id !== null
        ? trimOrEmpty(entry.id)
        : mapKey;
    const rawQty = entry.qty !== undefined ? entry.qty : entry.quantity;
    map[mapKey] = {
      id,
      name: trimOrEmpty(entry.name) || "Item",
      icon: trimOrEmpty(entry.icon) || "sword",
      qty: resolveNumberPreservingInvalid(rawQty, 1),
      elementColor:
        trimOrEmpty(entry.elementColor) || DEFAULT_COLORS.itemElement,
      rollFormula:
        typeof entry.rollFormula === "string"
          ? entry.rollFormula
          : typeof entry.formula === "string"
            ? entry.formula
            : "",
      trigger:
        entry.trigger !== undefined && entry.trigger !== null
          ? trimOrEmpty(entry.trigger)
          : TRIGGER_TYPES.ACTIVE,
      effectType:
        entry.effectType !== undefined && entry.effectType !== null
          ? trimOrEmpty(entry.effectType)
          : EFFECT_TYPES.HEAL,
      rollKind:
        entry.rollKind === undefined || entry.rollKind === null
          ? null
          : trimOrEmpty(entry.rollKind),
      consumeOnUse: Boolean(entry.consumeOnUse),
      savingThrow: normalizeSavingThrowForModel(entry.savingThrow),
      description:
        typeof entry.description === "string" ? entry.description : "",
      order:
        typeof entry.order === "number" && Number.isFinite(entry.order)
          ? entry.order
          : idx
    };
  }
  return map;
}

function normalizeRollEntry(mapKey, entry, idx, skillIdToKey = null) {
  const id =
    entry.id !== undefined && entry.id !== null
      ? trimOrEmpty(entry.id)
      : mapKey;
  const rawSource = isPlainRecord(entry.source) ? entry.source : {};
  const sourceType =
    rawSource.type !== undefined && rawSource.type !== null
      ? trimOrEmpty(rawSource.type)
      : entry.sourceType !== undefined && entry.sourceType !== null
        ? trimOrEmpty(entry.sourceType)
        : ROLL_SOURCE_TYPES.CUSTOM;

  let sourceId =
    rawSource.id !== undefined
      ? trimOrNull(rawSource.id)
      : trimOrNull(entry.sourceId);
  if (sourceType === ROLL_SOURCE_TYPES.CUSTOM) {
    sourceId = null;
  } else if (
    sourceType === ROLL_SOURCE_TYPES.SKILL &&
    sourceId &&
    skillIdToKey &&
    Object.hasOwn(skillIdToKey, sourceId)
  ) {
    sourceId = skillIdToKey[sourceId];
  }

  const rawOverrides = isPlainRecord(entry.overrides) ? entry.overrides : {};
  const ovName = trimOrNull(rawOverrides.name ?? entry.customName ?? entry.name);
  const ovIcon = trimOrNull(rawOverrides.icon ?? entry.customIcon ?? entry.icon);
  const ovColor = trimOrNull(rawOverrides.color ?? entry.color);

  const overrides = {};
  if (sourceType === ROLL_SOURCE_TYPES.CUSTOM) {
    overrides.name = ovName || DEFAULT_NAMES.roll;
    overrides.icon = ovIcon || "sword";
    overrides.color = ovColor || DEFAULT_COLORS.customRoll;
  } else {
    if (ovName) {
      overrides.name = ovName;
    }
    if (ovIcon) {
      overrides.icon = ovIcon;
    }
    if (ovColor) {
      overrides.color = ovColor;
    }
  }

  const normalized = {
    id,
    order:
      typeof entry.order === "number" && Number.isFinite(entry.order)
        ? entry.order
        : idx,
    source: {
      type: sourceType,
      id: sourceId
    },
    overrides
  };

  if (sourceType === ROLL_SOURCE_TYPES.CUSTOM) {
    const rawCustom = isPlainRecord(entry.custom) ? entry.custom : entry;
    normalized.custom = {
      hitFormula:
        typeof rawCustom.hitFormula === "string" ? rawCustom.hitFormula : "",
      effectFormula:
        typeof rawCustom.effectFormula === "string"
          ? rawCustom.effectFormula
          : "",
      rollKind:
        rawCustom.rollKind !== undefined && rawCustom.rollKind !== null
          ? trimOrEmpty(rawCustom.rollKind)
          : ROLL_KINDS.CHECK,
      effectType:
        rawCustom.effectType !== undefined && rawCustom.effectType !== null
          ? trimOrEmpty(rawCustom.effectType)
          : EFFECT_TYPES.UTILITY,
      cost: normalizeCostPreservingInvalid(
        rawCustom.cost,
        rawCustom.costResource,
        rawCustom.costAmount
      ),
      savingThrow: normalizeSavingThrowForModel(rawCustom.savingThrow)
    };
  }

  return normalized;
}

function normalizeRollGroups(rawGroups, skillIdToKey = null) {
  if (rawGroups === undefined || rawGroups === null) {
    return {
      [DEFAULT_ROLL_GROUP_ID]: createDefaultRollGroup()
    };
  }

  const map = {};
  const entries = Array.isArray(rawGroups)
    ? rawGroups.map((grp, idx) => [
        isPlainRecord(grp) ? trimOrEmpty(grp.id) || `grp_${idx}` : `grp_${idx}`,
        grp,
        idx
      ])
    : isPlainRecord(rawGroups)
      ? Object.entries(rawGroups).map(([k, v], idx) => [k.trim(), v, idx])
      : [];

  for (const [mapKey, entry, idx] of entries) {
    if (!mapKey || UNSAFE_KEYS.has(mapKey) || !isPlainRecord(entry)) {
      continue;
    }
    const id =
      entry.id !== undefined && entry.id !== null
        ? trimOrEmpty(entry.id)
        : mapKey;

    const rolls = {};
    const rawRolls = entry.rolls;
    const rollEntries = Array.isArray(rawRolls)
      ? rawRolls.map((r, rIdx) => [
          isPlainRecord(r) ? trimOrEmpty(r.id) || `r_${rIdx}` : `r_${rIdx}`,
          r,
          rIdx
        ])
      : isPlainRecord(rawRolls)
        ? Object.entries(rawRolls).map(([k, v], rIdx) => [k.trim(), v, rIdx])
        : [];

    for (const [rKey, rEntry, rIdx] of rollEntries) {
      if (!rKey || UNSAFE_KEYS.has(rKey) || !isPlainRecord(rEntry)) {
        continue;
      }
      rolls[rKey] = normalizeRollEntry(rKey, rEntry, rIdx, skillIdToKey);
    }

    map[mapKey] = {
      id,
      name: trimOrEmpty(entry.name) || DEFAULT_NAMES.rollGroup,
      order:
        typeof entry.order === "number" && Number.isFinite(entry.order)
          ? entry.order
          : idx,
      rolls
    };
  }
  return map;
}

function findRollGroupIdForRoll(rollGroups, rollId) {
  for (const [groupId, group] of Object.entries(rollGroups)) {
    if (group?.rolls && Object.hasOwn(group.rolls, rollId)) {
      return groupId;
    }
  }
  return null;
}

function normalizeHotbar(rawHotbar, rollGroups, { resolveLegacy = false } = {}) {
  if (rawHotbar === undefined || rawHotbar === null) {
    return createDefaultHotbar();
  }

  const hotbar = createDefaultHotbar();
  if (Array.isArray(rawHotbar)) {
    HOTBAR_KEYS.forEach((slotKey, index) => {
      const slot = rawHotbar[index];
      if (!isPlainRecord(slot)) {
        hotbar[slotKey] = null;
        return;
      }
      const rollId = trimOrNull(slot.rollId);
      let rollGroupId = trimOrNull(slot.rollGroupId);
      if (!rollGroupId && rollId && resolveLegacy) {
        rollGroupId = findRollGroupIdForRoll(rollGroups, rollId);
      }
      hotbar[slotKey] =
        rollGroupId && rollId ? { rollGroupId, rollId } : null;
    });
    return hotbar;
  }

  if (isPlainRecord(rawHotbar)) {
    for (const slotKey of HOTBAR_KEYS) {
      const slot = Object.hasOwn(rawHotbar, slotKey) ? rawHotbar[slotKey] : null;
      if (!isPlainRecord(slot)) {
        hotbar[slotKey] = null;
        continue;
      }
      const rollId = trimOrEmpty(slot.rollId);
      let rollGroupId = trimOrEmpty(slot.rollGroupId);
      if (!rollGroupId && rollId && resolveLegacy) {
        rollGroupId = findRollGroupIdForRoll(rollGroups, rollId) || "";
      }
      hotbar[slotKey] = { rollGroupId, rollId };
    }
  }
  return hotbar;
}

function normalizeRecentOps(rawRecentOps) {
  if (!isPlainRecord(rawRecentOps)) {
    return {};
  }
  const result = {};
  for (const [opId, ts] of Object.entries(rawRecentOps)) {
    if (UNSAFE_KEYS.has(opId)) {
      continue;
    }
    const cleanId = opId.trim();
    if (!cleanId || UNSAFE_KEYS.has(cleanId)) {
      continue;
    }
    result[cleanId] = typeof ts === "number" ? ts : Number(ts);
  }
  return result;
}

function normalizeResources(rawResources) {
  const defaults = createDefaultCharacterResources();
  const src = isPlainRecord(rawResources) ? rawResources : {};
  const hpSrc = isPlainRecord(src.hp) ? src.hp : {};
  const mpSrc = isPlainRecord(src.mp) ? src.mp : {};
  return {
    hp: {
      current: resolveNumberPreservingInvalid(hpSrc.current, defaults.hp.current),
      max: resolveNumberPreservingInvalid(hpSrc.max, defaults.hp.max)
    },
    mp: {
      current: resolveNumberPreservingInvalid(mpSrc.current, defaults.mp.current),
      max: resolveNumberPreservingInvalid(mpSrc.max, defaults.mp.max)
    }
  };
}

export function normalizeCharacter(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrEmpty(ctx.id ?? src.id ?? "");
  const campaignId = trimOrEmpty(src.campaignId ?? ctx.campaignId ?? "");
  const type =
    src.type === undefined || src.type === null
      ? CHARACTER_TYPES.PC
      : trimOrEmpty(src.type);

  const ownerId = trimOrEmpty(src.ownerId ?? ctx.ownerId ?? "");

  let folderId = null;
  if (src.folderId !== undefined && src.folderId !== null) {
    folderId =
      typeof src.folderId === "string"
        ? trimOrNull(src.folderId)
        : src.folderId;
  }

  let visibleTo;
  let editableBy;
  if (src.visibleTo === undefined && src.editableBy === undefined) {
    const computed = computeAudience({ ownerId });
    visibleTo = computed.visibleTo;
    editableBy = computed.editableBy;
  } else {
    visibleTo = cleanStringList(src.visibleTo);
    editableBy = cleanStringList(src.editableBy);
  }

  const name =
    src.name === undefined || src.name === null
      ? DEFAULT_NAMES.character
      : typeof src.name === "string"
        ? src.name.trim()
        : "";

  const cardColor =
    src.cardColor === undefined || src.cardColor === null
      ? DEFAULT_COLORS.characterCard
      : typeof src.cardColor === "string"
        ? src.cardColor.trim()
        : "";

  const rawToken = isPlainRecord(src.token) ? src.token : {};
  const token = {
    image: normalizeImageRef(rawToken.image),
    sizeInCells: resolveNumberPreservingInvalid(rawToken.sizeInCells, 1),
    showName: rawToken.showName !== false
  };

  const rollGroups = normalizeRollGroups(src.rollGroups, ctx.skillIdToKey ?? null);

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
    ownerId,
    folderId,
    visibleTo,
    editableBy,
    name,
    cardColor,
    level: resolveNumberPreservingInvalid(src.level, 1),
    xp: resolveNumberPreservingInvalid(src.xp, 0),
    coins: resolveNumberPreservingInvalid(src.coins, 0),
    defense: resolveNumberPreservingInvalid(src.defense, DEFAULT_CHARACTER_DEFENSE),
    movementBudgetMeters: resolveNumberPreservingInvalid(
      src.movementBudgetMeters,
      DEFAULT_MOVEMENT_BUDGET_METERS
    ),
    avatar: normalizeImageRef(src.avatar),
    token,
    resources: normalizeResources(src.resources),
    attributes: normalizeCharacterAttributes(src.attributes),
    skills: normalizeCharacterSkills(src.skills, {
      legacyMode: Boolean(ctx.legacyMode)
    }),
    abilities: normalizeAbilities(src.abilities),
    inventory: normalizeInventory(src.inventory),
    rollGroups,
    hotbar: normalizeHotbar(src.hotbar, rollGroups, {
      resolveLegacy: Boolean(ctx.legacyMode)
    }),
    biography: typeof src.biography === "string" ? src.biography : "",
    notes: typeof src.notes === "string" ? src.notes : "",
    rev: resolveNumberPreservingInvalid(src.rev, 0),
    recentOps: normalizeRecentOps(src.recentOps),
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

function validateSavingThrowField(st, fieldPrefix, attributes, skills, errors) {
  if (!isPlainRecord(st)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldPrefix} must be a plain object.`,
        { field: fieldPrefix }
      )
    );
    return;
  }
  if (Object.hasOwn(st, "attribute")) {
    errors.push(
      new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `${fieldPrefix}.attribute is a legacy field; use attributeKey.`,
        { field: `${fieldPrefix}.attribute` }
      )
    );
  }
  if (typeof st.enabled !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldPrefix}.enabled must be a boolean.`,
        { field: `${fieldPrefix}.enabled` }
      )
    );
  }
  if (typeof st.dcFormula !== "string") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldPrefix}.dcFormula must be a string.`,
        { field: `${fieldPrefix}.dcFormula` }
      )
    );
  } else if (st.enabled === true && st.dcFormula.trim().length === 0) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        `${fieldPrefix}.dcFormula must be non-empty when savingThrow is enabled.`,
        { field: `${fieldPrefix}.dcFormula` }
      )
    );
  }
  if (!isTrimmedNonEmpty(st.attributeKey)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        `${fieldPrefix}.attributeKey must be a trimmed non-empty string.`,
        { field: `${fieldPrefix}.attributeKey` }
      )
    );
  } else {
    const knownKey =
      VALID_SAVE_ATTR_IDS.has(st.attributeKey) ||
      (isPlainRecord(attributes) && Object.hasOwn(attributes, st.attributeKey)) ||
      (isPlainRecord(skills) && Object.hasOwn(skills, st.attributeKey));
    if (!knownKey) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_ENUM_VALUE,
          `${fieldPrefix}.attributeKey "${st.attributeKey}" is not a valid save attribute.`,
          { field: `${fieldPrefix}.attributeKey`, value: st.attributeKey }
        )
      );
    }
  }
  if (typeof st.effectDescription !== "string") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldPrefix}.effectDescription must be a string.`,
        { field: `${fieldPrefix}.effectDescription` }
      )
    );
  }
}

export function validateCharacter(entity) {
  const errors = [];

  if (!isPlainRecord(entity)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character must be a non-null plain object.",
        { field: "character" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(entity.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Character id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Character campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!VALID_CHARACTER_TYPES.has(entity.type)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Character type "${String(entity.type)}" is invalid.`,
        { field: "type", value: entity.type }
      )
    );
  }

  const audienceRes = assertAudience(entity, { entityType: "character" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  if (entity.folderId !== null) {
    if (!isTrimmedNonEmpty(entity.folderId)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Character folderId must be null or a trimmed non-empty string.",
          { field: "folderId" }
        )
      );
    } else if (entity.folderId.includes("/")) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          'Character folderId must not contain "/".',
          { field: "folderId" }
        )
      );
    }
  }

  if (!isTrimmedNonEmpty(entity.name)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Character name must be a trimmed non-empty string.",
        { field: "name" }
      )
    );
  }

  if (!isTrimmedNonEmpty(entity.cardColor)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Character cardColor must be a trimmed non-empty string.",
        { field: "cardColor" }
      )
    );
  }

  if (typeof entity.level !== "number" || !Number.isInteger(entity.level) || entity.level < 1) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Character level must be an integer >= 1.",
        { field: "level", value: entity.level }
      )
    );
  }

  for (const numField of ["xp", "coins", "defense", "movementBudgetMeters"]) {
    const val = entity[numField];
    if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `Character ${numField} must be a finite number >= 0.`,
          { field: numField, value: val }
        )
      );
    }
  }

  if (typeof entity.rev !== "number" || !Number.isInteger(entity.rev) || entity.rev < 0) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Character rev must be a non-negative integer.",
        { field: "rev", value: entity.rev }
      )
    );
  }

  const avatarRes = validateImageRef(entity.avatar, { fieldName: "avatar" });
  if (!avatarRes.ok) {
    errors.push(...avatarRes.errors);
  }

  if (!isPlainRecord(entity.token)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character token must be a plain object.",
        { field: "token" }
      )
    );
  } else {
    const tokenImgRes = validateImageRef(entity.token.image, {
      fieldName: "token.image"
    });
    if (!tokenImgRes.ok) {
      errors.push(...tokenImgRes.errors);
    }
    if (
      typeof entity.token.sizeInCells !== "number" ||
      !Number.isFinite(entity.token.sizeInCells) ||
      entity.token.sizeInCells < 1 ||
      entity.token.sizeInCells > 8
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Character token.sizeInCells must be between 1 and 8.",
          { field: "token.sizeInCells", value: entity.token.sizeInCells }
        )
      );
    }
    if (typeof entity.token.showName !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Character token.showName must be a boolean.",
          { field: "token.showName" }
        )
      );
    }
  }

  if (!isPlainRecord(entity.resources)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character resources must be a plain object.",
        { field: "resources" }
      )
    );
  } else {
    for (const resKey of ["hp", "mp"]) {
      const pool = entity.resources[resKey];
      if (!isPlainRecord(pool)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Character resources.${resKey} must be a plain object.`,
            { field: `resources.${resKey}` }
          )
        );
      } else {
        for (const sub of ["current", "max"]) {
          if (
            typeof pool[sub] !== "number" ||
            !Number.isFinite(pool[sub]) ||
            pool[sub] < 0
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.OUT_OF_RANGE,
                `Character resources.${resKey}.${sub} must be a finite number >= 0.`,
                { field: `resources.${resKey}.${sub}`, value: pool[sub] }
              )
            );
          }
        }
      }
    }
  }

  // §6.3.6 Formula Key Invariants across attributes & skills
  const attrKeys = new Set();
  if (!isPlainRecord(entity.attributes)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character attributes must be a plain object map.",
        { field: "attributes" }
      )
    );
  } else {
    for (const mapKey of Object.keys(entity.attributes)) {
      if (UNSAFE_KEYS.has(mapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Unsafe attribute key "${mapKey}" is forbidden.`,
            { field: "attributes", key: mapKey }
          )
        );
        continue;
      }
      const attr = entity.attributes[mapKey];
      if (!isPlainRecord(attr)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Attribute "${mapKey}" must be a plain object.`,
            { field: `attributes.${mapKey}` }
          )
        );
        continue;
      }
      if (
        !isTrimmedNonEmpty(mapKey) ||
        !FORMULA_KEY_PATTERN.test(mapKey) ||
        attr.key !== mapKey
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Attribute key "${mapKey}" must be lowercase alphanumeric/underscore and match entry.key.`,
            { field: `attributes.${mapKey}.key` }
          )
        );
      } else if (RESERVED_KEY_SET.has(mapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.RESERVED_KEY,
            `Attribute key "${mapKey}" is a reserved formula key.`,
            { field: `attributes.${mapKey}.key`, key: mapKey }
          )
        );
      } else {
        attrKeys.add(mapKey);
      }
      if (typeof attr.value !== "number" || !Number.isFinite(attr.value)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Attribute "${mapKey}" value must be a finite number.`,
            { field: `attributes.${mapKey}.value` }
          )
        );
      }
    }
  }

  if (!isPlainRecord(entity.skills)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character skills must be a plain object map.",
        { field: "skills" }
      )
    );
  } else {
    for (const mapKey of Object.keys(entity.skills)) {
      if (UNSAFE_KEYS.has(mapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Unsafe skill key "${mapKey}" is forbidden.`,
            { field: "skills", key: mapKey }
          )
        );
        continue;
      }
      const skill = entity.skills[mapKey];
      if (!isPlainRecord(skill)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Skill "${mapKey}" must be a plain object.`,
            { field: `skills.${mapKey}` }
          )
        );
        continue;
      }
      if (
        !isTrimmedNonEmpty(mapKey) ||
        !FORMULA_KEY_PATTERN.test(mapKey) ||
        skill.key !== mapKey
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Skill key "${mapKey}" must be lowercase alphanumeric/underscore and match entry.key.`,
            { field: `skills.${mapKey}.key` }
          )
        );
      } else if (RESERVED_KEY_SET.has(mapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.RESERVED_KEY,
            `Skill key "${mapKey}" is a reserved formula key.`,
            { field: `skills.${mapKey}.key`, key: mapKey }
          )
        );
      } else if (attrKeys.has(mapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.KEY_COLLISION,
            `Skill key "${mapKey}" collides with an attribute key.`,
            { field: `skills.${mapKey}.key`, key: mapKey }
          )
        );
      }
      if (!isTrimmedNonEmpty(skill.attributeKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            `Skill "${mapKey}" attributeKey must be a trimmed non-empty string.`,
            { field: `skills.${mapKey}.attributeKey` }
          )
        );
      }
      if (typeof skill.bonus !== "number" || !Number.isFinite(skill.bonus)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Skill "${mapKey}" bonus must be a finite number.`,
            { field: `skills.${mapKey}.bonus` }
          )
        );
      }
    }
  }

  if (!isPlainRecord(entity.abilities)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character abilities must be a plain object map.",
        { field: "abilities" }
      )
    );
  } else {
    for (const mapKey of Object.keys(entity.abilities)) {
      if (UNSAFE_KEYS.has(mapKey)) {
        errors.push(
          new AppError(ERROR_CODES.INVALID_TYPE, "Unsafe ability key.", {
            field: "abilities",
            key: mapKey
          })
        );
        continue;
      }
      const ab = entity.abilities[mapKey];
      if (!isPlainRecord(ab) || ab.id !== mapKey || !isTrimmedNonEmpty(ab.id)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Ability "${mapKey}" must be a plain object with matching id.`,
            { field: `abilities.${mapKey}` }
          )
        );
        continue;
      }
      if (!VALID_TRIGGER_TYPES.has(ab.trigger)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Ability "${mapKey}" trigger is invalid.`,
            { field: `abilities.${mapKey}.trigger`, value: ab.trigger }
          )
        );
      }
      if (!VALID_EFFECT_TYPES.has(ab.effectType)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Ability "${mapKey}" effectType is invalid.`,
            { field: `abilities.${mapKey}.effectType`, value: ab.effectType }
          )
        );
      }
      if (ab.rollKind !== null && !VALID_ROLL_KINDS.has(ab.rollKind)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Ability "${mapKey}" rollKind is invalid.`,
            { field: `abilities.${mapKey}.rollKind`, value: ab.rollKind }
          )
        );
      }
      if (
        !isPlainRecord(ab.cost) ||
        !VALID_RESOURCE_KEYS.has(ab.cost.resource) ||
        typeof ab.cost.amount !== "number" ||
        !Number.isFinite(ab.cost.amount) ||
        ab.cost.amount < 0
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.OUT_OF_RANGE,
            `Ability "${mapKey}" cost is invalid.`,
            { field: `abilities.${mapKey}.cost` }
          )
        );
      }
      validateSavingThrowField(
        ab.savingThrow,
        `abilities.${mapKey}.savingThrow`,
        entity.attributes,
        entity.skills,
        errors
      );
    }
  }

  if (!isPlainRecord(entity.inventory)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character inventory must be a plain object map.",
        { field: "inventory" }
      )
    );
  } else {
    for (const mapKey of Object.keys(entity.inventory)) {
      if (UNSAFE_KEYS.has(mapKey)) {
        errors.push(
          new AppError(ERROR_CODES.INVALID_TYPE, "Unsafe inventory key.", {
            field: "inventory",
            key: mapKey
          })
        );
        continue;
      }
      const item = entity.inventory[mapKey];
      if (!isPlainRecord(item) || item.id !== mapKey || !isTrimmedNonEmpty(item.id)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `Inventory item "${mapKey}" must be a plain object with matching id.`,
            { field: `inventory.${mapKey}` }
          )
        );
        continue;
      }
      if (
        typeof item.qty !== "number" ||
        !Number.isFinite(item.qty) ||
        item.qty < 0
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.OUT_OF_RANGE,
            `Inventory item "${mapKey}" qty must be >= 0.`,
            { field: `inventory.${mapKey}.qty`, value: item.qty }
          )
        );
      }
      if (!VALID_TRIGGER_TYPES.has(item.trigger)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Inventory item "${mapKey}" trigger is invalid.`,
            { field: `inventory.${mapKey}.trigger`, value: item.trigger }
          )
        );
      }
      if (!VALID_EFFECT_TYPES.has(item.effectType)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Inventory item "${mapKey}" effectType is invalid.`,
            { field: `inventory.${mapKey}.effectType`, value: item.effectType }
          )
        );
      }
      if (item.rollKind !== null && !VALID_ROLL_KINDS.has(item.rollKind)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Inventory item "${mapKey}" rollKind is invalid.`,
            { field: `inventory.${mapKey}.rollKind`, value: item.rollKind }
          )
        );
      }
      validateSavingThrowField(
        item.savingThrow,
        `inventory.${mapKey}.savingThrow`,
        entity.attributes,
        entity.skills,
        errors
      );
    }
  }

  if (!isPlainRecord(entity.rollGroups)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character rollGroups must be a plain object map.",
        { field: "rollGroups" }
      )
    );
  } else {
    for (const grpKey of Object.keys(entity.rollGroups)) {
      if (UNSAFE_KEYS.has(grpKey)) {
        errors.push(
          new AppError(ERROR_CODES.INVALID_TYPE, "Unsafe rollGroup key.", {
            field: "rollGroups",
            key: grpKey
          })
        );
        continue;
      }
      const grp = entity.rollGroups[grpKey];
      if (!isPlainRecord(grp) || grp.id !== grpKey || !isTrimmedNonEmpty(grp.id)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_REFERENCE,
            `RollGroup "${grpKey}" must be a plain object with matching id.`,
            { field: `rollGroups.${grpKey}` }
          )
        );
        continue;
      }
      if (!isPlainRecord(grp.rolls)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `RollGroup "${grpKey}" rolls must be a plain object map.`,
            { field: `rollGroups.${grpKey}.rolls` }
          )
        );
        continue;
      }
      for (const rollKey of Object.keys(grp.rolls)) {
        if (UNSAFE_KEYS.has(rollKey)) {
          errors.push(
            new AppError(ERROR_CODES.INVALID_TYPE, "Unsafe roll key.", {
              field: `rollGroups.${grpKey}.rolls`,
              key: rollKey
            })
          );
          continue;
        }
        const roll = grp.rolls[rollKey];
        if (!isPlainRecord(roll) || roll.id !== rollKey || !isTrimmedNonEmpty(roll.id)) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_REFERENCE,
              `Roll "${rollKey}" in group "${grpKey}" must have matching id.`,
              { field: `rollGroups.${grpKey}.rolls.${rollKey}` }
            )
          );
          continue;
        }
        if (
          !isPlainRecord(roll.source) ||
          !VALID_ROLL_SOURCE_TYPES.has(roll.source.type)
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_ENUM_VALUE,
              `Roll "${rollKey}" source.type is invalid.`,
              { field: `rollGroups.${grpKey}.rolls.${rollKey}.source.type` }
            )
          );
        } else if (roll.source.type === ROLL_SOURCE_TYPES.CUSTOM) {
          if (!isPlainRecord(roll.custom)) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                `Custom roll "${rollKey}" requires a custom payload object.`,
                { field: `rollGroups.${grpKey}.rolls.${rollKey}.custom` }
              )
            );
          } else {
            if (!VALID_ROLL_KINDS.has(roll.custom.rollKind)) {
              errors.push(
                new AppError(
                  ERROR_CODES.INVALID_ENUM_VALUE,
                  `Custom roll "${rollKey}" rollKind is invalid.`,
                  { field: `rollGroups.${grpKey}.rolls.${rollKey}.custom.rollKind` }
                )
              );
            }
            if (!VALID_EFFECT_TYPES.has(roll.custom.effectType)) {
              errors.push(
                new AppError(
                  ERROR_CODES.INVALID_ENUM_VALUE,
                  `Custom roll "${rollKey}" effectType is invalid.`,
                  { field: `rollGroups.${grpKey}.rolls.${rollKey}.custom.effectType` }
                )
              );
            }
            if (
              !isPlainRecord(roll.custom.cost) ||
              !VALID_RESOURCE_KEYS.has(roll.custom.cost.resource) ||
              typeof roll.custom.cost.amount !== "number" ||
              !Number.isFinite(roll.custom.cost.amount) ||
              roll.custom.cost.amount < 0
            ) {
              errors.push(
                new AppError(
                  ERROR_CODES.OUT_OF_RANGE,
                  `Custom roll "${rollKey}" cost is invalid.`,
                  { field: `rollGroups.${grpKey}.rolls.${rollKey}.custom.cost` }
                )
              );
            }
            validateSavingThrowField(
              roll.custom.savingThrow,
              `rollGroups.${grpKey}.rolls.${rollKey}.custom.savingThrow`,
              entity.attributes,
              entity.skills,
              errors
            );
          }
        }
      }
    }
  }

  if (!isPlainRecord(entity.hotbar)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character hotbar must be a plain object.",
        { field: "hotbar" }
      )
    );
  } else {
    const keys = Object.keys(entity.hotbar);
    if (
      keys.length !== HOTBAR_KEYS.length ||
      !HOTBAR_KEYS.every((k) => Object.hasOwn(entity.hotbar, k))
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Character hotbar must have exact keys "1".."9".',
          { field: "hotbar" }
        )
      );
    } else {
      for (const slotKey of HOTBAR_KEYS) {
        const slot = entity.hotbar[slotKey];
        if (slot !== null) {
          if (
            !isPlainRecord(slot) ||
            !isTrimmedNonEmpty(slot.rollGroupId) ||
            !isTrimmedNonEmpty(slot.rollId)
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                `Hotbar slot "${slotKey}" must be null or { rollGroupId, rollId }.`,
                { field: `hotbar.${slotKey}` }
              )
            );
          } else if (
            !isPlainRecord(entity.rollGroups) ||
            !Object.hasOwn(entity.rollGroups, slot.rollGroupId) ||
            !isPlainRecord(entity.rollGroups[slot.rollGroupId]?.rolls) ||
            !Object.hasOwn(entity.rollGroups[slot.rollGroupId].rolls, slot.rollId)
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_REFERENCE,
                `Hotbar slot "${slotKey}" references missing roll "${slot.rollGroupId}.${slot.rollId}".`,
                { field: `hotbar.${slotKey}` }
              )
            );
          }
        }
      }
    }
  }

  if (!isPlainRecord(entity.recentOps)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Character recentOps must be a plain object.",
        { field: "recentOps" }
      )
    );
  } else {
    const opKeys = Object.keys(entity.recentOps);
    if (opKeys.length > RECENT_OPS_LIMIT) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `Character recentOps exceeds limit of ${RECENT_OPS_LIMIT}.`,
          { field: "recentOps", count: opKeys.length }
        )
      );
    }
    for (const opKey of opKeys) {
      if (UNSAFE_KEYS.has(opKey) || !isTrimmedNonEmpty(opKey)) {
        errors.push(
          new AppError(ERROR_CODES.INVALID_TYPE, "Invalid recentOps key.", {
            field: "recentOps",
            key: opKey
          })
        );
        continue;
      }
      const ts = entity.recentOps[opKey];
      if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 0) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `recentOps["${opKey}"] must be a finite non-negative number.`,
            { field: `recentOps.${opKey}` }
          )
        );
      }
    }
  }

  for (const legacyKey of LEGACY_CHARACTER_KEYS) {
    if (Object.hasOwn(entity, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy character field "${legacyKey}" is not allowed in v2.`,
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
  const resolvedId = id ?? ctx.id ?? src.id ?? "";

  const skillIdToKey = {};
  if (Array.isArray(src.skills)) {
    for (const entry of src.skills) {
      if (isPlainRecord(entry) && typeof entry.id === "string" && entry.id.trim()) {
        const normKey = normalizeFormulaKey(
          entry.key || entry.name || entry.id
        );
        if (normKey) {
          skillIdToKey[entry.id.trim()] = normKey;
        }
      }
    }
  }

  const avatar = isPlainRecord(src.avatar)
    ? fromImageRefDoc(src.avatar)
    : fromImageRefDoc({
        mediaId: src.avatarMediaId,
        externalUrl: src.avatarExternalUrl
      });

  const rawToken = isPlainRecord(src.token)
    ? src.token
    : isPlainRecord(src.defaultToken)
      ? src.defaultToken
      : {};

  const tokenImage = isPlainRecord(rawToken.image)
    ? fromImageRefDoc(rawToken.image)
    : fromImageRefDoc({
        mediaId: rawToken.mediaId,
        externalUrl: rawToken.externalUrl
      });

  return normalizeCharacter(
    {
      ...src,
      avatar,
      token: {
        image: tokenImage,
        sizeInCells: rawToken.sizeInCells ?? 1,
        showName: rawToken.showName !== false
      }
    },
    {
      ...ctx,
      id: resolvedId,
      skillIdToKey,
      legacyMode: true
    }
  );
}

export function toDoc(entity) {
  const normalized = normalizeCharacter(entity);
  return {
    campaignId: normalized.campaignId,
    type: normalized.type,
    ownerId: normalized.ownerId,
    folderId: normalized.folderId,
    visibleTo: normalized.visibleTo,
    editableBy: normalized.editableBy,
    name: normalized.name,
    cardColor: normalized.cardColor,
    level: normalized.level,
    xp: normalized.xp,
    coins: normalized.coins,
    defense: normalized.defense,
    movementBudgetMeters: normalized.movementBudgetMeters,
    avatar: toImageRefDoc(normalized.avatar),
    token: {
      image: toImageRefDoc(normalized.token.image),
      sizeInCells: normalized.token.sizeInCells,
      showName: normalized.token.showName
    },
    resources: normalized.resources,
    attributes: normalized.attributes,
    skills: normalized.skills,
    abilities: normalized.abilities,
    inventory: normalized.inventory,
    rollGroups: normalized.rollGroups,
    hotbar: normalized.hotbar,
    biography: normalized.biography,
    notes: normalized.notes,
    rev: normalized.rev,
    recentOps: normalized.recentOps,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
}

export { toDoc as toCharacterDoc, fromDoc as fromCharacterDoc };
