import {
  DEFAULT_CELL_SIZE_PX,
  DRAWING_TYPES,
  LAYER_NAMES,
  PING_LIFETIME_MS,
  TOKEN_KINDS
} from "../../src/domain/constants.js";
import {
  DEFAULT_CHARACTER_HP,
  DEFAULT_CHARACTER_MP,
  DEFAULT_COLORS,
  DEFAULT_FREE_TOKEN_DEFENSE,
  DEFAULT_NAMES
} from "../../src/domain/defaults.js";
import {
  LEGACY_DRAWING_KEYS,
  LEGACY_FOG_KEYS,
  LEGACY_PING_KEYS,
  LEGACY_TOKEN_KEYS,
  buildPcProjectionFromCharacter,
  fromDrawingDoc,
  fromFogDoc,
  fromTokenSecretDoc,
  fromTokenDoc,
  isPingExpired,
  normalizeImageRef,
  projectPublicBars,
  toDrawingDoc,
  toFogDoc,
  toTokenDoc,
  toTokenSecretDoc,
  validateDrawing,
  validateFog,
  validatePing,
  validatePresence,
  validateToken,
  validateTokenSecret
} from "../../src/domain/models/index.js";
import { toControlledByMap } from "../../src/domain/permissions.js";
import { partitionTokensByFog } from "../../src/engines/fog/index.js";

const VALID_LAYERS = new Set(Object.values(LAYER_NAMES));

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRtdbWire(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const cleanedArr = value
      .map((item) => cleanRtdbWire(item))
      .filter((item) => item !== undefined);
    return cleanedArr.length > 0 ? cleanedArr : undefined;
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const next = cleanRtdbWire(v);
      if (next !== undefined) {
        out[k] = next;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value;
}

function stableEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((v, idx) => stableEquals(v, b[idx]));
  }
  const keysA = Object.keys(a)
    .filter((k) => a[k] !== undefined)
    .sort();
  const keysB = Object.keys(b)
    .filter((k) => b[k] !== undefined)
    .sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, idx) => k === keysB[idx] && stableEquals(a[k], b[k]));
}

function normalizeWireToken(token) {
  const doc = toTokenDoc(token);
  return cleanRtdbWire(doc) || {};
}

function normalizeWireSecret(secret) {
  const doc = toTokenSecretDoc(secret);
  const wire = cleanRtdbWire(doc) || {};
  wire.defense = doc.defense;
  wire.showBarsToPlayers = doc.showBarsToPlayers;
  return wire;
}

function normalizeWireFog(fog) {
  const doc = toFogDoc(fog);
  const wire = cleanRtdbWire(doc) || {};
  wire.enabled = Boolean(doc.enabled);
  return wire;
}

function normalizeWireDrawing(drawing) {
  const doc = toDrawingDoc(drawing);
  return cleanRtdbWire(doc) || {};
}

function normalizeDrawingEntry(raw, id, fallbackAuthorId) {
  if (!isPlainRecord(raw)) return null;
  const parsed = fromDrawingDoc(raw, id);
  const authorId = trimOrNull(parsed.authorId) || fallbackAuthorId || "system";
  const layer = VALID_LAYERS.has(parsed.layer) ? parsed.layer : LAYER_NAMES.TOKENS;

  const candidate = {
    ...parsed,
    id,
    authorId,
    layer
  };

  if (candidate.type === DRAWING_TYPES.STROKE) {
    const validPoints = Array.isArray(candidate.points)
      ? candidate.points.filter(
          (pt) =>
            isPlainRecord(pt) &&
            typeof pt.x === "number" &&
            Number.isFinite(pt.x) &&
            typeof pt.y === "number" &&
            Number.isFinite(pt.y)
        )
      : [];
    if (validPoints.length === 0) return null;
    candidate.points = validPoints;
    if (!trimOrNull(candidate.color)) {
      candidate.color = DEFAULT_COLORS.drawingStroke;
    }
    if (!(typeof candidate.width === "number" && Number.isFinite(candidate.width) && candidate.width > 0)) {
      candidate.width = 4;
    }
  } else if (
    candidate.type === DRAWING_TYPES.RECT ||
    candidate.type === DRAWING_TYPES.CIRCLE
  ) {
    if (!trimOrNull(candidate.strokeColor)) {
      candidate.strokeColor = DEFAULT_COLORS.drawingStroke;
    }
    if (
      !(
        typeof candidate.strokeWidth === "number" &&
        Number.isFinite(candidate.strokeWidth) &&
        candidate.strokeWidth > 0
      )
    ) {
      candidate.strokeWidth = 4;
    }
    candidate.hasFill = Boolean(candidate.hasFill);
    candidate.fillColor = candidate.hasFill
      ? trimOrNull(candidate.fillColor) || DEFAULT_COLORS.drawingFill
      : null;
    candidate.w = Math.max(0, Number.isFinite(candidate.w) ? candidate.w : 0);
    candidate.h = Math.max(0, Number.isFinite(candidate.h) ? candidate.h : 0);
    candidate.x = Number.isFinite(candidate.x) ? candidate.x : 0;
    candidate.y = Number.isFinite(candidate.y) ? candidate.y : 0;
    candidate.rotation = Number.isFinite(candidate.rotation) ? candidate.rotation : 0;
  } else if (candidate.type === DRAWING_TYPES.TEXT) {
    const cleanText = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (!cleanText) return null;
    candidate.text = cleanText;
    if (!trimOrNull(candidate.color)) {
      candidate.color = DEFAULT_COLORS.drawingStroke;
    }
    if (!trimOrNull(candidate.fontFamily)) {
      candidate.fontFamily = "Comic Sans MS, Comic Sans, cursive, sans-serif";
    }
    if (
      !(
        typeof candidate.fontSize === "number" &&
        Number.isFinite(candidate.fontSize) &&
        candidate.fontSize > 0
      )
    ) {
      candidate.fontSize = 24;
    }
    candidate.x = Number.isFinite(candidate.x) ? candidate.x : 0;
    candidate.y = Number.isFinite(candidate.y) ? candidate.y : 0;
    candidate.rotation = Number.isFinite(candidate.rotation) ? candidate.rotation : 0;
  } else {
    return null;
  }

  const check = validateDrawing(candidate);
  if (!check.ok) return null;
  return candidate;
}

function normalizeFogNode(rawFog) {
  if (!isPlainRecord(rawFog)) return null;
  const hasRealFogState =
    Object.hasOwn(rawFog, "enabled") ||
    (isPlainRecord(rawFog.areas) && Object.keys(rawFog.areas).length > 0) ||
    (Array.isArray(rawFog.areas) && rawFog.areas.length > 0);
  if (!hasRealFogState) {
    // Nó `fog/{scene}` continha apenas `drawings` ou `pings` legados: remover após migração.
    return null;
  }

  const parsed = fromFogDoc(rawFog);
  const cleanAreas = {};
  for (const [areaId, area] of Object.entries(parsed.areas || {})) {
    if (!isPlainRecord(area)) continue;
    const w = Number(area.w);
    const h = Number(area.h);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
      continue;
    }
    cleanAreas[areaId] = {
      id: areaId,
      op: area.op === "hide" ? "hide" : "reveal",
      x: Number.isFinite(area.x) ? area.x : 0,
      y: Number.isFinite(area.y) ? area.y : 0,
      w,
      h,
      createdAt:
        typeof area.createdAt === "number" && Number.isFinite(area.createdAt) && area.createdAt >= 0
          ? area.createdAt
          : null
    };
  }

  const candidate = {
    enabled: Boolean(parsed.enabled),
    areas: cleanAreas,
    updatedAt:
      typeof parsed.updatedAt === "number" &&
      Number.isFinite(parsed.updatedAt) &&
      parsed.updatedAt >= 0
        ? parsed.updatedAt
        : null
  };

  const check = validateFog(candidate);
  return check.ok ? candidate : null;
}

function migrateTokenRecord({
  tokenId,
  rawToken,
  existingSecret,
  charactersById,
  gmUid
}) {
  const parsed = fromTokenDoc(rawToken, tokenId);
  const linkedChar = parsed.characterId
    ? charactersById.get(parsed.characterId) || null
    : null;

  let kind = parsed.kind;
  if (linkedChar) {
    kind = linkedChar.type === "pc" ? TOKEN_KINDS.PC : TOKEN_KINDS.NPC;
  } else if (parsed.characterId && !rawToken.kind) {
    if (rawToken.characterType === "npc" || rawToken.isGmToken === true) {
      kind = TOKEN_KINDS.NPC;
    } else {
      kind = TOKEN_KINDS.PC;
    }
  } else if (!parsed.characterId) {
    kind = TOKEN_KINDS.FREE;
  }

  const characterId = kind === TOKEN_KINDS.FREE ? null : parsed.characterId;
  const ownerId =
    trimOrNull(parsed.ownerId) ||
    trimOrNull(linkedChar?.ownerId) ||
    gmUid ||
    "system";
  const layer = VALID_LAYERS.has(parsed.layer) ? parsed.layer : LAYER_NAMES.TOKENS;
  const controlledBy = toControlledByMap(parsed.controlledBy);
  let sizeInCells = Math.max(1, Math.min(8, Number(parsed.sizeInCells) || 1));
  const x = Number.isFinite(parsed.x) ? parsed.x : 0;
  const y = Number.isFinite(parsed.y) ? parsed.y : 0;
  const rotation = Number.isFinite(parsed.rotation) ? parsed.rotation : 0;
  let ringColor = trimOrNull(parsed.ringColor) || DEFAULT_COLORS.tokenRing;
  let showName = parsed.showName !== false;

  const hidden =
    typeof rawToken.hidden === "boolean"
      ? rawToken.hidden
      : typeof rawToken.visibleToPlayers === "boolean"
        ? !rawToken.visibleToPlayers
        : false;

  let label = trimOrNull(parsed.label) ?? DEFAULT_NAMES.token;
  let image = normalizeImageRef(parsed.image);
  let bars = parsed.bars;
  let rev =
    typeof parsed.rev === "number" && Number.isInteger(parsed.rev) && parsed.rev >= 0
      ? parsed.rev
      : 0;
  let secretDoc = null;

  if (kind === TOKEN_KINDS.PC) {
    if (linkedChar) {
      const projection = buildPcProjectionFromCharacter(linkedChar);
      if (projection) {
        label = projection.label;
        image = normalizeImageRef(projection.image);
        bars = projection.bars;
        ringColor = projection.ringColor;
        showName = projection.showName;
        sizeInCells = projection.sizeInCells;
        rev = projection.rev;
      }
    }
  } else {
    const secretSource = isPlainRecord(existingSecret) ? existingSecret : rawToken;
    const rawSecret = fromTokenSecretDoc(secretSource);
    const hasLegacyHp =
      rawToken.hpCurrent !== undefined ||
      rawToken.hpMax !== undefined ||
      isPlainRecord(secretSource.hp);
    const hasLegacyMp =
      rawToken.mpCurrent !== undefined ||
      rawToken.mpMax !== undefined ||
      isPlainRecord(secretSource.mp);

    const hp = hasLegacyHp
      ? rawSecret.hp
      : kind === TOKEN_KINDS.NPC && linkedChar?.resources?.hp
        ? {
            current: Number(linkedChar.resources.hp.current ?? DEFAULT_CHARACTER_HP.current),
            max: Number(linkedChar.resources.hp.max ?? DEFAULT_CHARACTER_HP.max)
          }
        : rawSecret.hp;
    const mp = hasLegacyMp
      ? rawSecret.mp
      : kind === TOKEN_KINDS.NPC && linkedChar?.resources?.mp
        ? {
            current: Number(linkedChar.resources.mp.current ?? DEFAULT_CHARACTER_MP.current),
            max: Number(linkedChar.resources.mp.max ?? DEFAULT_CHARACTER_MP.max)
          }
        : rawSecret.mp;

    const defense =
      typeof rawSecret.defense === "number" &&
      Number.isFinite(rawSecret.defense) &&
      rawSecret.defense >= 0
        ? rawSecret.defense
        : Number(linkedChar?.defense ?? DEFAULT_FREE_TOKEN_DEFENSE) ||
          DEFAULT_FREE_TOKEN_DEFENSE;

    secretDoc = {
      defense,
      hp:
        hp && Number.isFinite(hp.current) && Number.isFinite(hp.max)
          ? { current: Math.max(0, hp.current), max: Math.max(0, hp.max) }
          : null,
      mp:
        mp && Number.isFinite(mp.current) && Number.isFinite(mp.max)
          ? { current: Math.max(0, mp.current), max: Math.max(0, mp.max) }
          : null,
      showBarsToPlayers: rawSecret.showBarsToPlayers !== false,
      recentOps: rawSecret.recentOps || {}
    };

    const secretCheck = validateTokenSecret(secretDoc);
    if (!secretCheck.ok) {
      throw new Error(
        `M007: tokenSecret inválido para ${tokenId}: ${secretCheck.errors.map((e) => e.message).join("; ")}`
      );
    }
    bars = projectPublicBars(secretDoc);
  }

  const publicDoc = {
    id: tokenId,
    kind,
    characterId,
    ownerId,
    controlledBy,
    layer,
    hidden,
    label,
    image,
    x,
    y,
    sizeInCells,
    rotation,
    ringColor,
    showName,
    bars,
    rev,
    updatedAt:
      typeof parsed.updatedAt === "number" &&
      Number.isFinite(parsed.updatedAt) &&
      parsed.updatedAt >= 0
        ? parsed.updatedAt
        : null,
    updatedBy: trimOrNull(parsed.updatedBy)
  };

  const check = validateToken(publicDoc);
  if (!check.ok) {
    throw new Error(
      `M007: token inválido ${tokenId}: ${check.errors.map((e) => e.message).join("; ")}`
    );
  }

  return { publicDoc, secretDoc };
}

function isValidV2PresenceUser(rawUserNode) {
  if (!isPlainRecord(rawUserNode)) return false;
  const entries = Object.entries(rawUserNode);
  if (entries.length === 0) return false;
  for (const [, conn] of entries) {
    if (!isPlainRecord(conn)) return false;
    if (Object.hasOwn(conn, "campaignId") || Object.hasOwn(conn, "sceneId")) {
      return false;
    }
    const res = validatePresence({
      kind: conn.kind,
      sheetId: conn.sheetId ?? null,
      connectedAt: conn.connectedAt ?? null
    });
    if (!res.ok) return false;
  }
  return true;
}

function isValidActiveV2Ping(rawPing, pingId, nowMs) {
  if (!isPlainRecord(rawPing)) return false;
  for (const legacyKey of LEGACY_PING_KEYS) {
    if (Object.hasOwn(rawPing, legacyKey)) return false;
  }
  const candidate = {
    ...rawPing,
    id: rawPing.id ?? pingId,
    from: rawPing.from ?? null,
    createdAt: rawPing.createdAt ?? null
  };
  const check = validatePing(candidate);
  if (!check.ok) return false;
  if (typeof candidate.createdAt !== "number") return false;
  return !isPingExpired(candidate, nowMs, PING_LIFETIME_MS);
}

export default {
  id: "M007-rtdb-v2",
  description:
    "Migra o RTDB do tabuleiro para schema v2 (tokens/hiddenTokens/tokenSecrets, ImageRef, drawings unificados fora do fog, limpeza de pings e presença legada).",

  async plan({ firestore, database }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      scenesScanned: 0,
      tokensMigrated: 0,
      tokensMovedToHidden: 0,
      tokenSecretsWritten: 0,
      tokenSecretsRemoved: 0,
      drawingsMigratedFromFog: 0,
      drawingsNormalized: 0,
      drawingsDroppedInvalid: 0,
      fogNodesNormalized: 0,
      fogNodesRemovedEmpty: 0,
      pingsRemoved: 0,
      presenceNodesCleaned: 0
    };

    const nowMs = Date.now();
    const rootSnap = await database.ref("vtt_realtime").get();
    const rtdbCampaigns = rootSnap.exists() ? rootSnap.val() || {} : {};

    const fsCampaignsSnap = firestore
      ? await firestore.collection("campaigns").get()
      : { docs: [] };
    const fsCampaignDataById = new Map();
    for (const cDoc of fsCampaignsSnap.docs) {
      fsCampaignDataById.set(cDoc.id, cDoc.data() || {});
    }

    const campaignIds = Array.from(new Set(Object.keys(rtdbCampaigns))).sort();

    for (const campaignId of campaignIds) {
      const campRtdb = rtdbCampaigns[campaignId];
      if (!isPlainRecord(campRtdb)) continue;
      summary.campaignsProcessed += 1;

      const fsCamp = fsCampaignDataById.get(campaignId) || {};
      const gmUid =
        trimOrNull(campRtdb.meta?.gmId) ||
        trimOrNull(fsCamp.gmId) ||
        null;

      const charactersById = new Map();
      const scenesCellSizeById = new Map();
      if (firestore && fsCampaignDataById.has(campaignId)) {
        const [charsSnap, scenesSnap] = await Promise.all([
          firestore.collection(`campaigns/${campaignId}/characters`).get(),
          firestore.collection(`campaigns/${campaignId}/scenes`).get()
        ]);
        for (const chDoc of charsSnap.docs) {
          charactersById.set(chDoc.id, { id: chDoc.id, ...(chDoc.data() || {}) });
        }
        for (const scDoc of scenesSnap.docs) {
          const sc = scDoc.data() || {};
          scenesCellSizeById.set(
            scDoc.id,
            Math.max(16, Number(sc.grid?.cellSizePx) || DEFAULT_CELL_SIZE_PX)
          );
        }
      }

      const rawTokensByScene = isPlainRecord(campRtdb.tokens) ? campRtdb.tokens : {};
      const rawHiddenByScene = isPlainRecord(campRtdb.hiddenTokens)
        ? campRtdb.hiddenTokens
        : {};
      const rawSecretsByScene = isPlainRecord(campRtdb.tokenSecrets)
        ? campRtdb.tokenSecrets
        : {};
      const rawFogByScene = isPlainRecord(campRtdb.fog) ? campRtdb.fog : {};
      const rawDrawingsByScene = isPlainRecord(campRtdb.drawings) ? campRtdb.drawings : {};
      const rawPingsByScene = isPlainRecord(campRtdb.pings) ? campRtdb.pings : {};

      const allSceneIds = Array.from(
        new Set([
          ...Object.keys(rawTokensByScene),
          ...Object.keys(rawHiddenByScene),
          ...Object.keys(rawSecretsByScene),
          ...Object.keys(rawFogByScene),
          ...Object.keys(rawDrawingsByScene),
          ...Object.keys(rawPingsByScene)
        ])
      ).sort();

      const multiUpdates = {};

      for (const sceneId of allSceneIds) {
        summary.scenesScanned += 1;

        // 1. Fog & migração de fog/{scene}/drawings -> drawings/{scene}
        const rawFog = rawFogByScene[sceneId];
        const legacyFogDrawings = isPlainRecord(rawFog?.drawings) ? rawFog.drawings : {};
        const targetFogObj = normalizeFogNode(rawFog);
        const targetFogWire = targetFogObj ? normalizeWireFog(targetFogObj) : null;

        if (rawFog !== undefined) {
          const hasLegacyFogKey =
            isPlainRecord(rawFog) &&
            LEGACY_FOG_KEYS.some((k) => Object.hasOwn(rawFog, k));
          if (!targetFogWire) {
            multiUpdates[`fog/${sceneId}`] = null;
            summary.fogNodesRemovedEmpty += 1;
          } else if (hasLegacyFogKey || !stableEquals(rawFog, targetFogWire)) {
            multiUpdates[`fog/${sceneId}`] = targetFogWire;
            summary.fogNodesNormalized += 1;
          }
        }

        // 2. Drawings (unifica existentes + vindos de fog/{scene}/drawings)
        const existingSceneDrawings = isPlainRecord(rawDrawingsByScene[sceneId])
          ? rawDrawingsByScene[sceneId]
          : {};
        const mergedDrawingSources = new Map();
        for (const [dId, rawD] of Object.entries(legacyFogDrawings)) {
          mergedDrawingSources.set(dId, { raw: rawD, fromFog: true });
        }
        for (const [dId, rawD] of Object.entries(existingSceneDrawings)) {
          mergedDrawingSources.set(dId, { raw: rawD, fromFog: false });
        }

        for (const [drawingId, { raw: rawD, fromFog }] of mergedDrawingSources.entries()) {
          const normalized = normalizeDrawingEntry(rawD, drawingId, gmUid);
          if (!normalized) {
            if (!fromFog) {
              multiUpdates[`drawings/${sceneId}/${drawingId}`] = null;
            }
            summary.drawingsDroppedInvalid += 1;
            continue;
          }
          const wireDrawing = normalizeWireDrawing(normalized);
          const existingAtTarget = existingSceneDrawings[drawingId];
          const hasLegacyDrawingKey =
            isPlainRecord(existingAtTarget) &&
            LEGACY_DRAWING_KEYS.some((k) => Object.hasOwn(existingAtTarget, k));

          if (
            fromFog ||
            !existingAtTarget ||
            hasLegacyDrawingKey ||
            !stableEquals(existingAtTarget, wireDrawing)
          ) {
            multiUpdates[`drawings/${sceneId}/${drawingId}`] = wireDrawing;
            if (fromFog) {
              summary.drawingsMigratedFromFog += 1;
            } else {
              summary.drawingsNormalized += 1;
            }
          }
        }

        // 3. Tokens -> tokens/{sceneId}, hiddenTokens/{sceneId}, tokenSecrets/{sceneId}
        const existingPublic = isPlainRecord(rawTokensByScene[sceneId])
          ? rawTokensByScene[sceneId]
          : {};
        const existingHidden = isPlainRecord(rawHiddenByScene[sceneId])
          ? rawHiddenByScene[sceneId]
          : {};
        const existingSecrets = isPlainRecord(rawSecretsByScene[sceneId])
          ? rawSecretsByScene[sceneId]
          : {};

        const combinedTokenIds = Array.from(
          new Set([...Object.keys(existingPublic), ...Object.keys(existingHidden)])
        ).sort();

        const migratedEntries = [];
        for (const tokenId of combinedTokenIds) {
          // Se o mesmo token existir nos dois baldes, prioriza hiddenTokens
          const rawTok = existingHidden[tokenId] ?? existingPublic[tokenId];
          if (!isPlainRecord(rawTok)) {
            if (Object.hasOwn(existingPublic, tokenId)) {
              multiUpdates[`tokens/${sceneId}/${tokenId}`] = null;
            }
            if (Object.hasOwn(existingHidden, tokenId)) {
              multiUpdates[`hiddenTokens/${sceneId}/${tokenId}`] = null;
            }
            continue;
          }
          const migrated = migrateTokenRecord({
            tokenId,
            rawToken: rawTok,
            existingSecret: existingSecrets[tokenId] ?? null,
            charactersById,
            gmUid
          });
          migratedEntries.push(migrated);
        }

        const cellSizePx = scenesCellSizeById.get(sceneId) || DEFAULT_CELL_SIZE_PX;
        const partition = partitionTokensByFog({
          tokens: migratedEntries.map((e) => e.publicDoc),
          fogState: targetFogObj,
          cellSizePx,
          gmId: gmUid
        });
        const desiredPublicIds = new Set(partition.publicTokens.map((t) => t.id));
        const desiredHiddenIds = new Set(partition.hiddenTokens.map((t) => t.id));
        const desiredSecretIds = new Set();

        for (const { publicDoc, secretDoc } of migratedEntries) {
          const tokenId = publicDoc.id;
          const wireTok = normalizeWireToken(publicDoc);
          const goesHidden = desiredHiddenIds.has(tokenId);

          if (goesHidden) {
            const curHidden = existingHidden[tokenId];
            const hasLegacy =
              isPlainRecord(curHidden) &&
              LEGACY_TOKEN_KEYS.some((k) => Object.hasOwn(curHidden, k));
            if (!curHidden || hasLegacy || !stableEquals(curHidden, wireTok)) {
              multiUpdates[`hiddenTokens/${sceneId}/${tokenId}`] = wireTok;
              summary.tokensMigrated += 1;
            }
            if (Object.hasOwn(existingPublic, tokenId)) {
              multiUpdates[`tokens/${sceneId}/${tokenId}`] = null;
              summary.tokensMovedToHidden += 1;
            }
          } else if (desiredPublicIds.has(tokenId)) {
            const curPublic = existingPublic[tokenId];
            const hasLegacy =
              isPlainRecord(curPublic) &&
              LEGACY_TOKEN_KEYS.some((k) => Object.hasOwn(curPublic, k));
            if (!curPublic || hasLegacy || !stableEquals(curPublic, wireTok)) {
              multiUpdates[`tokens/${sceneId}/${tokenId}`] = wireTok;
              summary.tokensMigrated += 1;
            }
            if (Object.hasOwn(existingHidden, tokenId)) {
              multiUpdates[`hiddenTokens/${sceneId}/${tokenId}`] = null;
            }
          }

          if (secretDoc) {
            desiredSecretIds.add(tokenId);
            const wireSecret = normalizeWireSecret(secretDoc);
            const curSecret = existingSecrets[tokenId];
            if (!curSecret || !stableEquals(curSecret, wireSecret)) {
              multiUpdates[`tokenSecrets/${sceneId}/${tokenId}`] = wireSecret;
              summary.tokenSecretsWritten += 1;
            }
          }
        }

        // Remove segredos órfãos ou de PC
        for (const secTokenId of Object.keys(existingSecrets)) {
          if (!desiredSecretIds.has(secTokenId)) {
            multiUpdates[`tokenSecrets/${sceneId}/${secTokenId}`] = null;
            summary.tokenSecretsRemoved += 1;
          }
        }

        // 4. Pings: remove legados e expirados
        const existingScenePings = isPlainRecord(rawPingsByScene[sceneId])
          ? rawPingsByScene[sceneId]
          : {};
        for (const [pingId, rawPing] of Object.entries(existingScenePings)) {
          if (!isValidActiveV2Ping(rawPing, pingId, nowMs)) {
            multiUpdates[`pings/${sceneId}/${pingId}`] = null;
            summary.pingsRemoved += 1;
          }
        }
      }

      // 5. Presence: remove entradas legadas planas ou com campaignId/sceneId
      if (isPlainRecord(campRtdb.presence)) {
        for (const [uid, rawUserPresence] of Object.entries(campRtdb.presence)) {
          if (!isValidV2PresenceUser(rawUserPresence)) {
            multiUpdates[`presence/${uid}`] = null;
            summary.presenceNodesCleaned += 1;
          }
        }
      }

      if (Object.keys(multiUpdates).length > 0) {
        operations.push({
          kind: "rtdb.update",
          path: `vtt_realtime/${campaignId}`,
          data: multiUpdates
        });
      }
    }

    return { operations, summary };
  }
};
