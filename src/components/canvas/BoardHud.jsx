import { useTargetSelection } from "../../contexts/TargetSelectionContext.js";
import CPButton from "../ui/CPButton.jsx";
import { BOARD_Z_LAYERS } from "./boardConstants.js";
import { useBoardToolsContext } from "./BoardToolsContext.js";

/**
 * Placa flutuante da régua (dentro da superfície transformável).
 * FUN-14: quando o cone/círculo contém tokens e a régua fica fixada ao soltar o mouse,
 * o botão "🎯 Capturar N Alvos" permanece clicável até capturar ou fechar.
 */
export function BoardMeasureBadge({
  measureLine,
  measureStats,
  tokensInsideMeasure = [],
  onCaptureTargets,
  onDismissMeasure
}) {
  if (!measureLine || !measureStats) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: `${measureStats.midX}px`,
        top: `${measureStats.midY - 22}px`,
        transform: "translate(-50%, -100%)",
        background: "rgba(1, 27, 58, 0.95)",
        border: "2.5px solid #ffcc00",
        borderRadius: "14px",
        padding: "4px 12px",
        color: "#ffffff",
        fontFamily: "var(--font-display)",
        fontSize: "14px",
        fontWeight: 800,
        whiteSpace: "nowrap",
        pointerEvents: "auto",
        boxShadow: "0 4px 12px rgba(0,0,0,0.65)",
        zIndex: BOARD_Z_LAYERS.measureBadge,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px"
      }}
    >
      <div>{measureStats.label}</div>
      {tokensInsideMeasure.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <CPButton
            variant="green"
            style={{ padding: "2px 8px", fontSize: "10px", borderRadius: "999px" }}
            onClick={(e) => {
              e.stopPropagation();
              onCaptureTargets?.(tokensInsideMeasure);
            }}
          >
            🎯 Capturar {tokensInsideMeasure.length} Alvo
            {tokensInsideMeasure.length !== 1 ? "s" : ""}
          </CPButton>
          {measureLine.locked && (
            <CPButton
              variant="orange"
              style={{ padding: "2px 6px", fontSize: "10px", borderRadius: "999px" }}
              onClick={(e) => {
                e.stopPropagation();
                onDismissMeasure?.();
              }}
              title="Fechar régua"
            >
              ✕
            </CPButton>
          )}
        </div>
      )}
    </div>
  );
}

export default function BoardHud({
  turnBlockNotice = null,
  aoeDemarcateConfig = null,
  aoePreview = null,
  onCloseAoeDemarcate,
  selectedCount = 0,
  onDeleteSelected,
  onClearSelection
}) {
  const { toolMode, measureShape, coneAngle, setMeasureShape, setConeAngle } =
    useBoardToolsContext();
  const { targetedTokens, toggleTarget, clearTargets } = useTargetSelection();

  return (
    <>
      {toolMode === "measure" && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(180deg, #02529c 0%, #012b54 100%)",
            border: "2.5px solid var(--cp-blue-border)",
            borderRadius: "999px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)",
            zIndex: BOARD_Z_LAYERS.measureToolbar,
            userSelect: "none"
          }}
        >
          <CPButton
            variant={measureShape === "line" ? "gold" : "default"}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              height: "26px",
              borderRadius: "999px"
            }}
            onClick={() => setMeasureShape("line")}
          >
            📏 Linha
          </CPButton>

          <CPButton
            variant={measureShape === "cone" ? "gold" : "default"}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              height: "26px",
              borderRadius: "999px"
            }}
            onClick={() => setMeasureShape("cone")}
          >
            📐 Cone ({coneAngle}°)
          </CPButton>

          {measureShape === "cone" && (
            <div
              style={{
                display: "flex",
                gap: "2px",
                background: "rgba(0, 27, 58, 0.6)",
                padding: "2px",
                borderRadius: "999px"
              }}
            >
              {[45, 60].map((angle) => (
                <CPButton
                  key={angle}
                  variant={coneAngle === angle ? "gold" : "default"}
                  style={{
                    padding: "2px 8px",
                    fontSize: "10px",
                    height: "22px",
                    borderRadius: "999px"
                  }}
                  onClick={() => setConeAngle(angle)}
                >
                  {angle}°
                </CPButton>
              ))}
            </div>
          )}

          <CPButton
            variant={measureShape === "circle" ? "gold" : "default"}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              height: "26px",
              borderRadius: "999px"
            }}
            onClick={() => setMeasureShape("circle")}
          >
            ⭕ Círculo
          </CPButton>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: BOARD_Z_LAYERS.hud,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          pointerEvents: "none",
          maxWidth: "92vw"
        }}
      >
        {turnBlockNotice && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              background: "rgba(185, 28, 28, 0.95)",
              border: "2px solid #fca5a5",
              borderRadius: "999px",
              padding: "5px 14px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 900,
              boxShadow: "0 6px 20px rgba(0,0,0,0.6)"
            }}
          >
            ⏳ {turnBlockNotice}
          </div>
        )}

        {aoeDemarcateConfig && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(185, 28, 28, 0.95)",
              border: "2px solid #fca5a5",
              borderRadius: "999px",
              padding: "5px 14px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              boxShadow: "0 6px 20px rgba(0,0,0,0.6)"
            }}
          >
            <span>🎯 Demarcando: {aoeDemarcateConfig.skillName || "Área"}</span>
            <span style={{ fontSize: "11px", opacity: 0.85 }}>
              ({aoePreview?.tokensInside?.length || 0} alvo
              {(aoePreview?.tokensInside?.length || 0) !== 1 ? "s" : ""} na área)
            </span>
            <CPButton
              variant="orange"
              style={{ padding: "2px 8px", fontSize: "10px", height: "22px" }}
              onClick={onCloseAoeDemarcate}
            >
              ✕ Cancelar (ESC)
            </CPButton>
          </div>
        )}

        {targetedTokens.length > 0 && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(136, 19, 55, 0.94)",
              border: "2px solid #fb7185",
              borderRadius: "999px",
              padding: "4px 10px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 900,
              boxShadow: "0 4px 16px rgba(0,0,0,0.65)",
              maxWidth: "100%",
              overflowX: "auto"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
              🎯 Alvo(s):
            </span>
            {targetedTokens.map((targetTok) => {
              const targetKey = targetTok.id || targetTok.tokenId;
              return (
                <span
                  key={targetKey}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(251, 113, 133, 0.5)",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    flexShrink: 0
                  }}
                >
                  <span>{targetTok.label || targetTok.name || "Alvo"}</span>
                  <button
                    type="button"
                    onClick={() => toggleTarget(targetKey, { multiSelect: true })}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#fecdd3",
                      cursor: "pointer",
                      fontWeight: 900,
                      fontSize: "11px",
                      padding: 0,
                      lineHeight: 1
                    }}
                    title="Remover alvo"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            {targetedTokens.length > 1 && (
              <button
                type="button"
                onClick={clearTargets}
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid #fda4af",
                  color: "#ffffff",
                  borderRadius: "999px",
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontSize: "10px",
                  fontWeight: 800,
                  marginLeft: "2px",
                  flexShrink: 0
                }}
              >
                Limpar Todos
              </button>
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(1, 27, 58, 0.94)",
              border: "2.5px solid var(--cp-blue-border)",
              borderRadius: "999px",
              padding: "6px 14px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.5)"
            }}
          >
            <span className="cp-title" style={{ fontSize: "13px", marginRight: "4px" }}>
              {selectedCount} item(ns) selecionado(s)
            </span>
            <CPButton
              variant="orange"
              style={{ padding: "4px 10px", fontSize: "12px" }}
              onClick={onDeleteSelected}
            >
              Deletar Selecionados
            </CPButton>
            <CPButton
              style={{ padding: "4px 10px", fontSize: "12px" }}
              onClick={onClearSelection}
            >
              Limpar Seleção
            </CPButton>
          </div>
        )}
      </div>
    </>
  );
}
