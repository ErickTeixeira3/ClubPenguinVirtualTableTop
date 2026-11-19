import { describe, expect, it } from "vitest";
import { DEFAULT_STORAGE_NAMESPACE } from "../../../src/infra/browserStorage.js";
import {
  PENDING_AVATAR_STORAGE_KEY,
  clearPendingAvatarDataUrl,
  createPendingAvatarStore,
  readPendingAvatarDataUrl,
  savePendingAvatarDataUrl
} from "../../../src/infra/pendingAvatarStore.js";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    }
  };
}

describe("pendingAvatarStore", () => {
  it("isola avatar pendente pelo UID e limpa quando outro usuário lê", () => {
    const storage = createMemoryStorage();
    const store = createPendingAvatarStore({ storage });

    expect(store.save("uid_a", "data:image/webp;base64,AAAA")).toBe(true);
    expect(store.read()).toBeNull();
    expect(store.read("")).toBeNull();
    expect(store.read("uid_a")).toBe("data:image/webp;base64,AAAA");
    expect(store.read("uid_b")).toBeNull();
    // Após incompatibilidade de UID, o dado anterior deve ter sido descartado
    expect(store.read("uid_a")).toBeNull();
  });

  it("rejeita dataUrl ou uid inválidos e limpa estado anterior", () => {
    const storage = createMemoryStorage();
    const store = createPendingAvatarStore({ storage });

    store.save("uid_a", "data:image/png;base64,1234");
    expect(store.save("uid_a", "https://evil.invalid/img.png")).toBe(false);
    expect(store.read("uid_a")).toBeNull();

    store.save("uid_a", "data:image/png;base64,1234");
    expect(store.save("", "data:image/png;base64,1234")).toBe(false);
    expect(storage.getItem(PENDING_AVATAR_STORAGE_KEY)).toBeNull();
  });

  it("descarta payload corrompido ou fora do padrão data:", () => {
    const storage = createMemoryStorage();
    const store = createPendingAvatarStore({ storage });

    const namespacedKey = `${DEFAULT_STORAGE_NAMESPACE}:${PENDING_AVATAR_STORAGE_KEY}`;
    storage.setItem(namespacedKey, JSON.stringify({ uid: "u1", dataUrl: "not-data" }));
    expect(store.read("u1")).toBeNull();
    expect(storage.getItem(namespacedKey)).toBeNull();
  });

  it("funciona com sessionStorage global padrão quando disponível", () => {
    const prev = globalThis.sessionStorage;
    globalThis.sessionStorage = createMemoryStorage();
    try {
      expect(savePendingAvatarDataUrl("u1", "data:image/jpeg;base64,XYZ")).toBe(true);
      expect(readPendingAvatarDataUrl("u1")).toBe("data:image/jpeg;base64,XYZ");
      clearPendingAvatarDataUrl();
      expect(readPendingAvatarDataUrl("u1")).toBeNull();
    } finally {
      globalThis.sessionStorage = prev;
    }
  });
});
