import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  parseFormulaTokens,
  tokenizeFormula
} from "../../../../src/engines/formula/parser.js";

describe("engines/formula/parser", () => {
  describe("tokenizeFormula", () => {
    it("throws INVALID_TYPE when input is not a string", () => {
      expect(() => tokenizeFormula(123)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_TYPE })
      );
    });

    it("tokenizes numbers, dice, accented variables, operators, and parens", () => {
      const tokens = tokenizeFormula("-(2d20kh1 + d6) * @Força_1 / 2.5");
      expect(tokens.map((t) => [t.type, t.raw])).toEqual([
        ["OP", "-"],
        ["LPAREN", "("],
        ["DICE", "2d20kh1"],
        ["OP", "+"],
        ["DICE", "d6"],
        ["RPAREN", ")"],
        ["OP", "*"],
        ["VAR", "@Força_1"],
        ["OP", "/"],
        ["NUMBER", "2.5"]
      ]);
    });

    it("rejects invalid tokens instead of skipping characters", () => {
      const badTokens = [
        "2x3",
        "1.2.3",
        ".5",
        "2.",
        "@",
        "@!",
        "2d",
        "d",
        "2d6kh",
        "2d6kh1x",
        "d20x",
        "1e5",
        "abc"
      ];
      for (const expr of badTokens) {
        expect(() => tokenizeFormula(expr)).toThrowError(
          expect.objectContaining({ code: ERROR_CODES.INVALID_TOKEN })
        );
      }
    });
  });

  describe("parseFormulaTokens", () => {
    it("parses valid expressions into AST", () => {
      const ast = parseFormulaTokens(tokenizeFormula("1 + -2 * (3 + @forca)"));
      expect(ast.type).toBe("BINARY");
      expect(ast.op).toBe("+");
      expect(ast.right.type).toBe("BINARY");
      expect(ast.right.op).toBe("*");
      expect(ast.right.left).toEqual({
        type: "UNARY",
        op: "-",
        operand: { type: "NUMBER", value: 2, raw: "2", start: 5, end: 6 }
      });
    });

    it("rejects empty tokens and syntax errors", () => {
      expect(() => parseFormulaTokens([])).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_SYNTAX })
      );
      expect(() => parseFormulaTokens(null)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_SYNTAX })
      );

      const badSyntax = [
        "(",
        ")",
        "(1+2",
        "1+2)",
        "1+*2",
        "1 2",
        "2(3)",
        "(2)(3)",
        "2 @forca",
        "()",
        "+",
        "-"
      ];
      for (const expr of badSyntax) {
        expect(() => parseFormulaTokens(tokenizeFormula(expr))).toThrowError(
          expect.objectContaining({ code: ERROR_CODES.INVALID_SYNTAX })
        );
      }
    });
  });
});
