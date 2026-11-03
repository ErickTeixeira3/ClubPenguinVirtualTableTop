import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useCompendium() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawEntries, setRawEntries] = useState([]);

  useEffect(() => {
    if (!user || !campaignId || !campaign) return;

    const compCol = collection(db, "campaigns", campaignId, "compendium");
    const compQuery = isRealGM
      ? query(compCol)
      : query(compCol, where("visibleToPlayers", "==", true));

    const unsubscribe = onSnapshot(
      compQuery,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawEntries(list);
      },
      () => {}
    );

    return () => unsubscribe();
  }, [user, campaignId, campaign, isRealGM]);

  const entries = useMemo(() => {
    if (isGM) return rawEntries;
    return rawEntries.filter((e) => e.visibleToPlayers === true);
  }, [rawEntries, isGM]);

  const createEntry = async ({
    name,
    type = "ability", // 'ability' | 'spell' | 'skill' | 'item'
    elementColor = "#e53935",
    costResource = "mp",
    costAmount = 0,
    hitFormula = "1d20 + @forca",
    effectFormula = "",
    bonus = 0,
    attribute = "forca",
    description = "",
    visibleToPlayers = true
  }) => {
    if (!isRealGM || !campaignId) return null;

    const itemId = `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);

    const payload = {
      id: itemId,
      name: name?.trim() || "Item do Compêndio",
      type,
      elementColor: elementColor || "#3090f0",
      cost: {
        resource: costResource || "mp",
        amount: Math.max(0, Number(costAmount) || 0)
      },
      hitFormula: hitFormula?.trim() || "",
      effectFormula: effectFormula?.trim() || "",
      bonus: Number(bonus) || 0,
      attribute: attribute || "forca",
      description: description?.trim() || "",
      visibleToPlayers: Boolean(visibleToPlayers),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(itemRef, payload);
    return itemId;
  };

  const updateEntry = async (itemId, updates) => {
    if (!isRealGM || !campaignId || !itemId) return;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);
    await updateDoc(itemRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const deleteEntry = async (itemId) => {
    if (!isRealGM || !campaignId || !itemId) return;
    const itemRef = doc(db, "campaigns", campaignId, "compendium", itemId);
    await deleteDoc(itemRef);
  };

  return {
    entries,
    createEntry,
    updateEntry,
    deleteEntry
  };
}

