import { AppError, ERROR_CODES } from "../../domain/errors.js";
import { evaluateDiceToken } from "../dice/index.js";
import { normalizeFormulaKey, UNSAFE_KEYS } from "./normalize.js";
import { parseFormulaTokens, tokenizeFormula } from "./parser.js";
import { buildCharacterVariableMap } from "./variables.js";

function formatResolvedNumber(value) {
  return value < 0 ? `(${value})` : String(value);
}

function applySpanReplacements(source, replacements) {
  if (replacements.length === 0) {
    return source;
  }
  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const rep of sorted) {
    result += source.slice(cursor, rep.start) + rep.text;
    cursor = rep.end;
  }
  result += source.slice(cursor);
  return result;
}

function evaluateAstNode(node, varValues, diceValues, original) {
  switch (node.type) {
    case "NUMBER":
      return node.value;
    case "VAR":
      return varValues.get(node.start);
    case "DICE":
      return diceValues.get(node.start);
    case "UNARY": {
      const inner = evaluateAstNode(node.operand, varValues, diceValues, original);
      return node.op === "-" ? -inner : inner;
    }
    case "BINARY": {
      const left = evaluateAstNode(node.left, varValues, diceValues, original);
      const right = evaluateAstNode(node.right, varValues, diceValues, original);
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      if (right === 0) {
        throw new AppError(ERROR_CODES.DIVISION_BY_ZERO, "Division by zero", {
          formula: original
        });
      }
      return left / right;
    }
    default:
      throw new AppError(ERROR_CODES.INVALID_SYNTAX, "Unknown AST node", {
        nodeType: node.type
      });
  }
}

export function evaluateFormula(formulaStr, character = null, options = {}) {
  if (
    options !== undefined &&
    options !== null &&
    (typeof options !== "object" || Array.isArray(options))
  ) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_TYPE,
        message: "options must be an object",
        details: { received: Array.isArray(options) ? "array" : typeof options }
      }
    };
  }

  const opts = options ?? {};
  if (opts.rng !== undefined && typeof opts.rng !== "function") {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_TYPE,
        message: "rng must be a function",
        details: { received: typeof opts.rng }
      }
    };
  }
  if (
    opts.rollDiceToken !== undefined &&
    typeof opts.rollDiceToken !== "function"
  ) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_TYPE,
        message: "rollDiceToken must be a function",
        details: { received: typeof opts.rollDiceToken }
      }
    };
  }

  let original;
  if (formulaStr === null || formulaStr === undefined) {
    original = "1d20";
  } else if (typeof formulaStr !== "string") {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_TYPE,
        message: "formulaStr must be a string",
        details: { received: typeof formulaStr }
      }
    };
  } else {
    original = formulaStr.trim() || "1d20";
  }

  try {
    const varMap = buildCharacterVariableMap(character);
    const tokens = tokenizeFormula(original);
    const ast = parseFormulaTokens(tokens);

    const varValues = new Map();
    const resolvedReplacements = [];

    for (const tok of tokens) {
      if (tok.type !== "VAR") {
        continue;
      }
      const key = normalizeFormulaKey(tok.name);
      if (!key || UNSAFE_KEYS.has(key) || !Object.hasOwn(varMap, key)) {
        throw new AppError(
          ERROR_CODES.UNKNOWN_VARIABLE,
          `Unknown variable: @${tok.name}`,
          { variable: tok.name, normalizedKey: key }
        );
      }
      const val = varMap[key];
      varValues.set(tok.start, val);
      resolvedReplacements.push({
        start: tok.start,
        end: tok.end,
        text: formatResolvedNumber(val)
      });
    }

    const roller =
      opts.rollDiceToken ?? ((notation, rngFn) => evaluateDiceToken(notation, rngFn));
    const diceValues = new Map();
    const finalReplacements = [...resolvedReplacements];
    const diceBreakdown = [];
    let isCrit = false;
    let isFumble = false;

    for (const tok of tokens) {
      if (tok.type !== "DICE") {
        continue;
      }
      const rolled = roller(tok.raw, opts.rng);
      if (
        !rolled ||
        typeof rolled !== "object" ||
        !Number.isFinite(rolled.subtotal)
      ) {
        throw new AppError(
          ERROR_CODES.INVALID_DICE_NOTATION,
          `Invalid dice evaluation for token "${tok.raw}"`,
          { token: tok.raw }
        );
      }
      diceBreakdown.push(rolled);
      if (rolled.isCrit) {
        isCrit = true;
      }
      if (rolled.isFumble) {
        isFumble = true;
      }
      diceValues.set(tok.start, rolled.subtotal);
      finalReplacements.push({
        start: tok.start,
        end: tok.end,
        text: formatResolvedNumber(rolled.subtotal)
      });
    }

    const rawTotal = evaluateAstNode(ast, varValues, diceValues, original);
    if (!Number.isFinite(rawTotal)) {
      throw new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Formula result is out of finite range",
        { formula: original }
      );
    }

    const rounded = Math.round(rawTotal * 100) / 100;
    const total = Object.is(rounded, -0) ? 0 : rounded;

    return {
      ok: true,
      formulaOriginal: original,
      formulaResolved: applySpanReplacements(original, resolvedReplacements),
      expressionFinal: applySpanReplacements(original, finalReplacements),
      diceBreakdown,
      total,
      isCrit,
      isFumble
    };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details ?? null
        }
      };
    }
    return {
      ok: false,
      error: {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: err?.message || "Formula evaluation failed",
        details: null
      }
    };
  }
}
