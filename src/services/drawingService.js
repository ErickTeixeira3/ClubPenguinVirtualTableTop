import {
  onValue,
  ref,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import {
  DRAWING_TYPES,
  ID_PREFIXES,
  LAYER_NAMES
} from "../domain/constants.js";
import { DEFAULT_COLORS } from "../domain/defaults.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  normalizeDrawing,
  toDrawingDoc,
  validateDrawing
} from "../domain/models/index.js";
import { rotatePoint } from "../engines/geometry/index.js";
import { drawingMapper } from "../infra/converters/rtdbMappers.js";
import { rtdb } from "../infra/firebase.js";
import { createId } from "../infra/ids.js";
import { drawingItemPath, drawingsPath } from "../infra/rtdbPaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { cleanRtdbValue } from "./tokenService.js";

function toWireDrawing(drawing, { isCreate = true } = {}) {
  const doc = toDrawingDoc(drawing);
  const wire = cleanRtdbValue(doc) || {};
  if (isCreate) {
    wire.createdAt = rtdbServerTimestamp();
  }
  wire.updatedAt = rtdbServerTimestamp();
  return wire;
}

export function subscribeDrawings({
  campaignId,
  sceneId,
  realtimeDb = rtdb,
  onData,
  onError
}) {
  if (!campaignId || !sceneId) {
    onData?.([]);
    return () => {};
  }

  return onValue(
    ref(realtimeDb, drawingsPath(campaignId, sceneId)),
    (snap) => {
      if (!snap.exists()) {
        onData?.([]);
        return;
      }
      const rawMap = snap.val() || {};
      const list = Object.entries(rawMap)
        .filter(([, val]) => val && typeof val === "object")
        .map(([id, val]) => drawingMapper.fromRtdb(val, { id }))
        .filter(Boolean)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onData?.(list);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function addStroke({
  campaignId,
  sceneId,
  points,
  color = DEFAULT_COLORS.drawingStroke,
  width = 4,
  layer = LAYER_NAMES.TOKENS,
  user,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) return null;
  if (!Array.isArray(points) || points.length === 0) return null;

  const id = createId(ID_PREFIXES.DRAWING);
  const effectiveLayer = isGM ? layer || LAYER_NAMES.TOKENS : LAYER_NAMES.TOKENS;
  const normalized = normalizeDrawing(
    {
      id,
      type: DRAWING_TYPES.STROKE,
      layer: effectiveLayer,
      authorId: user.uid,
      authorName: user.displayName || user.email || "Pinguim",
      color,
      width: Number(width) || 4,
      points: points.map((p) => ({
        x: Math.round(Number(p.x) || 0),
        y: Math.round(Number(p.y) || 0)
      })),
      createdAt: null,
      updatedAt: null,
      updatedBy: user.uid
    },
    { id }
  );

  const check = validateDrawing(normalized);
  if (!check.ok) {
    throw check.errors[0];
  }

  await rtdbSet(
    ref(realtimeDb, drawingItemPath(campaignId, sceneId, id)),
    toWireDrawing(normalized, { isCreate: true })
  );
  return normalized;
}

export async function addShape({
  campaignId,
  sceneId,
  shapeType = DRAWING_TYPES.RECT,
  x,
  y,
  w,
  h,
  strokeColor = DEFAULT_COLORS.drawingStroke,
  strokeWidth = 4,
  hasFill = false,
  fillColor = DEFAULT_COLORS.drawingFill,
  layer = LAYER_NAMES.TOKENS,
  user,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) return null;

  const id = createId(ID_PREFIXES.DRAWING_SHAPE);
  const type =
    shapeType === DRAWING_TYPES.CIRCLE ? DRAWING_TYPES.CIRCLE : DRAWING_TYPES.RECT;
  const effectiveLayer = isGM ? layer || LAYER_NAMES.TOKENS : LAYER_NAMES.TOKENS;

  const normalized = normalizeDrawing(
    {
      id,
      type,
      layer: effectiveLayer,
      authorId: user.uid,
      authorName: user.displayName || user.email || "Pinguim",
      strokeColor,
      strokeWidth: Number(strokeWidth) || 4,
      hasFill: Boolean(hasFill),
      fillColor: hasFill ? fillColor || DEFAULT_COLORS.drawingFill : null,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      w: Math.max(0, Math.round(Number(w) || 0)),
      h: Math.max(0, Math.round(Number(h) || 0)),
      rotation: 0,
      createdAt: null,
      updatedAt: null,
      updatedBy: user.uid
    },
    { id }
  );

  const check = validateDrawing(normalized);
  if (!check.ok) {
    throw check.errors[0];
  }

  await rtdbSet(
    ref(realtimeDb, drawingItemPath(campaignId, sceneId, id)),
    toWireDrawing(normalized, { isCreate: true })
  );
  return normalized;
}

export async function addTextItem({
  campaignId,
  sceneId,
  text,
  x,
  y,
  fontSize = 24,
  fontFamily = "Comic Sans MS, Comic Sans, cursive, sans-serif",
  color = DEFAULT_COLORS.drawingStroke,
  layer = LAYER_NAMES.TOKENS,
  user,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) return null;
  const cleanText = typeof text === "string" ? text.trim() : "";
  if (!cleanText) return null;

  const id = createId(ID_PREFIXES.DRAWING_TEXT);
  const effectiveLayer = isGM ? layer || LAYER_NAMES.TOKENS : LAYER_NAMES.TOKENS;

  const normalized = normalizeDrawing(
    {
      id,
      type: DRAWING_TYPES.TEXT,
      layer: effectiveLayer,
      authorId: user.uid,
      authorName: user.displayName || user.email || "Pinguim",
      text: cleanText,
      fontSize: Math.max(8, Number(fontSize) || 24),
      fontFamily,
      color,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      rotation: 0,
      createdAt: null,
      updatedAt: null,
      updatedBy: user.uid
    },
    { id }
  );

  const check = validateDrawing(normalized);
  if (!check.ok) {
    throw check.errors[0];
  }

  await rtdbSet(
    ref(realtimeDb, drawingItemPath(campaignId, sceneId, id)),
    toWireDrawing(normalized, { isCreate: true })
  );
  return normalized;
}

export async function updateTextItem({
  campaignId,
  sceneId,
  drawingId,
  updates = {},
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !drawingId || !user?.uid) return null;

  const patch = {};
  if ("text" in updates) {
    const cleanText = typeof updates.text === "string" ? updates.text.trim() : "";
    if (!cleanText) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "O texto do desenho não pode ficar vazio."
      );
    }
    patch.text = cleanText;
  }
  if ("fontSize" in updates) {
    patch.fontSize = Math.max(8, Number(updates.fontSize) || 24);
  }
  if ("fontFamily" in updates && typeof updates.fontFamily === "string" && updates.fontFamily.trim()) {
    patch.fontFamily = updates.fontFamily.trim();
  }
  if ("color" in updates && typeof updates.color === "string" && updates.color.trim()) {
    patch.color = updates.color.trim();
  }
  if ("x" in updates && Number.isFinite(Number(updates.x))) {
    patch.x = Math.round(Number(updates.x));
  }
  if ("y" in updates && Number.isFinite(Number(updates.y))) {
    patch.y = Math.round(Number(updates.y));
  }
  if ("rotation" in updates && Number.isFinite(Number(updates.rotation))) {
    patch.rotation = Math.round(Number(updates.rotation));
  }

  if (Object.keys(patch).length === 0) return null;

  patch.updatedAt = rtdbServerTimestamp();
  patch.updatedBy = user.uid;

  await rtdbUpdate(ref(realtimeDb, drawingItemPath(campaignId, sceneId, drawingId)), patch);
  return patch;
}

export async function deleteDrawings({
  campaignId,
  sceneId,
  drawingIds = [],
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId) return 0;
  const ids = Array.from(
    new Set(
      (Array.isArray(drawingIds) ? drawingIds : []).filter(
        (id) => typeof id === "string" && id.trim().length > 0
      )
    )
  );
  if (ids.length === 0) return 0;

  if (ids.length === 1) {
    await rtdbRemove(ref(realtimeDb, drawingItemPath(campaignId, sceneId, ids[0])));
    return 1;
  }

  const updates = {};
  for (const id of ids) {
    updates[id] = null;
  }
  await rtdbUpdate(ref(realtimeDb, drawingsPath(campaignId, sceneId)), updates);
  return ids.length;
}

export async function clearAllSceneDrawings({
  campaignId,
  sceneId,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode apagar todos os desenhos da cena."
    );
  }
  if (!campaignId || !sceneId) return;
  await rtdbRemove(ref(realtimeDb, drawingsPath(campaignId, sceneId)));
}

/**
 * INT-19: aplica deslocamento de N desenhos em UMA única atualização multi-caminho no RTDB.
 */
export async function moveDrawings({
  campaignId,
  sceneId,
  drawings = [],
  dx = 0,
  dy = 0,
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) return 0;
  const list = (Array.isArray(drawings) ? drawings : []).filter((d) => d?.id);
  if (list.length === 0) return 0;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 0;

  const nowTs = rtdbServerTimestamp();
  const multiUpdates = {};

  for (const item of list) {
    if (item.type === DRAWING_TYPES.STROKE && Array.isArray(item.points)) {
      multiUpdates[`${item.id}/points`] = item.points.map((pt) => ({
        x: Math.round((Number(pt.x) || 0) + dx),
        y: Math.round((Number(pt.y) || 0) + dy)
      }));
    } else {
      multiUpdates[`${item.id}/x`] = Math.round((Number(item.x) || 0) + dx);
      multiUpdates[`${item.id}/y`] = Math.round((Number(item.y) || 0) + dy);
    }
    multiUpdates[`${item.id}/updatedAt`] = nowTs;
    multiUpdates[`${item.id}/updatedBy`] = user.uid;
  }

  await rtdbUpdate(ref(realtimeDb, drawingsPath(campaignId, sceneId)), multiUpdates);
  return list.length;
}

/**
 * INT-19: aplica rotação de N desenhos ao redor de um pivô em UMA única atualização multi-caminho.
 */
export async function rotateDrawings({
  campaignId,
  sceneId,
  drawings = [],
  deltaAngleDeg = 0,
  pivot,
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid || !pivot) return 0;
  const list = (Array.isArray(drawings) ? drawings : []).filter((d) => d?.id);
  if (list.length === 0) return 0;
  if (Math.abs(deltaAngleDeg) < 0.001) return 0;

  const nowTs = rtdbServerTimestamp();
  const rad = (deltaAngleDeg * Math.PI) / 180;
  const multiUpdates = {};

  for (const item of list) {
    if (item.type === DRAWING_TYPES.STROKE && Array.isArray(item.points)) {
      multiUpdates[`${item.id}/points`] = item.points.map((pt) => {
        const rotated = rotatePoint(
          Number(pt.x) || 0,
          Number(pt.y) || 0,
          pivot.x,
          pivot.y,
          rad
        );
        return { x: Math.round(rotated.x), y: Math.round(rotated.y) };
      });
    } else if (item.type === DRAWING_TYPES.RECT || item.type === DRAWING_TYPES.CIRCLE) {
      const cx = (Number(item.x) || 0) + (Number(item.w) || 0) / 2;
      const cy = (Number(item.y) || 0) + (Number(item.h) || 0) / 2;
      const newCenter = rotatePoint(cx, cy, pivot.x, pivot.y, rad);
      multiUpdates[`${item.id}/x`] = Math.round(newCenter.x - (Number(item.w) || 0) / 2);
      multiUpdates[`${item.id}/y`] = Math.round(newCenter.y - (Number(item.h) || 0) / 2);
      multiUpdates[`${item.id}/rotation`] = Math.round(
        ((Number(item.rotation) || 0) + deltaAngleDeg) % 360
      );
    } else if (item.type === DRAWING_TYPES.TEXT) {
      const rotated = rotatePoint(
        Number(item.x) || 0,
        Number(item.y) || 0,
        pivot.x,
        pivot.y,
        rad
      );
      multiUpdates[`${item.id}/x`] = Math.round(rotated.x);
      multiUpdates[`${item.id}/y`] = Math.round(rotated.y);
      multiUpdates[`${item.id}/rotation`] = Math.round(
        ((Number(item.rotation) || 0) + deltaAngleDeg) % 360
      );
    }
    multiUpdates[`${item.id}/updatedAt`] = nowTs;
    multiUpdates[`${item.id}/updatedBy`] = user.uid;
  }

  await rtdbUpdate(ref(realtimeDb, drawingsPath(campaignId, sceneId)), multiUpdates);
  return list.length;
}
