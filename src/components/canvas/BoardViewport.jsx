import { useEffect, useMemo, useRef, useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { DEFAULT_GRID_CONFIG } from "../../hooks/useScenes";
import { useRealtimeTokens } from "../../hooks/useRealtimeTokens";
import { useFogOfWar } from "../../hooks/useFogOfWar";
import { useBoardInteractive } from "../../hooks/useBoardInteractive";
import TokenSprite from "./TokenSprite";
import FogOfWarCanvas from "./FogOfWarCanvas";
import TokenModal from "./TokenModal";

const DRAW_COLORS = [
  "#ffcc00",
  "#ff2a55",
  "#00f0ff",
  "#38c172",
  "#ffffff",
  "#ff6b2b",
  "#a855f7",
  "#001b3a"
];

const LAYER_META = {
  map: {
    key: "map",
    short: "Mapa",
    label: "Camada: Mapa & Névoa"
  },
  objects: {
    key: "objects",
    short: "Objetos",
    label: "Camada: Objetos / Obstáculos"
  },
  tokens: {
    key: "tokens",
    short: "Tokens",
    label: "Camada: Tokens (Players)"
  }
};

function pointsToSvgPath(points = [], offsetX = 0, offsetY = 0, cx = 0, cy = 0, rotateRad = 0) {
  if (!Array.isArray(points) || points.length === 0) return "";
  const cos = rotateRad ? Math.cos(rotateRad) : 1;
  const sin = rotateRad ? Math.sin(rotateRad) : 0;

  const transformPoint = (p) => {
    let px = p.x + offsetX;
    let py = p.y + offsetY;
    if (rotateRad) {
      const ox = px - cx;
      const oy = py - cy;
      px = cx + ox * cos - oy * sin;
      py = cy + ox * sin + oy * cos;
    }
    return { x: px, y: py };
  };

  if (points.length === 1) {
    const p = transformPoint(points[0]);
    return `M ${p.x} ${p.y} L ${p.x + 0.5} ${p.y + 0.5}`;
  }
  return points
    .map((pt, idx) => {
      const p = transformPoint(pt);
      return `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    })
    .join(" ");
}

function rotatePoint(px, py, cx, cy, rad) {
  if (!rad) return { x: px, y: py };
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + (px - cx) * cos - (py - cy) * sin,
    y: cy + (px - cx) * sin + (py - cy) * cos
  };
}

function doesStrokeIntersectRect(stroke, rect) {
  if (!rect) return false;
  const minX = rect.x;
  const maxX = rect.x + rect.w;
  const minY = rect.y;
  const maxY = rect.y + rect.h;

  if (stroke.type === "text" || typeof stroke.text === "string") {
    const tx = stroke.x || 0;
    const ty = stroke.y || 0;
    const tw = Math.max(30, (stroke.text || "").length * (stroke.fontSize || 24) * 0.6);
    const th = (stroke.fontSize || 24) * 1.3;
    return tx + tw >= minX && tx <= maxX && ty + th >= minY && ty <= maxY;
  }

  if (
    stroke.type === "circle" ||
    stroke.type === "rect" ||
    stroke.shapeType === "circle" ||
    stroke.shapeType === "rect"
  ) {
    const sx = stroke.x || 0;
    const sy = stroke.y || 0;
    const sw = stroke.w || 20;
    const sh = stroke.h || 20;
    return sx + sw >= minX && sx <= maxX && sy + sh >= minY && sy <= maxY;
  }

  if (!stroke.points) return false;
  return stroke.points.some(
    (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY
  );
}

export default function BoardViewport({
  activeScene,
  campaignId,
  playersMap,
  isGM,
  messages = [],
  activeCharacter = null,
  onUpdateSceneGrid,
  onOpenScenesManager,
  onSelectedTokenChange,
  snowballAimActive = false,
  onDeactivateSnowballAim
}) {
  const containerRef = useRef(null);
  const boardSurfaceRef = useRef(null);

  const sceneId = activeScene?.id || null;
  const mediaId = activeScene?.mapImage?.mediaId || null;
  const externalUrl = activeScene?.mapImage?.externalUrl || null;
  const { url: mapUrl, loading: mapLoading } = useMediaUrl(
    mediaId,
    externalUrl,
    campaignId
  );

  const {
    tokens,
    canControlToken,
    addToken,
    moveTokenRealtime,
    updateToken,
    removeToken
  } = useRealtimeTokens(sceneId);

  const {
    fogEnabled,
    fogAreas,
    toggleFogEnabled,
    addFogArea,
    resetFogCoverAll,
    isPointRevealed
  } = useFogOfWar(sceneId);

  const {
    strokes,
    textItems,
    shapes,
    activePings,
    triggerPing,
    addStroke,
    addTextItem,
    updateTextItem,
    addShape,
    deleteStrokes,
    moveDrawingItems,
    rotateDrawingItems
  } = useBoardInteractive(sceneId);

  const [zoom, setZoom] = useState(0.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [leftToolbarCollapsed, setLeftToolbarCollapsed] = useState(false);

  // Ferramenta ativa:
  // 'move' | 'measure' | 'draw_pencil' | 'draw_select' | 'draw_text' | 'draw_circle' | 'draw_rect' | 'fog_reveal' | 'fog_hide'
  const [toolMode, setToolMode] = useState("move");
  const [openFlyout, setOpenFlyout] = useState(null); // 'draw' | 'layer' | 'gm_map' | null

  // Camada ativa (Players estão sempre em 'tokens'; Mestre pode alternar 'map' | 'objects' | 'tokens')
  const [gmLayer, setGmLayer] = useState("tokens");
  const effectiveLayer = isGM ? gmLayer : "tokens";

  // Configurações de Desenho, Formas e Texto
  const [drawColor, setDrawColor] = useState("#ffcc00");
  const [drawWidth, setDrawWidth] = useState(4);
  const [drawFontSize, setDrawFontSize] = useState(24);
  const [shapeHasFill, setShapeHasFill] = useState(false);
  const [shapeFillColor, setShapeFillColor] = useState("#00f0ff");
  const [draftShape, setDraftShape] = useState(null); // { type, startX, startY, x, y, w, h }
  const draftShapeRef = useRef(null);
  const [inlineTextEditor, setInlineTextEditor] = useState(null); // { x, y, text, fontSize, color, editingId }
  const [draftStrokePoints, setDraftStrokePoints] = useState([]);
  const isDrawingRef = useRef(false);

  // Seleção e Rotação de riscos, formas e textos
  const [selectionBox, setSelectionBox] = useState(null); // { x, y, w, h }
  const selectionStartRef = useRef(null);
  const [selectedStrokeIds, setSelectedStrokeIds] = useState([]);
  const [draggingStrokesDelta, setDraggingStrokesDelta] = useState(null); // { startX, startY, dx, dy }

  const [rotatingAngle, setRotatingAngle] = useState(0); // ângulo em radianos para preview ao vivo
  const isRotatingRef = useRef(false);
  const rotationStartRef = useRef({ cx: 0, cy: 0, startAngle: 0 });

  // Medidor de distância (Régua 1 quadrado = 1,5m)
  const [measureLine, setMeasureLine] = useState(null); // { startX, startY, endX, endY }

  // Câmera Pan & Ping (em modo 'move')
  const [panningCamera, setPanningCamera] = useState(false);
  const panStartRef = useRef({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    boardX: 0,
    boardY: 0,
    moved: false,
    pingFired: false
  });
  const pingHoldTimerRef = useRef(null);

  // Seleção e arraste de Tokens (Suporte a seleção múltipla com Shift)
  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const [draggingToken, setDraggingToken] = useState(null);
  const [draggingTokensDelta, setDraggingTokensDelta] = useState(null);

  // Notifica o componente pai sobre o token prioritário selecionado
  useEffect(() => {
    if (!onSelectedTokenChange) return;
    if (selectedTokenIds.length === 0) {
      onSelectedTokenChange(null);
      return;
    }
    const lastId = selectedTokenIds[selectedTokenIds.length - 1];
    const tok = tokens.find((t) => t.id === lastId);
    onSelectedTokenChange(tok || null);
  }, [selectedTokenIds, tokens, onSelectedTokenChange]);

  const [draftFogRect, setDraftFogRect] = useState(null);
  const fogStartRef = useRef(null);

  const [tokenModalState, setTokenModalState] = useState({
    open: false,
    editingToken: null
  });

  const widthPx = activeScene?.mapImage?.widthPx || 1920;
  const heightPx = activeScene?.mapImage?.heightPx || 1080;
  const grid = {
    ...DEFAULT_GRID_CONFIG,
    ...(activeScene?.grid || {})
  };
  const cellSizePx = Math.max(16, Number(grid.cellSizePx) || 64);

  // Atalho Delete / Backspace para apagar riscos, formas, textos e tokens selecionados
  useEffect(() => {
    if (selectedStrokeIds.length === 0 && selectedTokenIds.length === 0) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedStrokeIds.length > 0) {
          deleteStrokes(selectedStrokeIds);
          setSelectedStrokeIds([]);
        }
        if (selectedTokenIds.length > 0) {
          selectedTokenIds.forEach((tokId) => {
            const tok = tokens.find((t) => t.id === tokId);
            if (tok && (isGM || canControlToken(tok))) {
              removeToken(tokId);
            }
          });
          setSelectedTokenIds([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedStrokeIds,
    selectedTokenIds,
    deleteStrokes,
    tokens,
    isGM,
    canControlToken,
    removeToken
  ]);

  // Cancela a mira de bola de neve no ESC ou clique com botão direito
  useEffect(() => {
    if (!snowballAimActive) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onDeactivateSnowballAim?.();
      }
    };
    const handleContextMenu = (e) => {
      e.preventDefault();
      onDeactivateSnowballAim?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [snowballAimActive, onDeactivateSnowballAim]);

  // Obtém o centro do token ativo ou selecionado para a origem da bola de neve
  const getSelectedTokenCenter = () => {
    if (selectedTokenIds.length > 0) {
      const lastId = selectedTokenIds[selectedTokenIds.length - 1];
      const tok = tokens.find((t) => t.id === lastId);
      if (tok) {
        const sizePx = (tok.sizeInCells || 1) * cellSizePx;
        return { x: tok.x + sizePx / 2, y: tok.y + sizePx / 2 };
      }
    }
    if (activeCharacter?.id) {
      const tok = tokens.find(
        (t) =>
          t.characterId === activeCharacter.id ||
          (t.name && t.name.trim().toLowerCase() === activeCharacter.name?.trim().toLowerCase())
      );
      if (tok) {
        const sizePx = (tok.sizeInCells || 1) * cellSizePx;
        return { x: tok.x + sizePx / 2, y: tok.y + sizePx / 2 };
      }
    }
    return null;
  };

  const getPingColor = () => {
    if (isGM) {
      if (snowballAimActive || selectedTokenIds.length > 0) {
        if (activeCharacter?.cardColor) return activeCharacter.cardColor;
        if (selectedTokenIds.length > 0) {
          const lastId = selectedTokenIds[selectedTokenIds.length - 1];
          const tok = tokens.find((t) => t.id === lastId);
          if (tok?.ringColor) return tok.ringColor;
        }
      }
      return "#00f0ff";
    }

    if (activeCharacter?.cardColor) {
      return activeCharacter.cardColor;
    }
    if (selectedTokenIds.length > 0) {
      const lastId = selectedTokenIds[selectedTokenIds.length - 1];
      const tok = tokens.find((t) => t.id === lastId);
      if (tok?.ringColor) return tok.ringColor;
    }
    return drawColor || "#008be3";
  };

  // Manipulador de clique em itens (desenhos, textos, formas, tokens) com suporte a Shift
  const handleItemClick = (e, itemId, itemType = "drawing") => {
    if (snowballAimActive && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const pt = clientToBoardCoords(e.clientX, e.clientY);
      const origin = getSelectedTokenCenter();
      triggerPing(pt.x, pt.y, getPingColor(), origin);
      onDeactivateSnowballAim?.();
      return;
    }

    const isShift = Boolean(e?.shiftKey);

    if (itemType === "drawing") {
      if (isShift) {
        setSelectedStrokeIds((prev) =>
          prev.includes(itemId)
            ? prev.filter((id) => id !== itemId)
            : [...prev, itemId]
        );
      } else {
        setSelectedStrokeIds([itemId]);
        setSelectedTokenIds([]);
      }
    } else if (itemType === "token") {
      const targetTok = tokens.find((t) => t.id === itemId);
      if (!isGM && !canControlToken(targetTok)) {
        return;
      }

      if (isShift) {
        setSelectedTokenIds((prev) =>
          prev.includes(itemId)
            ? prev.filter((id) => id !== itemId)
            : [...prev, itemId]
        );
      } else {
        setSelectedTokenIds([itemId]);
        setSelectedStrokeIds([]);
      }
    }
  };

  const clientToBoardCoords = (clientX, clientY) => {
    const surface = boardSurfaceRef.current;
    if (!surface) return { x: 0, y: 0 };
    const rect = surface.getBoundingClientRect();
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    return {
      x: Math.max(0, Math.min(widthPx, x)),
      y: Math.max(0, Math.min(heightPx, y))
    };
  };

  const snapCoordinate = (val, offset = 0, ignoreSnap = false) => {
    if (!grid.snapToGrid || ignoreSnap) {
      return Math.round(val);
    }
    const shifted = val - (Number(offset) || 0);
    const snapped = Math.round(shifted / cellSizePx) * cellSizePx;
    return Math.round(snapped + (Number(offset) || 0));
  };

  // Filtra os riscos e textos da camada ativa para seleção/borracha
  const activeLayerStrokes = useMemo(() => {
    return strokes.filter((s) => (s.layer || "tokens") === effectiveLayer);
  }, [strokes, effectiveLayer]);

  const activeLayerTexts = useMemo(() => {
    return textItems.filter((t) => (t.layer || "tokens") === effectiveLayer);
  }, [textItems, effectiveLayer]);

  const activeLayerShapes = useMemo(() => {
    return (shapes || []).filter((s) => (s.layer || "tokens") === effectiveLayer);
  }, [shapes, effectiveLayer]);

  const activeLayerItems = useMemo(() => {
    return [...activeLayerStrokes, ...activeLayerTexts, ...activeLayerShapes];
  }, [activeLayerStrokes, activeLayerTexts, activeLayerShapes]);

  // Bounding box dos riscos, textos e formas selecionados
  const selectedStrokesBounds = useMemo(() => {
    if (selectedStrokeIds.length === 0) return null;
    const selectedSet = new Set(selectedStrokeIds);
    const targetItems = activeLayerItems.filter((s) => selectedSet.has(s.id));
    if (targetItems.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    targetItems.forEach((item) => {
      if (
        item.type === "circle" ||
        item.type === "rect" ||
        item.shapeType === "circle" ||
        item.shapeType === "rect"
      ) {
        const sx = item.x || 0;
        const sy = item.y || 0;
        const sw = item.w || 20;
        const sh = item.h || 20;
        if (sx < minX) minX = sx;
        if (sy < minY) minY = sy;
        if (sx + sw > maxX) maxX = sx + sw;
        if (sy + sh > maxY) maxY = sy + sh;
      } else if (item.type === "text" || typeof item.text === "string") {
        const tx = item.x || 0;
        const ty = item.y || 0;
        const tw = Math.max(
          40,
          (item.text || "").length * (item.fontSize || 24) * 0.65
        );
        const th = (item.fontSize || 24) * 1.35;
        if (tx < minX) minX = tx;
        if (ty < minY) minY = ty;
        if (tx + tw > maxX) maxX = tx + tw;
        if (ty + th > maxY) maxY = ty + th;
      } else if (Array.isArray(item.points)) {
        item.points.forEach((pt) => {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        });
      }
    });

    if (!Number.isFinite(minX)) return null;
    const pad = 12;
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(30, maxX - minX + pad * 2),
      h: Math.max(30, maxY - minY + pad * 2)
    };
  }, [selectedStrokeIds, activeLayerItems]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) =>
      Math.min(3.0, Math.max(0.2, Number((prev + delta).toFixed(2))))
    );
  };

  const handleStartTokenDrag = (e, token) => {
    if (toolMode !== "move") return;
    const tokenLayer = token.layer || "tokens";
    if (tokenLayer !== effectiveLayer) return;

    const pt = clientToBoardCoords(e.clientX, e.clientY);
    const activeIds = selectedTokenIds.includes(token.id)
      ? selectedTokenIds
      : [token.id];

    const initialPositions = {};
    activeIds.forEach((id) => {
      const tok = tokens.find((t) => t.id === id);
      if (tok && (isGM || canControlToken(tok))) {
        initialPositions[id] = {
          x: tok.x,
          y: tok.y,
          sizeInCells: tok.sizeInCells || 1
        };
      }
    });

    setDraggingToken({
      leadId: token.id,
      startX: pt.x,
      startY: pt.y,
      initialPositions
    });
    setDraggingTokensDelta({ dx: 0, dy: 0 });
  };

  const handleSaveInlineText = async () => {
    if (!inlineTextEditor) return;
    const { text, x, y, editingId } = inlineTextEditor;
    if (!text.trim()) {
      setInlineTextEditor(null);
      return;
    }
    if (editingId) {
      await updateTextItem(editingId, {
        text: text.trim(),
        fontSize: drawFontSize,
        color: drawColor
      });
    } else {
      await addTextItem({
        layer: effectiveLayer,
        text: text.trim(),
        fontSize: drawFontSize,
        color: drawColor,
        x,
        y
      });
    }
    setInlineTextEditor(null);
  };

  const handleBoardMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    setOpenFlyout(null);

    const pt = clientToBoardCoords(e.clientX, e.clientY);

    // Se estiver no modo Mira de Bola de Neve, o clique invoca o ping imediatamente
    if (snowballAimActive && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const origin = getSelectedTokenCenter();
      triggerPing(pt.x, pt.y, getPingColor(), origin);
      onDeactivateSnowballAim?.();
      return;
    }

    // 1. Modo Medir (Régua 1,5m por quadrado)
    if (toolMode === "measure" && e.button === 0) {
      setMeasureLine({
        startX: pt.x,
        startY: pt.y,
        endX: pt.x,
        endY: pt.y
      });
      return;
    }

    // 2. Modo Desenhar: Lápis
    if (toolMode === "draw_pencil" && e.button === 0) {
      isDrawingRef.current = true;
      setDraftStrokePoints([{ x: pt.x, y: pt.y }]);
      return;
    }

    // 2.1 Modo Desenhar: Formas (Círculo ou Quadrado)
    if ((toolMode === "draw_circle" || toolMode === "draw_rect") && e.button === 0) {
      const shapeType = toolMode === "draw_circle" ? "circle" : "rect";
      draftShapeRef.current = {
        type: shapeType,
        startX: pt.x,
        startY: pt.y
      };
      setDraftShape({
        type: shapeType,
        startX: pt.x,
        startY: pt.y,
        x: pt.x,
        y: pt.y,
        w: 0,
        h: 0
      });
      return;
    }

    // 3. Modo Desenhar: Caixa de Texto Comic Sans
    if (toolMode === "draw_text" && e.button === 0) {
      setInlineTextEditor({
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        text: "",
        fontSize: drawFontSize,
        color: drawColor,
        editingId: null
      });
      return;
    }

    // 4. Modo Desenhar: Selecionar e Rotacionar Riscos / Textos
    if (toolMode === "draw_select" && e.button === 0) {
      if (selectedStrokesBounds) {
        const cx = selectedStrokesBounds.x + selectedStrokesBounds.w / 2;
        const cy = selectedStrokesBounds.y + selectedStrokesBounds.h / 2;
        const handleX = cx;
        const handleY = selectedStrokesBounds.y - 28;

        // Clique na alça de rotação (círculo ↻ acima da caixa)
        if (Math.hypot(pt.x - handleX, pt.y - handleY) <= 16) {
          isRotatingRef.current = true;
          rotationStartRef.current = {
            cx,
            cy,
            startAngle: Math.atan2(pt.y - cy, pt.x - cx)
          };
          setRotatingAngle(0);
          return;
        }

        // Clique dentro da caixa delimitadora para mover todos juntos
        if (
          pt.x >= selectedStrokesBounds.x &&
          pt.x <= selectedStrokesBounds.x + selectedStrokesBounds.w &&
          pt.y >= selectedStrokesBounds.y &&
          pt.y <= selectedStrokesBounds.y + selectedStrokesBounds.h
        ) {
          setDraggingStrokesDelta({
            startX: pt.x,
            startY: pt.y,
            dx: 0,
            dy: 0
          });
          return;
        }
      }

      if (!e.shiftKey) {
        setSelectedStrokeIds([]);
        setSelectedTokenIds([]);
      }
      selectionStartRef.current = { x: pt.x, y: pt.y };
      setSelectionBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    // 5. Névoa de Guerra (Mestre)
    if (
      isGM &&
      e.button === 0 &&
      (toolMode === "fog_reveal" || toolMode === "fog_hide")
    ) {
      const op = toolMode === "fog_reveal" ? "reveal" : "hide";
      fogStartRef.current = { x: pt.x, y: pt.y, op };
      setDraftFogRect({ x: pt.x, y: pt.y, w: 0, h: 0, op });
      return;
    }

    // 6. Modo Mover (Pan do Mapa + Ping Onda de Água + Rotação/Arraste de Itens Selecionados)
    if (toolMode === "move" && e.button === 0) {
      if (selectedStrokesBounds) {
        const cx = selectedStrokesBounds.x + selectedStrokesBounds.w / 2;
        const cy = selectedStrokesBounds.y + selectedStrokesBounds.h / 2;
        const handleX = cx;
        const handleY = selectedStrokesBounds.y - 28;

        // Clique na alça de rotação (círculo ↻ acima da caixa)
        if (Math.hypot(pt.x - handleX, pt.y - handleY) <= 16) {
          isRotatingRef.current = true;
          rotationStartRef.current = {
            cx,
            cy,
            startAngle: Math.atan2(pt.y - cy, pt.x - cx)
          };
          setRotatingAngle(0);
          return;
        }

        // Clique dentro da caixa delimitadora para mover todos os riscos juntos
        if (
          pt.x >= selectedStrokesBounds.x &&
          pt.x <= selectedStrokesBounds.x + selectedStrokesBounds.w &&
          pt.y >= selectedStrokesBounds.y &&
          pt.y <= selectedStrokesBounds.y + selectedStrokesBounds.h
        ) {
          setDraggingStrokesDelta({
            startX: pt.x,
            startY: pt.y,
            dx: 0,
            dy: 0
          });
          return;
        }
      }

      // Se clicou no fundo sem Shift, limpa as seleções
      if (!e.shiftKey) {
        setSelectedTokenIds([]);
        setSelectedStrokeIds([]);
      }
    }

    setPanningCamera(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      boardX: pt.x,
      boardY: pt.y,
      moved: false,
      pingFired: false
    };

    if (toolMode === "move" && e.button === 0) {
      if (pingHoldTimerRef.current) clearTimeout(pingHoldTimerRef.current);
      pingHoldTimerRef.current = setTimeout(() => {
        if (!panStartRef.current.moved && !panStartRef.current.pingFired) {
          panStartRef.current.pingFired = true;
          triggerPing(
            panStartRef.current.boardX,
            panStartRef.current.boardY,
            getPingColor()
          );
        }
      }, 750);
    }
  };

  const handleBoardMouseMove = (e) => {
    const pt = clientToBoardCoords(e.clientX, e.clientY);

    // 1. Rotacionando riscos e textos selecionados pelo mouse
    if (isRotatingRef.current) {
      const { cx, cy, startAngle } = rotationStartRef.current;
      const currentAngle = Math.atan2(pt.y - cy, pt.x - cx);
      const delta = currentAngle - startAngle;
      setRotatingAngle(delta);
      return;
    }

    // 2. Arrastando Token(s)
    if (draggingToken) {
      const dx = pt.x - draggingToken.startX;
      const dy = pt.y - draggingToken.startY;
      setDraggingTokensDelta({ dx, dy });
      return;
    }

    // 3. Medindo distância
    if (measureLine) {
      setMeasureLine((prev) =>
        prev ? { ...prev, endX: pt.x, endY: pt.y } : null
      );
      return;
    }

    // 4. Desenhando com Lápis
    if (isDrawingRef.current) {
      setDraftStrokePoints((prev) => {
        if (prev.length === 0) return [{ x: pt.x, y: pt.y }];
        const last = prev[prev.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3) return prev;
        return [...prev, { x: pt.x, y: pt.y }];
      });
      return;
    }

    // 4.1 Desenhando Forma (Círculo ou Quadrado)
    if (draftShapeRef.current) {
      const start = draftShapeRef.current;
      const x = Math.min(start.startX, pt.x);
      const y = Math.min(start.startY, pt.y);
      const w = Math.abs(pt.x - start.startX);
      const h = Math.abs(pt.y - start.startY);
      setDraftShape({
        type: start.type,
        startX: start.startX,
        startY: start.startY,
        x,
        y,
        w,
        h
      });
      return;
    }

    // 5. Movendo riscos e textos selecionados
    if (draggingStrokesDelta) {
      setDraggingStrokesDelta((prev) =>
        prev
          ? {
              ...prev,
              dx: pt.x - prev.startX,
              dy: pt.y - prev.startY
            }
          : null
      );
      return;
    }

    // 7. Caixa de seleção de riscos e textos
    if (selectionStartRef.current) {
      const start = selectionStartRef.current;
      const x = Math.min(start.x, pt.x);
      const y = Math.min(start.y, pt.y);
      const w = Math.abs(pt.x - start.x);
      const h = Math.abs(pt.y - start.y);
      setSelectionBox({ x, y, w, h });
      return;
    }

    // 8. Desenhando área de Névoa de Guerra
    if (fogStartRef.current) {
      const start = fogStartRef.current;
      const x = Math.min(start.x, pt.x);
      const y = Math.min(start.y, pt.y);
      const w = Math.abs(pt.x - start.x);
      const h = Math.abs(pt.y - start.y);
      setDraftFogRect({ x, y, w, h, op: start.op });
      return;
    }

    // 9. Movendo a Câmera (Pan)
    if (panningCamera) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        panStartRef.current.moved = true;
        if (pingHoldTimerRef.current) {
          clearTimeout(pingHoldTimerRef.current);
          pingHoldTimerRef.current = null;
        }
      }
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
    }
  };

  const handleBoardMouseUp = async (e) => {
    if (pingHoldTimerRef.current) {
      clearTimeout(pingHoldTimerRef.current);
      pingHoldTimerRef.current = null;
    }

    // 1. Finaliza Rotação de riscos e textos selecionados
    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      const { cx, cy } = rotationStartRef.current;
      const finalAngle = rotatingAngle;
      setRotatingAngle(0);
      if (Math.abs(finalAngle) > 0.02) {
        await rotateDrawingItems(selectedStrokeIds, cx, cy, finalAngle);
      }
    }

    // 2. Finaliza arraste de Token(s)
    if (draggingToken) {
      const ignoreSnap = Boolean(e?.altKey);
      const dx = draggingTokensDelta ? draggingTokensDelta.dx : 0;
      const dy = draggingTokensDelta ? draggingTokensDelta.dy : 0;

      Object.entries(draggingToken.initialPositions || {}).forEach(
        ([tokId, pos]) => {
          const tokenSizePx = (pos.sizeInCells || 1) * cellSizePx;
          const targetX = Math.max(
            0,
            Math.min(widthPx - tokenSizePx, pos.x + dx)
          );
          const targetY = Math.max(
            0,
            Math.min(heightPx - tokenSizePx, pos.y + dy)
          );
          const finalX = snapCoordinate(targetX, grid.offsetX, ignoreSnap);
          const finalY = snapCoordinate(targetY, grid.offsetY, ignoreSnap);
          moveTokenRealtime(tokId, finalX, finalY, true);
        }
      );

      setDraggingToken(null);
      setDraggingTokensDelta(null);
    }

    // 3. Finaliza Medição
    if (measureLine) {
      setMeasureLine(null);
    }

    // 4. Finaliza Lápis
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      const pointsToSave = draftStrokePoints;
      setDraftStrokePoints([]);
      if (pointsToSave.length >= 1) {
        await addStroke({
          layer: effectiveLayer,
          color: drawColor,
          width: drawWidth,
          points: pointsToSave
        });
      }
    }

    // 4.1 Finaliza Forma (Círculo ou Quadrado)
    if (draftShapeRef.current && draftShape) {
      const shapeToSave = draftShape;
      draftShapeRef.current = null;
      setDraftShape(null);
      if (shapeToSave.w > 4 && shapeToSave.h > 4) {
        await addShape({
          shapeType: shapeToSave.type,
          layer: effectiveLayer,
          strokeColor: drawColor,
          strokeWidth: drawWidth,
          hasFill: shapeHasFill,
          fillColor: shapeFillColor,
          x: Math.round(shapeToSave.x),
          y: Math.round(shapeToSave.y),
          w: Math.round(shapeToSave.w),
          h: Math.round(shapeToSave.h)
        });
      }
    }

    // 6. Finaliza movimento de riscos e textos selecionados
    if (draggingStrokesDelta) {
      const { dx, dy } = draggingStrokesDelta;
      setDraggingStrokesDelta(null);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        await moveDrawingItems(selectedStrokeIds, dx, dy);
      }
    }

    // 7. Finaliza Caixa de Seleção de Riscos e Textos
    if (selectionStartRef.current && selectionBox) {
      const box = selectionBox;
      selectionStartRef.current = null;
      setSelectionBox(null);

      const matched = activeLayerItems
        .filter((s) => doesStrokeIntersectRect(s, box))
        .map((s) => s.id);
      setSelectedStrokeIds(matched);
    }

    // 8. Finaliza Névoa de Guerra
    if (fogStartRef.current && draftFogRect) {
      const rectToCommit = draftFogRect;
      fogStartRef.current = null;
      setDraftFogRect(null);

      if (rectToCommit.w >= 8 && rectToCommit.h >= 8) {
        if (!fogEnabled) {
          await toggleFogEnabled(true);
        }
        await addFogArea(rectToCommit);
      }
    }

    setPanningCamera(false);
  };

  const resetCamera = () => {
    setZoom(0.75);
    setPan({ x: 0, y: 0 });
  };

  const handleToggleGrid = () => {
    if (!activeScene || !isGM) return;
    onUpdateSceneGrid(activeScene.id, {
      grid: {
        ...grid,
        enabled: !grid.enabled
      }
    });
  };

  const handleToggleSnap = () => {
    if (!activeScene || !isGM) return;
    onUpdateSceneGrid(activeScene.id, {
      grid: {
        ...grid,
        snapToGrid: !grid.snapToGrid
      }
    });
  };

  const handleChangeCellSize = (delta) => {
    if (!activeScene || !isGM) return;
    const nextSize = Math.min(200, Math.max(20, cellSizePx + delta));
    onUpdateSceneGrid(activeScene.id, {
      grid: {
        ...grid,
        cellSizePx: nextSize
      }
    });
  };

  const handleSaveTokenModal = async (tokenFormData, file) => {
    if (tokenModalState.editingToken) {
      await updateToken(
        tokenModalState.editingToken.id,
        tokenFormData,
        file
      );
    } else {
      const centerX = snapCoordinate(
        widthPx / 2 - cellSizePx / 2,
        grid.offsetX
      );
      const centerY = snapCoordinate(
        heightPx / 2 - cellSizePx / 2,
        grid.offsetY
      );
      await addToken({
        ...tokenFormData,
        layer: tokenFormData.layer || effectiveLayer,
        file,
        x: centerX,
        y: centerY
      });
    }
  };

  const handleQuickToggleTokenVisibility = async (token) => {
    if (!isGM) return;
    await updateToken(token.id, {
      visibleToPlayers: token.visibleToPlayers === false
    });
  };

  const handleQuickToggleTokenName = async (token) => {
    await updateToken(token.id, {
      showName: token.showName === false
    });
  };

  const handleQuickAdjustHp = async (token, delta) => {
    const current = Number(token.hpCurrent) || 0;
    const max = Number(token.hpMax) || current;
    const nextHp = Math.max(0, Math.min(max, current + delta));
    await updateToken(token.id, { hpCurrent: nextHp });
  };

  // Mapeia a última fala ou emote/skill de cada personagem/token para o balão estilo Club Penguin
  const latestSpeeches = useMemo(() => {
    if (!messages || messages.length === 0) return { byCharId: {}, byName: {} };
    const byCharId = {};
    const byName = {};

    for (const msg of messages) {
      const icon = msg.icon || msg.rollData?.icon || null;
      const isText = msg.type === "text" && Boolean(msg.content && msg.content.trim());
      const isEmote = msg.type === "emote" && Boolean(icon);
      const isAbilityWithIcon = msg.type === "ability_roll" && Boolean(icon);

      if (!isText && !isEmote && !isAbilityWithIcon) continue;

      const speechData = {
        id: msg.id,
        text: (isEmote || isAbilityWithIcon) ? null : msg.content,
        icon: (isEmote || isAbilityWithIcon) ? icon : null,
        timestampMs: msg.timestampMs || 0
      };

      if (msg.characterId) {
        byCharId[msg.characterId] = speechData;
      }
      if (msg.senderName) {
        byName[msg.senderName.trim().toLowerCase()] = speechData;
      }
    }

    return { byCharId, byName };
  }, [messages]);

  const getTokenSpeech = (token) => {
    if (!token) return null;
    if (token.characterId && latestSpeeches.byCharId[token.characterId]) {
      return latestSpeeches.byCharId[token.characterId];
    }
    if (token.name && latestSpeeches.byName[token.name.trim().toLowerCase()]) {
      return latestSpeeches.byName[token.name.trim().toLowerCase()];
    }
    return null;
  };

  if (!activeScene) {
    return (
      <div
        className={isGM ? "epf-visor" : "cp-window"}
        style={{ minWidth: "340px", textAlign: "center", zIndex: 10 }}
      >
        <div
          className={isGM ? "epf-screen" : "cp-window-inner"}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "17px" }}>
            NENHUM MAPA ATIVO NO TABULEIRO
          </div>
          {isGM && (
            <button
              type="button"
              className="cp-btn cp-btn-gold"
              onClick={onOpenScenesManager}
            >
              Selecionar ou Criar Mapa
            </button>
          )}
        </div>
      </div>
    );
  }

  const patternId = `vtt-grid-${activeScene.id}`;

  // Filtra tokens visíveis e aplica posição de arraste
  const renderedTokens = tokens
    .map((t) => {
      if (draggingToken && draggingToken.initialPositions?.[t.id]) {
        const dx = draggingTokensDelta ? draggingTokensDelta.dx : 0;
        const dy = draggingTokensDelta ? draggingTokensDelta.dy : 0;
        const pos = draggingToken.initialPositions[t.id];
        const tokenSizePx = (pos.sizeInCells || 1) * cellSizePx;
        return {
          ...t,
          x: Math.max(0, Math.min(widthPx - tokenSizePx, pos.x + dx)),
          y: Math.max(0, Math.min(heightPx - tokenSizePx, pos.y + dy))
        };
      }
      return t;
    })
    .filter((t) => {
      if (isGM || !fogEnabled) return true;
      const sizePx = (t.sizeInCells || 1) * cellSizePx;
      const centerX = t.x + sizePx / 2;
      const centerY = t.y + sizePx / 2;
      return isPointRevealed(centerX, centerY);
    });

  const mapLayerTokens = renderedTokens.filter(
    (t) => (t.layer || "tokens") === "map"
  );
  const objectsLayerTokens = renderedTokens.filter(
    (t) => (t.layer || "tokens") === "objects"
  );
  const tokensLayerTokens = renderedTokens.filter(
    (t) => (t.layer || "tokens") === "tokens"
  );

  const mapLayerStrokes = strokes.filter((s) => (s.layer || "tokens") === "map");
  const objectsLayerStrokes = strokes.filter(
    (s) => (s.layer || "tokens") === "objects"
  );
  const tokensLayerStrokes = strokes.filter(
    (s) => (s.layer || "tokens") === "tokens"
  );

  const mapLayerTexts = textItems.filter((t) => (t.layer || "tokens") === "map");
  const objectsLayerTexts = textItems.filter(
    (t) => (t.layer || "tokens") === "objects"
  );
  const tokensLayerTexts = textItems.filter(
    (t) => (t.layer || "tokens") === "tokens"
  );

  const allShapes = shapes || [];
  const mapLayerShapes = allShapes.filter((s) => (s.layer || "tokens") === "map");
  const objectsLayerShapes = allShapes.filter(
    (s) => (s.layer || "tokens") === "objects"
  );
  const tokensLayerShapes = allShapes.filter(
    (s) => (s.layer || "tokens") === "tokens"
  );

  const selectedStrokeSet = new Set(selectedStrokeIds);

  const renderShapeSvgLayer = (layerShapes, zIndex, layerKey) => {
    const cx = selectedStrokesBounds
      ? selectedStrokesBounds.x + selectedStrokesBounds.w / 2
      : 0;
    const cy = selectedStrokesBounds
      ? selectedStrokesBounds.y + selectedStrokesBounds.h / 2
      : 0;

    const isInteractiveMode = toolMode === "move" || toolMode === "draw_select";

    return (
      <svg
        width={widthPx}
        height={heightPx}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex
        }}
      >
        {layerShapes.map((s) => {
          const isSelected =
            layerKey === effectiveLayer && selectedStrokeSet.has(s.id);
          const offsetX =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dx : 0;
          const offsetY =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dy : 0;

          const baseRot = Number(s.rotation) || 0;
          let shapeCenterX = (s.x || 0) + (s.w || 20) / 2 + offsetX;
          let shapeCenterY = (s.y || 0) + (s.h || 20) / 2 + offsetY;
          let totalRotDeg = baseRot;

          if (isSelected && rotatingAngle && selectedStrokesBounds) {
            const rp = rotatePoint(shapeCenterX, shapeCenterY, cx, cy, rotatingAngle);
            shapeCenterX = rp.x;
            shapeCenterY = rp.y;
            totalRotDeg += (rotatingAngle * 180) / Math.PI;
          }

          const drawX = shapeCenterX - (s.w || 20) / 2;
          const drawY = shapeCenterY - (s.h || 20) / 2;
          const strokeCol = s.strokeColor || s.color || "#ffcc00";
          const strokeW = Number(s.strokeWidth || s.width) || 4;
          const fillCol = s.hasFill ? (s.fillColor || "#00f0ff") : "none";
          const transform = totalRotDeg
            ? `rotate(${totalRotDeg} ${shapeCenterX} ${shapeCenterY})`
            : undefined;

          const isCircle =
            s.type === "circle" ||
            s.shapeType === "circle";

          return (
            <g
              key={s.id}
              transform={transform}
              style={{
                cursor: isInteractiveMode ? "pointer" : "default"
              }}
              onMouseDown={(e) => {
                if (isInteractiveMode && e.button === 0) {
                  e.stopPropagation();
                  handleItemClick(e, s.id, "drawing");
                }
              }}
            >
              {/* Área invisível ampla de hit-test para captura imediata de cliques com a mão */}
              {isCircle ? (
                <ellipse
                  cx={shapeCenterX}
                  cy={shapeCenterY}
                  rx={(s.w || 20) / 2}
                  ry={(s.h || 20) / 2}
                  fill="rgba(0,0,0,0.001)"
                  stroke="transparent"
                  strokeWidth={strokeW + 14}
                  style={{ pointerEvents: isInteractiveMode ? "all" : "none" }}
                />
              ) : (
                <rect
                  x={drawX}
                  y={drawY}
                  width={s.w || 20}
                  height={s.h || 20}
                  fill="rgba(0,0,0,0.001)"
                  stroke="transparent"
                  strokeWidth={strokeW + 14}
                  style={{ pointerEvents: isInteractiveMode ? "all" : "none" }}
                />
              )}

              {isSelected && (
                isCircle ? (
                  <ellipse
                    cx={shapeCenterX}
                    cy={shapeCenterY}
                    rx={(s.w || 20) / 2}
                    ry={(s.h || 20) / 2}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth={strokeW + 6}
                    strokeOpacity={0.55}
                    style={{ pointerEvents: "none" }}
                  />
                ) : (
                  <rect
                    x={drawX}
                    y={drawY}
                    width={s.w || 20}
                    height={s.h || 20}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth={strokeW + 6}
                    strokeOpacity={0.55}
                    style={{ pointerEvents: "none" }}
                  />
                )
              )}
              {isCircle ? (
                <ellipse
                  cx={shapeCenterX}
                  cy={shapeCenterY}
                  rx={(s.w || 20) / 2}
                  ry={(s.h || 20) / 2}
                  fill={fillCol}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                  style={{ pointerEvents: isInteractiveMode ? "all" : "none" }}
                />
              ) : (
                <rect
                  x={drawX}
                  y={drawY}
                  width={s.w || 20}
                  height={s.h || 20}
                  fill={fillCol}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                  style={{ pointerEvents: isInteractiveMode ? "all" : "none" }}
                />
              )}
            </g>
          );
        })}

        {/* Live preview durante o arraste da forma */}
        {layerKey === effectiveLayer && draftShape && (
          draftShape.type === "circle" ? (
            <ellipse
              cx={draftShape.x + draftShape.w / 2}
              cy={draftShape.y + draftShape.h / 2}
              rx={draftShape.w / 2}
              ry={draftShape.h / 2}
              fill={shapeHasFill ? shapeFillColor : "none"}
              stroke={drawColor}
              strokeWidth={drawWidth}
            />
          ) : (
            <rect
              x={draftShape.x}
              y={draftShape.y}
              width={draftShape.w}
              height={draftShape.h}
              fill={shapeHasFill ? shapeFillColor : "none"}
              stroke={drawColor}
              strokeWidth={drawWidth}
            />
          )
        )}
      </svg>
    );
  };

  const renderStrokeSvgLayer = (layerStrokes, zIndex, layerKey) => {
    const cx = selectedStrokesBounds
      ? selectedStrokesBounds.x + selectedStrokesBounds.w / 2
      : 0;
    const cy = selectedStrokesBounds
      ? selectedStrokesBounds.y + selectedStrokesBounds.h / 2
      : 0;

    const isInteractiveMode = toolMode === "move" || toolMode === "draw_select";

    return (
      <svg
        width={widthPx}
        height={heightPx}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex
        }}
      >
        {layerStrokes.map((s) => {
          const isSelected =
            layerKey === effectiveLayer && selectedStrokeSet.has(s.id);
          const offsetX =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dx : 0;
          const offsetY =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dy : 0;
          const rotAngle = isSelected ? rotatingAngle : 0;

          return (
            <g
              key={s.id}
              style={{
                cursor: isInteractiveMode ? "pointer" : "default"
              }}
              onMouseDown={(e) => {
                if (isInteractiveMode && e.button === 0) {
                  e.stopPropagation();
                  handleItemClick(e, s.id, "drawing");
                }
              }}
            >
              {/* Hit-test transparente amplo (16px) para facilitar clique em riscos com o mouse */}
              <path
                d={pointsToSvgPath(
                  s.points,
                  offsetX,
                  offsetY,
                  cx,
                  cy,
                  rotAngle
                )}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, (Number(s.width) || 4) + 14)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  pointerEvents: isInteractiveMode ? "stroke" : "none"
                }}
              />
              {isSelected && (
                <path
                  d={pointsToSvgPath(
                    s.points,
                    offsetX,
                    offsetY,
                    cx,
                    cy,
                    rotAngle
                  )}
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth={(Number(s.width) || 4) + 6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.55}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <path
                d={pointsToSvgPath(
                  s.points,
                  offsetX,
                  offsetY,
                  cx,
                  cy,
                  rotAngle
                )}
                fill="none"
                stroke={s.color || "#ffcc00"}
                strokeWidth={Number(s.width) || 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  pointerEvents: isInteractiveMode ? "stroke" : "none"
                }}
              />
            </g>
          );
        })}

        {layerKey === effectiveLayer && draftStrokePoints.length > 0 && (
          <path
            d={pointsToSvgPath(draftStrokePoints)}
            fill="none"
            stroke={drawColor}
            strokeWidth={drawWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  };

  const renderTextLayer = (layerTexts, zIndex, layerKey) => {
    const cx = selectedStrokesBounds
      ? selectedStrokesBounds.x + selectedStrokesBounds.w / 2
      : 0;
    const cy = selectedStrokesBounds
      ? selectedStrokesBounds.y + selectedStrokesBounds.h / 2
      : 0;

    const isInteractiveMode = toolMode === "move" || toolMode === "draw_select";

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex
        }}
      >
        {layerTexts.map((item) => {
          const isSelected =
            layerKey === effectiveLayer && selectedStrokeSet.has(item.id);
          const offsetX =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dx : 0;
          const offsetY =
            isSelected && draggingStrokesDelta ? draggingStrokesDelta.dy : 0;

          let posX = (item.x || 0) + offsetX;
          let posY = (item.y || 0) + offsetY;
          let rotDeg = Number(item.rotation) || 0;

          if (isSelected && rotatingAngle && selectedStrokesBounds) {
            const rp = rotatePoint(posX, posY, cx, cy, rotatingAngle);
            posX = rp.x;
            posY = rp.y;
            rotDeg += (rotatingAngle * 180) / Math.PI;
          }

          return (
            <div
              key={item.id}
              onMouseDown={(e) => {
                if (isInteractiveMode && e.button === 0) {
                  e.stopPropagation();
                  handleItemClick(e, item.id, "drawing");
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setInlineTextEditor({
                  x: item.x,
                  y: item.y,
                  text: item.text,
                  fontSize: item.fontSize || drawFontSize,
                  color: item.color || drawColor,
                  editingId: item.id
                });
              }}
              style={{
                position: "absolute",
                left: `${posX}px`,
                top: `${posY}px`,
                fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
                fontSize: `${item.fontSize || 24}px`,
                fontWeight: 700,
                color: item.color || "#ffcc00",
                textShadow:
                  "0 2px 4px rgba(0,0,0,0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                transform: `rotate(${rotDeg}deg)`,
                transformOrigin: "left top",
                whiteSpace: "pre-wrap",
                pointerEvents:
                  isInteractiveMode || toolMode === "draw_text"
                    ? "auto"
                    : "none",
                cursor: isInteractiveMode ? "pointer" : "default",
                outline: isSelected ? "2px dashed #00f0ff" : "none",
                outlineOffset: "4px",
                padding: "2px",
                userSelect: "none"
              }}
            >
              {item.text}
            </div>
          );
        })}
      </div>
    );
  };

  // Cálculo da distância da régua (1 quadrado = 1,5m)
  const measureStats = measureLine
    ? (() => {
        const dx = measureLine.endX - measureLine.startX;
        const dy = measureLine.endY - measureLine.startY;
        const distPx = Math.hypot(dx, dy);
        const squares = distPx / cellSizePx;
        const meters = squares * 1.5;
        return {
          metersText: `${meters.toFixed(1).replace(".", ",")} m`,
          squaresText: `${squares.toFixed(1).replace(".", ",")} q`,
          midX: (measureLine.startX + measureLine.endX) / 2,
          midY: (measureLine.startY + measureLine.endY) / 2
        };
      })()
    : null;

  const isDrawToolActive =
    toolMode === "draw_pencil" ||
    toolMode === "draw_select" ||
    toolMode === "draw_text" ||
    toolMode === "draw_circle" ||
    toolMode === "draw_rect";

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleBoardMouseDown}
      onMouseMove={handleBoardMouseMove}
      onMouseUp={handleBoardMouseUp}
      onMouseLeave={handleBoardMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor:
          toolMode === "measure" ||
          toolMode === "draw_pencil" ||
          toolMode === "draw_select" ||
          toolMode === "fog_reveal" ||
          toolMode === "fog_hide"
            ? "crosshair"
            : panningCamera || draggingToken
              ? "grabbing"
              : "grab",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Barra Lateral Esquerda de Ferramentas (Estilo Roll20 - Anexo 1) */}
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

            {/* 2. Ferramenta Medir (Régua 1,5m) */}
            <div className="vtt-tool-group">
              <button
                type="button"
                className={`vtt-tool-btn ${
                  toolMode === "measure" ? "active" : ""
                }`}
                onClick={() => {
                  setToolMode("measure");
                  setOpenFlyout(null);
                }}
              >
                <span>📏</span>
                <span className="vtt-tool-label">Medir</span>
              </button>
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

      {/* Barra Flutuante de Ação para Itens Selecionados (Riscos, Formas, Textos, Tokens) */}
      {(selectedStrokeIds.length > 0 || selectedTokenIds.length > 0) && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 28,
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
          <span
            className="cp-title"
            style={{ fontSize: "13px", marginRight: "4px" }}
          >
            {selectedStrokeIds.length + selectedTokenIds.length} item(ns) selecionado(s)
          </span>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={async () => {
              if (selectedStrokeIds.length > 0) {
                await deleteStrokes(selectedStrokeIds);
                setSelectedStrokeIds([]);
              }
              if (selectedTokenIds.length > 0) {
                for (const tokId of selectedTokenIds) {
                  const tok = tokens.find((t) => t.id === tokId);
                  if (tok && (isGM || canControlToken(tok))) {
                    await removeToken(tokId);
                  }
                }
                setSelectedTokenIds([]);
              }
            }}
          >
            Deletar Selecionados
          </button>
          <button
            type="button"
            className="cp-btn"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={() => {
              setSelectedStrokeIds([]);
              setSelectedTokenIds([]);
            }}
          >
            Limpar Seleção
          </button>
        </div>
      )}

      {/* Superfície Transformável do Tabuleiro (3 Camadas + Grid + Névoa + Pings + Régua) */}
      <div
        ref={boardSurfaceRef}
        style={{
          width: `${widthPx}px`,
          height: `${heightPx}px`,
          position: "relative",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
          boxShadow: "0 0 0 4px #001b3a, 0 20px 50px rgba(0, 0, 0, 0.75)",
          borderRadius: "6px",
          overflow: "hidden",
          backgroundColor: "#0b192c",
          flexShrink: 0
        }}
      >
        {mapLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <span className="cp-title" style={{ fontSize: "24px" }}>
              CARREGANDO MAPA...
            </span>
          </div>
        )}

        {mapUrl && (
          <img
            src={mapUrl}
            alt={activeScene.name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              display: "block",
              pointerEvents: "none"
            }}
          />
        )}

        {/* CAMADA 1: MAPA (Tokens de Fundo, Riscos e Formas de Mapa) */}
        {mapLayerTokens.map((token) => (
          <TokenSprite
            key={token.id}
            token={token}
            cellSizePx={cellSizePx}
            campaignId={campaignId}
            isGM={isGM}
            canControl={canControlToken(token)}
            isInteractive={
              toolMode === "move" && effectiveLayer === "map" && isGM
            }
            isSelected={selectedTokenIds.includes(token.id)}
            speechBubble={getTokenSpeech(token)}
            snowballAimActive={snowballAimActive}
            onStartDrag={handleStartTokenDrag}
            onSelect={(tokId, e) => handleItemClick(e, tokId, "token")}
            onQuickToggleVisibility={handleQuickToggleTokenVisibility}
            onQuickToggleName={handleQuickToggleTokenName}
            onQuickAdjustHp={handleQuickAdjustHp}
            onOpenEditModal={(tok) =>
              setTokenModalState({ open: true, editingToken: tok })
            }
          />
        ))}
        {renderShapeSvgLayer(mapLayerShapes, 3, "map")}
        {renderStrokeSvgLayer(mapLayerStrokes, 3, "map")}
        {renderTextLayer(mapLayerTexts, 3, "map")}

        {/* GRID SVG */}
        {grid.enabled && (
          <svg
            width={widthPx}
            height={heightPx}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 4
            }}
          >
            <defs>
              <pattern
                id={patternId}
                width={cellSizePx}
                height={cellSizePx}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${grid.offsetX || 0}, ${
                  grid.offsetY || 0
                })`}
              >
                <path
                  d={`M ${cellSizePx} 0 L 0 0 0 ${cellSizePx}`}
                  fill="none"
                  stroke={grid.color || "#ffffff"}
                  strokeWidth="1.2"
                  strokeOpacity={grid.opacity ?? 0.28}
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
        )}

        {/* CAMADA 2: OBJETOS / OBSTÁCULOS */}
        {objectsLayerTokens.map((token) => (
          <TokenSprite
            key={token.id}
            token={token}
            cellSizePx={cellSizePx}
            campaignId={campaignId}
            isGM={isGM}
            canControl={canControlToken(token)}
            isInteractive={
              toolMode === "move" && effectiveLayer === "objects" && isGM
            }
            isSelected={selectedTokenIds.includes(token.id)}
            speechBubble={getTokenSpeech(token)}
            snowballAimActive={snowballAimActive}
            onStartDrag={handleStartTokenDrag}
            onSelect={(tokId, e) => handleItemClick(e, tokId, "token")}
            onQuickToggleVisibility={handleQuickToggleTokenVisibility}
            onQuickToggleName={handleQuickToggleTokenName}
            onQuickAdjustHp={handleQuickAdjustHp}
            onOpenEditModal={(tok) =>
              setTokenModalState({ open: true, editingToken: tok })
            }
          />
        ))}
        {renderShapeSvgLayer(objectsLayerShapes, 6, "objects")}
        {renderStrokeSvgLayer(objectsLayerStrokes, 6, "objects")}
        {renderTextLayer(objectsLayerTexts, 6, "objects")}

        {/* CAMADA 3: TOKENS & RISCOS DOS PLAYERS */}
        {renderShapeSvgLayer(tokensLayerShapes, 7, "tokens")}
        {renderStrokeSvgLayer(tokensLayerStrokes, 7, "tokens")}
        {renderTextLayer(tokensLayerTexts, 7, "tokens")}
        {tokensLayerTokens.map((token) => (
          <TokenSprite
            key={token.id}
            token={token}
            cellSizePx={cellSizePx}
            campaignId={campaignId}
            isGM={isGM}
            canControl={canControlToken(token)}
            isInteractive={
              toolMode === "move" && effectiveLayer === "tokens"
            }
            isSelected={selectedTokenIds.includes(token.id)}
            speechBubble={getTokenSpeech(token)}
            snowballAimActive={snowballAimActive}
            onStartDrag={handleStartTokenDrag}
            onSelect={(tokId, e) => handleItemClick(e, tokId, "token")}
            onQuickToggleVisibility={handleQuickToggleTokenVisibility}
            onQuickToggleName={handleQuickToggleTokenName}
            onQuickAdjustHp={handleQuickAdjustHp}
            onOpenEditModal={(tok) =>
              setTokenModalState({ open: true, editingToken: tok })
            }
          />
        ))}

        {/* NÉVOA DE GUERRA (FOG OF WAR) */}
        <FogOfWarCanvas
          widthPx={widthPx}
          heightPx={heightPx}
          fogEnabled={fogEnabled}
          fogAreas={fogAreas}
          isGM={isGM}
          draftRect={draftFogRect}
        />

        {/* PINGS E BOLAS DE NEVE EM VOO */}
        {activePings.map((ping) => {
          const hasSnowball =
            typeof ping.startX === "number" && typeof ping.startY === "number";
          const dx = hasSnowball ? ping.x - ping.startX : 0;
          const dy = hasSnowball ? ping.y - ping.startY : 0;

          return (
            <div key={ping.id}>
              {hasSnowball && (
                <div
                  className="cp-snowball-projectile"
                  style={{
                    left: `${ping.startX}px`,
                    top: `${ping.startY}px`,
                    "--snowball-dx": `${dx}px`,
                    "--snowball-dy": `${dy}px`
                  }}
                >
                  <div className="cp-snowball-projectile-ball" />
                </div>
              )}
              <div
                className={`cp-ping-container ${hasSnowball ? "cp-ping-with-snowball" : ""}`}
                style={{
                  left: `${ping.x}px`,
                  top: `${ping.y}px`,
                  "--ping-color": ping.color || "#00f0ff"
                }}
              >
                <div className="cp-ping-ring" />
                <div className="cp-ping-ring delay-1" />
                <div className="cp-ping-ring delay-2" />
                <div className="cp-ping-center-drop" />
              </div>
            </div>
          );
        })}

        {/* CAMADA SVG INTERATIVA: RÉGUA DE MEDIÇÃO (1,5m), SELEÇÃO E ROTAÇÃO */}
        <svg
          width={widthPx}
          height={heightPx}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 23
          }}
        >
          {/* Caixa de arraste de seleção de riscos */}
          {selectionBox && (
            <rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.w}
              height={selectionBox.h}
              fill="rgba(0, 240, 255, 0.14)"
              stroke="#00f0ff"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
          )}

          {/* Contorno e Alça de Rotação dos itens selecionados */}
          {selectedStrokesBounds && (() => {
            const cx = selectedStrokesBounds.x + selectedStrokesBounds.w / 2;
            const cy = selectedStrokesBounds.y + selectedStrokesBounds.h / 2;
            const dx = draggingStrokesDelta ? draggingStrokesDelta.dx : 0;
            const dy = draggingStrokesDelta ? draggingStrokesDelta.dy : 0;

            const handleX = cx + dx;
            const handleY = selectedStrokesBounds.y - 28 + dy;

            return (
              <g
                transform={
                  rotatingAngle
                    ? `rotate(${(rotatingAngle * 180) / Math.PI} ${cx} ${cy})`
                    : undefined
                }
              >
                <rect
                  x={selectedStrokesBounds.x + dx}
                  y={selectedStrokesBounds.y + dy}
                  width={selectedStrokesBounds.w}
                  height={selectedStrokesBounds.h}
                  fill="rgba(255, 204, 0, 0.08)"
                  stroke="#ffcc00"
                  strokeWidth="2.5"
                  strokeDasharray="8 5"
                />

                {/* Haste de conexão até a alça de rotação */}
                <line
                  x1={cx + dx}
                  y1={selectedStrokesBounds.y + dy}
                  x2={handleX}
                  y2={handleY}
                  stroke="#ffcc00"
                  strokeWidth="2"
                />

                {/* Alça Circular de Rotação controlada pelo Mouse */}
                <circle
                  cx={handleX}
                  cy={handleY}
                  r="11"
                  fill="#ffcc00"
                  stroke="#001b3a"
                  strokeWidth="2.5"
                  style={{ cursor: "crosshair", pointerEvents: "all" }}
                />
                <text
                  x={handleX}
                  y={handleY + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill="#001b3a"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  ↻
                </text>

                {rotatingAngle !== 0 && (
                  <text
                    x={handleX}
                    y={handleY - 14}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="bold"
                    fill="#00f0ff"
                    stroke="#001b3a"
                    strokeWidth="3"
                    paintOrder="stroke"
                    style={{ pointerEvents: "none" }}
                  >
                    {Math.round((rotatingAngle * 180) / Math.PI)}°
                  </text>
                )}
              </g>
            );
          })()}

          {/* Régua de Medição (1 quadrado = 1,5m) */}
          {measureLine && (
            <g>
              <line
                x1={measureLine.startX}
                y1={measureLine.startY}
                x2={measureLine.endX}
                y2={measureLine.endY}
                stroke="#001b3a"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <line
                x1={measureLine.startX}
                y1={measureLine.startY}
                x2={measureLine.endX}
                y2={measureLine.endY}
                stroke="#ffcc00"
                strokeWidth="3.5"
                strokeDasharray="10 6"
                strokeLinecap="round"
              />
              <circle
                cx={measureLine.startX}
                cy={measureLine.startY}
                r="6"
                fill="#ffcc00"
                stroke="#001b3a"
                strokeWidth="2"
              />
              <circle
                cx={measureLine.endX}
                cy={measureLine.endY}
                r="7"
                fill="#00f0ff"
                stroke="#001b3a"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Editor de Caixa de Texto Comic Sans sobre o Tabuleiro */}
        {inlineTextEditor && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              left: `${inlineTextEditor.x}px`,
              top: `${inlineTextEditor.y}px`,
              zIndex: 35,
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                background: "rgba(1, 27, 58, 0.95)",
                border: "2px solid #ffcc00",
                borderRadius: "999px",
                padding: "3px 8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
              }}
            >
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px 7px", fontSize: "11px" }}
                onClick={() => setDrawFontSize((s) => Math.max(12, s - 4))}
              >
                -
              </button>
              <span
                style={{
                  fontFamily:
                    '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700
                }}
              >
                {drawFontSize}px
              </span>
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px 7px", fontSize: "11px" }}
                onClick={() => setDrawFontSize((s) => Math.min(72, s + 4))}
              >
                +
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "2px 9px", fontSize: "11px" }}
                onClick={handleSaveInlineText}
              >
                Salvar
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "2px 8px", fontSize: "11px" }}
                onClick={() => setInlineTextEditor(null)}
              >
                ✕
              </button>
            </div>

            <textarea
              autoFocus
              value={inlineTextEditor.text}
              onChange={(e) =>
                setInlineTextEditor((prev) => ({
                  ...prev,
                  text: e.target.value
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveInlineText();
                } else if (e.key === "Escape") {
                  setInlineTextEditor(null);
                }
              }}
              placeholder="Digite seu texto..."
              style={{
                fontFamily:
                  '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
                fontSize: `${drawFontSize}px`,
                color: drawColor,
                background: "rgba(1, 27, 58, 0.85)",
                border: "2px dashed #ffcc00",
                borderRadius: "8px",
                padding: "8px",
                minWidth: "190px",
                minHeight: "52px",
                outline: "none",
                textShadow:
                  "0 2px 4px rgba(0,0,0,0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                resize: "both"
              }}
            />
          </div>
        )}

        {/* Placa Flutuante da Medida em Metros (1,5m por quadrado) */}
        {measureLine && measureStats && (
          <div
            style={{
              position: "absolute",
              left: `${measureStats.midX}px`,
              top: `${measureStats.midY - 22}px`,
              transform: "translate(-50%, -100%)",
              background: "rgba(1, 27, 58, 0.95)",
              border: "2.5px solid #ffcc00",
              borderRadius: "999px",
              padding: "4px 12px",
              color: "#ffffff",
              fontFamily: "var(--font-display)",
              fontSize: "15px",
              fontWeight: 800,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.65)",
              zIndex: 24
            }}
          >
            {measureStats.metersText} ({measureStats.squaresText})
          </div>
        )}
      </div>

      {tokenModalState.open && (
        <TokenModal
          initialToken={tokenModalState.editingToken}
          defaultLayer={effectiveLayer}
          playersMap={playersMap}
          isGM={isGM}
          onSave={handleSaveTokenModal}
          onDelete={isGM ? removeToken : null}
          onClose={() =>
            setTokenModalState({ open: false, editingToken: null })
          }
        />
      )}
    </div>
  );
}
