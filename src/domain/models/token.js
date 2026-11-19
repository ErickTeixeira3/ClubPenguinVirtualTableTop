import { LAYER_NAMES, RECENT_OPS_LIMIT, TOKEN_KINDS } from "../constants.js";
import {
  DEFAULT_COLORS,
  DEFAULT_FREE_TOKEN_DEFENSE,
  DEFAULT_NAMES
} from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import { toControlledByMap } from "../permissions.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const VALID_TOKEN_KINDS = new Set(Object.values(TOKEN_KINDS));
const VALID_LAYERS = new Set(Object.values(LAYER_NAMES));

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

export const LEGACY_TOKEN_KEYS = Object.freeze([
  "campaignId",
  "sceneId",
  "visibleToPlayers",
  "isGmToken",
  "characterType",
  "name",
  "mediaId",
  "externalUrl",
  "defense",
  "hpCurrent",
  "hpMax",
  "mpCurrent",
  "mpMax",
  "showBarsToPlayers"
]);

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveNumber(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : Number.NaN;
  }
  return Number.NaN;
}

function normalizeResourcePool(rawPool) {
  if (!isPlainRecord(rawPool)) {
    return null;
  }
  return {
    current: resolveNumber(rawPool.current, 0),
    max: resolveNumber(rawPool.max, 0)
  };
}

function normalizeRecentOps(rawRecentOps) {
  if (!isPlainRecord(rawRecentOps)) {
    return {};
  }
  const map = {};
  for (const [opId, ts] of Object.entries(rawRecentOps)) {
    if (UNSAFE_KEYS.has(opId)) {
      continue;
    }
    const cleanId = opId.trim();
    if (!cleanId || UNSAFE_KEYS.has(cleanId)) {
      continue;
    }
    map[cleanId] = typeof ts === "number" ? ts : Number(ts);
  }
  return map;
}

function normalizeBars(rawBars) {
  if (!isPlainRecord(rawBars)) {
    return null;
  }
  return {
    hpCurrent:
      rawBars.hpCurrent === undefined || rawBars.hpCurrent === null
        ? null
        : resolveNumber(rawBars.hpCurrent, Number.NaN),
    hpMax:
      rawBars.hpMax === undefined || rawBars.hpMax === null
        ? null
        : resolveNumber(rawBars.hpMax, Number.NaN),
    mpCurrent:
      rawBars.mpCurrent === undefined || rawBars.mpCurrent === null
        ? null
        : resolveNumber(rawBars.mpCurrent, Number.NaN),
    mpMax:
      rawBars.mpMax === undefined || rawBars.mpMax === null
        ? null
        : resolveNumber(rawBars.mpMax, Number.NaN)
  };
}

export function normalizeTokenSecret(raw = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  return {
    defense: resolveNumber(src.defense, DEFAULT_FREE_TOKEN_DEFENSE),
    hp: normalizeResourcePool(src.hp),
    mp: normalizeResourcePool(src.mp),
    showBarsToPlayers: src.showBarsToPlayers !== false,
    recentOps: normalizeRecentOps(src.recentOps)
  };
}

export function projectPublicBars(secret) {
  if (!isPlainRecord(secret) || secret.showBarsToPlayers === false) {
    return null;
  }
  const hp = normalizeResourcePool(secret.hp);
  const mp = normalizeResourcePool(secret.mp);
  if (!hp && !mp) {
    return null;
  }
  return {
    hpCurrent: hp ? hp.current : null,
    hpMax: hp ? hp.max : null,
    mpCurrent: mp ? mp.current : null,
    mpMax: mp ? mp.max : null
  };
}

export function normalizeToken(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const kind =
    src.kind === undefined || src.kind === null
      ? TOKEN_KINDS.FREE
      : trimOrEmpty(src.kind);

  let characterId = null;
  if (src.characterId !== undefined && src.characterId !== null) {
    characterId =
      typeof src.characterId === "string"
        ? trimOrNull(src.characterId)
        : src.characterId;
  }

  const ownerId = trimOrNull(src.ownerId ?? ctx.ownerId);
  const controlledBy = toControlledByMap(src.controlledBy);

  const layer =
    src.layer === undefined || src.layer === null
      ? LAYER_NAMES.TOKENS
      : trimOrEmpty(src.layer);

  let label;
  if (src.label === undefined) {
    label = DEFAULT_NAMES.token;
  } else if (src.label === null) {
    label = null;
  } else if (typeof src.label === "string") {
    label = trimOrNull(src.label) ?? DEFAULT_NAMES.token;
  } else {
    label = src.label;
  }

  const ringColor =
    src.ringColor === undefined || src.ringColor === null
      ? DEFAULT_COLORS.tokenRing
      : typeof src.ringColor === "string"
        ? src.ringColor.trim()
        : "";

  let bars = null;
  if (src.bars !== undefined) {
    bars = normalizeBars(src.bars);
  } else if (isPlainRecord(src.secrets)) {
    bars = projectPublicBars(src.secrets);
  }

  const updatedAt =
    src.updatedAt === undefined || src.updatedAt === null
      ? null
      : typeof src.updatedAt === "number"
        ? src.updatedAt
        : Number(src.updatedAt);

  const updatedBy =
    src.updatedBy !== undefined && src.updatedBy !== null
      ? typeof src.updatedBy === "string"
        ? trimOrNull(src.updatedBy)
        : src.updatedBy
      : null;

  return {
    id,
    kind,
    characterId,
    ownerId,
    controlledBy,
    layer,
    hidden: Boolean(src.hidden),
    label,
    image: normalizeImageRef(src.image),
    x: resolveNumber(src.x, 0),
    y: resolveNumber(src.y, 0),
    sizeInCells: resolveNumber(src.sizeInCells, 1),
    rotation: resolveNumber(src.rotation, 0),
    ringColor,
    showName: src.showName !== false,
    bars,
    rev: resolveNumber(src.rev, 0),
    updatedAt,
    updatedBy
  };
}

export function validateToken(token) {
  const errors = [];

  if (!isPlainRecord(token)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token must be a non-null plain object.",
        { field: "token" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(token.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Token id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!VALID_TOKEN_KINDS.has(token.kind)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Token kind "${String(token.kind)}" is invalid.`,
        { field: "kind", value: token.kind }
      )
    );
  } else if (token.kind === TOKEN_KINDS.PC) {
    if (!isTrimmedNonEmpty(token.characterId)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "PC token requires a trimmed non-empty characterId.",
          { field: "characterId" }
        )
      );
    }
  } else if (token.kind === TOKEN_KINDS.FREE) {
    if (token.characterId !== null) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "Free token must have characterId === null.",
          { field: "characterId", value: token.characterId }
        )
      );
    }
  } else if (
    token.characterId !== null &&
    !isTrimmedNonEmpty(token.characterId)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "NPC token characterId must be null or a trimmed non-empty string.",
        { field: "characterId" }
      )
    );
  }

  if (!isTrimmedNonEmpty(token.ownerId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Token ownerId must be a trimmed non-empty string.",
        { field: "ownerId" }
      )
    );
  }

  if (!isPlainRecord(token.controlledBy)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token controlledBy must be a plain object map.",
        { field: "controlledBy" }
      )
    );
  } else {
    for (const [key, val] of Object.entries(token.controlledBy)) {
      if (UNSAFE_KEYS.has(key) || !isTrimmedNonEmpty(key) || val !== true) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Token controlledBy["${key}"] must be true with a safe non-empty UID key.`,
            { field: "controlledBy", key }
          )
        );
      }
    }
  }

  if (!VALID_LAYERS.has(token.layer)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Token layer "${String(token.layer)}" is invalid.`,
        { field: "layer", value: token.layer }
      )
    );
  }

  if (typeof token.hidden !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token hidden must be a boolean.",
        { field: "hidden" }
      )
    );
  }

  if (token.label !== null && !isTrimmedNonEmpty(token.label)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token label must be null or a trimmed non-empty string.",
        { field: "label" }
      )
    );
  }

  const imgRes = validateImageRef(token.image, { fieldName: "image" });
  if (!imgRes.ok) {
    errors.push(...imgRes.errors);
  }

  for (const coord of ["x", "y", "rotation"]) {
    if (typeof token[coord] !== "number" || !Number.isFinite(token[coord])) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `Token ${coord} must be a finite number.`,
          { field: coord, value: token[coord] }
        )
      );
    }
  }

  if (
    typeof token.sizeInCells !== "number" ||
    !Number.isFinite(token.sizeInCells) ||
    token.sizeInCells < 1 ||
    token.sizeInCells > 8
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Token sizeInCells must be between 1 and 8.",
        { field: "sizeInCells", value: token.sizeInCells }
      )
    );
  }

  if (!isTrimmedNonEmpty(token.ringColor)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Token ringColor must be a trimmed non-empty string.",
        { field: "ringColor" }
      )
    );
  }

  if (typeof token.showName !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token showName must be a boolean.",
        { field: "showName" }
      )
    );
  }

  if (token.bars !== null) {
    if (!isPlainRecord(token.bars)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Token bars must be null or a plain object.",
          { field: "bars" }
        )
      );
    } else {
      for (const barField of ["hpCurrent", "hpMax", "mpCurrent", "mpMax"]) {
        const val = token.bars[barField];
        if (
          val !== null &&
          (typeof val !== "number" || !Number.isFinite(val) || val < 0)
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.OUT_OF_RANGE,
              `Token bars.${barField} must be null or a finite number >= 0.`,
              { field: `bars.${barField}`, value: val }
            )
          );
        }
      }
    }
  }

  if (
    typeof token.rev !== "number" ||
    !Number.isInteger(token.rev) ||
    token.rev < 0
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Token rev must be a non-negative integer.",
        { field: "rev", value: token.rev }
      )
    );
  }

  if (
    token.updatedAt !== null &&
    (typeof token.updatedAt !== "number" ||
      !Number.isFinite(token.updatedAt) ||
      token.updatedAt < 0)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Token updatedAt must be null or a non-negative finite number.",
        { field: "updatedAt", value: token.updatedAt }
      )
    );
  }

  if (token.updatedBy !== null && !isTrimmedNonEmpty(token.updatedBy)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Token updatedBy must be null or a trimmed non-empty string.",
        { field: "updatedBy" }
      )
    );
  }

  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    if (Object.hasOwn(token, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy token field "${legacyKey}" is not allowed in v2 public token.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function validateTokenSecret(secret) {
  const errors = [];

  if (!isPlainRecord(secret)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "TokenSecret must be a non-null plain object.",
        { field: "tokenSecret" }
      )
    ]);
  }

  if (
    typeof secret.defense !== "number" ||
    !Number.isFinite(secret.defense) ||
    secret.defense < 0
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "TokenSecret defense must be a finite number >= 0.",
        { field: "defense", value: secret.defense }
      )
    );
  }

  for (const poolKey of ["hp", "mp"]) {
    const pool = secret[poolKey];
    if (pool !== null) {
      if (!isPlainRecord(pool)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `TokenSecret ${poolKey} must be null or a plain object.`,
            { field: poolKey }
          )
        );
      } else {
        for (const sub of ["current", "max"]) {
          if (
            typeof pool[sub] !== "number" ||
            !Number.isFinite(pool[sub]) ||
            pool[sub] < 0
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.OUT_OF_RANGE,
                `TokenSecret ${poolKey}.${sub} must be a finite number >= 0.`,
                { field: `${poolKey}.${sub}`, value: pool[sub] }
              )
            );
          }
        }
      }
    }
  }

  if (typeof secret.showBarsToPlayers !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "TokenSecret showBarsToPlayers must be a boolean.",
        { field: "showBarsToPlayers" }
      )
    );
  }

  if (!isPlainRecord(secret.recentOps)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "TokenSecret recentOps must be a plain object.",
        { field: "recentOps" }
      )
    );
  } else {
    const keys = Object.keys(secret.recentOps);
    if (keys.length > RECENT_OPS_LIMIT) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `TokenSecret recentOps exceeds limit of ${RECENT_OPS_LIMIT}.`,
          { field: "recentOps", count: keys.length }
        )
      );
    }
    for (const opKey of keys) {
      if (UNSAFE_KEYS.has(opKey) || !isTrimmedNonEmpty(opKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "TokenSecret recentOps contains an invalid key.",
            { field: "recentOps", key: opKey }
          )
        );
        continue;
      }
      const ts = secret.recentOps[opKey];
      if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 0) {
        errors.push(
          new AppError(
            ERROR_CODES.OUT_OF_RANGE,
            `TokenSecret recentOps["${opKey}"] must be >= 0.`,
            { field: `recentOps.${opKey}`, value: ts }
          )
        );
      }
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromSecretDoc(docData) {
  const raw = isPlainRecord(docData) ? docData : {};
  const src = isPlainRecord(raw.secrets) ? raw.secrets : raw;

  let hp = src.hp;
  if (
    hp === undefined &&
    (src.hpCurrent !== undefined || src.hpMax !== undefined)
  ) {
    if (src.hpCurrent != null || src.hpMax != null) {
      hp = {
        current: src.hpCurrent ?? src.hpMax ?? 0,
        max: src.hpMax ?? src.hpCurrent ?? 0
      };
    } else {
      hp = null;
    }
  }

  let mp = src.mp;
  if (
    mp === undefined &&
    (src.mpCurrent !== undefined || src.mpMax !== undefined)
  ) {
    if (src.mpCurrent != null || src.mpMax != null) {
      mp = {
        current: src.mpCurrent ?? src.mpMax ?? 0,
        max: src.mpMax ?? src.mpCurrent ?? 0
      };
    } else {
      mp = null;
    }
  }

  return normalizeTokenSecret({
    defense: src.defense,
    hp: hp ?? null,
    mp: mp ?? null,
    showBarsToPlayers: src.showBarsToPlayers,
    recentOps: src.recentOps
  });
}

export function toSecretDoc(tokenOrSecret) {
  const raw = isPlainRecord(tokenOrSecret) ? tokenOrSecret : {};
  const source = isPlainRecord(raw.secrets) ? raw.secrets : raw;
  const normalized = normalizeTokenSecret(source);
  return {
    defense: normalized.defense,
    hp: normalized.hp,
    mp: normalized.mp,
    showBarsToPlayers: normalized.showBarsToPlayers,
    recentOps: normalized.recentOps
  };
}

export function fromDoc(docData, id = undefined) {
  const src = isPlainRecord(docData) ? docData : {};
  const resolvedId = id ?? src.id ?? null;

  const characterId = trimOrNull(src.characterId);
  let kind = src.kind;
  if (kind === undefined || kind === null) {
    if (!characterId) {
      kind = TOKEN_KINDS.FREE;
    } else if (src.characterType === "npc" || src.isGmToken === true) {
      kind = TOKEN_KINDS.NPC;
    } else {
      kind = TOKEN_KINDS.PC;
    }
  }

  const isV2Doc =
    Object.hasOwn(src, "kind") ||
    Object.hasOwn(src, "rev") ||
    Object.hasOwn(src, "bars");

  let label;
  if (src.label !== undefined) {
    label = src.label;
  } else if (typeof src.name === "string") {
    label = src.name.trim() || null;
  } else if (isV2Doc) {
    label = null;
  } else {
    label = DEFAULT_NAMES.token;
  }

  const image =
    src.image !== undefined
      ? fromImageRefDoc(src.image)
      : fromImageRefDoc({
          mediaId: src.mediaId,
          externalUrl: src.externalUrl
        });

  const hidden =
    typeof src.hidden === "boolean"
      ? src.hidden
      : typeof src.visibleToPlayers === "boolean"
        ? !src.visibleToPlayers
        : false;

  let bars = src.bars;
  if (bars === undefined) {
    if (
      src.hpCurrent !== undefined ||
      src.hpMax !== undefined ||
      src.mpCurrent !== undefined ||
      src.mpMax !== undefined
    ) {
      bars = projectPublicBars(fromSecretDoc(src));
    } else {
      bars = null;
    }
  }

  return normalizeToken(
    {
      ...src,
      kind,
      characterId,
      label,
      image,
      hidden,
      controlledBy: toControlledByMap(src.controlledBy),
      bars
    },
    { id: resolvedId }
  );
}

export function toDoc(token) {
  const normalized = normalizeToken(token);
  return {
    id: normalized.id,
    kind: normalized.kind,
    characterId: normalized.characterId,
    ownerId: normalized.ownerId,
    controlledBy: normalized.controlledBy,
    layer: normalized.layer,
    hidden: normalized.hidden,
    label: normalized.label,
    image: toImageRefDoc(normalized.image),
    x: normalized.x,
    y: normalized.y,
    sizeInCells: normalized.sizeInCells,
    rotation: normalized.rotation,
    ringColor: normalized.ringColor,
    showName: normalized.showName,
    bars: normalized.bars,
    rev: normalized.rev,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy
  };
}

export function splitTokenDoc(raw, id = undefined) {
  const publicToken = fromDoc(raw, id);
  const secretToken = fromSecretDoc(raw);
  if (publicToken.bars === null) {
    publicToken.bars = projectPublicBars(secretToken);
  }
  return {
    publicDoc: toDoc(publicToken),
    secretDoc: toSecretDoc(secretToken)
  };
}

export function combineToken(publicToken, secret = null) {
  return {
    ...normalizeToken(publicToken),
    secrets: secret == null ? null : normalizeTokenSecret(secret)
  };
}

export function resolveCharacterTokenImage(character) {
  if (!isPlainRecord(character)) {
    return normalizeImageRef(null);
  }
  const nestedTokenImg = normalizeImageRef(character.token?.image);
  if (nestedTokenImg.mediaId || nestedTokenImg.url) {
    return nestedTokenImg;
  }
  const tokenImg = normalizeImageRef(character.tokenImage);
  if (tokenImg.mediaId || tokenImg.url) {
    return tokenImg;
  }
  return normalizeImageRef(character.avatar);
}

export function buildPcProjectionFromCharacter(character) {
  if (!isPlainRecord(character)) {
    return null;
  }
  const hpPool = normalizeResourcePool(character.resources?.hp);
  const mpPool = normalizeResourcePool(character.resources?.mp);
  const bars =
    hpPool || mpPool
      ? {
          hpCurrent: hpPool ? hpPool.current : null,
          hpMax: hpPool ? hpPool.max : null,
          mpCurrent: mpPool ? mpPool.current : null,
          mpMax: mpPool ? mpPool.max : null
        }
      : null;

  const rev =
    typeof character.rev === "number" && Number.isInteger(character.rev) && character.rev >= 0
      ? character.rev
      : 0;

  const rawSize = resolveNumber(character.token?.sizeInCells, 1);
  const sizeInCells = Number.isFinite(rawSize)
    ? Math.max(1, Math.min(8, rawSize))
    : 1;

  return {
    label: trimOrNull(character.name) ?? DEFAULT_NAMES.token,
    image: toImageRefDoc(resolveCharacterTokenImage(character)),
    bars,
    ringColor: trimOrNull(character.cardColor) ?? DEFAULT_COLORS.tokenRing,
    showName: character.token?.showName !== false,
    sizeInCells,
    rev
  };
}

export {
  toDoc as toTokenDoc,
  fromDoc as fromTokenDoc,
  toSecretDoc as toTokenSecretDoc,
  fromSecretDoc as fromTokenSecretDoc
};
