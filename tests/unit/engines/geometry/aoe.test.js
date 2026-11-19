import { describe, expect, it } from "vitest";
import {
  DEFAULT_CELL_SIZE_PX,
  SKILL_AOE_TYPES
} from "../../../../src/domain/constants.js";
import {
  computeAoePreview,
  isTokenInsideCircle,
  isTokenInsideCone
} from "../../../../src/engines/geometry/index.js";

const tokenCenteredAt = (cx, cy, sizeInCells = 1) => ({
  id: `tok_${cx}_${cy}`,
  x: cx - (sizeInCells * DEFAULT_CELL_SIZE_PX) / 2,
  y: cy - (sizeInCells * DEFAULT_CELL_SIZE_PX) / 2,
  sizeInCells
});

const polar = (dist, deg) => [
  dist * Math.cos((deg * Math.PI) / 180),
  dist * Math.sin((deg * Math.PI) / 180)
];

describe("geometry/aoe: isTokenInsideCircle", () => {
  it("fails closed on invalid inputs or unpositioned tokens", () => {
    expect(isTokenInsideCircle()).toBe(false);
    expect(isTokenInsideCircle(null)).toBe(false);
    expect(
      isTokenInsideCircle({
        token: tokenCenteredAt(0, 0),
        circleCenter: null,
        radiusPx: 40
      })
    ).toBe(false);
    expect(
      isTokenInsideCircle({
        token: tokenCenteredAt(0, 0),
        circleCenter: { x: Number.NaN, y: 0 },
        radiusPx: 40
      })
    ).toBe(false);
    expect(
      isTokenInsideCircle({
        token: tokenCenteredAt(0, 0),
        circleCenter: { x: 0, y: 0 },
        radiusPx: 0
      })
    ).toBe(false);
    expect(
      isTokenInsideCircle({
        token: tokenCenteredAt(0, 0),
        circleCenter: { x: 0, y: 0 },
        radiusPx: -10
      })
    ).toBe(false);
    expect(
      isTokenInsideCircle({
        token: { sizeInCells: 1 },
        circleCenter: { x: 32, y: 32 },
        radiusPx: 100
      })
    ).toBe(false);
  });

  it("accounts for token radius at exact boundary and multi-cell tokens", () => {
    const t1 = tokenCenteredAt(32, 32);
    expect(
      isTokenInsideCircle({
        token: t1,
        cellSizePx: 64,
        circleCenter: { x: 104, y: 32 },
        radiusPx: 40
      })
    ).toBe(true);
    expect(
      isTokenInsideCircle({
        token: t1,
        cellSizePx: 64,
        circleCenter: { x: 105, y: 32 },
        radiusPx: 40
      })
    ).toBe(false);

    const t2 = tokenCenteredAt(64, 64, 2);
    expect(
      isTokenInsideCircle({
        token: t2,
        cellSizePx: 64,
        circleCenter: { x: 200, y: 64 },
        radiusPx: 72
      })
    ).toBe(true);
    expect(
      isTokenInsideCircle({
        token: t2,
        cellSizePx: 64,
        circleCenter: { x: 200, y: 64 },
        radiusPx: 71
      })
    ).toBe(false);
  });
});

describe("geometry/aoe: isTokenInsideCone", () => {
  const origin = { x: 0, y: 0 };

  it("fails closed on invalid inputs or unpositioned tokens", () => {
    expect(isTokenInsideCone()).toBe(false);
    expect(isTokenInsideCone(null)).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(50, 0),
        coneOrigin: null,
        radiusPx: 200,
        centerAngleRad: 0
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(50, 0),
        coneOrigin: origin,
        radiusPx: 0,
        centerAngleRad: 0
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(50, 0),
        coneOrigin: origin,
        radiusPx: 200,
        centerAngleRad: Number.NaN
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: { sizeInCells: 1 },
        coneOrigin: origin,
        radiusPx: 200,
        centerAngleRad: 0
      })
    ).toBe(false);
  });

  it("checks range, vertex overlap, angular width, and ±π wraparound", () => {
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(200, 0),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0
      })
    ).toBe(true);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(0, 200),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(340, 0),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(-20, 0),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0
      })
    ).toBe(true);

    const [x, y] = polar(200, 35);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(x, y),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0,
        coneAngleDeg: 45
      })
    ).toBe(false);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(x, y),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0,
        coneAngleDeg: 60
      })
    ).toBe(true);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(x, y),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 0,
        coneAngleDeg: 0
      })
    ).toBe(false);

    const [wx, wy] = polar(200, 175);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(wx, -wy),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: Math.PI - 0.05
      })
    ).toBe(true);
    expect(
      isTokenInsideCone({
        token: tokenCenteredAt(200, 0),
        coneOrigin: origin,
        radiusPx: 300,
        centerAngleRad: 10 * Math.PI
      })
    ).toBe(true);
  });
});

describe("geometry/aoe: computeAoePreview (FUN-31)", () => {
  it("returns null on invalid params, config, or mousePos", () => {
    expect(computeAoePreview()).toBeNull();
    expect(computeAoePreview(null)).toBeNull();
    expect(computeAoePreview({ aoeConfig: null, mousePos: { x: 0, y: 0 } })).toBeNull();
    expect(computeAoePreview({ aoeConfig: {}, mousePos: null })).toBeNull();
    expect(
      computeAoePreview({ aoeConfig: {}, mousePos: { x: Number.NaN, y: 10 } })
    ).toBeNull();
  });

  it("uses canonical defaults (9m range, 6m radius), clamps circle center, and filters tokens", () => {
    const insideTok = tokenCenteredAt(400, 0);
    const outsideTok = tokenCenteredAt(900, 0);
    const corruptTok = { id: "corrupt", sizeInCells: 1 };

    const preview = computeAoePreview({
      aoeConfig: { type: SKILL_AOE_TYPES.CIRCLE },
      origin: { x: 0, y: 0 },
      mousePos: { x: 1000, y: 0 },
      tokens: [insideTok, outsideTok, corruptTok],
      cellSizePx: 64
    });

    expect(preview).toEqual({
      type: SKILL_AOE_TYPES.CIRCLE,
      origin: { x: 0, y: 0 },
      circleCenter: { x: 384, y: 0 },
      radiusPx: 256,
      radiusMeters: 6,
      maxRangePx: 384,
      rangeMeters: 9,
      tokensInside: [insideTok]
    });
  });

  it("fixes FUN-31: explicit rangeMeters === 0 clamps circleCenter to origin", () => {
    const preview = computeAoePreview({
      aoeConfig: { type: SKILL_AOE_TYPES.SINGLE, rangeMeters: 0, radiusMeters: 3 },
      origin: { x: 100, y: 200 },
      mouse: { x: 500, y: 600 },
      cellSizePx: 64
    });

    expect(preview.rangeMeters).toBe(0);
    expect(preview.maxRangePx).toBe(0);
    expect(preview.circleCenter).toEqual({ x: 100, y: 200 });
    expect(preview.radiusPx).toBe(128);
  });

  it("supports within-range mouse, omitted origin fallback, nested v2 config, legacy keys, and non-array tokens", () => {
    const nested = computeAoePreview({
      aoeConfig: {
        aoe: { type: SKILL_AOE_TYPES.CIRCLE, radiusMeters: 3 },
        range: { distanceMeters: 12 }
      },
      mousePos: { x: 100, y: 50 },
      tokens: null
    });
    expect(nested.origin).toEqual({ x: 100, y: 50 });
    expect(nested.circleCenter).toEqual({ x: 100, y: 50 });
    expect(nested.tokensInside).toEqual([]);

    const cone = computeAoePreview({
      aoeConfig: {
        aoeType: SKILL_AOE_TYPES.CONE,
        aoeRadiusMeters: 6,
        aoeConeAngleDeg: 60
      },
      origin: { x: 0, y: 0 },
      mouse: { x: 100, y: 0 },
      tokens: [tokenCenteredAt(120, 0), tokenCenteredAt(-200, 0)],
      cellSizePx: 64
    });
    expect(cone.type).toBe(SKILL_AOE_TYPES.CONE);
    expect(cone.coneAngleDeg).toBe(60);
    expect(cone.centerAngleRad).toBe(0);
    expect(cone.x1).toBeCloseTo(256 * Math.cos(-Math.PI / 6));
    expect(cone.y1).toBeCloseTo(256 * Math.sin(-Math.PI / 6));
    expect(cone.x2).toBeCloseTo(256 * Math.cos(Math.PI / 6));
    expect(cone.y2).toBeCloseTo(256 * Math.sin(Math.PI / 6));
    expect(cone.tokensInside).toHaveLength(1);
  });
});
