import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import { evaluateFormula } from "../../../../src/engines/formula/index.js";

function seqRng(values) {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx += 1;
    return val;
  };
}

describe("engines/formula/evaluator", () => {
  it("evaluates arithmetic, precedence, unary chaining, rounding, and -0 normalization", () => {
    expect(evaluateFormula("2 + 3 * 4")).toEqual({
      ok: true,
      formulaOriginal: "2 + 3 * 4",
      formulaResolved: "2 + 3 * 4",
      expressionFinal: "2 + 3 * 4",
      diceBreakdown: [],
      total: 14,
      isCrit: false,
      isFumble: false
    });

    expect(evaluateFormula("10 / 3").total).toBe(3.33);
    expect(evaluateFormula("--5 + +2").total).toBe(7);

    const negZero = evaluateFormula("-0");
    expect(negZero.ok).toBe(true);
    expect(Object.is(negZero.total, 0)).toBe(true);
  });

  it("resolves variables with accents and negative wrapping without needing rng", () => {
    const char = {
      attributes: {
        forca: { key: "forca", label: "Força", value: -2 },
        agilidade: { key: "agilidade", label: "Agilidade", value: 4 }
      },
      skills: {
        luta: { key: "luta", name: "Luta", bonus: 3 }
      },
      defense: 13,
      resources: { hp: { current: 20 }, mp: { current: 11 } },
      level: 2
    };

    const res = evaluateFormula("@Força + @agilidade + @luta + @nivel", char);
    expect(res).toEqual({
      ok: true,
      formulaOriginal: "@Força + @agilidade + @luta + @nivel",
      formulaResolved: "(-2) + 4 + 3 + 2",
      expressionFinal: "(-2) + 4 + 3 + 2",
      diceBreakdown: [],
      total: 7,
      isCrit: false,
      isFumble: false
    });
  });

  it("defaults nullish/empty/whitespace formula to 1d20 and aggregates multi-dice crit/fumble", () => {
    const resNull = evaluateFormula(null, null, { rng: () => 0.99 });
    expect(resNull.ok).toBe(true);
    expect(resNull.formulaOriginal).toBe("1d20");
    expect(resNull.total).toBe(20);
    expect(resNull.isCrit).toBe(true);
    expect(resNull.isFumble).toBe(false);

    const resBlank = evaluateFormula("   ", null, { rng: () => 0 });
    expect(resBlank.ok).toBe(true);
    expect(resBlank.formulaOriginal).toBe("1d20");
    expect(resBlank.total).toBe(1);
    expect(resBlank.isCrit).toBe(false);
    expect(resBlank.isFumble).toBe(true);

    const multi = evaluateFormula("1d20 + 1d20 + 2", null, {
      rng: seqRng([0.99, 0])
    });
    expect(multi.ok).toBe(true);
    expect(multi.total).toBe(23);
    expect(multi.isCrit).toBe(true);
    expect(multi.isFumble).toBe(true);
    expect(multi.diceBreakdown).toHaveLength(2);
  });

  it("supports custom rollDiceToken provider", () => {
    const rollDiceToken = vi.fn(() => ({
      notation: "2d6",
      subtotal: 9,
      isCrit: false,
      isFumble: false
    }));
    const res = evaluateFormula("2d6 + 3", null, { rollDiceToken });
    expect(res.ok).toBe(true);
    expect(res.total).toBe(12);
    expect(res.expressionFinal).toBe("9 + 3");
    expect(rollDiceToken).toHaveBeenCalledTimes(1);
  });

  it("returns structured { ok: false, error } for all error conditions without calling rng on invalid syntax/vars", () => {
    const rngSpy = vi.fn(() => 0.5);

    expect(evaluateFormula(123).error.code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(evaluateFormula("1", null, "badOpts").error.code).toBe(
      ERROR_CODES.INVALID_TYPE
    );
    expect(evaluateFormula("1", null, { rng: "notFn" }).error.code).toBe(
      ERROR_CODES.INVALID_TYPE
    );
    expect(
      evaluateFormula("1", null, { rollDiceToken: "notFn" }).error.code
    ).toBe(ERROR_CODES.INVALID_TYPE);

    expect(evaluateFormula("1d20").error.code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(evaluateFormula("1d20", null, { rng: () => 1 }).error.code).toBe(
      ERROR_CODES.OUT_OF_RANGE
    );

    const invalidToken = evaluateFormula("2x3", null, { rng: rngSpy });
    expect(invalidToken.ok).toBe(false);
    expect(invalidToken.error.code).toBe(ERROR_CODES.INVALID_TOKEN);

    const invalidSyntax = evaluateFormula("(1+2", null, { rng: rngSpy });
    expect(invalidSyntax.ok).toBe(false);
    expect(invalidSyntax.error.code).toBe(ERROR_CODES.INVALID_SYNTAX);

    const unknownVar = evaluateFormula("1d20 + @inexistente", null, {
      rng: rngSpy
    });
    expect(unknownVar.ok).toBe(false);
    expect(unknownVar.error.code).toBe(ERROR_CODES.UNKNOWN_VARIABLE);

    const protoVar = evaluateFormula("@constructor", null, { rng: rngSpy });
    expect(protoVar.ok).toBe(false);
    expect(protoVar.error.code).toBe(ERROR_CODES.UNKNOWN_VARIABLE);
    expect(rngSpy).not.toHaveBeenCalled();

    const collisionRes = evaluateFormula("@forca", {
      attributes: { forca: { key: "forca", value: 2 } },
      skills: { forca: { key: "forca", bonus: 3 } }
    });
    expect(collisionRes.ok).toBe(false);
    expect(collisionRes.error.code).toBe(ERROR_CODES.KEY_COLLISION);

    const divZero = evaluateFormula("10 / (2 - 2)");
    expect(divZero.ok).toBe(false);
    expect(divZero.error.code).toBe(ERROR_CODES.DIVISION_BY_ZERO);

    const overflow = evaluateFormula("9".repeat(400));
    expect(overflow.ok).toBe(false);
    expect(overflow.error.code).toBe(ERROR_CODES.OUT_OF_RANGE);

    const badRoller = evaluateFormula("1d6", null, {
      rollDiceToken: () => ({ subtotal: NaN })
    });
    expect(badRoller.ok).toBe(false);
    expect(badRoller.error.code).toBe(ERROR_CODES.INVALID_DICE_NOTATION);

    const unexpectedThrow = evaluateFormula("1d6", null, {
      rollDiceToken: () => {
        throw new Error("boom");
      }
    });
    expect(unexpectedThrow.ok).toBe(false);
    expect(unexpectedThrow.error.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(unexpectedThrow.error.message).toBe("boom");
  });
});
