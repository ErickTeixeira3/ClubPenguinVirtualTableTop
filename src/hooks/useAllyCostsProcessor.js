import { useEffect, useRef } from "react";
import {
  applyPendingAllyCost,
  subscribePendingAllyCosts
} from "../services/allyCostService.js";
import { notifyError } from "../services/notificationService.js";

export function useAllyCostsProcessor({
  campaignId,
  uid,
  isGM = false,
  editableCharacterIds = [],
  enabled = true,
  onApplied = null
}) {
  const inFlightRef = useRef(new Set());
  const editableIdsKey = Array.from(
    new Set(editableCharacterIds.filter(Boolean))
  )
    .sort()
    .join("\u001f");

  useEffect(() => {
    if (!enabled || !campaignId || !uid) return undefined;
    const ids = isGM ? [null] : editableIdsKey.split("\u001f").filter(Boolean);
    if (!isGM && ids.length === 0) return undefined;

    const process = async (pendingCosts) => {
      for (const pending of pendingCosts) {
        if (!pending?.opId || inFlightRef.current.has(pending.opId)) continue;
        inFlightRef.current.add(pending.opId);
        try {
          const result = await applyPendingAllyCost({
            campaignId,
            opId: pending.opId,
            appliedBy: uid
          });
          onApplied?.(result);
        } catch (error) {
          notifyError(error);
        } finally {
          inFlightRef.current.delete(pending.opId);
        }
      }
    };

    const unsubscribers = ids.map((characterId) =>
      subscribePendingAllyCosts({
        campaignId,
        characterId,
        isGM,
        onData: process,
        onError: notifyError
      })
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [
    campaignId,
    uid,
    isGM,
    enabled,
    onApplied,
    editableIdsKey
  ]);
}

export default useAllyCostsProcessor;

