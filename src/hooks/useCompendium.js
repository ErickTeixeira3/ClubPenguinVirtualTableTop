import { useEffect, useMemo, useState } from "react";
import { isReleasedToPlayers } from "../domain/permissions.js";
import { subscribeCompendium } from "../services/compendiumService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useCompendiumActions } from "./useCompendiumActions.js";

export function useCompendium() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawEntries, setRawEntries] = useState([]);

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;
    return subscribeCompendium({
      campaignId,
      gmId,
      isRealGM,
      uid: listenerUid,
      onData: setRawEntries,
      onError: notifyError
    });
  }, [listenerUid, campaignId, campaignReady, isRealGM, gmId]);

  const currentUid = user?.uid;
  const entries = useMemo(() => {
    if (isGM) return rawEntries;
    const viewerUid = isRealGM ? null : currentUid;
    return rawEntries.filter((e) => isReleasedToPlayers(e, viewerUid));
  }, [rawEntries, isGM, isRealGM, currentUid]);

  const actions = useCompendiumActions({ rawEntries });

  return {
    entries,
    ...actions
  };
}
