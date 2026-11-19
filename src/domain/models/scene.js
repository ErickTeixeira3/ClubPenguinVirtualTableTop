import { assertAudience } from "../audience.js";
import {
  DEFAULT_MAP_DIMENSIONS,
  MIN_GRID_CELL_SIZE_PX
} from "../constants.js";
import {
  DEFAULT_FOG_DEFAULTS,
  DEFAULT_GRID_CONFIG,
  DEFAULT_NAMES
} from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const LEGACY_SCENE_KEYS = ["visibleToPlayers", "fogOfWar"];

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) {
        seen.add(clean);
      }
    }
  }
  return Array.from(seen);
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

function normalizeAmbientAudio(rawAudio) {
  if (!isPlainRecord(rawAudio)) {
    return null;
  }
  const result = {};
  if (rawAudio.url !== undefined) {
    result.url = rawAudio.url === null ? null : trimOrNull(rawAudio.url);
  }
  if (rawAudio.mediaId !== undefined) {
    result.mediaId =
      rawAudio.mediaId === null ? null : trimOrNull(rawAudio.mediaId);
  }
  if (rawAudio.volume !== undefined) {
    result.volume = resolveNumber(rawAudio.volume, 1);
  }
  if (rawAudio.loop !== undefined) {
    result.loop = rawAudio.loop;
  }
  if (rawAudio.playing !== undefined) {
    result.playing = Boolean(rawAudio.playing);
  }
  return result;
}

export function normalizeScene(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const campaignId = trimOrNull(src.campaignId ?? ctx.campaignId);

  const name =
    src.name === undefined || src.name === null
      ? DEFAULT_NAMES.scene
      : typeof src.name === "string"
        ? src.name.trim()
        : "";

  const rawMapImage = isPlainRecord(src.mapImage) ? src.mapImage : {};
  const image = normalizeImageRef(rawMapImage.image);
  const mimeType =
    rawMapImage.mimeType === undefined || rawMapImage.mimeType === null
      ? null
      : typeof rawMapImage.mimeType === "string"
        ? trimOrNull(rawMapImage.mimeType)
        : rawMapImage.mimeType;

  const rawGrid = isPlainRecord(src.grid) ? src.grid : {};
  const grid = {
    enabled:
      rawGrid.enabled !== undefined
        ? rawGrid.enabled
        : DEFAULT_GRID_CONFIG.enabled,
    snapToGrid:
      rawGrid.snapToGrid !== undefined
        ? rawGrid.snapToGrid
        : DEFAULT_GRID_CONFIG.snapToGrid,
    cellSizePx: resolveNumber(rawGrid.cellSizePx, DEFAULT_GRID_CONFIG.cellSizePx),
    offsetX: resolveNumber(rawGrid.offsetX, DEFAULT_GRID_CONFIG.offsetX),
    offsetY: resolveNumber(rawGrid.offsetY, DEFAULT_GRID_CONFIG.offsetY),
    color:
      rawGrid.color === undefined || rawGrid.color === null
        ? DEFAULT_GRID_CONFIG.color
        : typeof rawGrid.color === "string"
          ? rawGrid.color.trim()
          : "",
    opacity: resolveNumber(rawGrid.opacity, DEFAULT_GRID_CONFIG.opacity)
  };

  const rawFog = isPlainRecord(src.fogDefaults) ? src.fogDefaults : {};
  const fogDefaults = {
    enabled:
      rawFog.enabled !== undefined
        ? rawFog.enabled
        : DEFAULT_FOG_DEFAULTS.enabled,
    defaultOpaque:
      rawFog.defaultOpaque !== undefined
        ? rawFog.defaultOpaque
        : DEFAULT_FOG_DEFAULTS.defaultOpaque
  };

  const deletedBy =
    src.deletedBy !== undefined && src.deletedBy !== null
      ? typeof src.deletedBy === "string"
        ? trimOrNull(src.deletedBy)
        : src.deletedBy
      : null;

  return {
    id,
    campaignId,
    name,
    visibleTo: cleanStringList(src.visibleTo),
    mapImage: {
      image,
      mimeType,
      widthPx: resolveNumber(rawMapImage.widthPx, DEFAULT_MAP_DIMENSIONS.widthPx),
      heightPx: resolveNumber(
        rawMapImage.heightPx,
        DEFAULT_MAP_DIMENSIONS.heightPx
      )
    },
    grid,
    fogDefaults,
    ambientAudio: normalizeAmbientAudio(src.ambientAudio),
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateScene(scene) {
  const errors = [];

  if (!isPlainRecord(scene)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Scene must be a non-null plain object.",
        { field: "scene" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(scene.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Scene campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!isTrimmedNonEmpty(scene.name)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Scene name must be a trimmed non-empty string.",
        { field: "name" }
      )
    );
  }

  const audienceRes = assertAudience(scene, { entityType: "scene" });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  if (!isPlainRecord(scene.mapImage)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Scene mapImage must be a plain object.",
        { field: "mapImage" }
      )
    );
  } else {
    const imgRes = validateImageRef(scene.mapImage.image, {
      fieldName: "mapImage.image"
    });
    if (!imgRes.ok) {
      errors.push(...imgRes.errors);
    }

    if (
      typeof scene.mapImage.widthPx !== "number" ||
      !Number.isFinite(scene.mapImage.widthPx) ||
      scene.mapImage.widthPx <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Scene mapImage.widthPx must be a finite number > 0.",
          { field: "mapImage.widthPx", value: scene.mapImage.widthPx }
        )
      );
    }

    if (
      typeof scene.mapImage.heightPx !== "number" ||
      !Number.isFinite(scene.mapImage.heightPx) ||
      scene.mapImage.heightPx <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Scene mapImage.heightPx must be a finite number > 0.",
          { field: "mapImage.heightPx", value: scene.mapImage.heightPx }
        )
      );
    }

    if (
      scene.mapImage.mimeType !== null &&
      !isTrimmedNonEmpty(scene.mapImage.mimeType)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene mapImage.mimeType must be null or a trimmed non-empty string.",
          { field: "mapImage.mimeType" }
        )
      );
    }

    if (
      scene.mapImage.image?.url !== null &&
      scene.mapImage.image?.url !== undefined &&
      scene.mapImage.mimeType !== null
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "Scene mapImage.mimeType must be null when using an external URL.",
          { field: "mapImage.mimeType" }
        )
      );
    }

    for (const legacyMapKey of ["sizeBytes", "mediaId", "externalUrl"]) {
      if (Object.hasOwn(scene.mapImage, legacyMapKey)) {
        errors.push(
          new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            `Legacy mapImage field "${legacyMapKey}" is not allowed in v2.`,
            { field: `mapImage.${legacyMapKey}` }
          )
        );
      }
    }
  }

  if (!isPlainRecord(scene.grid)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Scene grid must be a plain object.",
        { field: "grid" }
      )
    );
  } else {
    if (typeof scene.grid.enabled !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene grid.enabled must be a boolean.",
          { field: "grid.enabled" }
        )
      );
    }
    if (typeof scene.grid.snapToGrid !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene grid.snapToGrid must be a boolean.",
          { field: "grid.snapToGrid" }
        )
      );
    }
    if (
      typeof scene.grid.cellSizePx !== "number" ||
      !Number.isFinite(scene.grid.cellSizePx)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene grid.cellSizePx must be a finite number.",
          { field: "grid.cellSizePx" }
        )
      );
    } else if (scene.grid.cellSizePx < MIN_GRID_CELL_SIZE_PX) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `Scene grid.cellSizePx must be >= ${MIN_GRID_CELL_SIZE_PX}.`,
          { field: "grid.cellSizePx", value: scene.grid.cellSizePx }
        )
      );
    }
    if (
      typeof scene.grid.offsetX !== "number" ||
      !Number.isFinite(scene.grid.offsetX)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene grid.offsetX must be a finite number.",
          { field: "grid.offsetX" }
        )
      );
    }
    if (
      typeof scene.grid.offsetY !== "number" ||
      !Number.isFinite(scene.grid.offsetY)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene grid.offsetY must be a finite number.",
          { field: "grid.offsetY" }
        )
      );
    }
    if (!isTrimmedNonEmpty(scene.grid.color)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Scene grid.color must be a trimmed non-empty string.",
          { field: "grid.color" }
        )
      );
    }
    if (
      typeof scene.grid.opacity !== "number" ||
      !Number.isFinite(scene.grid.opacity) ||
      scene.grid.opacity < 0 ||
      scene.grid.opacity > 1
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Scene grid.opacity must be a finite number between 0 and 1.",
          { field: "grid.opacity", value: scene.grid.opacity }
        )
      );
    }
  }

  if (!isPlainRecord(scene.fogDefaults)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Scene fogDefaults must be a plain object.",
        { field: "fogDefaults" }
      )
    );
  } else {
    if (typeof scene.fogDefaults.enabled !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene fogDefaults.enabled must be a boolean.",
          { field: "fogDefaults.enabled" }
        )
      );
    }
    if (typeof scene.fogDefaults.defaultOpaque !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene fogDefaults.defaultOpaque must be a boolean.",
          { field: "fogDefaults.defaultOpaque" }
        )
      );
    }
  }

  if (scene.ambientAudio !== null && scene.ambientAudio !== undefined) {
    if (!isPlainRecord(scene.ambientAudio)) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Scene ambientAudio must be null or a plain object.",
          { field: "ambientAudio" }
        )
      );
    } else {
      if (scene.ambientAudio.volume !== undefined) {
        if (
          typeof scene.ambientAudio.volume !== "number" ||
          !Number.isFinite(scene.ambientAudio.volume) ||
          scene.ambientAudio.volume < 0 ||
          scene.ambientAudio.volume > 1
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.OUT_OF_RANGE,
              "Scene ambientAudio.volume must be between 0 and 1.",
              { field: "ambientAudio.volume", value: scene.ambientAudio.volume }
            )
          );
        }
      }
      if (
        scene.ambientAudio.loop !== undefined &&
        typeof scene.ambientAudio.loop !== "boolean"
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "Scene ambientAudio.loop must be a boolean.",
            { field: "ambientAudio.loop" }
          )
        );
      }
    }
  }

  if (typeof scene.isDeleted !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Scene isDeleted must be a boolean.",
        { field: "isDeleted" }
      )
    );
  }

  for (const legacyKey of LEGACY_SCENE_KEYS) {
    if (Object.hasOwn(scene, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy scene field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};

  let visibleTo = cleanStringList(src.visibleTo);
  if (typeof src.visibleToPlayers === "boolean") {
    if (src.visibleToPlayers) {
      visibleTo = ["ALL"];
    } else {
      visibleTo = visibleTo.filter((entry) => entry !== "ALL");
      if (visibleTo.length === 0 && isTrimmedNonEmpty(ctx.gmId)) {
        visibleTo = [trimOrEmpty(ctx.gmId)];
      }
    }
  }

  const rawMapImage = isPlainRecord(src.mapImage) ? src.mapImage : {};
  const image = isPlainRecord(rawMapImage.image)
    ? fromImageRefDoc(rawMapImage.image)
    : fromImageRefDoc({
        mediaId: rawMapImage.mediaId,
        externalUrl: rawMapImage.externalUrl
      });

  const mimeType =
    image.url !== null || (image.mediaId === null && image.url === null)
      ? null
      : trimOrNull(rawMapImage.mimeType);

  return normalizeScene(
    {
      ...src,
      visibleTo,
      mapImage: {
        image,
        mimeType,
        widthPx: rawMapImage.widthPx,
        heightPx: rawMapImage.heightPx
      },
      fogDefaults: src.fogDefaults ?? src.fogOfWar
    },
    { ...ctx, id: id ?? ctx.id ?? src.id ?? null }
  );
}

export function toDoc(scene) {
  const normalized = normalizeScene(scene);
  const imageDoc = toImageRefDoc(normalized.mapImage.image);
  const mimeType =
    imageDoc.url !== null || (imageDoc.mediaId === null && imageDoc.url === null)
      ? null
      : typeof normalized.mapImage.mimeType === "string"
        ? normalized.mapImage.mimeType
        : null;

  const payload = {
    campaignId: normalized.campaignId,
    name: normalized.name,
    visibleTo: normalized.visibleTo,
    mapImage: {
      image: imageDoc,
      mimeType,
      widthPx: normalized.mapImage.widthPx,
      heightPx: normalized.mapImage.heightPx
    },
    grid: normalized.grid,
    fogDefaults: normalized.fogDefaults,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };

  if (normalized.ambientAudio !== null) {
    payload.ambientAudio = normalized.ambientAudio;
  }

  return payload;
}

export { toDoc as toSceneDoc, fromDoc as fromSceneDoc };
