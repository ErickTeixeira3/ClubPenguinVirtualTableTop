/**
 * Utilitários compartilhados de normalização de texto e resolução de caminhos estáticos.
 */

export function stripAccents(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeText(str) {
  return stripAccents(str)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKey(str) {
  return stripAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function normalizeCompactKey(str) {
  return stripAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function getAssetUrl(assetPath) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const cleanPath = String(assetPath || "").replace(/^\/+/, "");
  return cleanPath ? `${base}/${cleanPath}` : `${base}/`;
}

export const PENDING_AVATAR_KEY = "cp_pending_avatar_dataurl";

export function clearPendingAvatarDataUrl() {
  try {
    sessionStorage.removeItem(PENDING_AVATAR_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function savePendingAvatarDataUrl(uid, dataUrl) {
  try {
    if (!uid || typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      clearPendingAvatarDataUrl();
      return;
    }
    sessionStorage.setItem(PENDING_AVATAR_KEY, JSON.stringify({ uid, dataUrl }));
  } catch {
    // Ignore storage errors
  }
}

export function readPendingAvatarDataUrl(expectedUid = null) {
  try {
    const raw = sessionStorage.getItem(PENDING_AVATAR_KEY);
    if (!raw) return null;
    if (raw.startsWith("data:")) return raw;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.dataUrl === "string" &&
      parsed.dataUrl.startsWith("data:")
    ) {
      if (expectedUid && parsed.uid && parsed.uid !== expectedUid) {
        clearPendingAvatarDataUrl();
        return null;
      }
      return parsed.dataUrl;
    }
    return null;
  } catch {
    return null;
  }
}

