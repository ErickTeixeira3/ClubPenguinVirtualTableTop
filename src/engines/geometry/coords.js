import {
  DEFAULT_CELL_SIZE_PX,
  METERS_PER_CELL,
  MIN_GRID_CELL_SIZE_PX
} from "../../domain/constants.js";
import { DEFAULT_AOE } from "../../domain/defaults.js";

export function parseFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function toFiniteNumber(value, fallback = 0) {
  const parsed = parseFiniteNumber(value);
  return parsed === null ? fallback : parsed;
}

export function resolvePositiveNumber(value, fallback) {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : fallback;
}

export function resolveSafeCellSizePx(cellSizePx) {
  const parsed = parseFiniteNumber(cellSizePx);
  if (parsed !== null && parsed > 0) {
    return Math.max(MIN_GRID_CELL_SIZE_PX, parsed);
  }
  return DEFAULT_CELL_SIZE_PX;
}

export function getTokenRadiusPx(token, cellSizePx = DEFAULT_CELL_SIZE_PX) {
  if (!token || typeof token !== "object") {
    return 0;
  }
  const sizeInCells = resolvePositiveNumber(token.sizeInCells, 1);
  return (sizeInCells * resolveSafeCellSizePx(cellSizePx)) / 2;
}

export function getTokenCenter(token, cellSizePx = DEFAULT_CELL_SIZE_PX) {
  if (!token || typeof token !== "object") {
    return null;
  }
  const x = parseFiniteNumber(token.x);
  const y = parseFiniteNumber(token.y);
  if (x === null || y === null) {
    return null;
  }
  const radius = getTokenRadiusPx(token, cellSizePx);
  return { x: x + radius, y: y + radius };
}

export function metersToPixels(
  meters,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  metersPerCell = METERS_PER_CELL
) {
  const safeMeters = Math.max(0, toFiniteNumber(meters, 0));
  const safeMetersPerCell = resolvePositiveNumber(metersPerCell, METERS_PER_CELL);
  return (safeMeters / safeMetersPerCell) * resolveSafeCellSizePx(cellSizePx);
}

export function pixelsToMeters(
  px,
  cellSizePx = DEFAULT_CELL_SIZE_PX,
  metersPerCell = METERS_PER_CELL
) {
  const safePx = Math.max(0, toFiniteNumber(px, 0));
  const safeMetersPerCell = resolvePositiveNumber(metersPerCell, METERS_PER_CELL);
  return (safePx / resolveSafeCellSizePx(cellSizePx)) * safeMetersPerCell;
}

export function computeDistancePx(from, to) {
  if (!from || !to || typeof from !== "object" || typeof to !== "object") {
    return 0;
  }
  const dx = toFiniteNumber(to.x, 0) - toFiniteNumber(from.x, 0);
  const dy = toFiniteNumber(to.y, 0) - toFiniteNumber(from.y, 0);
  return Math.hypot(dx, dy);
}

export function computeMoveDistanceMeters(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const {
    fromX = 0,
    fromY = 0,
    toX = 0,
    toY = 0,
    cellSizePx = DEFAULT_CELL_SIZE_PX,
    metersPerCell = METERS_PER_CELL
  } = opts;
  const distPx = computeDistancePx({ x: fromX, y: fromY }, { x: toX, y: toY });
  const meters = pixelsToMeters(distPx, cellSizePx, metersPerCell);
  return Number(meters.toFixed(2));
}

export function computeRulerStats(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const {
    startX = 0,
    startY = 0,
    endX = 0,
    endY = 0,
    shape = "line",
    coneAngleDeg = DEFAULT_AOE.coneAngleDeg,
    cellSizePx = DEFAULT_CELL_SIZE_PX,
    metersPerCell = METERS_PER_CELL
  } = opts;

  const sx = toFiniteNumber(startX, 0);
  const sy = toFiniteNumber(startY, 0);
  const ex = toFiniteNumber(endX, 0);
  const ey = toFiniteNumber(endY, 0);
  const safeCell = resolveSafeCellSizePx(cellSizePx);
  const dx = ex - sx;
  const dy = ey - sy;
  const distPx = Math.hypot(dx, dy);
  const squares = distPx / safeCell;
  const meters = pixelsToMeters(distPx, safeCell, metersPerCell);
  const metersText = `${meters.toFixed(1).replace(".", ",")} m`;
  const squaresText = `${squares.toFixed(1).replace(".", ",")} q`;

  if (shape === "cone") {
    const safeAngle = resolvePositiveNumber(coneAngleDeg, DEFAULT_AOE.coneAngleDeg);
    const centerAngleRad = Math.atan2(dy, dx);
    const halfAngleRad = (safeAngle * Math.PI) / 360;
    const x1 = sx + distPx * Math.cos(centerAngleRad - halfAngleRad);
    const y1 = sy + distPx * Math.sin(centerAngleRad - halfAngleRad);
    const x2 = sx + distPx * Math.cos(centerAngleRad + halfAngleRad);
    const y2 = sy + distPx * Math.sin(centerAngleRad + halfAngleRad);
    const badgeDist = Math.max(30, distPx * 0.6);
    const midX = sx + badgeDist * Math.cos(centerAngleRad);
    const midY = sy + badgeDist * Math.sin(centerAngleRad);

    return {
      shape: "cone",
      distPx,
      meters,
      squares,
      metersText,
      squaresText,
      centerAngleRad,
      coneAngle: safeAngle,
      coneAngleDeg: safeAngle,
      x1,
      y1,
      x2,
      y2,
      midX,
      midY,
      label: `📐 Cone ${safeAngle}°: ${metersText} (${squaresText})`
    };
  }

  if (shape === "circle") {
    const diameterMeters = meters * 2;
    const midX = distPx < 30 ? sx : (sx + ex) / 2;
    const midY = distPx < 30 ? sy - 30 : (sy + ey) / 2 - 20;

    return {
      shape: "circle",
      distPx,
      radiusPx: distPx,
      meters,
      squares,
      metersText,
      squaresText,
      diameterMeters,
      midX,
      midY,
      label: `⭕ Raio: ${metersText} (${squaresText}) | Diâm: ${diameterMeters.toFixed(1).replace(".", ",")} m`
    };
  }

  return {
    shape: "line",
    distPx,
    meters,
    squares,
    metersText,
    squaresText,
    midX: (sx + ex) / 2,
    midY: (sy + ey) / 2,
    label: `${metersText} (${squaresText})`
  };
}

export function rotatePoint(px, py, cx = 0, cy = 0, rad = 0) {
  const safePx = toFiniteNumber(px, 0);
  const safePy = toFiniteNumber(py, 0);
  const safeCx = toFiniteNumber(cx, 0);
  const safeCy = toFiniteNumber(cy, 0);
  const safeRad = toFiniteNumber(rad, 0);

  if (safeRad === 0) {
    return { x: safePx, y: safePy };
  }

  const cos = Math.cos(safeRad);
  const sin = Math.sin(safeRad);
  return {
    x: safeCx + (safePx - safeCx) * cos - (safePy - safeCy) * sin,
    y: safeCy + (safePx - safeCx) * sin + (safePy - safeCy) * cos
  };
}

export function pointsToSvgPath(
  points = [],
  offsetX = 0,
  offsetY = 0,
  cx = 0,
  cy = 0,
  rotateRad = 0
) {
  if (!Array.isArray(points) || points.length === 0) {
    return "";
  }

  const safeOffsetX = toFiniteNumber(offsetX, 0);
  const safeOffsetY = toFiniteNumber(offsetY, 0);
  const safeCx = toFiniteNumber(cx, 0);
  const safeCy = toFiniteNumber(cy, 0);
  const safeRad = toFiniteNumber(rotateRad, 0);

  const transformed = [];
  for (const pt of points) {
    if (!pt || typeof pt !== "object") {
      continue;
    }
    const rawX = parseFiniteNumber(pt.x);
    const rawY = parseFiniteNumber(pt.y);
    if (rawX === null || rawY === null) {
      continue;
    }
    const px = rawX + safeOffsetX;
    const py = rawY + safeOffsetY;
    transformed.push(
      safeRad === 0 ? { x: px, y: py } : rotatePoint(px, py, safeCx, safeCy, safeRad)
    );
  }

  if (transformed.length === 0) {
    return "";
  }
  if (transformed.length === 1) {
    const p = transformed[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
  }
  return transformed
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}
