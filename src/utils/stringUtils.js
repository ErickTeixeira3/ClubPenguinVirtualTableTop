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

