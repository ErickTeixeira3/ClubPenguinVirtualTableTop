import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWindowId,
  openCampaignCrossWindowChannel
} from "../services/crossWindowService.js";

const legacyKeysCleanedForCampaigns = new Set();

function isValidCampaignScope(campaignId) {
  return (
    typeof campaignId === "string" &&
    campaignId.trim().length > 0 &&
    campaignId.trim().toLowerCase() !== "default"
  );
}

/**
 * Canal de sincronização instantânea entre a janela principal do tabuleiro
 * e janelas destacadas (?campaignId=...&sheetId=...) via BroadcastChannel
 * (ou localStorage + evento `storage`, quando BroadcastChannel não existe).
 */
export function useCrossWindowSync({
  campaignId,
  targetedTokens = [],
  aoeDemarcateConfig = null,
  onTargetsReceived,
  onAoeDemarcateReceived,
  onSaveClaimReceived,
  onSaveAnsweredReceived,
  onTransportError = null
}) {
  const [windowId] = useState(() => createWindowId());
  const transportRef = useRef(null);

  const latestStateRef = useRef({
    targetedTokens,
    aoeDemarcateConfig
  });

  const callbacksRef = useRef({
    onTargetsReceived,
    onAoeDemarcateReceived,
    onSaveClaimReceived,
    onSaveAnsweredReceived,
    onTransportError
  });

  useEffect(() => {
    latestStateRef.current = {
      targetedTokens,
      aoeDemarcateConfig
    };
    callbacksRef.current = {
      onTargetsReceived,
      onAoeDemarcateReceived,
      onSaveClaimReceived,
      onSaveAnsweredReceived,
      onTransportError
    };
  });

  // Limpeza de chaves legadas de alvo/AoE do localStorage (pré-Fase 3; removida na Fase 13).
  useEffect(() => {
    if (!isValidCampaignScope(campaignId)) return;
    if (legacyKeysCleanedForCampaigns.has(campaignId)) return;
    legacyKeysCleanedForCampaigns.add(campaignId);
    const rawStorage = typeof window !== "undefined" ? window.localStorage : null;
    if (!rawStorage) return;
    try {
      for (const suffix of [campaignId, "default"]) {
        rawStorage.removeItem(`cp_vtt_targeted_tokens_${suffix}`);
        rawStorage.removeItem(`cp_vtt_targeted_token_${suffix}`);
        rawStorage.removeItem(`cp_vtt_aoe_demarcate_${suffix}`);
      }
    } catch (err) {
      callbacksRef.current.onTransportError?.(err, { action: "cleanupLegacyKeys", campaignId });
    }
  }, [campaignId]);

  const postPacket = useCallback(
    (type, payload = null) => {
      const transport = transportRef.current;
      if (!transport) return false;
      try {
        transport.post({
          type,
          senderWindowId: windowId,
          payload
        });
        return true;
      } catch (err) {
        callbacksRef.current.onTransportError?.(err, { action: "postPacket", type });
        return false;
      }
    },
    [windowId]
  );

  useEffect(() => {
    if (!isValidCampaignScope(campaignId)) {
      transportRef.current = null;
      return undefined;
    }

    const handlePacket = (data) => {
      if (!data || data.senderWindowId === windowId) return;

      if (data.type === "REQUEST_SYNC") {
        const { targetedTokens: curTargets, aoeDemarcateConfig: curAoe } =
          latestStateRef.current;
        const tokenIds = Array.isArray(curTargets)
          ? curTargets.map((t) => t?.id || t?.tokenId).filter(Boolean)
          : [];
        if (tokenIds.length > 0 || curAoe) {
          postPacket("SYNC_STATE", {
            targetedTokenIds: tokenIds,
            targetedTokens: curTargets || [],
            aoeDemarcateConfig: curAoe || null
          });
        }
        return;
      }

      if (data.type === "SYNC_STATE" && data.payload) {
        const {
          targetedTokenIds,
          targetedTokens: nextTokens,
          aoeDemarcateConfig: nextAoe
        } = data.payload;
        if (Array.isArray(nextTokens) || Array.isArray(targetedTokenIds)) {
          callbacksRef.current.onTargetsReceived?.({
            targetedTokenIds: Array.isArray(targetedTokenIds)
              ? targetedTokenIds
              : (nextTokens || []).map((t) => t?.id || t?.tokenId).filter(Boolean),
            targetedTokens: Array.isArray(nextTokens) ? nextTokens : []
          });
        }
        if (nextAoe !== undefined) {
          callbacksRef.current.onAoeDemarcateReceived?.(nextAoe || null);
        }
        return;
      }

      if (data.type === "TARGETS_UPDATED" && data.payload) {
        const { targetedTokenIds, targetedTokens: nextTokens } = data.payload;
        callbacksRef.current.onTargetsReceived?.({
          targetedTokenIds: Array.isArray(targetedTokenIds)
            ? targetedTokenIds
            : (nextTokens || []).map((t) => t?.id || t?.tokenId).filter(Boolean),
          targetedTokens: Array.isArray(nextTokens) ? nextTokens : []
        });
        return;
      }

      if (data.type === "AOE_DEMARCATE_UPDATED") {
        callbacksRef.current.onAoeDemarcateReceived?.(data.payload || null);
        return;
      }

      if (data.type === "SAVE_MODAL_CLAIMED" && data.payload) {
        callbacksRef.current.onSaveClaimReceived?.(data.payload);
        return;
      }

      if (data.type === "SAVE_MODAL_ANSWERED" && data.payload) {
        callbacksRef.current.onSaveAnsweredReceived?.(data.payload);
      }
    };

    const reportError = (err, context) => {
      callbacksRef.current.onTransportError?.(err, context);
    };

    let transport = null;
    try {
      transport = openCampaignCrossWindowChannel({
        campaignId,
        onPacket: handlePacket,
        onError: reportError
      });
    } catch (err) {
      reportError(err, { action: "openTransport", campaignId });
      transport = null;
    }
    transportRef.current = transport;

    // Solicita o snapshot mais recente ao abrir nova aba ou janela destacada (?sheetId=...)
    if (transport) postPacket("REQUEST_SYNC");

    return () => {
      if (transport) {
        try {
          transport.close();
        } catch (err) {
          reportError(err, { action: "closeTransport", campaignId });
        }
      }
      if (transportRef.current === transport) {
        transportRef.current = null;
      }
    };
  }, [campaignId, postPacket, windowId]);

  const broadcastTargets = useCallback(
    (tokensList) => {
      const safeTokens = Array.isArray(tokensList) ? tokensList.filter(Boolean) : [];
      const tokenIds = safeTokens.map((t) => t.id || t.tokenId).filter(Boolean);
      return postPacket("TARGETS_UPDATED", {
        targetedTokenIds: tokenIds,
        targetedTokens: safeTokens
      });
    },
    [postPacket]
  );

  const broadcastAoeDemarcate = useCallback(
    (config) => {
      return postPacket("AOE_DEMARCATE_UPDATED", config || null);
    },
    [postPacket]
  );

  const broadcastSaveClaimed = useCallback(
    (saveId, extra = {}) => {
      if (!saveId) return false;
      return postPacket("SAVE_MODAL_CLAIMED", {
        saveId,
        ownerWindowId: windowId,
        ...extra
      });
    },
    [postPacket, windowId]
  );

  const broadcastSaveAnswered = useCallback(
    (saveId) => {
      if (!saveId) return false;
      return postPacket("SAVE_MODAL_ANSWERED", {
        saveId,
        answeredByWindowId: windowId
      });
    },
    [postPacket, windowId]
  );

  return {
    windowId,
    broadcastTargets,
    broadcastAoeDemarcate,
    broadcastSaveClaimed,
    broadcastSaveAnswered
  };
}
