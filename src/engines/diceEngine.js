// Gerador criptograficamente seguro para dados de RPG
export function rollSingleDie(sides) {
  const maxSides = Math.max(2, Math.floor(Number(sides) || 6));
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % maxSides) + 1;
  }
  return Math.floor(Math.random() * maxSides) + 1;
}

// Interpreta expressões de dado como "2d6", "1d20", "2d20kh1", "2d20kl1"
export function evaluateDiceToken(tokenStr) {
  const match = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/i.exec(tokenStr.trim());
  if (!match) return null;

  const count = Math.min(100, Math.max(1, Number(match[1] || 1)));
  const sides = Math.min(1000, Math.max(2, Number(match[2] || 20)));
  const keepMode = match[3] ? match[3].toLowerCase() : null;
  const keepCount = match[4]
    ? Math.min(count, Math.max(1, Number(match[4])))
    : count;

  const rawRolls = [];
  for (let i = 0; i < count; i += 1) {
    rawRolls.push(rollSingleDie(sides));
  }

  let keptRolls = [...rawRolls];
  if (keepMode === "kh") {
    keptRolls = [...rawRolls].sort((a, b) => b - a).slice(0, keepCount);
  } else if (keepMode === "kl") {
    keptRolls = [...rawRolls].sort((a, b) => a - b).slice(0, keepCount);
  }

  const subtotal = keptRolls.reduce((acc, v) => acc + v, 0);
  const isD20Check = sides === 20 && keptRolls.length === 1;
  const naturalValue = isD20Check ? keptRolls[0] : null;

  return {
    notation: tokenStr,
    count,
    sides,
    keepMode,
    keepCount,
    rawRolls,
    keptRolls,
    subtotal,
    isCrit: isD20Check && naturalValue === 20,
    isFumble: isD20Check && naturalValue === 1
  };
}

