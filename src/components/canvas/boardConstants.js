/**
 * Fase 5: constantes e funções geométricas puras do tabuleiro, extraídas de BoardViewport.jsx
 * (conteúdo inalterado) para uso compartilhado pelos subcomponentes do tabuleiro.
 */
export const DRAW_COLORS = [
  "#ffcc00",
  "#ff2a55",
  "#00f0ff",
  "#38c172",
  "#ffffff",
  "#ff6b2b",
  "#a855f7",
  "#001b3a"
];

export const LAYER_META = {
  map: {
    key: "map",
    short: "Mapa",
    label: "Camada: Mapa & Névoa"
  },
  objects: {
    key: "objects",
    short: "Objetos",
    label: "Camada: Objetos / Obstáculos"
  },
  tokens: {
    key: "tokens",
    short: "Tokens",
    label: "Camada: Tokens (Players)"
  }
};

export function pointsToSvgPath(points = [], offsetX = 0, offsetY = 0, cx = 0, cy = 0, rotateRad = 0) {
  if (!Array.isArray(points) || points.length === 0) return "";
  const cos = rotateRad ? Math.cos(rotateRad) : 1;
  const sin = rotateRad ? Math.sin(rotateRad) : 0;

  const transformPoint = (p) => {
    let px = p.x + offsetX;
    let py = p.y + offsetY;
    if (rotateRad) {
      const ox = px - cx;
      const oy = py - cy;
      px = cx + ox * cos - oy * sin;
      py = cy + ox * sin + oy * cos;
    }
    return { x: px, y: py };
  };

  if (points.length === 1) {
    const p = transformPoint(points[0]);
    return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
  }
  return points
    .map((pt, idx) => {
      const p = transformPoint(pt);
      return `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    })
    .join(" ");
}

export function rotatePoint(px, py, cx, cy, rad) {
  if (!rad) return { x: px, y: py };
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos
  };
}

export function doesStrokeIntersectRect(stroke, rect) {
  if (!rect) return false;
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minY = rect.y;
  const maxY = rect.y + rect.h;

  if (stroke.type === "text" || typeof stroke.text === "string") {
    const tx = stroke.x || 0;
    const ty = stroke.y || 0;
    const tw = Math.max(30, (stroke.text || "").length * (stroke.fontSize || 24) * 0.6);
    const th = (stroke.fontSize || 24) * 1.3;
    return tx + tw >= minX && tx <= maxX && ty + th >= minY && ty <= maxY;
  }

  if (
    stroke.type === "circle" ||
    stroke.type === "rect" ||
    stroke.shapeType === "circle" ||
    stroke.shapeType === "rect"
  ) {
    const sx = stroke.x || 0;
    const sy = stroke.y || 0;
    const sw = stroke.w || 20;
    const sh = stroke.h || 20;
    return sx + sw >= minX && sx <= maxX && sy + sh >= minY && sy <= maxY;
  }

  if (!stroke.points) return false;
  return stroke.points.some(
    (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY
  );
}
