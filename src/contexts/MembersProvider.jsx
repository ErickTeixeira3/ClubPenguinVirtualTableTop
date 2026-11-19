import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCachedMediaSync, getMediaDataUrl } from "../services/mediaService.js";
import * as memberService from "../services/memberService.js";
import { notifyError } from "../services/notificationService.js";
import * as profileService from "../services/profileService.js";
import { useAuth } from "./AuthContext.jsx";
import { useCampaign } from "./CampaignContext.jsx";
import { MembersContext } from "./MembersContext.js";

export default function MembersProvider({ children }) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();

  const [membersState, setMembersState] = useState({
    sessionKey: null,
    items: [],
    error: ""
  });
  const [invitesState, setInvitesState] = useState({
    sessionKey: null,
    items: []
  });
  const [resolvedAvatars, setResolvedAvatars] = useState({});
  const avatarRequestsRef = useRef(new Set());
  const pendingAvatarAttemptedRef = useRef(new Set());

  const uid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;
  const activeKey = uid && campaignId && campaignReady ? `${uid}:${campaignId}` : null;

  useEffect(() => {
    if (!activeKey) return undefined;

    return memberService.subscribeMembers({
      campaignId,
      onData: (list) => {
        setMembersState({
          sessionKey: activeKey,
          items: list,
          error: ""
        });
      },
      onError: (err) => {
        const msg = err?.message || "Erro ao carregar membros da campanha.";
        setMembersState({
          sessionKey: activeKey,
          items: [],
          error: msg
        });
        notifyError(msg);
      }
    });
  }, [activeKey, campaignId]);

  useEffect(() => {
    if (!activeKey || !isRealGM) return undefined;

    return memberService.subscribeInvites({
      campaignId,
      onData: (list) => {
        setInvitesState({
          sessionKey: activeKey,
          items: list
        });
      },
      onError: (err) => {
        notifyError(err?.message || "Erro ao carregar convites da campanha.");
      }
    });
  }, [activeKey, campaignId, isRealGM]);

  const members = useMemo(
    () => (activeKey && membersState.sessionKey === activeKey ? membersState.items : []),
    [activeKey, membersState]
  );

  const invites = useMemo(
    () =>
      activeKey && isRealGM && invitesState.sessionKey === activeKey
        ? invitesState.items
        : [],
    [activeKey, isRealGM, invitesState]
  );

  // Resolve avatares em cache / Firestore media para exibição na UI
  useEffect(() => {
    if (!activeKey || members.length === 0) return;

    let cancelled = false;
    for (const member of members) {
      const mediaId = member?.avatar?.mediaId;
      if (!mediaId) continue;
      const cacheKey = `${campaignId}:${mediaId}`;
      if (resolvedAvatars[cacheKey] || avatarRequestsRef.current.has(cacheKey)) {
        continue;
      }
      const syncUrl = getCachedMediaSync(mediaId, campaignId);
      if (syncUrl) {
        avatarRequestsRef.current.add(cacheKey);
        Promise.resolve().then(() => {
          if (!cancelled) {
            setResolvedAvatars((prev) =>
              prev[cacheKey] === syncUrl ? prev : { ...prev, [cacheKey]: syncUrl }
            );
          }
        });
        continue;
      }

      avatarRequestsRef.current.add(cacheKey);
      getMediaDataUrl(mediaId, campaignId)
        .then((dataUrl) => {
          if (!cancelled && dataUrl) {
            setResolvedAvatars((prev) => ({ ...prev, [cacheKey]: dataUrl }));
          }
        })
        .catch((err) => {
          avatarRequestsRef.current.delete(cacheKey);
          notifyError(err?.message || "Não foi possível carregar o avatar do membro.");
        });
    }

    return () => {
      cancelled = true;
    };
  }, [activeKey, campaignId, members, resolvedAvatars]);

  const myMember = useMemo(
    () => (uid ? members.find((m) => m.uid === uid) || null : null),
    [members, uid]
  );

  // Envia avatar pendente do cadastro somente após o usuário virar membro na campanha
  useEffect(() => {
    if (!activeKey || !myMember) return;
    if (pendingAvatarAttemptedRef.current.has(activeKey)) return;
    pendingAvatarAttemptedRef.current.add(activeKey);

    profileService
      .migratePendingAvatar({
        campaignId,
        uid,
        currentMember: myMember
      })
      .then((res) => {
        if (res?.avatar?.mediaId && res?.uploadedDataUrl) {
          const cacheKey = `${campaignId}:${res.avatar.mediaId}`;
          setResolvedAvatars((prev) => ({
            ...prev,
            [cacheKey]: res.uploadedDataUrl
          }));
        }
      })
      .catch((err) => {
        notifyError(err?.message || "Falha ao enviar a foto de cadastro.");
      });
  }, [activeKey, campaignId, uid, myMember]);

  const scopedResolvedAvatars = useMemo(() => {
    const out = {};
    const prefix = `${campaignId}:`;
    for (const [k, url] of Object.entries(resolvedAvatars)) {
      if (k.startsWith(prefix)) {
        out[k.slice(prefix.length)] = url;
      }
    }
    for (const member of members) {
      const mediaId = member?.avatar?.mediaId;
      if (mediaId && !out[mediaId]) {
        const syncUrl = getCachedMediaSync(mediaId, campaignId);
        if (syncUrl) {
          out[mediaId] = syncUrl;
        }
      }
    }
    return out;
  }, [campaignId, resolvedAvatars, members]);

  // TRANSITION(T1): playersMap derivado de members para consumidores ainda v1 (remover na Fase 11)
  const playersMap = useMemo(
    () => memberService.buildPlayersMapFromMembers(members, gmId, scopedResolvedAvatars),
    [members, gmId, scopedResolvedAvatars]
  );

  const myPlayerProfile = useMemo(
    () => (uid && playersMap[uid]) || null,
    [uid, playersMap]
  );

  const inviteMember = useCallback(
    async ({ email, defaultDisplayName }) => {
      if (!isRealGM || !campaignId) return null;
      try {
        return await memberService.inviteMember({
          campaignId,
          email,
          defaultDisplayName
        });
      } catch (err) {
        notifyError(err?.message || "Erro ao enviar convite.");
        throw err;
      }
    },
    [isRealGM, campaignId]
  );

  const revokeMember = useCallback(
    async (targetUid) => {
      if (!isRealGM || !campaignId) return null;
      try {
        return await memberService.revokeMember({
          campaignId,
          targetUid,
          currentGmId: gmId
        });
      } catch (err) {
        notifyError(err?.message || "Erro ao remover membro.");
        throw err;
      }
    },
    [isRealGM, campaignId, gmId]
  );

  const revokeInvite = useCallback(
    async (email) => {
      if (!isRealGM || !campaignId) return null;
      try {
        return await memberService.revokeInvite({
          campaignId,
          email,
          currentGmId: gmId
        });
      } catch (err) {
        notifyError(err?.message || "Erro ao remover convite.");
        throw err;
      }
    },
    [isRealGM, campaignId, gmId]
  );

  const updateMyProfile = useCallback(
    async (params) => {
      if (!uid || !campaignId) return null;
      try {
        const res = await profileService.updateMemberProfile({
          campaignId,
          uid,
          currentMember: myMember,
          ...params
        });
        if (res?.avatar?.mediaId && res?.uploadedDataUrl) {
          const cacheKey = `${campaignId}:${res.avatar.mediaId}`;
          setResolvedAvatars((prev) => ({
            ...prev,
            [cacheKey]: res.uploadedDataUrl
          }));
        }
        return res;
      } catch (err) {
        notifyError(err?.message || "Erro ao atualizar perfil.");
        throw err;
      }
    },
    [uid, campaignId, myMember]
  );

  const compressAvatarFile = useCallback(
    (file) => profileService.compressAvatarFile(file),
    []
  );

  const membersError =
    activeKey && membersState.sessionKey === activeKey ? membersState.error : "";

  const value = useMemo(
    () => ({
      members,
      invites,
      membersError,
      myMember,
      playersMap,
      myPlayerProfile,
      inviteMember,
      revokeMember,
      revokeInvite,
      updateMyProfile,
      compressAvatarFile
    }),
    [
      members,
      invites,
      membersError,
      myMember,
      playersMap,
      myPlayerProfile,
      inviteMember,
      revokeMember,
      revokeInvite,
      updateMyProfile,
      compressAvatarFile
    ]
  );

  return (
    <MembersContext.Provider value={value}>{children}</MembersContext.Provider>
  );
}
