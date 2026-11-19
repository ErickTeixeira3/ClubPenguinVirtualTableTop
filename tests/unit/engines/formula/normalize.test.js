import { describe, expect, it } from "vitest";
import {
  normalizeFormulaKey,
  stripAccents
} from "../../../../src/engines/formula/index.js";

describe("engines/formula/normalize", () => {
  it("strips accents and handles nullish inputs", () => {
    expect(stripAccents(null)).toBe("");
    expect(stripAccents(undefined)).toBe("");
    expect(stripAccents("")).toBe("");
    expect(stripAccents("Força & Espírito Ágil")).toBe(
      "Forca & Espirito Agil"
    );
  });

  it("normalizes formula keys preserving underscores and stripping other punctuation", () => {
    expect(normalizeFormulaKey(null)).toBe("");
    expect(normalizeFormulaKey(undefined)).toBe("");
    expect(normalizeFormulaKey("Força")).toBe("forca");
    expect(normalizeFormulaKey("Furtividade Urbana")).toBe(
      "furtividadeurbana"
    );
    expect(normalizeFormulaKey("forca_extra")).toBe("forca_extra");
    expect(normalizeFormulaKey("Pré-requisito 2!")).toBe("prerequisito2");
  });
});
