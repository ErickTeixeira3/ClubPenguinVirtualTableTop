import { useMemo, useRef, useState } from "react";
import {
  NOTE_TYPES,
  buildGraphData,
  getNoteTypeMeta
} from "../../engines/aliasEngine";

export default function JournalGraphWebView({
  notes = [],
  onSelectNoteToEdit,
  onOpenCharacterSheet,
  onUpdateNodePosition
}) {
  const [enabledTypes, setEnabledTypes] = useState({
    quest: true,
    location: true,
    character: true,
    lore: true,
    event: true
  });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isolateNeighborhood, setIsolateNeighborhood] = useState(false);

  // Estado de câmera (Pan & Zoom) da Teia
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  // Arraste individual de nós
  const [draggingNode, setDraggingNode] = useState(null); // { id, x, y }

  const baseGraph = useMemo(
    () => buildGraphData(notes, enabledTypes),
    [notes, enabledTypes]
  );

  // Conjunto de nós conectados ao nó selecionado
  const connectedIdsSet = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set([selectedNodeId]);
    baseGraph.edges.forEach((edge) => {
      if (edge.sourceId === selectedNodeId) set.add(edge.targetId);
      if (edge.targetId === selectedNodeId) set.add(edge.sourceId);
    });
    return set;
  }, [baseGraph.edges, selectedNodeId]);

  const visibleNodes = useMemo(() => {
    const list = baseGraph.nodes.map((n) =>
      draggingNode && draggingNode.id === n.id
        ? { ...n, x: draggingNode.x, y: draggingNode.y }
        : n
    );
    if (isolateNeighborhood && connectedIdsSet) {
      return list.filter((n) => connectedIdsSet.has(n.id));
    }
    return list;
  }, [baseGraph.nodes, draggingNode, isolateNeighborhood, connectedIdsSet]);

  const visibleNodeMap = useMemo(() => {
    const map = new Map();
    visibleNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return baseGraph.edges.filter(
      (e) => visibleNodeMap.has(e.sourceId) && visibleNodeMap.has(e.targetId)
    );
  }, [baseGraph.edges, visibleNodeMap]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return visibleNodeMap.get(selectedNodeId) || null;
  }, [selectedNodeId, visibleNodeMap]);

  const toggleType = (key) => {
    setEnabledTypes((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setCamera((prev) => ({
      ...prev,
      scale: Math.min(2.4, Math.max(0.35, Number((prev.scale * factor).toFixed(2))))
    }));
  };

  const handleSurfaceMouseDown = (e) => {
    if (e.target.closest("[data-graph-node]")) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      camX: camera.x,
      camY: camera.y
    };
  };

  const handleSurfaceMouseMove = (e) => {
    if (draggingNode) {
      const dx = (e.clientX - draggingNode.startClientX) / camera.scale;
      const dy = (e.clientY - draggingNode.startClientY) / camera.scale;
      setDraggingNode((prev) =>
        prev
          ? {
              ...prev,
              x: Math.round(prev.originX + dx),
              y: Math.round(prev.originY + dy),
              moved:
                Math.abs(dx) > 4 || Math.abs(dy) > 4 ? true : prev.moved
            }
          : null
      );
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setCamera((prev) => ({
        ...prev,
        x: panStartRef.current.camX + dx,
        y: panStartRef.current.camY + dy
      }));
    }
  };

  const handleSurfaceMouseUp = async () => {
    if (draggingNode) {
      const finished = draggingNode;
      setDraggingNode(null);
      if (finished.moved && onUpdateNodePosition) {
        await onUpdateNodePosition(finished.id, finished.x, finished.y);
      }
    }
    setIsPanning(false);
  };

  return (
    <div
      className="epf-visor"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "10px"
      }}
    >
      {/* Barra de Filtros da Teia por Categoria */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {NOTE_TYPES.map((t) => {
            const active = enabledTypes[t.key] !== false;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleType(t.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 11px",
                  borderRadius: "999px",
                  border: `2px solid ${active ? t.color : "#394b59"}`,
                  background: active ? "rgba(7, 19, 30, 0.92)" : "rgba(7, 19, 30, 0.4)",
                  color: active ? "#ffffff" : "#6c7f93",
                  fontFamily: "var(--font-epf)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: active ? t.color : "#4a5568"
                  }}
                />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {selectedNodeId && (
            <button
              type="button"
              className={`cp-btn cp-btn-epf ${
                isolateNeighborhood ? "active" : ""
              }`}
              style={{ padding: "4px 10px", fontSize: "11px" }}
              onClick={() => setIsolateNeighborhood((prev) => !prev)}
            >
              {isolateNeighborhood ? "Mostrar Todos" : "Isolar Conexões"}
            </button>
          )}

          {selectedNodeId && (
            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{ padding: "4px 10px", fontSize: "11px" }}
              onClick={() => {
                setSelectedNodeId(null);
                setIsolateNeighborhood(false);
              }}
            >
              Limpar Foco
            </button>
          )}

          <button
            type="button"
            className="cp-btn cp-btn-epf"
            style={{ padding: "4px 10px", fontSize: "11px" }}
            onClick={() => setCamera({ x: 0, y: 0, scale: 1 })}
          >
            Centralizar ({Math.round(camera.scale * 100)}%)
          </button>
        </div>
      </div>

      {/* Tela Tática Interativa da Teia */}
      <div
        className="epf-screen"
        onWheel={handleWheel}
        onMouseDown={handleSurfaceMouseDown}
        onMouseMove={handleSurfaceMouseMove}
        onMouseUp={handleSurfaceMouseUp}
        onMouseLeave={handleSurfaceMouseUp}
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          cursor: isPanning ? "grabbing" : "grab",
          backgroundImage:
            "radial-gradient(rgba(0, 240, 255, 0.14) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformOrigin: "0 0",
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`
          }}
        >
          {/* Camada SVG de Linhas (Arestas) */}
          <svg
            width="2400"
            height="1600"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              overflow: "visible",
              pointerEvents: "none"
            }}
          >
            {visibleEdges.map((edge) => {
              const source = visibleNodeMap.get(edge.sourceId);
              const target = visibleNodeMap.get(edge.targetId);
              if (!source || !target) return null;

              const isHighlighted =
                !selectedNodeId ||
                edge.sourceId === selectedNodeId ||
                edge.targetId === selectedNodeId;

              const strokeColor =
                edge.kind === "explicit" ? "#00f0ff" : "#ffcc00";

              return (
                <g key={edge.id}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.8 : 1.2}
                    strokeDasharray={edge.kind === "alias" ? "6 4" : undefined}
                    strokeOpacity={isHighlighted ? 0.9 : 0.22}
                  />
                </g>
              );
            })}
          </svg>

          {/* Camada de Nós Interativos */}
          {visibleNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isDimmed =
              connectedIdsSet && !connectedIdsSet.has(node.id);

            return (
              <div
                key={node.id}
                data-graph-node="true"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setDraggingNode({
                    id: node.id,
                    x: node.x,
                    y: node.y,
                    originX: node.x,
                    originY: node.y,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    moved: false
                  });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (onSelectNoteToEdit) {
                    onSelectNoteToEdit(node.rawNote);
                  }
                }}
                style={{
                  position: "absolute",
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: "translate(-50%, -50%)",
                  minWidth: "130px",
                  maxWidth: "190px",
                  padding: "7px 11px",
                  borderRadius: "14px",
                  background: isSelected ? "#0d2538" : "rgba(7, 19, 30, 0.92)",
                  border: `3px solid ${node.color}`,
                  boxShadow: isSelected
                    ? `0 0 16px ${node.color}`
                    : "0 4px 10px rgba(0,0,0,0.6)",
                  opacity: isDimmed ? 0.28 : 1,
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "opacity 0.15s ease"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "4px",
                    marginBottom: "2px"
                  }}
                >
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: node.color,
                      fontFamily: "var(--font-epf)"
                    }}
                  >
                    {node.typeLabel}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      color: "#90cdf4",
                      fontFamily: "var(--font-epf)"
                    }}
                  >
                    {node.scope === "gm"
                      ? "GM"
                      : node.scope === "party"
                      ? "GRUPO"
                      : "PLAYER"}
                  </span>
                </div>

                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "13px",
                    color: "#ffffff",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {node.title}
                </div>

                {node.aliases.length > 0 && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#a0aec0",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: "2px"
                    }}
                  >
                    {node.aliases.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Painel de Inspeção Rápida do Nó Selecionado */}
        {selectedNode && (
          <div
            style={{
              position: "absolute",
              right: "12px",
              bottom: "12px",
              width: "300px",
              maxHeight: "75%",
              background: "rgba(7, 19, 30, 0.96)",
              border: `2px solid ${selectedNode.color}`,
              borderRadius: "14px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              color: "#ffffff",
              overflowY: "auto",
              zIndex: 5
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: selectedNode.color,
                  fontFamily: "var(--font-epf)"
                }}
              >
                {getNoteTypeMeta(selectedNode.noteType).singular.toUpperCase()}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                {selectedNode.rawNote?.linkedCharacterSheetId &&
                  onOpenCharacterSheet && (
                    <button
                      type="button"
                      className="cp-btn cp-btn-gold"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                      onClick={() =>
                        onOpenCharacterSheet(
                          selectedNode.rawNote.linkedCharacterSheetId
                        )
                      }
                    >
                      Abrir Ficha
                    </button>
                  )}
                {onSelectNoteToEdit && (
                  <button
                    type="button"
                    className="cp-btn cp-btn-epf"
                    style={{ padding: "3px 8px", fontSize: "11px" }}
                    onClick={() => onSelectNoteToEdit(selectedNode.rawNote)}
                  >
                    Editar Card
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontWeight: 800, fontSize: "15px" }}>
              {selectedNode.title}
            </div>

            {selectedNode.aliases.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {selectedNode.aliases.map((al) => (
                  <span
                    key={al}
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "999px",
                      background: "#1a2634",
                      color: "#00f0ff",
                      fontFamily: "var(--font-epf)"
                    }}
                  >
                    {al}
                  </span>
                ))}
              </div>
            )}

            {selectedNode.rawNote?.content && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#d9e8f5",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.35,
                  marginTop: "4px"
                }}
              >
                {selectedNode.rawNote.content}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

