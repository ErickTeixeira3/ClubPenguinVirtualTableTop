import { useCallback, useEffect, useMemo, useState } from "react";
import { PRESENCE_KINDS } from "../domain/constants.js";
import { notifyError } from "../services/notificationService.js";
import * as presenceService from "../services/presenceService.js";
import { useAuth } from "./AuthContext.jsx";
import { useCampaign } from "./CampaignContext.jsx";
import { useMembers } from "./MembersContext.js";
import { PresenceContext } from "./PresenceContext.js";

function resolveWindowPresenceTarget() {
  if (typeof window === "undefined") {
    return { kind: PRESENCE_KINDS.MAIN, sheetId: null };
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const sheetId = params.get("sheetId")?.trim();
    if (sheetId) {
      return { kind: PRESENCE_KINDS.SHEET, sheetId };
    }
  } catch {
    // Ignore malformed search query
  }
  return { kind: PRESENCE_KINDS.MAIN, sheetId: null };
}

export default function PresenceProvider({ children }) {
  const { user } = useAuth();
  const { campaignId, campaign } = useCampaign();
  const { playersMap } = useMembers();

  const [connId] = useState(presenceService.generatePresenceConnectionId);
  const windowTarget = useMemo(() => resolveWindowPresenceTarget(), []);
  const [rtdbConnected, setRtdbConnected] = useState(false);
  const [presenceState, setPresenceState] = useState({
    sessionKey: null,
    byUid: {}
  });

  const uid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const activeKey = uid && campaignId && campaignReady ? `${uid}:${campaignId}` : null;

  useEffect(() => {
    if (!activeKey || !uid || !campaignId) return undefined;

    const disconnectLocal = presenceService.connectPresence({
      campaignId,
      uid,
      connId,
      kind: windowTarget.kind,
      sheetId: windowTarget.sheetId,
      onConnectionChange: (connected) => {
        setRtdbConnected(connected);
      },
      onError: (err) => {
        notifyError(err?.message || "Erro na conexão de presença em tempo real.");
      }
    });

    const unsubscribeList = presenceService.subscribePresence({
      campaignId,
      onData: (byUid) => {
        setPresenceState({
          sessionKey: activeKey,
          byUid
        });
      },
      onError: (err) => {
        notifyError(err?.message || "Erro ao ler presença em tempo real.");
      }
    });

    return () => {
      disconnectLocal();
      unsubscribeList();
    };
  }, [activeKey, uid, campaignId, connId, windowTarget.kind, windowTarget.sheetId]);

  const presenceByUid = useMemo(
    () => (activeKey && presenceState.sessionKey === activeKey ? presenceState.byUid : {}),
    [activeKey, presenceState]
  );

  // TRANSITION(T1): onlineUsers compatível com a UI v1 (somente usuários com >= 1 conexão ativa)
  const onlineUsers = useMemo(
    () =>
      presenceService.buildOnlineUsersMap({
        presenceByUid,
        playersMap
      }),
    [presenceByUid, playersMap]
  );

  const hasSheetOpen = useCallback(
    (targetUid, sheetId) =>
      presenceService.hasSheetConnectionOpen(presenceByUid, targetUid, sheetId),
    [presenceByUid]
  );

  const value = useMemo(
    () => ({
      connId,
      rtdbConnected: Boolean(activeKey && rtdbConnected),
      presenceByUid,
      onlineUsers,
      hasSheetOpen
    }),
    [connId, activeKey, rtdbConnected, presenceByUid, onlineUsers, hasSheetOpen]
  );

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  );
}
