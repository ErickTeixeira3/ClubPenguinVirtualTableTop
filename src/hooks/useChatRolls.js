import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../infra/firebase.js";
import {
  executeChatRollMessage,
  sendEmoteChatMessage,
  sendSkillPingChatMessage,
  sendTextChatMessage,
  softDeleteChatMessage,
  updateChatMessageRollData
} from "../services/rollService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useMembers } from "../contexts/MembersContext";

export function useChatRolls() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  // T1 permanece até a Fase 11: identidade de membro ainda expõe o mapa legado à UI.
  const { playersMap } = useMembers();
  const [rawMessages, setRawMessages] = useState([]);

  // Fase 3.1 (V-13): listeners dependem só de uid/campaignId/prontidão da campanha/papel,
  // não do objeto `campaign` (recriado a cada snapshot da campanha ou resolução de avatar).
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;

    const msgCol = collection(db, "campaigns", campaignId, "messages");
    const msgQuery = isRealGM
      ? query(msgCol)
      : query(msgCol, where("visibleTo", "array-contains-any", ["ALL", listenerUid]));

    const unsubscribe = onSnapshot(
      msgQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((m) => !m.isDeleted);
        list.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
        setRawMessages(list.slice(-100));
      },
      (err) => {
        console.error("Erro ao carregar mensagens:", err);
      }
    );

    return () => unsubscribe();
  }, [listenerUid, campaignId, campaignReady, isRealGM]);

  const messages = useMemo(() => {
    if (isGM) return rawMessages;
    return rawMessages.filter((m) => {
      const vis = Array.isArray(m.visibleTo) ? m.visibleTo : [];
      return vis.includes("ALL") || (user && vis.includes(user.uid));
    });
  }, [rawMessages, isGM, user]);

  const campaignWithPlayers = useMemo(
    () => (campaign ? { ...campaign, players: playersMap } : null),
    [campaign, playersMap]
  );

  const sendEmoteMessage = async (params) =>
    sendEmoteChatMessage({
      campaignId,
      campaign: campaignWithPlayers,
      user,
      ...params
    });

  const sendTextMessage = async (params) =>
    sendTextChatMessage({
      campaignId,
      campaign: campaignWithPlayers,
      user,
      ...params
    });

  const sendSkillPing = async (params) =>
    sendSkillPingChatMessage({
      campaignId,
      campaign: campaignWithPlayers,
      user,
      ...params
    });

  const executeRoll = async (params) =>
    executeChatRollMessage({
      campaignId,
      campaign: campaignWithPlayers,
      user,
      ...params
    });

  // Fase 3.1 (errata Fase 3 §4.2): escritas delegadas ao rollService (hook só assina e vincula contexto)
  const updateMessageRollData = async (msgId, partialRollData) => {
    if (!isGM || !campaignId || !msgId) return;
    await updateChatMessageRollData({
      campaignId,
      message: rawMessages.find((m) => m.id === msgId),
      partialRollData
    });
  };

  const deleteMessage = async (msgId) => {
    if (!isRealGM || !campaignId || !msgId) return;
    await softDeleteChatMessage({ campaignId, user, msgId });
  };

  return {
    messages,
    sendTextMessage,
    sendEmoteMessage,
    sendSkillPing,
    executeRoll,
    updateMessageRollData,
    deleteMessage
  };
}
