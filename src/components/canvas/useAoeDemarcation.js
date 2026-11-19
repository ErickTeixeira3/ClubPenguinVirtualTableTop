import { useCallback, useMemo, useState } from "react";
import { computeAoePreview, getTokenCenter } from "../../engines/geometry/index.js";

/**
 * Gerencia a demarcação interativa de AoE usando exclusivamente `engines/geometry`
 * e apenas tokens renderizados (SEG-09).
 * FUN-04: o conjurador é resolvido apenas por ID explícito (sem fallback para o primeiro token controlável).
 */
export function useAoeDemarcation({
  aoeDemarcateConfig = null,
  renderedTokens = [],
  selectedTokenIds = [],
  activeCharacter = null,
  cellSizePx = 64
}) {
  const [aoeMousePos, setAoeMousePos] = useState(null);

  const aoeCasterToken = useMemo(() => {
    if (!aoeDemarcateConfig) return null;
    if (aoeDemarcateConfig.sourceTokenId) {
      const byTokenId = renderedTokens.find((t) => t.id === aoeDemarcateConfig.sourceTokenId);
      if (byTokenId) return byTokenId;
    }
    if (aoeDemarcateConfig.sourceCharacterId) {
      const byCharId = renderedTokens.find(
        (t) => t.characterId === aoeDemarcateConfig.sourceCharacterId
      );
      if (byCharId) return byCharId;
    }
    if (selectedTokenIds.length > 0) {
      const bySelected = renderedTokens.find((t) => t.id === selectedTokenIds[0]);
      if (bySelected) return bySelected;
    }
    if (activeCharacter?.id) {
      const byActive = renderedTokens.find((t) => t.characterId === activeCharacter.id);
      if (byActive) return byActive;
    }
    return null;
  }, [aoeDemarcateConfig, renderedTokens, selectedTokenIds, activeCharacter]);

  const aoeCasterCenter = useMemo(() => {
    if (!aoeCasterToken) return null;
    return getTokenCenter(aoeCasterToken, cellSizePx);
  }, [aoeCasterToken, cellSizePx]);

  const computePreviewAt = useCallback(
    (pt) => {
      if (!aoeDemarcateConfig || !pt) return null;
      return computeAoePreview({
        aoeConfig: aoeDemarcateConfig,
        origin: aoeCasterCenter,
        mousePos: pt,
        tokens: renderedTokens,
        cellSizePx
      });
    },
    [aoeDemarcateConfig, aoeCasterCenter, renderedTokens, cellSizePx]
  );

  const aoePreview = useMemo(() => {
    if (!aoeDemarcateConfig || !aoeMousePos) return null;
    return computePreviewAt(aoeMousePos);
  }, [aoeDemarcateConfig, aoeMousePos, computePreviewAt]);

  const updateAoeMousePos = useCallback((pt) => {
    setAoeMousePos(pt);
  }, []);

  return {
    aoeCasterToken,
    aoePreview,
    computePreviewAt,
    updateAoeMousePos
  };
}
