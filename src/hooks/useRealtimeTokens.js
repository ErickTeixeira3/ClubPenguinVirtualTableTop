import { useEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  onValue,
  set as rtdbSet,
  update as rtdbUpdate,
  remove as rtdbRemove
} from "firebase/database";
import { rtdb } from "../services/firebase";
import { uploadCompressedMedia } from "../services/mediaService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useRealtimeTokens(sceneId) {
  const { user } = useAuth();
  const { campaignId, isRealGM, isGM } = useCampaign();
  const [tokensState, setTokensState] = useState({
    sceneKey: null,
    map: {}
  });
  const lastMoveSentRef = useRef(0);

  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const currentSceneKey = `${campaignId}:${sceneId}`;
    const sceneTokensRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${sceneId}`
    );

    const unsubscribe = onValue(
      sceneTokensRef,
      (snapshot) => {
        setTokensState({
          sceneKey: currentSceneKey,
          map: snapshot.val() || {}
        });
      },
      () => {
        setTokensState({
          sceneKey: currentSceneKey,
          map: {}
        });
      }
    );

    return () => unsubscribe();
  }, [user, campaignId, sceneId]);

  const currentSceneKey =
    user && campaignId && sceneId ? `${campaignId}:${sceneId}` : null;

  const allTokens = useMemo(() => {
    if (!currentSceneKey || tokensState.sceneKey !== currentSceneKey) {
      return [];
    }
    return Object.values(tokensState.map || {});
  }, [tokensState, currentSceneKey]);

  // Filtra tokens conforme visão Mestre vs Player
  const visibleTokens = useMemo(() => {
    if (isGM) return allTokens;
    return allTokens.filter((t) => t.visibleToPlayers !== false);
  }, [allTokens, isGM]);

  const canControlToken = (token) => {
    if (!user || !token) return false;
    if (isGM) return true;
    const list = Array.isArray(token.controlledBy) ? token.controlledBy : [];
    return list.includes("ALL") || list.includes(user.uid);
  };

  const addToken = async ({
    name,
    file = null,
    externalUrl = "",
    mediaId = null,
    characterId = null,
    layer = "tokens",
    sizeInCells = 1,
    ringColor = "#3090f0",
    visibleToPlayers = true,
    controlledBy = ["ALL"],
    hpCurrent = null,
    hpMax = null,
    showBarsToPlayers = true,
    x = 128,
    y = 128
  }) => {
    if (!user || !campaignId || !sceneId) return null;

    let finalMediaId = mediaId;
    if (file) {
      const uploaded = await uploadCompressedMedia({
        file,
        category: "token",
        campaignId,
        uploadedBy: user.uid
      });
      finalMediaId = uploaded.mediaId;
    }

    const tokenId = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${sceneId}/${tokenId}`
    );

    const validLayer =
      isGM && ["map", "objects", "tokens"].includes(layer) ? layer : "tokens";

    const newToken = {
      id: tokenId,
      name: name?.trim() || "Token",
      characterId: characterId || null,
      layer: validLayer,
      mediaId: finalMediaId || null,
      externalUrl: externalUrl?.trim() || null,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      sizeInCells: Math.max(1, Math.min(8, Number(sizeInCells) || 1)),
      rotation: 0,
      ringColor: ringColor || "#3090f0",
      visibleToPlayers: Boolean(visibleToPlayers),
      controlledBy: Array.isArray(controlledBy) ? controlledBy : [user.uid],
      hpCurrent: hpCurrent !== null && hpCurrent !== "" ? Number(hpCurrent) : null,
      hpMax: hpMax !== null && hpMax !== "" ? Number(hpMax) : null,
      showBarsToPlayers: Boolean(showBarsToPlayers),
      updatedBy: user.uid,
      updatedAt: Date.now()
    };

    await rtdbSet(tokenRef, newToken);
    return tokenId;
  };

  const moveTokenRealtime = (tokenId, x, y, forceImmediate = false) => {
    if (!user || !campaignId || !sceneId || !tokenId) return;

    const now = Date.now();
    if (!forceImmediate && now - lastMoveSentRef.current < 40) {
      return;
    }
    lastMoveSentRef.current = now;

    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${sceneId}/${tokenId}`
    );
    rtdbUpdate(tokenRef, {
      x: Math.round(x),
      y: Math.round(y),
      updatedBy: user.uid,
      updatedAt: now
    }).catch(() => {});
  };

  const updateToken = async (tokenId, updates = {}, newFile = null) => {
    if (!user || !campaignId || !sceneId || !tokenId) return;

    const payload = {
      ...updates,
      updatedBy: user.uid,
      updatedAt: Date.now()
    };

    if (newFile) {
      const uploaded = await uploadCompressedMedia({
        file: newFile,
        category: "token",
        campaignId,
        uploadedBy: user.uid
      });
      payload.mediaId = uploaded.mediaId;
      payload.externalUrl = null;
    }

    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${sceneId}/${tokenId}`
    );
    await rtdbUpdate(tokenRef, payload);
  };

  const removeToken = async (tokenId) => {
    if (!user || !campaignId || !sceneId || !tokenId || !isRealGM) return;
    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${sceneId}/${tokenId}`
    );
    await rtdbRemove(tokenRef);
  };

  return {
    tokens: visibleTokens,
    allTokens,
    canControlToken,
    addToken,
    moveTokenRealtime,
    updateToken,
    removeToken
  };
}

