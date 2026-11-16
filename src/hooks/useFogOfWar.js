import { useEffect, useMemo, useState } from "react";
import {
  ref,
  onValue,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import { rtdb } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useFogOfWar(sceneId) {
  const { user } = useAuth();
  const { campaignId, isRealGM } = useCampaign();

  const [fogDataState, setFogDataState] = useState({
    sceneKey: null,
    enabled: false,
    areas: {}
  });

  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const currentSceneKey = `${campaignId}:${sceneId}`;
    const enabledRef = ref(rtdb, `vtt_realtime/${campaignId}/fog/${sceneId}/enabled`);
    const areasRef = ref(rtdb, `vtt_realtime/${campaignId}/fog/${sceneId}/areas`);

    const unsubEnabled = onValue(
      enabledRef,
      (snapshot) => {
        setFogDataState((prev) => ({
          sceneKey: currentSceneKey,
          enabled: Boolean(snapshot.val()),
          areas: prev.sceneKey === currentSceneKey ? prev.areas : {}
        }));
      },
      () => {
        setFogDataState((prev) => ({
          sceneKey: currentSceneKey,
          enabled: false,
          areas: prev.sceneKey === currentSceneKey ? prev.areas : {}
        }));
      }
    );

    const unsubAreas = onValue(
      areasRef,
      (snapshot) => {
        setFogDataState((prev) => ({
          sceneKey: currentSceneKey,
          enabled: prev.sceneKey === currentSceneKey ? prev.enabled : false,
          areas: snapshot.val() || {}
        }));
      },
      () => {
        setFogDataState((prev) => ({
          sceneKey: currentSceneKey,
          enabled: prev.sceneKey === currentSceneKey ? prev.enabled : false,
          areas: {}
        }));
      }
    );

    return () => {
      unsubEnabled();
      unsubAreas();
    };
  }, [user, campaignId, sceneId]);

  const currentSceneKey =
    user && campaignId && sceneId ? `${campaignId}:${sceneId}` : null;

  const fogState = useMemo(() => {
    const isCurrent = currentSceneKey && fogDataState.sceneKey === currentSceneKey;
    const areasMap = isCurrent ? fogDataState.areas || {} : {};
    const areasList = Object.values(areasMap).sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );

    return {
      enabled: isCurrent ? Boolean(fogDataState.enabled) : false,
      areas: areasList
    };
  }, [fogDataState, currentSceneKey]);

  const toggleFogEnabled = async (nextEnabled) => {
    if (!isRealGM || !campaignId || !sceneId) return;
    const fogRef = ref(rtdb, `vtt_realtime/${campaignId}/fog/${sceneId}`);
    await rtdbUpdate(fogRef, {
      campaignId,
      sceneId,
      enabled: Boolean(nextEnabled),
      updatedAt: Date.now()
    });
  };

  // op: 'reveal' | 'hide'
  const addFogArea = async ({ x, y, w, h, op = "reveal" }) => {
    if (!isRealGM || !campaignId || !sceneId) return;
    if (w < 8 || h < 8) return;

    const areaId = `area_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const areaRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/areas/${areaId}`
    );

    await rtdbSet(areaRef, {
      id: areaId,
      campaignId,
      sceneId,
      op,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(w),
      h: Math.round(h),
      createdAt: Date.now()
    });
  };

  // Cobre todo o mapa novamente (limpa áreas reveladas preservando desenhos)
  const resetFogCoverAll = async () => {
    if (!isRealGM || !campaignId || !sceneId) return;
    const fogRef = ref(rtdb, `vtt_realtime/${campaignId}/fog/${sceneId}`);
    await rtdbUpdate(fogRef, {
      campaignId,
      sceneId,
      enabled: true,
      areas: null,
      updatedAt: Date.now()
    });
  };

  // Verifica se um ponto (centro de um token) está em área revelada quando a névoa está ativa
  const isPointRevealed = (px, py) => {
    if (!fogState.enabled) return true;
    let revealed = false;
    for (const area of fogState.areas) {
      const inside =
        px >= area.x &&
        px <= area.x + area.w &&
        py >= area.y &&
        py <= area.y + area.h;
      if (inside) {
        revealed = area.op === "reveal";
      }
    }
    return revealed;
  };

  return {
    fogEnabled: fogState.enabled,
    fogAreas: fogState.areas,
    toggleFogEnabled,
    addFogArea,
    resetFogCoverAll,
    isPointRevealed
  };
}

