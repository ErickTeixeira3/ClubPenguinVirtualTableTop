// Caracterização (Fase 0 -> Fase 8): geometria de AoE, régua, rotação e hit-test.
// Migrado na Fase 8 para `src/engines/geometry/index.js` após extração da matemática inline de BoardViewport/boardConstants.
import { describe, expect, it } from "vitest";
import { METERS_PER_CELL } from "../../src/domain/constants.js";
import {
  computeAoePreview,
  computeMoveDistanceMeters,
  computeRulerStats,
  doesDrawingIntersectRect,
  isTokenInsideCircle,
  isTokenInsideCone,
  rotatePoint
} from "../../src/engines/geometry/index.js";
import { sourceContains } from "../support/sourcePin.js";

const CELL = 64;
// Token de 1 célula cujo CENTRO fica em (cx, cy).
const tokenCenteredAt = (cx, cy, sizeInCells = 1) => ({
  x: cx - (sizeInCells * CELL) / 2,
  y: cy - (sizeInCells * CELL) / 2,
  sizeInCells
});
const polar = (dist, deg) => [dist * Math.cos((deg * Math.PI) / 180), dist * Math.sin((deg * Math.PI) / 180)];

describe("isTokenInsideCircle", () => {
  it("considera o raio do token: dentro quando a distância ≤ raio da área + meia célula", () => {
    const token = tokenCenteredAt(32, 32);
    expect(isTokenInsideCircle({ token, cellSizePx: CELL, circleCenter: { x: 100, y: 32 }, radiusPx: 40 })).toBe(true);
    expect(isTokenInsideCircle({ token, cellSizePx: CELL, circleCenter: { x: 100, y: 32 }, radiusPx: 30 })).toBe(false);
  });

  it("usa o tamanho do token em células", () => {
    const big = tokenCenteredAt(64, 64, 2);
    expect(isTokenInsideCircle({ token: big, cellSizePx: CELL, circleCenter: { x: 200, y: 64 }, radiusPx: 72 })).toBe(true);
    expect(isTokenInsideCircle({ token: big, cellSizePx: CELL, circleCenter: { x: 200, y: 64 }, radiusPx: 71 })).toBe(false);
  });

  it("sem token, sem centro ou com raio ≤ 0 nada está dentro", () => {
    const token = tokenCenteredAt(0, 0);
    expect(isTokenInsideCircle({ token: null, circleCenter: { x: 0, y: 0 }, radiusPx: 10 })).toBe(false);
    expect(isTokenInsideCircle({ token, circleCenter: null, radiusPx: 10 })).toBe(false);
    expect(isTokenInsideCircle({ token, circleCenter: { x: 0, y: 0 }, radiusPx: 0 })).toBe(false);
  });
});

describe("isTokenInsideCone", () => {
  const origin = { x: 0, y: 0 };
  const cone = (token, extra = {}) =>
    isTokenInsideCone({ token, cellSizePx: CELL, coneOrigin: origin, radiusPx: 300, centerAngleRad: 0, ...extra });

  it("dentro na direção do cone e fora no ângulo reto", () => {
    expect(cone(tokenCenteredAt(200, 0))).toBe(true);
    expect(cone(tokenCenteredAt(0, 200))).toBe(false);
  });

  it("o raio angular do token alarga a abertura; 60° alcança onde 45° não alcança", () => {
    const [x, y] = polar(200, 35);
    expect(cone(tokenCenteredAt(x, y), { coneAngleDeg: 45 })).toBe(false);
    expect(cone(tokenCenteredAt(x, y), { coneAngleDeg: 60 })).toBe(true);
  });

  it("além do raio fica fora; colado ao vértice fica dentro", () => {
    expect(cone(tokenCenteredAt(340, 0))).toBe(false);
    expect(cone(tokenCenteredAt(-20, 0))).toBe(true);
  });

  it("trata a volta do ângulo em ±π", () => {
    const [x, y] = polar(200, 180 - 5);
    expect(cone(tokenCenteredAt(x, -y), { centerAngleRad: Math.PI - 0.05 })).toBe(true);
  });

  it("ângulo inválido usa 45°; raio ≤ 0 nada está dentro", () => {
    const [x, y] = polar(200, 35);
    expect(cone(tokenCenteredAt(x, y), { coneAngleDeg: 0 })).toBe(false);
    expect(cone(tokenCenteredAt(200, 0), { radiusPx: 0 })).toBe(false);
  });
});

describe("computeMoveDistanceMeters (deslocamento do Modo de Turno)", () => {
  it("converte pixels em metros com 1 célula = 1,5 m e arredonda em 2 casas", () => {
    expect(METERS_PER_CELL).toBe(1.5);
    expect(computeMoveDistanceMeters({ fromX: 0, fromY: 0, toX: 128, toY: 0, cellSizePx: CELL })).toBe(3);
    expect(computeMoveDistanceMeters({ fromX: 0, fromY: 0, toX: 64, toY: 64, cellSizePx: CELL })).toBe(2.12);
  });

  it("célula mínima de 8 px e célula inválida vira 64 px", () => {
    expect(computeMoveDistanceMeters({ toX: 16, cellSizePx: 4 })).toBe(3);
    expect(computeMoveDistanceMeters({ toX: 64, cellSizePx: 0 })).toBe(1.5);
  });
});

describe("Régua (engines/geometry via BoardViewport)", () => {
  it("BoardViewport delega a régua ao motor computeRulerStats", () => {
    expect(sourceContains("src/components/canvas/BoardViewport.jsx", "computeRulerStats({")).toBe(true);
  });

  it("mede em metros e quadrados com vírgula decimal", () => {
    expect(computeRulerStats({ startX: 0, startY: 0, endX: 192, endY: 0, cellSizePx: CELL }).label).toBe("4,5 m (3,0 q)");
    expect(computeRulerStats({ startX: 0, startY: 0, endX: 64, endY: 64, cellSizePx: CELL }).label).toBe("2,1 m (1,4 q)");
    expect(computeRulerStats({ startX: 0, startY: 0, endX: 100, endY: 0, cellSizePx: 50 }).meters).toBe(3);
  });
});

describe("Prévia de AoE (engines/geometry via useAoeDemarcation)", () => {
  it("useAoeDemarcation delega a prévia ao motor computeAoePreview", () => {
    expect(sourceContains("src/components/canvas/useAoeDemarcation.js", "computeAoePreview({")).toBe(true);
  });

  it("usa 9 m de alcance e 6 m de raio por padrão e limita o centro ao alcance", () => {
    const preview = computeAoePreview({
      aoeConfig: { aoeType: "circle" },
      origin: { x: 0, y: 0 },
      mousePos: { x: 1000, y: 0 },
      cellSizePx: CELL
    });
    expect({
      radiusPx: preview.radiusPx,
      maxRangePx: preview.maxRangePx,
      center: preview.circleCenter
    }).toEqual({ radiusPx: 256, maxRangePx: 384, center: { x: 384, y: 0 } });

    const near = computeAoePreview({
      aoeConfig: { aoeType: "circle", rangeMeters: 30 },
      origin: { x: 0, y: 0 },
      mousePos: { x: 100, y: 50 },
      cellSizePx: CELL
    });
    expect(near.circleCenter).toEqual({ x: 100, y: 50 });
  });
});

describe("engines/geometry: rotação e seleção por retângulo", () => {
  it("rotatePoint gira em torno do centro; ângulo 0 devolve o ponto", () => {
    const p = rotatePoint(10, 0, 0, 0, Math.PI / 2);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
    expect(rotatePoint(3, 4, 0, 0, 0)).toEqual({ x: 3, y: 4 });
  });

  it("formas (rect/circle, inclusive por shapeType) usam a caixa x,y,w,h", () => {
    const rect = { x: 0, y: 0, w: 50, h: 50 };
    expect(doesDrawingIntersectRect({ type: "rect", x: 40, y: 40, w: 30, h: 30 }, rect)).toBe(true);
    expect(doesDrawingIntersectRect({ shapeType: "circle", x: 60, y: 60, w: 10, h: 10 }, rect)).toBe(false);
    expect(doesDrawingIntersectRect({ type: "circle", x: -15, y: -15 }, rect)).toBe(true);
  });

  it("traços livres: algum ponto dentro do retângulo; sem pontos ou sem retângulo, não", () => {
    const rect = { x: 0, y: 0, w: 50, h: 50 };
    expect(doesDrawingIntersectRect({ points: [{ x: 100, y: 100 }, { x: 25, y: 25 }] }, rect)).toBe(true);
    expect(doesDrawingIntersectRect({ points: [{ x: 100, y: 100 }] }, rect)).toBe(false);
    expect(doesDrawingIntersectRect({ type: "stroke" }, rect)).toBe(false);
    expect(doesDrawingIntersectRect({ points: [{ x: 1, y: 1 }] }, null)).toBe(false);
  });
});
