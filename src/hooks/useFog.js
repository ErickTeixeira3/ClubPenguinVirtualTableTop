import { useCallback, useEffect, useState } from "react";
import { isPointRevealed } from "../engines/fog/index.js";
import {
  addFogArea as addFogAreaService,
  resetFogCoverAll as resetFogCoverAllService,
  setFogEnabled as setFogEnabledService,
  subscribeFog
} from "../services/fogService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const EMPTY_FOG = Object.freeze({
  enabled: false,
  areas: {},
  updatedAt: null
});

export function useFog(sceneId) {
  const { user } = useAuth();
  const { campaignId, campaign, isGM } = useCampaign();
  const [fog, setFog] = useState(EMPTY_FOG);

  const active = Boolean(user?.uid && campaignId && sceneId && campaign);

  useEffect(() => {
    if (!active) return undefined;
    return subscribeFog({
      campaignId,
      sceneId,
      onData: setFog,
      onError: notifyError
    });
  }, [active, campaignId, sceneId]);

  const currentFog = active ? fog : EMPTY_FOG;

  const toggleFogEnabled = useCallback(
    async (enabled) => {
      try {
        await setFogEnabledService({
          campaignId,
          sceneId,
          enabled,
          isGM
        });
      } catch (err) {
        notifyError(err);
      }
    },
    [campaignId, sceneId, isGM]
  );

  const addFogArea = useCallback(
    async (rect, op = "reveal") => {
      try {
        return await addFogAreaService({
          campaignId,
          sceneId,
          rect,
          op,
          isGM
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, isGM]
  );

  const resetFogCoverAll = useCallback(async () => {
    try {
      await resetFogCoverAllService({
        campaignId,
        sceneId,
        isGM
      });
    } catch (err) {
      notifyError(err);
    }
  }, [campaignId, sceneId, isGM]);

  const checkPointRevealed = useCallback(
    (px, py) => isPointRevealed(px, py, currentFog),
    [currentFog]
  );

  return {
    fog: currentFog,
    toggleFogEnabled,
    addFogArea,
    resetFogCoverAll,
    isPointRevealed: checkPointRevealed
  };
}
