import { describe, expect, it } from "vitest";
import {
  DEFAULT_CELL_SIZE_PX,
  METERS_PER_CELL,
  MIN_GRID_CELL_SIZE_PX
} from "../../../../src/domain/constants.js";
import {
  computeDistancePx,
  computeMoveDistanceMeters,
  computeRulerStats,
  getTokenCenter,
  getTokenRadiusPx,
  metersToPixels,
  pixelsToMeters,
  pointsToSvgPath,
  rotatePoint
} from "../../../../src/engines/geometry/index.js";

describe("geometry/coords: token center & radius", () => {
  it("returns 0 radius and null center for missing/non-object tokens", () => {
    expect(getTokenRadiusPx(null)).toBe(0);
    expect(getTokenRadiusPx(undefined)).toBe(0);
    expect(getTokenRadiusPx("bad")).toBe(0);
    expect(getTokenCenter(null)).toBeNull();
    expect(getTokenCenter(undefined)).toBeNull();
    expect(getTokenCenter("bad")).toBeNull();
  });

  it("returns null center for tokens with missing or non-finite coordinates", () => {
    expect(getTokenCenter({})).toBeNull();
    expect(getTokenCenter({ x: 10 })).toBeNull();
    expect(getTokenCenter({ y: 10 })).toBeNull();
    expect(getTokenCenter({ x: null, y: 10 })).toBeNull();
    expect(getTokenCenter({ x: 10, y: undefined })).toBeNull();
    expect(getTokenCenter({ x: Number.NaN, y: 0 })).toBeNull();
    expect(getTokenCenter({ x: Number.POSITIVE_INFINITY, y: 0 })).toBeNull();
    expect(getTokenCenter({ x: true, y: 0 })).toBeNull();
    expect(getTokenCenter({ x: false, y: 0 })).toBeNull();
    expect(getTokenCenter({ x: "", y: 0 })).toBeNull();
    expect(getTokenCenter({ x: "   ", y: 0 })).toBeNull();
    expect(getTokenCenter({ x: "abc", y: 0 })).toBeNull();
    expect(getTokenCenter({ x: {}, y: 0 })).toBeNull();
  });

  it("computes radius and center using valid numeric/string coordinates and sizeInCells", () => {
    expect(getTokenRadiusPx({ sizeInCells: 1 })).toBe(DEFAULT_CELL_SIZE_PX / 2);
    expect(getTokenRadiusPx({ sizeInCells: 2 }, 64)).toBe(64);
    expect(getTokenRadiusPx({ sizeInCells: 0 }, 64)).toBe(32);
    expect(getTokenRadiusPx({ sizeInCells: -3 }, 64)).toBe(32);
    expect(getTokenRadiusPx({ sizeInCells: Number.NaN }, 64)).toBe(32);

    expect(getTokenCenter({ x: 0, y: 0 })).toEqual({ x: 32, y: 32 });
    expect(getTokenCenter({ x: "64", y: " 128 ", sizeInCells: 2 }, 64)).toEqual({
      x: 128,
      y: 192
    });
  });

  it("clamps cellSizePx to MIN_GRID_CELL_SIZE_PX and falls back invalid cell sizes to 64", () => {
    expect(getTokenRadiusPx({ sizeInCells: 1 }, 4)).toBe(MIN_GRID_CELL_SIZE_PX / 2);
    expect(getTokenRadiusPx({ sizeInCells: 1 }, 0)).toBe(DEFAULT_CELL_SIZE_PX / 2);
    expect(getTokenRadiusPx({ sizeInCells: 1 }, -10)).toBe(DEFAULT_CELL_SIZE_PX / 2);
    expect(getTokenRadiusPx({ sizeInCells: 1 }, Number.NaN)).toBe(DEFAULT_CELL_SIZE_PX / 2);
  });
});

describe("geometry/coords: conversions & distance", () => {
  it("converts meters <-> pixels using METERS_PER_CELL", () => {
    expect(METERS_PER_CELL).toBe(1.5);
    expect(metersToPixels(3, 64)).toBe(128);
    expect(metersToPixels(0, 64)).toBe(0);
    expect(metersToPixels(-5, 64)).toBe(0);
    expect(metersToPixels(Number.NaN, 64)).toBe(0);
    expect(metersToPixels(3, 64, 0)).toBe(128);
    expect(metersToPixels(3, 64, -2)).toBe(128);
    expect(metersToPixels(3, 64, 3)).toBe(64);

    expect(pixelsToMeters(128, 64)).toBe(3);
    expect(pixelsToMeters(0, 64)).toBe(0);
    expect(pixelsToMeters(-20, 64)).toBe(0);
    expect(pixelsToMeters(null, 64)).toBe(0);
    expect(pixelsToMeters(64, 64, 0)).toBe(1.5);
  });

  it("computes Euclidean pixel distance and movement meters with 2-decimal rounding", () => {
    expect(computeDistancePx(null, { x: 10, y: 10 })).toBe(0);
    expect(computeDistancePx({ x: 10, y: 10 }, null)).toBe(0);
    expect(computeDistancePx({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(computeDistancePx({}, { x: 3, y: 4 })).toBe(5);

    expect(computeMoveDistanceMeters()).toBe(0);
    expect(computeMoveDistanceMeters(null)).toBe(0);
    expect(
      computeMoveDistanceMeters({ fromX: 0, fromY: 0, toX: 128, toY: 0, cellSizePx: 64 })
    ).toBe(3);
    expect(
      computeMoveDistanceMeters({ fromX: 0, fromY: 0, toX: 64, toY: 64, cellSizePx: 64 })
    ).toBe(2.12);
    expect(computeMoveDistanceMeters({ toX: 16, cellSizePx: 4 })).toBe(3);
    expect(computeMoveDistanceMeters({ toX: 64, cellSizePx: 0 })).toBe(1.5);
  });
});

describe("geometry/coords: computeRulerStats", () => {
  it("computes line ruler stats and handles null/empty args", () => {
    expect(computeRulerStats()).toMatchObject({
      shape: "line",
      distPx: 0,
      meters: 0,
      squares: 0,
      label: "0,0 m (0,0 q)"
    });
    expect(computeRulerStats(null).shape).toBe("line");

    const line = computeRulerStats({
      startX: 0,
      startY: 0,
      endX: 192,
      endY: 0,
      cellSizePx: 64
    });
    expect(line).toMatchObject({
      shape: "line",
      distPx: 192,
      meters: 4.5,
      squares: 3,
      metersText: "4,5 m",
      squaresText: "3,0 q",
      midX: 96,
      midY: 0,
      label: "4,5 m (3,0 q)"
    });

    const fallback = computeRulerStats({ shape: "unknown", endX: 64, endY: 0 });
    expect(fallback.shape).toBe("line");
  });

  it("computes cone ruler stats with badge minimum distance and angle fallback", () => {
    const shortCone = computeRulerStats({
      startX: 10,
      startY: 20,
      endX: 30,
      endY: 20,
      shape: "cone",
      coneAngleDeg: 0,
      cellSizePx: 64
    });
    expect(shortCone.shape).toBe("cone");
    expect(shortCone.coneAngle).toBe(45);
    expect(shortCone.coneAngleDeg).toBe(45);
    expect(shortCone.midX).toBeCloseTo(40);
    expect(shortCone.midY).toBeCloseTo(20);
    expect(shortCone.label).toContain("📐 Cone 45°:");

    const longCone = computeRulerStats({
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 0,
      shape: "cone",
      coneAngleDeg: 60,
      cellSizePx: 64
    });
    expect(longCone.coneAngleDeg).toBe(60);
    expect(longCone.midX).toBeCloseTo(60);
    expect(longCone.x1).toBeCloseTo(100 * Math.cos(Math.PI / 6));
    expect(longCone.y1).toBeCloseTo(-100 * Math.sin(Math.PI / 6));
    expect(longCone.x2).toBeCloseTo(100 * Math.cos(Math.PI / 6));
    expect(longCone.y2).toBeCloseTo(100 * Math.sin(Math.PI / 6));
  });

  it("computes circle ruler stats for short (<30px) and normal (>=30px) radii", () => {
    const shortCircle = computeRulerStats({
      startX: 10,
      startY: 50,
      endX: 20,
      endY: 50,
      shape: "circle",
      cellSizePx: 64
    });
    expect(shortCircle.shape).toBe("circle");
    expect(shortCircle.midX).toBe(10);
    expect(shortCircle.midY).toBe(20);

    const wideCircle = computeRulerStats({
      startX: 0,
      startY: 0,
      endX: 128,
      endY: 0,
      shape: "circle",
      cellSizePx: 64
    });
    expect(wideCircle.radiusPx).toBe(128);
    expect(wideCircle.diameterMeters).toBe(6);
    expect(wideCircle.midX).toBe(64);
    expect(wideCircle.midY).toBe(-20);
    expect(wideCircle.label).toBe("⭕ Raio: 3,0 m (2,0 q) | Diâm: 6,0 m");
  });
});

describe("geometry/coords: rotatePoint & pointsToSvgPath", () => {
  it("rotates around pivot and returns original coords when rad is 0 or invalid", () => {
    expect(rotatePoint(3, 4, 0, 0, 0)).toEqual({ x: 3, y: 4 });
    expect(rotatePoint(3, 4, 0, 0, Number.NaN)).toEqual({ x: 3, y: 4 });

    const rotated90 = rotatePoint(15, 5, 5, 5, Math.PI / 2);
    expect(rotated90.x).toBeCloseTo(5);
    expect(rotated90.y).toBeCloseTo(15);

    const rotatedNeg90 = rotatePoint(15, 5, 5, 5, -Math.PI / 2);
    expect(rotatedNeg90.x).toBeCloseTo(5);
    expect(rotatedNeg90.y).toBeCloseTo(-5);
  });

  it("builds SVG path for empty, single, multi-point, and rotated strokes", () => {
    expect(pointsToSvgPath(null)).toBe("");
    expect(pointsToSvgPath([])).toBe("");
    expect(pointsToSvgPath([null, { x: "bad", y: 1 }, { x: 1 }])).toBe("");

    expect(pointsToSvgPath([{ x: 10, y: 20 }])).toBe("M 10 20 L 10.5 20.5");
    expect(
      pointsToSvgPath([{ x: 0, y: 0 }, null, { x: 10, y: 20 }], 5, -5)
    ).toBe("M 5 -5 L 15 15");

    const rotated = pointsToSvgPath(
      [{ x: 10, y: 0 }, { x: 20, y: 0 }],
      0,
      0,
      0,
      0,
      Math.PI / 2
    );
    expect(rotated.startsWith("M ")).toBe(true);
    expect(rotated).toContain(" L ");
  });
});
