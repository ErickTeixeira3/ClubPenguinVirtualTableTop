import {
  DEFAULT_CELL_SIZE_PX,
  METERS_PER_CELL,
  SKILL_AOE_TYPES
} from "../../domain/constants.js";
import { DEFAULT_AOE, DEFAULT_RANGE } from "../../domain/defaults.js";
import {
  getTokenCenter,
  getTokenRadiusPx,
  metersToPixels,
  parseFiniteNumber,
  resolvePositiveNumber
} from "./coords.js";

export function isTokenInsideCircle(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const { token, cellSizePx = DEFAULT_CELL_SIZE_PX, circleCenter, radiusPx } = opts;

  if (!circleCenter || typeof circleCenter !== "object") {
    return false;
  }
  const cx = parseFiniteNumber(circleCenter.x);
  const cy = parseFiniteNumber(circleCenter.y);
  const rPx = parseFiniteNumber(radiusPx);
  if (cx === null || cy === null || rPx === null || rPx <= 0) {
    return false;
  }

  const center = getTokenCenter(token, cellSizePx);
  if (!center) {
    return false;
  }
  const tokenRadius = getTokenRadiusPx(token, cellSizePx);
  return Math.hypot(center.x - cx, center.y - cy) <= rPx + tokenRadius;
}

export function isTokenInsideCone(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const {
    token,
    cellSizePx = DEFAULT_CELL_SIZE_PX,
    coneOrigin,
    radiusPx,
    centerAngleRad,
    coneAngleDeg = DEFAULT_AOE.coneAngleDeg
  } = opts;

  if (!coneOrigin || typeof coneOrigin !== "object") {
    return false;
  }
  const ox = parseFiniteNumber(coneOrigin.x);
  const oy = parseFiniteNumber(coneOrigin.y);
  const rPx = parseFiniteNumber(radiusPx);
  const angleRad = parseFiniteNumber(centerAngleRad);
  if (ox === null || oy === null || rPx === null || rPx <= 0 || angleRad === null) {
    return false;
  }

  const center = getTokenCenter(token, cellSizePx);
  if (!center) {
    return false;
  }
  const tokenRadius = getTokenRadiusPx(token, cellSizePx);
  const dx = center.x - ox;
  const dy = center.y - oy;
  const dist = Math.hypot(dx, dy);

  if (dist > rPx + tokenRadius) {
    return false;
  }
  if (dist <= tokenRadius) {
    return true;
  }

  let diff = Math.abs((Math.atan2(dy, dx) - angleRad) % (2 * Math.PI));
  if (diff > Math.PI) {
    diff = 2 * Math.PI - diff;
  }

  const safeConeAngle = resolvePositiveNumber(coneAngleDeg, DEFAULT_AOE.coneAngleDeg);
  const halfAngleRad = (safeConeAngle * Math.PI) / 360;
  const angularRadius = Math.asin(Math.min(1, tokenRadius / Math.max(1, dist)));

  return diff <= halfAngleRad + angularRadius;
}

export function computeAoePreview(params = {}) {
  if (!params || typeof params !== "object") {
    return null;
  }

  const {
    aoeConfig,
    origin,
    mousePos,
    mouse,
    tokens = [],
    cellSizePx = DEFAULT_CELL_SIZE_PX,
    metersPerCell = METERS_PER_CELL
  } = params;

  const rawMouse = mousePos ?? mouse;
  if (!aoeConfig || typeof aoeConfig !== "object" || !rawMouse || typeof rawMouse !== "object") {
    return null;
  }

  const mx = parseFiniteNumber(rawMouse.x);
  const my = parseFiniteNumber(rawMouse.y);
  if (mx === null || my === null) {
    return null;
  }

  const resolvedMouse = { x: mx, y: my };
  const ox = origin && typeof origin === "object" ? parseFiniteNumber(origin.x) : null;
  const oy = origin && typeof origin === "object" ? parseFiniteNumber(origin.y) : null;
  const resolvedOrigin = ox !== null && oy !== null ? { x: ox, y: oy } : { ...resolvedMouse };

  const rawType = aoeConfig.aoe?.type ?? aoeConfig.type ?? aoeConfig.aoeType;
  const aoeType = rawType === SKILL_AOE_TYPES.CONE ? SKILL_AOE_TYPES.CONE : SKILL_AOE_TYPES.CIRCLE;

  const rawRadius = aoeConfig.aoe?.radiusMeters ?? aoeConfig.radiusMeters ?? aoeConfig.aoeRadiusMeters;
  const radiusMeters = resolvePositiveNumber(rawRadius, DEFAULT_AOE.radiusMeters);

  const rawConeAngle =
    aoeConfig.aoe?.coneAngleDeg ?? aoeConfig.coneAngleDeg ?? aoeConfig.aoeConeAngleDeg;
  const coneAngleDeg = resolvePositiveNumber(rawConeAngle, DEFAULT_AOE.coneAngleDeg);

  const rawRange = aoeConfig.range?.distanceMeters ?? aoeConfig.rangeMeters;
  const parsedRange = parseFiniteNumber(rawRange);
  const rangeMeters =
    parsedRange !== null && parsedRange >= 0 ? parsedRange : DEFAULT_RANGE.distanceMeters;

  const radiusPx = metersToPixels(radiusMeters, cellSizePx, metersPerCell);
  const maxRangePx = metersToPixels(rangeMeters, cellSizePx, metersPerCell);
  const safeTokens = Array.isArray(tokens) ? tokens : [];

  const dx = resolvedMouse.x - resolvedOrigin.x;
  const dy = resolvedMouse.y - resolvedOrigin.y;

  if (aoeType === SKILL_AOE_TYPES.CONE) {
    const centerAngleRad = Math.atan2(dy, dx);
    const halfAngleRad = (coneAngleDeg * Math.PI) / 360;
    const x1 = resolvedOrigin.x + radiusPx * Math.cos(centerAngleRad - halfAngleRad);
    const y1 = resolvedOrigin.y + radiusPx * Math.sin(centerAngleRad - halfAngleRad);
    const x2 = resolvedOrigin.x + radiusPx * Math.cos(centerAngleRad + halfAngleRad);
    const y2 = resolvedOrigin.y + radiusPx * Math.sin(centerAngleRad + halfAngleRad);

    const tokensInside = safeTokens.filter((token) =>
      isTokenInsideCone({
        token,
        cellSizePx,
        coneOrigin: resolvedOrigin,
        radiusPx,
        centerAngleRad,
        coneAngleDeg
      })
    );

    return {
      type: SKILL_AOE_TYPES.CONE,
      origin: resolvedOrigin,
      radiusPx,
      radiusMeters,
      centerAngleRad,
      coneAngleDeg,
      x1,
      y1,
      x2,
      y2,
      tokensInside
    };
  }

  const dist = Math.hypot(dx, dy);
  let circleCenter;
  if (dist > maxRangePx) {
    circleCenter =
      maxRangePx === 0
        ? { ...resolvedOrigin }
        : {
            x: resolvedOrigin.x + (dx / dist) * maxRangePx,
            y: resolvedOrigin.y + (dy / dist) * maxRangePx
          };
  } else {
    circleCenter = { ...resolvedMouse };
  }

  const tokensInside = safeTokens.filter((token) =>
    isTokenInsideCircle({
      token,
      cellSizePx,
      circleCenter,
      radiusPx
    })
  );

  return {
    type: SKILL_AOE_TYPES.CIRCLE,
    origin: resolvedOrigin,
    circleCenter,
    radiusPx,
    radiusMeters,
    maxRangePx,
    rangeMeters,
    tokensInside
  };
}
