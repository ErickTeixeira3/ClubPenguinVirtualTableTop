import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { isReleasedToPlayers, subscribeVisibleCollection } from "../services/visibilityService";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useCompendium() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawEntries, setRawEntries] = useState([]);

  // Fase 3.1 (V-13): listeners dependem só de uid/campaignId/prontidão da campanha/papel,
  // não do objeto `campaign` (recriado a cada snapshot da campanha ou resolução de avatar).
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;

    const compCol = collection(db, "campaigns", campaignId, "compendium");
    // Fase 6.2 (A5/A6: itens liberados por visibleToPlayers chegam mesmo com visibleTo defasado).
    const unsubscribe = subscribeVisibleCollection({
      colRef: compCol,
      isRealGM,
      uid: listenerUid,
      includePublicFlag: true,
      onNext: (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((e) => !e.isDeleted);
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawEntries(list);
      },
      onError: () => {}
    });

    return () => unsubscribe();
  }, [listenerUid, campaignId, campaignReady, isRealGM]);

  // Fase 6.2 (A6/A10): mesma regra das cenas — visibleToPlayers decide quando existe, e a
  // "Visão Player" do Mestre real não usa o UID dele como liberação.
  const currentUid = user?.uid;
  const entries = useMemo(() => {
    if (isGM) return rawEntries;
    const viewerUid = isRealGM ? null : currentUid;
    return rawEntries.filter((e) => isReleasedToPlayers(e, viewerUid));
  }, [rawEntries, isGM, isRealGM, currentUid]);

  const createEntry = async ({
    name,
    type = "ability", // 'ability' | 'spell' | 'skill' | 'item'
    elementColor = "#e53935",
    costResource = "mp",
    costAmount = 0,
    hitFormula = "1d20 + @forca",
    effectFormula = "",
    trigger = "active",
    effectType = "damage",
    savingThrow = null,
    bonus = 0,
    attribute = "forca",
    description = "",
    visibleToPlayers = true
  }) => {
    if (!isRealGM || !campaignId) return null;

    const itemId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);
    const gmUid = campaign?.gmId || user?.uid;
    const isVisible = Boolean(visibleToPlayers);

    const payload = {
      id: itemId,
      campaignId,
      name: name?.trim() || "Item do Compêndio",
      type,
      elementColor: elementColor || "#3090f0",
      cost: {
        resource: costResource || "mp",
        amount: Math.max(0, Number(costAmount) || 0)
      },
      hitFormula: hitFormula?.trim() || "",
      effectFormula: effectFormula?.trim() || "",
      trigger: trigger || "active",
      effectType: effectType || "damage",
      savingThrow: savingThrow || { enabled: false, dcFormula: "12", attribute: "resistencia", effectDescription: "" },
      bonus: Number(bonus) || 0,
      attribute: attribute || "forca",
      description: description?.trim() || "",
      visibleToPlayers: isVisible,
      visibleTo: isVisible ? ["ALL"] : [gmUid].filter(Boolean),
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(itemRef, payload);
    return itemId;
  };

  const updateEntry = async (itemId, updates) => {
    if (!isRealGM || !campaignId || !itemId) return;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);
    const nextUpdates = {
      ...updates,
      campaignId,
      updatedAt: serverTimestamp()
    };
    if (updates?.visibleToPlayers !== undefined) {
      const gmUid = campaign?.gmId || user?.uid;
      nextUpdates.visibleTo = updates.visibleToPlayers
        ? ["ALL"]
        : [gmUid].filter(Boolean);
    }
    await updateDoc(itemRef, nextUpdates);
  };

  const deleteEntry = async (itemId) => {
    if (!isRealGM || !campaignId || !itemId) return;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);
    await updateDoc(itemRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: user?.uid || "gm"
    });
  };

  return {
    entries,
    createEntry,
    updateEntry,
    deleteEntry
  };
}

