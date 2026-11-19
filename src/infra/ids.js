import { ID_PREFIXES, VALID_ID_PREFIXES } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";

export { ID_PREFIXES };

const VALID_PREFIX_SET = new Set(VALID_ID_PREFIXES);
const BASE36_6_SPACE = 36 ** 6;

export function createId(prefix, options = {}) {
  if (typeof prefix !== "string" || !VALID_PREFIX_SET.has(prefix)) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_PREFIX,
      `Invalid ID prefix: ${String(prefix)}`,
      { prefix }
    );
  }

  const safeOptions = options && typeof options === "object" ? options : {};
  const { now = Date.now, random = Math.random } = safeOptions;

  if (typeof now !== "function") {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Clock provider must be a function.",
      { now }
    );
  }

  const rawNow = now();
  if (typeof rawNow !== "number" || !Number.isFinite(rawNow) || rawNow < 0) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Clock provider must return a non-negative finite number.",
      { rawNow }
    );
  }
  const timestamp = Math.trunc(rawNow);

  if (typeof random !== "function") {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Random provider must be a function.",
      { random }
    );
  }

  const rawRandom = random();
  if (typeof rawRandom !== "number" || !Number.isFinite(rawRandom)) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Random provider must return a finite number.",
      { rawRandom }
    );
  }

  const clamped = Math.min(0.999999999999, Math.max(0, rawRandom));
  const suffix = Math.floor(clamped * BASE36_6_SPACE)
    .toString(36)
    .padStart(6, "0");

  return `${prefix}_${timestamp}_${suffix}`;
}

export function createDeterministicSaveId(msgId) {
  const trimmed = typeof msgId === "string" ? msgId.trim() : "";
  if (!trimmed || trimmed.includes("/")) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Message ID must be a non-empty string without '/'.",
      { msgId }
    );
  }
  return `${ID_PREFIXES.SAVE}_${trimmed}`;
}
