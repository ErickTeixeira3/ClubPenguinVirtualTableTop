import {
  resolvePositiveNumber,
  rotatePoint,
  toFiniteNumber
} from "./coords.js";

export const TEXT_BOUNDS_CONFIG = Object.freeze({
  charWidthFactor: 0.65,
  lineHeightFactor: 1.35,
  minWidthPx: 40,
  defaultFontSizePx: 24
});

export function getTextBounds(drawing) {
  if (!drawing || typeof drawing !== "object") {
    return null;
  }

  const rawText = typeof drawing.text === "string" ? drawing.text : "";
  const lines = rawText.split(/\r?\n/);
  const maxLineLen = Math.max(...lines.map((line) => line.length));
  const lineCount = lines.length;
  const fontSize = resolvePositiveNumber(
    drawing.fontSize,
    TEXT_BOUNDS_CONFIG.defaultFontSizePx
  );
  const width = Math.max(
    TEXT_BOUNDS_CONFIG.minWidthPx,
    maxLineLen * fontSize * TEXT_BOUNDS_CONFIG.charWidthFactor
  );
  const height = lineCount * fontSize * TEXT_BOUNDS_CONFIG.lineHeightFactor;

  const px = toFiniteNumber(drawing.x, 0);
  const py = toFiniteNumber(drawing.y, 0);
  const rotationDeg = toFiniteNumber(drawing.rotation, 0);
  const rotationRad = (rotationDeg * Math.PI) / 180;

  const tl = { x: px, y: py };
  const tr = rotatePoint(px + width, py, px, py, rotationRad);
  const br = rotatePoint(px + width, py + height, px, py, rotationRad);
  const bl = rotatePoint(px, py + height, px, py, rotationRad);

  const minX = Math.min(tl.x, tr.x, br.x, bl.x);
  const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
  const minY = Math.min(tl.y, tr.y, br.y, bl.y);
  const maxY = Math.max(tl.y, tr.y, br.y, bl.y);

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    width,
    height,
    pivot: { x: px, y: py },
    center: { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 },
    rotationDeg,
    rotationRad,
    corners: [tl, tr, br, bl]
  };
}
