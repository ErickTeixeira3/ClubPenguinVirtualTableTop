import { describe, expect, it } from "vitest";
import {
  AppError,
  ERROR_CODES,
  validationFail,
  validationOk
} from "../../../src/domain/errors.js";

describe("domain/errors", () => {
  it("freezes ERROR_CODES with matching non-empty string keys and values", () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
    expect(Object.keys(ERROR_CODES).length).toBeGreaterThan(10);
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toBe(key);
    }
    expect(() => {
      ERROR_CODES.NEW_CODE = "NEW_CODE";
    }).toThrow(TypeError);
  });

  it("constructs AppError extending Error with code, message, details, and cause", () => {
    const cause = new Error("root cause");
    const err = new AppError(
      ERROR_CODES.INVALID_AUDIENCE,
      "Bad audience",
      { field: "visibleTo" },
      { cause }
    );

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("AppError");
    expect(err.code).toBe(ERROR_CODES.INVALID_AUDIENCE);
    expect(err.message).toBe("Bad audience");
    expect(err.details).toEqual({ field: "visibleTo" });
    expect(err.cause).toBe(cause);
    expect(typeof err.stack).toBe("string");
  });

  it("applies default code fallback and preserves falsy non-nullish details", () => {
    const omitted = new AppError(undefined, "Missing code");
    expect(omitted.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(omitted.details).toBeNull();

    const emptyCode = new AppError("", "Empty code", 0);
    expect(emptyCode.code).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(emptyCode.details).toBe(0);

    const falseDetails = new AppError(ERROR_CODES.OUT_OF_RANGE, "Out", false);
    expect(falseDetails.details).toBe(false);
  });

  it("builds validation results via validationOk and validationFail", () => {
    expect(validationOk()).toEqual({ ok: true, errors: [] });

    const e1 = new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "Missing A");
    const e2 = new AppError(ERROR_CODES.INVALID_TYPE, "Invalid B");

    expect(validationFail(e1)).toEqual({ ok: false, errors: [e1] });
    expect(validationFail([e1, e2])).toEqual({ ok: false, errors: [e1, e2] });
    expect(validationFail([null, e1, undefined])).toEqual({
      ok: false,
      errors: [e1]
    });
    expect(validationFail(null)).toEqual({ ok: false, errors: [] });
  });
});
