import { useCallback, useEffect, useRef, useState } from "react";
import { METERS_PER_CELL } from "../../domain/constants.js";
import { computeMoveDistanceMeters } from "../../engines/geometry/index.js";
import { useTurnPolicy } from "../../contexts/TurnPolicyContext.js";

/**
 * Gerencia arraste de tokens (individual ou multi-seleção) consultando exclusivamente
 * a interface `TurnPolicyContext` (U1 — comportamento congelado).
 */
export function useTokenDrag({
  tokens = [],
  selectedTokenIds = [],
  effectiveLayer = "tokens",
  toolMode = "move",
  isGM = false,
  canControlToken,
  grid,
  cellSizePx = 64,
  widthPx = 1920,
  heightPx = 1080,
  moveToken
}) {
  const turnPolicy = useTurnPolicy();
  const [draggingToken, setDraggingToken] = useState(null);
  const [draggingTokensDelta, setDraggingTokensDelta] = useState(null);
  const [turnBlockNotice, setTurnBlockNotice] = useState(null);
  const turnNoticeTimerRef = useRef(null);

  const showTurnBlockNotice = useCallback((msg) => {
    if (!msg) return;
    setTurnBlockNotice(msg);
    if (turnNoticeTimerRef.current) clearTimeout(turnNoticeTimerRef.current);
    turnNoticeTimerRef.current = setTimeout(() => setTurnBlockNotice(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (turnNoticeTimerRef.current) clearTimeout(turnNoticeTimerRef.current);
    };
  }, []);

  const snapCoordinate = useCallback(
    (val, offset = 0, ignoreSnap = false) => {
      if (!grid?.snapToGrid || ignoreSnap) {
        return Math.round(val);
      }
      const shifted = val - (Number(offset) || 0);
      const snapped = Math.round(shifted / cellSizePx) * cellSizePx;
      return Math.round(snapped + (Number(offset) || 0));
    },
    [grid?.snapToGrid, cellSizePx]
  );

  const startTokenDrag = useCallback(
    (boardPt, token) => {
      if (toolMode !== "move") return;
      const tokenLayer = token.layer || "tokens";
      if (tokenLayer !== effectiveLayer) return;

      const activeIds = selectedTokenIds.includes(token.id)
        ? selectedTokenIds
        : [token.id];

      const initialPositions = {};
      let blockedReason = null;

      activeIds.forEach((id) => {
        const tok = tokens.find((t) => t.id === id);
        if (tok && (isGM || canControlToken(tok))) {
          if (turnPolicy.isActive && tokenLayer === "tokens" && !isGM) {
            const check = turnPolicy.canActorMove(tok, 0, { isGM });
            if (!check.allowed) {
              blockedReason = blockedReason || check.reason;
              return;
            }
          }
          initialPositions[id] = {
            x: tok.x,
            y: tok.y,
            sizeInCells: tok.sizeInCells || 1,
            token: tok
          };
        }
      });

      if (Object.keys(initialPositions).length === 0) {
        if (blockedReason) showTurnBlockNotice(blockedReason);
        return;
      }

      setDraggingToken({
        leadId: token.id,
        startX: boardPt.x,
        startY: boardPt.y,
        initialPositions
      });
      setDraggingTokensDelta({ dx: 0, dy: 0 });
    },
    [
      toolMode,
      effectiveLayer,
      selectedTokenIds,
      tokens,
      isGM,
      canControlToken,
      turnPolicy,
      showTurnBlockNotice
    ]
  );

  const updateTokenDrag = useCallback(
    (boardPt) => {
      if (!draggingToken) return false;
      setDraggingTokensDelta({
        dx: boardPt.x - draggingToken.startX,
        dy: boardPt.y - draggingToken.startY
      });
      return true;
    },
    [draggingToken]
  );

  const finishTokenDrag = useCallback(
    (ignoreSnap = false) => {
      if (!draggingToken) return false;

      const dx = draggingTokensDelta ? draggingTokensDelta.dx : 0;
      const dy = draggingTokensDelta ? draggingTokensDelta.dy : 0;

      Object.entries(draggingToken.initialPositions || {}).forEach(([tokId, pos]) => {
        const tokenSizePx = (pos.sizeInCells || 1) * cellSizePx;
        const targetX = Math.max(0, Math.min(widthPx - tokenSizePx, pos.x + dx));
        const targetY = Math.max(0, Math.min(heightPx - tokenSizePx, pos.y + dy));
        const finalX = snapCoordinate(targetX, grid?.offsetX, ignoreSnap);
        const finalY = snapCoordinate(targetY, grid?.offsetY, ignoreSnap);

        const tokenObj = pos.token || tokens.find((t) => t.id === tokId) || { id: tokId };
        const tokenLayer = tokenObj.layer || "tokens";
        const distanceMeters = computeMoveDistanceMeters({
          fromX: pos.x,
          fromY: pos.y,
          toX: finalX,
          toY: finalY,
          cellSizePx,
          metersPerCell: METERS_PER_CELL
        });

        if (turnPolicy.isActive && tokenLayer === "tokens" && distanceMeters > 0.05) {
          const moveCheck = turnPolicy.canActorMove(tokenObj, distanceMeters, { isGM });
          if (!moveCheck.allowed) {
            showTurnBlockNotice(moveCheck.reason);
            return;
          }
        }

        if (finalX === pos.x && finalY === pos.y) {
          return;
        }

        moveToken(tokId, finalX, finalY);
        if (turnPolicy.isActive && tokenLayer === "tokens" && distanceMeters > 0.05) {
          turnPolicy.consumeMovement(tokenObj, distanceMeters);
        }
      });

      setDraggingToken(null);
      setDraggingTokensDelta(null);
      return true;
    },
    [
      draggingToken,
      draggingTokensDelta,
      cellSizePx,
      widthPx,
      heightPx,
      snapCoordinate,
      grid?.offsetX,
      grid?.offsetY,
      tokens,
      turnPolicy,
      isGM,
      showTurnBlockNotice,
      moveToken
    ]
  );

  return {
    draggingToken,
    draggingTokensDelta,
    turnBlockNotice,
    snapCoordinate,
    startTokenDrag,
    updateTokenDrag,
    finishTokenDrag
  };
}
