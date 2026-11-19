import {
  get as rtdbGet,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import {
  CHARACTER_TYPES,
  DEFAULT_CELL_SIZE_PX,
  DEFAULT_MAP_DIMENSIONS,
  ID_PREFIXES,
  LAYER_NAMES,
  RESOURCE_KEYS,
  TOKEN_KINDS,
  TOKEN_MOVE_THROTTLE_MS
} from "../domain/constants.js";
import {
  DEFAULT_CHARACTER_HP,
  DEFAULT_CHARACTER_MP,
  DEFAULT_COLORS,
  DEFAULT_FREE_TOKEN_DEFENSE,
  DEFAULT_NAMES
} from "../domain/defaults.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  buildPcProjectionFromCharacter,
  normalizeImageRef,
  normalizeToken,
  normalizeTokenSecret,
  projectPublicBars,
  resolveCharacterTokenImage,
  toTokenDoc,
  toTokenSecretDoc,
  validateToken,
  validateTokenSecret
} from "../domain/models/index.js";
import {
  canUserWriteTokenProjection,
  toControlledByMap
} from "../domain/permissions.js";
import { partitionTokensByFog } from "../engines/fog/index.js";
import { tokenMapper, tokenSecretMapper } from "../infra/converters/rtdbMappers.js";
import { db, rtdb } from "../infra/firebase.js";
import { createId } from "../infra/ids.js";
import {
  compressImageToWebP,
  formatBytes
} from "../infra/imageCompression.js";
import {
  campaignRtdbRootPath,
  hiddenTokenPath,
  sceneHiddenTokensPath,
  sceneTokenSecretsPath,
  sceneTokensPath,
  tokenPath,
  tokenSecretPath
} from "../infra/rtdbPaths.js";
import { applyRtdbResourceDelta } from "../infra/transactions.js";
import { grantMediaAudience, uploadCompressedMedia } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

function isServerTimestampSentinel(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value[".sv"] === "timestamp"
  );
}

/**
 * Remove nulls/undefined e objetos vazios (ex.: controlledBy: {}, image vazio, recentOps: {})
 * para refletir exatamente o wire format aceito pelas regras v2 do RTDB.
 */
export function cleanRtdbValue(value) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (isServerTimestampSentinel(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => cleanRtdbValue(item)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const cleaned = {};
    for (const [key, val] of Object.entries(value)) {
      const next = cleanRtdbValue(val);
      if (next !== undefined) {
        cleaned[key] = next;
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return value;
}

function cleanImageRefForUpdate(imageRef) {
  const normalized = normalizeImageRef(imageRef);
  if (normalized.mediaId) {
    return { mediaId: normalized.mediaId };
  }
  if (normalized.url) {
    return { url: normalized.url };
  }
  return null;
}

function cleanBarsForUpdate(bars) {
  if (!bars || typeof bars !== "object") {
    return null;
  }
  const cleaned = {};
  for (const field of ["hpCurrent", "hpMax", "mpCurrent", "mpMax"]) {
    const val = bars[field];
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      cleaned[field] = val;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function toWireToken(token, { useServerTimestamp = true } = {}) {
  const doc = toTokenDoc(token);
  const wire = cleanRtdbValue(doc) || {};
  if (useServerTimestamp) {
    wire.updatedAt = rtdbServerTimestamp();
  }
  return wire;
}

function toWireSecret(secret) {
  const doc = toTokenSecretDoc(secret);
  const wire = cleanRtdbValue(doc) || {};
  wire.defense = doc.defense;
  wire.showBarsToPlayers = doc.showBarsToPlayers;
  return wire;
}

function relativeToCampaign(campaignId, fullPath) {
  const prefix = `${campaignRtdbRootPath(campaignId)}/`;
  if (fullPath.startsWith(prefix)) {
    return fullPath.slice(prefix.length);
  }
  return fullPath;
}

function isPermissionDeniedError(err) {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();
  return code.includes("permission_denied") || message.includes("permission_denied");
}

function shouldTokenGoToHiddenBucket(token, { fog = null, cellSizePx = DEFAULT_CELL_SIZE_PX, gmId = null } = {}) {
  if (token.hidden === true) {
    return true;
  }
  if (!fog || !fog.enabled) {
    return false;
  }
  const { hiddenTokens } = partitionTokensByFog({
    tokens: [token],
    fogState: fog,
    cellSizePx,
    gmId
  });
  return hiddenTokens.length > 0;
}

export function subscribeSceneTokens({
  campaignId,
  sceneId,
  isRealGM = false,
  realtimeDb = rtdb,
  onData,
  onError
}) {
  if (!campaignId || !sceneId) {
    onData?.({ publicTokens: [], hiddenTokens: [], tokens: [], hiddenTokenIds: new Set() });
    return () => {};
  }

  let publicMap = {};
  let hiddenMap = {};

  const emit = () => {
    const publicTokens = Object.entries(publicMap)
      .filter(([, raw]) => raw && typeof raw === "object")
      .map(([id, raw]) => tokenMapper.fromRtdb(raw, { id }))
      .filter(Boolean);

    const hiddenTokens = isRealGM
      ? Object.entries(hiddenMap)
          .filter(([, raw]) => raw && typeof raw === "object")
          .map(([id, raw]) => tokenMapper.fromRtdb(raw, { id }))
          .filter(Boolean)
      : [];

    const hiddenTokenIds = new Set(hiddenTokens.map((t) => t.id));
    const mergedById = new Map();
    for (const tok of publicTokens) {
      mergedById.set(tok.id, tok);
    }
    for (const tok of hiddenTokens) {
      mergedById.set(tok.id, tok);
    }

    onData?.({
      publicTokens,
      hiddenTokens,
      tokens: Array.from(mergedById.values()),
      hiddenTokenIds
    });
  };

  const unsubPublic = onValue(
    ref(realtimeDb, sceneTokensPath(campaignId, sceneId)),
    (snap) => {
      publicMap = snap.exists() ? snap.val() || {} : {};
      emit();
    },
    (err) => {
      onError?.(err);
    }
  );

  let unsubHidden = () => {};
  if (isRealGM) {
    unsubHidden = onValue(
      ref(realtimeDb, sceneHiddenTokensPath(campaignId, sceneId)),
      (snap) => {
        hiddenMap = snap.exists() ? snap.val() || {} : {};
        emit();
      },
      (err) => {
        onError?.(err);
      }
    );
  }

  return () => {
    unsubPublic();
    unsubHidden();
  };
}

export function subscribeSceneTokenSecrets({
  campaignId,
  sceneId,
  isRealGM = false,
  controllableTokenIds = [],
  realtimeDb = rtdb,
  onData,
  onError
}) {
  if (!campaignId || !sceneId) {
    onData?.({});
    return () => {};
  }

  if (isRealGM) {
    return onValue(
      ref(realtimeDb, sceneTokenSecretsPath(campaignId, sceneId)),
      (snap) => {
        const rawMap = snap.exists() ? snap.val() || {} : {};
        const parsed = {};
        for (const [tokenId, rawSecret] of Object.entries(rawMap)) {
          if (rawSecret && typeof rawSecret === "object") {
            parsed[tokenId] = tokenSecretMapper.fromRtdb(rawSecret);
          }
        }
        onData?.(parsed);
      },
      (err) => {
        onError?.(err);
      }
    );
  }

  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(controllableTokenIds) ? controllableTokenIds : []).filter(
        (id) => typeof id === "string" && id.trim().length > 0
      )
    )
  ).sort();

  if (uniqueIds.length === 0) {
    onData?.({});
    return () => {};
  }

  const state = {};
  const emit = () => {
    onData?.({ ...state });
  };

  const unsubs = uniqueIds.map((tokenId) =>
    onValue(
      ref(realtimeDb, tokenSecretPath(campaignId, sceneId, tokenId)),
      (snap) => {
        if (snap.exists()) {
          state[tokenId] = tokenSecretMapper.fromRtdb(snap.val());
        } else {
          delete state[tokenId];
        }
        emit();
      },
      (err) => {
        if (!isPermissionDeniedError(err)) {
          onError?.(err);
        }
      }
    )
  );

  return () => {
    for (const unsub of unsubs) {
      unsub();
    }
  };
}

export async function spawnCharacterToken({
  campaignId,
  campaign,
  scene,
  char,
  user,
  isGM = false,
  canEditCharacter,
  spawnOptions = {},
  fog = null,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  assertClientUpToDate();
  const targetSceneId = scene?.id || campaign?.activeSceneId;
  if (!char || !targetSceneId || !user?.uid || !campaignId) {
    return null;
  }
  if (!isGM && !canEditCharacter?.(char)) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Você não tem permissão para instanciar o token desta ficha."
    );
  }

  const kind =
    char.type === CHARACTER_TYPES.PC ? TOKEN_KINDS.PC : TOKEN_KINDS.NPC;
  const tokenId = createId(ID_PREFIXES.TOKEN);

  const cellSizePx = Number(scene?.grid?.cellSizePx) || DEFAULT_CELL_SIZE_PX;
  const widthPx = Number(scene?.mapImage?.widthPx) || DEFAULT_MAP_DIMENSIONS.widthPx;
  const heightPx = Number(scene?.mapImage?.heightPx) || DEFAULT_MAP_DIMENSIONS.heightPx;
  const startX = Math.round(widthPx / 2 / cellSizePx) * cellSizePx;
  const startY = Math.round(heightPx / 2 / cellSizePx) * cellSizePx;

  const showName =
    spawnOptions?.showName !== undefined
      ? Boolean(spawnOptions.showName)
      : (char.token?.showName ?? char.defaultToken?.showName) !== false;

  const requestedHidden =
    spawnOptions?.hidden !== undefined ? Boolean(spawnOptions.hidden) : false;
  const hidden = isGM ? requestedHidden : false;

  const ownerId = isGM ? char.ownerId || user.uid : user.uid;
  const controlledBy = toControlledByMap([
    campaign?.gmId,
    char.ownerId,
    isGM ? null : user.uid
  ]);

  const charImage = resolveCharacterTokenImage({
    tokenImage: char.token?.image || {
      mediaId: char.defaultToken?.mediaId ?? null,
      url: char.defaultToken?.externalUrl ?? null
    },
    avatar: char.avatar || {
      mediaId: char.avatarMediaId ?? null,
      url: char.avatarExternalUrl ?? null
    }
  });

  const hpMax = Number(char.resources?.hp?.max ?? DEFAULT_CHARACTER_HP.max);
  const hpCurrent = Number(char.resources?.hp?.current ?? hpMax);
  const mpMax = Number(char.resources?.mp?.max ?? DEFAULT_CHARACTER_MP.max);
  const mpCurrent = Number(char.resources?.mp?.current ?? mpMax);

  let secret = null;
  let bars = null;
  if (kind === TOKEN_KINDS.PC) {
    bars = { hpCurrent, hpMax, mpCurrent, mpMax };
  } else {
    secret = normalizeTokenSecret({
      defense: Number(char.defense ?? DEFAULT_FREE_TOKEN_DEFENSE),
      hp: { current: hpCurrent, max: hpMax },
      mp: { current: mpCurrent, max: mpMax },
      showBarsToPlayers: spawnOptions?.showBarsToPlayers !== false,
      recentOps: {}
    });
    const secretCheck = validateTokenSecret(secret);
    if (!secretCheck.ok) {
      throw secretCheck.errors[0];
    }
    bars = projectPublicBars(secret);
  }

  const rev =
    kind === TOKEN_KINDS.PC && Number.isInteger(char.rev) && char.rev >= 0
      ? char.rev
      : 0;

  const normalizedToken = normalizeToken(
    {
      id: tokenId,
      kind,
      characterId: char.id,
      ownerId,
      controlledBy,
      layer: LAYER_NAMES.TOKENS,
      hidden,
      label: char.name || DEFAULT_NAMES.token,
      image: charImage,
      x: startX,
      y: startY,
      sizeInCells:
        Number(char.token?.sizeInCells ?? char.defaultToken?.sizeInCells) || 1,
      rotation: 0,
      ringColor: char.cardColor || DEFAULT_COLORS.tokenRing,
      showName,
      bars,
      rev,
      updatedAt: null,
      updatedBy: user.uid
    },
    { id: tokenId }
  );

  const tokenCheck = validateToken(normalizedToken);
  if (!tokenCheck.ok) {
    throw tokenCheck.errors[0];
  }

  const goHidden =
    isGM &&
    shouldTokenGoToHiddenBucket(normalizedToken, {
      fog,
      cellSizePx,
      gmId: campaign?.gmId || null
    });

  if (normalizedToken.image.mediaId && !goHidden) {
    await grantMediaAudience({
      campaignId,
      mediaId: normalizedToken.image.mediaId,
      visibleTo: ["ALL"],
      ...(firestoreDb !== db ? { firestoreDb } : {})
    });
  }

  const targetPath = goHidden
    ? hiddenTokenPath(campaignId, targetSceneId, tokenId)
    : tokenPath(campaignId, targetSceneId, tokenId);

  const wireToken = toWireToken(normalizedToken);

  if (secret) {
    const wireSecret = toWireSecret(secret);
    const updates = {
      [relativeToCampaign(campaignId, targetPath)]: wireToken,
      [relativeToCampaign(
        campaignId,
        tokenSecretPath(campaignId, targetSceneId, tokenId)
      )]: wireSecret
    };
    await rtdbUpdate(ref(realtimeDb, campaignRtdbRootPath(campaignId)), updates);
  } else {
    await rtdbSet(ref(realtimeDb, targetPath), wireToken);
  }

  return {
    ...normalizedToken,
    secrets: secret,
    sceneId: targetSceneId
  };
}

export async function createFreeToken({
  campaignId,
  sceneId,
  user,
  isGM = false,
  gmId = null,
  data = {},
  fog = null,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId, sceneId e usuário são obrigatórios para criar um token."
    );
  }

  const tokenId = createId(ID_PREFIXES.TOKEN);
  const layer = isGM && data.layer ? data.layer : LAYER_NAMES.TOKENS;
  const hidden = isGM ? Boolean(data.hidden) : false;
  const controlledBy = isGM
    ? toControlledByMap(data.controlledBy)
    : toControlledByMap([user.uid]);

  const image = normalizeImageRef(data.image);
  const secret = normalizeTokenSecret({
    defense: data.defense ?? DEFAULT_FREE_TOKEN_DEFENSE,
    hp:
      data.hp !== undefined
        ? data.hp
        : data.hpCurrent != null || data.hpMax != null
          ? {
              current: Number(data.hpCurrent ?? data.hpMax ?? 0),
              max: Number(data.hpMax ?? data.hpCurrent ?? 0)
            }
          : null,
    mp:
      data.mp !== undefined
        ? data.mp
        : data.mpCurrent != null || data.mpMax != null
          ? {
              current: Number(data.mpCurrent ?? data.mpMax ?? 0),
              max: Number(data.mpMax ?? data.mpCurrent ?? 0)
            }
          : null,
    showBarsToPlayers: data.showBarsToPlayers !== false,
    recentOps: {}
  });
  const secretCheck = validateTokenSecret(secret);
  if (!secretCheck.ok) {
    throw secretCheck.errors[0];
  }

  const normalizedToken = normalizeToken(
    {
      id: tokenId,
      kind: TOKEN_KINDS.FREE,
      characterId: null,
      ownerId: user.uid,
      controlledBy,
      layer,
      hidden,
      label: data.label ?? data.name ?? DEFAULT_NAMES.token,
      image,
      x: data.x ?? 0,
      y: data.y ?? 0,
      sizeInCells: data.sizeInCells ?? 1,
      rotation: data.rotation ?? 0,
      ringColor: data.ringColor || DEFAULT_COLORS.tokenRing,
      showName: data.showName !== false,
      bars: projectPublicBars(secret),
      rev: 0,
      updatedAt: null,
      updatedBy: user.uid
    },
    { id: tokenId }
  );

  const tokenCheck = validateToken(normalizedToken);
  if (!tokenCheck.ok) {
    throw tokenCheck.errors[0];
  }

  const goHidden =
    isGM &&
    shouldTokenGoToHiddenBucket(normalizedToken, {
      fog,
      cellSizePx,
      gmId
    });

  if (normalizedToken.image.mediaId && !goHidden) {
    await grantMediaAudience({
      campaignId,
      mediaId: normalizedToken.image.mediaId,
      visibleTo: ["ALL"],
      ...(firestoreDb !== db ? { firestoreDb } : {})
    });
  }

  const targetPath = goHidden
    ? hiddenTokenPath(campaignId, sceneId, tokenId)
    : tokenPath(campaignId, sceneId, tokenId);

  const updates = {
    [relativeToCampaign(campaignId, targetPath)]: toWireToken(normalizedToken),
    [relativeToCampaign(campaignId, tokenSecretPath(campaignId, sceneId, tokenId))]:
      toWireSecret(secret)
  };
  await rtdbUpdate(ref(realtimeDb, campaignRtdbRootPath(campaignId)), updates);

  return {
    token: normalizedToken,
    secret,
    inHiddenBucket: goHidden
  };
}

const lastMoveSentAtByToken = new Map();

export function resetMoveTokenThrottle() {
  lastMoveSentAtByToken.clear();
}

export async function moveToken({
  campaignId,
  sceneId,
  tokenId,
  x,
  y,
  rotation = undefined,
  inHiddenBucket = false,
  forceImmediate = true,
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !tokenId || !user?.uid) {
    return false;
  }
  const throttleKey = `${campaignId}:${sceneId}:${tokenId}`;
  if (!forceImmediate) {
    const lastSentAt = lastMoveSentAtByToken.get(throttleKey) ?? 0;
    if (Date.now() - lastSentAt < TOKEN_MOVE_THROTTLE_MS) {
      return false;
    }
  }
  lastMoveSentAtByToken.set(throttleKey, Date.now());

  const patch = {
    updatedAt: rtdbServerTimestamp(),
    updatedBy: user.uid
  };
  if (typeof x === "number" && Number.isFinite(x)) {
    patch.x = Math.round(x);
  }
  if (typeof y === "number" && Number.isFinite(y)) {
    patch.y = Math.round(y);
  }
  if (typeof rotation === "number" && Number.isFinite(rotation)) {
    patch.rotation = rotation;
  }
  const targetPath = inHiddenBucket
    ? hiddenTokenPath(campaignId, sceneId, tokenId)
    : tokenPath(campaignId, sceneId, tokenId);
  await rtdbUpdate(ref(realtimeDb, targetPath), patch);
  return true;
}

export async function updateTokenEditable({
  campaignId,
  sceneId,
  token,
  inHiddenBucket = false,
  patch = {},
  user,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !token?.id || !user?.uid) {
    return null;
  }

  const updates = {};
  if ("label" in patch) {
    const clean = typeof patch.label === "string" ? patch.label.trim() : "";
    updates.label = clean || null;
  }
  if ("image" in patch) {
    const cleanImg = cleanImageRefForUpdate(patch.image);
    if (cleanImg?.mediaId && !inHiddenBucket && !token.hidden) {
      await grantMediaAudience({
        campaignId,
        mediaId: cleanImg.mediaId,
        visibleTo: ["ALL"],
        ...(firestoreDb !== db ? { firestoreDb } : {})
      });
    }
    updates.image = cleanImg;
  }
  if ("ringColor" in patch && typeof patch.ringColor === "string" && patch.ringColor.trim()) {
    updates.ringColor = patch.ringColor.trim();
  }
  if ("showName" in patch) {
    updates.showName = Boolean(patch.showName);
  }
  if ("sizeInCells" in patch) {
    const size = Math.max(1, Math.min(8, Number(patch.sizeInCells) || 1));
    updates.sizeInCells = size;
  }
  if ("bars" in patch) {
    updates.bars = cleanBarsForUpdate(patch.bars);
  }
  if (Object.keys(updates).length === 0) {
    return null;
  }

  const currentRev =
    typeof token.rev === "number" && Number.isInteger(token.rev) && token.rev >= 0
      ? token.rev
      : 0;
  updates.rev = currentRev + 1;
  updates.updatedAt = rtdbServerTimestamp();
  updates.updatedBy = user.uid;

  const targetPath = inHiddenBucket
    ? hiddenTokenPath(campaignId, sceneId, token.id)
    : tokenPath(campaignId, sceneId, token.id);
  await rtdbUpdate(ref(realtimeDb, targetPath), updates);
  return updates;
}

export async function updateTokenAdmin({
  campaignId,
  sceneId,
  token,
  currentSecret = null,
  inHiddenBucket = false,
  patch = {},
  secretPatch = null,
  fog = null,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  gmId = null,
  user,
  isGM = false,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  assertClientUpToDate();
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode alterar campos administrativos do token."
    );
  }
  if (!campaignId || !sceneId || !token?.id || !user?.uid) {
    return null;
  }

  let nextSecret = currentSecret ? normalizeTokenSecret(currentSecret) : null;
  let nextBars = token.bars;

  if (token.kind !== TOKEN_KINDS.PC && secretPatch) {
    nextSecret = normalizeTokenSecret({
      ...(nextSecret || {}),
      ...secretPatch,
      recentOps: nextSecret?.recentOps || {}
    });
    const secretCheck = validateTokenSecret(nextSecret);
    if (!secretCheck.ok) {
      throw secretCheck.errors[0];
    }
    nextBars = projectPublicBars(nextSecret);
  } else if ("bars" in patch) {
    nextBars = patch.bars;
  }

  const nextToken = normalizeToken(
    {
      ...token,
      ...patch,
      controlledBy:
        "controlledBy" in patch
          ? toControlledByMap(patch.controlledBy)
          : token.controlledBy,
      image: "image" in patch ? normalizeImageRef(patch.image) : token.image,
      bars: nextBars,
      rev:
        typeof patch.rev === "number"
          ? Math.max(Number(token.rev) || 0, patch.rev)
          : token.kind === TOKEN_KINDS.PC
            ? Number(token.rev) || 0
            : (Number(token.rev) || 0) + 1,
      updatedBy: user.uid
    },
    { id: token.id }
  );

  const tokenCheck = validateToken(nextToken);
  if (!tokenCheck.ok) {
    throw tokenCheck.errors[0];
  }

  const nextInHidden = shouldTokenGoToHiddenBucket(nextToken, {
    fog,
    cellSizePx,
    gmId
  });

  if (nextToken.image.mediaId && !nextInHidden) {
    await grantMediaAudience({
      campaignId,
      mediaId: nextToken.image.mediaId,
      visibleTo: ["ALL"],
      ...(firestoreDb !== db ? { firestoreDb } : {})
    });
  }

  const oldPath = inHiddenBucket
    ? hiddenTokenPath(campaignId, sceneId, token.id)
    : tokenPath(campaignId, sceneId, token.id);
  const newPath = nextInHidden
    ? hiddenTokenPath(campaignId, sceneId, token.id)
    : tokenPath(campaignId, sceneId, token.id);

  const multiUpdates = {
    [relativeToCampaign(campaignId, newPath)]: toWireToken(nextToken)
  };
  if (oldPath !== newPath) {
    multiUpdates[relativeToCampaign(campaignId, oldPath)] = null;
  }
  if (token.kind !== TOKEN_KINDS.PC && secretPatch && nextSecret) {
    multiUpdates[
      relativeToCampaign(campaignId, tokenSecretPath(campaignId, sceneId, token.id))
    ] = toWireSecret(nextSecret);
  }

  await rtdbUpdate(ref(realtimeDb, campaignRtdbRootPath(campaignId)), multiUpdates);

  return {
    token: nextToken,
    secret: nextSecret,
    inHiddenBucket: nextInHidden
  };
}

export async function adjustTokenResource({
  campaignId,
  sceneId,
  token,
  inHiddenBucket = false,
  resourceKey,
  delta,
  opId = null,
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !token?.id || !user?.uid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Dados obrigatórios ausentes para ajustar recurso do token."
    );
  }
  if (token.kind === TOKEN_KINDS.PC) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Recursos de PC devem ser alterados exclusivamente na ficha (Firestore)."
    );
  }
  if (resourceKey !== RESOURCE_KEYS.HP && resourceKey !== RESOURCE_KEYS.MP) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Recurso inválido: "${String(resourceKey)}".`
    );
  }

  const secretRef = ref(realtimeDb, tokenSecretPath(campaignId, sceneId, token.id));
  const resolvedOpId = opId || createId(ID_PREFIXES.OPERATION);
  const txResult = await applyRtdbResourceDelta(secretRef, {
    resourceKey,
    delta,
    opId: resolvedOpId
  });

  const latestSecret = txResult.data ? normalizeTokenSecret(txResult.data) : null;
  const nextBars = latestSecret ? projectPublicBars(latestSecret) : null;

  const targetPath = inHiddenBucket
    ? hiddenTokenPath(campaignId, sceneId, token.id)
    : tokenPath(campaignId, sceneId, token.id);
  const currentRev =
    typeof token.rev === "number" && Number.isInteger(token.rev) && token.rev >= 0
      ? token.rev
      : 0;

  const MAX_PROJECTION_ATTEMPTS = 3;
  let projectedBars = nextBars;
  let projectedRev = currentRev + 1;
  let projectionDeferred = false;

  for (let attempt = 0; attempt < MAX_PROJECTION_ATTEMPTS; attempt += 1) {
    try {
      await rtdbUpdate(ref(realtimeDb, targetPath), {
        bars: cleanBarsForUpdate(projectedBars),
        rev: projectedRev,
        updatedAt: rtdbServerTimestamp(),
        updatedBy: user.uid
      });
      projectionDeferred = false;
      break;
    } catch (err) {
      if (!isPermissionDeniedError(err)) {
        throw err;
      }
      if (attempt === MAX_PROJECTION_ATTEMPTS - 1) {
        projectionDeferred = true;
        break;
      }
      // Se outro cliente avançou `rev` concorrentemente, relê estado fresco e tenta projetar novamente.
      const [freshTokenSnap, freshSecretSnap] = await Promise.all([
        rtdbGet(ref(realtimeDb, targetPath)),
        rtdbGet(secretRef)
      ]);
      if (!freshTokenSnap.exists() || !freshSecretSnap.exists()) {
        projectionDeferred = true;
        break;
      }
      const freshToken = freshTokenSnap.val();
      projectedBars = projectPublicBars(normalizeTokenSecret(freshSecretSnap.val()));
      const freshRev =
        typeof freshToken?.rev === "number" && Number.isInteger(freshToken.rev)
          ? freshToken.rev
          : currentRev;
      projectedRev = freshRev + 1;
    }
  }

  return {
    ...txResult,
    bars: projectedBars,
    ...(projectionDeferred ? { projectionDeferred: true } : {})
  };
}

export async function setTokenVisibility({
  campaignId,
  sceneId,
  token,
  inHiddenBucket = false,
  hidden,
  fog = null,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  gmId = null,
  user,
  isGM = false,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  return updateTokenAdmin({
    campaignId,
    sceneId,
    token,
    inHiddenBucket,
    patch: { hidden: Boolean(hidden) },
    fog,
    cellSizePx,
    gmId,
    user,
    isGM,
    realtimeDb,
    firestoreDb
  });
}

export async function removeToken({
  campaignId,
  sceneId,
  token,
  inHiddenBucket = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !token?.id) {
    return;
  }
  const targetPath = inHiddenBucket
    ? hiddenTokenPath(campaignId, sceneId, token.id)
    : tokenPath(campaignId, sceneId, token.id);

  const updates = {
    [relativeToCampaign(campaignId, targetPath)]: null
  };
  if (token.kind !== TOKEN_KINDS.PC) {
    updates[
      relativeToCampaign(campaignId, tokenSecretPath(campaignId, sceneId, token.id))
    ] = null;
  }

  await rtdbUpdate(ref(realtimeDb, campaignRtdbRootPath(campaignId)), updates);
}

export async function projectCharacterToSceneTokens({
  campaignId,
  sceneId,
  character,
  publicTokens = null,
  hiddenTokens = null,
  user,
  isGM = false,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  if (!campaignId || !sceneId || !character?.id || !user?.uid) {
    return { updatedCount: 0 };
  }
  if (character.type !== CHARACTER_TYPES.PC) {
    return { updatedCount: 0 };
  }

  const projection = buildPcProjectionFromCharacter(character);
  if (!projection) {
    return { updatedCount: 0 };
  }

  const candidates = [];
  if (Array.isArray(publicTokens) || Array.isArray(hiddenTokens)) {
    for (const tok of publicTokens || []) {
      if (tok && tok.kind === TOKEN_KINDS.PC && tok.characterId === character.id) {
        candidates.push({ token: tok, inHiddenBucket: false });
      }
    }
    if (isGM) {
      for (const tok of hiddenTokens || []) {
        if (tok && tok.kind === TOKEN_KINDS.PC && tok.characterId === character.id) {
          candidates.push({ token: tok, inHiddenBucket: true });
        }
      }
    }
  } else {
    const pubSnap = await rtdbGet(ref(realtimeDb, sceneTokensPath(campaignId, sceneId)));
    if (pubSnap.exists()) {
      for (const [id, raw] of Object.entries(pubSnap.val() || {})) {
        const parsed = tokenMapper.fromRtdb(raw, { id });
        if (parsed && parsed.kind === TOKEN_KINDS.PC && parsed.characterId === character.id) {
          candidates.push({ token: parsed, inHiddenBucket: false });
        }
      }
    }
    if (isGM) {
      const hidSnap = await rtdbGet(
        ref(realtimeDb, sceneHiddenTokensPath(campaignId, sceneId))
      );
      if (hidSnap.exists()) {
        for (const [id, raw] of Object.entries(hidSnap.val() || {})) {
          const parsed = tokenMapper.fromRtdb(raw, { id });
          if (parsed && parsed.kind === TOKEN_KINDS.PC && parsed.characterId === character.id) {
            candidates.push({ token: parsed, inHiddenBucket: true });
          }
        }
      }
    }
  }

  const eligible = candidates.filter(({ token, inHiddenBucket }) => {
    const currentRev = typeof token.rev === "number" ? token.rev : 0;
    if (projection.rev <= currentRev) {
      return false;
    }
    return canUserWriteTokenProjection(token, {
      uid: user.uid,
      isGM,
      inHiddenBucket
    });
  });

  if (eligible.length === 0) {
    return { updatedCount: 0 };
  }

  if (projection.image?.mediaId && eligible.some((item) => !item.inHiddenBucket)) {
    await grantMediaAudience({
      campaignId,
      mediaId: projection.image.mediaId,
      visibleTo: ["ALL"],
      ...(firestoreDb !== db ? { firestoreDb } : {})
    });
  }

  const basePatch = {
    label: projection.label,
    image: cleanImageRefForUpdate(projection.image),
    bars: cleanBarsForUpdate(projection.bars),
    ringColor: projection.ringColor,
    showName: projection.showName,
    sizeInCells: projection.sizeInCells,
    rev: projection.rev,
    updatedAt: rtdbServerTimestamp(),
    updatedBy: user.uid
  };

  let updatedCount = 0;
  for (const { token, inHiddenBucket } of eligible) {
    const targetPath = inHiddenBucket
      ? hiddenTokenPath(campaignId, sceneId, token.id)
      : tokenPath(campaignId, sceneId, token.id);
    try {
      await rtdbUpdate(ref(realtimeDb, targetPath), basePatch);
      updatedCount += 1;
    } catch (err) {
      if (!isPermissionDeniedError(err)) {
        throw err;
      }
    }
  }

  return { updatedCount };
}

export async function reconcileScenePcProjections({
  campaignId,
  sceneId,
  characters = [],
  publicTokens = [],
  hiddenTokens = [],
  user,
  isGM = false,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  if (!campaignId || !sceneId || !user?.uid) {
    return { updatedCount: 0 };
  }
  const pcById = new Map();
  for (const ch of characters || []) {
    if (ch?.id && ch.type === CHARACTER_TYPES.PC) {
      pcById.set(ch.id, ch);
    }
  }
  if (pcById.size === 0) {
    return { updatedCount: 0 };
  }

  const staleCharIds = new Set();
  const allEntries = [
    ...(publicTokens || []).map((token) => ({ token, inHiddenBucket: false })),
    ...(isGM ? (hiddenTokens || []).map((token) => ({ token, inHiddenBucket: true })) : [])
  ];
  for (const { token, inHiddenBucket } of allEntries) {
    if (!token || token.kind !== TOKEN_KINDS.PC || !token.characterId) continue;
    const ch = pcById.get(token.characterId);
    if (!ch) continue;
    const charRev = Number.isInteger(ch.rev) ? ch.rev : 0;
    const tokRev = Number.isInteger(token.rev) ? token.rev : 0;
    if (
      charRev > tokRev &&
      canUserWriteTokenProjection(token, { uid: user.uid, isGM, inHiddenBucket })
    ) {
      staleCharIds.add(ch.id);
    }
  }

  let updatedCount = 0;
  for (const charId of staleCharIds) {
    const res = await projectCharacterToSceneTokens({
      campaignId,
      sceneId,
      character: pcById.get(charId),
      publicTokens,
      hiddenTokens,
      user,
      isGM,
      realtimeDb,
      firestoreDb
    });
    updatedCount += res.updatedCount;
  }

  return { updatedCount };
}

export async function reconcileSceneFogPartition({
  campaignId,
  sceneId,
  publicTokens = [],
  hiddenTokens = [],
  fog = null,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  gmId = null,
  user,
  isGM = false,
  realtimeDb = rtdb,
  firestoreDb = db
}) {
  if (!isGM || !campaignId || !sceneId || !user?.uid) {
    return { movedCount: 0 };
  }

  const currentPublicIds = new Set((publicTokens || []).map((t) => t.id));
  const currentHiddenIds = new Set((hiddenTokens || []).map((t) => t.id));

  const allById = new Map();
  for (const tok of publicTokens || []) {
    allById.set(tok.id, tok);
  }
  for (const tok of hiddenTokens || []) {
    allById.set(tok.id, tok);
  }

  const desired = partitionTokensByFog({
    tokens: Array.from(allById.values()),
    fogState: fog,
    cellSizePx,
    gmId
  });

  const multiUpdates = {};
  const mediaIdsToReveal = new Set();
  let movedCount = 0;

  for (const tok of desired.hiddenTokens) {
    if (!currentHiddenIds.has(tok.id) || currentPublicIds.has(tok.id)) {
      multiUpdates[
        relativeToCampaign(campaignId, hiddenTokenPath(campaignId, sceneId, tok.id))
      ] = toWireToken({ ...tok, updatedBy: user.uid });
      multiUpdates[
        relativeToCampaign(campaignId, tokenPath(campaignId, sceneId, tok.id))
      ] = null;
      movedCount += 1;
    }
  }

  for (const tok of desired.publicTokens) {
    if (!currentPublicIds.has(tok.id) || currentHiddenIds.has(tok.id)) {
      if (tok.hidden === true) continue;
      if (tok.image?.mediaId) {
        mediaIdsToReveal.add(tok.image.mediaId);
      }
      multiUpdates[
        relativeToCampaign(campaignId, tokenPath(campaignId, sceneId, tok.id))
      ] = toWireToken({ ...tok, hidden: false, updatedBy: user.uid });
      multiUpdates[
        relativeToCampaign(campaignId, hiddenTokenPath(campaignId, sceneId, tok.id))
      ] = null;
      movedCount += 1;
    }
  }

  if (movedCount === 0) {
    return { movedCount: 0 };
  }

  if (mediaIdsToReveal.size > 0) {
    await Promise.all(
      Array.from(mediaIdsToReveal).map((mediaId) =>
        grantMediaAudience({
          campaignId,
          mediaId,
          visibleTo: ["ALL"],
          ...(firestoreDb !== db ? { firestoreDb } : {})
        })
      )
    );
  }

  await rtdbUpdate(ref(realtimeDb, campaignRtdbRootPath(campaignId)), multiUpdates);
  return { movedCount };
}

export async function compressTokenImageFile(file) {
  const compressed = await compressImageToWebP(file, "token");
  return {
    ...compressed,
    formattedSize: formatBytes(compressed.sizeBytes)
  };
}

export async function uploadTokenMedia({
  campaignId,
  compressed,
  user,
  visibleTo = ["ALL"],
  firestoreDb = db
}) {
  return uploadCompressedMedia({
    campaignId,
    compressed,
    category: "token",
    uploadedBy: user?.uid,
    visibleTo,
    ...(firestoreDb !== db ? { firestoreDb } : {})
  });
}
