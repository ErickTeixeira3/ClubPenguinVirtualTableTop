import CPButton from "../../ui/CPButton.jsx";
import { useBoardToolsContext } from "../BoardToolsContext.js";
import FlyoutButton from "./FlyoutButton.jsx";

export default function GmMapFlyout({
  fogEnabled,
  toggleFogEnabled,
  onRequestResetFogCoverAll,
  grid,
  cellSizePx,
  handleToggleGrid,
  handleToggleSnap,
  handleChangeCellSize,
  onOpenScenesManager
}) {
  const { toolMode, setToolMode, setOpenFlyout } = useBoardToolsContext();

  return (
    <div
      className="vtt-tool-flyout"
      style={{ minWidth: "200px" }}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <FlyoutButton
        variant="epf"
        active={fogEnabled}
        style={{ justifyContent: "center" }}
        onClick={() => toggleFogEnabled(!fogEnabled)}
      >
        Névoa: {fogEnabled ? "ON" : "OFF"}
      </FlyoutButton>

      <FlyoutButton
        variant="epf"
        active={toolMode === "fog_reveal"}
        style={{ justifyContent: "center" }}
        onClick={() =>
          setToolMode((m) => (m === "fog_reveal" ? "move" : "fog_reveal"))
        }
      >
        Revelar Área
      </FlyoutButton>

      <FlyoutButton
        variant="epf"
        active={toolMode === "fog_hide"}
        style={{ justifyContent: "center" }}
        onClick={() =>
          setToolMode((m) => (m === "fog_hide" ? "move" : "fog_hide"))
        }
      >
        Ocultar Área
      </FlyoutButton>

      {fogEnabled && (
        <FlyoutButton
          variant="orange"
          style={{ justifyContent: "center" }}
          onClick={() => {
            setOpenFlyout(null);
            onRequestResetFogCoverAll?.();
          }}
        >
          Cobrir Tudo
        </FlyoutButton>
      )}

      <div
        style={{
          borderTop: "1.5px solid rgba(255,255,255,0.2)",
          paddingTop: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}
      >
        <FlyoutButton
          variant="epf"
          active={grid.enabled}
          style={{ justifyContent: "center", padding: "5px 10px", fontSize: "11px" }}
          onClick={handleToggleGrid}
        >
          Grid: {grid.enabled ? "ON" : "OFF"}
        </FlyoutButton>

        <FlyoutButton
          variant="epf"
          active={grid.snapToGrid}
          style={{ justifyContent: "center", padding: "5px 10px", fontSize: "11px" }}
          onClick={handleToggleSnap}
        >
          Snap: {grid.snapToGrid ? "ON" : "LIVRE"}
        </FlyoutButton>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "4px"
          }}
        >
          <CPButton
            variant="epf"
            style={{ padding: "4px 8px", fontSize: "11px" }}
            onClick={() => handleChangeCellSize(-4)}
          >
            G-
          </CPButton>
          <span
            style={{
              fontFamily: "var(--font-epf)",
              color: "var(--epf-cyan-glow)",
              fontSize: "11px"
            }}
          >
            {cellSizePx}px
          </span>
          <CPButton
            variant="epf"
            style={{ padding: "4px 8px", fontSize: "11px" }}
            onClick={() => handleChangeCellSize(4)}
          >
            G+
          </CPButton>
        </div>

        <FlyoutButton
          variant="gold"
          style={{ justifyContent: "center" }}
          onClick={() => {
            setOpenFlyout(null);
            onOpenScenesManager?.();
          }}
        >
          Gerenciar Mapas
        </FlyoutButton>
      </div>
    </div>
  );
}
