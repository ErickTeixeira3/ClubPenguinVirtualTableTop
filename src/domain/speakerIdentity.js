import { normalizeImageRef } from "./models/imageRef.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveMember({ user, member, myPlayerProfile, playersMap }) {
  return (
    member ||
    myPlayerProfile ||
    (user?.uid && playersMap?.[user.uid]) ||
    null
  );
}

function resolveCharacterImage(character) {
  return normalizeImageRef(
    character?.avatar ??
      character?.token?.image ??
      { mediaId: null, url: null }
  );
}

/**
 * Pure, canonical sender identity for message v2. The selected portrait is a
 * snapshot reference; resolved data URLs used only for display never enter it.
 */
export function resolveSpeakerIdentity({
  character = null,
  user = null,
  member = null,
  myPlayerProfile = null,
  playersMap = null,
  displayName = null,
  senderName = null,
  image = null,
  resolvedAvatarUrl = null
} = {}) {
  const profile = resolveMember({ user, member, myPlayerProfile, playersMap });
  const fallbackName =
    cleanText(profile?.displayName) ||
    cleanText(user?.displayName) ||
    cleanText(user?.email)?.split("@")[0] ||
    "Pinguim";
  const resolvedName =
    cleanText(displayName) ||
    cleanText(senderName) ||
    cleanText(character?.name) ||
    fallbackName;
  const senderImage = normalizeImageRef(
    image ??
      (character ? resolveCharacterImage(character) : profile?.avatar) ??
      { mediaId: null, url: null }
  );

  return {
    uid: cleanText(user?.uid),
    characterId: cleanText(character?.id) || null,
    displayName: resolvedName,
    image: senderImage,

    // Presentation aliases retained at the boundary until the Phase 10 chat
    // renderer consumes `sender` directly. They are never persisted by v2.
    type: character ? "character" : "player",
    name: resolvedName,
    senderName: resolvedName,
    photoURL: resolvedAvatarUrl || senderImage.url || null,
    character: character || null
  };
}

export function toMessageSender(identity) {
  return {
    uid: cleanText(identity?.uid),
    characterId: cleanText(identity?.characterId) || null,
    displayName: cleanText(identity?.displayName || identity?.senderName) || "Pinguim",
    image: normalizeImageRef(identity?.image)
  };
}

