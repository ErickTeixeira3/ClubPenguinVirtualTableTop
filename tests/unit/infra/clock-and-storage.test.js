import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import {
  assertValidStorageKey,
  createMemoryStorage,
  createNamespacedStorage
} from "../../../src/infra/browserStorage.js";
import {
  computeServerTime,
  createClock,
  createFixedClock,
  now
} from "../../../src/infra/clock.js";

describe("clock", () => {
  it("fornece relógio fixo determinístico e calcula tempo do servidor", () => {
    const fixed = createFixedClock(1000);
    expect(now(fixed)).toBe(1000);
    expect(fixed.advance(250)).toBe(1250);
    expect(fixed.set(5000)).toBe(5000);
    expect(computeServerTime(fixed.now(), -300)).toBe(4700);
    expect(computeServerTime(5000, Number.NaN)).toBe(5000);

    const custom = createClock(() => 777);
    expect(custom.now()).toBe(777);
  });

  it("rejeita relógios inválidos ou timestamps negativos", () => {
    expect(() => now(() => -1)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.INVALID_ID_INPUT })
    );
    expect(() => createClock("nope")).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.INVALID_ID_INPUT })
    );
    expect(() => createFixedClock(-5)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
    );
    const fixed = createFixedClock(10);
    expect(() => fixed.advance(-20)).toThrowError(
      expect.objectContaining({ code: ERROR_CODES.OUT_OF_RANGE })
    );
  });
});

describe("browserStorage", () => {
  it("isola chaves por namespace e manipula JSON com segurança", () => {
    const backend = createMemoryStorage();
    const store = createNamespacedStorage({ storage: backend, namespace: "cpvtt_test" });

    expect(store.isAvailable()).toBe(true);
    expect(store.formatKey("prefs:camp_1")).toBe("cpvtt_test:prefs:camp_1");

    expect(store.setJson("prefs:camp_1", { zoom: 1.25 })).toBe(true);
    expect(backend.getItem("cpvtt_test:prefs:camp_1")).toBe('{"zoom":1.25}');
    expect(store.getJson("prefs:camp_1")).toEqual({ zoom: 1.25 });
    expect(store.keys()).toEqual(["prefs:camp_1"]);

    expect(store.remove("prefs:camp_1")).toBe(true);
    expect(store.getJson("prefs:camp_1", { zoom: 1 })).toEqual({ zoom: 1 });

    store.setRaw("a:camp_1", "1");
    store.setRaw("b:camp_1", "2");
    expect(store.clearNamespace()).toBe(2);
    expect(store.keys()).toEqual([]);
  });

  it("recusa chaves vazias ou com sufixo/segmento default (INT-15)", () => {
    for (const badKey of ["", " ", "default", "targets_default", "camp:default", " camp"]) {
      expect(() => assertValidStorageKey(badKey)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
  });

  it("notifica onError em vez de engolir falhas de JSON ou de escrita", () => {
    const onError = vi.fn();
    const failingBackend = {
      getItem: () => "{invalido",
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {}
    };
    const store = createNamespacedStorage({ storage: failingBackend, onError });
    expect(store.getJson("camp_1:prefs", { ok: false })).toEqual({ ok: false });
    expect(store.setRaw("camp_1:prefs", "x")).toBe(false);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
