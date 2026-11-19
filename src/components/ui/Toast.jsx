import { Z_LAYERS } from "../../constants/zLayers";
import { useNotifications } from "../../hooks/useNotifications.js";

const TYPE_STYLES = {
  error: {
    background: "#fef2f2",
    border: "2.5px solid #dc2626",
    color: "#7f1d1d"
  },
  success: {
    background: "#f0fdf4",
    border: "2.5px solid #16a34a",
    color: "#14532d"
  },
  warning: {
    background: "#fffbeb",
    border: "2.5px solid #d97706",
    color: "#78350f"
  },
  info: {
    background: "#eff6ff",
    border: "2.5px solid #008be3",
    color: "#003264"
  }
};

export default function Toast({
  items: controlledItems = null,
  onDismiss: controlledOnDismiss = null,
  zIndex = Z_LAYERS.portalTooltip
}) {
  const { notifications, dismissNotification } = useNotifications();
  const list = Array.isArray(controlledItems) ? controlledItems : notifications;
  const handleDismiss = controlledOnDismiss || dismissNotification;

  if (!list || list.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "360px",
        width: "calc(100vw - 32px)",
        pointerEvents: "none"
      }}
    >
      {list.map((item) => {
        const tone = TYPE_STYLES[item.type] || TYPE_STYLES.info;
        return (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            style={{
              ...tone,
              borderRadius: "12px",
              padding: "10px 12px",
              boxShadow: "0 8px 20px rgba(0, 27, 58, 0.25)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "10px",
              fontSize: "13px",
              fontWeight: 800,
              pointerEvents: "auto"
            }}
          >
            <span style={{ lineHeight: 1.35, wordBreak: "break-word" }}>
              {item.message}
            </span>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => handleDismiss(item.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                fontWeight: 900,
                fontSize: "13px",
                cursor: "pointer",
                padding: "0 4px",
                lineHeight: 1,
                flexShrink: 0
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
