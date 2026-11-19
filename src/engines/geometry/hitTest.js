import { DRAWING_TYPES } from "../../domain/constants.js";
import {
  parseFiniteNumber,
  resolvePositiveNumber,
  toFiniteNumber
} from "./coords.js";
import { getTextBounds } from "./textBounds.js";

function resolveDrawingType(drawing) {
  if (drawing.type === DRAWING_TYPES.TEXT || typeof drawing.text === "string") {
    return DRAWING_TYPES.TEXT;
  }
  if (
    drawing.type === DRAWING_TYPES.CIRCLE ||
    drawing.shapeType === DRAWING_TYPES.CIRCLE
  ) {
    return DRAWING_TYPES.CIRCLE;
  }
  if (
    drawing.type === DRAWING_TYPES.RECT ||
    drawing.shapeType === DRAWING_TYPES.RECT
  ) {
    return DRAWING_TYPES.RECT;
  }
  if (drawing.type === DRAWING_TYPES.STROKE || Array.isArray(drawing.points)) {
    return DRAWING_TYPES.STROKE;
  }
  return null;
}

function resolveShapeDimension(value) {
  if (value === undefined || value === null) {
    return 20;
  }
  const parsed = parseFiniteNumber(value);
  if (parsed === null) {
    return 20;
  }
  return parsed <= 0 ? 0 : parsed;
}

function resolveShapeMetrics(drawing) {
  const sx = toFiniteNumber(drawing.x, 0);
  const sy = toFiniteNumber(drawing.y, 0);
  const w = resolveShapeDimension(drawing.w);
  const h = resolveShapeDimension(drawing.h);
  const cx = sx + w / 2;
  const cy = sy + h / 2;
  const rad = (toFiniteNumber(drawing.rotation, 0) * Math.PI) / 180;
  return { w, h, cx, cy, rad };
}

function extractValidPoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  const valid = [];
  for (const pt of points) {
    if (!pt || typeof pt !== "object") {
      continue;
    }
    const x = parseFiniteNumber(pt.x);
    const y = parseFiniteNumber(pt.y);
    if (x !== null && y !== null) {
      valid.push({ x, y });
    }
  }
  return valid;
}

function pointToSegmentDistSq(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = px - a.x;
  const wy = py - a.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq === 0) {
    return wx * wx + wy * wy;
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq));
  const projX = a.x + t * vx;
  const projY = a.y + t * vy;
  const dx = px - projX;
  const dy = py - projY;
  return dx * dx + dy * dy;
}

function doesObbIntersectAabb(obb, minX, minY, maxX, maxY) {
  const { cx, cy, halfW, halfH, rad, aabb } = obb;

  if (
    aabb.x > maxX ||
    aabb.x + aabb.w < minX ||
    aabb.y > maxY ||
    aabb.y + aabb.h < minY
  ) {
    return false;
  }

  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);

  const rHalfW = (maxX - minX) / 2;
  const rHalfH = (maxY - minY) / 2;
  const deltaX = (minX + maxX) / 2 - cx;
  const deltaY = (minY + maxY) / 2 - cy;

  const projU = Math.abs(deltaX * cos + deltaY * sin);
  if (projU > halfW + rHalfW * absCos + rHalfH * absSin) {
    return false;
  }

  const projV = Math.abs(-deltaX * sin + deltaY * cos);
  if (projV > halfH + rHalfW * absSin + rHalfH * absCos) {
    return false;
  }

  return true;
}

function convexQuadIntersectsUnitCircle(quad, hasPositiveArea) {
  if (hasPositiveArea) {
    let allNonNegative = true;
    let allNonPositive = true;
    for (let i = 0; i < 4; i += 1) {
      const a = quad[i];
      const b = quad[(i + 1) % 4];
      const cross = -(b.x - a.x) * a.y + (b.y - a.y) * a.x;
      if (cross < -1e-9) {
        allNonNegative = false;
      }
      if (cross > 1e-9) {
        allNonPositive = false;
      }
    }
    if (allNonNegative || allNonPositive) {
      return true;
    }
  }

  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    if (pointToSegmentDistSq(0, 0, a, b) <= 1) {
      return true;
    }
  }

  return false;
}

function doesSegmentIntersectAabb(p0, p1, minX, minY, maxX, maxY) {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let t0 = 0;
  let t1 = 1;

  const checks = [
    [-dx, p0.x - minX],
    [dx, maxX - p0.x],
    [-dy, p0.y - minY],
    [dy, maxY - p0.y]
  ];

  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) {
        return false;
      }
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) {
          return false;
        }
        if (r > t0) {
          t0 = r;
        }
      } else {
        if (r < t0) {
          return false;
        }
        if (r < t1) {
          t1 = r;
        }
      }
    }
  }

  return t0 <= t1;
}

export function getDrawingBounds(drawing) {
  if (!drawing || typeof drawing !== "object") {
    return null;
  }

  const type = resolveDrawingType(drawing);
  if (type === DRAWING_TYPES.TEXT) {
    const tb = getTextBounds(drawing);
    return { x: tb.x, y: tb.y, w: tb.w, h: tb.h };
  }

  if (type === DRAWING_TYPES.RECT) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const boundW = w * cos + h * sin;
    const boundH = w * sin + h * cos;
    return {
      x: cx - boundW / 2,
      y: cy - boundH / 2,
      w: boundW,
      h: boundH
    };
  }

  if (type === DRAWING_TYPES.CIRCLE) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    const rx = w / 2;
    const ry = h / 2;
    const halfW = Math.hypot(rx * Math.cos(rad), ry * Math.sin(rad));
    const halfH = Math.hypot(rx * Math.sin(rad), ry * Math.cos(rad));
    return {
      x: cx - halfW,
      y: cy - halfH,
      w: halfW * 2,
      h: halfH * 2
    };
  }

  if (type === DRAWING_TYPES.STROKE) {
    const pts = extractValidPoints(drawing.points);
    if (pts.length === 0) {
      return null;
    }
    let minX = pts[0].x;
    let maxX = pts[0].x;
    let minY = pts[0].y;
    let maxY = pts[0].y;
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    return {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY
    };
  }

  return null;
}

export function doesDrawingIntersectRect(drawing, rect) {
  if (!drawing || typeof drawing !== "object" || !rect || typeof rect !== "object") {
    return false;
  }

  const rx = parseFiniteNumber(rect.x);
  const ry = parseFiniteNumber(rect.y);
  const rw = parseFiniteNumber(rect.w);
  const rh = parseFiniteNumber(rect.h);
  if (rx === null || ry === null || rw === null || rh === null) {
    return false;
  }

  const minX = Math.min(rx, rx + rw);
  const maxX = Math.max(rx, rx + rw);
  const minY = Math.min(ry, ry + rh);
  const maxY = Math.max(ry, ry + rh);

  const type = resolveDrawingType(drawing);

  if (type === DRAWING_TYPES.TEXT) {
    const tb = getTextBounds(drawing);
    return doesObbIntersectAabb(
      {
        cx: tb.center.x,
        cy: tb.center.y,
        halfW: tb.width / 2,
        halfH: tb.height / 2,
        rad: tb.rotationRad,
        aabb: tb
      },
      minX,
      minY,
      maxX,
      maxY
    );
  }

  if (type === DRAWING_TYPES.RECT) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    if (w <= 0 || h <= 0) {
      return false;
    }
    const aabb = getDrawingBounds(drawing);
    return doesObbIntersectAabb(
      {
        cx,
        cy,
        halfW: w / 2,
        halfH: h / 2,
        rad,
        aabb
      },
      minX,
      minY,
      maxX,
      maxY
    );
  }

  if (type === DRAWING_TYPES.CIRCLE) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    if (w <= 0 || h <= 0) {
      return false;
    }
    const aabb = getDrawingBounds(drawing);
    if (
      aabb.x > maxX ||
      aabb.x + aabb.w < minX ||
      aabb.y > maxY ||
      aabb.y + aabb.h < minY
    ) {
      return false;
    }

    const rxEllipse = w / 2;
    const ryEllipse = h / 2;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY]
    ].map(([px, py]) => {
      const dx = px - cx;
      const dy = py - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      return { x: lx / rxEllipse, y: ly / ryEllipse };
    });

    return convexQuadIntersectsUnitCircle(corners, minX < maxX && minY < maxY);
  }

  if (type === DRAWING_TYPES.STROKE) {
    const pts = extractValidPoints(drawing.points);
    if (pts.length === 0) {
      return false;
    }
    if (pts.length === 1) {
      return (
        pts[0].x >= minX &&
        pts[0].x <= maxX &&
        pts[0].y >= minY &&
        pts[0].y <= maxY
      );
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (doesSegmentIntersectAabb(pts[i], pts[i + 1], minX, minY, maxX, maxY)) {
        return true;
      }
    }
    return false;
  }

  return false;
}

export function isPointInDrawing(point, drawing, options = {}) {
  if (!point || typeof point !== "object" || !drawing || typeof drawing !== "object") {
    return false;
  }

  const px = parseFiniteNumber(point.x);
  const py = parseFiniteNumber(point.y);
  if (px === null || py === null) {
    return false;
  }

  const type = resolveDrawingType(drawing);

  if (type === DRAWING_TYPES.TEXT) {
    const tb = getTextBounds(drawing);
    const cos = Math.cos(tb.rotationRad);
    const sin = Math.sin(tb.rotationRad);
    const dx = px - tb.pivot.x;
    const dy = py - tb.pivot.y;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    return lx >= 0 && lx <= tb.width && ly >= 0 && ly <= tb.height;
  }

  if (type === DRAWING_TYPES.RECT) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    if (w <= 0 || h <= 0) {
      return false;
    }
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
  }

  if (type === DRAWING_TYPES.CIRCLE) {
    const { w, h, cx, cy, rad } = resolveShapeMetrics(drawing);
    if (w <= 0 || h <= 0) {
      return false;
    }
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const rx = w / 2;
    const ry = h / 2;
    return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1;
  }

  if (type === DRAWING_TYPES.STROKE) {
    const pts = extractValidPoints(drawing.points);
    if (pts.length === 0) {
      return false;
    }
    const safeOpts = options && typeof options === "object" ? options : {};
    const customTol = parseFiniteNumber(safeOpts.strokeTolerance ?? safeOpts.tolerance);
    const tol =
      customTol !== null && customTol >= 0
        ? customTol
        : Math.max(8, resolvePositiveNumber(drawing.width, 4) / 2 + 7);
    const tolSq = tol * tol;

    if (pts.length === 1) {
      return (px - pts[0].x) ** 2 + (py - pts[0].y) ** 2 <= tolSq;
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (pointToSegmentDistSq(px, py, pts[i], pts[i + 1]) <= tolSq) {
        return true;
      }
    }
    return false;
  }

  return false;
}
