import { ID_PREFIXES } from "../domain/constants.js";
import { openCrossWindowTransport } from "../infra/crossWindowTransport.js";
import { createId } from "../infra/ids.js";

/**
 * Camada de serviço para comunicação entre janelas da mesma campanha.
 * Substitui o acesso direto de hooks à camada `infra/` (elimina T-INFRA-2).
 */
export function createWindowId() {
  return createId(ID_PREFIXES.WINDOW);
}

export function openCampaignCrossWindowChannel({
  campaignId,
  onPacket,
  onError = null
}) {
  if (!campaignId) {
    return null;
  }
  return openCrossWindowTransport(campaignId, onPacket, { onError });
}
