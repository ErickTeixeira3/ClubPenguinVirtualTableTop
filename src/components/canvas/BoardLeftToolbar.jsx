import { DRAW_COLORS, LAYER_META } from "./boardConstants";

/**
 * Fase 5: barra lateral de ferramentas do tabuleiro (Mover/Ping, Régua, Desenho, Camadas, Token,
 * Névoa/Grid e Zoom), extraída de BoardViewport.jsx com JSX inalterado.
 */
export default function BoardLeftToolbar({
  setLeftToolbarCollapsed,
  setOpenFlyout,
  leftToolbarCollapsed,
  toolMode,
  setToolMode,
  measureShape,
  openFlyout,
  setMeasureShape,
  coneAngle,
  setConeAngle,
  isDrawToolActive,
  drawFontSize,
  setDrawFontSize,
  shapeHasFill,
  setShapeHasFill,
  grid,
  setShapeFillColor,
  shapeFillColor,
  setDrawColor,
  drawColor,
  drawWidth,
  setDrawWidth,
  isGM,
  gmLayer,
  setGmLayer,
  setSelectedTokenIds,
  setSelectedStrokeIds,
  setTokenModalState,
  fogEnabled,
  toggleFogEnabled,
  resetFogCoverAll,
  handleToggleGrid,
  handleToggleSnap,
  handleChangeCellSize,
  cellSizePx,
  onOpenScenesManager,
  setZoom,
  resetCamera,
  zoom
}) {
  return (
    <>
      <aside
        className="vtt-left-toolbar"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="cp-btn"
          style={{
            width: "36px",
            height: "28px",
            padding: 0,
            fontSize: "13px"
          }}
          onClick={() => {
            setLeftToolbarCollapsed((prev) => !prev);
            setOpenFlyout(null);
          }}
        >
          {leftToolbarCollapsed ? "»" : "«"}
        </button>

        {!leftToolbarCollapsed && (
          <>
            {/* 1. Ferramenta Mover & Ping */}
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${
                  toolMode === "move" ? "active" : ""
                }`}
                onClick={() => {
                  setToolMode("move");
                  setOpenFlyout(null);
                }}
              >
                <span>✋</span>
                <span className="vtt-tool-label">Mover</span>
              </button>
            </div>

            {/* 2. Ferramenta Medir (Régua Linha, Cone e Círculo) */}
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${
                  toolMode === "measure" ? "active" : ""
                }`}
                onClick={() => {
                  setToolMode("measure");
                  setOpenFlyout((prev) => (prev === "measure" ? null : "measure"));
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

              {openFlyout === "measure" && (
                <div
                  className="vtt-tool-flyout"
                  style={{ minWidth: "185px" }}
                  onWheel={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`cp-btn ${
                      measureShape === "line" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => {
                      setMeasureShape("line");
                      setToolMode("measure");
                      setOpenFlyout(null);
                    }}
                  >
                    📏 Linha Reta
                  </button>

                  <button
                    type="button"
                    className={`cp-btn ${
                      measureShape === "cone" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => {
                      setMeasureShape("cone");
                      setToolMode("measure");
                    }}
                  >
                    📐 Cone ({coneAngle}°)
                  </button>

                  {measureShape === "cone" && (
                    <div style={{ display: "flex", gap: "4px", padding: "2px 4px" }}>
                      <button
                        type="button"
                        className={`cp-btn ${coneAngle === 45 ? "cp-btn-gold" : ""}`}
                        style={{ flex: 1, padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => setConeAngle(45)}
                      >
                        45°
                      </button>
                      <button
                        type="button"
                        className={`cp-btn ${coneAngle === 60 ? "cp-btn-gold" : ""}`}
                        style={{ flex: 1, padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => setConeAngle(60)}
                      >
                        60°
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`cp-btn ${
                      measureShape === "circle" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => {
                      setMeasureShape("circle");
                      setToolMode("measure");
                      setOpenFlyout(null);
                    }}
                  >
                    ⭕ Círculo (Raio)
                  </button>
                </div>
              )}
            </div>

            {/* 3. Ferramenta Desenhar (Lápis, Círculo, Quadrado, Selecionar, Texto) */}
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${isDrawToolActive ? "active" : ""}`}
                onClick={() => {
                  if (!isDrawToolActive) {
                    setToolMode("draw_pencil");
                  }
                  setOpenFlyout((prev) => (prev === "draw" ? null : "draw"));
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
                <div
                  className="vtt-tool-flyout vtt-tool-flyout-draw"
                  onWheel={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`cp-btn ${
                      toolMode === "draw_pencil" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => setToolMode("draw_pencil")}
                  >
                    ✏️ Lápis
                  </button>

                  <button
                    type="button"
                    className={`cp-btn ${
                      toolMode === "draw_circle" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => setToolMode("draw_circle")}
                  >
                    ⭕ Círculo
                  </button>

                  <button
                    type="button"
                    className={`cp-btn ${
                      toolMode === "draw_rect" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => setToolMode("draw_rect")}
                  >
                    ⬛ Quadrado
                  </button>

                  <button
                    type="button"
                    className={`cp-btn ${
                      toolMode === "draw_select" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px"
                    }}
                    onClick={() => setToolMode("draw_select")}
                  >
                    ⬚ Selecionar Área
                  </button>

                  <button
                    type="button"
                    className={`cp-btn ${
                      toolMode === "draw_text" ? "cp-btn-gold" : ""
                    }`}
                    style={{
                      width: "100%",
                      justifyContent: "flex-start",
                      padding: "6px 10px",
                      fontSize: "12px",
                      fontFamily:
                        '"Comic Sans MS", "Comic Sans", cursive, sans-serif'
                    }}
                    onClick={() => setToolMode("draw_text")}
                  >
                    🔤 Texto
                  </button>

                  {/* Seletor de Tamanho de Fonte (Apenas visível quando Texto estiver selecionado) */}
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
                          <button
                            key={size}
                            type="button"
                            className={`cp-btn ${
                              drawFontSize === size ? "cp-btn-gold" : ""
                            }`}
                            style={{
                              flex: 1,
                              padding: "2px 5px",
                              fontSize: "11px",
                              fontFamily:
                                '"Comic Sans MS", "Comic Sans", cursive, sans-serif'
                            }}
                            onClick={() => setDrawFontSize(size)}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configurações de Formas: Preenchimento e cores (Apenas visível para Círculo ou Quadrado) */}
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
                      {/* Alternador de Preenchimento */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className={`cp-btn ${!shapeHasFill ? "cp-btn-gold" : ""}`}
                          style={{ flex: 1, padding: "3px 4px", fontSize: "11px" }}
                          onClick={() => setShapeHasFill(false)}
                        >
                          Sem Fundo
                        </button>
                        <button
                          type="button"
                          className={`cp-btn ${shapeHasFill ? "cp-btn-gold" : ""}`}
                          style={{ flex: 1, padding: "3px 4px", fontSize: "11px" }}
                          onClick={() => setShapeHasFill(true)}
                        >
                          Com Fundo
                        </button>
                      </div>

                      {/* Paleta de Cor do Preenchimento (quando ativado) */}
                      {shapeHasFill && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(4, 1fr)",
                            gap: "5px"
                          }}
                        >
                          {DRAW_COLORS.map((c) => (
                            <button
                              key={`fill-${c}`}
                              type="button"
                              onClick={() => setShapeFillColor(c)}
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "4px",
                                background: c,
                                border:
                                  shapeFillColor === c
                                    ? "3px solid #ffffff"
                                    : "2px solid #001b3a",
                                cursor: "pointer"
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Paleta de Cor da Borda / Traço / Texto */}
                  {toolMode !== "draw_select" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "5px",
                        paddingTop: "4px",
                        borderTop: "1.5px solid rgba(255,255,255,0.2)"
                      }}
                    >
                      {DRAW_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setDrawColor(c)}
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            background: c,
                            border:
                              drawColor === c
                                ? "3px solid #ffffff"
                                : "2px solid #001b3a",
                            cursor: "pointer"
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Espessura do Traço / Borda (Visível APENAS quando lápis, círculo ou quadrado estiver selecionado) */}
                  {(toolMode === "draw_pencil" ||
                    toolMode === "draw_circle" ||
                    toolMode === "draw_rect") && (
                    <div style={{ display: "flex", gap: "4px", paddingTop: "4px" }}>
                      {[2, 4, 8].map((w) => (
                        <button
                          key={w}
                          type="button"
                          className={`cp-btn ${
                            drawWidth === w ? "cp-btn-gold" : ""
                          }`}
                          style={{
                            flex: 1,
                            padding: "3px 6px",
                            fontSize: "11px"
                          }}
                          onClick={() => setDrawWidth(w)}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. Seletor de Camadas (Exclusivo para o Mestre: Mapa, Objetos/Obstáculos, Tokens) */}
            {isGM && (
              <div className="vtt-tool-group">
                <button
                  type="button"
                  className={`vtt-tool-btn ${
                    openFlyout === "layer" ? "active" : ""
                  }`}
                  onClick={() =>
                    setOpenFlyout((prev) =>
                      prev === "layer" ? null : "layer"
                    )
                  }
                >
                  <span>🗂️</span>
                  <span className="vtt-tool-label">
                    {LAYER_META[gmLayer]?.short || "Camada"}
                  </span>
                </button>

                {openFlyout === "layer" && (
                  <div
                    className="vtt-tool-flyout"
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {Object.values(LAYER_META).map((layerItem) => (
                      <button
                        key={layerItem.key}
                        type="button"
                        className={`cp-btn ${
                          gmLayer === layerItem.key ? "cp-btn-gold" : ""
                        }`}
                        style={{
                          width: "100%",
                          justifyContent: "flex-start",
                          padding: "6px 10px",
                          fontSize: "12px"
                        }}
                        onClick={() => {
                          setGmLayer(layerItem.key);
                          setSelectedTokenIds([]);
                          setSelectedStrokeIds([]);
                          setOpenFlyout(null);
                        }}
                      >
                        {layerItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. Adicionar Token */}
            <div className="vtt-tool-group">
              <button
                type="button"
                className="vtt-tool-btn"
                onClick={() => {
                  setOpenFlyout(null);
                  setTokenModalState({ open: true, editingToken: null });
                }}
              >
                <span>➕</span>
                <span className="vtt-tool-label">Token</span>
              </button>
            </div>

            {/* 6. Controles de Névoa de Guerra & Grid (Mestre) */}
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
                  onClick={() =>
                    setOpenFlyout((prev) =>
                      prev === "gm_map" ? null : "gm_map"
                    )
                  }
                >
                  <span>🌫️</span>
                  <span className="vtt-tool-label">Névoa</span>
                </button>

                {openFlyout === "gm_map" && (
                  <div
                    className="vtt-tool-flyout"
                    style={{ minWidth: "200px" }}
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`cp-btn cp-btn-epf ${
                        fogEnabled ? "active" : ""
                      }`}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "12px"
                      }}
                      onClick={() => toggleFogEnabled(!fogEnabled)}
                    >
                      Névoa: {fogEnabled ? "ON" : "OFF"}
                    </button>

                    <button
                      type="button"
                      className={`cp-btn cp-btn-epf ${
                        toolMode === "fog_reveal" ? "active" : ""
                      }`}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "12px"
                      }}
                      onClick={() =>
                        setToolMode((m) =>
                          m === "fog_reveal" ? "move" : "fog_reveal"
                        )
                      }
                    >
                      Revelar Área
                    </button>

                    <button
                      type="button"
                      className={`cp-btn cp-btn-epf ${
                        toolMode === "fog_hide" ? "active" : ""
                      }`}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        fontSize: "12px"
                      }}
                      onClick={() =>
                        setToolMode((m) =>
                          m === "fog_hide" ? "move" : "fog_hide"
                        )
                      }
                    >
                      Ocultar Área
                    </button>

                    {fogEnabled && (
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          fontSize: "12px"
                        }}
                        onClick={resetFogCoverAll}
                      >
                        Cobrir Tudo
                      </button>
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
                      <button
                        type="button"
                        className={`cp-btn cp-btn-epf ${
                          grid.enabled ? "active" : ""
                        }`}
                        style={{
                          width: "100%",
                          padding: "5px 10px",
                          fontSize: "11px"
                        }}
                        onClick={handleToggleGrid}
                      >
                        Grid: {grid.enabled ? "ON" : "OFF"}
                      </button>

                      <button
                        type="button"
                        className={`cp-btn cp-btn-epf ${
                          grid.snapToGrid ? "active" : ""
                        }`}
                        style={{
                          width: "100%",
                          padding: "5px 10px",
                          fontSize: "11px"
                        }}
                        onClick={handleToggleSnap}
                      >
                        Snap: {grid.snapToGrid ? "ON" : "LIVRE"}
                      </button>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "4px"
                        }}
                      >
                        <button
                          type="button"
                          className="cp-btn cp-btn-epf"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleChangeCellSize(-4)}
                        >
                          G-
                        </button>
                        <span
                          style={{
                            fontFamily: "var(--font-epf)",
                            color: "var(--epf-cyan-glow)",
                            fontSize: "11px"
                          }}
                        >
                          {cellSizePx}px
                        </span>
                        <button
                          type="button"
                          className="cp-btn cp-btn-epf"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => handleChangeCellSize(4)}
                        >
                          G+
                        </button>
                      </div>

                      <button
                        type="button"
                        className="cp-btn cp-btn-gold"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          fontSize: "12px"
                        }}
                        onClick={() => {
                          setOpenFlyout(null);
                          onOpenScenesManager();
                        }}
                      >
                        Gerenciar Mapas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Controles Compactos de Zoom */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                paddingTop: "6px",
                borderTop: "2px solid rgba(255,255,255,0.2)"
              }}
            >
              <button
                type="button"
                className="cp-btn"
                style={{ width: "38px", padding: "3px 0", fontSize: "13px" }}
                onClick={() =>
                  setZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))
                }
              >
                +
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-epf"
                style={{
                  width: "42px",
                  padding: "3px 0",
                  fontSize: "10px"
                }}
                onClick={resetCamera}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className="cp-btn"
                style={{ width: "38px", padding: "3px 0", fontSize: "13px" }}
                onClick={() =>
                  setZoom((z) => Math.max(0.2, Number((z - 0.15).toFixed(2))))
                }
              >
                -
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
