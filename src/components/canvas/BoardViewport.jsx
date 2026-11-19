import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTargetSelection } from "../../contexts/TargetSelectionContext.js";
import {
  DEFAULT_CELL_SIZE_PX,
  DEFAULT_MAP_DIMENSIONS,
  DRAWING_TYPES,
  LAYER_NAMES,
  MIN_FOG_AREA_PX,
  TOKEN_KINDS
} from "../../domain/constants.js";
import { toControlledByMap } from "../../domain/permissions.js";
import {
  computeRulerStats,
  doesDrawingIntersectRect,
  getDrawingBounds,
  isTokenInsideCircle,
  isTokenInsideCone
} from "../../engines/geometry/index.js";
import { useDrawings } from "../../hooks/useDrawings.js";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { usePings } from "../../hooks/usePings.js";
import { DEFAULT_GRID_CONFIG } from "../../hooks/useScenes";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import CPButton from "../ui/CPButton.jsx";
import BoardAoeTemplateLayer from "./BoardAoeTemplateLayer.jsx";
import { BOARD_Z_LAYERS } from "./boardConstants.js";
import BoardDrawingsLayer from "./BoardDrawingsLayer.jsx";
import BoardHud, { BoardMeasureBadge } from "./BoardHud.jsx";
import BoardLeftToolbar from "./BoardLeftToolbar.jsx";
import BoardMeasurementLayer from "./BoardMeasurementLayer.jsx";
import BoardPingsLayer from "./BoardPingsLayer.jsx";
import BoardTextEditor from "./BoardTextEditor.jsx";
import { BoardToolsContext } from "./BoardToolsContext.js";
import FogOfWarCanvas from "./FogOfWarCanvas.jsx";
import TokenModal from "./TokenModal.jsx";
import TokenSprite from "./TokenSprite.jsx";
import { useAoeDemarcation } from "./useAoeDemarcation.js";
import { useBoardCamera } from "./useBoardCamera.js";
import { useBoardHotkeys } from "./useBoardHotkeys.js";
import { useBoardTools } from "./useBoardTools.js";
import { useSnowballProjectiles } from "./useSnowballProjectiles.js";
import { useTokenDrag } from "./useTokenDrag.js";
import { useTokenSpeech } from "./useTokenSpeech.js";

const EMPTY_TOKENS_API = Object.freeze({
  tokens: [],
  canControl: () => false,
  createFreeToken: async () => null,
  moveToken: async () => {},
  updateTokenEditable: async () => null,
  updateTokenAdmin: async () => null,
  adjustTokenResource: async () => null,
  setTokenVisibility: async () => null,
  uploadTokenMedia: async () => null,
  removeToken: async () => {}
});

const EMPTY_FOG_API = Object.freeze({
  fog: { enabled: false, areas: {}, updatedAt: null },
  toggleFogEnabled: async () => {},
  addFogArea: async () => null,
  resetFogCoverAll: async () => {},
  isPointRevealed: () => true
});

export default function BoardViewport({
  activeScene,
  campaignId,
  playersMap,
  isGM,
  messages = [],
  activeCharacter = null,
  allCharacters = [],
  tokensApi = EMPTY_TOKENS_API,
  secretsByTokenId = {},
  fogApi = EMPTY_FOG_API,
  onUpdateSceneGrid,
  onOpenScenesManager,
  onSelectedTokenChange,
  aoeDemarcateConfig = null,
  onCloseAoeDemarcate,
  snowballAimActive = false,
  onDeactivateSnowballAim,
  onSyncTokenToCharacter,
  onAdjustPcResource
}) {
  const { user } = useAuth();
  const containerRef = useRef(null);
  const boardSurfaceRef = useRef(null);

  const sceneId = activeScene?.id || null;
  const mediaId = activeScene?.mapImage?.mediaId || null;
  const externalUrl =
    activeScene?.mapImage?.url ?? activeScene?.mapImage?.externalUrl ?? null;
  const { url: mapUrl, loading: mapLoading } = useMediaUrl(
    mediaId,
    externalUrl,
    campaignId
  );

  const {
    tokens = [],
    canControl: canControlToken,
    createFreeToken,
    moveToken,
    updateTokenEditable,
    updateTokenAdmin,
    adjustTokenResource,
    setTokenVisibility,
    uploadTokenMedia,
    removeToken
  } = tokensApi;

  const {
    fog,
    toggleFogEnabled,
    addFogArea,
    resetFogCoverAll,
    isPointRevealed
  } = fogApi;
  const fogEnabled = Boolean(fog?.enabled);

  const {
    drawings,
    canEditDrawing,
    addStroke,
    addShape,
    addTextItem,
    updateTextItem,
    deleteDrawings,
    clearAllDrawings,
    moveDrawings,
    rotateDrawings
  } = useDrawings(sceneId);

  const {
    pings,
    snapshotReceivedAtMs,
    serverTimeOffsetMs,
    sendPing,
    cleanupExpiredPings
  } = usePings(sceneId);

  const { targetedTokenIds, toggleTarget, setTargetIds, isTargeted } =
    useTargetSelection();

  const widthPx = activeScene?.mapImage?.widthPx || DEFAULT_MAP_DIMENSIONS.widthPx;
  const heightPx = activeScene?.mapImage?.heightPx || DEFAULT_MAP_DIMENSIONS.heightPx;
  const grid = useMemo(
    () => ({
      ...DEFAULT_GRID_CONFIG,
      ...(activeScene?.grid || {})
    }),
    [activeScene?.grid]
  );
  const cellSizePx = Math.max(16, Number(grid.cellSizePx) || DEFAULT_CELL_SIZE_PX);

  const tools = useBoardTools({ isGM });
  const camera = useBoardCamera({
    boardSurfaceRef,
    widthPx,
    heightPx
  });

  const [selectedTokenIds, setSelectedTokenIds] = useState([]);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState([]);
  const [draftShape, setDraftShape] = useState(null);
  const draftShapeRef = useRef(null);
  const [inlineTextEditor, setInlineTextEditor] = useState(null);
  const [draftStrokePoints, setDraftStrokePoints] = useState([]);
  const isDrawingRef = useRef(false);

  const [selectionBox, setSelectionBox] = useState(null);
  const selectionStartRef = useRef(null);
  const [draggingDrawingsDelta, setDraggingDrawingsDelta] = useState(null);

  const [rotatingAngle, setRotatingAngle] = useState(0);
  const isRotatingRef = useRef(false);
  const rotationStartRef = useRef({ cx: 0, cy: 0, startAngle: 0 });

  const [measureLine, setMeasureLine] = useState(null);
  const [draftFogRect, setDraftFogRect] = useState(null);
  const fogStartRef = useRef(null);

  const [tokenModalState, setTokenModalState] = useState({
    open: false,
    editingToken: null
  });
  const [confirmAction, setConfirmAction] = useState(null); // "clearDrawings" | "resetFog" | null

  const pingHoldTimerRef = useRef(null);
  const hoveredTokenRef = useRef(null);
  const lastClickedTokenRef = useRef(null);

  const isAimingMode = Boolean(aoeDemarcateConfig || snowballAimActive);
  const currentUid = user?.uid || null;

  const canDeleteToken = useCallback(
    (tok) => Boolean(tok && (isGM || (currentUid && tok.ownerId === currentUid))),
    [isGM, currentUid]
  );

  const drag = useTokenDrag({
    tokens,
    selectedTokenIds,
    effectiveLayer: tools.effectiveLayer,
    toolMode: tools.toolMode,
    isGM,
    canControlToken,
    grid,
    cellSizePx,
    widthPx,
    heightPx,
    moveToken
  });

  // Tokens renderizados (visíveis + posições em arraste). SEG-09: AoE e régua usam só esta lista.
  const renderedTokens = useMemo(() => {
    return tokens
      .map((t) => {
        if (drag.draggingToken?.initialPositions?.[t.id]) {
          const dx = drag.draggingTokensDelta ? drag.draggingTokensDelta.dx : 0;
          const dy = drag.draggingTokensDelta ? drag.draggingTokensDelta.dy : 0;
          const pos = drag.draggingToken.initialPositions[t.id];
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
        if (t.kind === TOKEN_KINDS.PC || canControlToken(t)) return true;
        const sizePx = (t.sizeInCells || 1) * cellSizePx;
        return isPointRevealed(t.x + sizePx / 2, t.y + sizePx / 2);
      });
  }, [
    tokens,
    drag.draggingToken,
    drag.draggingTokensDelta,
    cellSizePx,
    widthPx,
    heightPx,
    isGM,
    fogEnabled,
    canControlToken,
    isPointRevealed
  ]);

  const aoe = useAoeDemarcation({
    aoeDemarcateConfig,
    renderedTokens,
    selectedTokenIds,
    activeCharacter,
    cellSizePx
  });

  const snowballs = useSnowballProjectiles({
    tokens: renderedTokens,
    selectedTokenIds,
    activeCharacter,
    isGM,
    drawColor: tools.drawColor,
    cellSizePx,
    snowballAimActive,
    sendPing,
    onDeactivateSnowballAim
  });

  const { getTokenSpeech } = useTokenSpeech(messages);

  const activeLayerDrawings = useMemo(
    () => drawings.filter((d) => (d.layer || LAYER_NAMES.TOKENS) === tools.effectiveLayer),
    [drawings, tools.effectiveLayer]
  );

  const activeSelectedDrawingIds = useMemo(() => {
    if (selectedDrawingIds.length === 0 || activeLayerDrawings.length === 0) {
      return [];
    }
    const activeIds = new Set(activeLayerDrawings.map((item) => item.id));
    return selectedDrawingIds.filter((id) => activeIds.has(id));
  }, [selectedDrawingIds, activeLayerDrawings]);

  // Bounding box rotacionado dos desenhos selecionados usando `engines/geometry`
  const selectedDrawingsBounds = useMemo(() => {
    if (activeSelectedDrawingIds.length === 0) return null;
    const selectedSet = new Set(activeSelectedDrawingIds);
    const items = activeLayerDrawings.filter((d) => selectedSet.has(d.id));
    if (items.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of items) {
      const b = getDrawingBounds(item);
      if (!b) continue;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }

    if (!Number.isFinite(minX)) return null;
    const pad = 12;
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(30, maxX - minX + pad * 2),
      h: Math.max(30, maxY - minY + pad * 2)
    };
  }, [activeSelectedDrawingIds, activeLayerDrawings]);

  const activeMeasureLine = tools.toolMode === "measure" ? measureLine : null;

  const measureStats = useMemo(() => {
    if (!activeMeasureLine) return null;
    return computeRulerStats({
      startX: activeMeasureLine.startX,
      startY: activeMeasureLine.startY,
      endX: activeMeasureLine.endX,
      endY: activeMeasureLine.endY,
      shape: tools.measureShape,
      coneAngleDeg: tools.coneAngle,
      cellSizePx
    });
  }, [activeMeasureLine, tools.measureShape, tools.coneAngle, cellSizePx]);

  const tokensInsideMeasure = useMemo(() => {
    if (!activeMeasureLine || !measureStats) return [];
    if (tools.measureShape === "cone") {
      return renderedTokens.filter((tok) =>
        isTokenInsideCone({
          token: tok,
          cellSizePx,
          coneOrigin: { x: activeMeasureLine.startX, y: activeMeasureLine.startY },
          radiusPx: measureStats.distPx,
          centerAngleRad: measureStats.centerAngleRad,
          coneAngleDeg: tools.coneAngle
        })
      );
    }
    if (tools.measureShape === "circle") {
      return renderedTokens.filter((tok) =>
        isTokenInsideCircle({
          token: tok,
          cellSizePx,
          circleCenter: { x: activeMeasureLine.startX, y: activeMeasureLine.startY },
          radiusPx: measureStats.radiusPx
        })
      );
    }
    return [];
  }, [
    activeMeasureLine,
    measureStats,
    tools.measureShape,
    tools.coneAngle,
    renderedTokens,
    cellSizePx
  ]);

  const handleDeleteSelected = useCallback(async () => {
    if (activeSelectedDrawingIds.length > 0) {
      await deleteDrawings(activeSelectedDrawingIds);
      const deletedSet = new Set(activeSelectedDrawingIds);
      setSelectedDrawingIds((prev) => prev.filter((id) => !deletedSet.has(id)));
    }
    if (selectedTokenIds.length > 0) {
      for (const tokId of selectedTokenIds) {
        const tok = tokens.find((t) => t.id === tokId);
        if (tok && canDeleteToken(tok)) {
          await removeToken(tok);
        }
      }
      setSelectedTokenIds([]);
    }
  }, [
    activeSelectedDrawingIds,
    selectedTokenIds,
    deleteDrawings,
    tokens,
    canDeleteToken,
    removeToken
  ]);

  const { tKeyHeldRef } = useBoardHotkeys({
    toolMode: tools.toolMode,
    aoeDemarcateConfig,
    snowballAimActive,
    hasLockedMeasure: Boolean(activeMeasureLine?.locked),
    hasInlineTextEditor: Boolean(inlineTextEditor),
    hasSelection: activeSelectedDrawingIds.length > 0 || selectedTokenIds.length > 0,
    onCancelAoe: onCloseAoeDemarcate,
    onCancelSnowball: onDeactivateSnowballAim,
    onClearMeasure: () => setMeasureLine(null),
    onCloseInlineText: () => setInlineTextEditor(null),
    onToggleTargetByHotkey: () => {
      const candidate = hoveredTokenRef.current || lastClickedTokenRef.current;
      if (candidate) {
        toggleTarget(candidate.id, { multiSelect: true });
      }
    },
    onDeleteSelected: handleDeleteSelected,
    onSelectMeasureLine: () => tools.setMeasureShape("line"),
    onSelectOrCycleCone: tools.selectOrCycleCone,
    onSelectMeasureCircle: () => tools.setMeasureShape("circle")
  });

  useEffect(() => {
    return () => {
      if (pingHoldTimerRef.current) clearTimeout(pingHoldTimerRef.current);
    };
  }, []);

  // Notifica pai sobre token prioritário selecionado
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

  const captureTokensAsTargets = useCallback(
    (tokensToCapture) => {
      const incomingIds = (tokensToCapture || []).map((t) => t.id).filter(Boolean);
      const merged = Array.from(new Set([...targetedTokenIds, ...incomingIds]));
      setTargetIds(merged);
    },
    [targetedTokenIds, setTargetIds]
  );

  const handleTokenClickForTarget = useCallback(
    (tok, e) => {
      lastClickedTokenRef.current = tok || null;
      if (tKeyHeldRef.current && e.button === 0) {
        toggleTarget(tok.id, { multiSelect: true });
        return true;
      }
      return false;
    },
    [tKeyHeldRef, toggleTarget]
  );

  const handleSelectDrawing = useCallback(
    (e, drawingId) => {
      const target = activeLayerDrawings.find((item) => item.id === drawingId);
      if (!target || !canEditDrawing(target)) return;
      if (e?.shiftKey) {
        setSelectedDrawingIds((prev) =>
          prev.includes(drawingId)
            ? prev.filter((id) => id !== drawingId)
            : [...prev, drawingId]
        );
        return;
      }
      setSelectedDrawingIds((prev) =>
        prev.includes(drawingId) ? prev : [drawingId]
      );
      setSelectedTokenIds([]);
      if (
        e &&
        e.button === 0 &&
        typeof e.clientX === "number" &&
        typeof e.clientY === "number"
      ) {
        const pt = camera.clientToBoardCoords(e.clientX, e.clientY);
        setDraggingDrawingsDelta({
          startX: pt.x,
          startY: pt.y,
          dx: 0,
          dy: 0
        });
      }
    },
    [activeLayerDrawings, canEditDrawing, camera]
  );

  const handleSelectToken = useCallback(
    (tokenId, e) => {
      const targetTok = tokens.find((t) => t.id === tokenId);
      if (!targetTok || (!isGM && !canControlToken(targetTok))) return;
      if (e?.shiftKey) {
        setSelectedTokenIds((prev) =>
          prev.includes(tokenId)
            ? prev.filter((id) => id !== tokenId)
            : [...prev, tokenId]
        );
      } else {
        setSelectedTokenIds([tokenId]);
        setSelectedDrawingIds([]);
      }
    },
    [tokens, isGM, canControlToken]
  );

  const handleStartTokenDrag = useCallback(
    (e, token) => {
      const pt = camera.clientToBoardCoords(e.clientX, e.clientY);
      drag.startTokenDrag(pt, token);
    },
    [camera, drag]
  );

  // FUN-01: salva usando fontSize e color do próprio `inlineTextEditor`
  const handleSaveInlineText = async () => {
    if (!inlineTextEditor) return;
    const { text, x, y, fontSize, color, fontFamily, editingId } = inlineTextEditor;
    if (!text.trim()) {
      setInlineTextEditor(null);
      return;
    }
    if (editingId) {
      await updateTextItem(editingId, {
        text: text.trim(),
        fontSize,
        color,
        ...(fontFamily ? { fontFamily } : {})
      });
    } else {
      await addTextItem(
        text.trim(),
        x,
        y,
        fontSize,
        color,
        tools.effectiveLayer,
        fontFamily
      );
    }
    setInlineTextEditor(null);
  };

  const tryBeginSelectionTransform = (pt) => {
    if (!selectedDrawingsBounds) return false;
    const cx = selectedDrawingsBounds.x + selectedDrawingsBounds.w / 2;
    const cy = selectedDrawingsBounds.y + selectedDrawingsBounds.h / 2;
    const handleX = cx;
    const handleY = selectedDrawingsBounds.y - 28;

    if (Math.hypot(pt.x - handleX, pt.y - handleY) <= 16) {
      isRotatingRef.current = true;
      rotationStartRef.current = {
        cx,
        cy,
        startAngle: Math.atan2(pt.y - cy, pt.x - cx)
      };
      setRotatingAngle(0);
      return true;
    }

    if (
      pt.x >= selectedDrawingsBounds.x &&
      pt.x <= selectedDrawingsBounds.x + selectedDrawingsBounds.w &&
      pt.y >= selectedDrawingsBounds.y &&
      pt.y <= selectedDrawingsBounds.y + selectedDrawingsBounds.h
    ) {
      setDraggingDrawingsDelta({ startX: pt.x, startY: pt.y, dx: 0, dy: 0 });
      return true;
    }
    return false;
  };

  const handleBoardMouseDown = (e) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    tools.setOpenFlyout(null);

    const pt = camera.clientToBoardCoords(e.clientX, e.clientY);

    // FUN-15: mira de bola de neve e demarcação AoE funcionam sobre qualquer área ou token
    if (snowballAimActive && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      snowballs.throwSnowball(pt);
      return;
    }

    if (aoeDemarcateConfig && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const preview = aoe.aoePreview || aoe.computePreviewAt(pt);
      captureTokensAsTargets(preview?.tokensInside || []);
      onCloseAoeDemarcate?.();
      return;
    }

    if (tools.toolMode === "measure" && e.button === 0) {
      setMeasureLine({
        startX: pt.x,
        startY: pt.y,
        endX: pt.x,
        endY: pt.y,
        locked: false
      });
      return;
    }

    if (tools.toolMode === "draw_pencil" && e.button === 0) {
      isDrawingRef.current = true;
      setDraftStrokePoints([{ x: pt.x, y: pt.y }]);
      return;
    }

    if (
      (tools.toolMode === "draw_circle" || tools.toolMode === "draw_rect") &&
      e.button === 0
    ) {
      const shapeType =
        tools.toolMode === "draw_circle" ? DRAWING_TYPES.CIRCLE : DRAWING_TYPES.RECT;
      draftShapeRef.current = { type: shapeType, startX: pt.x, startY: pt.y };
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

    if (tools.toolMode === "draw_text" && e.button === 0) {
      setInlineTextEditor({
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        text: "",
        fontSize: tools.drawFontSize,
        color: tools.drawColor,
        editingId: null
      });
      return;
    }

    if (tools.toolMode === "draw_select" && e.button === 0) {
      if (tryBeginSelectionTransform(pt)) return;
      if (!e.shiftKey) {
        setSelectedDrawingIds([]);
        setSelectedTokenIds([]);
      }
      selectionStartRef.current = { x: pt.x, y: pt.y };
      setSelectionBox({ x: pt.x, y: pt.y, w: 0, h: 0 });
      return;
    }

    if (
      isGM &&
      e.button === 0 &&
      (tools.toolMode === "fog_reveal" || tools.toolMode === "fog_hide")
    ) {
      const op = tools.toolMode === "fog_reveal" ? "reveal" : "hide";
      fogStartRef.current = { x: pt.x, y: pt.y, op };
      setDraftFogRect({ x: pt.x, y: pt.y, w: 0, h: 0, op });
      return;
    }

    if (tools.toolMode === "move" && e.button === 0) {
      if (tryBeginSelectionTransform(pt)) return;
      if (!e.shiftKey) {
        setSelectedTokenIds([]);
        setSelectedDrawingIds([]);
      }
    }

    camera.startPan(e.clientX, e.clientY, pt);

    if (tools.toolMode === "move" && e.button === 0) {
      if (pingHoldTimerRef.current) clearTimeout(pingHoldTimerRef.current);
      pingHoldTimerRef.current = setTimeout(() => {
        if (!camera.panStartRef.current.moved && !camera.panStartRef.current.pingFired) {
          camera.panStartRef.current.pingFired = true;
          snowballs.emitRipplePing({
            x: camera.panStartRef.current.boardX,
            y: camera.panStartRef.current.boardY
          });
        }
      }, 750);
    }
  };

  const handleBoardMouseMove = (e) => {
    const pt = camera.clientToBoardCoords(e.clientX, e.clientY);

    if (aoeDemarcateConfig) {
      aoe.updateAoeMousePos(pt);
    }

    if (isRotatingRef.current) {
      const { cx, cy, startAngle } = rotationStartRef.current;
      setRotatingAngle(Math.atan2(pt.y - cy, pt.x - cx) - startAngle);
      return;
    }

    if (drag.updateTokenDrag(pt)) {
      return;
    }

    if (measureLine && !measureLine.locked) {
      setMeasureLine((prev) =>
        prev && !prev.locked ? { ...prev, endX: pt.x, endY: pt.y } : prev
      );
      return;
    }

    if (isDrawingRef.current) {
      setDraftStrokePoints((prev) => {
        if (prev.length === 0) return [{ x: pt.x, y: pt.y }];
        const last = prev[prev.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) < 3) return prev;
        return [...prev, { x: pt.x, y: pt.y }];
      });
      return;
    }

    if (draftShapeRef.current) {
      const start = draftShapeRef.current;
      setDraftShape({
        type: start.type,
        startX: start.startX,
        startY: start.startY,
        x: Math.min(start.startX, pt.x),
        y: Math.min(start.startY, pt.y),
        w: Math.abs(pt.x - start.startX),
        h: Math.abs(pt.y - start.startY)
      });
      return;
    }

    if (draggingDrawingsDelta) {
      setDraggingDrawingsDelta((prev) =>
        prev ? { ...prev, dx: pt.x - prev.startX, dy: pt.y - prev.startY } : null
      );
      return;
    }

    if (selectionStartRef.current) {
      const start = selectionStartRef.current;
      setSelectionBox({
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        w: Math.abs(pt.x - start.x),
        h: Math.abs(pt.y - start.y)
      });
      return;
    }

    if (fogStartRef.current) {
      const start = fogStartRef.current;
      setDraftFogRect({
        x: Math.min(start.x, pt.x),
        y: Math.min(start.y, pt.y),
        w: Math.abs(pt.x - start.x),
        h: Math.abs(pt.y - start.y),
        op: start.op
      });
      return;
    }

    camera.movePan(e.clientX, e.clientY, () => {
      if (pingHoldTimerRef.current) {
        clearTimeout(pingHoldTimerRef.current);
        pingHoldTimerRef.current = null;
      }
    });
  };

  const handleBoardMouseUp = async (e) => {
    if (pingHoldTimerRef.current) {
      clearTimeout(pingHoldTimerRef.current);
      pingHoldTimerRef.current = null;
    }

    if (isRotatingRef.current) {
      isRotatingRef.current = false;
      const { cx, cy } = rotationStartRef.current;
      const finalAngleRad = rotatingAngle;
      setRotatingAngle(0);
      if (Math.abs(finalAngleRad) > 0.02) {
        const selectedSet = new Set(activeSelectedDrawingIds);
        const items = activeLayerDrawings.filter((d) => selectedSet.has(d.id));
        await rotateDrawings(items, (finalAngleRad * 180) / Math.PI, { x: cx, y: cy });
      }
    }

    drag.finishTokenDrag(Boolean(e?.altKey));

    // FUN-14: se a régua de cone/círculo contém tokens, fixa a régua para permitir clicar em "Capturar Alvos"
    if (measureLine && !measureLine.locked) {
      if (
        (tools.measureShape === "cone" || tools.measureShape === "circle") &&
        tokensInsideMeasure.length > 0
      ) {
        setMeasureLine((prev) => (prev ? { ...prev, locked: true } : null));
      } else {
        setMeasureLine(null);
      }
    }

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      const pts = draftStrokePoints;
      setDraftStrokePoints([]);
      if (pts.length >= 1) {
        await addStroke(pts, tools.drawColor, tools.drawWidth, tools.effectiveLayer);
      }
    }

    if (draftShapeRef.current && draftShape) {
      const shapeToSave = draftShape;
      draftShapeRef.current = null;
      setDraftShape(null);
      if (shapeToSave.w > 4 && shapeToSave.h > 4) {
        await addShape(
          shapeToSave.type,
          shapeToSave.x,
          shapeToSave.y,
          shapeToSave.w,
          shapeToSave.h,
          tools.drawColor,
          tools.drawWidth,
          tools.shapeHasFill,
          tools.shapeFillColor,
          tools.effectiveLayer
        );
      }
    }

    if (draggingDrawingsDelta) {
      const { dx, dy } = draggingDrawingsDelta;
      setDraggingDrawingsDelta(null);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const selectedSet = new Set(activeSelectedDrawingIds);
        const items = activeLayerDrawings.filter((d) => selectedSet.has(d.id));
        await moveDrawings(items, dx, dy);
      }
    }

    if (selectionStartRef.current && selectionBox) {
      const box = selectionBox;
      selectionStartRef.current = null;
      setSelectionBox(null);
      const matched = activeLayerDrawings
        .filter((d) => canEditDrawing(d) && doesDrawingIntersectRect(d, box))
        .map((d) => d.id);
      setSelectedDrawingIds(matched);
    }

    if (fogStartRef.current && draftFogRect) {
      const rectToCommit = draftFogRect;
      fogStartRef.current = null;
      setDraftFogRect(null);
      if (rectToCommit.w >= MIN_FOG_AREA_PX && rectToCommit.h >= MIN_FOG_AREA_PX) {
        await addFogArea(rectToCommit, rectToCommit.op);
      }
    }

    camera.endPan();
  };

  const handleToggleGrid = () => {
    if (!activeScene || !isGM) return;
    onUpdateSceneGrid?.(activeScene.id, {
      grid: { ...grid, enabled: !grid.enabled }
    });
  };

  const handleToggleSnap = () => {
    if (!activeScene || !isGM) return;
    onUpdateSceneGrid?.(activeScene.id, {
      grid: { ...grid, snapToGrid: !grid.snapToGrid }
    });
  };

  const handleChangeCellSize = (delta) => {
    if (!activeScene || !isGM) return;
    const nextSize = Math.min(200, Math.max(20, cellSizePx + delta));
    onUpdateSceneGrid?.(activeScene.id, {
      grid: { ...grid, cellSizePx: nextSize }
    });
  };

  const handleSaveTokenModal = async (formData, compressedImage) => {
    const editingToken = tokenModalState.editingToken;
    const isEditingPc = editingToken?.kind === TOKEN_KINDS.PC;
    let nextImage = null;
    if (compressedImage) {
      const keepPrivateUntilPublished =
        Boolean(formData.hidden) || Boolean(isGM && !isEditingPc && fogEnabled);
      const visibleTo = keepPrivateUntilPublished
        ? [currentUid].filter(Boolean)
        : ["ALL"];
      const uploaded = await uploadTokenMedia({
        compressed: compressedImage,
        visibleTo
      });
      if (uploaded?.mediaId) {
        nextImage = { mediaId: uploaded.mediaId, url: null };
      }
    } else if (formData.externalUrl) {
      nextImage = { mediaId: null, url: formData.externalUrl };
    }

    if (editingToken) {
      const resolvedImage = formData.imageCleared
        ? { mediaId: null, url: null }
        : (nextImage ?? editingToken.image);

      if (editingToken.kind === TOKEN_KINDS.PC) {
        const prevControlled = toControlledByMap(editingToken.controlledBy);
        const nextControlled = toControlledByMap(formData.controlledBy);
        const prevKeys = Object.keys(prevControlled).sort();
        const nextKeys = Object.keys(nextControlled).sort();
        const controlledChanged =
          prevKeys.length !== nextKeys.length ||
          prevKeys.some((k, idx) => k !== nextKeys[idx]);
        const adminFieldsChanged =
          formData.layer !== editingToken.layer ||
          Boolean(formData.hidden) !== Boolean(editingToken.hidden) ||
          controlledChanged;

        if (isGM && adminFieldsChanged) {
          await updateTokenAdmin(editingToken, {
            layer: formData.layer,
            hidden: formData.hidden,
            controlledBy: formData.controlledBy
          });
        }

        // U3: para PC, grava na ficha (Firestore); projeção atualiza o RTDB.
        await onSyncTokenToCharacter?.(editingToken, {
          label: formData.label,
          ringColor: formData.ringColor,
          showName: formData.showName,
          sizeInCells: formData.sizeInCells,
          image: resolvedImage,
          defense: formData.defense,
          hpCurrent: formData.hp?.current ?? null,
          hpMax: formData.hp?.max ?? null,
          mpCurrent: formData.mp?.current ?? null,
          mpMax: formData.mp?.max ?? null
        });
        return;
      }

      if (isGM) {
        await updateTokenAdmin(
          editingToken,
          {
            label: formData.label,
            layer: formData.layer,
            hidden: formData.hidden,
            controlledBy: formData.controlledBy,
            sizeInCells: formData.sizeInCells,
            ringColor: formData.ringColor,
            showName: formData.showName,
            image: resolvedImage
          },
          {
            currentSecret: secretsByTokenId[editingToken.id] || null,
            secretPatch: {
              defense: formData.defense,
              hp: formData.hp,
              mp: formData.mp,
              showBarsToPlayers: formData.showBarsToPlayers
            }
          }
        );
      } else {
        await updateTokenEditable(editingToken, {
          label: formData.label,
          sizeInCells: formData.sizeInCells,
          ringColor: formData.ringColor,
          showName: formData.showName,
          image: resolvedImage
        });
      }
      return;
    }

    const centerX = drag.snapCoordinate(widthPx / 2 - cellSizePx / 2, grid.offsetX);
    const centerY = drag.snapCoordinate(heightPx / 2 - cellSizePx / 2, grid.offsetY);
    await createFreeToken({
      ...formData,
      image: nextImage || { mediaId: null, url: null },
      layer: formData.layer || tools.effectiveLayer,
      x: centerX,
      y: centerY
    });
  };

  const handleQuickToggleVisibility = async (token) => {
    if (!isGM) return;
    await setTokenVisibility(token, !token.hidden);
  };

  const handleQuickToggleName = async (token) => {
    if (!token || (!isGM && !canControlToken(token))) return;
    const nextShowName = token.showName === false;
    if (token.kind === TOKEN_KINDS.PC) {
      await onSyncTokenToCharacter?.(token, { showName: nextShowName });
    } else if (isGM) {
      await updateTokenAdmin(token, { showName: nextShowName });
    } else {
      await updateTokenEditable(token, { showName: nextShowName });
    }
  };

  // Ajuste rápido de HP: PC → Firestore (U3); NPC/livre → transação em `tokenSecrets`
  const handleQuickAdjustHp = async (token, delta) => {
    if (!token || (!isGM && !canControlToken(token)) || !delta) return;
    if (token.kind === TOKEN_KINDS.PC && token.characterId) {
      await onAdjustPcResource?.(token.characterId, "hp", delta);
      return;
    }
    await adjustTokenResource(token, "hp", delta);
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
            <CPButton variant="gold" onClick={onOpenScenesManager}>
              Selecionar ou Criar Mapa
            </CPButton>
          )}
        </div>
      </div>
    );
  }

  const patternId = `vtt-grid-${activeScene.id}`;
  const aoeHighlightedIds = new Set((aoe.aoePreview?.tokensInside || []).map((t) => t.id));

  const layerDrawingsMap = {
    [LAYER_NAMES.MAP]: drawings.filter((d) => (d.layer || LAYER_NAMES.TOKENS) === LAYER_NAMES.MAP),
    [LAYER_NAMES.OBJECTS]: drawings.filter(
      (d) => (d.layer || LAYER_NAMES.TOKENS) === LAYER_NAMES.OBJECTS
    ),
    [LAYER_NAMES.TOKENS]: drawings.filter(
      (d) => (d.layer || LAYER_NAMES.TOKENS) === LAYER_NAMES.TOKENS
    )
  };

  const renderLayerTokens = (layerKey) => {
    const list = renderedTokens.filter((t) => (t.layer || LAYER_NAMES.TOKENS) === layerKey);
    const interactive =
      tools.toolMode === "move" &&
      tools.effectiveLayer === layerKey &&
      (layerKey === LAYER_NAMES.TOKENS || isGM);

    return list.map((token) => (
      <TokenSprite
        key={token.id}
        token={token}
        secret={secretsByTokenId[token.id] || null}
        cellSizePx={cellSizePx}
        campaignId={campaignId}
        isGM={isGM}
        canControl={canControlToken(token)}
        isInteractive={interactive}
        isSelected={selectedTokenIds.includes(token.id)}
        isTargeted={isTargeted(token.id)}
        isAoeHighlighted={aoeHighlightedIds.has(token.id)}
        isAimingMode={isAimingMode}
        speechBubble={getTokenSpeech(token)}
        onStartDrag={handleStartTokenDrag}
        onSelect={handleSelectToken}
        onHoverToken={(tok) => {
          hoveredTokenRef.current = tok || null;
        }}
        onTokenClickForTarget={handleTokenClickForTarget}
        onQuickToggleVisibility={handleQuickToggleVisibility}
        onQuickToggleName={handleQuickToggleName}
        onQuickAdjustHp={handleQuickAdjustHp}
        onOpenEditModal={(tok) => setTokenModalState({ open: true, editingToken: tok })}
      />
    ));
  };

  const sharedDrawingsProps = {
    effectiveLayer: tools.effectiveLayer,
    widthPx,
    heightPx,
    toolMode: tools.toolMode,
    isAimingMode,
    selectedDrawingIds,
    selectedBounds: selectedDrawingsBounds,
    draggingDelta: draggingDrawingsDelta,
    rotatingAngle,
    draftShape,
    draftStrokePoints,
    drawColor: tools.drawColor,
    drawWidth: tools.drawWidth,
    shapeHasFill: tools.shapeHasFill,
    shapeFillColor: tools.shapeFillColor,
    canEditDrawing,
    onSelectDrawing: handleSelectDrawing,
    onEditText: (item) =>
      setInlineTextEditor({
        x: item.x,
        y: item.y,
        text: item.text,
        fontSize: item.fontSize || 24,
        color: item.color || "#ffcc00",
        fontFamily: item.fontFamily,
        editingId: item.id
      })
  };

  const editingTokenLinkedChar = tokenModalState.editingToken?.characterId
    ? allCharacters.find((c) => c.id === tokenModalState.editingToken.characterId) || null
    : null;

  return (
    <BoardToolsContext.Provider value={tools}>
      <div
        ref={containerRef}
        onWheel={camera.handleWheel}
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
            isAimingMode ||
            tools.toolMode === "measure" ||
            tools.toolMode === "draw_pencil" ||
            tools.toolMode === "draw_select" ||
            tools.toolMode === "fog_reveal" ||
            tools.toolMode === "fog_hide"
              ? "crosshair"
              : camera.panningCamera || drag.draggingToken
                ? "grabbing"
                : "grab",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <BoardLeftToolbar
          isGM={isGM}
          fogEnabled={fogEnabled}
          toggleFogEnabled={toggleFogEnabled}
          onRequestResetFogCoverAll={() => setConfirmAction("resetFog")}
          onRequestClearAllDrawings={() => setConfirmAction("clearDrawings")}
          grid={grid}
          cellSizePx={cellSizePx}
          handleToggleGrid={handleToggleGrid}
          handleToggleSnap={handleToggleSnap}
          handleChangeCellSize={handleChangeCellSize}
          onOpenScenesManager={onOpenScenesManager}
          onOpenNewTokenModal={() =>
            setTokenModalState({ open: true, editingToken: null })
          }
          zoom={camera.zoom}
          onZoomIn={camera.zoomIn}
          onZoomOut={camera.zoomOut}
          onResetCamera={camera.resetCamera}
        />

        <div
          ref={boardSurfaceRef}
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            position: "relative",
            transform: `translate(${camera.pan.x}px, ${camera.pan.y}px) scale(${camera.zoom})`,
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

          {/* CAMADA 1: MAPA */}
          {renderLayerTokens(LAYER_NAMES.MAP)}
          <BoardDrawingsLayer
            {...sharedDrawingsProps}
            layerKey={LAYER_NAMES.MAP}
            zIndex={BOARD_Z_LAYERS.mapDrawings}
            drawings={layerDrawingsMap[LAYER_NAMES.MAP]}
          />

          {/* GRID SVG */}
          {grid.enabled && (
            <svg
              width={widthPx}
              height={heightPx}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: BOARD_Z_LAYERS.grid
              }}
            >
              <defs>
                <pattern
                  id={patternId}
                  width={cellSizePx}
                  height={cellSizePx}
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${grid.offsetX || 0}, ${grid.offsetY || 0})`}
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
          {renderLayerTokens(LAYER_NAMES.OBJECTS)}
          <BoardDrawingsLayer
            {...sharedDrawingsProps}
            layerKey={LAYER_NAMES.OBJECTS}
            zIndex={BOARD_Z_LAYERS.objectsDrawings}
            drawings={layerDrawingsMap[LAYER_NAMES.OBJECTS]}
          />

          {/* CAMADA 3: TOKENS */}
          <BoardDrawingsLayer
            {...sharedDrawingsProps}
            layerKey={LAYER_NAMES.TOKENS}
            zIndex={BOARD_Z_LAYERS.tokensDrawings}
            drawings={layerDrawingsMap[LAYER_NAMES.TOKENS]}
          />
          {renderLayerTokens(LAYER_NAMES.TOKENS)}

          {/* NÉVOA DE GUERRA */}
          <FogOfWarCanvas
            widthPx={widthPx}
            heightPx={heightPx}
            fog={fog}
            isGM={isGM}
            draftRect={draftFogRect}
          />

          {/* DEMARCAÇÃO AoE */}
          {aoeDemarcateConfig && aoe.aoePreview && (
            <BoardAoeTemplateLayer
              widthPx={widthPx}
              heightPx={heightPx}
              aoePreview={aoe.aoePreview}
            />
          )}

          {/* PINGS E BOLAS DE NEVE (tick de 250ms isolado neste componente - PERF-06) */}
          <BoardPingsLayer
            pings={pings}
            snapshotReceivedAtMs={snapshotReceivedAtMs}
            serverTimeOffsetMs={serverTimeOffsetMs}
            onCleanupExpired={cleanupExpiredPings}
          />

          {/* OVERLAY SVG: SELEÇÃO, ROTAÇÃO E RÉGUA */}
          <svg
            width={widthPx}
            height={heightPx}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: BOARD_Z_LAYERS.interactiveOverlay
            }}
          >
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

            {selectedDrawingsBounds && (() => {
              const cx = selectedDrawingsBounds.x + selectedDrawingsBounds.w / 2;
              const cy = selectedDrawingsBounds.y + selectedDrawingsBounds.h / 2;
              const dx = draggingDrawingsDelta ? draggingDrawingsDelta.dx : 0;
              const dy = draggingDrawingsDelta ? draggingDrawingsDelta.dy : 0;
              const handleX = cx + dx;
              const handleY = selectedDrawingsBounds.y - 28 + dy;

              return (
                <g
                  transform={
                    rotatingAngle
                      ? `rotate(${(rotatingAngle * 180) / Math.PI} ${cx} ${cy})`
                      : undefined
                  }
                >
                  <rect
                    x={selectedDrawingsBounds.x + dx}
                    y={selectedDrawingsBounds.y + dy}
                    width={selectedDrawingsBounds.w}
                    height={selectedDrawingsBounds.h}
                    fill="rgba(255, 204, 0, 0.08)"
                    stroke="#ffcc00"
                    strokeWidth="2.5"
                    strokeDasharray="8 5"
                  />
                  <line
                    x1={cx + dx}
                    y1={selectedDrawingsBounds.y + dy}
                    x2={handleX}
                    y2={handleY}
                    stroke="#ffcc00"
                    strokeWidth="2"
                  />
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

            {activeMeasureLine && measureStats && (
              <BoardMeasurementLayer
                measureShape={tools.measureShape}
                measureStats={measureStats}
                measureLine={activeMeasureLine}
              />
            )}
          </svg>

          <BoardTextEditor
            editor={inlineTextEditor}
            onChange={setInlineTextEditor}
            onSave={handleSaveInlineText}
            onCancel={() => setInlineTextEditor(null)}
          />

          <BoardMeasureBadge
            measureLine={activeMeasureLine}
            measureStats={measureStats}
            tokensInsideMeasure={tokensInsideMeasure}
            onCaptureTargets={(captured) => {
              captureTokensAsTargets(captured);
              setMeasureLine(null);
            }}
            onDismissMeasure={() => setMeasureLine(null)}
          />
        </div>

        <BoardHud
          turnBlockNotice={drag.turnBlockNotice}
          aoeDemarcateConfig={aoeDemarcateConfig}
          aoePreview={aoe.aoePreview}
          onCloseAoeDemarcate={onCloseAoeDemarcate}
          selectedCount={activeSelectedDrawingIds.length + selectedTokenIds.length}
          onDeleteSelected={handleDeleteSelected}
          onClearSelection={() => {
            setSelectedDrawingIds([]);
            setSelectedTokenIds([]);
          }}
        />

        {tokenModalState.open && (
          <TokenModal
            initialToken={tokenModalState.editingToken}
            initialSecret={
              tokenModalState.editingToken
                ? secretsByTokenId[tokenModalState.editingToken.id] || null
                : null
            }
            linkedCharacter={editingTokenLinkedChar}
            defaultLayer={tools.effectiveLayer}
            playersMap={playersMap}
            isGM={isGM}
            canDelete={canDeleteToken(tokenModalState.editingToken)}
            onSave={handleSaveTokenModal}
            onDelete={
              tokenModalState.editingToken &&
              canDeleteToken(tokenModalState.editingToken)
                ? removeToken
                : null
            }
            onClose={() => setTokenModalState({ open: false, editingToken: null })}
          />
        )}

        {/* U6 / U6a: confirmação exclusivamente para as 2 ações destrutivas de "tudo" do Mestre */}
        {confirmAction === "clearDrawings" && (
          <ConfirmDialog
            variant="cp"
            title="Apagar Todos os Desenhos"
            question="Apagar todos os desenhos desta cena?"
            confirmLabel="Apagar Tudo"
            cancelLabel="Cancelar"
            confirmVariant="orange"
            onConfirm={async () => {
              setConfirmAction(null);
              await clearAllDrawings();
              setSelectedDrawingIds([]);
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        {confirmAction === "resetFog" && (
          <ConfirmDialog
            variant="cp"
            title="Recobrir Mapa"
            question="Recobrir o mapa inteiro com a névoa de guerra?"
            confirmLabel="Cobrir Tudo"
            cancelLabel="Cancelar"
            confirmVariant="orange"
            onConfirm={async () => {
              setConfirmAction(null);
              await resetFogCoverAll();
            }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </div>
    </BoardToolsContext.Provider>
  );
}
