import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import {
  HIT_EVALUATION_STATUS,
  MESSAGE_STATUS,
  MESSAGE_VISIBILITY,
  ROLL_KINDS
} from "../../src/domain/constants.js";
import {
  fromMessageDoc,
  toMessageDoc
} from "../../src/domain/models/message.js";

const LEGACY_MESSAGE_KEYS = [
  "timestampMs",
  "rollData",
  "skillData",
  "senderId",
  "senderName",
  "senderPhotoURL",
  "senderAvatarMediaId",
  "characterId",
  "characterMediaId",
  "icon"
];

const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean.length > 0 ? clean : null;
}

function timestampMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return 0;
}

function stableEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (a && b && typeof a.toMillis === "function" && typeof b.toMillis === "function") {
    return a.toMillis() === b.toMillis();
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((entry, index) => stableEquals(entry, b[index]));
  }
  const keysA = Object.keys(a).filter((key) => a[key] !== undefined).sort();
  const keysB = Object.keys(b).filter((key) => b[key] !== undefined).sort();
  return keysA.length === keysB.length &&
    keysA.every((key, index) => key === keysB[index] && stableEquals(a[key], b[key]));
}

function inferLegacyRollKind(rawMessage, normalizedRoll) {
  const rawRoll = isPlainRecord(rawMessage.roll)
    ? rawMessage.roll
    : isPlainRecord(rawMessage.rollData)
      ? rawMessage.rollData
      : {};
  const explicit = trimOrNull(rawRoll.kind ?? rawRoll.rollKind);
  if (explicit && VALID_ROLL_KINDS.has(explicit)) return explicit;

  if (rawRoll.respondsTo || rawRoll.respondedToSaveId || rawRoll.savingThrowOutcome) {
    return ROLL_KINDS.SAVING_THROW;
  }
  const effectType = trimOrNull(rawRoll.effectType ?? rawRoll.damageConfig?.effectType);
  if (effectType === "heal") return ROLL_KINDS.HEAL;
  if (effectType === "mp_heal") return ROLL_KINDS.MP_HEAL;
  if (effectType === "mp_damage") return ROLL_KINDS.MP_DAMAGE;
  if (effectType === "damage" || rawRoll.damageConfig) return ROLL_KINDS.DAMAGE;

  const title = String(rawRoll.title ?? rawRoll.rollName ?? normalizedRoll?.title ?? "");
  if (/^(ataque|tiro|golpe)\b/i.test(title) || rawRoll.targetInfo?.isAttackRoll === true) {
    return ROLL_KINDS.ATTACK;
  }
  if (/\b(cura|curar|heal)\b/i.test(title)) return ROLL_KINDS.HEAL;
  if (/\b(dano|damage)\b/i.test(title)) return ROLL_KINDS.DAMAGE;
  return ROLL_KINDS.CHECK;
}

function resolveVisibility(raw, senderUid, gmUid) {
  const visible = Array.isArray(raw.visibleTo) ? raw.visibleTo.filter(Boolean) : [];
  const visibility = raw.visibility === MESSAGE_VISIBILITY.GM_ONLY ||
    (!visible.includes("ALL") && visible.length > 0)
    ? MESSAGE_VISIBILITY.GM_ONLY
    : MESSAGE_VISIBILITY.PUBLIC;
  if (visibility === MESSAGE_VISIBILITY.PUBLIC) {
    return { visibility, visibleTo: ["ALL"] };
  }
  return {
    visibility,
    visibleTo: Array.from(new Set([gmUid, senderUid].filter(Boolean)))
  };
}

function dataUrlInfo(value) {
  if (typeof value !== "string" || !/^data:/i.test(value)) return null;
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(value);
  if (!match) return null;
  let byteLength;
  try {
    byteLength = match[2]
      ? Buffer.from(match[3], "base64").byteLength
      : Buffer.byteLength(decodeURIComponent(match[3]), "utf8");
  } catch {
    byteLength = Buffer.byteLength(value, "utf8");
  }
  return {
    dataUrl: value,
    mimeType: trimOrNull(match[1]) || "image/webp",
    byteLength: Math.max(1, byteLength)
  };
}

function avatarDataUrl(raw) {
  const candidates = [
    raw.sender?.image?.url,
    raw.senderPhotoURL,
    raw.photoURL
  ];
  for (const candidate of candidates) {
    const info = dataUrlInfo(candidate);
    if (info) return info;
  }
  return null;
}

function mediaIdForDataUrl(dataUrl) {
  const digest = createHash("sha256").update(dataUrl).digest("hex").slice(0, 24);
  return `media_msg_avatar_${digest}`;
}

function normalizeHitEvaluation(roll) {
  if (!roll) return null;
  const current = isPlainRecord(roll.hitEvaluation) ? roll.hitEvaluation : {};
  return {
    status: Object.values(HIT_EVALUATION_STATUS).includes(current.status)
      ? current.status
      : HIT_EVALUATION_STATUS.NONE,
    results: Array.isArray(current.results)
      ? current.results.map((entry) => ({
          tokenId: trimOrNull(entry?.tokenId),
          hit: Boolean(entry?.hit),
          crit: Boolean(entry?.crit),
          fumble: Boolean(entry?.fumble)
        })).filter((entry) => entry.tokenId)
      : []
  };
}

function canonicalizeMessage({ raw, messageId, campaignId, gmUid, seq, createdAt, mediaId }) {
  const normalized = fromMessageDoc(raw, messageId, { campaignId, gmId: gmUid });
  const senderUid = trimOrNull(normalized.sender?.uid) || trimOrNull(raw.senderId) || gmUid || "system";
  const audience = resolveVisibility(raw, senderUid, gmUid);
  const roll = normalized.roll
    ? {
        ...normalized.roll,
        kind: inferLegacyRollKind(raw, normalized.roll),
        hitEvaluation: normalizeHitEvaluation(normalized.roll),
        appliedEffects: isPlainRecord(normalized.roll.appliedEffects)
          ? normalized.roll.appliedEffects
          : {}
      }
    : null;

  const image = mediaId
    ? { mediaId, url: null }
    : {
        mediaId: trimOrNull(normalized.sender?.image?.mediaId),
        url: /^https?:\/\//i.test(normalized.sender?.image?.url || "")
          ? normalized.sender.image.url
          : null
      };

  const canonical = {
    ...normalized,
    id: messageId,
    campaignId,
    seq,
    visibility: audience.visibility,
    visibleTo: audience.visibleTo,
    sender: {
      uid: senderUid,
      characterId: trimOrNull(normalized.sender?.characterId),
      displayName: trimOrNull(normalized.sender?.displayName) || "Pinguim",
      image
    },
    status: MESSAGE_STATUS.COMMITTED,
    opId: null,
    roll,
    isDeleted: Boolean(raw.isDeleted),
    deletedAt: raw.isDeleted ? raw.deletedAt ?? null : null,
    deletedBy: raw.isDeleted ? trimOrNull(raw.deletedBy) || gmUid || senderUid : null,
    createdAt,
    updatedAt: raw.updatedAt ?? createdAt
  };
  return toMessageDoc(canonical);
}

export default {
  id: "M008-messages-v2",
  description:
    "Converte mensagens para schema v2, atribui seq determinístico, cria state/chat e move avatares Base64 para media.",

  async plan({ firestore }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      messagesScanned: 0,
      messagesUpdated: 0,
      chatStatesUpdated: 0,
      mediaCreated: 0,
      base64AvatarsMoved: 0,
      legacyKindsClassified: 0,
      legacyFieldsRemoved: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();
    for (const campaignDoc of campaignsSnap.docs) {
      const campaignId = campaignDoc.id;
      const gmUid = trimOrNull(campaignDoc.data()?.gmId);
      summary.campaignsProcessed += 1;

      const [messagesSnap, mediaSnap, chatStateSnap] = await Promise.all([
        firestore.collection(`campaigns/${campaignId}/messages`).get(),
        firestore.collection(`campaigns/${campaignId}/media`).get(),
        firestore.doc(`campaigns/${campaignId}/state/chat`).get()
      ]);
      const existingMedia = new Map(mediaSnap.docs.map((doc) => [doc.id, doc.data() || {}]));
      const plannedMedia = new Set();

      const ordered = messagesSnap.docs
        .map((doc) => ({ doc, raw: doc.data() || {} }))
        .sort((a, b) => {
          const timeA = timestampMillis(a.raw.createdAt ?? a.raw.timestampMs);
          const timeB = timestampMillis(b.raw.createdAt ?? b.raw.timestampMs);
          return timeA - timeB || a.doc.id.localeCompare(b.doc.id);
        });

      for (let index = 0; index < ordered.length; index += 1) {
        const { doc: messageDoc, raw } = ordered[index];
        const seq = index + 1;
        summary.messagesScanned += 1;
        const millis = timestampMillis(raw.createdAt ?? raw.timestampMs);
        const createdAt = raw.createdAt ?? Timestamp.fromMillis(Math.max(0, millis));

        const avatarInfo = avatarDataUrl(raw);
        let mediaId = null;
        if (avatarInfo) {
          mediaId = mediaIdForDataUrl(avatarInfo.dataUrl);
          const senderUid = trimOrNull(raw.sender?.uid ?? raw.senderId) || gmUid || "system";
          const audience = resolveVisibility(raw, senderUid, gmUid).visibleTo;
          if (!existingMedia.has(mediaId) && !plannedMedia.has(mediaId)) {
            operations.push({
              kind: "fs.set",
              path: `campaigns/${campaignId}/media/${mediaId}`,
              data: {
                campaignId,
                category: "chat_avatar",
                mimeType: avatarInfo.mimeType,
                widthPx: 1,
                heightPx: 1,
                byteLength: avatarInfo.byteLength,
                dataUrl: avatarInfo.dataUrl,
                uploadedBy: senderUid,
                visibleTo: audience,
                createdAt
              }
            });
            plannedMedia.add(mediaId);
            summary.mediaCreated += 1;
          }
          summary.base64AvatarsMoved += 1;
        }

        const canonical = canonicalizeMessage({
          raw,
          messageId: messageDoc.id,
          campaignId,
          gmUid,
          seq,
          createdAt,
          mediaId
        });
        const rawRoll = isPlainRecord(raw.roll) ? raw.roll : raw.rollData;
        if (isPlainRecord(rawRoll) && !VALID_ROLL_KINDS.has(rawRoll.kind ?? rawRoll.rollKind)) {
          summary.legacyKindsClassified += 1;
        }
        const presentLegacy = LEGACY_MESSAGE_KEYS.filter((key) => Object.hasOwn(raw, key));
        if (presentLegacy.length > 0) summary.legacyFieldsRemoved += 1;
        if (!stableEquals(raw, canonical)) {
          operations.push({ kind: "fs.set", path: messageDoc.ref.path, data: canonical });
          summary.messagesUpdated += 1;
        }
      }

      const lastMessage = ordered.at(-1)?.doc.id ?? null;
      const targetState = {
        campaignId,
        lastSeq: ordered.length,
        lastMessageId: lastMessage
      };
      if (!chatStateSnap.exists || !stableEquals(chatStateSnap.data() || {}, targetState)) {
        operations.push({
          kind: "fs.set",
          path: `campaigns/${campaignId}/state/chat`,
          data: targetState
        });
        summary.chatStatesUpdated += 1;
      }
    }

    return { operations, summary };
  }
};
