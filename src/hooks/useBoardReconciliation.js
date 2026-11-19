import { useEffect, useRef, useState } from "react";
import { DEFAULT_CELL_SIZE_PX } from "../domain/constants.js";
import { notifyError } from "../services/notificationService.js";
import {
  reconcileSceneFogPartition,
  reconcileScenePcProjections
} from "../services/tokenService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useOptionalRuntimeConfig } from "../contexts/RuntimeConfigContext";

/**
 * Reconciliação automática do tabuleiro (Fase 8):
 * 1. Projeções PC atrasadas (`character.rev > token.rev`) — convergente para Mestre ou controlador.
 * 2. Partição público/oculto por névoa de guerra (`tokens/` ↔ `hiddenTokens/`) — exclusiva do Mestre real.
 */
export function useBoardReconciliation({
  sceneId,
  characters = [],
  publicTokens = [],
  hiddenTokens = [],
  tokensLoaded = false,
  fog = null,
  cellSizePx = DEFAULT_CELL_SIZE_PX
}) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();
  const runtimeConfig = useOptionalRuntimeConfig();
  const clientVersionBlocked = Boolean(runtimeConfig?.clientVersionBlocked);

  const runningPcRef = useRef(false);
  const pendingPcRef = useRef(false);
  const [pcRetryTick, setPcRetryTick] = useState(0);

  const runningFogRef = useRef(false);
  const pendingFogRef = useRef(false);
  const [fogRetryTick, setFogRetryTick] = useState(0);

  // 1. Reconciliação de projeções PC (Firestore rev -> RTDB rev)
  useEffect(() => {
    if (clientVersionBlocked || !tokensLoaded || !campaignId || !sceneId || !user?.uid) {
      return;
    }
    if (runningPcRef.current) {
      pendingPcRef.current = true;
      return;
    }

    runningPcRef.current = true;
    pendingPcRef.current = false;
    reconcileScenePcProjections({
      campaignId,
      sceneId,
      characters,
      publicTokens,
      hiddenTokens,
      user,
      isGM: isRealGM
    })
      .catch((err) => {
        notifyError(err);
      })
      .finally(() => {
        runningPcRef.current = false;
        if (pendingPcRef.current) {
          pendingPcRef.current = false;
          setPcRetryTick((t) => t + 1);
        }
      });
  }, [
    clientVersionBlocked,
    tokensLoaded,
    campaignId,
    sceneId,
    user,
    isRealGM,
    characters,
    publicTokens,
    hiddenTokens,
    pcRetryTick
  ]);

  // 2. Partição público/oculto pela névoa (Mestre real apenas)
  useEffect(() => {
    if (
      clientVersionBlocked ||
      !isRealGM ||
      !tokensLoaded ||
      !campaignId ||
      !sceneId ||
      !user?.uid
    ) {
      return;
    }
    if (runningFogRef.current) {
      pendingFogRef.current = true;
      return;
    }

    runningFogRef.current = true;
    pendingFogRef.current = false;
    reconcileSceneFogPartition({
      campaignId,
      sceneId,
      publicTokens,
      hiddenTokens,
      fog,
      cellSizePx,
      gmId: campaign?.gmId || null,
      user,
      isGM: isRealGM
    })
      .catch((err) => {
        notifyError(err);
      })
      .finally(() => {
        runningFogRef.current = false;
        if (pendingFogRef.current) {
          pendingFogRef.current = false;
          setFogRetryTick((t) => t + 1);
        }
      });
  }, [
    clientVersionBlocked,
    isRealGM,
    tokensLoaded,
    campaignId,
    sceneId,
    user,
    campaign?.gmId,
    publicTokens,
    hiddenTokens,
    fog,
    cellSizePx,
    fogRetryTick
  ]);
}
