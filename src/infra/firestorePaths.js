import { AppError, ERROR_CODES } from "../domain/errors.js";

function assertPathSegment(value, label) {
  if (typeof value !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `${label} must be a non-empty string.`,
      { label, value }
    );
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value || trimmed.includes("/") || trimmed === "." || trimmed === "..") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `${label} contains an invalid Firestore path segment.`,
      { label, value }
    );
  }
  return trimmed;
}

export function platformAdminsCollectionPath() {
  return "platformAdmins";
}

export function platformAdminDocPath(uid) {
  return `platformAdmins/${assertPathSegment(uid, "uid")}`;
}

export function appConfigCollectionPath() {
  return "appConfig";
}

export function runtimeConfigDocPath() {
  return "appConfig/runtime";
}

export function campaignsCollectionPath() {
  return "campaigns";
}

export function campaignDocPath(campaignId) {
  return `campaigns/${assertPathSegment(campaignId, "campaignId")}`;
}

export function membersCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/members`;
}

export function memberDocPath(campaignId, uid) {
  return `${membersCollectionPath(campaignId)}/${assertPathSegment(uid, "uid")}`;
}

export function invitesCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/invites`;
}

export function inviteDocPath(campaignId, emailLower) {
  return `${invitesCollectionPath(campaignId)}/${assertPathSegment(emailLower, "emailLower")}`;
}

export function charactersCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/characters`;
}

export function characterDocPath(campaignId, characterId) {
  return `${charactersCollectionPath(campaignId)}/${assertPathSegment(characterId, "characterId")}`;
}

export function foldersCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/folders`;
}

export function folderDocPath(campaignId, folderId) {
  return `${foldersCollectionPath(campaignId)}/${assertPathSegment(folderId, "folderId")}`;
}

export function notesCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/notes`;
}

export function noteDocPath(campaignId, noteId) {
  return `${notesCollectionPath(campaignId)}/${assertPathSegment(noteId, "noteId")}`;
}

export function scenesCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/scenes`;
}

export function sceneDocPath(campaignId, sceneId) {
  return `${scenesCollectionPath(campaignId)}/${assertPathSegment(sceneId, "sceneId")}`;
}

export function compendiumCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/compendium`;
}

export function compendiumEntryDocPath(campaignId, entryId) {
  return `${compendiumCollectionPath(campaignId)}/${assertPathSegment(entryId, "entryId")}`;
}

export function messagesCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/messages`;
}

export function messageDocPath(campaignId, messageId) {
  return `${messagesCollectionPath(campaignId)}/${assertPathSegment(messageId, "messageId")}`;
}

export function mediaCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/media`;
}

export function mediaDocPath(campaignId, mediaId) {
  return `${mediaCollectionPath(campaignId)}/${assertPathSegment(mediaId, "mediaId")}`;
}

export function stateCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/state`;
}

export function turnStateDocPath(campaignId) {
  return `${stateCollectionPath(campaignId)}/turn`;
}

export function chatStateDocPath(campaignId) {
  return `${stateCollectionPath(campaignId)}/chat`;
}

export function pendingCostsCollectionPath(campaignId) {
  return `${campaignDocPath(campaignId)}/pendingCosts`;
}

export function pendingCostDocPath(campaignId, opId) {
  return `${pendingCostsCollectionPath(campaignId)}/${assertPathSegment(opId, "opId")}`;
}
