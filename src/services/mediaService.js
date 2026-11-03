import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, DEFAULT_CAMPAIGN_ID } from "./firebase";
import { compressImageToWebP } from "../engines/imageCompressor";

const IDB_NAME = "cpvtt_media_cache";
const IDB_STORE = "media";
const IDB_VERSION = 1;

const memoryCache = new Map();

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

async function getFromIndexedDB(mediaId) {
  try {
    const database = await openCacheDB();
    if (!database) return null;
    return await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(mediaId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIndexedDB(mediaId, dataUrl) {
  try {
    const database = await openCacheDB();
    if (!database) return;
    await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(dataUrl, mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Falha silenciosa se navegador estiver em modo restrito
  }
}

async function removeFromIndexedDB(mediaId) {
  try {
    const database = await openCacheDB();
    if (!database) return;
    await new Promise((resolve) => {
      const tx = database.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.delete(mediaId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignora
  }
}

export function getCachedMediaSync(mediaId) {
  if (!mediaId) return null;
  return memoryCache.get(mediaId) || null;
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
    category,
    mimeType: compressed.mimeType,
    widthPx: compressed.widthPx,
    heightPx: compressed.heightPx,
    sizeBytes: compressed.sizeBytes,
    dataUrl: compressed.dataUrl,
    uploadedBy,
    createdAt: serverTimestamp()
  });

  memoryCache.set(mediaId, compressed.dataUrl);
  await saveToIndexedDB(mediaId, compressed.dataUrl);

  return {
    mediaId,
    widthPx: compressed.widthPx,
    heightPx: compressed.heightPx,
    sizeBytes: compressed.sizeBytes,
    originalSizeBytes: compressed.originalSizeBytes,
    dataUrl: compressed.dataUrl
  };
}

export async function getMediaDataUrl(
  mediaId,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  if (!mediaId) return null;

  if (memoryCache.has(mediaId)) {
    return memoryCache.get(mediaId);
  }

  const cachedIdb = await getFromIndexedDB(mediaId);
  if (cachedIdb) {
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
    memoryCache.set(mediaId, dataUrl);
    await saveToIndexedDB(mediaId, dataUrl);
  }
  return dataUrl;
}

export async function deleteMedia(
  mediaId,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  if (!mediaId) return;
  memoryCache.delete(mediaId);
  await removeFromIndexedDB(mediaId);
  try {
    const mediaRef = doc(db, "campaigns", campaignId, "media", mediaId);
    await deleteDoc(mediaRef);
  } catch {
    // Ignora caso já tenha sido removido
  }
}

