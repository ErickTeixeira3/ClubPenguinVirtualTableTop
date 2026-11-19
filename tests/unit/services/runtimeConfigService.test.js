import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const firestoreSpies = vi.hoisted(() => ({
  doc: vi.fn((_db, p) => ({
    path: p,
    withConverter: () => ({ path: p })
  })),
  onSnapshot: vi.fn()
}));

vi.mock("firebase/firestore", () => firestoreSpies);
vi.mock("../../../src/infra/firebase.js", () => ({ db: {} }));

const runtimeConfigService = await import("../../../src/services/runtimeConfigService.js");

let unregisters = [];

beforeEach(() => {
  vi.clearAllMocks();
  runtimeConfigService.setClientVersionBlocked(false);
  unregisters = [];
});

afterEach(() => {
  for (const unreg of unregisters) {
    unreg();
  }
  runtimeConfigService.setClientVersionBlocked(false);
});

describe("runtimeConfigService", () => {
  it("segue sem erro quando appConfig/runtime não existe, emitindo apenas aviso", () => {
    let snapCb;
    firestoreSpies.onSnapshot.mockImplementation((_ref, onNext) => {
      snapCb = onNext;
      return vi.fn();
    });

    const warn = vi.fn();
    const onChange = vi.fn();
    const unsub = runtimeConfigService.subscribeRuntimeConfig({
      firestoreDb: {},
      clientVersion: "2.0.0",
      onChange,
      warn
    });
    unregisters.push(unsub);

    snapCb({ exists: () => false });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      exists: false,
      config: null,
      updateRequired: false,
      clientVersion: "2.0.0"
    });
    expect(runtimeConfigService.isClientVersionBlocked()).toBe(false);
    expect(() => runtimeConfigService.assertClientUpToDate()).not.toThrow();
  });

  it("bloqueia escritas via assertClientUpToDate quando minClientVersion é superior ao cliente", () => {
    let snapCb;
    firestoreSpies.onSnapshot.mockImplementation((_ref, onNext) => {
      snapCb = onNext;
      return vi.fn();
    });

    const onChange = vi.fn();
    const unsub = runtimeConfigService.subscribeRuntimeConfig({
      firestoreDb: {},
      clientVersion: "2.0.0",
      onChange
    });
    unregisters.push(unsub);

    snapCb({
      exists: () => true,
      data: () => ({ id: "runtime", minClientVersion: "2.1.0", schemaVersion: 2 })
    });

    expect(runtimeConfigService.isClientVersionBlocked()).toBe(true);
    expect(onChange).toHaveBeenCalledWith({
      exists: true,
      config: { id: "runtime", minClientVersion: "2.1.0", schemaVersion: 2 },
      updateRequired: true,
      clientVersion: "2.0.0"
    });

    let caught;
    try {
      runtimeConfigService.assertClientUpToDate();
    } catch (err) {
      caught = err;
    }
    expect(caught?.code).toBe(ERROR_CODES.CLIENT_OUTDATED);
  });

  it("performProtectedReload faz flush quando limpo e pede confirmação quando há pendências", async () => {
    const flush = vi.fn(async () => {});
    let dirty = false;
    unregisters.push(
      runtimeConfigService.registerUnsavedGuard({
        hasUnsavedChanges: () => dirty,
        flush
      })
    );

    const reload = vi.fn();
    await expect(
      runtimeConfigService.performProtectedReload({ reload })
    ).resolves.toBe(true);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    dirty = true;
    const confirmDeny = vi.fn(async () => false);
    await expect(
      runtimeConfigService.performProtectedReload({ confirmDiscard: confirmDeny, reload })
    ).resolves.toBe(false);
    expect(confirmDeny).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);

    const confirmAllow = vi.fn(async () => true);
    await expect(
      runtimeConfigService.performProtectedReload({ confirmDiscard: confirmAllow, reload })
    ).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
