import { describe, expect, it } from "vitest";
import { EFFECT_TYPES } from "../../../../src/domain/constants.js";
import * as combatBarrel from "../../../../src/engines/combat/index.js";
import {
  collectEntityCombatModifiers,
  computeModifiedEffectValue
} from "../../../../src/engines/combat/index.js";

describe("engines/combat/effectPipeline", () => {
  it("exports all expected combat barrel helpers", () => {
    expect(Object.keys(combatBarrel).sort()).toEqual([
      "buildTargetInfo",
      "collectCombatTriggers",
      "collectEntityCombatModifiers",
      "collectSavingThrowAssists",
      "composeSavingThrowFormula",
      "computeModifiedEffectValue",
      "evaluateDcFormula",
      "evaluatePendingHitEvaluation",
      "evaluateSavingThrowOutcome",
      "normalizeCombatEntry",
      "resolveTokenTargetData",
      "summarizeCombatEntryCosts"
    ]);
  });

  describe("collectEntityCombatModifiers", () => {
    it("returns empty list for nullish or non-object entities", () => {
      expect(collectEntityCombatModifiers(null)).toEqual([]);
      expect(collectEntityCombatModifiers("invalid")).toEqual([]);
    });

    it("collects from v2 ID-indexed maps and v1 arrays while filtering disabled, phase, and effectTypes", () => {
      const entity = {
        combatModifiers: {
          m1: { flatDelta: 2, phase: "outgoing" },
          m2: { flatDelta: 5, phase: "incoming", enabled: false }
        },
        abilities: {
          ab1: {
            name: "Aura",
            combatModifiers: [
              { id: "m_ab", label: "Aura +3", flatDelta: 3, multiplier: 1.5, phase: "incoming", effectTypes: [EFFECT_TYPES.DAMAGE] },
              { flatDelta: 9, phase: "incoming", effectTypes: [EFFECT_TYPES.HEAL] }
            ]
          },
          ab_off: {
            enabled: false,
            combatModifiers: [{ flatDelta: 99, phase: "incoming" }]
          },
          ab_bad: "not_an_object"
        },
        inventory: [
          null,
          {
            id: "it1",
            name: "Amuleto",
            combatModifiers: {
              c1: { flatDelta: -1, phase: "incoming" }
            }
          }
        ],
        conditions: {
          cond1: {
            combatModifiers: [{ flatDelta: -2 }]
          }
        }
      };

      const incoming = collectEntityCombatModifiers(
        entity,
        "incoming",
        EFFECT_TYPES.DAMAGE
      );
      expect(incoming).toEqual([
        {
          id: "m_ab",
          label: "Aura +3",
          phase: "incoming",
          flatDelta: 3,
          multiplier: 1.5
        },
        {
          id: "c1",
          label: "Amuleto",
          phase: "incoming",
          flatDelta: -1,
          multiplier: 1
        },
        {
          id: "cond1",
          label: "Modificador",
          phase: "incoming",
          flatDelta: -2,
          multiplier: 1
        }
      ]);

      const outgoing = collectEntityCombatModifiers(
        entity,
        "outgoing",
        EFFECT_TYPES.DAMAGE
      );
      expect(outgoing).toHaveLength(2);
      expect(outgoing[0].flatDelta).toBe(2);
      expect(outgoing[1].flatDelta).toBe(-2);
    });
  });

  describe("computeModifiedEffectValue", () => {
    it("handles all 5 effect types, unknown fallback, and avoids -0 on zero damage", () => {
      expect(computeModifiedEffectValue()).toMatchObject({
        baseValue: 0,
        finalValue: 0,
        effectType: EFFECT_TYPES.DAMAGE,
        resourceKey: "hp"
      });
      expect(
        Object.is(
          computeModifiedEffectValue({
            baseValue: 0,
            effectType: EFFECT_TYPES.DAMAGE
          }).resourceDelta,
          0
        )
      ).toBe(true);

      expect(
        computeModifiedEffectValue({
          baseValue: 10,
          effectType: EFFECT_TYPES.HEAL
        })
      ).toMatchObject({ resourceKey: "hp", resourceDelta: 10 });

      expect(
        computeModifiedEffectValue({
          baseValue: 6,
          effectType: EFFECT_TYPES.MP_DAMAGE
        })
      ).toMatchObject({ resourceKey: "mp", resourceDelta: -6 });

      expect(
        computeModifiedEffectValue({
          baseValue: 8,
          effectType: EFFECT_TYPES.MP_HEAL
        })
      ).toMatchObject({ resourceKey: "mp", resourceDelta: 8 });

      expect(
        computeModifiedEffectValue({
          baseValue: 5,
          effectType: EFFECT_TYPES.UTILITY
        })
      ).toMatchObject({ resourceKey: null, resourceDelta: 0 });

      expect(
        computeModifiedEffectValue({
          baseValue: 4,
          effectType: "unknown_type"
        })
      ).toMatchObject({ effectType: EFFECT_TYPES.DAMAGE, resourceDelta: -4 });
    });

    it("applies outgoing -> incoming -> hooks -> half floor math cleanly", () => {
      const source = {
        abilities: {
          fury: {
            name: "Fúria",
            combatModifiers: [{ phase: "outgoing", flatDelta: 3 }]
          }
        }
      };
      const target = {
        conditions: {
          shield: {
            name: "Escudo",
            combatModifiers: [{ phase: "incoming", flatDelta: -2, multiplier: 0.5 }]
          }
        }
      };

      const res = computeModifiedEffectValue({
        baseValue: 7,
        scaleMode: "half",
        effectType: EFFECT_TYPES.DAMAGE,
        sourceCharacter: source,
        targetCharacter: target,
        manualModifiers: [
          { id: "m_out", label: "Manual Out", phase: "outgoing", flatDelta: 2 },
          { id: "m_in", label: "Manual In", phase: "incoming", flatDelta: -1 },
          { id: "m_off", enabled: false, flatDelta: 99 }
        ],
        modifierHooks: [
          "not_a_fn",
          () => null,
          () => ({ id: "noop", flatDelta: 0, multiplier: 1 }),
          ({ currentValue }) => ({
            id: "passive_bonus",
            label: "Passivo",
            flatDelta: currentValue > 0 ? 1 : 0,
            multiplier: NaN
          })
        ]
      });

      // 7 + 3 (out) + 2 (manual out) = 12; 12 - 2 = 10 * 0.5 = 5; 5 - 1 = 4; 4 + 1 (hook) = 5; floor(5/2) = 2
      expect(res.finalValue).toBe(2);
      expect(res.resourceDelta).toBe(-2);
      expect(res.appliedModifiers).toHaveLength(5);
    });

    it("isolates custom scaleMode and handles empty customValue fallback", () => {
      const source = {
        abilities: [{ combatModifiers: [{ phase: "outgoing", flatDelta: 10 }] }]
      };
      const custom = computeModifiedEffectValue({
        baseValue: 10,
        scaleMode: "custom",
        customValue: "15",
        sourceCharacter: source,
        manualModifiers: [{ id: "m1", label: "Extra", flatDelta: 3 }],
        modifierHooks: [() => ({ flatDelta: 50 })]
      });
      expect(custom.baseValue).toBe(15);
      expect(custom.finalValue).toBe(18);

      const emptyCustom = computeModifiedEffectValue({
        baseValue: 9,
        scaleMode: "custom",
        customValue: ""
      });
      expect(emptyCustom.baseValue).toBe(9);
      expect(emptyCustom.finalValue).toBe(9);
    });
  });
});
