import { DRAWING_TYPES, LAYER_NAMES } from "../constants.js";
import { DEFAULT_COLORS } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const VALID_DRAWING_TYPES = new Set(Object.values(DRAWING_TYPES));
const VALID_LAYERS = new Set(Object.values(LAYER_NAMES));

export const LEGACY_DRAWING_KEYS = Object.freeze([
  "campaignId",
  "sceneId",
  "shapeType",
  "createdBy",
  "timestamp"
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

function resolveNullableTimestamp(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}

export function normalizeDrawing(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const type =
    src.type === undefined || src.type === null
      ? DRAWING_TYPES.STROKE
      : trimOrEmpty(src.type);

  const layer =
    src.layer === undefined || src.layer === null
      ? LAYER_NAMES.TOKENS
      : trimOrEmpty(src.layer);

  const base = {
    id,
    type,
    layer,
    authorId: trimOrNull(src.authorId ?? ctx.authorId),
    authorName:
      src.authorName === undefined || src.authorName === null
        ? null
        : typeof src.authorName === "string"
          ? src.authorName.trim()
          : src.authorName,
    createdAt: resolveNullableTimestamp(src.createdAt),
    updatedAt: resolveNullableTimestamp(src.updatedAt),
    updatedBy:
      src.updatedBy !== undefined && src.updatedBy !== null
        ? typeof src.updatedBy === "string"
          ? trimOrNull(src.updatedBy)
          : src.updatedBy
        : null
  };

  if (type === DRAWING_TYPES.STROKE) {
    const rawPoints = Array.isArray(src.points) ? src.points : [];
    const points = rawPoints.map((pt) =>
      isPlainRecord(pt)
        ? {
            x: resolveNumber(pt.x, Number.NaN),
            y: resolveNumber(pt.y, Number.NaN)
          }
        : pt
    );
    return {
      ...base,
      color:
        src.color === undefined || src.color === null
          ? DEFAULT_COLORS.drawingStroke
          : typeof src.color === "string"
            ? src.color.trim()
            : "",
      width: resolveNumber(src.width, 4),
      points
    };
  }

  if (type === DRAWING_TYPES.RECT || type === DRAWING_TYPES.CIRCLE) {
    const hasFill = Boolean(src.hasFill);
    return {
      ...base,
      strokeColor:
        src.strokeColor === undefined || src.strokeColor === null
          ? DEFAULT_COLORS.drawingStroke
          : typeof src.strokeColor === "string"
            ? src.strokeColor.trim()
            : "",
      strokeWidth: resolveNumber(src.strokeWidth, 4),
      hasFill,
      fillColor:
        src.fillColor === undefined
          ? DEFAULT_COLORS.drawingFill
          : src.fillColor === null
            ? null
            : typeof src.fillColor === "string"
              ? src.fillColor.trim()
              : "",
      x: resolveNumber(src.x, 0),
      y: resolveNumber(src.y, 0),
      w: resolveNumber(src.w, 0),
      h: resolveNumber(src.h, 0),
      rotation: resolveNumber(src.rotation, 0)
    };
  }

  if (type === DRAWING_TYPES.TEXT) {
    return {
      ...base,
      text: typeof src.text === "string" ? src.text : "",
      fontSize: resolveNumber(src.fontSize, 24),
      fontFamily:
        src.fontFamily === undefined || src.fontFamily === null
          ? "Comic Sans MS, Comic Sans, cursive, sans-serif"
          : typeof src.fontFamily === "string"
            ? src.fontFamily.trim()
            : "",
      color:
        src.color === undefined || src.color === null
          ? DEFAULT_COLORS.drawingStroke
          : typeof src.color === "string"
            ? src.color.trim()
            : "",
      x: resolveNumber(src.x, 0),
      y: resolveNumber(src.y, 0),
      rotation: resolveNumber(src.rotation, 0)
    };
  }

  return base;
}

export function validateDrawing(drawing) {
  const errors = [];

  if (!isPlainRecord(drawing)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Drawing must be a non-null plain object.",
        { field: "drawing" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(drawing.id)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Drawing id must be a trimmed non-empty string.",
        { field: "id" }
      )
    );
  }

  if (!VALID_DRAWING_TYPES.has(drawing.type)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Drawing type "${String(drawing.type)}" is invalid.`,
        { field: "type", value: drawing.type }
      )
    );
  }

  if (!VALID_LAYERS.has(drawing.layer)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Drawing layer "${String(drawing.layer)}" is invalid.`,
        { field: "layer", value: drawing.layer }
      )
    );
  }

  if (!isTrimmedNonEmpty(drawing.authorId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Drawing authorId must be a trimmed non-empty string.",
        { field: "authorId" }
      )
    );
  }

  if (drawing.authorName !== null && typeof drawing.authorName !== "string") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Drawing authorName must be null or a string.",
        { field: "authorName" }
      )
    );
  }

  for (const tsField of ["createdAt", "updatedAt"]) {
    if (
      drawing[tsField] !== null &&
      (typeof drawing[tsField] !== "number" ||
        !Number.isFinite(drawing[tsField]) ||
        drawing[tsField] < 0)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          `Drawing ${tsField} must be null or a finite number >= 0.`,
          { field: tsField, value: drawing[tsField] }
        )
      );
    }
  }

  if (drawing.updatedBy !== null && !isTrimmedNonEmpty(drawing.updatedBy)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Drawing updatedBy must be null or a trimmed non-empty string.",
        { field: "updatedBy" }
      )
    );
  }

  if (drawing.type === DRAWING_TYPES.STROKE) {
    if (!isTrimmedNonEmpty(drawing.color)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Stroke drawing color is required.",
          { field: "color" }
        )
      );
    }
    if (
      typeof drawing.width !== "number" ||
      !Number.isFinite(drawing.width) ||
      drawing.width <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Stroke drawing width must be > 0.",
          { field: "width", value: drawing.width }
        )
      );
    }
    if (!Array.isArray(drawing.points) || drawing.points.length === 0) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Stroke drawing points must be a non-empty array.",
          { field: "points" }
        )
      );
    } else {
      drawing.points.forEach((pt, idx) => {
        if (
          !isPlainRecord(pt) ||
          typeof pt.x !== "number" ||
          !Number.isFinite(pt.x) ||
          typeof pt.y !== "number" ||
          !Number.isFinite(pt.y)
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              `Stroke points[${idx}] must have finite x and y.`,
              { field: `points[${idx}]` }
            )
          );
        }
      });
    }
  } else if (
    drawing.type === DRAWING_TYPES.RECT ||
    drawing.type === DRAWING_TYPES.CIRCLE
  ) {
    if (!isTrimmedNonEmpty(drawing.strokeColor)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Shape drawing strokeColor is required.",
          { field: "strokeColor" }
        )
      );
    }
    if (
      typeof drawing.strokeWidth !== "number" ||
      !Number.isFinite(drawing.strokeWidth) ||
      drawing.strokeWidth <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Shape drawing strokeWidth must be > 0.",
          { field: "strokeWidth", value: drawing.strokeWidth }
        )
      );
    }
    if (typeof drawing.hasFill !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Shape drawing hasFill must be a boolean.",
          { field: "hasFill" }
        )
      );
    }
    if (drawing.hasFill === true && !isTrimmedNonEmpty(drawing.fillColor)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Shape drawing fillColor is required when hasFill is true.",
          { field: "fillColor" }
        )
      );
    } else if (
      drawing.fillColor !== null &&
      !isTrimmedNonEmpty(drawing.fillColor)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Shape drawing fillColor must be null or a trimmed non-empty string.",
          { field: "fillColor" }
        )
      );
    }
    for (const numField of ["x", "y", "rotation"]) {
      if (
        typeof drawing[numField] !== "number" ||
        !Number.isFinite(drawing[numField])
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Shape drawing ${numField} must be a finite number.`,
            { field: numField }
          )
        );
      }
    }
    for (const sizeField of ["w", "h"]) {
      if (
        typeof drawing[sizeField] !== "number" ||
        !Number.isFinite(drawing[sizeField]) ||
        drawing[sizeField] < 0
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.OUT_OF_RANGE,
            `Shape drawing ${sizeField} must be >= 0.`,
            { field: sizeField, value: drawing[sizeField] }
          )
        );
      }
    }
  } else if (drawing.type === DRAWING_TYPES.TEXT) {
    if (!isTrimmedNonEmpty(drawing.text?.trim?.() ?? "")) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Text drawing text must be non-empty.",
          { field: "text" }
        )
      );
    }
    if (
      typeof drawing.fontSize !== "number" ||
      !Number.isFinite(drawing.fontSize) ||
      drawing.fontSize <= 0
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "Text drawing fontSize must be > 0.",
          { field: "fontSize", value: drawing.fontSize }
        )
      );
    }
    if (!isTrimmedNonEmpty(drawing.fontFamily)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Text drawing fontFamily is required.",
          { field: "fontFamily" }
        )
      );
    }
    if (!isTrimmedNonEmpty(drawing.color)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Text drawing color is required.",
          { field: "color" }
        )
      );
    }
    for (const numField of ["x", "y", "rotation"]) {
      if (
        typeof drawing[numField] !== "number" ||
        !Number.isFinite(drawing[numField])
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `Text drawing ${numField} must be a finite number.`,
            { field: numField }
          )
        );
      }
    }
  }

  for (const legacyKey of LEGACY_DRAWING_KEYS) {
    if (Object.hasOwn(drawing, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy drawing field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = undefined) {
  const src = isPlainRecord(docData) ? docData : {};
  const resolvedId = id ?? src.id ?? null;

  let type = src.type ?? src.shapeType;
  if (type === undefined || type === null) {
    if (typeof src.text === "string") {
      type = DRAWING_TYPES.TEXT;
    } else if (Array.isArray(src.points)) {
      type = DRAWING_TYPES.STROKE;
    }
  }

  return normalizeDrawing(
    {
      ...src,
      type,
      authorId: src.authorId ?? src.createdBy ?? null,
      createdAt: src.createdAt ?? src.timestamp ?? null,
      strokeColor: src.strokeColor ?? src.color,
      strokeWidth: src.strokeWidth ?? src.width
    },
    { id: resolvedId }
  );
}

export function toDoc(drawing) {
  return normalizeDrawing(drawing);
}

export { toDoc as toDrawingDoc, fromDoc as fromDrawingDoc };
