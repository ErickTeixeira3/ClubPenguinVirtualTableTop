import { FieldValue } from "firebase-admin/firestore";
import { fromMediaDoc, validateMedia } from "../../src/domain/models/media.js";

const LEGACY_MEDIA_KEYS = [
  "isDeleted",
  "deletedAt",
  "deletedBy",
  "updatedAt",
  "chunks",
  "sizeBytes"
];

function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringArray(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) seen.add(clean);
    }
  }
  return Array.from(seen);
}

function sameStringArray(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, idx) => value === b[idx])
  );
}

function extractControlledByUids(rawControlledBy) {
  if (Array.isArray(rawControlledBy)) {
    return cleanStringArray(rawControlledBy);
  }
  if (rawControlledBy && typeof rawControlledBy === "object") {
    const uids = [];
    for (const [key, val] of Object.entries(rawControlledBy)) {
      if (val === true && trimOrNull(key)) {
        uids.push(key.trim());
      } else if (/^\d+$/.test(key) && typeof val === "string" && trimOrNull(val)) {
        uids.push(val.trim());
      }
    }
    return cleanStringArray(uids);
  }
  return [];
}

function inferMimeType(dataUrl, existing) {
  const cleanExisting = trimOrNull(existing);
  if (cleanExisting) return cleanExisting;
  if (typeof dataUrl === "string") {
    const match = /^data:([^;,]+)[;,]/i.exec(dataUrl);
    if (match?.[1]) return match[1].trim().toLowerCase();
  }
  return "image/webp";
}

function measureByteLength(data) {
  if (typeof data.dataUrl === "string" && data.dataUrl.length > 0) {
    return Buffer.byteLength(data.dataUrl, "utf8");
  }
  if (Number.isInteger(data.byteLength) && data.byteLength > 0) {
    return data.byteLength;
  }
  if (typeof data.sizeBytes === "number" && Number.isFinite(data.sizeBytes) && data.sizeBytes > 0) {
    return Math.round(data.sizeBytes);
  }
  return 0;
}

export default {
  id: "M003-media",
  description:
    "Normaliza media (campaignId, byteLength, remoção de sizeBytes/isDeleted/chunks) e calcula visibleTo pela união das audiências dos referentes.",

  async plan({ firestore, database }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      mediaScanned: 0,
      mediaUpdated: 0,
      unreferencedMediaRestrictedToGm: 0,
      chunksDeleted: 0,
      campaignsUpdated: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();
    const rtdbRealtimeRoot = database
      ? (await database.ref("vtt_realtime").once("value")).val() || {}
      : {};

    for (const campDoc of campaignsSnap.docs) {
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};
      const gmUid = trimOrNull(campData.gmId);
      summary.campaignsProcessed += 1;

      const audienceMap = new Map();
      const addAudience = (mediaId, entries) => {
        const cleanId = trimOrNull(mediaId);
        if (!cleanId) return;
        const cleanEntries = cleanStringArray(entries);
        if (cleanEntries.length === 0) return;
        let targetSet = audienceMap.get(cleanId);
        if (!targetSet) {
          targetSet = new Set();
          audienceMap.set(cleanId, targetSet);
        }
        for (const entry of cleanEntries) {
          targetSet.add(entry);
        }
      };

      // 1. Characters
      const charsSnap = await firestore
        .collection(`campaigns/${campaignId}/characters`)
        .get();
      for (const charDoc of charsSnap.docs) {
        const c = charDoc.data() || {};
        const vis = cleanStringArray(c.visibleTo);
        const charAud =
          vis.length > 0
            ? vis
            : [trimOrNull(c.ownerId), gmUid].filter(Boolean);
        addAudience(c.avatarMediaId, charAud);
        addAudience(c.avatar?.mediaId, charAud);
        addAudience(c.defaultToken?.mediaId, charAud);
      }

      // 2. Notes
      const notesSnap = await firestore
        .collection(`campaigns/${campaignId}/notes`)
        .get();
      for (const noteDoc of notesSnap.docs) {
        const n = noteDoc.data() || {};
        const noteAud =
          n.scope === "gm"
            ? gmUid
              ? [gmUid]
              : []
            : cleanStringArray(n.visibleTo).length > 0
            ? cleanStringArray(n.visibleTo)
            : [trimOrNull(n.ownerId), gmUid].filter(Boolean);
        addAudience(n.imageMediaId, noteAud);
        addAudience(n.image?.mediaId, noteAud);
      }

      // 3. Scenes
      const scenesSnap = await firestore
        .collection(`campaigns/${campaignId}/scenes`)
        .get();
      for (const sceneDoc of scenesSnap.docs) {
        const s = sceneDoc.data() || {};
        const sceneVis = cleanStringArray(s.visibleTo);
        const sceneAud =
          typeof s.visibleToPlayers === "boolean"
            ? s.visibleToPlayers
              ? ["ALL"]
              : gmUid
              ? [gmUid]
              : []
            : sceneVis.length > 0
            ? sceneVis
            : gmUid
            ? [gmUid]
            : [];
        addAudience(s.mapImage?.mediaId, sceneAud);
      }

      // 4. Compendium (caso algum card referencie mídia)
      const compSnap = await firestore
        .collection(`campaigns/${campaignId}/compendium`)
        .get();
      for (const compDoc of compSnap.docs) {
        const comp = compDoc.data() || {};
        const compVis = cleanStringArray(comp.visibleTo);
        const compAud =
          typeof comp.visibleToPlayers === "boolean"
            ? comp.visibleToPlayers
              ? ["ALL"]
              : gmUid
              ? [gmUid]
              : []
            : compVis.length > 0
            ? compVis
            : gmUid
            ? [gmUid]
            : [];
        addAudience(comp.imageMediaId, compAud);
        addAudience(comp.image?.mediaId, compAud);
      }

      // 5. Members (+ fallback legado players caso M003 rode isolada)
      const membersSnap = await firestore
        .collection(`campaigns/${campaignId}/members`)
        .get();
      for (const memDoc of membersSnap.docs) {
        const m = memDoc.data() || {};
        addAudience(m.avatar?.mediaId, ["ALL"]);
        addAudience(m.avatarMediaId, ["ALL"]);
      }
      if (campData.players && typeof campData.players === "object") {
        for (const player of Object.values(campData.players)) {
          if (player && typeof player === "object") {
            addAudience(player.avatar?.mediaId, ["ALL"]);
            addAudience(player.avatarMediaId, ["ALL"]);
          }
        }
      }

      // 6. Messages (incluindo legadas com Base64 que serão convertidas na M008; aqui varre mediaIds já referenciados)
      const msgsSnap = await firestore
        .collection(`campaigns/${campaignId}/messages`)
        .get();
      for (const msgDoc of msgsSnap.docs) {
        const msg = msgDoc.data() || {};
        const senderUid = trimOrNull(msg.senderId) || trimOrNull(msg.sender?.uid);
        const msgVis = cleanStringArray(msg.visibleTo);
        const msgAud =
          msgVis.length > 0
            ? msgVis
            : msg.visibility === "gm_only"
            ? [gmUid, senderUid].filter(Boolean)
            : msg.visibility === "self"
            ? [senderUid].filter(Boolean)
            : ["ALL"];
        addAudience(msg.senderAvatarMediaId, msgAud);
        addAudience(msg.characterMediaId, msgAud);
        addAudience(msg.sender?.image?.mediaId, msgAud);
      }

      // 7. RTDB tokens + hiddenTokens
      const campRtdb = rtdbRealtimeRoot?.[campaignId] || {};
      const scanRtdbTokensBucket = (bucket, forceHidden = false) => {
        if (!bucket || typeof bucket !== "object") return;
        for (const sceneMap of Object.values(bucket)) {
          if (!sceneMap || typeof sceneMap !== "object") continue;
          for (const tok of Object.values(sceneMap)) {
            if (!tok || typeof tok !== "object") continue;
            const mediaId = trimOrNull(tok.mediaId);
            if (!mediaId) continue;
            const isHidden =
              forceHidden || tok.hidden === true || tok.visibleToPlayers === false;
            const tokAud = isHidden
              ? [
                  gmUid,
                  trimOrNull(tok.ownerId),
                  ...extractControlledByUids(tok.controlledBy)
                ].filter(Boolean)
              : ["ALL"];
            addAudience(mediaId, tokAud.length > 0 ? tokAud : gmUid ? [gmUid] : []);
          }
        }
      };
      scanRtdbTokensBucket(campRtdb.tokens, false);
      scanRtdbTokensBucket(campRtdb.hiddenTokens, true);

      // 8. Atualizar docs em campaigns/{c}/media e remover subcoleção chunks
      const mediaSnap = await firestore
        .collection(`campaigns/${campaignId}/media`)
        .get();
      for (const mediaDoc of mediaSnap.docs) {
        summary.mediaScanned += 1;
        const data = mediaDoc.data() || {};
        const mediaId = mediaDoc.id;

        const chunksSnap = await firestore
          .collection(`campaigns/${campaignId}/media/${mediaId}/chunks`)
          .get();
        for (const chunkDoc of chunksSnap.docs) {
          operations.push({
            kind: "fs.delete",
            path: `campaigns/${campaignId}/media/${mediaId}/chunks/${chunkDoc.id}`
          });
          summary.chunksDeleted += 1;
        }

        const collected = audienceMap.get(mediaId);
        let nextVisibleTo;
        if (collected && collected.size > 0) {
          nextVisibleTo = collected.has("ALL") ? ["ALL"] : Array.from(collected);
        } else {
          const fallbackOwner = gmUid || trimOrNull(data.uploadedBy);
          nextVisibleTo = fallbackOwner ? [fallbackOwner] : [];
          summary.unreferencedMediaRestrictedToGm += 1;
        }

        const nextByteLength =
          Number.isInteger(data.byteLength) && data.byteLength > 0
            ? data.byteLength
            : measureByteLength(data);
        const nextCategory = trimOrNull(data.category) || "avatar";
        const nextMimeType = inferMimeType(data.dataUrl, data.mimeType);
        const nextWidthPx =
          typeof data.widthPx === "number" &&
          Number.isFinite(data.widthPx) &&
          data.widthPx > 0
            ? data.widthPx
            : 256;
        const nextHeightPx =
          typeof data.heightPx === "number" &&
          Number.isFinite(data.heightPx) &&
          data.heightPx > 0
            ? data.heightPx
            : 256;
        const nextUploadedBy = trimOrNull(data.uploadedBy) || gmUid || "";

        const candidate = fromMediaDoc(
          {
            ...data,
            campaignId,
            category: nextCategory,
            mimeType: nextMimeType,
            widthPx: nextWidthPx,
            heightPx: nextHeightPx,
            byteLength: nextByteLength,
            uploadedBy: nextUploadedBy,
            visibleTo: nextVisibleTo
          },
          mediaId,
          { campaignId, uploadedBy: nextUploadedBy }
        );
        const validation = validateMedia(candidate);
        if (!validation.ok) {
          throw new Error(
            `M003-media: mídia inválida (${campaignId}/${mediaId}): ${validation.errors
              .map((e) => e.message)
              .join("; ")}`
          );
        }

        const updates = {};
        if (data.campaignId !== campaignId) updates.campaignId = campaignId;
        if (data.byteLength !== nextByteLength) updates.byteLength = nextByteLength;
        if (trimOrNull(data.category) !== nextCategory) updates.category = nextCategory;
        if (trimOrNull(data.mimeType) !== nextMimeType) updates.mimeType = nextMimeType;
        if (data.widthPx !== nextWidthPx) updates.widthPx = nextWidthPx;
        if (data.heightPx !== nextHeightPx) updates.heightPx = nextHeightPx;
        if (trimOrNull(data.uploadedBy) !== nextUploadedBy) {
          updates.uploadedBy = nextUploadedBy;
        }
        if (!sameStringArray(data.visibleTo, nextVisibleTo)) {
          updates.visibleTo = nextVisibleTo;
        }

        for (const legacyKey of LEGACY_MEDIA_KEYS) {
          if (Object.hasOwn(data, legacyKey)) {
            updates[legacyKey] = FieldValue.delete();
          }
        }

        if (Object.keys(updates).length > 0) {
          operations.push({
            kind: "fs.update",
            path: `campaigns/${campaignId}/media/${mediaId}`,
            data: updates
          });
          summary.mediaUpdated += 1;
        }
      }

      if (typeof campData.schemaVersion !== "number" || campData.schemaVersion < 2) {
        operations.push({
          kind: "fs.update",
          path: `campaigns/${campaignId}`,
          data: {
            schemaVersion: 2,
            updatedAt: FieldValue.serverTimestamp()
          }
        });
        summary.campaignsUpdated += 1;
      }
    }

    return { operations, summary };
  }
};
