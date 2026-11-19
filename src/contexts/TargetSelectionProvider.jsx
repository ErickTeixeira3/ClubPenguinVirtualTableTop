import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TargetSelectionContext } from "./TargetSelectionContext.js";

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Contexto dedicado de alvos (INT-17): armazena exclusivamente `targetedTokenIds`
 * e deriva os objetos ao vivo a partir dos tokens da cena ativa.
 * Remove automaticamente IDs de tokens excluídos ou ocultados.
 */
export default function TargetSelectionProvider({
  sceneId = null,
  sceneTokens = [],
  tokensLoaded = false,
  registerExternalReceiver = null,
  onTargetsChange = null,
  children
}) {
  const [selection, setSelection] = useState({ sceneId, ids: [] });
  const [fallbackById, setFallbackById] = useState({});
  const onTargetsChangeRef = useRef(onTargetsChange);

  useEffect(() => {
    onTargetsChangeRef.current = onTargetsChange;
  });

  // Recebe sincronização de outra janela de forma orientada a eventos (sem setState síncrono em effect)
  useEffect(() => {
    if (typeof registerExternalReceiver !== "function") return undefined;
    return registerExternalReceiver(({ targetedTokenIds, targetedTokens }) => {
      const nextIds = normalizeIds(
        Array.isArray(targetedTokenIds)
          ? targetedTokenIds
          : (targetedTokens || []).map((t) => t?.id || t?.tokenId)
      );
      const nextCache = {};
      if (Array.isArray(targetedTokens)) {
        for (const tok of targetedTokens) {
          const id = tok?.id || tok?.tokenId;
          if (id) nextCache[id] = tok;
        }
      }
      setFallbackById(nextCache);
      setSelection({ sceneId, ids: nextIds });
    });
  }, [registerExternalReceiver, sceneId]);

  const tokenById = useMemo(() => {
    const map = new Map();
    for (const tok of sceneTokens || []) {
      if (tok?.id) {
        map.set(tok.id, sceneId ? { ...tok, sceneId } : tok);
      }
    }
    return map;
  }, [sceneTokens, sceneId]);

  // Ao trocar de cena, descarta IDs da cena anterior sem precisar de setState em effect
  const rawIds = useMemo(
    () => (selection.sceneId === sceneId ? selection.ids : []),
    [selection, sceneId]
  );

  // INT-17: filtra automaticamente IDs de tokens que não existem mais na cena ativa
  const prunedIds = useMemo(() => {
    if (!tokensLoaded) return rawIds;
    return rawIds.filter((id) => tokenById.has(id));
  }, [rawIds, tokensLoaded, tokenById]);

  const targetedTokens = useMemo(() => {
    const out = [];
    for (const id of prunedIds) {
      const live = tokenById.get(id);
      if (live) {
        out.push(live);
      } else if (!tokensLoaded && fallbackById[id]) {
        out.push(fallbackById[id]);
      }
    }
    return out;
  }, [prunedIds, tokenById, tokensLoaded, fallbackById]);

  // Notifica canal cross-window quando a poda automática removeu algum token excluído
  const lastPrunedBroadcastRef = useRef("");
  useEffect(() => {
    if (!tokensLoaded) return;
    if (prunedIds.length < rawIds.length) {
      const sig = `${sceneId || ""}:${prunedIds.join(",")}`;
      if (lastPrunedBroadcastRef.current !== sig) {
        lastPrunedBroadcastRef.current = sig;
        onTargetsChangeRef.current?.(prunedIds, targetedTokens);
      }
    }
  }, [tokensLoaded, prunedIds, rawIds.length, sceneId, targetedTokens]);

  const resolveTokensForIds = useCallback(
    (ids) =>
      ids
        .map((id) => tokenById.get(id) || (!tokensLoaded ? fallbackById[id] : null))
        .filter(Boolean),
    [tokenById, tokensLoaded, fallbackById]
  );

  const setTargetIds = useCallback(
    (ids) => {
      const normalized = normalizeIds(ids);
      const filtered = tokensLoaded
        ? normalized.filter((id) => tokenById.has(id))
        : normalized;
      setSelection({ sceneId, ids: filtered });
      onTargetsChangeRef.current?.(filtered, resolveTokensForIds(filtered));
    },
    [sceneId, tokensLoaded, tokenById, resolveTokensForIds]
  );

  const toggleTarget = useCallback(
    (tokenOrId, { multiSelect = false } = {}) => {
      const id =
        typeof tokenOrId === "string"
          ? tokenOrId.trim()
          : tokenOrId?.id || tokenOrId?.tokenId || "";
      if (!id) return;
      if (tokensLoaded && !tokenById.has(id)) return;

      const baseIds = prunedIds;
      const exists = baseIds.includes(id);
      let next;
      if (multiSelect) {
        next = exists ? baseIds.filter((item) => item !== id) : [...baseIds, id];
      } else {
        next = exists && baseIds.length === 1 ? [] : [id];
      }
      setSelection({ sceneId, ids: next });
      onTargetsChangeRef.current?.(next, resolveTokensForIds(next));
    },
    [sceneId, prunedIds, tokensLoaded, tokenById, resolveTokensForIds]
  );

  const clearTargets = useCallback(() => {
    if (prunedIds.length === 0) return;
    setSelection({ sceneId, ids: [] });
    onTargetsChangeRef.current?.([], []);
  }, [sceneId, prunedIds.length]);

  const targetedSet = useMemo(() => new Set(prunedIds), [prunedIds]);

  const isTargeted = useCallback(
    (tokenOrId) => {
      const id =
        typeof tokenOrId === "string"
          ? tokenOrId
          : tokenOrId?.id || tokenOrId?.tokenId || "";
      return Boolean(id && targetedSet.has(id));
    },
    [targetedSet]
  );

  const value = useMemo(
    () => ({
      targetedTokenIds: prunedIds,
      targetedTokens,
      primaryTarget: targetedTokens[0] || null,
      toggleTarget,
      setTargetIds,
      clearTargets,
      isTargeted
    }),
    [prunedIds, targetedTokens, toggleTarget, setTargetIds, clearTargets, isTargeted]
  );

  return (
    <TargetSelectionContext.Provider value={value}>
      {children}
    </TargetSelectionContext.Provider>
  );
}
