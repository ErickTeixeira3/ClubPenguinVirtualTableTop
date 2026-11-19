import { describe, expect, it } from "vitest";
import { VALID_ID_PREFIXES } from "../../../src/domain/constants.js";
import { AppError, ERROR_CODES } from "../../../src/domain/errors.js";
import {
  ID_PREFIXES,
  createDeterministicSaveId,
  createId
} from "../../../src/infra/ids.js";

describe("infra/ids", () => {
  it("re-exports ID_PREFIXES and generates valid IDs for every registered prefix", () => {
    expect(ID_PREFIXES.CHARACTER).toBe("char");
    for (const prefix of VALID_ID_PREFIXES) {
      const id = createId(prefix, {
        now: () => 1700000000000,
        random: () => 0.5
      });
      expect(id).toMatch(new RegExp(`^${prefix}_1700000000000_[0-9a-z]{6}$`));
    }
  });

  it("pads and clamps random outputs deterministically across boundaries", () => {
    expect(
      createId(ID_PREFIXES.CHARACTER, {
        now: () => 0,
        random: () => 0
      })
    ).toBe("char_0_000000");

    expect(
      createId(ID_PREFIXES.TOKEN, {
        now: () => 1234.9,
        random: () => -0.5
      })
    ).toBe("tok_1234_000000");

    expect(
      createId(ID_PREFIXES.NOTE, {
        now: () => 42,
        random: () => 1
      })
    ).toBe("note_42_zzzzzz");

    const defaultId = createId(ID_PREFIXES.MESSAGE);
    expect(defaultId).toMatch(/^msg_\d+_[0-9a-z]{6}$/);

    const nullOptionsId = createId(ID_PREFIXES.MESSAGE, null);
    expect(nullOptionsId).toMatch(/^msg_\d+_[0-9a-z]{6}$/);
  });

  it("rejects unknown or invalid prefixes with INVALID_ID_PREFIX", () => {
    for (const bad of ["", "  ", null, undefined, 123, "unknown_prefix"]) {
      expect(() => createId(bad)).toThrow(AppError);
      try {
        createId(bad);
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_ID_PREFIX);
      }
    }
  });

  it("rejects invalid clock or random providers with INVALID_ID_INPUT", () => {
    for (const badNow of [
      () => NaN,
      () => -1,
      () => -0.5,
      () => Infinity,
      () => null,
      () => "",
      () => false,
      null
    ]) {
      expect(() =>
        createId(ID_PREFIXES.CHARACTER, { now: badNow, random: () => 0.5 })
      ).toThrow(AppError);
      try {
        createId(ID_PREFIXES.CHARACTER, { now: badNow, random: () => 0.5 });
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_ID_INPUT);
      }
    }

    for (const badRand of [
      () => NaN,
      () => Infinity,
      () => -Infinity,
      () => null,
      () => "",
      () => false,
      null
    ]) {
      expect(() =>
        createId(ID_PREFIXES.CHARACTER, { now: () => 1, random: badRand })
      ).toThrow(AppError);
      try {
        createId(ID_PREFIXES.CHARACTER, { now: () => 1, random: badRand });
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_ID_INPUT);
      }
    }
  });

  it("creates deterministic save IDs and rejects invalid message IDs", () => {
    const a = createDeterministicSaveId("msg_123");
    const b = createDeterministicSaveId("  msg_123  ");
    expect(a).toBe("save_msg_123");
    expect(b).toBe(a);

    for (const bad of ["", "   ", null, undefined, 123, "a/b"]) {
      expect(() => createDeterministicSaveId(bad)).toThrow(AppError);
      try {
        createDeterministicSaveId(bad);
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_ID_INPUT);
      }
    }
  });
});
