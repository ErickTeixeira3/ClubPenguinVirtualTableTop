import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, DEFAULT_CAMPAIGN_ID } from "./firebase";
import { compressImageToWebP } from "../engines/imageCompressor";

const IDB_NAME = "cpvtt_media_cache";
const IDB_STORE = "media";
const IDB_VERSION = 1;

const memoryCache = new Map();

function getCacheKey(campaignId, mediaId) {
  return `${campaignId || DEFAULT_CAMPAIGN_ID}:${mediaId}`;
}

function openCacheDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getFromIndexedDB(cacheKey, fallbackKey = null) {
  try {
    const database = await openCacheDB();
    if (!database) return null;
    const primary = await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (primary || !fallbackKey) return primary;

    return await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(fallbackKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDB(cacheKey, dataUrl) {
  try {
    const database = await openCacheDB();
    if (!database) return;
    await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(dataUrl, cacheKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Falha silenciosa se navegador estiver em modo restrito
  }
}

export function getCachedMediaSync(mediaId, campaignId = DEFAULT_CAMPAIGN_ID) {
  if (!mediaId) return null;
  const cacheKey = getCacheKey(campaignId, mediaId);
  return memoryCache.get(cacheKey) || memoryCache.get(mediaId) || null;
}

export async function uploadCompressedMedia({
  file,
  category = "scene",
  campaignId = DEFAULT_CAMPAIGN_ID,
  uploadedBy = "system"
}) {
  const compressed = await compressImageToWebP(file, category);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const mediaId = `media_${category}_${Date.now()}_${randomSuffix}`;

  const mediaRef = doc(db, "campaigns", campaignId, "media", mediaId);
  await setDoc(mediaRef, {
    id: mediaId,
    campaignId,
    category,
    mimeType: compressed.mimeType,
    widthPx: compressed.widthPx,
    heightPx: compressed.heightPx,
    sizeBytes: compressed.sizeBytes,
    dataUrl: compressed.dataUrl,
    uploadedBy,
    isDeleted: false,
    createdAt: serverTimestamp()
  });

  const cacheKey = getCacheKey(campaignId, mediaId);
  memoryCache.set(cacheKey, compressed.dataUrl);
  memoryCache.set(mediaId, compressed.dataUrl);
  await saveToIndexedDB(cacheKey, compressed.dataUrl);

  return {
    mediaId,
    widthPx: compressed.widthPx,
    heightPx: compressed.heightPx,
    sizeBytes: compressed.sizeBytes,
    originalSizeBytes: compressed.originalSizeBytes,
    dataUrl: compressed.dataUrl
  };
}

export async function uploadDataUrlMedia({
  dataUrl,
  category = "avatar",
  campaignId = DEFAULT_CAMPAIGN_ID,
  uploadedBy = "system",
  widthPx = 256,
  heightPx = 256,
  mimeType = "image/webp"
}) {
  if (!dataUrl || typeof dataUrl !== "string") return null;

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const mediaId = `media_${category}_${Date.now()}_${randomSuffix}`;
  const sizeBytes = Math.round((dataUrl.length * 3) / 4);

  const mediaRef = doc(db, "campaigns", campaignId, "media", mediaId);
  await setDoc(mediaRef, {
    id: mediaId,
    campaignId,
    category,
    mimeType,
    widthPx,
    heightPx,
    sizeBytes,
    dataUrl,
    uploadedBy,
    isDeleted: false,
    createdAt: serverTimestamp()
  });

  const cacheKey = getCacheKey(campaignId, mediaId);
  memoryCache.set(cacheKey, dataUrl);
  memoryCache.set(mediaId, dataUrl);
  await saveToIndexedDB(cacheKey, dataUrl);

  return {
    mediaId,
    widthPx,
    heightPx,
    sizeBytes,
    dataUrl
  };
}

export async function getMediaDataUrl(
  mediaId,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  if (!mediaId) return null;

  const cacheKey = getCacheKey(campaignId, mediaId);
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }
  if (memoryCache.has(mediaId)) {
    return memoryCache.get(mediaId);
  }

  const cachedIdb = await getFromIndexedDB(cacheKey, mediaId);
  if (cachedIdb) {
    memoryCache.set(cacheKey, cachedIdb);
    memoryCache.set(mediaId, cachedIdb);
    return cachedIdb;
  }

  const mediaRef = doc(db, "campaigns", campaignId, "media", mediaId);
  const snapshot = await getDoc(mediaRef);
  if (!snapshot.exists()) {
    return null;
  }

  const dataUrl = snapshot.data()?.dataUrl || null;
  if (dataUrl) {
    memoryCache.set(cacheKey, dataUrl);
    memoryCache.set(mediaId, dataUrl);
    await saveToIndexedDB(cacheKey, dataUrl);
  }
  return dataUrl;
}

export async function deleteMedia(
  mediaId,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  if (!mediaId) return;
  try {
    const mediaRef = doc(db, "campaigns", campaignId, "media", mediaId);
    await updateDoc(mediaRef, {
      isDeleted: true,
      deletedAt: serverTimestamp()
    });
  } catch {
    // Ignora caso já tenha sido removido
  }
}

