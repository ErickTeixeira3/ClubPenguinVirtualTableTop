export function doubleDiceInFormula(formulaStr) {
  const raw = String(formulaStr ?? "").trim();
  if (!raw) {
    return "";
  }
  return raw.replace(
    /\b(\d*)d(\d+)((?:kh|kl)\d+)?\b/gi,
    (_, countText, facesText, keepText) => {
      const count = countText ? Math.max(1, parseInt(countText, 10)) : 1;
      return `${count * 2}d${facesText}${keepText || ""}`;
    }
  );
}

export function applyD20ModeToFormula(
  formulaStr,
  mode = "normal",
  extraBonus = ""
) {
  let result = String(formulaStr ?? "1d20").trim() || "1d20";

  if (mode === "advantage" || mode === "disadvantage") {
    const replacement = mode === "advantage" ? "2d20kh1" : "2d20kl1";
    const singleD20Regex = /\b1?d20\b/i;
    if (singleD20Regex.test(result)) {
      result = result.replace(singleD20Regex, replacement);
    } else {
      result = `${replacement} + (${result})`;
    }
  }

  const trimmedExtra = String(extraBonus ?? "").trim();
  if (trimmedExtra) {
    if (/^[+-]/.test(trimmedExtra)) {
      result = `${result} ${trimmedExtra}`;
    } else {
      result = `${result} + (${trimmedExtra})`;
    }
  }

  return result;
}

export function composeDamageFormula(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const isCrit = Boolean(src.isCrit);
  const base = String(src.baseFormula ?? "").trim();
  const crit = String(src.critFormula ?? "").trim();

  const core = isCrit
    ? crit || (base ? doubleDiceInFormula(base) : "")
    : base;

  const rawExtra = String(src.extraDamage ?? "").trim();
  const extra = rawExtra
    ? isCrit
      ? doubleDiceInFormula(rawExtra)
      : rawExtra
    : "";

  const triggers = (
    Array.isArray(src.triggerFormulas) ? src.triggerFormulas : []
  )
    .map((entry) => {
      const raw = String(
        typeof entry === "string" ? entry : (entry?.formula ?? "")
      ).trim();
      if (!raw) {
        return "";
      }
      return isCrit ? doubleDiceInFormula(raw) : raw;
    })
    .filter(Boolean);

  const parts = [core, extra, ...triggers].filter(Boolean);
  if (parts.length === 0) {
    return "";
  }

  return parts.reduce((acc, part, index) => {
    if (index === 0) {
      return part;
    }
    return /^[+-]/.test(part) ? `${acc} ${part}` : `${acc} + ${part}`;
  }, "");
}
