import { useMediaUrl } from "../../hooks/useMediaUrl";
import { BOARD_Z_LAYERS } from "./boardConstants.js";
import TokenHpBar from "./TokenHpBar.jsx";
import TokenQuickMenu from "./TokenQuickMenu.jsx";
import TokenSpeechBubble from "./TokenSpeechBubble.jsx";
import TokenStatusRing from "./TokenStatusRing.jsx";

function resolveTokenHp(token, secret = null) {
  if (secret?.hp && Number(secret.hp.max) > 0) {
    return { current: Number(secret.hp.current) || 0, max: Number(secret.hp.max) };
  }
  if (token?.bars && Number(token.bars.hpMax) > 0) {
    return {
      current: Number(token.bars.hpCurrent) || 0,
      max: Number(token.bars.hpMax)
    };
  }
  return null;
}

export default function TokenSprite({
  token,
  secret = null,
  cellSizePx,
  campaignId,
  isGM,
  canControl,
  isInteractive = true,
  isSelected,
  isTargeted = false,
  isAoeHighlighted = false,
  isAimingMode = false,
  speechBubble = null,
  onStartDrag,
  onSelect,
  onHoverToken,
  onTokenClickForTarget,
  onQuickToggleVisibility,
  onQuickToggleName,
  onQuickAdjustHp,
  onOpenEditModal
}) {
  const { url: imageUrl } = useMediaUrl(
    token.image?.mediaId ?? null,
    token.image?.url ?? null,
    campaignId
  );

  const sizePx = (token.sizeInCells || 1) * (cellSizePx || 64);
  const isHiddenFromPlayers = token.hidden === true;
  const displayName = token.label || "Token";

  const hp = resolveTokenHp(token, secret);
  const hasHp = Boolean(hp);
  const showHpBar =
    hasHp &&
    (isGM ||
      (token.bars != null && Number(token.bars.hpMax) > 0) ||
      secret?.showBarsToPlayers !== false);

  const initials = displayName.trim().slice(0, 2).toUpperCase();

  const tokenLayer = token.layer || "tokens";
  const baseZIndex =
    tokenLayer === "map"
      ? BOARD_Z_LAYERS.mapTokens
      : tokenLayer === "objects"
        ? BOARD_Z_LAYERS.objectsTokens
        : BOARD_Z_LAYERS.tokensLayer;

  return (
    <div
      data-token-id={token.id}
      onMouseEnter={() => {
        onHoverToken?.(token);
      }}
      onMouseLeave={() => {
        onHoverToken?.(null);
      }}
      onMouseDown={(e) => {
        // FUN-15: durante demarcação AoE ou mira de bola de neve, o clique deve
        // propagar até o tabuleiro mesmo sobre tokens inimigos ou não controláveis.
        if (isAimingMode) {
          return;
        }
        const handledTarget = onTokenClickForTarget?.(token, e);
        if (handledTarget) {
          e.stopPropagation();
          return;
        }
        if (!isInteractive) return;
        e.stopPropagation();
        if (isGM || canControl) {
          onSelect?.(token.id, e);
          if (e.button === 0) {
            onStartDrag?.(e, token);
          }
        }
      }}
      onDoubleClick={(e) => {
        if (!isInteractive || isAimingMode) return;
        e.stopPropagation();
        if (isGM || canControl) {
          onOpenEditModal?.(token);
        }
      }}
      style={{
        position: "absolute",
        left: `${token.x}px`,
        top: `${token.y}px`,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        zIndex: isTargeted ? baseZIndex + 4 : isSelected ? baseZIndex + 3 : baseZIndex,
        cursor: isAimingMode
          ? "crosshair"
          : !isInteractive
            ? "default"
            : canControl
              ? "grab"
              : "pointer",
        pointerEvents: "auto",
        opacity: isHiddenFromPlayers ? 0.58 : 1,
        userSelect: "none"
      }}
    >
      {isTargeted && <TokenStatusRing variant="target" />}
      {isAoeHighlighted && !isTargeted && <TokenStatusRing variant="aoe" />}

      {isSelected && (isGM || canControl) && (
        <TokenQuickMenu
          token={token}
          sizePx={sizePx}
          isGM={isGM}
          hasHp={hasHp}
          isHiddenFromPlayers={isHiddenFromPlayers}
          onQuickAdjustHp={onQuickAdjustHp}
          onQuickToggleVisibility={onQuickToggleVisibility}
          onQuickToggleName={onQuickToggleName}
          onOpenEditModal={onOpenEditModal}
        />
      )}

      {showHpBar && <TokenHpBar current={hp.current} max={hp.max} />}

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
            alt={displayName}
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

      <TokenSpeechBubble
        speechBubble={speechBubble}
        bottomOffset={showHpBar ? 20 : 10}
      />

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
          {displayName}
          {isHiddenFromPlayers && isGM ? " (OCULTO)" : ""}
        </div>
      )}
    </div>
  );
}
