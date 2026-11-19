import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { normalizeImageRef } from "../domain/models/imageRef.js";
import { auth, db } from "../infra/firebase.js";
import { memberDocPath } from "../infra/firestorePaths.js";
import { compressImageToWebP } from "../infra/imageCompression.js";
import {
  clearPendingAvatarDataUrl,
  readPendingAvatarDataUrl
} from "../infra/pendingAvatarStore.js";
import { grantMediaAudience, uploadDataUrlMedia } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

const pendingMigrationInFlight = new Set();

export async function compressAvatarFile(file) {
  return compressImageToWebP(file, "avatar");
}

export async function updateMemberProfile({
  campaignId,
  uid,
  currentMember = null,
  displayName,
  photoURL,
  avatarMediaId,
  avatarAction = null,
  firestoreDb = db,
  authInstance = auth,
  mediaUploader = uploadDataUrlMedia,
  mediaAudienceGranter = grantMediaAudience
}) {
  assertClientUpToDate();
  if (!campaignId || !uid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Campanha e UID são obrigatórios para atualizar o perfil."
    );
  }

  const cleanName =
    (typeof displayName === "string" && displayName.trim()) ||
    currentMember?.displayName ||
    "Pinguim";

  let nextAvatar = normalizeImageRef(currentMember?.avatar);
  let photoChanged = false;
  let uploadedDataUrl = null;

  if (
    avatarAction === "remove" ||
    photoURL === null ||
    photoURL === "" ||
    avatarMediaId === null
  ) {
    nextAvatar = { mediaId: null, url: null };
    photoChanged = true;
  } else if (typeof photoURL === "string" && photoURL.startsWith("data:")) {
    const uploaded = await mediaUploader({
      dataUrl: photoURL,
      category: "avatar",
      campaignId,
      uploadedBy: uid,
      visibleTo: ["ALL"]
    });
    if (!uploaded?.mediaId) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Não foi possível enviar a nova foto."
      );
    }
    nextAvatar = { mediaId: uploaded.mediaId, url: null };
    uploadedDataUrl = uploaded.dataUrl || null;
    photoChanged = true;
  } else if (typeof photoURL === "string" && /^https?:\/\//i.test(photoURL)) {
    nextAvatar = { mediaId: null, url: photoURL.trim() };
    photoChanged = true;
  } else if (typeof avatarMediaId === "string" && avatarMediaId.trim()) {
    nextAvatar = { mediaId: avatarMediaId.trim(), url: null };
    if (typeof mediaAudienceGranter === "function") {
      await mediaAudienceGranter({
        campaignId,
        mediaId: nextAvatar.mediaId,
        visibleTo: ["ALL"],
        firestoreDb
      });
    }
    photoChanged = true;
  }

  const memberRef = doc(firestoreDb, memberDocPath(campaignId, uid));
  const payload = {
    displayName: cleanName,
    updatedAt: serverTimestamp()
  };
  if (photoChanged) {
    payload.avatar = nextAvatar;
  }
  await updateDoc(memberRef, payload);

  if (authInstance?.currentUser) {
    const authProfileUpdates = { displayName: cleanName };
    if (
      nextAvatar.url &&
      /^https?:\/\//i.test(nextAvatar.url) &&
      nextAvatar.url.length < 2000
    ) {
      authProfileUpdates.photoURL = nextAvatar.url;
    } else if (photoChanged && !nextAvatar.url) {
      authProfileUpdates.photoURL = "";
    }
    await updateProfile(authInstance.currentUser, authProfileUpdates);
  }

  return {
    displayName: cleanName,
    avatar: nextAvatar,
    uploadedDataUrl
  };
}

export async function migratePendingAvatar({
  campaignId,
  uid,
  currentMember = null,
  firestoreDb = db,
  authInstance = auth,
  mediaUploader = uploadDataUrlMedia
}) {
  if (!campaignId || !uid) return null;
  const attemptKey = `${campaignId}:${uid}`;
  if (pendingMigrationInFlight.has(attemptKey)) return null;

  const dataUrl = readPendingAvatarDataUrl(uid);
  if (!dataUrl) return null;

  pendingMigrationInFlight.add(attemptKey);
  try {
    return await updateMemberProfile({
      campaignId,
      uid,
      currentMember,
      displayName: currentMember?.displayName,
      photoURL: dataUrl,
      firestoreDb,
      authInstance,
      mediaUploader
    });
  } finally {
    clearPendingAvatarDataUrl();
    pendingMigrationInFlight.delete(attemptKey);
  }
}
