import { AppError, ERROR_CODES } from "../domain/errors.js";

export const DEFAULT_STORAGE_NAMESPACE = "cpvtt";

const FORBIDDEN_DEFAULT_KEY_SEGMENT = /(^|:|_)default($|:|_)/i;

export function assertValidStorageKey(key) {
  if (typeof key !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "Storage key must be a non-empty string.",
      { key }
    );
  }
  const trimmed = key.trim();
  if (!trimmed || trimmed !== key || FORBIDDEN_DEFAULT_KEY_SEGMENT.test(trimmed)) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `Invalid or unscoped storage key "${key}".`,
      { key }
    );
  }
  return trimmed;
}

export function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      if (!Number.isInteger(index) || index < 0 || index >= store.size) {
        return null;
      }
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      store.set(String(k), String(v));
    },
    removeItem(k) {
      store.delete(String(k));
    },
    clear() {
      store.clear();
    }
  };
}

function resolveBrowserStorage(kind) {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    const candidate = window[kind];
    if (
      !candidate ||
      typeof candidate.getItem !== "function" ||
      typeof candidate.setItem !== "function" ||
      typeof candidate.removeItem !== "function"
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

export function createNamespacedStorage({
  storage = null,
  storageKind = null,
  namespace = DEFAULT_STORAGE_NAMESPACE,
  onError = null
} = {}) {
  const safeNamespace =
    typeof namespace === "string" && namespace.trim()
      ? namespace.trim()
      : DEFAULT_STORAGE_NAMESPACE;
  const prefix = `${safeNamespace}:`;

  const getBackend = () => {
    if (storage) {
      return storage;
    }
    if (storageKind) {
      return resolveBrowserStorage(storageKind);
    }
    return null;
  };

  const reportError = (err, context) => {
    if (typeof onError === "function") {
      onError(err, context);
    }
  };

  const formatKey = (key) => `${prefix}${assertValidStorageKey(key)}`;

  const isAvailable = () => {
    const backend = getBackend();
    if (!backend) return false;
    const probeKey = `${prefix}__probe__`;
    try {
      backend.setItem(probeKey, "1");
      backend.removeItem(probeKey);
      return true;
    } catch (err) {
      reportError(err, { action: "probe", namespace: safeNamespace });
      return false;
    }
  };

  const getRaw = (key) => {
    const fullKey = formatKey(key);
    const backend = getBackend();
    if (!backend) return null;
    try {
      return backend.getItem(fullKey);
    } catch (err) {
      reportError(err, { action: "getRaw", key: fullKey });
      return null;
    }
  };

  const setRaw = (key, value) => {
    const fullKey = formatKey(key);
    const backend = getBackend();
    if (!backend) return false;
    try {
      backend.setItem(fullKey, String(value));
      return true;
    } catch (err) {
      reportError(err, { action: "setRaw", key: fullKey });
      return false;
    }
  };

  const getJson = (key, fallback = null) => {
    const raw = getRaw(key);
    if (raw === null || raw === undefined || raw === "") {
      return fallback;
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      reportError(err, { action: "getJson", key: formatKey(key) });
      return fallback;
    }
  };

  const setJson = (key, value) => {
    const fullKey = formatKey(key);
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (err) {
      reportError(err, { action: "serializeJson", key: fullKey });
      return false;
    }
    return setRaw(key, serialized);
  };

  const remove = (key) => {
    const fullKey = formatKey(key);
    const backend = getBackend();
    if (!backend) return false;
    try {
      backend.removeItem(fullKey);
      return true;
    } catch (err) {
      reportError(err, { action: "remove", key: fullKey });
      return false;
    }
  };

  const keys = () => {
    const backend = getBackend();
    if (!backend || typeof backend.length !== "number" || typeof backend.key !== "function") {
      return [];
    }
    const matched = [];
    try {
      for (let i = 0; i < backend.length; i += 1) {
        const k = backend.key(i);
        if (typeof k === "string" && k.startsWith(prefix) && k !== `${prefix}__probe__`) {
          matched.push(k.slice(prefix.length));
        }
      }
    } catch (err) {
      reportError(err, { action: "keys", namespace: safeNamespace });
    }
    return matched;
  };

  const clearNamespace = () => {
    const backend = getBackend();
    if (!backend) return 0;
    const ownedKeys = keys();
    let removed = 0;
    for (const k of ownedKeys) {
      if (remove(k)) {
        removed += 1;
      }
    }
    return removed;
  };

  return Object.freeze({
    namespace: safeNamespace,
    formatKey,
    isAvailable,
    getRaw,
    setRaw,
    getJson,
    setJson,
    remove,
    keys,
    clearNamespace
  });
}

export const localStore = createNamespacedStorage({ storageKind: "localStorage" });
export const sessionStore = createNamespacedStorage({ storageKind: "sessionStorage" });
