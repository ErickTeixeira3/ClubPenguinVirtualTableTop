import { describe, expect, it } from "vitest";
import { AppError, ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  evaluateDcFormula,
  evaluateSavingThrowOutcome
} from "../../../../src/engines/combat/index.js";

describe("engines/combat/savingThrow", () => {
  describe("evaluateDcFormula", () => {
    it("returns DEFAULT_DC (12) for nullish or blank strings", () => {
      expect(evaluateDcFormula(null)).toBe(12);
      expect(evaluateDcFormula(undefined)).toBe(12);
      expect(evaluateDcFormula("")).toBe(12);
      expect(evaluateDcFormula("   ")).toBe(12);
    });

    it("preserves 0 and '0' without || 10 or Math.max(1) bugs (FUN-07)", () => {
      expect(evaluateDcFormula(0)).toBe(0);
      expect(evaluateDcFormula("0")).toBe(0);
      expect(evaluateDcFormula(" 0 ")).toBe(0);
      expect(evaluateDcFormula(-3)).toBe(0);
      expect(evaluateDcFormula("-3")).toBe(0);
      expect(evaluateDcFormula("14.6")).toBe(15);
    });

    it("evaluates deterministic formulas without rng and dice formulas with injected rng", () => {
      const char = {
        attributes: {
          intelecto: { key: "intelecto", value: 4 },
          zero: { key: "zero", value: 0 }
        }
      };

      expect(evaluateDcFormula("10 + @intelecto", char)).toBe(14);
      expect(evaluateDcFormula("@zero", char)).toBe(0);

      expect(
        evaluateDcFormula("10 + 1d4", char, { rng: () => 0.99 })
      ).toBe(14);
    });

    it("throws AppError on dice without rng, invalid formulas, or non-finite values", () => {
      expect(() => evaluateDcFormula("10 + 1d4", null)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
      expect(() => evaluateDcFormula("10 + @missing", null)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.UNKNOWN_VARIABLE })
      );
      expect(() => evaluateDcFormula(NaN)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() => evaluateDcFormula({})).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
      expect(() =>
        evaluateDcFormula("1d4", null, {
          evaluateFormulaFn: () => ({ ok: true, total: NaN })
        })
      ).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() =>
        evaluateDcFormula("1d4", null, {
          evaluateFormulaFn: () => ({
            ok: false,
            error: { message: "custom fail" }
          })
        })
      ).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.VALIDATION_FAILED })
      );
      expect(() =>
        evaluateDcFormula("1d4", null, {
          evaluateFormulaFn: () => ({
            ok: false,
            error: new AppError(ERROR_CODES.INVALID_SYNTAX, "err")
          })
        })
      ).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_SYNTAX })
      );
    });
  });

  describe("evaluateSavingThrowOutcome", () => {
    it("preserves dc = 0 and '0' without || 10 fallback", () => {
      expect(evaluateSavingThrowOutcome({ dc: 0, rollTotal: 0 })).toEqual({
        dc: 0,
        total: 0,
        passed: true
      });
      expect(evaluateSavingThrowOutcome({ dc: "0", rollTotal: -1 })).toEqual({
        dc: 0,
        total: -1,
        passed: false
      });
    });

    it("falls back to DEFAULT_DC (12) for invalid/blank dc and evaluates pass threshold", () => {
      expect(evaluateSavingThrowOutcome()).toEqual({
        dc: 12,
        total: 0,
        passed: false
      });
      expect(
        evaluateSavingThrowOutcome({ dc: "", rollTotal: 12 })
      ).toEqual({
        dc: 12,
        total: 12,
        passed: true
      });
      expect(
        evaluateSavingThrowOutcome({ dc: 15, rollTotal: 14 })
      ).toEqual({
        dc: 15,
        total: 14,
        passed: false
      });
    });
  });
});
