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
import { IS_SPLIT_RTDB_LAYOUT } from "../services/rtdbPaths";
import {
  hasControlledByAccess,
  normalizeControlledByList,
  toControlledByMap
} from "../engines/combatEngine";

function needsControlledByMapMigration(rawControlledBy) {
  if (Array.isArray(rawControlledBy)) return true;
  if (!rawControlledBy || typeof rawControlledBy !== "object") return false;
  return Object.entries(rawControlledBy).some(
    ([k, v]) => /^\d+$/.test(k) && typeof v === "string"
  );
}

export function useRealtimeTokens(sceneId) {
  const { user } = useAuth();
  const { campaignId, campaign, isGM, isRealGM } = useCampaign();
  const [tokensState, setTokensState] = useState({
    sceneKey: null,
    map: {}
  });
  const lastMoveSentRef = useRef(0);
  const migratedControlledTokensRef = useRef(new Set());

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

  // Fase 6.7 (A33): migração idempotente de `controlledBy` legado (array) para mapa `{ uid: true }` no RTDB
  useEffect(() => {
    if (!IS_SPLIT_RTDB_LAYOUT || !isRealGM || !user || !campaignId || !sceneId) return;
    if (tokensState.sceneKey !== `${campaignId}:${sceneId}`) return;
    const entries = Object.entries(tokensState.map || {});
    for (const [tokId, tok] of entries) {
      if (!tok || !needsControlledByMapMigration(tok.controlledBy)) continue;
      const attemptKey = `${campaignId}:${sceneId}:${tokId}`;
      if (migratedControlledTokensRef.current.has(attemptKey)) continue;
      migratedControlledTokensRef.current.add(attemptKey);
      rtdbUpdate(
        ref(rtdb, `vtt_realtime/${campaignId}/tokens/${sceneId}/${tokId}`),
        { controlledBy: toControlledByMap(tok.controlledBy) }
      ).catch(() => {
        migratedControlledTokensRef.current.delete(attemptKey);
      });
    }
  }, [tokensState, isRealGM, user, campaignId, sceneId]);

  const canControlToken = (token) => {
    if (!user || !token) return false;
    if (isGM) return true;
    if (token.ownerId === user.uid) return true;
    return hasControlledByAccess(token.controlledBy, user.uid);
  };

  const canDeleteToken = (token) => {
    if (!user || !token) return false;
    if (isGM) return true;
    return token.ownerId === user.uid;
  };

  const addToken = async ({
    name,
    file = null,
    externalUrl = "",
    mediaId = null,
    characterId = null,
    characterType = null,
    ownerId = null,
    isGmToken = null,
    layer = "tokens",
    sizeInCells = 1,
    ringColor = "#3090f0",
    visibleToPlayers = true,
    controlledBy = { ALL: true },
    defense = 10,
    hpCurrent = null,
    hpMax = null,
    mpCurrent = null,
    mpMax = null,
    showBarsToPlayers = true,
    showName = true,
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

    const effectiveOwnerId = isGM ? ownerId || user.uid : user.uid;
    const effectiveVisibleToPlayers = isGM ? Boolean(visibleToPlayers) : true;
    const requestedControllers = normalizeControlledByList(controlledBy);
    const effectiveControlledBy = isGM
      ? toControlledByMap(
          requestedControllers.length > 0 ? requestedControllers : [user.uid]
        )
      : toControlledByMap([campaign?.gmId, user.uid]);

    // Fase 3.1 (V-17): só o Mestre pode marcar um token como instância de matriz GM/NPC.
    // Para jogadores, isGmToken é sempre false e characterType nunca é "npc", impedindo que
    // um jogador desligue a sincronização Ficha↔Token do próprio PC.
    const effectiveIsGmToken = isGM
      ? typeof isGmToken === "boolean"
        ? isGmToken
        : Boolean(
            characterType === "npc" ||
              (campaign?.gmId && effectiveOwnerId === campaign.gmId)
          )
      : false;
    const effectiveCharacterType = isGM
      ? characterType || null
      : characterType === "npc"
        ? "pc"
        : characterType || null;

    const newToken = {
      id: tokenId,
      campaignId,
      sceneId,
      name: name?.trim() || "Token",
      characterId: characterId || null,
      characterType: effectiveCharacterType,
      ownerId: effectiveOwnerId,
      isGmToken: effectiveIsGmToken,
      layer: validLayer,
      mediaId: finalMediaId || null,
      externalUrl: externalUrl?.trim() || null,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      sizeInCells: Math.max(1, Math.min(8, Number(sizeInCells) || 1)),
      rotation: 0,
      ringColor: ringColor || "#3090f0",
      visibleToPlayers: effectiveVisibleToPlayers,
      controlledBy: effectiveControlledBy,
      defense:
        defense !== null && defense !== undefined && defense !== ""
          ? Number(defense)
          : 10,
      hpCurrent:
        hpCurrent !== null && hpCurrent !== undefined && hpCurrent !== ""
          ? Number(hpCurrent)
          : null,
      hpMax:
        hpMax !== null && hpMax !== undefined && hpMax !== ""
          ? Number(hpMax)
          : null,
      mpCurrent:
        mpCurrent !== null && mpCurrent !== undefined && mpCurrent !== ""
          ? Number(mpCurrent)
          : null,
      mpMax:
        mpMax !== null && mpMax !== undefined && mpMax !== ""
          ? Number(mpMax)
          : null,
      showBarsToPlayers: Boolean(showBarsToPlayers),
      showName: showName !== false,
      updatedBy: user.uid,
      updatedAt: Date.now()
    };

    await rtdbSet(tokenRef, newToken);
    return tokenId;
  };

  const moveTokenRealtime = (tokenId, x, y, forceImmediate = false) => {
    if (!user || !campaignId || !sceneId || !tokenId) return;
    const existing = tokensState.map?.[tokenId];
    if (!existing || !canControlToken(existing)) return;

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
    if (!user || !campaignId || !sceneId || !tokenId) return null;
    const existing = tokensState.map?.[tokenId];
    if (!existing || !canControlToken(existing)) return null;

    const sanitizedUpdates = { ...updates };
    if (!isGM) {
      delete sanitizedUpdates.controlledBy;
      delete sanitizedUpdates.ownerId;
      delete sanitizedUpdates.layer;
      delete sanitizedUpdates.visibleToPlayers;
      delete sanitizedUpdates.characterId;
      delete sanitizedUpdates.characterType;
      delete sanitizedUpdates.isGmToken;
    } else if ("controlledBy" in sanitizedUpdates) {
      sanitizedUpdates.controlledBy = toControlledByMap(sanitizedUpdates.controlledBy);
    }

    const payload = {
      ...sanitizedUpdates,
      campaignId,
      sceneId,
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
    return payload;
  };

  const removeToken = async (tokenId) => {
    if (!user || !campaignId || !sceneId || !tokenId) return;
    const existing = tokensState.map?.[tokenId];
    if (!existing || !canDeleteToken(existing)) return;

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
    canDeleteToken,
    addToken,
    moveTokenRealtime,
    updateToken,
    removeToken
  };
}

