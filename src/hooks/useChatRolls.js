import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { evaluateFormula } from "../engines/formulaEngine";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useChatRolls() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawMessages, setRawMessages] = useState([]);

  useEffect(() => {
    if (!user || !campaignId) return;

    const msgCol = collection(db, "campaigns", campaignId, "messages");
    const unsubscribe = onSnapshot(
      msgCol,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
        setRawMessages(list.slice(-100));
      },
      (err) => {
        console.error("Erro ao carregar mensagens:", err);
      }
    );

    return () => unsubscribe();
  }, [user, campaignId]);

  const messages = useMemo(() => {
    if (isGM) return rawMessages;
    return rawMessages.filter((m) => {
      const vis = Array.isArray(m.visibleTo) ? m.visibleTo : [];
      return vis.includes("ALL") || (user && vis.includes(user.uid));
    });
  }, [rawMessages, isGM, user]);

  const buildVisibleToList = (visibility) => {
    const gmUid = campaign?.gmId;
    if (visibility === "gm_only") {
      return Array.from(new Set([gmUid, user?.uid].filter(Boolean)));
    }
    if (visibility === "self") {
      return [user?.uid].filter(Boolean);
    }
    return ["ALL"];
  };

  const sendTextMessage = async ({
    content,
    senderName,
    characterId = null,
    visibility = "public"
  }) => {
    if (!user || !campaignId || !content?.trim()) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);

    await setDoc(msgRef, {
      id: msgId,
      senderId: user.uid,
      senderName:
        senderName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Pinguim",
      characterId,
      type: "text",
      visibility,
      visibleTo: buildVisibleToList(visibility),
      content: content.trim(),
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    });
  };

  const executeRoll = async ({
    title = "Rolagem",
    categoryColor = "#3090f0",
    description = "",
    character = null,
    primaryFormula = "1d20",
    primaryLabel = "Resultado",
    secondaryFormula = "",
    secondaryLabel = "Efeito / Dano",
    cost = null, // { resource: 'mp' | 'hp', amount: number }
    visibility = "public",
    onDeductResource = null
  }) => {
    if (!user || !campaignId) return null;

    let costPaid = null;
    if (
      cost &&
      Number(cost.amount) > 0 &&
      cost.resource &&
      character &&
      onDeductResource
    ) {
      const resKey = cost.resource;
      const currentVal = Number(character.resources?.[resKey]?.current) || 0;
      const amount = Number(cost.amount) || 0;
      const nextVal = Math.max(0, currentVal - amount);
      await onDeductResource(character.id, resKey, nextVal);
      costPaid = {
        resource: resKey.toUpperCase(),
        amount
      };
    }

    const rolls = [];
    if (primaryFormula?.trim()) {
      const r1 = evaluateFormula(primaryFormula, character);
      rolls.push({
        label: primaryLabel || "Rolagem",
        ...r1
      });
    }

    if (secondaryFormula?.trim()) {
      const r2 = evaluateFormula(secondaryFormula, character);
      rolls.push({
        label: secondaryLabel || "Efeito",
        ...r2
      });
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);

    const rollMessage = {
      id: msgId,
      senderId: user.uid,
      senderName:
        character?.name ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Pinguim",
      characterId: character?.id || null,
      type: "ability_roll",
      visibility,
      visibleTo: buildVisibleToList(visibility),
      content: description || "",
      rollData: {
        title,
        categoryColor,
        costPaid,
        rolls
      },
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    };

    await setDoc(msgRef, rollMessage);
    return rollMessage;
  };

  const deleteMessage = async (msgId) => {
    if (!isRealGM || !campaignId || !msgId) return;
    await deleteDoc(doc(db, "campaigns", campaignId, "messages", msgId));
  };

  return {
    messages,
    sendTextMessage,
    executeRoll,
    deleteMessage
  };
}

