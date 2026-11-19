import { AppError, ERROR_CODES } from "../domain/errors.js";

export const IDB_NAME = "cpvtt_media_cache";
export const IDB_STORE = "media";
export const IDB_VERSION = 1;

export function buildMediaCacheKey(campaignId, mediaId) {
  if (typeof campaignId !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "Media cache campaignId must be a non-empty string.",
      { campaignId, mediaId }
    );
  }
  const cleanCampaign = campaignId.trim();
  if (
    !cleanCampaign ||
    cleanCampaign !== campaignId ||
    cleanCampaign.toLowerCase() === "default"
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `Invalid media cache campaignId "${campaignId}".`,
      { campaignId, mediaId }
    );
  }
  if (typeof mediaId !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "Media cache mediaId must be a non-empty string.",
      { campaignId, mediaId }
    );
  }
  const cleanMedia = mediaId.trim();
  if (!cleanMedia || cleanMedia !== mediaId) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `Invalid media cache mediaId "${mediaId}".`,
      { campaignId, mediaId }
    );
  }
  return `${cleanCampaign}:${cleanMedia}`;
}

export function createMediaCache({
  indexedDBFactory = null,
  onError = null
} = {}) {
  const memoryCache = new Map();
  const inFlight = new Map();
  let dbConnectionPromise = null;
  let openedDatabase = null;

  const reportError = (err, context) => {
    if (typeof onError === "function") {
      onError(err, context);
    }
  };

  const getFactory = () => {
    if (indexedDBFactory !== null) {
      return indexedDBFactory;
    }
    return typeof indexedDB !== "undefined" ? indexedDB : null;
  };

  const getDbConnection = () => {
    const factory = getFactory();
    if (!factory) {
      return Promise.resolve(null);
    }
    if (dbConnectionPromise) {
      return dbConnectionPromise;
    }
    dbConnectionPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = factory.open(IDB_NAME, IDB_VERSION);
      } catch (err) {
        dbConnectionPromise = null;
        reject(err);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        openedDatabase = database;
        database.onclose = () => {
          if (openedDatabase === database) {
            openedDatabase = null;
            dbConnectionPromise = null;
          }
        };
        database.onversionchange = () => {
          if (typeof database.close === "function") {
            database.close();
          }
          if (openedDatabase === database) {
            openedDatabase = null;
            dbConnectionPromise = null;
          }
        };
        resolve(database);
      };
      request.onerror = () => {
        dbConnectionPromise = null;
        reject(request.error || new Error("Falha ao abrir IndexedDB de mídia."));
      };
      request.onblocked = () => {
        dbConnectionPromise = null;
        reject(new Error("Abertura do IndexedDB de mídia bloqueada."));
      };
    });
    return dbConnectionPromise;
  };

  const getFromIndexedDB = async (cacheKey) => {
    try {
      const database = await getDbConnection();
      if (!database) return null;
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(cacheKey);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error || new Error("Falha ao ler cache IndexedDB."));
      });
    } catch (err) {
      reportError(err, { action: "read", cacheKey });
      return null;
    }
  };

  const saveToIndexedDB = async (cacheKey, dataUrl) => {
    try {
      const database = await getDbConnection();
      if (!database) return false;
      await new Promise((resolve, reject) => {
        const tx = database.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put(dataUrl, cacheKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("Falha ao gravar cache IndexedDB."));
        tx.onabort = () => reject(tx.error || new Error("Transação IndexedDB abortada."));
      });
      return true;
    } catch (err) {
      reportError(err, { action: "write", cacheKey });
      return false;
    }
  };

  const getSync = (campaignId, mediaId) => {
    const cacheKey = buildMediaCacheKey(campaignId, mediaId);
    return memoryCache.get(cacheKey) ?? null;
  };

  const get = async (campaignId, mediaId) => {
    const cacheKey = buildMediaCacheKey(campaignId, mediaId);
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey);
    }
    const cached = await getFromIndexedDB(cacheKey);
    if (cached) {
      memoryCache.set(cacheKey, cached);
      return cached;
    }
    return null;
  };

  const set = async (campaignId, mediaId, dataUrl) => {
    const cacheKey = buildMediaCacheKey(campaignId, mediaId);
    if (!dataUrl) {
      return null;
    }
    memoryCache.set(cacheKey, dataUrl);
    await saveToIndexedDB(cacheKey, dataUrl);
    return dataUrl;
  };

  const resolve = (campaignId, mediaId, loader) => {
    const cacheKey = buildMediaCacheKey(campaignId, mediaId);
    if (memoryCache.has(cacheKey)) {
      return Promise.resolve(memoryCache.get(cacheKey));
    }
    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }

    const promise = (async () => {
      try {
        const cached = await get(campaignId, mediaId);
        if (cached) {
          return cached;
        }
        if (typeof loader !== "function") {
          return null;
        }
        const loaded = await loader();
        if (loaded) {
          await set(campaignId, mediaId, loaded);
        }
        return loaded ?? null;
      } finally {
        if (inFlight.get(cacheKey) === promise) {
          inFlight.delete(cacheKey);
        }
      }
    })();

    inFlight.set(cacheKey, promise);
    return promise;
  };

  const clear = async ({ closeDb = false } = {}) => {
    memoryCache.clear();
    inFlight.clear();
    if (closeDb && openedDatabase) {
      if (typeof openedDatabase.close === "function") {
        openedDatabase.close();
      }
      openedDatabase = null;
      dbConnectionPromise = null;
    }
  };

  return Object.freeze({
    getSync,
    get,
    set,
    resolve,
    clear,
    hasInFlight: (campaignId, mediaId) =>
      inFlight.has(buildMediaCacheKey(campaignId, mediaId))
  });
}

const defaultMediaCache = createMediaCache();

export function getCachedMediaSync(campaignId, mediaId) {
  return defaultMediaCache.getSync(campaignId, mediaId);
}

export function getCachedMedia(campaignId, mediaId) {
  return defaultMediaCache.get(campaignId, mediaId);
}

export function setCachedMedia(campaignId, mediaId, dataUrl) {
  return defaultMediaCache.set(campaignId, mediaId, dataUrl);
}

export function resolveWithCache(campaignId, mediaId, loader) {
  return defaultMediaCache.resolve(campaignId, mediaId, loader);
}

export function clearMediaCache(options = {}) {
  return defaultMediaCache.clear(options);
}
