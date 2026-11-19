import { createNamespacedStorage } from "./browserStorage.js";

export const PENDING_AVATAR_STORAGE_KEY = "pending_avatar_dataurl";

function resolveSessionBackend(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // Fallback to globalThis
  }
  try {
    if (typeof globalThis !== "undefined" && globalThis.sessionStorage) {
      return globalThis.sessionStorage;
    }
  } catch {
    // Ignore storage access restriction
  }
  return null;
}

export function createPendingAvatarStore({ storage = null, onError = null } = {}) {
  const getStore = () =>
    createNamespacedStorage({
      storage: resolveSessionBackend(storage),
      onError
    });

  const clear = () => {
    return getStore().remove(PENDING_AVATAR_STORAGE_KEY);
  };

  const save = (uid, dataUrl) => {
    const cleanUid = typeof uid === "string" ? uid.trim() : "";
    if (!cleanUid || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      clear();
      return false;
    }
    return getStore().setJson(PENDING_AVATAR_STORAGE_KEY, {
      uid: cleanUid,
      dataUrl
    });
  };

  const read = (expectedUid = null) => {
    const cleanExpected = typeof expectedUid === "string" ? expectedUid.trim() : "";
    if (!cleanExpected) {
      return null;
    }
    const store = getStore();
    const parsed = store.getJson(PENDING_AVATAR_STORAGE_KEY, null);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.dataUrl !== "string" || !parsed.dataUrl.startsWith("data:")) {
      clear();
      return null;
    }
    if (parsed.uid !== cleanExpected) {
      clear();
      return null;
    }
    return parsed.dataUrl;
  };

  return Object.freeze({
    save,
    read,
    clear
  });
}

const defaultPendingAvatarStore = createPendingAvatarStore();

export function clearPendingAvatarDataUrl() {
  return defaultPendingAvatarStore.clear();
}

export function savePendingAvatarDataUrl(uid, dataUrl) {
  return defaultPendingAvatarStore.save(uid, dataUrl);
}

export function readPendingAvatarDataUrl(expectedUid = null) {
  return defaultPendingAvatarStore.read(expectedUid);
}
