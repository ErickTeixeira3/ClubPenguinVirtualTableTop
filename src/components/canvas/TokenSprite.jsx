import { useMediaUrl } from "../../hooks/useMediaUrl";
import TokenSpeechBubble from "./TokenSpeechBubble";

export default function TokenSprite({
  token,
  cellSizePx,
  campaignId,
  isGM,
  canControl,
  isInteractive = true,
  isSelected,
  speechBubble = null,
  onStartDrag,
  onSelect,
  onQuickToggleVisibility,
  onQuickToggleName,
  onQuickAdjustHp,
  onOpenEditModal
}) {
  const { url: imageUrl } = useMediaUrl(
    token.mediaId,
    token.externalUrl,
    campaignId
  );

  const sizePx = (token.sizeInCells || 1) * (cellSizePx || 64);
  const isHiddenFromPlayers = token.visibleToPlayers === false;

  const hasHp =
    token.hpCurrent !== null &&
    token.hpCurrent !== undefined &&
    token.hpMax !== null &&
    token.hpMax !== undefined &&
    Number(token.hpMax) > 0;

  const showHpBar = hasHp && (isGM || token.showBarsToPlayers !== false);
  const hpPercent = hasHp
    ? Math.max(
        0,
        Math.min(100, Math.round((Number(token.hpCurrent) / Number(token.hpMax)) * 100))
      )
    : 100;

  const initials = (token.name || "P")
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const tokenLayer = token.layer || "tokens";
  const baseZIndex =
    tokenLayer === "map" ? 2 : tokenLayer === "objects" ? 5 : 8;

  return (
    <div
      onMouseDown={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        onSelect(token.id, e);
        if (canControl && e.button === 0) {
          onStartDrag(e, token);
        }
      }}
      onDoubleClick={(e) => {
        if (!isInteractive) return;
        e.stopPropagation();
        if (isGM || canControl) {
          onOpenEditModal(token);
        }
      }}
      style={{
        position: "absolute",
        left: `${token.x}px`,
        top: `${token.y}px`,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        zIndex: isSelected ? baseZIndex + 3 : baseZIndex,
        cursor: !isInteractive
          ? "default"
          : canControl
            ? "grab"
            : "pointer",
        pointerEvents: isInteractive ? "auto" : "none",
        opacity: isHiddenFromPlayers ? 0.58 : 1,
        userSelect: "none"
      }}
    >
      {/* Menu Rápido quando o Token está Selecionado */}
      {isSelected && (isGM || canControl) && (
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
            zIndex: 25
          }}
        >
          {hasHp && (
            <>
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "2px 7px", fontSize: "11px" }}
                onClick={() => onQuickAdjustHp(token, -1)}
              >
                -1 HP
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "2px 7px", fontSize: "11px" }}
                onClick={() => onQuickAdjustHp(token, 1)}
              >
                +1 HP
              </button>
            </>
          )}

          {isGM && (
            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{ padding: "2px 8px", fontSize: "11px" }}
              onClick={() => onQuickToggleVisibility(token)}
            >
              {isHiddenFromPlayers ? "Revelar" : "Ocultar"}
            </button>
          )}

          {(isGM || canControl) && onQuickToggleName && (
            <button
              type="button"
              className="cp-btn"
              style={{ padding: "2px 8px", fontSize: "11px" }}
              onClick={() => onQuickToggleName(token)}
              title={token.showName === false ? "Exibir nome" : "Ocultar nome"}
            >
              {token.showName === false ? "Mostrar Nome" : "Ocultar Nome"}
            </button>
          )}

          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{ padding: "2px 8px", fontSize: "11px" }}
            onClick={() => onOpenEditModal(token)}
          >
            Config
          </button>
        </div>
      )}

      {/* Barra de HP no Topo do Token */}
      {showHpBar && (
        <div
          style={{
            position: "absolute",
            top: "-12px",
            left: "4%",
            width: "92%",
            height: "9px",
            background: "#1a202c",
            border: "1.5px solid #000000",
            borderRadius: "999px",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: `${hpPercent}%`,
              height: "100%",
              background:
                hpPercent > 50
                  ? "#38c172"
                  : hpPercent > 25
                    ? "#ffcc00"
                    : "#e53935",
              transition: "width 0.15s ease"
            }}
          />
        </div>
      )}

      {/* Círculo Principal do Token Estilo Pinguim / Roll20 */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `4px solid ${token.ringColor || "#3090f0"}`,
          outline: isSelected
            ? "3px solid var(--epf-cyan-glow)"
            : isHiddenFromPlayers
              ? "2px dashed var(--epf-red-classified)"
              : "2px solid #001b3a",
          background:
            "radial-gradient(circle at 35% 30%, #2d8cf0 0%, #012b54 100%)",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.65)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative"
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={token.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none"
            }}
          />
        ) : (
          <span
            className="cp-title"
            style={{
              fontSize: `${Math.max(14, Math.round(sizePx * 0.34))}px`
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Balão de Fala Estilo Club Penguin */}
      <TokenSpeechBubble
        speechBubble={speechBubble}
        bottomOffset={showHpBar ? 20 : 10}
      />

      {/* Placa de Nome na Base do Token */}
      {token.showName !== false && (
        <div
          style={{
            position: "absolute",
            top: `${sizePx + 2}px`,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0, 27, 58, 0.88)",
            border: "1.5px solid #001b3a",
            borderRadius: "999px",
            padding: "1px 8px",
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: 800,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 2px 4px rgba(0,0,0,0.45)"
          }}
        >
          {token.name}
          {isHiddenFromPlayers && isGM ? " (OCULTO)" : ""}
        </div>
      )}
    </div>
  );
}

