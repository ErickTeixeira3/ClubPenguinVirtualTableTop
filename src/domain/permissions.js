import { CHARACTER_TYPES, NOTE_SCOPES, TOKEN_KINDS } from "./constants.js";

const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

function trimNonEmpty(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function normalizeControlledByList(controlledBy) {
  if (Array.isArray(controlledBy)) {
    const seen = new Set();
    for (const item of controlledBy) {
      const clean = trimNonEmpty(item);
      if (clean && !UNSAFE_KEYS.has(clean)) {
        seen.add(clean);
      }
    }
    return Array.from(seen);
  }
  if (controlledBy && typeof controlledBy === "object") {
    const seen = new Set();
    for (const [key, val] of Object.entries(controlledBy)) {
      if (val === true) {
        const cleanKey = key.trim();
        if (cleanKey && !UNSAFE_KEYS.has(cleanKey)) {
          seen.add(cleanKey);
        }
      } else if (/^\d+$/.test(key) && typeof val === "string") {
        const cleanVal = val.trim();
        if (cleanVal && !UNSAFE_KEYS.has(cleanVal)) {
          seen.add(cleanVal);
        }
      }
    }
    return Array.from(seen);
  }
  return [];
}

export function toControlledByMap(controlledBy) {
  const map = {};
  for (const id of normalizeControlledByList(controlledBy)) {
    map[id] = true;
  }
  return map;
}

export function hasControlledByAccess(controlledBy, uid) {
  const safeUid = trimNonEmpty(uid);
  if (!controlledBy || !safeUid || UNSAFE_KEYS.has(safeUid)) {
    return false;
  }
  if (!Array.isArray(controlledBy) && typeof controlledBy === "object") {
    if (Object.hasOwn(controlledBy, "ALL") && controlledBy.ALL === true) {
      return true;
    }
    if (Object.hasOwn(controlledBy, safeUid) && controlledBy[safeUid] === true) {
      return true;
    }
  }
  const list = normalizeControlledByList(controlledBy);
  return list.includes("ALL") || list.includes(safeUid);
}

export function canReadResource(resource, { uid, isGM = false } = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !resource || typeof resource !== "object") {
    return false;
  }
  if (resource.scope === NOTE_SCOPES.GM) {
    return Boolean(isGM);
  }
  if (isGM) {
    return true;
  }
  if (resource.ownerId && resource.ownerId === safeUid) {
    return true;
  }
  if (resource.sender?.uid && resource.sender.uid === safeUid) {
    return true;
  }
  if (resource.scope === NOTE_SCOPES.PARTY) {
    return true;
  }
  const visibleTo = Array.isArray(resource.visibleTo) ? resource.visibleTo : [];
  return visibleTo.includes("ALL") || visibleTo.includes(safeUid);
}

/**
 * Fase 4: visibilidade canônica exclusiva por `visibleTo` (e `scope !== 'gm'`).
 * `viewerUid` deve ser `null` na Visão Player do Mestre real.
 */
export function isReleasedToPlayers(resource, viewerUid = null) {
  if (!resource || typeof resource !== "object") {
    return false;
  }
  if (resource.scope === NOTE_SCOPES.GM) {
    return false;
  }
  const visibleTo = Array.isArray(resource.visibleTo) ? resource.visibleTo : [];
  const safeUid = trimNonEmpty(viewerUid);
  return visibleTo.includes("ALL") || Boolean(safeUid && visibleTo.includes(safeUid));
}

export function canEditResource(resource, { uid, isGM = false } = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !resource || typeof resource !== "object") {
    return false;
  }
  if (resource.scope === NOTE_SCOPES.GM) {
    return Boolean(isGM);
  }
  if (isGM) {
    return true;
  }
  if (resource.ownerId && resource.ownerId === safeUid) {
    return true;
  }
  if (resource.scope === NOTE_SCOPES.PARTY) {
    return true;
  }
  const editableBy = Array.isArray(resource.editableBy) ? resource.editableBy : [];
  return editableBy.includes("ALL") || editableBy.includes(safeUid);
}

export function canDeleteResource(
  resource,
  { uid, isGM = false, entityType } = {}
) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !resource || typeof resource !== "object") {
    return false;
  }
  if (entityType === "media") {
    return false;
  }
  if (resource.scope === NOTE_SCOPES.GM) {
    return Boolean(isGM);
  }
  if (isGM) {
    return true;
  }
  if (
    entityType === "message" ||
    entityType === "scene" ||
    entityType === "compendiumEntry"
  ) {
    return false;
  }
  return Boolean(resource.ownerId && resource.ownerId === safeUid);
}

export function canManageResourceAccess(
  resource,
  { uid, isGM = false, entityType } = {}
) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !resource || typeof resource !== "object") {
    return false;
  }
  if (isGM) {
    return true;
  }
  if (resource.scope === NOTE_SCOPES.GM) {
    return false;
  }
  const isCharacter =
    entityType === "character" ||
    (!entityType &&
      (resource.type === CHARACTER_TYPES.PC ||
        resource.type === CHARACTER_TYPES.NPC) &&
      !resource.domain &&
      !resource.noteType &&
      !resource.scope);
  if (
    isCharacter ||
    entityType === "scene" ||
    entityType === "compendiumEntry" ||
    entityType === "message"
  ) {
    return false;
  }
  return Boolean(resource.ownerId && resource.ownerId === safeUid);
}

export function canControlToken(token, { uid, isGM = false } = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !token || typeof token !== "object") {
    return false;
  }
  if (isGM) {
    return true;
  }
  if (token.hidden === true) {
    return false;
  }
  if (token.ownerId && token.ownerId === safeUid) {
    return true;
  }
  return hasControlledByAccess(token.controlledBy, safeUid);
}

export function canUserWriteTokenProjection(
  token,
  { uid, isGM = false, inHiddenBucket = false } = {}
) {
  if (!token || typeof token !== "object") {
    return false;
  }
  if (isGM) {
    return Boolean(trimNonEmpty(uid));
  }
  if (inHiddenBucket || token.hidden === true) {
    return false;
  }
  return canControlToken(token, { uid, isGM: false });
}

export function canEditDrawing(drawing, { uid, isGM = false } = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !drawing || typeof drawing !== "object") {
    return false;
  }
  if (isGM) {
    return true;
  }
  return drawing.authorId === safeUid;
}

export function canSeeSecret(token, character, { uid, isGM = false } = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid) {
    return false;
  }
  if (isGM) {
    return true;
  }
  if (token?.hidden === true) {
    return false;
  }
  const isPc = token?.kind
    ? token.kind === TOKEN_KINDS.PC
    : character?.type === CHARACTER_TYPES.PC;

  if (isPc) {
    if (!character || typeof character !== "object") {
      return false;
    }
    if (
      token?.characterId &&
      (!character.id || character.id !== token.characterId)
    ) {
      return false;
    }
    return canReadResource(character, { uid: safeUid, isGM: false });
  }

  if (!token || typeof token !== "object") {
    return false;
  }
  return Boolean(
    token.ownerId === safeUid ||
      hasControlledByAccess(token.controlledBy, safeUid)
  );
}

export function canSeeTargetOutcome({
  uid,
  isGM = false,
  senderId,
  senderUid,
  token,
  character
} = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid) {
    return false;
  }
  if (isGM) {
    return true;
  }
  const effectiveSender = trimNonEmpty(senderId ?? senderUid);
  if (effectiveSender && effectiveSender === safeUid) {
    return true;
  }
  return canSeeSecret(token, character, { uid: safeUid, isGM: false });
}

export function isUserResponsibleForSavingThrow({
  uid,
  isGM = false,
  savingThrowRequest,
  campaignGmId,
  campaignGMId,
  targetCharacter = null,
  targetToken = null
} = {}) {
  const safeUid = trimNonEmpty(uid);
  if (!safeUid || !savingThrowRequest || typeof savingThrowRequest !== "object") {
    return false;
  }

  const gmId = trimNonEmpty(campaignGmId ?? campaignGMId) || null;
  const effectiveGmId = gmId || (isGM ? safeUid : null);

  const validChar =
    targetCharacter &&
    typeof targetCharacter === "object" &&
    (!savingThrowRequest.targetCharacterId ||
      (Boolean(targetCharacter.id) &&
        targetCharacter.id === savingThrowRequest.targetCharacterId))
      ? targetCharacter
      : null;

  const validToken =
    targetToken &&
    typeof targetToken === "object" &&
    (!savingThrowRequest.targetTokenId ||
      (Boolean(targetToken.id) &&
        targetToken.id === savingThrowRequest.targetTokenId))
      ? targetToken
      : null;

  const ownerId = validChar
    ? trimNonEmpty(validChar.ownerId) || null
    : trimNonEmpty(savingThrowRequest.targetOwnerId) || null;

  const editableBy = validChar
    ? Array.isArray(validChar.editableBy)
      ? validChar.editableBy
      : []
    : Array.isArray(savingThrowRequest.targetEditableBy)
      ? savingThrowRequest.targetEditableBy
      : [];

  const nonGmEditors = editableBy
    .map((id) => trimNonEmpty(id))
    .filter((id) => id.length > 0 && id !== "ALL" && id !== effectiveGmId);

  const tokenOwner = trimNonEmpty(validToken?.ownerId) || null;
  const nonGmControllers = validToken
    ? normalizeControlledByList(validToken.controlledBy).filter(
        (id) => id !== "ALL" && id !== effectiveGmId
      )
    : [];

  const hasPlayerResponsible =
    Boolean(ownerId && ownerId !== effectiveGmId) ||
    nonGmEditors.length > 0 ||
    Boolean(tokenOwner && tokenOwner !== effectiveGmId) ||
    nonGmControllers.length > 0;

  if (hasPlayerResponsible) {
    return (
      Boolean(ownerId && ownerId !== effectiveGmId && ownerId === safeUid) ||
      nonGmEditors.includes(safeUid) ||
      Boolean(
        tokenOwner && tokenOwner !== effectiveGmId && tokenOwner === safeUid
      ) ||
      nonGmControllers.includes(safeUid)
    );
  }

  return Boolean(isGM);
}
