import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  evaluateDiceToken,
  rollSingleDie
} from "../../../../src/engines/dice/index.js";

function seqRng(values) {
  let idx = 0;
  return () => {
    const val = values[idx % values.length];
    idx += 1;
    return val;
  };
}

describe("engines/dice", () => {
  describe("rollSingleDie", () => {
    it("rolls deterministically at rng boundaries", () => {
      expect(rollSingleDie(20, () => 0)).toBe(1);
      expect(rollSingleDie(20, () => 0.5)).toBe(11);
      expect(rollSingleDie(20, () => 0.999999)).toBe(20);
      expect(rollSingleDie(6, () => 0.99)).toBe(6);
    });

    it("clamps sides to [2, 1000] and falls back to 6 for invalid sides", () => {
      expect(rollSingleDie(1, () => 0.99)).toBe(2);
      expect(rollSingleDie(-5, () => 0.99)).toBe(2);
      expect(rollSingleDie(5000, () => 0.999999)).toBe(1000);
      expect(rollSingleDie("x", () => 0.99)).toBe(6);
      expect(rollSingleDie(0, () => 0.99)).toBe(6);
      expect(rollSingleDie(NaN, () => 0.99)).toBe(6);
      expect(rollSingleDie(Infinity, () => 0.99)).toBe(6);
      expect(rollSingleDie(null, () => 0.99)).toBe(6);
      expect(rollSingleDie(undefined, () => 0.99)).toBe(6);
    });

    it("throws AppError when rng is missing, wrong type, or out of [0, 1)", () => {
      expect(() => rollSingleDie(6)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
      expect(() => rollSingleDie(6, null)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
      expect(() => rollSingleDie(6, () => "0.5")).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
      expect(() => rollSingleDie(6, () => NaN)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() => rollSingleDie(6, () => Infinity)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() => rollSingleDie(6, () => -0.01)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() => rollSingleDie(6, () => 1)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
      expect(() => rollSingleDie(6, () => 1.5)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
      );
    });
  });

  describe("evaluateDiceToken", () => {
    it("validates rng upfront even for non-dice tokens", () => {
      expect(() => evaluateDiceToken("abc")).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
    });

    it("returns null for non-string or invalid dice notation", () => {
      const rng = () => 0.5;
      expect(evaluateDiceToken(null, rng)).toBeNull();
      expect(evaluateDiceToken(123, rng)).toBeNull();
      expect(evaluateDiceToken("abc", rng)).toBeNull();
      expect(evaluateDiceToken("d", rng)).toBeNull();
      expect(evaluateDiceToken("2d", rng)).toBeNull();
      expect(evaluateDiceToken("2d6+1", rng)).toBeNull();
    });

    it("evaluates standard dice tokens with omitted count, uppercase, and whitespace", () => {
      const res1 = evaluateDiceToken(" d20 ", () => 0.99);
      expect(res1).toEqual({
        notation: "d20",
        count: 1,
        sides: 20,
        keepMode: null,
        keepCount: 1,
        rawRolls: [20],
        keptRolls: [20],
        subtotal: 20,
        isCrit: true,
        isFumble: false
      });

      const res2 = evaluateDiceToken("1D8", () => 0);
      expect(res2).toEqual({
        notation: "1D8",
        count: 1,
        sides: 8,
        keepMode: null,
        keepCount: 1,
        rawRolls: [1],
        keptRolls: [1],
        subtotal: 1,
        isCrit: false,
        isFumble: false
      });
    });

    it("evaluates kh and kl keep modes and single-kept-d20 crit/fumble flags", () => {
      const advCrit = evaluateDiceToken("2d20KH1", seqRng([0.1, 0.99]));
      expect(advCrit.keepMode).toBe("kh");
      expect(advCrit.rawRolls).toEqual([3, 20]);
      expect(advCrit.keptRolls).toEqual([20]);
      expect(advCrit.subtotal).toBe(20);
      expect(advCrit.isCrit).toBe(true);
      expect(advCrit.isFumble).toBe(false);

      const disFumble = evaluateDiceToken("2d20kl1", seqRng([0.8, 0.0]));
      expect(disFumble.keepMode).toBe("kl");
      expect(disFumble.rawRolls).toEqual([17, 1]);
      expect(disFumble.keptRolls).toEqual([1]);
      expect(disFumble.subtotal).toBe(1);
      expect(disFumble.isCrit).toBe(false);
      expect(disFumble.isFumble).toBe(true);

      const twoD20 = evaluateDiceToken("2d20", seqRng([0.99, 0.0]));
      expect(twoD20.isCrit).toBe(false);
      expect(twoD20.isFumble).toBe(false);
      expect(twoD20.subtotal).toBe(21);

      const d20Normal = evaluateDiceToken("1d20", () => 0.45);
      expect(d20Normal.subtotal).toBe(10);
      expect(d20Normal.isCrit).toBe(false);
      expect(d20Normal.isFumble).toBe(false);
    });

    it("clamps count [1..100], sides [2..1000], and keepCount [1..count]", () => {
      const rng = () => 0.999999;

      const zeroCount = evaluateDiceToken("0d6", rng);
      expect(zeroCount.count).toBe(1);
      expect(zeroCount.rawRolls).toHaveLength(1);

      const maxCount = evaluateDiceToken("500d2", rng);
      expect(maxCount.count).toBe(100);
      expect(maxCount.subtotal).toBe(200);

      const minSides = evaluateDiceToken("1d1", rng);
      expect(minSides.sides).toBe(2);
      expect(minSides.subtotal).toBe(2);

      const maxSides = evaluateDiceToken("1d5000", rng);
      expect(maxSides.sides).toBe(1000);
      expect(maxSides.subtotal).toBe(1000);

      const keepHighClamped = evaluateDiceToken("2d6kh5", rng);
      expect(keepHighClamped.keepCount).toBe(2);
      expect(keepHighClamped.keptRolls).toHaveLength(2);

      const keepLowClamped = evaluateDiceToken("3d6kl0", rng);
      expect(keepLowClamped.keepCount).toBe(1);
      expect(keepLowClamped.keptRolls).toHaveLength(1);
    });
  });
});
