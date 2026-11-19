import { describe, expect, it } from "vitest";
import {
  EFFECT_TYPES,
  ROLL_SOURCE_TYPES,
  TRIGGER_TYPES
} from "../../../../src/domain/constants.js";
import {
  collectCombatTriggers,
  collectSavingThrowAssists,
  composeSavingThrowFormula,
  normalizeCombatEntry,
  summarizeCombatEntryCosts
} from "../../../../src/engines/combat/index.js";

describe("engines/combat/triggersAndAssists", () => {
  describe("normalizeCombatEntry", () => {
    it("returns null for invalid entry or missing id", () => {
      expect(normalizeCombatEntry(null, ROLL_SOURCE_TYPES.ABILITY)).toBeNull();
      expect(normalizeCombatEntry({}, ROLL_SOURCE_TYPES.ABILITY)).toBeNull();
    });

    it("normalizes ability formulas differently for trigger vs assist modes and parses nested/legacy costs", () => {
      const ability = {
        name: "Golpe Rúnico",
        hitFormula: "1d20 + @forca",
        effectFormula: "",
        cost: { resource: "hp", amount: 3 },
        trigger: TRIGGER_TYPES.ON_HIT
      };

      const asTrigger = normalizeCombatEntry(ability, ROLL_SOURCE_TYPES.ABILITY, {
        mode: "trigger",
        fallbackId: "ab_1"
      });
      expect(asTrigger).toMatchObject({
        uid: "ab_ab_1",
        id: "ab_1",
        formula: "",
        icon: "sword",
        cost: { resource: "hp", amount: 3 },
        costHp: 3,
        costMp: 0
      });

      const asAssist = normalizeCombatEntry(ability, ROLL_SOURCE_TYPES.ABILITY, {
        mode: "assist",
        fallbackId: "ab_1"
      });
      expect(asAssist.formula).toBe("1d20 + @forca");
      expect(asAssist.icon).toBe("shield");
    });

    it("normalizes inventory item with qty, consumeOnUse, and savingThrow", () => {
      const item = normalizeCombatEntry(
        {
          id: "it_1",
          name: "Bomba",
          rollFormula: "2d6",
          quantity: 4,
          consumeOnUse: true,
          savingThrow: { enabled: true, dcFormula: "14" }
        },
        ROLL_SOURCE_TYPES.ITEM
      );
      expect(item).toMatchObject({
        uid: "it_it_1",
        formula: "2d6",
        icon: "potion_red",
        qty: 4,
        consumeOnUse: true,
        savingThrow: { enabled: true, dcFormula: "14" },
        cost: { resource: "mp", amount: 0 }
      });
    });
  });

  describe("collectCombatTriggers", () => {
    it("returns empty array for nullish character", () => {
      expect(collectCombatTriggers(null)).toEqual([]);
    });

    it("collects from v2 maps sorted by order and filters hit triggers vs includeAll", () => {
      const char = {
        abilities: {
          ab_active: {
            name: "Ativa",
            order: 2,
            trigger: TRIGGER_TYPES.ACTIVE,
            effectFormula: "1d6"
          },
          ab_hit: {
            name: "Marca",
            order: 1,
            trigger: TRIGGER_TYPES.ON_HIT,
            effectFormula: "1d4"
          }
        },
        inventory: {
          it_plain: { name: "Corda", trigger: TRIGGER_TYPES.ACTIVE },
          it_crit: {
            name: "Veneno",
            trigger: TRIGGER_TYPES.ON_CRIT,
            rollFormula: "2d4",
            consumeOnUse: true
          }
        }
      };

      const onlyTriggers = collectCombatTriggers(char);
      expect(onlyTriggers.map((t) => t.id)).toEqual(["ab_hit", "it_crit"]);

      const withNullEntries = collectCombatTriggers({
        abilities: [null],
        inventory: [null],
        other: "ignored"
      });
      expect(withNullEntries).toEqual([]);
      expect(collectCombatTriggers({ abilities: "bad", inventory: 123 })).toEqual([]);

      const allEntries = collectCombatTriggers(char, { includeAll: true });
      expect(allEntries.map((t) => t.id)).toEqual([
        "ab_hit",
        "ab_active",
        "it_crit"
      ]);
    });
  });

  describe("collectSavingThrowAssists", () => {
    it("returns empty array for nullish character and preserves d20 formulas (FUN-07)", () => {
      expect(collectSavingThrowAssists(null)).toEqual([]);

      const char = {
        abilities: [
          {
            id: "ab_luck",
            name: "Sorte de Pinguim",
            hitFormula: "1d20 + 2",
            effectType: EFFECT_TYPES.UTILITY
          }
        ],
        inventory: {
          it_charm: {
            name: "Amuleto",
            rollFormula: "d20"
          }
        }
      };

      const assists = collectSavingThrowAssists(char);
      expect(assists).toHaveLength(2);
      expect(assists[0].formula).toBe("1d20 + 2");
      expect(assists[1].formula).toBe("d20");
    });
  });

  describe("composeSavingThrowFormula", () => {
    it("preserves d20 assists (FUN-07) and delegates roll mode", () => {
      expect(composeSavingThrowFormula()).toBe("1d20");

      const res = composeSavingThrowFormula({
        baseAttributeFormula: "@vigor + @resistencia",
        rollMode: "advantage",
        extraBonus: "2",
        selectedAssists: ["1d20 + 1", { formula: "1d4" }, { formula: "" }, null]
      });
      expect(res).toBe("2d20kh1 + @vigor + @resistencia + (2 + 1d20 + 1 + 1d4)");

      const dis = composeSavingThrowFormula({
        rollMode: "disadvantage",
        selectedAssists: ["d20"]
      });
      expect(dis).toBe("2d20kl1 + (d20)");
    });
  });

  describe("summarizeCombatEntryCosts", () => {
    it("aggregates mp, hp, and consumeOnUse items across unified and legacy entries", () => {
      expect(summarizeCombatEntryCosts(null)).toEqual({
        mp: 0,
        hp: 0,
        itemsToConsume: []
      });

      const summary = summarizeCombatEntryCosts([
        null,
        { cost: { resource: "mp", amount: 5 } },
        { cost: { resource: "hp", amount: 3 } },
        { costMp: 2, costHp: 1 },
        {
          id: "it_potion",
          sourceType: ROLL_SOURCE_TYPES.ITEM,
          consumeOnUse: true
        },
        {
          id: "it_reusable",
          sourceType: ROLL_SOURCE_TYPES.ITEM,
          consumeOnUse: false
        }
      ]);
      expect(summary).toEqual({
        mp: 7,
        hp: 4,
        itemsToConsume: [{ itemId: "it_potion", qty: 1 }]
      });
    });
  });
});
