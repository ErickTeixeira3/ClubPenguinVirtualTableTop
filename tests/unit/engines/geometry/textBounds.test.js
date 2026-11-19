import { describe, expect, it } from "vitest";
import {
  TEXT_BOUNDS_CONFIG,
  getTextBounds
} from "../../../../src/engines/geometry/index.js";

describe("geometry/textBounds: TEXT_BOUNDS_CONFIG & getTextBounds (FUN-32)", () => {
  it("exports frozen unified TEXT_BOUNDS_CONFIG matching BoardViewport", () => {
    expect(Object.isFrozen(TEXT_BOUNDS_CONFIG)).toBe(true);
    expect(TEXT_BOUNDS_CONFIG).toEqual({
      charWidthFactor: 0.65,
      lineHeightFactor: 1.35,
      minWidthPx: 40,
      defaultFontSizePx: 24
    });
  });

  it("returns null for null/non-object drawings", () => {
    expect(getTextBounds(null)).toBeNull();
    expect(getTextBounds(undefined)).toBeNull();
    expect(getTextBounds("text")).toBeNull();
  });

  it("computes minWidth and single-line height for empty or short text", () => {
    const empty = getTextBounds({ x: 10, y: 20, text: "" });
    expect(empty.width).toBe(40);
    expect(empty.height).toBeCloseTo(24 * 1.35);
    expect(empty.x).toBe(10);
    expect(empty.y).toBe(20);
    expect(empty.w).toBe(40);
    expect(empty.h).toBeCloseTo(32.4);
    expect(empty.pivot).toEqual({ x: 10, y: 20 });

    const nonString = getTextBounds({ fontSize: -10 });
    expect(nonString.width).toBe(40);
    expect(nonString.height).toBeCloseTo(32.4);
  });

  it("handles multi-line \\n and \\r\\n using longest line width and line count height", () => {
    const bounds = getTextBounds({
      x: 0,
      y: 0,
      text: "Oi\r\nPinguim Guerreiro\n!",
      fontSize: 20
    });
    expect(bounds.width).toBeCloseTo(17 * 20 * 0.65);
    expect(bounds.height).toBeCloseTo(3 * 20 * 1.35);
    expect(bounds.w).toBeCloseTo(221);
    expect(bounds.h).toBeCloseTo(81);
  });

  it("rotates around left-top pivot (x, y) keeping pivot fixed across 90°, -90°, 180°, 45°", () => {
    const rot90 = getTextBounds({
      x: 100,
      y: 200,
      text: "ABCD",
      fontSize: 24,
      rotation: 90
    });
    // width = max(40, 4 * 24 * 0.65) = 62.4, height = 24 * 1.35 = 32.4
    expect(rot90.pivot).toEqual({ x: 100, y: 200 });
    expect(rot90.corners[0]).toEqual({ x: 100, y: 200 });
    expect(rot90.corners[1].x).toBeCloseTo(100);
    expect(rot90.corners[1].y).toBeCloseTo(262.4);
    expect(rot90.corners[2].x).toBeCloseTo(100 - 32.4);
    expect(rot90.corners[2].y).toBeCloseTo(262.4);
    expect(rot90.x).toBeCloseTo(67.6);
    expect(rot90.y).toBeCloseTo(200);
    expect(rot90.w).toBeCloseTo(32.4);
    expect(rot90.h).toBeCloseTo(62.4);
    expect(rot90.center.x).toBeCloseTo(100 - 16.2);
    expect(rot90.center.y).toBeCloseTo(231.2);

    const rotNeg90 = getTextBounds({
      x: 100,
      y: 200,
      text: "ABCD",
      fontSize: 24,
      rotation: -90
    });
    expect(rotNeg90.x).toBeCloseTo(100);
    expect(rotNeg90.y).toBeCloseTo(200 - 62.4);

    const rot180 = getTextBounds({
      x: 100,
      y: 200,
      text: "ABCD",
      fontSize: 24,
      rotation: 180
    });
    expect(rot180.x).toBeCloseTo(100 - 62.4);
    expect(rot180.y).toBeCloseTo(200 - 32.4);
  });
});
