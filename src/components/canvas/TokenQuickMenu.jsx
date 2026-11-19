import CPButton from "../ui/CPButton.jsx";
import { BOARD_Z_LAYERS } from "./boardConstants.js";
import TokenQuickHpPopup from "./TokenQuickHpPopup.jsx";

export default function TokenQuickMenu({
  token,
  sizePx,
  isGM,
  hasHp,
  isHiddenFromPlayers,
  onQuickAdjustHp,
  onQuickToggleVisibility,
  onQuickToggleName,
  onOpenEditModal
}) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: `${sizePx + 10}px`,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "rgba(1, 21, 44, 0.94)",
        border: "2px solid var(--cp-blue-border)",
        borderRadius: "999px",
        padding: "4px 8px",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        zIndex: BOARD_Z_LAYERS.tokenQuickMenu
      }}
    >
      {hasHp && (
        <TokenQuickHpPopup token={token} onAdjustHp={onQuickAdjustHp} />
      )}

      {isGM && (
        <CPButton
          variant="epf"
          style={{ padding: "2px 8px", fontSize: "11px" }}
          onClick={() => onQuickToggleVisibility?.(token)}
        >
          {isHiddenFromPlayers ? "Revelar" : "Ocultar"}
        </CPButton>
      )}

      {onQuickToggleName && (
        <CPButton
          style={{ padding: "2px 8px", fontSize: "11px" }}
          onClick={() => onQuickToggleName(token)}
          title={token.showName === false ? "Exibir nome" : "Ocultar nome"}
        >
          {token.showName === false ? "Mostrar Nome" : "Ocultar Nome"}
        </CPButton>
      )}

      <CPButton
        variant="gold"
        style={{ padding: "2px 8px", fontSize: "11px" }}
        onClick={() => onOpenEditModal?.(token)}
      >
        Config
      </CPButton>
    </div>
  );
}
