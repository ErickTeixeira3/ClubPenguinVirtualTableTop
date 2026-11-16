import { useCallback, useEffect, useRef, useState } from "react";

const CHANNEL_PREFIX = "cp_vtt_sync_v1_";
// Fase 6.3 (A13): chave do localStorage usada como transporte alternativo (evento `storage`)
// quando o navegador não tem BroadcastChannel.
const STORAGE_KEY_PREFIX = "cp_vtt_sync_v1_packet_";
const legacyKeysCleanedForCampaigns = new Set();

function createWindowId() {
  return `win_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getLocalStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Fase 6.3 (A13): abre o transporte entre janelas da mesma origem.
 * 1. BroadcastChannel, quando existe;
 * 2. senão, localStorage + evento `storage` (disparado nas OUTRAS janelas a cada gravação).
 * Devolve { post(packet), close() } ou null quando nenhum dos dois está disponível.
 */
function openCrossWindowTransport(channelName, onPacket) {
  if (typeof window === "undefined") return null;

  if (typeof window.BroadcastChannel === "function") {
    try {
      const channel = new window.BroadcastChannel(channelName);
      channel.onmessage = (event) => onPacket(event?.data);
      return {
        kind: "broadcast",
        post: (packet) => channel.postMessage(packet),
        close: () => channel.close(),
      };
    } catch {
      // segue para o transporte por localStorage
    }
  }

  const storage = getLocalStorage();
  if (!storage || typeof window.addEventListener !== "function") return null;

  const storageKey = `${STORAGE_KEY_PREFIX}${channelName}`;
  const handleStorage = (event) => {
    if (event?.key !== storageKey || !event.newValue) return;
    try {
      onPacket(JSON.parse(event.newValue));
    } catch {
      // pacote inválido: ignora
    }
  };
  window.addEventListener("storage", handleStorage);

  return {
    kind: "storage",
    post: (packet) => {
      // `nonce` garante valor novo a cada envio (o evento só dispara quando o valor muda)
      storage.setItem(
        storageKey,
        JSON.stringify({ ...packet, nonce: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` })
      );
    },
    close: () => window.removeEventListener("storage", handleStorage),
  };
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
}) {
  const [windowId] = useState(createWindowId);
  const transportRef = useRef(null);

  const latestStateRef = useRef({
    targetedTokens,
    aoeDemarcateConfig,
  });

  const callbacksRef = useRef({
    onTargetsReceived,
    onAoeDemarcateReceived,
    onSaveClaimReceived,
    onSaveAnsweredReceived,
  });

  useEffect(() => {
    latestStateRef.current = {
      targetedTokens,
      aoeDemarcateConfig,
    };
    callbacksRef.current = {
      onTargetsReceived,
      onAoeDemarcateReceived,
      onSaveClaimReceived,
      onSaveAnsweredReceived,
    };
  });

  // Limpeza de chaves legadas de alvo/AoE do localStorage (pré-Fase 3).
  // Fase 3.1 (errata Fase 3 §3): roda uma vez por sessão e por campanha e também remove as
  // chaves com sufixo "_default" que o código antigo gravava quando campaignId era vazio.
  useEffect(() => {
    const storage = getLocalStorage();
    if (!storage || !campaignId) return;
    if (legacyKeysCleanedForCampaigns.has(campaignId)) return;
    legacyKeysCleanedForCampaigns.add(campaignId);
    try {
      for (const suffix of [campaignId, "default"]) {
        storage.removeItem(`cp_vtt_targeted_tokens_${suffix}`);
        storage.removeItem(`cp_vtt_targeted_token_${suffix}`);
        storage.removeItem(`cp_vtt_aoe_demarcate_${suffix}`);
      }
    } catch {
      // ignore storage errors
    }
  }, [campaignId]);

  const postPacket = useCallback((type, payload = null) => {
    const transport = transportRef.current;
    if (!transport) return false;
    try {
      transport.post({
        type,
        senderWindowId: windowId,
        payload,
      });
      return true;
    } catch {
      return false;
    }
  }, [windowId]);

  useEffect(() => {
    const channelName = `${CHANNEL_PREFIX}${campaignId || "default"}`;

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
            aoeDemarcateConfig: curAoe || null,
          });
        }
        return;
      }

      if (data.type === "SYNC_STATE" && data.payload) {
        const { targetedTokenIds, targetedTokens: nextTokens, aoeDemarcateConfig: nextAoe } =
          data.payload;
        if (Array.isArray(nextTokens) || Array.isArray(targetedTokenIds)) {
          callbacksRef.current.onTargetsReceived?.({
            targetedTokenIds: Array.isArray(targetedTokenIds)
              ? targetedTokenIds
              : (nextTokens || []).map((t) => t?.id || t?.tokenId).filter(Boolean),
            targetedTokens: Array.isArray(nextTokens) ? nextTokens : [],
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
          targetedTokens: Array.isArray(nextTokens) ? nextTokens : [],
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

    let transport = null;
    try {
      transport = openCrossWindowTransport(channelName, handlePacket);
    } catch {
      transport = null;
    }
    transportRef.current = transport;

    // Solicita o snapshot mais recente ao abrir nova aba ou janela destacada (?sheetId=...)
    if (transport) postPacket("REQUEST_SYNC");

    return () => {
      if (transport) {
        try {
          transport.close();
        } catch {
          // ignore close errors
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
        targetedTokens: safeTokens,
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
        ...extra,
      });
    },
    [postPacket, windowId]
  );

  const broadcastSaveAnswered = useCallback(
    (saveId) => {
      if (!saveId) return false;
      return postPacket("SAVE_MODAL_ANSWERED", {
        saveId,
        answeredByWindowId: windowId,
      });
    },
    [postPacket, windowId]
  );

  return {
    windowId,
    broadcastTargets,
    broadcastAoeDemarcate,
    broadcastSaveClaimed,
    broadcastSaveAnswered,
  };
}
