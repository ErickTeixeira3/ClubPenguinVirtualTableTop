import { useEffect, useState } from "react";
import { FOLDER_DOMAINS } from "../domain/constants.js";
import { subscribeFolders } from "../services/folderService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const VALID_DOMAINS = new Set(Object.values(FOLDER_DOMAINS));

/**
 * Assina em tempo real a subcoleção unificada `campaigns/{campaignId}/folders`
 * filtrada pelo domínio (`"character"` ou `"journal"`).
 *
 * Delega toda leitura/conversão/ordenação para `folderService.subscribeFolders` e
 * reporta falhas via `notificationService.notifyError`.
 */
export function useFolders(domain) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();
  const [folders, setFolders] = useState([]);

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;

  useEffect(() => {
    if (!VALID_DOMAINS.has(domain) || !listenerUid || !campaignId || !campaignReady) {
      return;
    }

    return subscribeFolders({
      campaignId,
      domain,
      gmId,
      isRealGM,
      uid: listenerUid,
      onData: setFolders,
      onError: notifyError
    });
  }, [domain, listenerUid, campaignId, campaignReady, isRealGM, gmId]);

  return { folders, setFolders };
}
