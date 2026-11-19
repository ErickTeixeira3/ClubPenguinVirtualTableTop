import { AppError, ERROR_CODES } from "../../domain/errors.js";

function assertValidRng(rng) {
  if (typeof rng !== "function") {
    throw new AppError(ERROR_CODES.INVALID_TYPE, "rng must be a function", {
      received: typeof rng
    });
  }
}

function sampleRng(rng) {
  assertValidRng(rng);
  const value = rng();
  if (typeof value !== "number") {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      "rng() must return a number",
      { received: typeof value }
    );
  }
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new AppError(
      ERROR_CODES.OUT_OF_RANGE,
      "rng() must return a finite number in [0, 1)",
      { value }
    );
  }
  return value;
}

export function rollSingleDie(sides, rng) {
  const sample = sampleRng(rng);
  const parsed = Number(sides);
  const normalized =
    Number.isFinite(parsed) && parsed !== 0 ? Math.floor(parsed) : 6;
  const maxSides = Math.min(1000, Math.max(2, normalized));
  return Math.floor(sample * maxSides) + 1;
}

export function evaluateDiceToken(tokenStr, rng) {
  assertValidRng(rng);
  if (typeof tokenStr !== "string") {
    return null;
  }
  const trimmed = tokenStr.trim();
  const match = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const count = Math.min(100, Math.max(1, Number(match[1] || 1)));
  const sides = Math.min(1000, Math.max(2, Number(match[2])));
  const keepMode = match[3] ? match[3].toLowerCase() : null;
  const keepCount = match[4]
    ? Math.min(count, Math.max(1, Number(match[4])))
    : count;

  const rawRolls = [];
  for (let i = 0; i < count; i += 1) {
    rawRolls.push(rollSingleDie(sides, rng));
  }

  let keptRolls;
  if (keepMode === "kh") {
    keptRolls = [...rawRolls].sort((a, b) => b - a).slice(0, keepCount);
  } else if (keepMode === "kl") {
    keptRolls = [...rawRolls].sort((a, b) => a - b).slice(0, keepCount);
  } else {
    keptRolls = [...rawRolls];
  }

  const subtotal = keptRolls.reduce((sum, val) => sum + val, 0);
  const isD20Check = sides === 20 && keptRolls.length === 1;
  const naturalValue = isD20Check ? keptRolls[0] : null;
  const isCrit = isD20Check && naturalValue === 20;
  const isFumble = isD20Check && naturalValue === 1;

  return {
    notation: trimmed,
    count,
    sides,
    keepMode,
    keepCount,
    rawRolls,
    keptRolls,
    subtotal,
    isCrit,
    isFumble
  };
}
