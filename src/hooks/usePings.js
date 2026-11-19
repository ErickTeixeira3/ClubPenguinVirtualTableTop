import { useCallback, useEffect, useState } from "react";
import { PING_KINDS } from "../domain/constants.js";
import { notifyError } from "../services/notificationService.js";
import {
  cleanupExpiredPings as cleanupExpiredPingsService,
  sendPing as sendPingService,
  subscribePings,
  subscribeServerTimeOffset
} from "../services/pingService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const EMPTY_PINGS = Object.freeze([]);

/**
 * Assina pings da cena e o `.info/serverTimeOffset` SEM nenhum intervalo periódico no hook pai (PERF-06).
 * O relógio de animação (250ms) fica isolado exclusivamente no componente `BoardPingsLayer`.
 */
export function usePings(sceneId) {
  const { user } = useAuth();
  const { campaignId, campaign } = useCampaign();
  const [pingSnapshot, setPingSnapshot] = useState({
    pings: EMPTY_PINGS,
    receivedAtMs: 0
  });
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);

  const active = Boolean(user?.uid && campaignId && sceneId && campaign);

  useEffect(() => {
    if (!active) return undefined;
    const unsubOffset = subscribeServerTimeOffset({
      onOffset: setServerTimeOffsetMs
    });
    const unsubPings = subscribePings({
      campaignId,
      sceneId,
      onData: (nextPings) => {
        setPingSnapshot({
          pings: nextPings,
          receivedAtMs: Date.now()
        });
      },
      onError: notifyError
    });
    return () => {
      unsubOffset();
      unsubPings();
    };
  }, [active, campaignId, sceneId]);

  const sendPing = useCallback(
    async (x, y, options = {}) => {
      try {
        return await sendPingService({
          campaignId,
          sceneId,
          x,
          y,
          kind: options.kind || PING_KINDS.PING,
          from: options.from || null,
          color: options.color,
          user
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, user]
  );

  const cleanupExpiredPings = useCallback(
    (pingsToCheck, serverNowMs) =>
      cleanupExpiredPingsService({
        campaignId,
        sceneId,
        pings: pingsToCheck,
        serverNowMs
      }),
    [campaignId, sceneId]
  );

  return {
    pings: active ? pingSnapshot.pings : EMPTY_PINGS,
    snapshotReceivedAtMs: active ? pingSnapshot.receivedAtMs : 0,
    serverTimeOffsetMs,
    sendPing,
    cleanupExpiredPings
  };
}
