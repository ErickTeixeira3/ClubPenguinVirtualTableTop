import {
  EFFECT_TYPES,
  RESOURCE_KEYS,
  ROLL_KINDS,
  ROLL_SOURCE_TYPES,
  TRIGGER_TYPES
} from "../../domain/constants.js";
import {
  DEFAULT_ABILITY_COST,
  DEFAULT_COLORS,
  DEFAULT_NAMES
} from "../../domain/defaults.js";
import {
  classifyRollKind,
  effectRollKind,
  inferAbilityRollKind
} from "./rollClassifier.js";

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

const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));

function asMap(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function trimNonEmpty(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMapEntry(map, id) {
  if (!map || typeof id !== "string") {
    return null;
  }
  const cleanId = id.trim();
  if (!cleanId || UNSAFE_KEYS.has(cleanId) || !Object.hasOwn(map, cleanId)) {
    return null;
  }
  return map[cleanId] ?? null;
}

function normalizeCost(rawCost) {
  const src = asMap(rawCost);
  const amountNum = Number(src?.amount);
  return {
    resource: trimNonEmpty(src?.resource) || DEFAULT_ABILITY_COST.resource,
    amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : 0
  };
}

function buildOverridesObject(overrideName, overrideIcon, overrideColor) {
  const result = {};
  if (overrideName) result.name = overrideName;
  if (overrideIcon) result.icon = overrideIcon;
  if (overrideColor) result.color = overrideColor;
  return result;
}

export function buildSkillFormula(skill) {
  const src = skill && typeof skill === "object" ? skill : {};
  const attrKey = trimNonEmpty(src.attributeKey) || "forca";
  const rawBonus = Number(src.bonus);
  const bonus = Number.isFinite(rawBonus) ? rawBonus : 0;

  if (bonus > 0) {
    return `1d20 + @${attrKey} + ${bonus}`;
  }
  if (bonus < 0) {
    return `1d20 + @${attrKey} - ${Math.abs(bonus)}`;
  }
  return `1d20 + @${attrKey}`;
}

export function resolveDynamicRollEntry(entry, character) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const entryId = trimNonEmpty(entry.id);
  const orderNum = Number(entry.order);
  const order = Number.isFinite(orderNum) ? orderNum : 0;

  const source = asMap(entry.source);
  const sourceType = trimNonEmpty(source?.type) || ROLL_SOURCE_TYPES.CUSTOM;
  const sourceId = trimNonEmpty(source?.id);

  const overridesSrc = asMap(entry.overrides) || {};
  const overrideName = trimNonEmpty(overridesSrc.name);
  const overrideIcon = trimNonEmpty(overridesSrc.icon);
  const overrideColor = trimNonEmpty(overridesSrc.color);
  const overrides = buildOverridesObject(
    overrideName,
    overrideIcon,
    overrideColor
  );

  const custom = asMap(entry.custom) || {};
  const charObj = asMap(character);

  if (sourceType === ROLL_SOURCE_TYPES.ABILITY) {
    const ab = getMapEntry(asMap(charObj?.abilities), sourceId);
    if (ab && typeof ab === "object") {
      const hitFormula = ab.hitFormula || "";
      const effectFormula = ab.effectFormula || "";
      const effectType =
        ab.effectType || (effectFormula ? EFFECT_TYPES.DAMAGE : null);
      const rollKind = VALID_ROLL_KINDS.has(ab.rollKind)
        ? ab.rollKind
        : inferAbilityRollKind({ hitFormula, effectFormula, effectType });

      return {
        id: entryId,
        order,
        source: { type: sourceType, id: sourceId },
        overrides,
        name: overrideName || trimNonEmpty(ab.name) || DEFAULT_NAMES.roll,
        color:
          overrideColor ||
          trimNonEmpty(ab.elementColor) ||
          DEFAULT_COLORS.abilityElement,
        icon: overrideIcon || trimNonEmpty(ab.icon) || "sword",
        description: ab.description || "",
        hitFormula,
        effectFormula,
        effectType,
        rollKind,
        cost: normalizeCost(ab.cost),
        savingThrow: ab.savingThrow || null,
        range: ab.range || null,
        aoe: ab.aoe || null,
        trigger: ab.trigger || TRIGGER_TYPES.ACTIVE,
        isLinkedMissing: false
      };
    }
  } else if (sourceType === ROLL_SOURCE_TYPES.SKILL) {
    const sk = getMapEntry(asMap(charObj?.skills), sourceId);
    if (sk && typeof sk === "object") {
      const attrKey = trimNonEmpty(sk.attributeKey) || "forca";
      const rawBonus = Number(sk.bonus);
      const bonus = Number.isFinite(rawBonus) ? rawBonus : 0;

      return {
        id: entryId,
        order,
        source: { type: sourceType, id: sourceId },
        overrides,
        name: overrideName || trimNonEmpty(sk.name) || DEFAULT_NAMES.roll,
        color: overrideColor || DEFAULT_COLORS.attributeRoll,
        icon: overrideIcon || trimNonEmpty(sk.icon) || "clover",
        description: `Perícia (${attrKey} ${bonus >= 0 ? `+${bonus}` : bonus})`,
        hitFormula: buildSkillFormula(sk),
        effectFormula: "",
        effectType: null,
        rollKind: ROLL_KINDS.CHECK,
        cost: { resource: RESOURCE_KEYS.MP, amount: 0 },
        savingThrow: null,
        range: null,
        aoe: null,
        trigger: null,
        isLinkedMissing: false
      };
    }
  } else if (sourceType === ROLL_SOURCE_TYPES.ITEM) {
    const item = getMapEntry(asMap(charObj?.inventory), sourceId);
    if (item && typeof item === "object") {
      const hitFormula = item.rollFormula || "";
      const effectType = item.effectType || EFFECT_TYPES.HEAL;
      const rollKind = VALID_ROLL_KINDS.has(item.rollKind)
        ? item.rollKind
        : effectRollKind(effectType);

      return {
        id: entryId,
        order,
        source: { type: sourceType, id: sourceId },
        overrides,
        name: overrideName || trimNonEmpty(item.name) || DEFAULT_NAMES.roll,
        color:
          overrideColor ||
          trimNonEmpty(item.elementColor) ||
          DEFAULT_COLORS.itemElement,
        icon: overrideIcon || trimNonEmpty(item.icon) || "sword",
        description: item.description || "",
        hitFormula,
        effectFormula: "",
        effectType,
        rollKind,
        cost: { resource: RESOURCE_KEYS.MP, amount: 0 },
        savingThrow: item.savingThrow || null,
        range: null,
        aoe: null,
        trigger: item.trigger || TRIGGER_TYPES.ACTIVE,
        consumeOnUse: Boolean(item.consumeOnUse),
        qty: Number.isFinite(Number(item.qty)) ? Number(item.qty) : 0,
        isLinkedMissing: false
      };
    }
  } else if (sourceType === ROLL_SOURCE_TYPES.ATTRIBUTE) {
    const attr = getMapEntry(asMap(charObj?.attributes), sourceId);
    if (attr && typeof attr === "object") {
      const attrKey = trimNonEmpty(attr.key) || sourceId;
      const attrLabel = trimNonEmpty(attr.label) || attrKey;

      return {
        id: entryId,
        order,
        source: { type: sourceType, id: sourceId },
        overrides,
        name: overrideName || `Teste ${attrLabel}`,
        color: overrideColor || DEFAULT_COLORS.attributeRoll,
        icon: overrideIcon || "clover",
        description: "",
        hitFormula: `1d20 + @${attrKey}`,
        effectFormula: "",
        effectType: null,
        rollKind: ROLL_KINDS.CHECK,
        cost: { resource: RESOURCE_KEYS.MP, amount: 0 },
        savingThrow: null,
        range: null,
        aoe: null,
        trigger: null,
        isLinkedMissing: false
      };
    }
  } else if (sourceType === ROLL_SOURCE_TYPES.CUSTOM) {
    const hitFormula = custom.hitFormula || "";
    const effectFormula = custom.effectFormula || "";
    const hasEffect = Boolean(String(effectFormula).trim());
    const effectType =
      !hasEffect && custom.effectType === EFFECT_TYPES.DAMAGE
        ? null
        : custom.effectType || (hasEffect ? EFFECT_TYPES.DAMAGE : null);
    const rollKind = classifyRollKind({
      rollKind: custom.rollKind || null,
      primaryFormula: hitFormula,
      secondaryFormula: effectFormula,
      effectType,
      deferSecondaryDamage: Boolean(String(hitFormula).trim() && hasEffect)
    });

    return {
      id: entryId,
      order,
      source: { type: ROLL_SOURCE_TYPES.CUSTOM, id: null },
      overrides,
      name: overrideName || DEFAULT_NAMES.roll,
      color: overrideColor || DEFAULT_COLORS.customRoll,
      icon: overrideIcon || "sword",
      description: custom.description || "",
      hitFormula,
      effectFormula,
      effectType,
      rollKind,
      cost: normalizeCost(custom.cost),
      savingThrow: custom.savingThrow || null,
      range: custom.range || null,
      aoe: custom.aoe || null,
      trigger: custom.trigger || TRIGGER_TYPES.ACTIVE,
      isLinkedMissing: false
    };
  }

  return {
    id: entryId,
    order,
    source: { type: sourceType, id: sourceId },
    overrides,
    name: overrideName || DEFAULT_NAMES.roll,
    color: overrideColor || DEFAULT_COLORS.customRoll,
    icon: overrideIcon || "sword",
    description: custom.description || "",
    hitFormula: custom.hitFormula || "",
    effectFormula: custom.effectFormula || "",
    effectType: custom.effectType || null,
    rollKind: VALID_ROLL_KINDS.has(custom.rollKind)
      ? custom.rollKind
      : ROLL_KINDS.CHECK,
    cost: normalizeCost(custom.cost),
    savingThrow: custom.savingThrow || null,
    range: custom.range || null,
    aoe: custom.aoe || null,
    trigger: custom.trigger || null,
    isLinkedMissing: true
  };
}

export function resolveHotbarSlot(slot, character) {
  if (!slot || typeof slot !== "object") {
    return null;
  }

  const rollGroupId = trimNonEmpty(slot.rollGroupId);
  const rollId = trimNonEmpty(slot.rollId);
  const rollGroups = asMap(character?.rollGroups);

  let found = null;
  let resolvedGroupId = rollGroupId;

  if (rollGroupId && rollId && !UNSAFE_KEYS.has(rollGroupId)) {
    const grp = getMapEntry(rollGroups, rollGroupId);
    found = getMapEntry(asMap(grp?.rolls), rollId);
  } else if (!rollGroupId && rollId && rollGroups) {
    for (const [grpId, grp] of Object.entries(rollGroups)) {
      if (UNSAFE_KEYS.has(grpId)) {
        continue;
      }
      const candidate = getMapEntry(asMap(grp?.rolls), rollId);
      if (candidate) {
        found = candidate;
        resolvedGroupId = grpId;
        break;
      }
    }
  }

  if (found && typeof found === "object") {
    const resolved = resolveDynamicRollEntry(found, character);
    return {
      ...resolved,
      id: resolved.id || rollId,
      rollGroupId: resolvedGroupId,
      rollId
    };
  }

  return {
    id: rollId,
    rollGroupId: resolvedGroupId,
    rollId,
    source: { type: ROLL_SOURCE_TYPES.CUSTOM, id: null },
    overrides: {},
    name: DEFAULT_NAMES.roll,
    color: DEFAULT_COLORS.customRoll,
    icon: "sword",
    description: "",
    hitFormula: "",
    effectFormula: "",
    effectType: null,
    rollKind: ROLL_KINDS.CHECK,
    savingThrow: null,
    range: null,
    aoe: null,
    trigger: null,
    cost: { resource: RESOURCE_KEYS.MP, amount: 0 },
    isLinkedMissing: true
  };
}

export function buildHotbarSlotFromRoll(roll, groupIdOverride = null) {
  if (!roll || typeof roll !== "object") {
    return null;
  }
  const rollGroupId =
    trimNonEmpty(groupIdOverride) || trimNonEmpty(roll.rollGroupId);
  const rollId = trimNonEmpty(roll.rollId) || trimNonEmpty(roll.id);

  if (!rollGroupId || !rollId) {
    return null;
  }

  return { rollGroupId, rollId };
}

export function buildShortcutRollParams(resolvedRoll, character = null) {
  if (!resolvedRoll || typeof resolvedRoll !== "object") {
    return null;
  }

  const cost = normalizeCost(resolvedRoll.cost);
  const hitFormula = resolvedRoll.hitFormula || "";
  const effectFormula = resolvedRoll.effectFormula || "";
  const effectType =
    resolvedRoll.effectType || (effectFormula ? EFFECT_TYPES.DAMAGE : null);
  const rollKind = VALID_ROLL_KINDS.has(resolvedRoll.rollKind)
    ? resolvedRoll.rollKind
    : inferAbilityRollKind({ hitFormula, effectFormula, effectType });

  const primaryLabel =
    rollKind === ROLL_KINDS.ATTACK
      ? "Acerto"
      : rollKind === ROLL_KINDS.SAVING_THROW
        ? "Resistência"
        : "Rolagem";

  return {
    title: resolvedRoll.name || DEFAULT_NAMES.roll,
    categoryColor: resolvedRoll.color || DEFAULT_COLORS.customRoll,
    icon: resolvedRoll.icon || "sword",
    description: resolvedRoll.description || "",
    primaryFormula: hitFormula,
    primaryLabel,
    secondaryFormula: effectFormula,
    secondaryLabel: "Efeito / Dano",
    rollKind,
    effectType,
    trigger: resolvedRoll.trigger || null,
    range: resolvedRoll.range || null,
    aoe: resolvedRoll.aoe || null,
    savingThrow: resolvedRoll.savingThrow || null,
    cost: cost.amount > 0 ? cost : null,
    character: character || null
  };
}
