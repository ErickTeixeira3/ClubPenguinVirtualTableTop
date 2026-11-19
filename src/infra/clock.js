import { AppError, ERROR_CODES } from "../domain/errors.js";

export const systemClock = Object.freeze({
  now: () => Date.now()
});

export function now(clock = systemClock) {
  const fn = typeof clock === "function" ? clock : clock?.now;
  if (typeof fn !== "function") {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Clock provider must be a function or object with now().",
      { clock }
    );
  }
  const value = fn();
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Clock provider must return a non-negative finite number.",
      { value }
    );
  }
  return value;
}

export function createClock(nowFn = Date.now) {
  if (typeof nowFn !== "function") {
    throw new AppError(
      ERROR_CODES.INVALID_ID_INPUT,
      "Clock nowFn must be a function.",
      { nowFn }
    );
  }
  return Object.freeze({
    now: () => now(nowFn)
  });
}

export function createFixedClock(initialMs = 0) {
  let currentMs = Number(initialMs);
  if (!Number.isFinite(currentMs) || currentMs < 0) {
    throw new AppError(
      ERROR_CODES.OUT_OF_RANGE,
      "Initial clock timestamp must be a non-negative finite number.",
      { initialMs }
    );
  }
  return {
    now: () => currentMs,
    set: (nextMs) => {
      if (typeof nextMs !== "number" || !Number.isFinite(nextMs) || nextMs < 0) {
        throw new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Clock timestamp must be a non-negative finite number.",
          { nextMs }
        );
      }
      currentMs = nextMs;
      return currentMs;
    },
    advance: (deltaMs) => {
      if (typeof deltaMs !== "number" || !Number.isFinite(deltaMs) || currentMs + deltaMs < 0) {
        throw new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Clock advance delta must produce a non-negative finite number.",
          { deltaMs, currentMs }
        );
      }
      currentMs += deltaMs;
      return currentMs;
    }
  };
}

export function computeServerTime(localNowMs, serverOffsetMs = 0) {
  if (typeof localNowMs !== "number" || !Number.isFinite(localNowMs)) {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      "localNowMs must be a finite number.",
      { localNowMs }
    );
  }
  const offset =
    typeof serverOffsetMs === "number" && Number.isFinite(serverOffsetMs)
      ? serverOffsetMs
      : 0;
  return localNowMs + offset;
}
