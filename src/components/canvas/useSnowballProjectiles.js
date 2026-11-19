import { useCallback } from "react";
import { PING_KINDS } from "../../domain/constants.js";
import { getTokenCenter } from "../../engines/geometry/index.js";

/**
 * Gerencia arremesso de bolas de neve e pings do tabuleiro.
 * FUN-04: origem da bola de neve resolvida exclusivamente por ID de token / `characterId` (sem casar nomes).
 */
export function useSnowballProjectiles({
  tokens = [],
  selectedTokenIds = [],
  activeCharacter = null,
  isGM = false,
  drawColor = "#008be3",
  cellSizePx = 64,
  snowballAimActive = false,
  sendPing,
  onDeactivateSnowballAim
}) {
  const activeCharId = activeCharacter?.id || null;
  const activeCharColor = activeCharacter?.cardColor || null;

  const getOriginCenter = useCallback(() => {
    if (selectedTokenIds.length > 0) {
      const lastId = selectedTokenIds[selectedTokenIds.length - 1];
      const tok = tokens.find((t) => t.id === lastId);
      if (tok) return getTokenCenter(tok, cellSizePx);
    }
    if (activeCharId) {
      const tok = tokens.find((t) => t.characterId === activeCharId);
      if (tok) return getTokenCenter(tok, cellSizePx);
    }
    return null;
  }, [selectedTokenIds, tokens, activeCharId, cellSizePx]);

  const getPingColor = useCallback(() => {
    if (isGM) {
      if (snowballAimActive || selectedTokenIds.length > 0) {
        if (activeCharColor) return activeCharColor;
        if (selectedTokenIds.length > 0) {
          const lastId = selectedTokenIds[selectedTokenIds.length - 1];
          const tok = tokens.find((t) => t.id === lastId);
          if (tok?.ringColor) return tok.ringColor;
        }
      }
      return "#00f0ff";
    }

    if (activeCharColor) {
      return activeCharColor;
    }
    if (selectedTokenIds.length > 0) {
      const lastId = selectedTokenIds[selectedTokenIds.length - 1];
      const tok = tokens.find((t) => t.id === lastId);
      if (tok?.ringColor) return tok.ringColor;
    }
    return drawColor || "#008be3";
  }, [isGM, snowballAimActive, selectedTokenIds, activeCharColor, tokens, drawColor]);

  const throwSnowball = useCallback(
    (boardPt) => {
      const origin = getOriginCenter();
      sendPing(boardPt.x, boardPt.y, {
        kind: origin ? PING_KINDS.SNOWBALL : PING_KINDS.PING,
        from: origin,
        color: getPingColor()
      });
      onDeactivateSnowballAim?.();
    },
    [getOriginCenter, getPingColor, sendPing, onDeactivateSnowballAim]
  );

  const emitRipplePing = useCallback(
    (boardPt) => {
      sendPing(boardPt.x, boardPt.y, {
        kind: PING_KINDS.PING,
        from: null,
        color: getPingColor()
      });
    },
    [getPingColor, sendPing]
  );

  return {
    getOriginCenter,
    getPingColor,
    throwSnowball,
    emitRipplePing
  };
}
