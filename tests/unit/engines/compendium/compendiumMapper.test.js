import { describe, expect, it } from "vitest";
import {
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  ID_PREFIXES,
  ROLL_KINDS,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../../../src/domain/constants.js";
import { DEFAULT_COLORS, DEFAULT_NAMES } from "../../../../src/domain/defaults.js";
import { AppError, ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  mapCompendiumEntryToCharacterEntry,
  normalizeSkillKey,
  resolveUniqueSkillKey
} from "../../../../src/engines/compendium/index.js";

const makeCreateId = () => {
  let seq = 0;
  return (prefix) => {
    seq += 1;
    return `${prefix}_${seq}`;
  };
};

describe("mapCompendiumEntryToCharacterEntry validation", () => {
  it("throws AppError on non-object entry or invalid type", () => {
    for (const bad of [null, undefined, "ability", [], 42]) {
      expect(() => mapCompendiumEntryToCharacterEntry(bad)).toThrowError(AppError);
      try {
        mapCompendiumEntryToCharacterEntry(bad);
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_TYPE);
      }
    }

    expect(() =>
      mapCompendiumEntryToCharacterEntry({ type: "unknown" }, { createId: makeCreateId() })
    ).toThrowError(AppError);
    try {
      mapCompendiumEntryToCharacterEntry({ type: "unknown" });
    } catch (err) {
      expect(err.code).toBe(ERROR_CODES.INVALID_ENUM_VALUE);
    }
  });

  it("requires valid createId function for ability, spell, and item", () => {
    try {
      mapCompendiumEntryToCharacterEntry({ type: COMPENDIUM_TYPES.ABILITY, name: "Golpe" });
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ERROR_CODES.MISSING_REQUIRED_FIELD);
    }

    try {
      mapCompendiumEntryToCharacterEntry(
        { type: COMPENDIUM_TYPES.ITEM, name: "Poção" },
        { createId: () => "   " }
      );
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(ERROR_CODES.INVALID_ID_INPUT);
    }
  });
});

describe("ability and spell mapping", () => {
  it("preserves icon, cost, range, aoe, savingThrow (including attribute fallback and 0 DC), and order", () => {
    const createId = makeCreateId();
    const res = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.SPELL,
        name: "Bola de Gelo",
        icon: "snowflake",
        elementColor: "#00bfff",
        costResource: "hp",
        costAmount: 4,
        hitFormula: "1d20 + @intelecto",
        effectFormula: "3d6",
        trigger: TRIGGER_TYPES.ACTIVE,
        effectType: EFFECT_TYPES.DAMAGE,
        range: { type: SKILL_RANGE_TYPES.RANGED, distanceMeters: 18 },
        aoe: { type: SKILL_AOE_TYPES.CIRCLE, radiusMeters: 4, coneAngleDeg: 45 },
        savingThrow: { enabled: true, dcFormula: 0, attribute: "reflexos", effectDescription: "Metade" },
        description: "Explosão gélida"
      },
      { createId, existingOrder: [{ order: 0 }, { order: 2 }, { order: "bad" }, 1] }
    );

    expect(res).toEqual({
      collection: "abilities",
      entryKey: `${ID_PREFIXES.ABILITY}_1`,
      entry: {
        id: `${ID_PREFIXES.ABILITY}_1`,
        name: "Bola de Gelo",
        icon: "snowflake",
        elementColor: "#00bfff",
        cost: { resource: "hp", amount: 4 },
        hitFormula: "1d20 + @intelecto",
        effectFormula: "3d6",
        trigger: TRIGGER_TYPES.ACTIVE,
        effectType: EFFECT_TYPES.DAMAGE,
        rollKind: ROLL_KINDS.ATTACK,
        range: { type: SKILL_RANGE_TYPES.RANGED, distanceMeters: 18 },
        aoe: { type: SKILL_AOE_TYPES.CIRCLE, radiusMeters: 4, coneAngleDeg: 45 },
        savingThrow: {
          enabled: true,
          dcFormula: "0",
          attributeKey: "reflexos",
          effectDescription: "Metade"
        },
        description: "Explosão gélida",
        order: 3
      }
    });
  });

  it("infers rollKind accurately including MP_HEAL, MP_DAMAGE, HEAL, UTILITY, DAMAGE, CHECK, and respects explicit rollKind", () => {
    const createId = makeCreateId();
    const infer = (extra) =>
      mapCompendiumEntryToCharacterEntry(
        { type: COMPENDIUM_TYPES.ABILITY, ...extra },
        { createId }
      ).entry;

    expect(infer({ effectFormula: "2d4", effectType: EFFECT_TYPES.HEAL }).rollKind).toBe(
      ROLL_KINDS.HEAL
    );
    expect(infer({ effectFormula: "1d6", effectType: EFFECT_TYPES.MP_HEAL }).rollKind).toBe(
      ROLL_KINDS.MP_HEAL
    );
    expect(infer({ effectFormula: "1d6", effectType: EFFECT_TYPES.MP_DAMAGE }).rollKind).toBe(
      ROLL_KINDS.MP_DAMAGE
    );
    expect(infer({ effectFormula: "1d4", effectType: EFFECT_TYPES.UTILITY }).rollKind).toBe(
      ROLL_KINDS.UTILITY
    );
    expect(infer({ effectFormula: "2d6", effectType: EFFECT_TYPES.DAMAGE }).rollKind).toBe(
      ROLL_KINDS.DAMAGE
    );
    expect(infer({}).rollKind).toBe(ROLL_KINDS.CHECK);
    expect(infer({ rollKind: ROLL_KINDS.SAVING_THROW, hitFormula: "1d20" }).rollKind).toBe(
      ROLL_KINDS.SAVING_THROW
    );
  });

  it("applies safe defaults when optional fields or enums are invalid", () => {
    const res = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.ABILITY,
        name: "   ",
        cost: { resource: "stamina", amount: -5 },
        trigger: "invalid",
        effectType: "invalid",
        range: { type: "galactic" },
        aoe: { type: "line" }
      },
      { createId: makeCreateId(), existingOrder: 5 }
    );

    expect(res.entry.name).toBe(DEFAULT_NAMES.compendiumEntry);
    expect(res.entry.elementColor).toBe(DEFAULT_COLORS.abilityElement);
    expect(res.entry.cost).toEqual({ resource: "mp", amount: 0 });
    expect(res.entry.trigger).toBe(TRIGGER_TYPES.ACTIVE);
    expect(res.entry.effectType).toBe(EFFECT_TYPES.DAMAGE);
    expect(res.entry.range.type).toBe(SKILL_RANGE_TYPES.RANGED);
    expect(res.entry.aoe.type).toBe(SKILL_AOE_TYPES.SINGLE);
    expect(res.entry.order).toBe(5);
  });
});

describe("skill mapping & collision-safe keys", () => {
  it("normalizes accents, strips invalid chars, preserves bonus 0 and negative values, and avoids collisions/reserved/unsafe keys", () => {
    expect(normalizeSkillKey("Percepção Aguda!")).toBe("percepcaoaguda");
    expect(resolveUniqueSkillKey("Defesa")).toBe("defesa_2");
    expect(resolveUniqueSkillKey("constructor")).toBe("constructor_2");
    expect(resolveUniqueSkillKey("!!!")).toBe("skill");
    expect(resolveUniqueSkillKey("1st Skill")).toBe("sk_1stskill");

    const fromSet = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.SKILL,
        name: "Furtividade",
        attribute: "agilidade",
        bonus: 0
      },
      { existingKeys: new Set(["furtividade", "furtividade_2"]), existingOrder: [] }
    );
    expect(fromSet).toEqual({
      collection: "skills",
      entryKey: "furtividade_3",
      entry: {
        key: "furtividade_3",
        name: "Furtividade",
        attributeKey: "agilidade",
        bonus: 0,
        order: 0
      }
    });

    const fromObj = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.SKILL,
        key: "Atletismo",
        name: "Atletismo",
        attributeKey: "forca",
        bonus: "-2"
      },
      { existingKeys: { atletismo: true, __proto__: true }, existingOrder: null }
    );
    expect(fromObj.entryKey).toBe("atletismo_2");
    expect(fromObj.entry.bonus).toBe(-2);

    const invalidBonus = mapCompendiumEntryToCharacterEntry(
      { type: COMPENDIUM_TYPES.SKILL, name: "Cura", bonus: "abc" },
      { existingKeys: [123, ""] }
    );
    expect(invalidBonus.entry.bonus).toBe(0);

    const emptyStrBonus = mapCompendiumEntryToCharacterEntry(
      { type: COMPENDIUM_TYPES.SKILL, name: "Arcanismo", bonus: "   " },
      null
    );
    expect(emptyStrBonus.entry.bonus).toBe(0);

    const missingBonus = mapCompendiumEntryToCharacterEntry(
      { type: COMPENDIUM_TYPES.SKILL, name: "Religião", bonus: undefined }
    );
    expect(missingBonus.entry.bonus).toBe(0);
  });
});

describe("item mapping", () => {
  it("preserves icon, qty, consumeOnUse, savingThrow, rollFormula fallbacks, and rollKind", () => {
    const createId = makeCreateId();
    const res = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.ITEM,
        name: "Poção de Mana",
        icon: "flask",
        qty: "3",
        effectFormula: "2d4 + 2",
        effectType: EFFECT_TYPES.MP_HEAL,
        consumeOnUse: true,
        savingThrow: null,
        description: "Restaura MP"
      },
      { createId, existingOrder: [0, 1] }
    );

    expect(res).toEqual({
      collection: "inventory",
      entryKey: `${ID_PREFIXES.INVENTORY}_1`,
      entry: {
        id: `${ID_PREFIXES.INVENTORY}_1`,
        name: "Poção de Mana",
        icon: "flask",
        qty: 3,
        elementColor: DEFAULT_COLORS.itemElement,
        rollFormula: "2d4 + 2",
        trigger: TRIGGER_TYPES.ACTIVE,
        effectType: EFFECT_TYPES.MP_HEAL,
        rollKind: ROLL_KINDS.MP_HEAL,
        consumeOnUse: true,
        savingThrow: {
          enabled: false,
          dcFormula: "12",
          attributeKey: "resistencia",
          effectDescription: ""
        },
        description: "Restaura MP",
        order: 2
      }
    });

    const fallbackItem = mapCompendiumEntryToCharacterEntry(
      {
        type: COMPENDIUM_TYPES.ITEM,
        name: "Granada",
        qty: 0,
        hitFormula: "1d20",
        trigger: "bad",
        effectType: "bad",
        rollKind: ROLL_KINDS.ATTACK
      },
      { createId }
    ).entry;

    expect(fallbackItem.qty).toBe(1);
    expect(fallbackItem.rollFormula).toBe("1d20");
    expect(fallbackItem.effectType).toBe(EFFECT_TYPES.HEAL);
    expect(fallbackItem.rollKind).toBe(ROLL_KINDS.ATTACK);
    expect(fallbackItem.consumeOnUse).toBe(false);
  });
});
