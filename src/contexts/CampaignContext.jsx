import { createContext, useContext, useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import {
  ref,
  onValue,
  set as rtdbSet,
  onDisconnect,
  serverTimestamp as rtdbTimestamp
} from "firebase/database";
import { db, rtdb, DEFAULT_CAMPAIGN_ID } from "../services/firebase";
import { useAuth } from "./AuthContext";

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const { user } = useAuth();
  const [campaignData, setCampaignData] = useState(null);
  const [loadedUid, setLoadedUid] = useState(null);
  const [firestoreError, setFirestoreError] = useState("");
  const [rtdbConnected, setRtdbConnected] = useState(false);
  const [onlineUsersData, setOnlineUsersData] = useState({});
  const [viewAsPlayer, setViewAsPlayer] = useState(false);

  const campaignId = DEFAULT_CAMPAIGN_ID;
  const campaign = user ? campaignData : null;
  const campaignLoading = Boolean(user && loadedUid !== user.uid);
  const onlineUsers = user && campaign ? onlineUsersData : {};
  const gmId = campaign?.gmId || null;

  const isRealGM = Boolean(user && gmId && gmId === user.uid);
  const isGM = isRealGM && !viewAsPlayer;

  // 1. Assinatura do documento da campanha no Firestore
  useEffect(() => {
    if (!user) return;

    const currentUid = user.uid;
    const displayName =
      user.displayName || user.email?.split("@")[0] || "Pinguim";
    const userEmail = user.email || "";
    const campaignRef = doc(db, "campaigns", campaignId);

    const unsubscribe = onSnapshot(
      campaignRef,
      async (snapshot) => {
        setFirestoreError("");

        if (!snapshot.exists()) {
          const initialCampaign = {
            id: campaignId,
            name: "Operação Ilha Gelada",
            gmId: currentUid,
            activeSceneId: null,
            players: {
              [currentUid]: {
                uid: currentUid,
                displayName,
                email: userEmail,
                role: "gm",
                activeCharacterId: null,
                joinedAt: new Date().toISOString()
              }
            },
            combatState: {
              active: false,
              round: 1,
              turnOrder: []
            },
            updatedAt: serverTimestamp()
          };

          try {
            await setDoc(campaignRef, initialCampaign);
          } catch (err) {
            setFirestoreError(
              err?.message || "Erro ao inicializar a campanha no Firestore."
            );
          }
          setLoadedUid(currentUid);
          return;
        }

        const data = snapshot.data();
        setCampaignData(data);
        setLoadedUid(currentUid);

        const existingPlayer = data.players?.[currentUid];
        const expectedRole = data.gmId === currentUid ? "gm" : "player";

        if (
          !existingPlayer ||
          existingPlayer.displayName !== displayName ||
          existingPlayer.role !== expectedRole
        ) {
          try {
            await updateDoc(campaignRef, {
              [`players.${currentUid}`]: {
                uid: currentUid,
                displayName,
                email: userEmail,
                role: expectedRole,
                activeCharacterId: existingPlayer?.activeCharacterId || null,
                joinedAt: existingPlayer?.joinedAt || new Date().toISOString()
              }
            });
          } catch {
            // Ignora falha silenciosa de permissão caso regras restrinjam
          }
        }
      },
      (err) => {
        setFirestoreError(
          err?.message || "Erro ao carregar campanha do Firestore."
        );
        setLoadedUid(currentUid);
      }
    );

    return () => unsubscribe();
  }, [user, campaignId]);

  // 2. Sincronização de Presença em Tempo Real via Realtime Database (RTDB)
  useEffect(() => {
    if (!user || !gmId) return;

    const displayName =
      user.displayName || user.email?.split("@")[0] || "Pinguim";
    const role = gmId === user.uid ? "gm" : "player";

    const userPresenceRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/presence/${user.uid}`
    );
    const allPresenceRef = ref(rtdb, `vtt_realtime/${campaignId}/presence`);

    onDisconnect(userPresenceRef)
      .remove()
      .catch(() => {});

    rtdbSet(userPresenceRef, {
      uid: user.uid,
      displayName,
      role,
      online: true,
      updatedAt: rtdbTimestamp()
    })
      .then(() => setRtdbConnected(true))
      .catch(() => setRtdbConnected(false));

    const unsubscribePresence = onValue(
      allPresenceRef,
      (snapshot) => {
        setRtdbConnected(true);
        setOnlineUsersData(snapshot.val() || {});
      },
      () => {
        setRtdbConnected(false);
      }
    );

    return () => {
      unsubscribePresence();
      rtdbSet(userPresenceRef, null).catch(() => {});
    };
  }, [user, gmId, campaignId]);

  const assignGM = async (targetUid) => {
    if (!user || !campaign) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    const updatedPlayers = { ...(campaign.players || {}) };

    Object.keys(updatedPlayers).forEach((uid) => {
      updatedPlayers[uid] = {
        ...updatedPlayers[uid],
        role: uid === targetUid ? "gm" : "player"
      };
    });

    await updateDoc(campaignRef, {
      gmId: targetUid,
      players: updatedPlayers,
      updatedAt: serverTimestamp()
    });
  };

  const updateCampaignName = async (newName) => {
    if (!isRealGM || !newName?.trim()) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, {
      name: newName.trim(),
      updatedAt: serverTimestamp()
    });
  };

  const setActiveScene = async (sceneId) => {
    if (!isRealGM) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, {
      activeSceneId: sceneId || null,
      updatedAt: serverTimestamp()
    });
  };

  return (
    <CampaignContext.Provider
      value={{
        campaignId,
        campaign,
        campaignLoading,
        firestoreError,
        rtdbConnected,
        onlineUsers,
        isRealGM,
        isGM,
        viewAsPlayer,
        setViewAsPlayer,
        assignGM,
        updateCampaignName,
        setActiveScene
      }}
    >
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error("useCampaign deve ser utilizado dentro de um CampaignProvider");
  }
  return context;
}
