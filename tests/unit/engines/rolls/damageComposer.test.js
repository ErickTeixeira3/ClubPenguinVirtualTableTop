import { describe, expect, it } from "vitest";
import {
  applyD20ModeToFormula,
  composeDamageFormula,
  doubleDiceInFormula
} from "../../../../src/engines/rolls/index.js";

describe("engines/rolls/damageComposer", () => {
  describe("doubleDiceInFormula", () => {
    it("returns empty string for nullish or blank formulas", () => {
      expect(doubleDiceInFormula(null)).toBe("");
      expect(doubleDiceInFormula(undefined)).toBe("");
      expect(doubleDiceInFormula("   ")).toBe("");
    });

    it("doubles dice counts across omitted counts, 0dX, keep modifiers, and variables", () => {
      expect(doubleDiceInFormula("d8")).toBe("2d8");
      expect(doubleDiceInFormula("0d6")).toBe("2d6");
      expect(doubleDiceInFormula("2d6")).toBe("4d6");
      expect(doubleDiceInFormula("2d6kh1 + 1D8 + @forca")).toBe(
        "4d6kh1 + 2d8 + @forca"
      );
      expect(doubleDiceInFormula("@forca + 3")).toBe("@forca + 3");
    });
  });

  describe("applyD20ModeToFormula", () => {
    it("defaults nullish/blank formulas to 1d20 and applies advantage/disadvantage", () => {
      expect(applyD20ModeToFormula(null)).toBe("1d20");
      expect(applyD20ModeToFormula("   ")).toBe("1d20");
      expect(applyD20ModeToFormula("1d20 + @forca", "normal")).toBe(
        "1d20 + @forca"
      );
      expect(applyD20ModeToFormula("1d20 + @forca", "advantage")).toBe(
        "2d20kh1 + @forca"
      );
      expect(applyD20ModeToFormula("d20 + 3", "disadvantage")).toBe(
        "2d20kl1 + 3"
      );
      expect(applyD20ModeToFormula("@forca + 2", "advantage")).toBe(
        "2d20kh1 + (@forca + 2)"
      );
    });

    it("appends unsigned and signed extraBonus cleanly", () => {
      expect(applyD20ModeToFormula("1d20", "normal", "3")).toBe(
        "1d20 + (3)"
      );
      expect(applyD20ModeToFormula("1d20", "normal", "+ 1d4")).toBe(
        "1d20 + 1d4"
      );
      expect(applyD20ModeToFormula("1d20", "normal", "-2")).toBe("1d20 -2");
    });
  });

  describe("composeDamageFormula", () => {
    it("returns empty string when all inputs are empty (never falls back to 1d6)", () => {
      expect(composeDamageFormula()).toBe("");
      expect(composeDamageFormula(null)).toBe("");
      expect(
        composeDamageFormula({
          baseFormula: "",
          critFormula: "",
          isCrit: true,
          extraDamage: "",
          triggerFormulas: []
        })
      ).toBe("");
    });

    it("composes normal damage from base, extraDamage, and string/object triggers", () => {
      expect(
        composeDamageFormula({
          baseFormula: "1d8 + @forca",
          extraDamage: "+2",
          triggerFormulas: ["1d4", { formula: "1d6" }, { formula: "  " }]
        })
      ).toBe("1d8 + @forca +2 + 1d4 + 1d6");
    });

    it("honors explicit critFormula over doubleDiceInFormula(baseFormula)", () => {
      expect(
        composeDamageFormula({
          baseFormula: "1d8 + @forca",
          critFormula: "3d8 + @forca",
          isCrit: true,
          extraDamage: "1d4",
          triggerFormulas: [{ formula: "1d6" }]
        })
      ).toBe("3d8 + @forca + 2d4 + 2d6");

      expect(
        composeDamageFormula({
          baseFormula: "",
          critFormula: "2d10",
          isCrit: true
        })
      ).toBe("2d10");
    });

    it("falls back to doubleDiceInFormula(baseFormula) on crit only when critFormula is empty", () => {
      expect(
        composeDamageFormula({
          baseFormula: "1d8 + @forca",
          critFormula: "   ",
          isCrit: true,
          extraDamage: "1d4"
        })
      ).toBe("2d8 + @forca + 2d4");
    });
  });
});
