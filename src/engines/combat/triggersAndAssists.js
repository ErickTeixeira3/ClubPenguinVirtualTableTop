import {
  EFFECT_TYPES,
  ROLL_SOURCE_TYPES,
  TRIGGER_TYPES
} from "../../domain/constants.js";
import { applyD20ModeToFormula } from "../rolls/index.js";

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

function toOrderedEntries(collection) {
  if (Array.isArray(collection)) {
    return collection.map((entry) => ({ entry, fallbackId: null }));
  }
  if (collection && typeof collection === "object") {
    return Object.entries(collection)
      .filter(
        ([key, val]) =>
          !UNSAFE_KEYS.has(key) &&
          val &&
          typeof val === "object" &&
          !Array.isArray(val)
      )
      .sort(([, a], [, b]) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map(([key, entry]) => ({ entry, fallbackId: key }));
  }
  return [];
}

export function normalizeCombatEntry(entry, sourceType, options = {}) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const srcOpts = options && typeof options === "object" ? options : {};
  const mode = srcOpts.mode ?? "trigger";
  const fallbackId = srcOpts.fallbackId ?? null;

  const id = entry.id || fallbackId;
  if (!id) {
    return null;
  }

  const isAbility = sourceType === ROLL_SOURCE_TYPES.ABILITY;
  const formula = isAbility
    ? mode === "assist"
      ? String(
          entry.effectFormula ||
            entry.hitFormula ||
            entry.secondaryFormula ||
            entry.formula ||
            ""
        ).trim()
      : String(
          entry.effectFormula || entry.secondaryFormula || entry.formula || ""
        ).trim()
    : String(
        entry.rollFormula ||
          entry.effectFormula ||
          entry.secondaryFormula ||
          entry.formula ||
          ""
      ).trim();

  const costResource = entry.cost?.resource || "mp";
  const rawAmount = Number(entry.cost?.amount ?? entry.costMp ?? 0);
  const costAmount =
    Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;

  const costMp = isAbility
    ? costResource === "mp"
      ? costAmount
      : Math.max(0, Number(entry.costMp) || 0)
    : 0;
  const costHp = isAbility
    ? costResource === "hp"
      ? costAmount
      : Math.max(0, Number(entry.costHp) || 0)
    : 0;

  const rawQty = Number(entry.qty ?? entry.quantity ?? 1);
  const qty = Number.isFinite(rawQty) ? Math.max(0, rawQty) : 0;

  return {
    uid: `${isAbility ? "ab" : "it"}_${id}`,
    id,
    sourceType,
    name: entry.name || (isAbility ? "Habilidade" : "Item"),
    icon:
      entry.icon ||
      (isAbility ? (mode === "assist" ? "shield" : "sword") : "potion_red"),
    trigger: entry.trigger || TRIGGER_TYPES.ACTIVE,
    formula,
    effectType: entry.effectType || EFFECT_TYPES.DAMAGE,
    savingThrow:
      entry.savingThrow && typeof entry.savingThrow === "object"
        ? entry.savingThrow
        : null,
    cost: isAbility
      ? { resource: costResource, amount: costAmount }
      : { resource: "mp", amount: 0 },
    costResource: isAbility ? costResource : "mp",
    costAmount: isAbility ? costAmount : 0,
    costMp,
    costHp,
    qty: isAbility ? null : qty,
    consumeOnUse: isAbility ? false : Boolean(entry.consumeOnUse),
    order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : 0
  };
}

export function collectCombatTriggers(character, options = {}) {
  if (!character || typeof character !== "object") {
    return [];
  }
  const srcOpts = options && typeof options === "object" ? options : {};
  const includeAll = Boolean(srcOpts.includeAll);

  const entries = [];
  for (const { entry, fallbackId } of toOrderedEntries(character.abilities)) {
    const normalized = normalizeCombatEntry(entry, ROLL_SOURCE_TYPES.ABILITY, {
      mode: "trigger",
      fallbackId
    });
    if (!normalized) {
      continue;
    }
    const isHitTrigger =
      normalized.trigger === TRIGGER_TYPES.ON_HIT ||
      normalized.trigger === TRIGGER_TYPES.ON_CRIT;
    if (!includeAll && !isHitTrigger) {
      continue;
    }
    entries.push(normalized);
  }

  for (const { entry, fallbackId } of toOrderedEntries(character.inventory)) {
    const normalized = normalizeCombatEntry(entry, ROLL_SOURCE_TYPES.ITEM, {
      mode: "trigger",
      fallbackId
    });
    if (!normalized) {
      continue;
    }
    const isHitTrigger =
      normalized.trigger === TRIGGER_TYPES.ON_HIT ||
      normalized.trigger === TRIGGER_TYPES.ON_CRIT;
    if (!includeAll && !isHitTrigger) {
      continue;
    }
    if (!normalized.formula && !normalized.savingThrow?.enabled && !isHitTrigger) {
      continue;
    }
    entries.push(normalized);
  }

  return entries;
}

export function collectSavingThrowAssists(character) {
  if (!character || typeof character !== "object") {
    return [];
  }

  const entries = [];
  for (const { entry, fallbackId } of toOrderedEntries(character.abilities)) {
    const normalized = normalizeCombatEntry(entry, ROLL_SOURCE_TYPES.ABILITY, {
      mode: "assist",
      fallbackId
    });
    if (normalized) {
      entries.push(normalized);
    }
  }

  for (const { entry, fallbackId } of toOrderedEntries(character.inventory)) {
    const normalized = normalizeCombatEntry(entry, ROLL_SOURCE_TYPES.ITEM, {
      mode: "assist",
      fallbackId
    });
    if (normalized) {
      entries.push(normalized);
    }
  }

  return entries;
}

export function composeSavingThrowFormula(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const baseAttr = String(src.baseAttributeFormula ?? "").trim();
  const rollMode = src.rollMode ?? "normal";
  const extraBonus = String(src.extraBonus ?? "").trim();
  const selectedAssists = Array.isArray(src.selectedAssists)
    ? src.selectedAssists
    : [];

  const base = baseAttr ? `1d20 + ${baseAttr}` : "1d20";
  const assistFormulas = selectedAssists
    .map((assist) => {
      if (typeof assist === "string") {
        return assist.trim();
      }
      if (assist && typeof assist === "object") {
        return String(assist.formula ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);

  const combinedExtra = [extraBonus, ...assistFormulas]
    .filter(Boolean)
    .join(" + ");

  return applyD20ModeToFormula(base, rollMode, combinedExtra);
}

export function summarizeCombatEntryCosts(entries = []) {
  if (!Array.isArray(entries)) {
    return { mp: 0, hp: 0, itemsToConsume: [] };
  }

  let mp = 0;
  let hp = 0;
  const itemsToConsume = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const costAmount = Number(entry.cost?.amount);
    if (entry.cost?.resource === "hp" && Number.isFinite(costAmount) && costAmount > 0) {
      hp += costAmount;
    } else if (
      entry.cost?.resource === "mp" &&
      Number.isFinite(costAmount) &&
      costAmount > 0
    ) {
      mp += costAmount;
    } else {
      const legacyMp = Number(entry.costMp);
      const legacyHp = Number(entry.costHp);
      if (Number.isFinite(legacyMp) && legacyMp > 0) {
        mp += legacyMp;
      }
      if (Number.isFinite(legacyHp) && legacyHp > 0) {
        hp += legacyHp;
      }
    }

    if (
      entry.sourceType === ROLL_SOURCE_TYPES.ITEM &&
      entry.consumeOnUse &&
      entry.id
    ) {
      itemsToConsume.push({ itemId: entry.id, qty: 1 });
    }
  }

  return { mp, hp, itemsToConsume };
}
