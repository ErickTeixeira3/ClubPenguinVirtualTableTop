import { useCallback } from "react";
import {
  createCompendiumEntry,
  setCompendiumVisibility,
  softDeleteCompendiumEntry,
  updateCompendiumEntry
} from "../services/compendiumService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useCompendiumActions({ rawEntries = [] } = {}) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();

  const runWithNotice = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      notifyError(err);
      throw err;
    }
  }, []);

  const createEntry = useCallback(
    (entry = {}) =>
      runWithNotice(async () => {
        const created = await createCompendiumEntry({
          campaignId,
          user,
          gmId: campaign?.gmId || null,
          isRealGM,
          entry
        });
        return created.id;
      }),
    [runWithNotice, campaignId, user, campaign?.gmId, isRealGM]
  );

  const updateEntry = useCallback(
    (entryId, updates = {}) =>
      runWithNotice(async () => {
        const currentEntry = rawEntries.find((e) => e.id === entryId) || null;
        return await updateCompendiumEntry({
          campaignId,
          entryId,
          user,
          gmId: campaign?.gmId || null,
          isRealGM,
          updates,
          currentEntry
        });
      }),
    [runWithNotice, rawEntries, campaignId, user, campaign?.gmId, isRealGM]
  );

  const setEntryVisibility = useCallback(
    (entryId, isPublic) =>
      runWithNotice(() =>
        setCompendiumVisibility({
          campaignId,
          entryId,
          isPublic,
          user,
          gmId: campaign?.gmId || null,
          isRealGM
        })
      ),
    [runWithNotice, campaignId, user, campaign?.gmId, isRealGM]
  );

  const deleteEntry = useCallback(
    (entryId) =>
      runWithNotice(() =>
        softDeleteCompendiumEntry({
          campaignId,
          entryId,
          user,
          isRealGM
        })
      ),
    [runWithNotice, campaignId, user, isRealGM]
  );

  return {
    createEntry,
    updateEntry,
    setEntryVisibility,
    deleteEntry
  };
}
