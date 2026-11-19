import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  buildCharacterVariableMap,
  validateFormulaKeys
} from "../../../../src/engines/formula/index.js";

describe("engines/formula/variables", () => {
  describe("validateFormulaKeys", () => {
    it("accepts nullish or empty character", () => {
      expect(validateFormulaKeys(null)).toEqual({ ok: true, errors: [] });
      expect(validateFormulaKeys(undefined)).toEqual({ ok: true, errors: [] });
      expect(validateFormulaKeys({})).toEqual({ ok: true, errors: [] });
    });

    it("rejects non-object character or non-object collections", () => {
      const strRes = validateFormulaKeys("invalid");
      expect(strRes.ok).toBe(false);
      expect(strRes.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

      const arrRes = validateFormulaKeys([]);
      expect(arrRes.ok).toBe(false);
      expect(arrRes.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

      const badAttrs = validateFormulaKeys({ attributes: 42, skills: "bad" });
      expect(badAttrs.ok).toBe(false);
      expect(badAttrs.errors.map((e) => e.code)).toEqual([
        ERROR_CODES.INVALID_TYPE,
        ERROR_CODES.INVALID_TYPE
      ]);
    });

    it("validates valid v2 maps and v1 arrays", () => {
      const v2 = validateFormulaKeys({
        attributes: {
          forca: { key: "forca", label: "Força", value: 3 },
          agilidade: 4
        },
        skills: {
          luta: { key: "luta", name: "Luta", bonus: 5 },
          furtividade: 2
        }
      });
      expect(v2).toEqual({ ok: true, errors: [] });

      const v1 = validateFormulaKeys({
        attributes: [{ key: "forca", label: "Força", value: 3 }],
        skills: [{ id: "sk_luta", name: "Luta", bonus: 4 }]
      });
      expect(v1).toEqual({ ok: true, errors: [] });
    });

    it("reports missing/invalid keys, unsafe prototype keys, reserved keys, and collisions", () => {
      const missingRes = validateFormulaKeys({
        attributes: [null, { key: "   ", value: 1 }, { key: "!!!", value: 2 }],
        skills: [{ name: "NoKeyOrId", bonus: 2 }]
      });
      expect(missingRes.ok).toBe(false);
      expect(missingRes.errors).toHaveLength(4);
      for (const err of missingRes.errors) {
        expect(err.code).toBe(ERROR_CODES.MISSING_REQUIRED_FIELD);
      }

      const unsafeObj = JSON.parse('{"__proto__": {"value": 1}}');
      const unsafeRes = validateFormulaKeys({
        attributes: unsafeObj,
        skills: [{ id: "constructor", bonus: 2 }]
      });
      expect(unsafeRes.ok).toBe(false);
      expect(unsafeRes.errors.map((e) => e.code)).toEqual([
        ERROR_CODES.RESERVED_KEY,
        ERROR_CODES.RESERVED_KEY
      ]);

      const reservedRes = validateFormulaKeys({
        attributes: { defesa: { key: "defesa", value: 2 } },
        skills: { nivel: { key: "nivel", bonus: 3 } }
      });
      expect(reservedRes.ok).toBe(false);
      expect(reservedRes.errors.map((e) => e.code)).toEqual([
        ERROR_CODES.RESERVED_KEY,
        ERROR_CODES.RESERVED_KEY
      ]);

      const collisionRes = validateFormulaKeys({
        attributes: [
          { key: "Força", value: 2 },
          { key: "forca", value: 4 }
        ],
        skills: [
          { key: "luta", bonus: 3 },
          { key: "LUTA", bonus: 5 },
          { key: "forca", bonus: 6 }
        ]
      });
      expect(collisionRes.ok).toBe(false);
      expect(collisionRes.errors.map((e) => e.code)).toEqual([
        ERROR_CODES.KEY_COLLISION,
        ERROR_CODES.KEY_COLLISION,
        ERROR_CODES.KEY_COLLISION
      ]);
      expect(collisionRes.errors[2].details).toMatchObject({
        kind: "skill",
        key: "forca",
        conflictWith: "attribute"
      });
    });
  });

  describe("buildCharacterVariableMap", () => {
    it("returns empty map for nullish character and throws on non-object", () => {
      expect(buildCharacterVariableMap(null)).toEqual({});
      expect(buildCharacterVariableMap(undefined)).toEqual({});
      expect(() => buildCharacterVariableMap("bad")).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
    });

    it("populates explicit keys only (never label/name aliases) and reserved character stats", () => {
      const vars = buildCharacterVariableMap({
        defense: "14",
        resources: { hp: { current: 22 }, mp: { current: 9 } },
        level: 3,
        attributes: {
          for_extra: { key: "for_extra", label: "Força Extra", value: "5" },
          agilidade: 3
        },
        skills: {
          sk_1: { key: "pontaria", name: "Pontaria Mortal", bonus: -2 },
          furtividade: { bonus: 4 }
        }
      });

      expect(vars).toEqual({
        for_extra: 5,
        agilidade: 3,
        pontaria: -2,
        furtividade: 4,
        defesa: 14,
        defense: 14,
        hp: 22,
        vida: 22,
        mp: 9,
        energia: 9,
        nivel: 3
      });
      expect(vars.forcaextra).toBeUndefined();
      expect(vars.pontariamortal).toBeUndefined();
    });

    it("falls back safely for non-finite values, v1 vitals, and level <= 0", () => {
      const vars = buildCharacterVariableMap({
        defense: " ",
        hp: { current: "18" },
        mp: 7,
        nivel: 0,
        attributes: {
          forca: { key: "forca", value: "" },
          vigor: { key: "vigor", value: null }
        },
        skills: [{ id: "sk1", name: "Luta", bonus: NaN }]
      });

      expect(vars).toEqual({
        forca: 0,
        vigor: 0,
        sk1: 0,
        defesa: 0,
        defense: 0,
        hp: 18,
        vida: 18,
        mp: 7,
        energia: 7,
        nivel: 1
      });
      expect(vars.luta).toBeUndefined();
    });

    it("throws AppError on key collision or reserved key overwrite attempt", () => {
      expect(() =>
        buildCharacterVariableMap({
          attributes: { forca: { key: "forca", value: 2 } },
          skills: { forca: { key: "forca", bonus: 4 } }
        })
      ).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.KEY_COLLISION })
      );

      expect(() =>
        buildCharacterVariableMap({
          attributes: { hp: { key: "hp", value: 99 } }
        })
      ).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.RESERVED_KEY })
      );
    });
  });
});
