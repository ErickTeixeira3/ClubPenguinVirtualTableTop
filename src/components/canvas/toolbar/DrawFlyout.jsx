import CPButton from "../../ui/CPButton.jsx";
import { DRAW_COLORS } from "../boardConstants.js";
import { useBoardToolsContext } from "../BoardToolsContext.js";
import ColorSwatchGrid from "../ColorSwatchGrid.jsx";
import FlyoutButton from "./FlyoutButton.jsx";

export default function DrawFlyout({ isGM = false, onRequestClearAllDrawings }) {
  const {
    toolMode,
    drawFontSize,
    shapeHasFill,
    shapeFillColor,
    drawColor,
    drawWidth,
    setToolMode,
    setDrawFontSize,
    setShapeHasFill,
    setShapeFillColor,
    setDrawColor,
    setDrawWidth,
    setOpenFlyout
  } = useBoardToolsContext();

  return (
    <div
      className="vtt-tool-flyout vtt-tool-flyout-draw"
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <FlyoutButton
        active={toolMode === "draw_pencil"}
        onClick={() => setToolMode("draw_pencil")}
      >
        ✏️ Lápis
      </FlyoutButton>

      <FlyoutButton
        active={toolMode === "draw_circle"}
        onClick={() => setToolMode("draw_circle")}
      >
        ⭕ Círculo
      </FlyoutButton>

      <FlyoutButton
        active={toolMode === "draw_rect"}
        onClick={() => setToolMode("draw_rect")}
      >
        ⬛ Quadrado
      </FlyoutButton>

      <FlyoutButton
        active={toolMode === "draw_select"}
        onClick={() => setToolMode("draw_select")}
      >
        ⬚ Selecionar Área
      </FlyoutButton>

      <FlyoutButton
        active={toolMode === "draw_text"}
        style={{
          fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif'
        }}
        onClick={() => setToolMode("draw_text")}
      >
        🔤 Texto
      </FlyoutButton>

      {toolMode === "draw_text" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "4px",
            paddingTop: "4px",
            borderTop: "1.5px solid rgba(255,255,255,0.2)"
          }}
        >
          <div style={{ display: "flex", gap: "3px", width: "100%" }}>
            {[16, 24, 32, 48].map((size) => (
              <CPButton
                key={size}
                variant={drawFontSize === size ? "gold" : "default"}
                style={{
                  flex: 1,
                  padding: "2px 5px",
                  fontSize: "11px",
                  fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif'
                }}
                onClick={() => setDrawFontSize(size)}
              >
                {size}
              </CPButton>
            ))}
          </div>
        </div>
      )}

      {(toolMode === "draw_circle" || toolMode === "draw_rect") && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            paddingTop: "6px",
            borderTop: "1.5px solid rgba(255,255,255,0.2)"
          }}
        >
          <div style={{ display: "flex", gap: "4px" }}>
            <CPButton
              variant={!shapeHasFill ? "gold" : "default"}
              style={{ flex: 1, padding: "3px 4px", fontSize: "11px" }}
              onClick={() => setShapeHasFill(false)}
            >
              Sem Fundo
            </CPButton>
            <CPButton
              variant={shapeHasFill ? "gold" : "default"}
              style={{ flex: 1, padding: "3px 4px", fontSize: "11px" }}
              onClick={() => setShapeHasFill(true)}
            >
              Com Fundo
            </CPButton>
          </div>

          {shapeHasFill && (
            <ColorSwatchGrid
              colors={DRAW_COLORS}
              selectedColor={shapeFillColor}
              onSelect={setShapeFillColor}
              shape="square"
              size={26}
              columns={4}
              keyPrefix="fill"
              ariaLabelPrefix="Cor de preenchimento"
            />
          )}
        </div>
      )}

      {toolMode !== "draw_select" && (
        <div
          style={{
            paddingTop: "4px",
            borderTop: "1.5px solid rgba(255,255,255,0.2)"
          }}
        >
          <ColorSwatchGrid
            colors={DRAW_COLORS}
            selectedColor={drawColor}
            onSelect={setDrawColor}
            shape="circle"
            size={26}
            columns={4}
            keyPrefix="stroke"
            ariaLabelPrefix="Cor do traço"
          />
        </div>
      )}

      {(toolMode === "draw_pencil" ||
        toolMode === "draw_circle" ||
        toolMode === "draw_rect") && (
        <div style={{ display: "flex", gap: "4px", paddingTop: "4px" }}>
          {[2, 4, 8].map((w) => (
            <CPButton
              key={w}
              variant={drawWidth === w ? "gold" : "default"}
              style={{ flex: 1, padding: "3px 6px", fontSize: "11px" }}
              onClick={() => setDrawWidth(w)}
            >
              {w}px
            </CPButton>
          ))}
        </div>
      )}

      {isGM && onRequestClearAllDrawings && (
        <div
          style={{
            paddingTop: "6px",
            borderTop: "1.5px solid rgba(255,255,255,0.2)"
          }}
        >
          <FlyoutButton
            variant="orange"
            onClick={() => {
              setOpenFlyout(null);
              onRequestClearAllDrawings();
            }}
          >
            Apagar Todos os Desenhos
          </FlyoutButton>
        </div>
      )}
    </div>
  );
}
