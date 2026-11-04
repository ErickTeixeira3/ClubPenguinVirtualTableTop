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
import { updateProfile } from "firebase/auth";
import { auth, db, rtdb, DEFAULT_CAMPAIGN_ID } from "../services/firebase";
import { useAuth } from "./AuthContext";
import { DEFAULT_AUTHORIZED_USERS } from "../constants/authorizedUsers";

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const { user, logout } = useAuth();
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
  const myPlayerProfile = (user && campaign?.players?.[user.uid]) || null;
  const authorizedUsers = Array.isArray(campaign?.authorizedUsers)
    ? campaign.authorizedUsers
    : DEFAULT_AUTHORIZED_USERS;

  // 1. Assinatura do documento da campanha no Firestore
  useEffect(() => {
    if (!user) return;

    const currentUid = user.uid;
    const userEmail = (user.email || "").trim().toLowerCase();
    const campaignRef = doc(db, "campaigns", campaignId);

    const unsubscribe = onSnapshot(
      campaignRef,
      async (snapshot) => {
        setFirestoreError("");

        if (!snapshot.exists()) {
          // Determina se o usuário que está inicializando a campanha é o GM autorizado
          const matchedAuth = DEFAULT_AUTHORIZED_USERS.find(
            (u) => u.email.toLowerCase() === userEmail
          );
          const isUserAuthorizedGM = matchedAuth?.role === "gm";
          const initialDisplayName =
            matchedAuth?.defaultDisplayName ||
            user.displayName ||
            userEmail.split("@")[0] ||
            "Pinguim";

          const initialCampaign = {
            id: campaignId,
            name: "Operação Ilha Gelada",
            gmId: isUserAuthorizedGM ? currentUid : null,
            activeSceneId: null,
            authorizedUsers: DEFAULT_AUTHORIZED_USERS,
            players: {
              [currentUid]: {
                uid: currentUid,
                displayName: initialDisplayName,
                photoURL: user.photoURL || null,
                email: userEmail,
                role: matchedAuth?.role || "player",
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
        const currentAuthorizedList = Array.isArray(data.authorizedUsers)
          ? data.authorizedUsers
          : DEFAULT_AUTHORIZED_USERS;

        // Validação da whitelist
        const authEntry = currentAuthorizedList.find(
          (u) => u.email.toLowerCase() === userEmail
        );

        if (!authEntry) {
          setFirestoreError(
            "Acesso restrito: este e-mail não está autorizado nesta mesa."
          );
          logout();
          setLoadedUid(currentUid);
          return;
        }

        setCampaignData(data);
        setLoadedUid(currentUid);

        const existingPlayer = data.players?.[currentUid];
        const expectedRole =
          authEntry.role || (data.gmId === currentUid ? "gm" : "player");
        const resolvedDisplayName =
          existingPlayer?.displayName ||
          authEntry.defaultDisplayName ||
          user.displayName ||
          userEmail.split("@")[0] ||
          "Pinguim";
        const resolvedPhotoURL =
          existingPlayer?.photoURL || user.photoURL || null;

        const needsPlayerSync =
          !existingPlayer ||
          existingPlayer.role !== expectedRole ||
          !existingPlayer.displayName ||
          !data.authorizedUsers;

        const needsGmSync = expectedRole === "gm" && data.gmId !== currentUid;

        if (needsPlayerSync || needsGmSync) {
          const updates = {};
          if (!data.authorizedUsers) {
            updates.authorizedUsers = DEFAULT_AUTHORIZED_USERS;
          }
          if (needsGmSync) {
            updates.gmId = currentUid;
          }
          if (needsPlayerSync) {
            updates[`players.${currentUid}`] = {
              uid: currentUid,
              displayName: resolvedDisplayName,
              photoURL: resolvedPhotoURL,
              email: userEmail,
              role: expectedRole,
              activeCharacterId: existingPlayer?.activeCharacterId || null,
              joinedAt: existingPlayer?.joinedAt || new Date().toISOString()
            };
          }
          try {
            await updateDoc(campaignRef, updates);
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
  }, [user, campaignId, logout]);

  // 2. Sincronização de Presença em Tempo Real via Realtime Database (RTDB)
  useEffect(() => {
    if (!user || !campaign) return;

    const currentPlayer = campaign.players?.[user.uid];
    const displayName =
      currentPlayer?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Pinguim";
    const photoURL = currentPlayer?.photoURL || user.photoURL || null;
    const role =
      currentPlayer?.role || (campaign.gmId === user.uid ? "gm" : "player");

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
      photoURL,
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
  }, [user, campaign, campaignId]);

  // 3. Atualizar perfil do jogador (Nome e Foto próprios)
  const updatePlayerProfile = async ({ displayName, photoURL }) => {
    if (!user || !campaign) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    const current = campaign.players?.[user.uid] || {};

    const cleanName = displayName?.trim() || current.displayName || "Pinguim";
    const cleanPhoto =
      photoURL !== undefined ? photoURL : current.photoURL || null;

    // 1. Firestore
    await updateDoc(campaignRef, {
      [`players.${user.uid}.displayName`]: cleanName,
      [`players.${user.uid}.photoURL`]: cleanPhoto,
      updatedAt: serverTimestamp()
    });

    // 2. RTDB presença imediata
    try {
      const userPresenceRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/presence/${user.uid}`
      );
      await rtdbSet(userPresenceRef, {
        uid: user.uid,
        displayName: cleanName,
        photoURL: cleanPhoto,
        role: current.role || (campaign.gmId === user.uid ? "gm" : "player"),
        online: true,
        updatedAt: rtdbTimestamp()
      });
    } catch {}

    // 3. Firebase Auth Profile
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: cleanName,
          photoURL: cleanPhoto || ""
        });
      }
    } catch {}
  };

  // 4. Gerenciamento de Contas Autorizadas (Mestre)
  const addAuthorizedUser = async ({ email, defaultDisplayName, role = "player" }) => {
    if (!isRealGM || !email?.trim()) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = defaultDisplayName?.trim() || cleanEmail.split("@")[0];

    const currentList = Array.isArray(campaign?.authorizedUsers)
      ? [...campaign.authorizedUsers]
      : [...DEFAULT_AUTHORIZED_USERS];

    const existingIdx = currentList.findIndex(
      (u) => u.email.toLowerCase() === cleanEmail
    );

    if (existingIdx >= 0) {
      currentList[existingIdx] = {
        ...currentList[existingIdx],
        defaultDisplayName: cleanName,
        role
      };
    } else {
      currentList.push({
        email: cleanEmail,
        defaultDisplayName: cleanName,
        role
      });
    }

    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, {
      authorizedUsers: currentList,
      updatedAt: serverTimestamp()
    });
  };

  const removeAuthorizedUser = async (emailToRemove) => {
    if (!isRealGM || !emailToRemove) return;
    const cleanEmail = emailToRemove.trim().toLowerCase();

    if (user?.email && user.email.toLowerCase() === cleanEmail) {
      throw new Error("Você não pode remover seu próprio acesso de Mestre.");
    }

    const currentList = Array.isArray(campaign?.authorizedUsers)
      ? campaign.authorizedUsers
      : DEFAULT_AUTHORIZED_USERS;

    const filtered = currentList.filter(
      (u) => u.email.toLowerCase() !== cleanEmail
    );

    const campaignRef = doc(db, "campaigns", campaignId);
    await updateDoc(campaignRef, {
      authorizedUsers: filtered,
      updatedAt: serverTimestamp()
    });
  };

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
        myPlayerProfile,
        authorizedUsers,
        updatePlayerProfile,
        addAuthorizedUser,
        removeAuthorizedUser,
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
