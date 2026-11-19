import { describe, expect, it } from "vitest";
import { EFFECT_TYPES, ROLL_KINDS } from "../../../../src/domain/constants.js";
import * as rollsBarrel from "../../../../src/engines/rolls/index.js";
import {
  classifyRollKind,
  effectRollKind,
  inferAbilityRollKind,
  isAttackRollMessage
} from "../../../../src/engines/rolls/index.js";

describe("engines/rolls/rollClassifier", () => {
  it("exports all expected barrel helpers", () => {
    expect(Object.keys(rollsBarrel).sort()).toEqual([
      "applyD20ModeToFormula",
      "buildHotbarSlotFromRoll",
      "buildShortcutRollParams",
      "buildSkillFormula",
      "classifyRollKind",
      "composeDamageFormula",
      "doubleDiceInFormula",
      "effectRollKind",
      "inferAbilityRollKind",
      "isAttackRollMessage",
      "resolveDynamicRollEntry",
      "resolveHotbarSlot"
    ]);
  });

  describe("effectRollKind", () => {
    it("maps all 5 EFFECT_TYPES consistently including MP_HEAL and MP_DAMAGE", () => {
      expect(effectRollKind(EFFECT_TYPES.DAMAGE)).toBe(ROLL_KINDS.DAMAGE);
      expect(effectRollKind(EFFECT_TYPES.HEAL)).toBe(ROLL_KINDS.HEAL);
      expect(effectRollKind(EFFECT_TYPES.MP_DAMAGE)).toBe(ROLL_KINDS.MP_DAMAGE);
      expect(effectRollKind(EFFECT_TYPES.MP_HEAL)).toBe(ROLL_KINDS.MP_HEAL);
      expect(effectRollKind(EFFECT_TYPES.UTILITY)).toBe(ROLL_KINDS.UTILITY);
    });

    it("falls back to DAMAGE for null, undefined, or unknown effect types", () => {
      expect(effectRollKind(null)).toBe(ROLL_KINDS.DAMAGE);
      expect(effectRollKind(undefined)).toBe(ROLL_KINDS.DAMAGE);
      expect(effectRollKind("custom_unknown")).toBe(ROLL_KINDS.DAMAGE);
    });
  });

  describe("inferAbilityRollKind", () => {
    it("handles nullish/empty options and isSkill rules", () => {
      expect(inferAbilityRollKind()).toBe(ROLL_KINDS.CHECK);
      expect(inferAbilityRollKind(null)).toBe(ROLL_KINDS.CHECK);
      expect(
        inferAbilityRollKind({ isSkill: true, hitFormula: "1d20" })
      ).toBe(ROLL_KINDS.CHECK);
      expect(
        inferAbilityRollKind({
          isSkill: true,
          effectFormula: "1d6",
          effectType: EFFECT_TYPES.HEAL
        })
      ).toBe(ROLL_KINDS.HEAL);
    });

    it("infers ATTACK when hitFormula is present and effect kind otherwise", () => {
      expect(
        inferAbilityRollKind({
          hitFormula: "1d20 + @forca",
          effectFormula: "1d8"
        })
      ).toBe(ROLL_KINDS.ATTACK);
      expect(
        inferAbilityRollKind({
          hitFormula: "   ",
          effectFormula: "2d4",
          effectType: EFFECT_TYPES.MP_HEAL
        })
      ).toBe(ROLL_KINDS.MP_HEAL);
      expect(
        inferAbilityRollKind({
          hitFormula: "",
          effectFormula: "1d6",
          effectType: EFFECT_TYPES.MP_DAMAGE
        })
      ).toBe(ROLL_KINDS.MP_DAMAGE);
    });
  });

  describe("classifyRollKind", () => {
    it("honors explicit valid rollKind and ignores invalid rollKind", () => {
      expect(classifyRollKind({ rollKind: ROLL_KINDS.SAVING_THROW })).toBe(
        ROLL_KINDS.SAVING_THROW
      );
      expect(
        classifyRollKind({
          rollKind: "not_a_kind",
          effectType: EFFECT_TYPES.MP_HEAL
        })
      ).toBe(ROLL_KINDS.MP_HEAL);
    });

    it("classifies deferred primary+secondary as ATTACK and handles deferSecondaryDamage=false", () => {
      expect(
        classifyRollKind({
          primaryFormula: "1d20",
          secondaryFormula: "1d8"
        })
      ).toBe(ROLL_KINDS.ATTACK);

      expect(
        classifyRollKind({
          primaryFormula: "1d20",
          secondaryFormula: "1d8",
          deferSecondaryDamage: false,
          effectType: EFFECT_TYPES.DAMAGE
        })
      ).toBe(ROLL_KINDS.DAMAGE);
    });

    it("maps all 5 EFFECT_TYPES and falls back to CHECK without Portuguese title/label regex", () => {
      expect(classifyRollKind(null)).toBe(ROLL_KINDS.CHECK);
      expect(classifyRollKind({ effectType: EFFECT_TYPES.UTILITY })).toBe(
        ROLL_KINDS.UTILITY
      );
      expect(classifyRollKind({ effectType: EFFECT_TYPES.MP_DAMAGE })).toBe(
        ROLL_KINDS.MP_DAMAGE
      );
      expect(classifyRollKind({ effectType: "unknown" })).toBe(
        ROLL_KINDS.CHECK
      );

      // Negative regex assertions (EST-06)
      expect(
        classifyRollKind({
          primaryLabel: "Acerto",
          title: "Ataque Poderoso",
          primaryFormula: "1d20"
        })
      ).toBe(ROLL_KINDS.CHECK);
      expect(
        classifyRollKind({
          primaryLabel: "Golpe Rápido",
          title: "Tiro Certeiro"
        })
      ).toBe(ROLL_KINDS.CHECK);
    });
  });

  describe("isAttackRollMessage", () => {
    it("returns false for null/non-object payloads", () => {
      expect(isAttackRollMessage(null)).toBe(false);
      expect(isAttackRollMessage(undefined)).toBe(false);
      expect(isAttackRollMessage("attack")).toBe(false);
    });

    it("inspects structural kind across v2 roll, v1 rollData, and direct objects", () => {
      expect(isAttackRollMessage({ roll: { kind: ROLL_KINDS.ATTACK } })).toBe(
        true
      );
      expect(
        isAttackRollMessage({ rollData: { rollKind: ROLL_KINDS.ATTACK } })
      ).toBe(true);
      expect(isAttackRollMessage({ kind: ROLL_KINDS.ATTACK })).toBe(true);

      for (const nonAttackKind of Object.values(ROLL_KINDS).filter(
        (k) => k !== ROLL_KINDS.ATTACK
      )) {
        expect(
          isAttackRollMessage({
            roll: {
              kind: nonAttackKind,
              damageConfig: { base: "1d6" },
              secondary: { deferred: true }
            }
          })
        ).toBe(false);
      }
    });

    it("detects secondary.deferred, hitEvaluation, damageConfig, targetInfo, and excludes follow-ups", () => {
      expect(
        isAttackRollMessage({
          roll: { parentMessageId: "msg_1", damageConfig: {} }
        })
      ).toBe(false);
      expect(
        isAttackRollMessage({
          roll: { respondsTo: "msg_1", secondary: { deferred: true } }
        })
      ).toBe(false);
      expect(
        isAttackRollMessage({
          roll: {
            parentMessageId: "msg_1",
            savingThrowOutcome: { passed: false },
            targetInfo: { isAttackRoll: true }
          }
        })
      ).toBe(true);
      expect(
        isAttackRollMessage({ roll: { secondary: { deferred: true } } })
      ).toBe(true);
      expect(
        isAttackRollMessage({
          roll: { hitEvaluation: { status: "pending" } }
        })
      ).toBe(true);
      expect(
        isAttackRollMessage({
          roll: { hitEvaluation: { status: "none" } }
        })
      ).toBe(false);
      expect(isAttackRollMessage({ rollData: { damageConfig: {} } })).toBe(
        true
      );
    });

    it("does NOT classify by legacy title/label regex or targetedToken + 1d20 heuristic", () => {
      expect(
        isAttackRollMessage({
          targetedToken: { id: "tok_1" },
          rollData: {
            title: "Ataque Surpresa",
            primaryRoll: { label: "Acerto", formulaOriginal: "1d20 + 5" }
          }
        })
      ).toBe(false);
    });
  });
});
