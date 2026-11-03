import { evaluateDiceToken } from "./diceEngine";

function normalizeKey(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

// Extrai um mapa plano de variáveis (@forca, @agilidade, @luta, @defesa, @vida, etc.) da ficha
export function buildCharacterVariableMap(character) {
  const vars = {};
  if (!character) return vars;

  // 1. Atributos (suporta objeto chave->valor ou lista de objetos { key, label, value })
  const attrs = character.attributes || {};
  if (Array.isArray(attrs)) {
    attrs.forEach((a) => {
      const val = Number(a.value) || 0;
      if (a.key) vars[normalizeKey(a.key)] = val;
      if (a.label) vars[normalizeKey(a.label)] = val;
    });
  } else {
    Object.entries(attrs).forEach(([k, v]) => {
      const val = typeof v === "object" ? Number(v?.value) || 0 : Number(v) || 0;
      vars[normalizeKey(k)] = val;
      if (typeof v === "object" && v?.label) {
        vars[normalizeKey(v.label)] = val;
      }
    });
  }

  // 2. Perícias / Skills (soma atributo base + bônus ou bônus direto)
  const skills = character.skills || [];
  if (Array.isArray(skills)) {
    skills.forEach((s) => {
      const bonus = Number(s.bonus) || 0;
      vars[normalizeKey(s.name || s.id)] = bonus;
    });
  } else {
    Object.entries(skills).forEach(([k, s]) => {
      const bonus = Number(s?.bonus ?? s) || 0;
      vars[normalizeKey(k)] = bonus;
      if (s?.label) vars[normalizeKey(s.label)] = bonus;
    });
  }

  // 3. Recursos e Defesa
  vars.defesa = Number(character.defense) || 0;
  vars.defense = Number(character.defense) || 0;
  vars.hp = Number(character.resources?.hp?.current) || 0;
  vars.vida = Number(character.resources?.hp?.current) || 0;
  vars.mp = Number(character.resources?.mp?.current) || 0;
  vars.energia = Number(character.resources?.mp?.current) || 0;
  vars.nivel = Number(character.level) || 1;

  return vars;
}

function safeMathEval(expr) {
  // Parser matemático recursivo puro (Zero eval, 100% aderente a Content Security Policy)
  const tokens = [];
  const regex = /\s*([0-9]+(?:\.[0-9]+)?|[+\-*/()])\s*/g;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(match[1]);
  }

  let pos = 0;
  function peek() {
    return tokens[pos];
  }
  function consume(expected) {
    const token = tokens[pos];
    if (expected && token !== expected) {
      throw new Error(`Expected ${expected}`);
    }
    pos += 1;
    return token;
  }

  function parseExpression() {
    let val = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      if (op === "+") val += right;
      else val -= right;
    }
    return val;
  }

  function parseTerm() {
    let val = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (op === "*") val *= right;
      else val = right !== 0 ? val / right : 0;
    }
    return val;
  }

  function parseFactor() {
    const token = peek();
    if (token === "+") {
      consume();
      return parseFactor();
    }
    if (token === "-") {
      consume();
      return -parseFactor();
    }
    if (token === "(") {
      consume("(");
      const val = parseExpression();
      if (peek() === ")") consume(")");
      return val;
    }
    const num = Number(consume());
    return Number.isFinite(num) ? num : 0;
  }

  try {
    if (tokens.length === 0) return 0;
    const res = parseExpression();
    return Number.isFinite(res) ? Math.round(res * 100) / 100 : 0;
  } catch {
    return 0;
  }
}

export function evaluateFormula(formulaStr, character = null) {
  const original = String(formulaStr || "").trim() || "1d20";
  const varMap = buildCharacterVariableMap(character);

  // 1. Substitui variáveis @nome pelo valor correspondente na ficha
  const withVarsResolved = original.replace(/@([a-zA-Z0-9_À-ÿ]+)/g, (_, rawName) => {
    const key = normalizeKey(rawName);
    const val = varMap[key] ?? 0;
    return val < 0 ? `(${val})` : String(val);
  });

  // 2. Rola todas as expressões de dados NdX(khY/klY)
  const diceBreakdown = [];
  let isCrit = false;
  let isFumble = false;

  const withDiceResolved = withVarsResolved.replace(
    /\b(\d*d\d+(?:(?:kh|kl)\d+)?)\b/gi,
    (match) => {
      const rolled = evaluateDiceToken(match);
      if (!rolled) return "0";
      diceBreakdown.push(rolled);
      if (rolled.isCrit) isCrit = true;
      if (rolled.isFumble) isFumble = true;
      return String(rolled.subtotal);
    }
  );

  // 3. Calcula resultado matemático final
  const total = safeMathEval(withDiceResolved);

  return {
    formulaOriginal: original,
    formulaResolved: withVarsResolved,
    expressionFinal: withDiceResolved,
    diceBreakdown,
    total,
    isCrit,
    isFumble
  };
}

