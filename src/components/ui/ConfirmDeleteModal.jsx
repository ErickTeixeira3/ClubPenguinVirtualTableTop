import CPButton from "./CPButton";
import WindowModal from "./WindowModal";

/**
 * Confirmação de exclusão de pasta (Fichas e Diário).
 * Opções conforme Princípio 4 + decisão D-2: (a) mover os itens internos para a pasta pai,
 * (b) excluir (Soft Delete) a pasta e os itens, ou cancelar.
 * Markup e estilos idênticos aos modais inline que substitui; os pontos que variavam entre as
 * telas (z-index, largura, opacidade do overlay e sombra do painel) são parâmetros.
 */
const ACTION_BUTTON_STYLE = { padding: "6px 12px", fontSize: "12px", width: "100%" };
const CANCEL_BUTTON_STYLE = { padding: "5px 12px", fontSize: "12px", width: "100%" };

export default function ConfirmDeleteModal({
  title,
  question,
  moveLabel,
  deleteLabel,
  cancelLabel = "Cancelar",
  onMove,
  onDelete,
  onCancel,
  zIndex,
  maxWidth = "350px",
  overlayBackground,
  panelShadow,
}) {
  return (
    <WindowModal
      variant="light"
      onClose={onCancel}
      zIndex={zIndex}
      maxWidth={maxWidth}
      overlayStyle={overlayBackground ? { background: overlayBackground } : undefined}
      panelStyle={panelShadow ? { boxShadow: panelShadow } : undefined}
    >
      <div style={{ fontSize: "15px", fontWeight: 800, color: "#003264" }}>{title}</div>

      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{question}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <CPButton variant="gold" style={ACTION_BUTTON_STYLE} onClick={onMove}>
          {moveLabel}
        </CPButton>

        <CPButton variant="orange" style={ACTION_BUTTON_STYLE} onClick={onDelete}>
          {deleteLabel}
        </CPButton>

        <CPButton style={CANCEL_BUTTON_STYLE} onClick={onCancel}>
          {cancelLabel}
        </CPButton>
      </div>
    </WindowModal>
  );
}
