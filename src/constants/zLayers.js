/**
 * Escala oficial de camadas (DIRETRIZES_ARQUITETURA.md §7.2), declarada em `:root` (src/index.css).
 * Use estas referências em estilos inline (`style={{ zIndex: Z_LAYERS.modalBase }}`) em vez de
 * números soltos para camadas globais. Valores locais dentro de um mesmo contexto de empilhamento
 * (ex.: camadas internas do tabuleiro transformado) continuam numéricos.
 */
export const Z_LAYERS = Object.freeze({
  boardCanvas: "var(--z-board-canvas)",
  workspaceJournal: "var(--z-workspace-journal)",
  boardUi: "var(--z-board-ui)",
  hudBars: "var(--z-hud-bars)",
  hudPopovers: "var(--z-hud-popovers)",
  modalBase: "var(--z-modal-base)",
  modalNested: "var(--z-modal-nested)",
  modalCombat: "var(--z-modal-combat)",
  modalNoteEditor: "var(--z-modal-note-editor)",
  portalTooltip: "var(--z-portal-tooltip)",
});
