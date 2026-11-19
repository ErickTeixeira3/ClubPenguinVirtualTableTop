import { useCallback, useEffect, useMemo, useState } from "react";
import { canControlToken } from "../domain/permissions.js";
import { notifyError } from "../services/notificationService.js";
import {
  adjustTokenResource as adjustTokenResourceService,
  createFreeToken as createFreeTokenService,
  moveToken as moveTokenService,
  removeToken as removeTokenService,
  setTokenVisibility as setTokenVisibilityService,
  subscribeSceneTokens,
  updateTokenAdmin as updateTokenAdminService,
  updateTokenEditable as updateTokenEditableService,
  uploadTokenMedia as uploadTokenMediaService
} from "../services/tokenService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const EMPTY_STATE = Object.freeze({
  publicTokens: [],
  hiddenTokens: [],
  tokens: [],
  hiddenTokenIds: new Set()
});

export function useSceneTokens(sceneId, { fog = null, cellSizePx = 64 } = {}) {
  const { user } = useAuth();
  const { campaignId, campaign, isGM, isRealGM } = useCampaign();
  const [tokenState, setTokenState] = useState(EMPTY_STATE);
  const [loadedSceneKey, setLoadedSceneKey] = useState(null);

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;
  const currentSceneKey =
    listenerUid && campaignId && sceneId && campaignReady
      ? `${campaignId}:${sceneId}:${isRealGM ? "gm" : "p"}`
      : null;

  useEffect(() => {
    if (!currentSceneKey) {
      return undefined;
    }

    return subscribeSceneTokens({
      campaignId,
      sceneId,
      isRealGM,
      onData: (data) => {
        setTokenState(data);
        setLoadedSceneKey(currentSceneKey);
      },
      onError: notifyError
    });
  }, [currentSceneKey, campaignId, sceneId, isRealGM]);

  const activeState = currentSceneKey ? tokenState : EMPTY_STATE;
  const loading = Boolean(currentSceneKey && loadedSceneKey !== currentSceneKey);
  const loaded = Boolean(currentSceneKey && loadedSceneKey === currentSceneKey);

  // Na Visão Player do Mestre real, mostra apenas tokens públicos (hiddenTokens fica oculto).
  const visibleTokens = useMemo(() => {
    if (isGM) {
      return activeState.tokens;
    }
    return activeState.publicTokens;
  }, [isGM, activeState.tokens, activeState.publicTokens]);

  const isTokenInHiddenBucket = useCallback(
    (tokenId) => activeState.hiddenTokenIds.has(tokenId),
    [activeState.hiddenTokenIds]
  );

  const canControl = useCallback(
    (token) =>
      canControlToken(token, {
        uid: user?.uid,
        isGM
      }),
    [user?.uid, isGM]
  );

  const createFreeToken = useCallback(
    async (data) => {
      try {
        return await createFreeTokenService({
          campaignId,
          sceneId,
          user,
          isGM,
          gmId,
          data,
          fog,
          cellSizePx
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, user, isGM, gmId, fog, cellSizePx]
  );

  const moveToken = useCallback(
    async (tokenId, x, y, rotation = undefined) => {
      try {
        await moveTokenService({
          campaignId,
          sceneId,
          tokenId,
          x,
          y,
          rotation,
          inHiddenBucket: isTokenInHiddenBucket(tokenId),
          user
        });
      } catch (err) {
        notifyError(err);
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket, user]
  );

  const updateTokenEditable = useCallback(
    async (token, patch) => {
      try {
        return await updateTokenEditableService({
          campaignId,
          sceneId,
          token,
          inHiddenBucket: isTokenInHiddenBucket(token.id),
          patch,
          user
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket, user]
  );

  const updateTokenAdmin = useCallback(
    async (token, patch, { currentSecret = null, secretPatch = null } = {}) => {
      try {
        return await updateTokenAdminService({
          campaignId,
          sceneId,
          token,
          currentSecret,
          inHiddenBucket: isTokenInHiddenBucket(token.id),
          patch,
          secretPatch,
          fog,
          cellSizePx,
          gmId,
          user,
          isGM
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket, fog, cellSizePx, gmId, user, isGM]
  );

  const adjustTokenResource = useCallback(
    async (token, resourceKey, delta, { opId = null } = {}) => {
      try {
        return await adjustTokenResourceService({
          campaignId,
          sceneId,
          token,
          inHiddenBucket: isTokenInHiddenBucket(token.id),
          resourceKey,
          delta,
          opId,
          user
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket, user]
  );

  const setTokenVisibility = useCallback(
    async (token, hidden) => {
      try {
        return await setTokenVisibilityService({
          campaignId,
          sceneId,
          token,
          inHiddenBucket: isTokenInHiddenBucket(token.id),
          hidden,
          fog,
          cellSizePx,
          gmId,
          user,
          isGM
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket, fog, cellSizePx, gmId, user, isGM]
  );

  const uploadTokenMedia = useCallback(
    async ({ compressed, visibleTo = ["ALL"] }) => {
      try {
        return await uploadTokenMediaService({
          campaignId,
          compressed,
          user,
          visibleTo
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, user]
  );

  const removeToken = useCallback(
    async (token) => {
      try {
        await removeTokenService({
          campaignId,
          sceneId,
          token,
          inHiddenBucket: isTokenInHiddenBucket(token.id)
        });
      } catch (err) {
        notifyError(err);
        throw err;
      }
    },
    [campaignId, sceneId, isTokenInHiddenBucket]
  );

  return {
    tokens: visibleTokens,
    allTokens: activeState.tokens,
    publicTokens: activeState.publicTokens,
    hiddenTokens: activeState.hiddenTokens,
    hiddenTokenIds: activeState.hiddenTokenIds,
    isTokenInHiddenBucket,
    loading,
    loaded,
    canControl,
    createFreeToken,
    moveToken,
    updateTokenEditable,
    updateTokenAdmin,
    adjustTokenResource,
    setTokenVisibility,
    uploadTokenMedia,
    removeToken
  };
}
