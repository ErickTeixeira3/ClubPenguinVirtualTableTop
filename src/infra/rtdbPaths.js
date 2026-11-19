import { AppError, ERROR_CODES } from "../domain/errors.js";

/**
 * Fase 6.1 / 6.7: caminhos do Realtime Database para desenhos, pings e espelho do Mestre.
 * Fase 2 (Refatoração 2): centraliza TODOS os caminhos do RTDB em `src/infra/rtdbPaths.js`.
 * O bloco legado (`RTDB_LAYOUT` / `legacy*Path`) permanece apenas até a Fase 13.
 */
// TRANSITION(T-INFRA-5): remover na Fase 13 (RTDB_LAYOUT / IS_SPLIT_RTDB_LAYOUT e caminhos legados)
export const RTDB_LAYOUT = "split";

export const IS_SPLIT_RTDB_LAYOUT = RTDB_LAYOUT === "split";

const INVALID_RTDB_CHARS = /[/.#$[\]]/;

function assertRtdbSegment(value, label) {
  if (typeof value !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `${label} must be a non-empty string.`,
      { label, value }
    );
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value || INVALID_RTDB_CHARS.test(trimmed)) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `${label} contains an invalid RTDB path segment.`,
      { label, value }
    );
  }
  return trimmed;
}

export function platformAdminsRtdbRootPath() {
  return "platformAdmins";
}

export function platformAdminRtdbPath(uid) {
  return `platformAdmins/${assertRtdbSegment(uid, "uid")}`;
}

export function campaignRtdbRootPath(campaignId) {
  return `vtt_realtime/${assertRtdbSegment(campaignId, "campaignId")}`;
}

export function metaRootPath(campaignId) {
  return `${campaignRtdbRootPath(campaignId)}/meta`;
}

export function gmMetaPath(campaignId) {
  return `${metaRootPath(campaignId)}/gmId`;
}

export function pendingGmMetaPath(campaignId) {
  return `${metaRootPath(campaignId)}/pendingGm`;
}

export function membersMetaRootPath(campaignId) {
  return `${metaRootPath(campaignId)}/members`;
}

export function memberMetaPath(campaignId, uid) {
  return `${membersMetaRootPath(campaignId)}/${assertRtdbSegment(uid, "uid")}`;
}

export function invitesMetaRootPath(campaignId) {
  return `${metaRootPath(campaignId)}/invites`;
}

export function inviteMetaPath(campaignId, emailKey) {
  return `${invitesMetaRootPath(campaignId)}/${assertRtdbSegment(emailKey, "emailKey")}`;
}

export function presenceRootPath(campaignId) {
  return `${campaignRtdbRootPath(campaignId)}/presence`;
}

export function userPresencePath(campaignId, uid) {
  return `${presenceRootPath(campaignId)}/${assertRtdbSegment(uid, "uid")}`;
}

export function connectionPresencePath(campaignId, uid, connId) {
  return `${userPresencePath(campaignId, uid)}/${assertRtdbSegment(connId, "connId")}`;
}

export function sceneTokensPath(campaignId, sceneId) {
  return `${campaignRtdbRootPath(campaignId)}/tokens/${assertRtdbSegment(sceneId, "sceneId")}`;
}

export function tokenPath(campaignId, sceneId, tokenId) {
  return `${sceneTokensPath(campaignId, sceneId)}/${assertRtdbSegment(tokenId, "tokenId")}`;
}

export function sceneHiddenTokensPath(campaignId, sceneId) {
  return `${campaignRtdbRootPath(campaignId)}/hiddenTokens/${assertRtdbSegment(sceneId, "sceneId")}`;
}

export function hiddenTokenPath(campaignId, sceneId, tokenId) {
  return `${sceneHiddenTokensPath(campaignId, sceneId)}/${assertRtdbSegment(tokenId, "tokenId")}`;
}

export function sceneTokenSecretsPath(campaignId, sceneId) {
  return `${campaignRtdbRootPath(campaignId)}/tokenSecrets/${assertRtdbSegment(sceneId, "sceneId")}`;
}

export function tokenSecretPath(campaignId, sceneId, tokenId) {
  return `${sceneTokenSecretsPath(campaignId, sceneId)}/${assertRtdbSegment(tokenId, "tokenId")}`;
}

export function sceneFogPath(campaignId, sceneId) {
  return `${campaignRtdbRootPath(campaignId)}/fog/${assertRtdbSegment(sceneId, "sceneId")}`;
}

export function sceneFogEnabledPath(campaignId, sceneId) {
  return `${sceneFogPath(campaignId, sceneId)}/enabled`;
}

export function sceneFogAreasPath(campaignId, sceneId) {
  return `${sceneFogPath(campaignId, sceneId)}/areas`;
}

export function fogAreaPath(campaignId, sceneId, areaId) {
  return `${sceneFogAreasPath(campaignId, sceneId)}/${assertRtdbSegment(areaId, "areaId")}`;
}

export function legacyDrawingsPath(campaignId, sceneId) {
  return `${sceneFogPath(campaignId, sceneId)}/drawings`;
}

export function legacyPingsPath(campaignId, sceneId) {
  return `${sceneFogPath(campaignId, sceneId)}/pings`;
}

export function drawingsPath(campaignId, sceneId) {
  const safeSceneId = assertRtdbSegment(sceneId, "sceneId");
  return IS_SPLIT_RTDB_LAYOUT
    ? `${campaignRtdbRootPath(campaignId)}/drawings/${safeSceneId}`
    : legacyDrawingsPath(campaignId, safeSceneId);
}

export function drawingItemPath(campaignId, sceneId, drawingId) {
  return `${drawingsPath(campaignId, sceneId)}/${assertRtdbSegment(drawingId, "drawingId")}`;
}

export function pingsPath(campaignId, sceneId) {
  const safeSceneId = assertRtdbSegment(sceneId, "sceneId");
  return IS_SPLIT_RTDB_LAYOUT
    ? `${campaignRtdbRootPath(campaignId)}/pings/${safeSceneId}`
    : legacyPingsPath(campaignId, safeSceneId);
}

export function pingItemPath(campaignId, sceneId, pingId) {
  return `${pingsPath(campaignId, sceneId)}/${assertRtdbSegment(pingId, "pingId")}`;
}

export function rtdbConnectedInfoPath() {
  return ".info/connected";
}

export function rtdbServerTimeOffsetPath() {
  return ".info/serverTimeOffset";
}
