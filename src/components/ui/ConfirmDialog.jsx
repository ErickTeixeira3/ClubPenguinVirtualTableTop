import CPButton from "./CPButton";
import WindowModal from "./WindowModal";

const ACTION_BUTTON_STYLE = { padding: "6px 12px", fontSize: "12px", width: "100%" };
const CANCEL_BUTTON_STYLE = { padding: "5px 12px", fontSize: "12px", width: "100%" };

/**
 * Diálogo de confirmação genérico (Princípio 4 + Decisão U6), baseado em WindowModal e CPButton.
 * Suporta tanto o fluxo padrão de confirmação (`onConfirm` + `confirmLabel`) quanto múltiplas
 * ações personalizadas via `actions`.
 */
export default function ConfirmDialog({
  title,
  question,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "orange",
  onConfirm,
  onCancel,
  actions = null,
  disabled = false,
  variant = "light",
  zIndex,
  maxWidth = "350px",
  overlayBackground,
  panelShadow
}) {
  const isCp = variant === "cp";
  const resolvedActions = Array.isArray(actions)
    ? actions
    : [
        {
          key: "confirm",
          label: confirmLabel,
          variant: confirmVariant,
          onClick: onConfirm,
          style: ACTION_BUTTON_STYLE,
          disabled
        }
      ];

  return (
    <WindowModal
      variant={variant}
      onClose={onCancel}
      zIndex={zIndex}
      maxWidth={maxWidth}
      overlayStyle={overlayBackground ? { background: overlayBackground } : undefined}
      panelStyle={panelShadow ? { boxShadow: panelShadow } : undefined}
    >
      <div style={{ fontSize: "15px", fontWeight: 800, color: isCp ? "#ffffff" : "#003264" }}>
        {title}
      </div>

      {question !== undefined && question !== null && question !== "" && (
        <div style={{ fontSize: "13px", fontWeight: 700, color: isCp ? "#e2e8f0" : "#1e293b" }}>
          {question}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {resolvedActions.map((action, index) => (
          <CPButton
            key={action.key ?? index}
            variant={action.variant ?? "default"}
            style={action.style ?? ACTION_BUTTON_STYLE}
            onClick={action.onClick}
            disabled={action.disabled ?? disabled}
          >
            {action.label}
          </CPButton>
        ))}

        <CPButton style={CANCEL_BUTTON_STYLE} onClick={onCancel} disabled={disabled}>
          {cancelLabel}
        </CPButton>
      </div>
    </WindowModal>
  );
}
