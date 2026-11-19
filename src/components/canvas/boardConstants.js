/**
 * Fase 8: constantes visuais e camadas z-index locais do tabuleiro.
 * Funções geométricas puras vivem exclusivamente em `src/engines/geometry/index.js`.
 */
export const DRAW_COLORS = Object.freeze([
  "#ffcc00",
  "#ff2a55",
  "#00f0ff",
  "#38c172",
  "#ffffff",
  "#ff6b2b",
  "#a855f7",
  "#001b3a"
]);

export const TOKEN_RING_COLORS = Object.freeze([
  "#3090f0",
  "#02529c",
  "#e53935",
  "#38c172",
  "#ffcc00",
  "#ff6b2b",
  "#8e24aa",
  "#ec407a",
  "#00bcd4",
  "#1a202c"
]);

export const LAYER_META = Object.freeze({
  map: Object.freeze({
    key: "map",
    short: "Mapa",
    label: "Camada: Mapa & Névoa"
  }),
  objects: Object.freeze({
    key: "objects",
    short: "Objetos",
    label: "Camada: Objetos / Obstáculos"
  }),
  tokens: Object.freeze({
    key: "tokens",
    short: "Tokens",
    label: "Camada: Tokens (Players)"
  })
});

export const BOARD_Z_LAYERS = Object.freeze({
  mapTokens: 2,
  mapDrawings: 3,
  grid: 4,
  objectsTokens: 5,
  objectsDrawings: 6,
  tokensDrawings: 7,
  tokensLayer: 8,
  fog: 12,
  fogDraft: 15,
  aoeTemplate: 18,
  tokenAoeReticle: 19,
  tokenTargetReticle: 20,
  pings: 21,
  interactiveOverlay: 23,
  measureBadge: 24,
  tokenQuickMenu: 25,
  measureToolbar: 25,
  inlineTextEditor: 35,
  hud: 48
});
