import { describe, expect, it } from "vitest";
import {
  doesDrawingIntersectRect,
  getDrawingBounds,
  isPointInDrawing
} from "../../../../src/engines/geometry/index.js";

describe("geometry/hitTest: getDrawingBounds", () => {
  it("returns null for invalid/unknown drawings and empty strokes", () => {
    expect(getDrawingBounds(null)).toBeNull();
    expect(getDrawingBounds("bad")).toBeNull();
    expect(getDrawingBounds({ type: "unknown" })).toBeNull();
    expect(getDrawingBounds({ type: "stroke" })).toBeNull();
    expect(getDrawingBounds({ type: "stroke", points: [null, { x: Number.NaN, y: 1 }] })).toBeNull();
  });

  it("computes bounds for text, rect, circle/ellipse, and stroke including rotation", () => {
    const textBounds = getDrawingBounds({
      type: "text",
      x: 10,
      y: 20,
      text: "ABCD",
      fontSize: 24,
      rotation: 90
    });
    expect(textBounds.x).toBeCloseTo(10 - 32.4);
    expect(textBounds.y).toBeCloseTo(20);
    expect(textBounds.w).toBeCloseTo(32.4);
    expect(textBounds.h).toBeCloseTo(62.4);

    const rectUnrotated = getDrawingBounds({ type: "rect", x: 10, y: 20, w: 40, h: 20 });
    expect(rectUnrotated).toEqual({ x: 10, y: 20, w: 40, h: 20 });

    const rect45 = getDrawingBounds({ type: "rect", x: 0, y: 0, w: 20, h: 20, rotation: 45 });
    const expectedDiag = 20 * Math.SQRT2;
    expect(rect45.w).toBeCloseTo(expectedDiag);
    expect(rect45.h).toBeCloseTo(expectedDiag);
    expect(rect45.x).toBeCloseTo(10 - expectedDiag / 2);

    const rectDefault = getDrawingBounds({ shapeType: "rect", x: 5, y: 5, w: Number.NaN, h: 0 });
    expect(rectDefault).toEqual({ x: 5, y: 5, w: 20, h: 0 });

    const trueCircle = getDrawingBounds({ type: "circle", x: 0, y: 0, w: 40, h: 40, rotation: 37 });
    expect(trueCircle.x).toBeCloseTo(0);
    expect(trueCircle.y).toBeCloseTo(0);
    expect(trueCircle.w).toBeCloseTo(40);
    expect(trueCircle.h).toBeCloseTo(40);

    const ellipse90 = getDrawingBounds({
      shapeType: "circle",
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      rotation: 90
    });
    expect(ellipse90.w).toBeCloseTo(40);
    expect(ellipse90.h).toBeCloseTo(100);
    expect(ellipse90.x).toBeCloseTo(30);
    expect(ellipse90.y).toBeCloseTo(-30);

    const strokeBounds = getDrawingBounds({
      points: [
        { x: 50, y: 30 },
        { x: 10, y: 80 },
        { x: 70, y: 15 }
      ]
    });
    expect(strokeBounds).toEqual({ x: 10, y: 15, w: 60, h: 65 });
  });
});

describe("geometry/hitTest: doesDrawingIntersectRect", () => {
  it("fails closed on invalid drawings, rects, or zero-dimension shapes", () => {
    const rect = { x: 0, y: 0, w: 50, h: 50 };
    expect(doesDrawingIntersectRect(null, rect)).toBe(false);
    expect(doesDrawingIntersectRect({ type: "rect" }, null)).toBe(false);
    expect(doesDrawingIntersectRect({ type: "rect" }, { x: 0, y: 0, w: Number.NaN, h: 10 })).toBe(
      false
    );
    expect(doesDrawingIntersectRect({ type: "unknown" }, rect)).toBe(false);
    expect(doesDrawingIntersectRect({ type: "rect", x: 10, y: 10, w: 0, h: 10 }, rect)).toBe(
      false
    );
    expect(doesDrawingIntersectRect({ type: "circle", x: 10, y: 10, w: 10, h: 0 }, rect)).toBe(
      false
    );
    expect(doesDrawingIntersectRect({ type: "stroke" }, rect)).toBe(false);
  });

  it("handles negative drag selection rects and legacy default shape dimensions", () => {
    const negRect = { x: 50, y: 50, w: -50, h: -50 };
    expect(doesDrawingIntersectRect({ type: "circle", x: -15, y: -15 }, negRect)).toBe(true);
    expect(doesDrawingIntersectRect({ shapeType: "circle", x: 60, y: 60, w: 10, h: 10 }, negRect)).toBe(
      false
    );
  });

  it("uses exact 2D SAT for rotated rects and rotated texts (left-top pivot)", () => {
    // 100x20 rect centered at (50, 50), rotated 45 deg
    const diamond = { type: "rect", x: 0, y: 40, w: 100, h: 20, rotation: 45 };
    // Inside diamond's AABB [7.57, 92.4] x [7.57, 92.4], separated along local u-axis
    expect(doesDrawingIntersectRect(diamond, { x: 8, y: 8, w: 4, h: 4 })).toBe(false);
    // Selection box inside diamond's AABB, passes u-axis, separated along local v-axis
    expect(doesDrawingIntersectRect(diamond, { x: 80, y: 0, w: 15, h: 15 })).toBe(false);
    // Completely outside AABB
    expect(doesDrawingIntersectRect(diamond, { x: 200, y: 200, w: 15, h: 15 })).toBe(false);
    // Selection box intersecting center
    expect(doesDrawingIntersectRect(diamond, { x: 45, y: 45, w: 10, h: 10 })).toBe(true);

    // Text rotated 90 deg around left-top (100, 100) extends downward & leftward
    const rotText = { type: "text", x: 100, y: 100, text: "Hello World", fontSize: 20, rotation: 90 };
    expect(doesDrawingIntersectRect(rotText, { x: 110, y: 105, w: 40, h: 20 })).toBe(false);
    expect(doesDrawingIntersectRect(rotText, { x: 75, y: 120, w: 20, h: 40 })).toBe(true);
  });

  it("uses exact transformed-quad vs unit-circle for rotated ellipses", () => {
    const ellipse = { type: "circle", x: 0, y: 30, w: 100, h: 40, rotation: 45 };
    // Corner of ellipse AABB is empty space (AABB overlaps but ellipse misses)
    expect(doesDrawingIntersectRect(ellipse, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    // Rect inside large ellipse
    expect(doesDrawingIntersectRect(ellipse, { x: 48, y: 48, w: 4, h: 4 })).toBe(true);
    // Giant selection rect containing the ellipse
    expect(doesDrawingIntersectRect(ellipse, { x: -200, y: -200, w: 500, h: 500 })).toBe(true);
    // Zero-area point selection rect inside vs outside ellipse
    expect(doesDrawingIntersectRect(ellipse, { x: 50, y: 50, w: 0, h: 0 })).toBe(true);
    expect(doesDrawingIntersectRect(ellipse, { x: 12, y: 12, w: 0, h: 0 })).toBe(false);
  });

  it("tests stroke polylines with single points and crossing segments (Liang-Barsky)", () => {
    const rect = { x: 20, y: 20, w: 20, h: 20 };
    expect(doesDrawingIntersectRect({ points: [{ x: 30, y: 30 }] }, rect)).toBe(true);
    expect(doesDrawingIntersectRect({ points: [{ x: 10, y: 10 }] }, rect)).toBe(false);

    // Segment crosses straight through rect with neither endpoint inside
    expect(
      doesDrawingIntersectRect({ points: [{ x: 0, y: 30 }, { x: 60, y: 30 }] }, rect)
    ).toBe(true);
    // Diagonal crossing through rect
    expect(
      doesDrawingIntersectRect({ points: [{ x: 0, y: 10 }, { x: 50, y: 60 }] }, rect)
    ).toBe(true);
    // Horizontal/vertical parallel outside rect
    expect(
      doesDrawingIntersectRect({ points: [{ x: 0, y: 10 }, { x: 60, y: 10 }] }, rect)
    ).toBe(false);
    // Diagonal missing rect completely
    expect(
      doesDrawingIntersectRect({ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }, rect)
    ).toBe(false);
    expect(
      doesDrawingIntersectRect({ points: [{ x: 50, y: 0 }, { x: 60, y: 10 }] }, rect)
    ).toBe(false);
    // Diagonal clipped on t0/t1 and missing (passes below-left of [20,40]x[20,40])
    expect(
      doesDrawingIntersectRect({ points: [{ x: 0, y: 35 }, { x: 35, y: 0 }] }, rect)
    ).toBe(false);
    // Diagonal passing above-right of [20,40]x[20,40]
    expect(
      doesDrawingIntersectRect({ points: [{ x: 25, y: 60 }, { x: 60, y: 25 }] }, rect)
    ).toBe(false);
  });
});

describe("geometry/hitTest: isPointInDrawing", () => {
  it("fails closed on invalid point, drawing, or zero-dimension shapes", () => {
    expect(isPointInDrawing(null, { type: "rect" })).toBe(false);
    expect(isPointInDrawing({ x: 0, y: 0 }, null)).toBe(false);
    expect(isPointInDrawing({ x: Number.NaN, y: 0 }, { type: "rect" })).toBe(false);
    expect(isPointInDrawing({ x: 0, y: 0 }, { type: "unknown" })).toBe(false);
    expect(isPointInDrawing({ x: 0, y: 0 }, { type: "rect", w: 0, h: 10 })).toBe(false);
    expect(isPointInDrawing({ x: 0, y: 0 }, { type: "circle", w: 10, h: 0 })).toBe(false);
    expect(isPointInDrawing({ x: 0, y: 0 }, { type: "stroke", points: [] })).toBe(false);
  });

  it("tests rotated text around left-top, rotated rect around center, and rotated ellipse", () => {
    const text = { type: "text", x: 100, y: 100, text: "Test", fontSize: 20, rotation: 90 };
    expect(isPointInDrawing({ x: 90, y: 120 }, text)).toBe(true);
    expect(isPointInDrawing({ x: 120, y: 110 }, text)).toBe(false);

    const rect = { type: "rect", x: 0, y: 0, w: 100, h: 20, rotation: 90 };
    // Center is (50, 10); after 90 deg rotation, occupies x in [40, 60], y in [-40, 60]
    expect(isPointInDrawing({ x: 50, y: 50 }, rect)).toBe(true);
    expect(isPointInDrawing({ x: 10, y: 10 }, rect)).toBe(false);

    const ellipse = { type: "circle", x: 0, y: 0, w: 100, h: 40, rotation: 90 };
    // Center (50, 20), semi-axes along y=50, x=20
    expect(isPointInDrawing({ x: 50, y: 65 }, ellipse)).toBe(true);
    expect(isPointInDrawing({ x: 85, y: 20 }, ellipse)).toBe(false);
  });

  it("tests stroke points and segments with default and custom tolerance", () => {
    const dot = { type: "stroke", points: [{ x: 10, y: 10 }], width: 4 };
    // default tol = max(8, 4/2 + 7) = 9
    expect(isPointInDrawing({ x: 18, y: 10 }, dot)).toBe(true);
    expect(isPointInDrawing({ x: 25, y: 10 }, dot)).toBe(false);
    expect(isPointInDrawing({ x: 12, y: 10 }, dot, null)).toBe(true);
    expect(isPointInDrawing({ x: 12, y: 10 }, dot, { strokeTolerance: 1 })).toBe(false);

    const line = {
      type: "stroke",
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      width: 10
    };
    // default tol = max(8, 10/2 + 7) = 12
    expect(isPointInDrawing({ x: 50, y: 11 }, line)).toBe(true);
    expect(isPointInDrawing({ x: 50, y: 20 }, line)).toBe(false);
    expect(isPointInDrawing({ x: 50, y: 5 }, line, { tolerance: 4 })).toBe(false);
  });
});
