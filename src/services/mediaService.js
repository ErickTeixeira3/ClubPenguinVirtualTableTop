import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import { ID_PREFIXES } from "../domain/constants.js";
import {
  expandMediaVisibleTo,
  hasRequiredMediaAudience,
  validateMediaAudienceExpansion
} from "../domain/models/media.js";
import { db, DEFAULT_CAMPAIGN_ID } from "../infra/firebase.js";
import { mediaDocPath } from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import {
  compressImageToWebP,
  measureDataUrlBytes
} from "../infra/imageCompression.js";
import {
  getCachedMediaSync as getCachedFromStore,
  resolveWithCache,
  setCachedMedia
} from "../infra/mediaCache.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

function resolveCampaignId(campaignId) {
  return campaignId === undefined || campaignId === null || campaignId === ""
    ? DEFAULT_CAMPAIGN_ID
    : campaignId;
}

export function getCachedMediaSync(mediaId, campaignId = DEFAULT_CAMPAIGN_ID) {
  if (!mediaId) return null;
  return getCachedFromStore(resolveCampaignId(campaignId), mediaId);
}

export async function uploadCompressedMedia({
  file,
  compressed = null,
  category = "scene",
  campaignId = DEFAULT_CAMPAIGN_ID,
  uploadedBy = "system",
  visibleTo = null
}) {
  assertClientUpToDate();
  const targetCampaignId = resolveCampaignId(campaignId);
  const result = await compressImageToWebP(compressed || file, category);
  const mediaId = createId(ID_PREFIXES.MEDIA);
  const byteLength = Math.max(
    1,
    Math.round(result.sizeBytes ?? measureDataUrlBytes(result.dataUrl))
  );
  const audience = computeAudience({
    uploadedBy,
    visibleTo
  });

  const mediaRef = doc(db, mediaDocPath(targetCampaignId, mediaId));
  await setDoc(mediaRef, {
    id: mediaId,
    campaignId: targetCampaignId,
    category,
    mimeType: result.mimeType,
    widthPx: result.widthPx,
    heightPx: result.heightPx,
    byteLength,
    dataUrl: result.dataUrl,
    uploadedBy,
    visibleTo: audience.visibleTo,
    createdAt: serverTimestamp()
  });

  await setCachedMedia(targetCampaignId, mediaId, result.dataUrl);

  return {
    mediaId,
    widthPx: result.widthPx,
    heightPx: result.heightPx,
    byteLength,
    originalSizeBytes: result.originalSizeBytes,
    mimeType: result.mimeType,
    dataUrl: result.dataUrl,
    visibleTo: audience.visibleTo
  };
}

export async function uploadDataUrlMedia({
  dataUrl,
  category = "avatar",
  campaignId = DEFAULT_CAMPAIGN_ID,
  uploadedBy = "system",
  widthPx = 256,
  heightPx = 256,
  mimeType = "image/webp",
  visibleTo = null
}) {
  assertClientUpToDate();
  if (!dataUrl || typeof dataUrl !== "string") return null;

  const targetCampaignId = resolveCampaignId(campaignId);
  const mediaId = createId(ID_PREFIXES.MEDIA);
  const byteLength = Math.max(1, Math.round(measureDataUrlBytes(dataUrl)));
  const audience = computeAudience({
    uploadedBy,
    visibleTo
  });

  const mediaRef = doc(db, mediaDocPath(targetCampaignId, mediaId));
  await setDoc(mediaRef, {
    id: mediaId,
    campaignId: targetCampaignId,
    category,
    mimeType,
    widthPx,
    heightPx,
    byteLength,
    dataUrl,
    uploadedBy,
    visibleTo: audience.visibleTo,
    createdAt: serverTimestamp()
  });

  await setCachedMedia(targetCampaignId, mediaId, dataUrl);

  return {
    mediaId,
    widthPx,
    heightPx,
    byteLength,
    dataUrl,
    visibleTo: audience.visibleTo
  };
}

/**
 * Expande de forma estritamente monotônica a audiência `visibleTo` de uma mídia existente.
 * Deve ser chamado ANTES de publicar/compartilhar qualquer documento ou token que passe a
 * expor o `mediaId` para novos destinatários.
 */
export async function grantMediaAudience({
  campaignId = DEFAULT_CAMPAIGN_ID,
  mediaId,
  visibleTo = [],
  firestoreDb = db
}) {
  assertClientUpToDate();
  const cleanId = typeof mediaId === "string" ? mediaId.trim() : "";
  if (!cleanId) return null;

  const requested = Array.isArray(visibleTo)
    ? Array.from(
        new Set(
          visibleTo
            .filter((entry) => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        )
      )
    : [];
  if (requested.length === 0) return null;

  const targetCampaignId = resolveCampaignId(campaignId);
  const mediaRef = doc(firestoreDb, mediaDocPath(targetCampaignId, cleanId));
  const snapshot = await getDoc(mediaRef);
  if (!snapshot.exists()) {
    return null;
  }

  const current = snapshot.data() || {};
  if (hasRequiredMediaAudience(current, requested)) {
    return {
      mediaId: cleanId,
      visibleTo: current.visibleTo,
      updated: false
    };
  }

  const previousVisibleTo = Array.isArray(current.visibleTo) ? current.visibleTo : [];
  const nextVisibleTo = expandMediaVisibleTo(previousVisibleTo, requested);
  const validation = validateMediaAudienceExpansion(previousVisibleTo, nextVisibleTo);
  if (!validation.ok) {
    throw validation.errors[0];
  }

  await updateDoc(mediaRef, { visibleTo: nextVisibleTo });
  return {
    mediaId: cleanId,
    visibleTo: nextVisibleTo,
    updated: true
  };
}

export { grantMediaAudience as grantAudience };

export async function getMediaDataUrl(
  mediaId,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  if (!mediaId) return null;
  const targetCampaignId = resolveCampaignId(campaignId);

  return resolveWithCache(targetCampaignId, mediaId, async () => {
    const mediaRef = doc(db, mediaDocPath(targetCampaignId, mediaId));
    const snapshot = await getDoc(mediaRef);
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data()?.dataUrl || null;
  });
}
