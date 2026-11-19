import { AppError, ERROR_CODES } from "../../domain/errors.js";

const WHITESPACE_RE = /\s+/y;
const VAR_RE = /@([\p{L}\p{N}_]+)/uy;
const DICE_WITH_COUNT_RE = /\d+d\d+(?:(?:kh|kl)\d+)?(?![a-zA-Z0-9_])/iy;
const DICE_NO_COUNT_RE = /d\d+(?:(?:kh|kl)\d+)?(?![a-zA-Z0-9_])/iy;
const NUMBER_RE = /\d+(?:\.\d+)?(?![a-zA-Z0-9_.])/y;

export function tokenizeFormula(input) {
  if (typeof input !== "string") {
    throw new AppError(ERROR_CODES.INVALID_TYPE, "Formula must be a string", {
      received: typeof input
    });
  }

  const tokens = [];
  let pos = 0;

  while (pos < input.length) {
    WHITESPACE_RE.lastIndex = pos;
    const wsMatch = WHITESPACE_RE.exec(input);
    if (wsMatch) {
      pos = WHITESPACE_RE.lastIndex;
      continue;
    }

    const ch = input[pos];

    if (ch === "(") {
      tokens.push({
        type: "LPAREN",
        value: "(",
        raw: "(",
        start: pos,
        end: pos + 1
      });
      pos += 1;
      continue;
    }

    if (ch === ")") {
      tokens.push({
        type: "RPAREN",
        value: ")",
        raw: ")",
        start: pos,
        end: pos + 1
      });
      pos += 1;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({
        type: "OP",
        value: ch,
        raw: ch,
        start: pos,
        end: pos + 1
      });
      pos += 1;
      continue;
    }

    if (ch === "@") {
      VAR_RE.lastIndex = pos;
      const varMatch = VAR_RE.exec(input);
      if (!varMatch) {
        throw new AppError(
          ERROR_CODES.INVALID_TOKEN,
          `Invalid variable token at position ${pos}`,
          { pos, token: input.slice(pos, pos + 10) }
        );
      }
      tokens.push({
        type: "VAR",
        name: varMatch[1],
        raw: varMatch[0],
        start: pos,
        end: VAR_RE.lastIndex
      });
      pos = VAR_RE.lastIndex;
      continue;
    }

    if (ch >= "0" && ch <= "9") {
      DICE_WITH_COUNT_RE.lastIndex = pos;
      const diceMatch = DICE_WITH_COUNT_RE.exec(input);
      if (diceMatch) {
        tokens.push({
          type: "DICE",
          value: diceMatch[0],
          raw: diceMatch[0],
          start: pos,
          end: DICE_WITH_COUNT_RE.lastIndex
        });
        pos = DICE_WITH_COUNT_RE.lastIndex;
        continue;
      }

      NUMBER_RE.lastIndex = pos;
      const numMatch = NUMBER_RE.exec(input);
      if (numMatch) {
        tokens.push({
          type: "NUMBER",
          value: Number(numMatch[0]),
          raw: numMatch[0],
          start: pos,
          end: NUMBER_RE.lastIndex
        });
        pos = NUMBER_RE.lastIndex;
        continue;
      }

      throw new AppError(
        ERROR_CODES.INVALID_TOKEN,
        `Invalid numeric or dice token at position ${pos}`,
        { pos, token: input.slice(pos, pos + 16) }
      );
    }

    if (ch === "d" || ch === "D") {
      DICE_NO_COUNT_RE.lastIndex = pos;
      const diceMatch = DICE_NO_COUNT_RE.exec(input);
      if (diceMatch) {
        tokens.push({
          type: "DICE",
          value: diceMatch[0],
          raw: diceMatch[0],
          start: pos,
          end: DICE_NO_COUNT_RE.lastIndex
        });
        pos = DICE_NO_COUNT_RE.lastIndex;
        continue;
      }
    }

    throw new AppError(
      ERROR_CODES.INVALID_TOKEN,
      `Unexpected character "${ch}" at position ${pos}`,
      { pos, char: ch, token: input.slice(pos, pos + 16) }
    );
  }

  return tokens;
}

export function parseFormulaTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new AppError(ERROR_CODES.INVALID_SYNTAX, "Empty formula");
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => {
    const token = tokens[pos];
    pos += 1;
    return token;
  };

  function parsePrimary() {
    const tok = peek();
    if (!tok) {
      throw new AppError(
        ERROR_CODES.INVALID_SYNTAX,
        "Unexpected end of formula"
      );
    }

    if (tok.type === "NUMBER") {
      consume();
      return {
        type: "NUMBER",
        value: tok.value,
        raw: tok.raw,
        start: tok.start,
        end: tok.end
      };
    }

    if (tok.type === "DICE") {
      consume();
      return {
        type: "DICE",
        raw: tok.raw,
        start: tok.start,
        end: tok.end
      };
    }

    if (tok.type === "VAR") {
      consume();
      return {
        type: "VAR",
        name: tok.name,
        raw: tok.raw,
        start: tok.start,
        end: tok.end
      };
    }

    if (tok.type === "LPAREN") {
      consume();
      const expr = parseExpr();
      const closing = peek();
      if (!closing || closing.type !== "RPAREN") {
        throw new AppError(ERROR_CODES.INVALID_SYNTAX, "Unmatched '('", {
          pos: tok.start
        });
      }
      consume();
      return expr;
    }

    throw new AppError(
      ERROR_CODES.INVALID_SYNTAX,
      `Unexpected token "${tok.raw}"`,
      { token: tok }
    );
  }

  function parseUnary() {
    const tok = peek();
    if (tok && tok.type === "OP" && (tok.value === "+" || tok.value === "-")) {
      consume();
      return {
        type: "UNARY",
        op: tok.value,
        operand: parseUnary()
      };
    }
    return parsePrimary();
  }

  function parseTerm() {
    let node = parseUnary();
    while (
      peek() &&
      peek().type === "OP" &&
      (peek().value === "*" || peek().value === "/")
    ) {
      const op = consume().value;
      const right = parseUnary();
      node = { type: "BINARY", op, left: node, right };
    }
    return node;
  }

  function parseExpr() {
    let node = parseTerm();
    while (
      peek() &&
      peek().type === "OP" &&
      (peek().value === "+" || peek().value === "-")
    ) {
      const op = consume().value;
      const right = parseTerm();
      node = { type: "BINARY", op, left: node, right };
    }
    return node;
  }

  const ast = parseExpr();
  if (pos < tokens.length) {
    throw new AppError(
      ERROR_CODES.INVALID_SYNTAX,
      `Unexpected trailing token "${tokens[pos].raw}"`,
      { token: tokens[pos] }
    );
  }

  return ast;
}
