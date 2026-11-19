import { useCallback, useRef, useState } from "react";
import { BOARD_ZOOM_LIMITS } from "../../domain/constants.js";

function clampZoom(value) {
  return Math.min(
    BOARD_ZOOM_LIMITS.MAX,
    Math.max(BOARD_ZOOM_LIMITS.MIN, Number(value.toFixed(2)))
  );
}

/**
 * Gerencia câmera do tabuleiro (zoom, pan, conversão de coordenadas de tela ↔ mapa)
 * respeitando `BOARD_ZOOM_LIMITS` unificados.
 */
export function useBoardCamera({
  boardSurfaceRef,
  widthPx = 1920,
  heightPx = 1080,
  initialZoom = 0.75
} = {}) {
  const [zoom, setZoomState] = useState(() => clampZoom(initialZoom));
  const [pan, setPan] = useState({ x: 0, y: 0 });
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

  const setZoom = useCallback((nextOrUpdater) => {
    setZoomState((prev) => {
      const candidate =
        typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
      return clampZoom(candidate);
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => z + BOARD_ZOOM_LIMITS.STEP);
  }, [setZoom]);

  const zoomOut = useCallback(() => {
    setZoom((z) => z - BOARD_ZOOM_LIMITS.STEP);
  }, [setZoom]);

  const resetCamera = useCallback(() => {
    setZoomState(clampZoom(initialZoom));
    setPan({ x: 0, y: 0 });
  }, [initialZoom]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      setZoom((prev) =>
        e.deltaY < 0
          ? prev * BOARD_ZOOM_LIMITS.WHEEL_FACTOR
          : prev / BOARD_ZOOM_LIMITS.WHEEL_FACTOR
      );
    },
    [setZoom]
  );

  const clientToBoardCoords = useCallback(
    (clientX, clientY) => {
      const surface = boardSurfaceRef?.current;
      if (!surface) return { x: 0, y: 0 };
      const rect = surface.getBoundingClientRect();
      const x = (clientX - rect.left) / zoom;
      const y = (clientY - rect.top) / zoom;
      return {
        x: Math.max(0, Math.min(widthPx, x)),
        y: Math.max(0, Math.min(heightPx, y))
      };
    },
    [boardSurfaceRef, zoom, widthPx, heightPx]
  );

  const startPan = useCallback(
    (clientX, clientY, boardPt) => {
      setPanningCamera(true);
      panStartRef.current = {
        x: clientX,
        y: clientY,
        panX: pan.x,
        panY: pan.y,
        boardX: boardPt.x,
        boardY: boardPt.y,
        moved: false,
        pingFired: false
      };
    },
    [pan.x, pan.y]
  );

  const movePan = useCallback(
    (clientX, clientY, onMovedPastThreshold = null) => {
      if (!panningCamera) return false;
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        if (!panStartRef.current.moved) {
          panStartRef.current.moved = true;
          onMovedPastThreshold?.();
        }
      }
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
      return true;
    },
    [panningCamera]
  );

  const endPan = useCallback(() => {
    setPanningCamera(false);
  }, []);

  return {
    zoom,
    pan,
    panningCamera,
    panStartRef,
    setZoom,
    zoomIn,
    zoomOut,
    resetCamera,
    handleWheel,
    clientToBoardCoords,
    startPan,
    movePan,
    endPan
  };
}
