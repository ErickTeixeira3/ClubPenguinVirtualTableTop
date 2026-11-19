import ConfirmDialog from "./ConfirmDialog";

/**
 * Confirmação de exclusão de pasta (Fichas e Diário).
 * Opções conforme Princípio 4 + decisão D-2: (a) mover os itens internos para a pasta pai,
 * (b) excluir (Soft Delete) a pasta e os itens, ou cancelar.
 * Delega para `ConfirmDialog` mantendo marcação e estilos idênticos.
 */
const ACTION_BUTTON_STYLE = { padding: "6px 12px", fontSize: "12px", width: "100%" };

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
    <ConfirmDialog
      title={title}
      question={question}
      cancelLabel={cancelLabel}
      onCancel={onCancel}
      zIndex={zIndex}
      maxWidth={maxWidth}
      overlayBackground={overlayBackground}
      panelShadow={panelShadow}
      actions={[
        {
          key: "move",
          label: moveLabel,
          variant: "gold",
          style: ACTION_BUTTON_STYLE,
          onClick: onMove,
        },
        {
          key: "delete",
          label: deleteLabel,
          variant: "orange",
          style: ACTION_BUTTON_STYLE,
          onClick: onDelete,
        },
      ]}
    />
  );
}
