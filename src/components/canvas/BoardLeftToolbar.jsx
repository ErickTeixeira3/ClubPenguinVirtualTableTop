import CPButton from "../ui/CPButton.jsx";
import { LAYER_META } from "./boardConstants.js";
import { useBoardToolsContext } from "./BoardToolsContext.js";
import DrawFlyout from "./toolbar/DrawFlyout.jsx";
import GmMapFlyout from "./toolbar/GmMapFlyout.jsx";
import LayerFlyout from "./toolbar/LayerFlyout.jsx";
import MeasureFlyout from "./toolbar/MeasureFlyout.jsx";
import ZoomControls from "./toolbar/ZoomControls.jsx";

/**
 * Barra lateral de ferramentas do tabuleiro.
 * Consome `BoardToolsContext` em vez de receber dezenas de props soltas.
 */
export default function BoardLeftToolbar({
  isGM,
  fogEnabled,
  toggleFogEnabled,
  onRequestResetFogCoverAll,
  onRequestClearAllDrawings,
  grid,
  cellSizePx,
  handleToggleGrid,
  handleToggleSnap,
  handleChangeCellSize,
  onOpenScenesManager,
  onOpenNewTokenModal,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetCamera
}) {
  const {
    leftToolbarCollapsed,
    toolMode,
    measureShape,
    openFlyout,
    isDrawToolActive,
    gmLayer,
    toggleToolbarCollapsed,
    setToolMode,
    toggleFlyout,
    setOpenFlyout
  } = useBoardToolsContext();

  return (
    <aside
      className="vtt-left-toolbar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <CPButton
        style={{
          width: "36px",
          height: "28px",
          padding: 0,
          fontSize: "13px"
        }}
        onClick={toggleToolbarCollapsed}
      >
        {leftToolbarCollapsed ? "»" : "«"}
      </CPButton>

      {!leftToolbarCollapsed && (
        <>
          <div className="vtt-tool-group">
            <button
              type="button"
              className={`vtt-tool-btn ${toolMode === "move" ? "active" : ""}`}
              onClick={() => setToolMode("move", { closeFlyout: true })}
            >
              <span>✋</span>
              <span className="vtt-tool-label">Mover</span>
            </button>
          </div>

          <div className="vtt-tool-group">
            <button
              type="button"
              className={`vtt-tool-btn ${toolMode === "measure" ? "active" : ""}`}
              onClick={() => {
                setToolMode("measure");
                toggleFlyout("measure");
              }}
            >
              <span>
                {measureShape === "cone"
                  ? "📐"
                  : measureShape === "circle"
                    ? "⭕"
                    : "📏"}
              </span>
              <span className="vtt-tool-label">Medir</span>
            </button>

            {openFlyout === "measure" && <MeasureFlyout />}
          </div>

          <div className="vtt-tool-group">
            <button
              type="button"
              className={`vtt-tool-btn ${isDrawToolActive ? "active" : ""}`}
              onClick={() => {
                if (!isDrawToolActive) {
                  setToolMode("draw_pencil");
                }
                toggleFlyout("draw");
              }}
            >
              <span>
                {toolMode === "draw_select"
                  ? "⬚"
                  : toolMode === "draw_text"
                    ? "🔤"
                    : toolMode === "draw_circle"
                      ? "⭕"
                      : toolMode === "draw_rect"
                        ? "⬛"
                        : "✏️"}
              </span>
              <span className="vtt-tool-label">Desenhar</span>
            </button>

            {openFlyout === "draw" && (
              <DrawFlyout
                isGM={isGM}
                onRequestClearAllDrawings={onRequestClearAllDrawings}
              />
            )}
          </div>

          {isGM && (
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${openFlyout === "layer" ? "active" : ""}`}
                onClick={() => toggleFlyout("layer")}
              >
                <span>🗂️</span>
                <span className="vtt-tool-label">
                  {LAYER_META[gmLayer]?.short || "Camada"}
                </span>
              </button>

              {openFlyout === "layer" && <LayerFlyout />}
            </div>
          )}

          <div className="vtt-tool-group">
            <button
              type="button"
              className="vtt-tool-btn"
              onClick={() => {
                setOpenFlyout(null);
                onOpenNewTokenModal?.();
              }}
            >
              <span>➕</span>
              <span className="vtt-tool-label">Token</span>
            </button>
          </div>

          {isGM && (
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${
                  toolMode === "fog_reveal" ||
                  toolMode === "fog_hide" ||
                  openFlyout === "gm_map"
                    ? "active"
                    : ""
                }`}
                onClick={() => toggleFlyout("gm_map")}
              >
                <span>🌫️</span>
                <span className="vtt-tool-label">Névoa</span>
              </button>

              {openFlyout === "gm_map" && (
                <GmMapFlyout
                  fogEnabled={fogEnabled}
                  toggleFogEnabled={toggleFogEnabled}
                  onRequestResetFogCoverAll={onRequestResetFogCoverAll}
                  grid={grid}
                  cellSizePx={cellSizePx}
                  handleToggleGrid={handleToggleGrid}
                  handleToggleSnap={handleToggleSnap}
                  handleChangeCellSize={handleChangeCellSize}
                  onOpenScenesManager={onOpenScenesManager}
                />
              )}
            </div>
          )}

          <ZoomControls
            zoom={zoom}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onResetCamera={onResetCamera}
          />
        </>
      )}
    </aside>
  );
}
