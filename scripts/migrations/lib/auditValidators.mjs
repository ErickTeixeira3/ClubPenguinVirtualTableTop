// Validadores da auditoria do schema v2 (audit-v2.mjs).
// Contrato: { id, check({ documents, database }) => Array<{ path, code }> }, onde `documents` é o mapa
// "<caminho do documento>" → dados (formato de snapshot) e `database` é a árvore do RTDB.
// Cada fase que define um modelo em src/domain/models registra aqui o validador correspondente.
import { Timestamp } from "firebase-admin/firestore";
import {
  DRAWING_TYPES,
  FOLDER_DOMAINS,
  NOTE_SCOPES,
  NOTE_TYPES,
  TOKEN_KINDS
} from "../../../src/domain/constants.js";
import { validateCharacter } from "../../../src/domain/models/character.js";
import {
  LEGACY_COMPENDIUM_KEYS,
  validateCompendiumEntry
} from "../../../src/domain/models/compendiumEntry.js";
import {
  LEGACY_DRAWING_KEYS,
  validateDrawing
} from "../../../src/domain/models/drawing.js";
import {
  LEGACY_FOG_KEYS,
  validateFog
} from "../../../src/domain/models/fog.js";
import {
  LEGACY_FOLDER_KEYS,
  validateFolder
} from "../../../src/domain/models/folder.js";
import {
  LEGACY_NOTE_KEYS,
  validateNote
} from "../../../src/domain/models/note.js";
import { validateChatState } from "../../../src/domain/models/chatState.js";
import { validateMessage } from "../../../src/domain/models/message.js";
import { validatePendingCost } from "../../../src/domain/models/pendingCost.js";
import {
  LEGACY_PING_KEYS,
  validatePing
} from "../../../src/domain/models/ping.js";
import { validatePresence } from "../../../src/domain/models/presence.js";
import {
  LEGACY_TOKEN_KEYS,
  validateToken,
  validateTokenSecret
} from "../../../src/domain/models/token.js";

const LEGACY_CHAR_TOP_FIELDS = [
  "avatarMediaId",
  "avatarExternalUrl",
  "defaultToken",
  "visibleToPlayers",
  "scope",
  "isFolder",
  "migratedToFoldersCollection"
];

const LEGACY_FOLDER_TOP_FIELDS = ["id", ...LEGACY_FOLDER_KEYS];
const LEGACY_COMPENDIUM_TOP_FIELDS = LEGACY_COMPENDIUM_KEYS;
const LEGACY_NOTE_TOP_FIELDS = ["id", ...LEGACY_NOTE_KEYS];
const LEGACY_MESSAGE_TOP_FIELDS = [
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

function decodeSnapshotValue(value) {
  if (Array.isArray(value)) return value.map(decodeSnapshotValue);
  if (value && typeof value === "object") {
    if (value instanceof Timestamp || typeof value.toDate === "function") {
      return value;
    }
    if (value.__type === "timestamp") {
      return new Timestamp(value.seconds || 0, value.nanoseconds || 0);
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, decodeSnapshotValue(v)])
    );
  }
  return value;
}

function collectDecodedFoldersByCampaign(documents = {}) {
  const byCampaign = new Map();
  for (const [docPath, rawDoc] of Object.entries(documents || {})) {
    const match = /^campaigns\/([^/]+)\/folders\/([^/]+)$/.exec(docPath);
    if (!match || !rawDoc || typeof rawDoc !== "object") continue;
    const [, campaignId, folderId] = match;
    if (!byCampaign.has(campaignId)) {
      byCampaign.set(campaignId, {
        byIdObj: {},
        rawById: new Map(),
        pathById: new Map()
      });
    }
    const bucket = byCampaign.get(campaignId);
    const decoded = decodeSnapshotValue(rawDoc);
    const normalizedRecord = {
      id: folderId,
      campaignId: decoded.campaignId ?? campaignId,
      ...decoded
    };
    bucket.byIdObj[folderId] = normalizedRecord;
    bucket.rawById.set(folderId, rawDoc);
    bucket.pathById.set(folderId, docPath);
  }
  return byCampaign;
}

const characterV2Validator = {
  id: "character-v2",
  check({ documents }) {
    const violations = [];
    const foldersByCampaign = collectDecodedFoldersByCampaign(documents);

    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const match = /^campaigns\/([^/]+)\/characters\/([^/]+)$/.exec(docPath);
      if (!match || !rawDoc || typeof rawDoc !== "object") continue;

      const [, campaignId, charId] = match;
      for (const legacyField of LEGACY_CHAR_TOP_FIELDS) {
        if (Object.hasOwn(rawDoc, legacyField)) {
          violations.push({
            path: docPath,
            code: `LEGACY_FIELD_${legacyField}`
          });
        }
      }

      const decoded = decodeSnapshotValue(rawDoc);
      const res = validateCharacter({
        id: charId,
        campaignId: decoded.campaignId ?? campaignId,
        ...decoded
      });
      if (!res.ok) {
        for (const err of res.errors) {
          violations.push({
            path: docPath,
            code: err.code || "INVALID_CHARACTER_V2"
          });
        }
      }

      const folderId =
        typeof decoded.folderId === "string" ? decoded.folderId.trim() : null;
      if (folderId) {
        const campaignFolders = foldersByCampaign.get(campaignId)?.byIdObj || {};
        const targetFolder = Object.hasOwn(campaignFolders, folderId)
          ? campaignFolders[folderId]
          : null;
        if (!targetFolder) {
          violations.push({
            path: docPath,
            code: "INVALID_CHARACTER_FOLDER_REF"
          });
        } else {
          if (targetFolder.domain !== FOLDER_DOMAINS.CHARACTER) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_CHARACTER_FOLDER_DOMAIN"
            });
          }
          if ((targetFolder.ownerId || null) !== (decoded.ownerId || null)) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_CHARACTER_FOLDER_OWNER"
            });
          }
          if (decoded.isDeleted !== true && targetFolder.isDeleted === true) {
            violations.push({
              path: docPath,
              code: "CHARACTER_IN_DELETED_FOLDER"
            });
          }
        }
      }
    }
    return violations;
  }
};

const compendiumEntryV2Validator = {
  id: "compendiumEntry-v2",
  check({ documents }) {
    const violations = [];
    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const match = /^campaigns\/([^/]+)\/compendium\/([^/]+)$/.exec(docPath);
      if (!match || !rawDoc || typeof rawDoc !== "object") continue;

      const [, campaignId, entryId] = match;
      for (const legacyField of LEGACY_COMPENDIUM_TOP_FIELDS) {
        if (Object.hasOwn(rawDoc, legacyField)) {
          violations.push({
            path: docPath,
            code: `LEGACY_FIELD_${legacyField}`
          });
        }
      }

      const decoded = decodeSnapshotValue(rawDoc);
      const res = validateCompendiumEntry({
        id: entryId,
        campaignId: decoded.campaignId ?? campaignId,
        ...decoded
      });
      if (!res.ok) {
        for (const err of res.errors) {
          violations.push({
            path: docPath,
            code: err.code || "INVALID_COMPENDIUM_V2"
          });
        }
      }
    }
    return violations;
  }
};

const folderV2Validator = {
  id: "folder-v2",
  check({ documents }) {
    const violations = [];
    const foldersByCampaign = collectDecodedFoldersByCampaign(documents);

    for (const [, bucket] of foldersByCampaign.entries()) {
      for (const [folderId, folder] of Object.entries(bucket.byIdObj)) {
        const docPath = bucket.pathById.get(folderId);
        const rawDoc = bucket.rawById.get(folderId) || {};

        for (const legacyField of LEGACY_FOLDER_TOP_FIELDS) {
          if (Object.hasOwn(rawDoc, legacyField)) {
            violations.push({
              path: docPath,
              code: `LEGACY_FIELD_${legacyField}`
            });
          }
        }

        const parentId =
          typeof folder.parentId === "string" && folder.parentId.trim()
            ? folder.parentId.trim()
            : null;
        const parentFolder =
          parentId && Object.hasOwn(bucket.byIdObj, parentId)
            ? bucket.byIdObj[parentId]
            : null;

        if (parentId && !parentFolder) {
          violations.push({
            path: docPath,
            code: "INVALID_FOLDER_PARENT_REF"
          });
        } else if (
          folder.isDeleted !== true &&
          parentFolder &&
          parentFolder.isDeleted === true
        ) {
          violations.push({
            path: docPath,
            code: "ACTIVE_FOLDER_IN_DELETED_PARENT"
          });
        }

        const validation = validateFolder(folder, {
          parentFolder,
          foldersById: bucket.byIdObj
        });
        if (!validation.ok) {
          for (const err of validation.errors) {
            violations.push({
              path: docPath,
              code: err.code || "INVALID_FOLDER_V2"
            });
          }
        }
      }
    }

    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const match = /^campaigns\/([^/]+)\/notes\/([^/]+)$/.exec(docPath);
      if (!match || !rawDoc || typeof rawDoc !== "object") continue;

      const [, campaignId] = match;
      if (rawDoc.isFolder === true) {
        violations.push({
          path: docPath,
          code: "LEGACY_NOTE_FOLDER_DOC"
        });
        continue;
      }

      if (Object.hasOwn(rawDoc, "folder")) {
        violations.push({
          path: docPath,
          code: "LEGACY_FIELD_folder"
        });
      }
      if (Object.hasOwn(rawDoc, "migratedToFoldersCollection")) {
        violations.push({
          path: docPath,
          code: "LEGACY_FIELD_migratedToFoldersCollection"
        });
      }

      const decoded = decodeSnapshotValue(rawDoc);
      if (decoded.folderId !== undefined && decoded.folderId !== null) {
        if (typeof decoded.folderId !== "string" || !decoded.folderId.trim()) {
          violations.push({
            path: docPath,
            code: "INVALID_NOTE_FOLDER_ID"
          });
          continue;
        }
        const campaignFolders = foldersByCampaign.get(campaignId)?.byIdObj || {};
        const targetFolder = Object.hasOwn(campaignFolders, decoded.folderId)
          ? campaignFolders[decoded.folderId]
          : null;
        if (!targetFolder) {
          violations.push({
            path: docPath,
            code: "INVALID_NOTE_FOLDER_REF"
          });
        } else {
          const noteScope = decoded.scope || NOTE_SCOPES.PARTY;
          const noteType = decoded.noteType || NOTE_TYPES.LORE;
          if (targetFolder.domain !== FOLDER_DOMAINS.JOURNAL) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_NOTE_FOLDER_DOMAIN"
            });
          }
          if (targetFolder.scope !== noteScope) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_NOTE_FOLDER_SCOPE"
            });
          }
          if (targetFolder.noteType !== noteType) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_NOTE_FOLDER_TYPE"
            });
          }
          if (
            targetFolder.scope === NOTE_SCOPES.PLAYER &&
            (targetFolder.ownerId || null) !== (decoded.ownerId || null)
          ) {
            violations.push({
              path: docPath,
              code: "INCOMPATIBLE_NOTE_FOLDER_OWNER"
            });
          }
          if (decoded.isDeleted !== true && targetFolder.isDeleted === true) {
            violations.push({
              path: docPath,
              code: "NOTE_IN_DELETED_FOLDER"
            });
          }
        }
      }
    }

    return violations;
  }
};

const noteV2Validator = {
  id: "note-v2",
  check({ documents }) {
    const violations = [];
    const foldersByCampaign = collectDecodedFoldersByCampaign(documents);

    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const match = /^campaigns\/([^/]+)\/notes\/([^/]+)$/.exec(docPath);
      if (!match || !rawDoc || typeof rawDoc !== "object") continue;

      const [, campaignId, noteId] = match;
      for (const legacyField of LEGACY_NOTE_TOP_FIELDS) {
        if (Object.hasOwn(rawDoc, legacyField)) {
          violations.push({
            path: docPath,
            code: `LEGACY_FIELD_${legacyField}`
          });
        }
      }

      const decoded = decodeSnapshotValue(rawDoc);
      const folderId =
        typeof decoded.folderId === "string" && decoded.folderId.trim()
          ? decoded.folderId.trim()
          : null;
      const campaignFolders = foldersByCampaign.get(campaignId)?.byIdObj || {};
      const targetFolder =
        folderId && Object.hasOwn(campaignFolders, folderId)
          ? campaignFolders[folderId]
          : null;

      const res = validateNote(
        {
          id: noteId,
          campaignId: decoded.campaignId ?? campaignId,
          ...decoded
        },
        targetFolder ? { folder: targetFolder } : {}
      );
      if (!res.ok) {
        for (const err of res.errors) {
          violations.push({
            path: docPath,
            code: err.code || "INVALID_NOTE_V2"
          });
        }
      }
    }

    return violations;
  }
};

const messagesV2Validator = {
  id: "messages-v2",
  check({ documents }) {
    const violations = [];
    const campaigns = new Map();
    const chatStateCampaigns = new Set(
      Object.keys(documents || {})
        .map((path) => /^campaigns\/([^/]+)\/state\/chat$/.exec(path)?.[1] || null)
        .filter(Boolean)
    );

    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const messageMatch = /^campaigns\/([^/]+)\/messages\/([^/]+)$/.exec(docPath);
      if (messageMatch && rawDoc && typeof rawDoc === "object") {
        const [, campaignId, messageId] = messageMatch;
        // A fatia de mensagens só passa a ser normativa depois da M008, que cria state/chat.
        if (!chatStateCampaigns.has(campaignId)) continue;
        if (!campaigns.has(campaignId)) {
          campaigns.set(campaignId, { seqs: new Map(), maxSeq: 0, lastMessageId: null });
        }
        const bucket = campaigns.get(campaignId);
        for (const legacyField of LEGACY_MESSAGE_TOP_FIELDS) {
          if (Object.hasOwn(rawDoc, legacyField)) {
            violations.push({ path: docPath, code: `LEGACY_FIELD_${legacyField}` });
          }
        }
        const decoded = decodeSnapshotValue(rawDoc);
        const candidate = {
          ...decoded,
          id: messageId,
          campaignId: decoded.campaignId ?? campaignId
        };
        const result = validateMessage(candidate);
        if (!result.ok) {
          for (const err of result.errors) {
            violations.push({ path: docPath, code: err.code || "INVALID_MESSAGE_V2" });
          }
        }
        if (Number.isInteger(decoded.seq) && decoded.seq > 0) {
          if (bucket.seqs.has(decoded.seq)) {
            violations.push({ path: docPath, code: "DUPLICATE_MESSAGE_SEQ" });
          } else {
            bucket.seqs.set(decoded.seq, messageId);
          }
          if (decoded.seq > bucket.maxSeq) {
            bucket.maxSeq = decoded.seq;
            bucket.lastMessageId = messageId;
          }
        }
        continue;
      }

      const pendingMatch = /^campaigns\/([^/]+)\/pendingCosts\/([^/]+)$/.exec(docPath);
      if (pendingMatch && rawDoc && typeof rawDoc === "object") {
        const [, campaignId, opId] = pendingMatch;
        const decoded = decodeSnapshotValue(rawDoc);
        const result = validatePendingCost({
          ...decoded,
          id: opId,
          opId: decoded.opId ?? opId,
          campaignId: decoded.campaignId ?? campaignId
        });
        if (!result.ok) {
          for (const err of result.errors) {
            violations.push({ path: docPath, code: err.code || "INVALID_PENDING_COST_V2" });
          }
        }
      }
    }

    for (const [campaignId, bucket] of campaigns.entries()) {
      const statePath = `campaigns/${campaignId}/state/chat`;
      const rawState = documents?.[statePath];
      if (!rawState || typeof rawState !== "object") {
        violations.push({ path: statePath, code: "MISSING_CHAT_STATE" });
        continue;
      }
      const decodedState = decodeSnapshotValue(rawState);
      if (decodedState.campaignId !== campaignId) {
        violations.push({ path: statePath, code: "CHAT_STATE_CAMPAIGN_MISMATCH" });
      }
      const stateResult = validateChatState(decodedState);
      if (!stateResult.ok) {
        for (const err of stateResult.errors) {
          violations.push({ path: statePath, code: err.code || "INVALID_CHAT_STATE" });
        }
      }
      if (decodedState.lastSeq !== bucket.maxSeq) {
        violations.push({ path: statePath, code: "CHAT_STATE_LAST_SEQ_MISMATCH" });
      }
      if ((decodedState.lastMessageId ?? null) !== bucket.lastMessageId) {
        violations.push({ path: statePath, code: "CHAT_STATE_LAST_MESSAGE_MISMATCH" });
      }
    }

    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const stateMatch = /^campaigns\/([^/]+)\/state\/chat$/.exec(docPath);
      if (!stateMatch || campaigns.has(stateMatch[1])) continue;
      const campaignId = stateMatch[1];
      const decodedState = decodeSnapshotValue(rawDoc);
      const stateResult = validateChatState(decodedState);
      if (!stateResult.ok) {
        for (const err of stateResult.errors) {
          violations.push({ path: docPath, code: err.code || "INVALID_CHAT_STATE" });
        }
      }
      if (decodedState.campaignId !== campaignId) {
        violations.push({ path: docPath, code: "CHAT_STATE_CAMPAIGN_MISMATCH" });
      }
      if (decodedState.lastSeq !== 0 || decodedState.lastMessageId !== null) {
        violations.push({ path: docPath, code: "CHAT_STATE_WITHOUT_MESSAGES" });
      }
    }

    return violations;
  }
};

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hydrateRtdbToken(raw, id) {
  const src = isPlainRecord(raw) ? raw : {};
  const rawImg = isPlainRecord(src.image) ? src.image : {};
  const rawBars = isPlainRecord(src.bars) ? src.bars : null;
  return {
    ...src,
    id: src.id ?? id,
    characterId: src.characterId ?? null,
    controlledBy: isPlainRecord(src.controlledBy) ? src.controlledBy : {},
    label: src.label ?? null,
    image: {
      mediaId: rawImg.mediaId ?? null,
      url: rawImg.url ?? null
    },
    bars: rawBars
      ? {
          hpCurrent: rawBars.hpCurrent ?? null,
          hpMax: rawBars.hpMax ?? null,
          mpCurrent: rawBars.mpCurrent ?? null,
          mpMax: rawBars.mpMax ?? null
        }
      : null,
    updatedAt: src.updatedAt ?? null,
    updatedBy: src.updatedBy ?? null
  };
}

function hydrateRtdbSecret(raw) {
  const src = isPlainRecord(raw) ? raw : {};
  return {
    ...src,
    hp: src.hp ?? null,
    mp: src.mp ?? null,
    recentOps: isPlainRecord(src.recentOps) ? src.recentOps : {}
  };
}

function hydrateRtdbDrawing(raw, id) {
  const src = isPlainRecord(raw) ? raw : {};
  const base = {
    ...src,
    id: src.id ?? id,
    authorName: src.authorName ?? null,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null,
    updatedBy: src.updatedBy ?? null
  };
  if (base.type === DRAWING_TYPES.RECT || base.type === DRAWING_TYPES.CIRCLE) {
    base.fillColor = src.fillColor ?? null;
  }
  return base;
}

function hydrateRtdbFog(raw) {
  const src = isPlainRecord(raw) ? raw : {};
  const rawAreas = isPlainRecord(src.areas) ? src.areas : {};
  const areas = {};
  for (const [areaId, area] of Object.entries(rawAreas)) {
    if (isPlainRecord(area)) {
      areas[areaId] = {
        ...area,
        createdAt: area.createdAt ?? null
      };
    } else {
      areas[areaId] = area;
    }
  }
  return {
    ...src,
    areas,
    updatedAt: src.updatedAt ?? null
  };
}

const rtdbV2Validator = {
  id: "rtdb-v2",
  check({ documents, database }) {
    const violations = [];
    if (!isPlainRecord(database) || !isPlainRecord(database.vtt_realtime)) {
      return violations;
    }

    const charsByCampaign = new Map();
    for (const [docPath, rawDoc] of Object.entries(documents || {})) {
      const match = /^campaigns\/([^/]+)\/characters\/([^/]+)$/.exec(docPath);
      if (!match || !isPlainRecord(rawDoc)) continue;
      const [, campaignId, charId] = match;
      if (!charsByCampaign.has(campaignId)) {
        charsByCampaign.set(campaignId, new Map());
      }
      charsByCampaign.get(campaignId).set(charId, rawDoc);
    }

    for (const [campaignId, campNode] of Object.entries(database.vtt_realtime)) {
      if (!isPlainRecord(campNode)) continue;
      const campPrefix = `vtt_realtime/${campaignId}`;
      const campChars = charsByCampaign.get(campaignId) || new Map();

      const tokensRoot = isPlainRecord(campNode.tokens) ? campNode.tokens : {};
      const hiddenRoot = isPlainRecord(campNode.hiddenTokens) ? campNode.hiddenTokens : {};
      const secretsRoot = isPlainRecord(campNode.tokenSecrets) ? campNode.tokenSecrets : {};
      const fogRoot = isPlainRecord(campNode.fog) ? campNode.fog : {};
      const drawingsRoot = isPlainRecord(campNode.drawings) ? campNode.drawings : {};
      const pingsRoot = isPlainRecord(campNode.pings) ? campNode.pings : {};

      const sceneIds = new Set([
        ...Object.keys(tokensRoot),
        ...Object.keys(hiddenRoot),
        ...Object.keys(secretsRoot),
        ...Object.keys(fogRoot),
        ...Object.keys(drawingsRoot),
        ...Object.keys(pingsRoot)
      ]);

      for (const sceneId of sceneIds) {
        const pubTokens = isPlainRecord(tokensRoot[sceneId]) ? tokensRoot[sceneId] : {};
        const hidTokens = isPlainRecord(hiddenRoot[sceneId]) ? hiddenRoot[sceneId] : {};
        const sceneSecrets = isPlainRecord(secretsRoot[sceneId]) ? secretsRoot[sceneId] : {};

        const nonPcTokenIds = new Set();

        const validateBucket = (bucketMap, bucketName) => {
          for (const [tokenId, rawTok] of Object.entries(bucketMap)) {
            const tokPath = `${campPrefix}/${bucketName}/${sceneId}/${tokenId}`;
            if (!isPlainRecord(rawTok)) {
              violations.push({ path: tokPath, code: "INVALID_TOKEN_NODE" });
              continue;
            }
            for (const legacyKey of LEGACY_TOKEN_KEYS) {
              if (Object.hasOwn(rawTok, legacyKey)) {
                violations.push({ path: tokPath, code: `LEGACY_FIELD_${legacyKey}` });
              }
            }
            if (bucketName === "tokens" && rawTok.hidden !== false) {
              violations.push({ path: tokPath, code: "PUBLIC_TOKEN_MARKED_HIDDEN" });
            }
            if (bucketName === "tokens" && Object.hasOwn(hidTokens, tokenId)) {
              violations.push({ path: tokPath, code: "DUPLICATE_TOKEN_IN_BOTH_BUCKETS" });
            }

            const hydrated = hydrateRtdbToken(rawTok, tokenId);
            const res = validateToken(hydrated);
            if (!res.ok) {
              for (const err of res.errors) {
                violations.push({ path: tokPath, code: err.code || "INVALID_TOKEN_V2" });
              }
            }

            if (hydrated.kind === TOKEN_KINDS.PC) {
              if (Object.hasOwn(sceneSecrets, tokenId)) {
                violations.push({
                  path: `${campPrefix}/tokenSecrets/${sceneId}/${tokenId}`,
                  code: "PC_TOKEN_MUST_NOT_HAVE_SECRETS"
                });
              }
              const linkedChar = hydrated.characterId
                ? campChars.get(hydrated.characterId)
                : null;
              if (
                linkedChar &&
                typeof linkedChar.rev === "number" &&
                typeof hydrated.rev === "number" &&
                hydrated.rev !== linkedChar.rev
              ) {
                violations.push({ path: tokPath, code: "PC_PROJECTION_REV_MISMATCH" });
              }
            } else {
              nonPcTokenIds.add(tokenId);
              if (!Object.hasOwn(sceneSecrets, tokenId)) {
                violations.push({
                  path: `${campPrefix}/tokenSecrets/${sceneId}/${tokenId}`,
                  code: "MISSING_TOKEN_SECRETS"
                });
              }
            }
          }
        };

        validateBucket(pubTokens, "tokens");
        validateBucket(hidTokens, "hiddenTokens");

        for (const [tokenId, rawSec] of Object.entries(sceneSecrets)) {
          const secPath = `${campPrefix}/tokenSecrets/${sceneId}/${tokenId}`;
          if (!nonPcTokenIds.has(tokenId)) {
            violations.push({ path: secPath, code: "ORPHAN_TOKEN_SECRET" });
            continue;
          }
          if (!isPlainRecord(rawSec)) {
            violations.push({ path: secPath, code: "INVALID_TOKEN_SECRET_NODE" });
            continue;
          }
          for (const forbidden of ["campaignId", "sceneId"]) {
            if (Object.hasOwn(rawSec, forbidden)) {
              violations.push({ path: secPath, code: `LEGACY_FIELD_${forbidden}` });
            }
          }
          const res = validateTokenSecret(hydrateRtdbSecret(rawSec));
          if (!res.ok) {
            for (const err of res.errors) {
              violations.push({
                path: secPath,
                code: err.code || "INVALID_TOKEN_SECRET_V2"
              });
            }
          }
        }

        if (Object.hasOwn(fogRoot, sceneId)) {
          const fogPath = `${campPrefix}/fog/${sceneId}`;
          const rawFog = fogRoot[sceneId];
          if (!isPlainRecord(rawFog)) {
            violations.push({ path: fogPath, code: "INVALID_FOG_NODE" });
          } else {
            for (const legacyKey of LEGACY_FOG_KEYS) {
              if (Object.hasOwn(rawFog, legacyKey)) {
                violations.push({ path: fogPath, code: `LEGACY_FIELD_${legacyKey}` });
              }
            }
            if (
              Object.hasOwn(rawFog, "areas") &&
              rawFog.areas !== null &&
              !isPlainRecord(rawFog.areas)
            ) {
              violations.push({
                path: `${fogPath}/areas`,
                code: "INVALID_FOG_AREAS_NODE"
              });
            } else if (isPlainRecord(rawFog.areas)) {
              for (const [areaId, rawArea] of Object.entries(rawFog.areas)) {
                if (!isPlainRecord(rawArea)) continue;
                const areaPath = `${fogPath}/areas/${areaId}`;
                if (Object.hasOwn(rawArea, "campaignId")) {
                  violations.push({
                    path: areaPath,
                    code: "LEGACY_FIELD_campaignId"
                  });
                }
                if (Object.hasOwn(rawArea, "sceneId")) {
                  violations.push({
                    path: areaPath,
                    code: "LEGACY_FIELD_sceneId"
                  });
                }
              }
            }
            const res = validateFog(hydrateRtdbFog(rawFog));
            if (!res.ok) {
              for (const err of res.errors) {
                violations.push({ path: fogPath, code: err.code || "INVALID_FOG_V2" });
              }
            }
          }
        }

        const sceneDrawings = isPlainRecord(drawingsRoot[sceneId]) ? drawingsRoot[sceneId] : {};
        for (const [drawingId, rawDrawing] of Object.entries(sceneDrawings)) {
          const drawPath = `${campPrefix}/drawings/${sceneId}/${drawingId}`;
          if (!isPlainRecord(rawDrawing)) {
            violations.push({ path: drawPath, code: "INVALID_DRAWING_NODE" });
            continue;
          }
          for (const legacyKey of LEGACY_DRAWING_KEYS) {
            if (Object.hasOwn(rawDrawing, legacyKey)) {
              violations.push({ path: drawPath, code: `LEGACY_FIELD_${legacyKey}` });
            }
          }
          const res = validateDrawing(hydrateRtdbDrawing(rawDrawing, drawingId));
          if (!res.ok) {
            for (const err of res.errors) {
              violations.push({
                path: drawPath,
                code: err.code || "INVALID_DRAWING_V2"
              });
            }
          }
        }

        const scenePings = isPlainRecord(pingsRoot[sceneId]) ? pingsRoot[sceneId] : {};
        for (const [pingId, rawPing] of Object.entries(scenePings)) {
          const pingPath = `${campPrefix}/pings/${sceneId}/${pingId}`;
          if (!isPlainRecord(rawPing)) {
            violations.push({ path: pingPath, code: "INVALID_PING_NODE" });
            continue;
          }
          for (const legacyKey of LEGACY_PING_KEYS) {
            if (Object.hasOwn(rawPing, legacyKey)) {
              violations.push({ path: pingPath, code: `LEGACY_FIELD_${legacyKey}` });
            }
          }
          const res = validatePing({
            ...rawPing,
            id: rawPing.id ?? pingId,
            from: rawPing.from ?? null,
            createdAt: rawPing.createdAt ?? null
          });
          if (!res.ok) {
            for (const err of res.errors) {
              violations.push({ path: pingPath, code: err.code || "INVALID_PING_V2" });
            }
          }
        }
      }

      if (isPlainRecord(campNode.presence)) {
        for (const [uid, userNode] of Object.entries(campNode.presence)) {
          const userPresencePath = `${campPrefix}/presence/${uid}`;
          if (!isPlainRecord(userNode)) {
            violations.push({ path: userPresencePath, code: "INVALID_PRESENCE_USER_NODE" });
            continue;
          }
          for (const [connId, connVal] of Object.entries(userNode)) {
            const connPath = `${userPresencePath}/${connId}`;
            if (!isPlainRecord(connVal)) {
              violations.push({ path: connPath, code: "LEGACY_FLAT_PRESENCE_NODE" });
              continue;
            }
            for (const forbidden of ["campaignId", "sceneId"]) {
              if (Object.hasOwn(connVal, forbidden)) {
                violations.push({ path: connPath, code: `LEGACY_FIELD_${forbidden}` });
              }
            }
            const res = validatePresence({
              kind: connVal.kind,
              sheetId: connVal.sheetId ?? null,
              connectedAt: connVal.connectedAt ?? null
            });
            if (!res.ok) {
              for (const err of res.errors) {
                violations.push({
                  path: connPath,
                  code: err.code || "INVALID_PRESENCE_V2"
                });
              }
            }
          }
        }
      }
    }

    return violations;
  }
};

export const AUDIT_VALIDATORS = [
  characterV2Validator,
  compendiumEntryV2Validator,
  folderV2Validator,
  noteV2Validator,
  messagesV2Validator,
  rtdbV2Validator
];
