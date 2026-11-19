import { useEffect, useRef } from "react";
import {
  evaluatePendingMessage,
  subscribePendingHitEvaluations
} from "../services/refereeService.js";
import { notifyError } from "../services/notificationService.js";

/** Runs only in the real GM main window; processing is idempotent by status. */
export function useRefereeLoop({
  campaignId,
  isRealGM,
  isMainWindow = true,
  tokens = [],
  tokenSecretsById = {},
  characters = []
}) {
  const inFlightRef = useRef(new Set());

  useEffect(() => {
    if (!campaignId || !isRealGM || !isMainWindow) return undefined;
    return subscribePendingHitEvaluations({
      campaignId,
      onData: async (messages) => {
        for (const message of messages) {
          if (!message?.id || inFlightRef.current.has(message.id)) continue;
          inFlightRef.current.add(message.id);
          try {
            await evaluatePendingMessage({
              campaignId,
              message,
              tokens,
              tokenSecretsById,
              characters
            });
          } catch (error) {
            notifyError(error);
          } finally {
            inFlightRef.current.delete(message.id);
          }
        }
      },
      onError: notifyError
    });
  }, [campaignId, isRealGM, isMainWindow, tokens, tokenSecretsById, characters]);
}

export default useRefereeLoop;

