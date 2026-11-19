import { useEffect, useMemo, useState } from "react";
import { TOKEN_KINDS } from "../domain/constants.js";
import { canControlToken } from "../domain/permissions.js";
import { notifyError } from "../services/notificationService.js";
import { subscribeSceneTokenSecrets } from "../services/tokenService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const EMPTY_SECRETS = Object.freeze({});

/**
 * Assina `tokenSecrets/{sceneId}`:
 * - Mestre real: 1 único listener na cena inteira.
 * - Jogador: listener por token não-PC que controla (evita leitura de segredos alheios).
 */
export function useTokenSecrets(sceneId, publicTokens = []) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();
  const [secretsByTokenId, setSecretsByTokenId] = useState(EMPTY_SECRETS);

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  const controllableSecretIdsKey = useMemo(() => {
    if (isRealGM || !listenerUid) return "";
    const ids = (publicTokens || [])
      .filter(
        (tok) =>
          tok?.id &&
          tok.kind !== TOKEN_KINDS.PC &&
          canControlToken(tok, { uid: listenerUid, isGM: false })
      )
      .map((tok) => tok.id)
      .sort();
    return ids.join(",");
  }, [isRealGM, listenerUid, publicTokens]);

  const active = Boolean(listenerUid && campaignId && sceneId && campaignReady);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const controllableTokenIds = controllableSecretIdsKey
      ? controllableSecretIdsKey.split(",")
      : [];

    return subscribeSceneTokenSecrets({
      campaignId,
      sceneId,
      isRealGM,
      controllableTokenIds,
      onData: setSecretsByTokenId,
      onError: notifyError
    });
  }, [active, campaignId, sceneId, isRealGM, controllableSecretIdsKey]);

  return active ? secretsByTokenId : EMPTY_SECRETS;
}
