// @vitest-environment jsdom
// Regressão portada de auditoria_refatoracao/validar-regressoes.mjs: A12-A13.
// Sem BroadcastChannel, o transporte entre janelas usa localStorage + evento `storage` (decisão A13).
// O navegador só entrega o evento `storage` às OUTRAS janelas; aqui as duas "janelas" vivem no mesmo
// documento, então o armazenamento de teste dispara o evento a cada gravação (como no script original).
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCrossWindowSync } from "../../src/hooks/useCrossWindowSync.js";

function createBroadcastingStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      const str = String(value);
      map.set(key, str);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: str }));
    },
    removeItem: (key) => map.delete(key),
    clear: () => map.clear()
  };
}

const originals = {};

beforeEach(() => {
  originals.broadcast = window.BroadcastChannel;
  originals.storage = Object.getOwnPropertyDescriptor(window, "localStorage");
  window.BroadcastChannel = undefined;
  Object.defineProperty(window, "localStorage", { configurable: true, value: createBroadcastingStorage() });
});

afterEach(() => {
  cleanup();
  window.BroadcastChannel = originals.broadcast;
  Object.defineProperty(window, "localStorage", originals.storage);
});

describe("A12-A13: sincronização de alvos entre janelas sem BroadcastChannel", () => {
  it("entrega a lista completa de alvos e depois a redução", () => {
    let received = [];
    const sender = renderHook(() =>
      useCrossWindowSync({ campaignId: "main-table", targetedTokens: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] })
    );
    renderHook(() =>
      useCrossWindowSync({
        campaignId: "main-table",
        targetedTokens: [],
        onTargetsReceived: ({ targetedTokens }) => {
          received = targetedTokens.map((t) => t.id);
        }
      })
    );

    act(() => {
      sender.result.current.broadcastTargets([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
    });
    expect(received).toEqual(["t1", "t2", "t3"]);

    act(() => {
      sender.result.current.broadcastTargets([{ id: "t1" }, { id: "t3" }]);
    });
    expect(received).toEqual(["t1", "t3"]);
  });
});
