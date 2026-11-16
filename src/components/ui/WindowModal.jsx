import { createPortal } from "react-dom";
import { Z_LAYERS } from "../../constants/zLayers";

/**
 * Janela modal padrão (overlay + painel), extraída dos estilos inline aprovados.
 *
 * Variantes (valores copiados exatamente dos inlines existentes):
 * - "light": painel branco com borda azul (#008be3) sobre overlay azul translúcido — padrão dos
 *   modais da Árvore de Fichas (criar, mover, colocar token, excluir pasta) e do Diário.
 * - "cp": classes globais `.cp-modal-overlay` + `.cp-window` — padrão dos modais de combate.
 *
 * O clique no overlay chama `onClose`; cliques no painel não propagam.
 * `portal` é opcional (padrão false) para preservar o contexto de empilhamento de quem renderiza.
 */
// A ordem das propriedades replica a dos inlines originais (HTML idêntico ao anterior).
function buildLightOverlayStyle(zIndex, overlayStyle) {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 27, 58, 0.45)",
    backdropFilter: "blur(2px)",
    zIndex,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    ...overlayStyle,
  };
}

function buildLightPanelStyle(maxWidth, panelStyle) {
  return {
    background: "#ffffff",
    border: "3px solid #008be3",
    borderRadius: "14px",
    padding: "16px",
    width: "100%",
    ...(maxWidth ? { maxWidth } : {}),
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...panelStyle,
  };
}

export default function WindowModal({
  variant = "light",
  onClose,
  zIndex = Z_LAYERS.modalBase,
  maxWidth,
  overlayStyle,
  panelStyle,
  portal = false,
  children,
}) {
  const isCp = variant === "cp";
  const widthStyle = maxWidth ? { maxWidth } : {};

  const overlay = (
    <div
      className={isCp ? "cp-modal-overlay" : undefined}
      style={isCp ? { zIndex, ...overlayStyle } : buildLightOverlayStyle(zIndex, overlayStyle)}
      onClick={onClose}
    >
      <div
        className={isCp ? "cp-window" : undefined}
        style={
          isCp
            ? { width: "100%", ...widthStyle, ...panelStyle }
            : buildLightPanelStyle(maxWidth, panelStyle)
        }
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (portal && typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
