import { DEFAULT_SAVING_THROW } from "../../domain/defaults.js";
import { AppError, ERROR_CODES } from "../../domain/errors.js";
import { evaluateFormula } from "../formula/index.js";

const DEFAULT_DC = Number(DEFAULT_SAVING_THROW.dcFormula);

export function evaluateDcFormula(
  dcFormula,
  sourceCharacter = null,
  options = {}
) {
  if (dcFormula === null || dcFormula === undefined) {
    return DEFAULT_DC;
  }

  if (typeof dcFormula !== "string" && typeof dcFormula !== "number") {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      "dcFormula must be a string or number",
      { received: typeof dcFormula }
    );
  }

  if (typeof dcFormula === "number") {
    if (!Number.isFinite(dcFormula)) {
      throw new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "dcFormula number must be finite",
        { dcFormula }
      );
    }
    return Math.max(0, Math.round(dcFormula));
  }

  const raw = dcFormula.trim();
  if (raw === "") {
    return DEFAULT_DC;
  }

  const asNum = Number(raw);
  if (Number.isFinite(asNum)) {
    return Math.max(0, Math.round(asNum));
  }

  const opts = options && typeof options === "object" ? options : {};
  const evaluateFormulaFn =
    typeof opts.evaluateFormulaFn === "function"
      ? opts.evaluateFormulaFn
      : evaluateFormula;

  const evaluated = evaluateFormulaFn(raw, sourceCharacter, { rng: opts.rng });

  if (!evaluated || evaluated.ok === false) {
    if (evaluated?.error instanceof AppError) {
      throw evaluated.error;
    }
    throw new AppError(
      evaluated?.error?.code || ERROR_CODES.VALIDATION_FAILED,
      evaluated?.error?.message || "Invalid DC formula",
      {
        dcFormula: raw,
        ...(evaluated?.error?.details
          ? { cause: evaluated.error.details }
          : {})
      }
    );
  }

  const total = Number(evaluated.total);
  if (!Number.isFinite(total)) {
    throw new AppError(
      ERROR_CODES.OUT_OF_RANGE,
      "Evaluated DC total is not finite",
      { dcFormula: raw, total: evaluated.total }
    );
  }

  return Math.max(0, Math.round(total));
}

export function evaluateSavingThrowOutcome(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const dcInput = src.dc;
  const rollTotalInput = src.rollTotal;

  let parsedDc = NaN;
  if (typeof dcInput === "number") {
    parsedDc = dcInput;
  } else if (typeof dcInput === "string" && dcInput.trim() !== "") {
    parsedDc = Number(dcInput.trim());
  }

  const resolvedDc = Number.isFinite(parsedDc)
    ? Math.max(0, Math.round(parsedDc))
    : DEFAULT_DC;

  const parsedTotal = Number(rollTotalInput);
  const safeTotal = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  return {
    dc: resolvedDc,
    total: safeTotal,
    passed: safeTotal >= resolvedDc
  };
}
