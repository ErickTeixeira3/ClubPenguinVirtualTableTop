import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import {
  getCachedMediaSync,
  getMediaDataUrl,
  uploadDataUrlMedia
} from "../services/mediaService";
import { runCampaignMigrations } from "../services/migrationService";
import {
  DEFAULT_COMBAT_STATE,
  normalizeCombatState
} from "../engines/combatEngine";
import { persistCombatState } from "../services/combatService";
import { IS_SPLIT_RTDB_LAYOUT, gmMetaPath } from "../services/rtdbPaths";
import { isPlayerAvatarRemoved } from "../services/rollService";
import {
  readPendingAvatarDataUrl,
  clearPendingAvatarDataUrl
} from "../utils/stringUtils";

const CampaignContext = createContext(null);

/**
 * Fase 3.1 (V-15): migra a foto pendente do cadastro (ou DataURL legado) para media/{mediaId}
 * no máximo UMA vez por sessão/usuário/campanha, mesmo que o onSnapshot dispare várias vezes
 * durante o upload. Em falha, a chave pendente é descartada (sem retentativa a cada snapshot).
 */
async function migrateAvatarOnce({ attemptsRef, attemptKey, dataUrl, campaignId, uploadedBy }) {
  if (!dataUrl || attemptsRef.current.has(attemptKey)) return null;
  attemptsRef.current.add(attemptKey);
  try {
    const uploaded = await uploadDataUrlMedia({
      dataUrl,
      category: "avatar",
      campaignId,
      uploadedBy
    });
    return uploaded?.mediaId || null;
  } catch (err) {
    console.warn("Falha ao migrar avatar para media/:", err);
    return null;
  } finally {
    clearPendingAvatarDataUrl();
  }
}

function resolveInitialCampaignId() {
  if (typeof window === "undefined") return DEFAULT_CAMPAIGN_ID;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("campaignId")?.trim();
    if (fromQuery) return fromQuery;
    const fromStorage = localStorage.getItem("cp_active_campaign_id")?.trim();
    if (fromStorage) return fromStorage;
  } catch {
    // Fallback
  }
  return DEFAULT_CAMPAIGN_ID;
}

export function CampaignProvider({ children }) {
  const { user, logout } = useAuth();
  const [campaignId, setCampaignIdState] = useState(resolveInitialCampaignId);
  const [campaignData, setCampaignData] = useState(null);
  const [loadedUid, setLoadedUid] = useState(null);
  const [firestoreError, setFirestoreError] = useState("");
  const [rtdbConnected, setRtdbConnected] = useState(false);
  const [onlineUsersData, setOnlineUsersData] = useState({});
  const [viewAsPlayer, setViewAsPlayer] = useState(false);
  const [resolvedAvatars, setResolvedAvatars] = useState({});
  const avatarMigrationAttemptsRef = useRef(new Set());

  const switchCampaign = (nextCampaignId) => {
    const cleanId = String(nextCampaignId || DEFAULT_CAMPAIGN_ID).trim();
    if (!cleanId) return;
    setCampaignIdState(cleanId);
    try {
      localStorage.setItem("cp_active_campaign_id", cleanId);
    } catch {
      // Ignore
    }
  };

  // Resolve avatarMediaId de todos os jogadores e usuários online no cache IndexedDB
  useEffect(() => {
    if (!user || !campaignId) return;
    const mediaIds = new Set();

    Object.values(campaignData?.players || {}).forEach((p) => {
      if (p?.avatarMediaId) mediaIds.add(p.avatarMediaId);
    });
    Object.values(onlineUsersData || {}).forEach((u) => {
      if (u?.avatarMediaId) mediaIds.add(u.avatarMediaId);
    });

    mediaIds.forEach((mediaId) => {
      if (resolvedAvatars[mediaId]) return;
      const syncUrl = getCachedMediaSync(mediaId, campaignId);
      if (syncUrl) {
        setResolvedAvatars((prev) =>
          prev[mediaId] === syncUrl ? prev : { ...prev, [mediaId]: syncUrl }
        );
        return;
      }
      getMediaDataUrl(mediaId, campaignId)
        .then((dataUrl) => {
          if (dataUrl) {
            setResolvedAvatars((prev) => ({ ...prev, [mediaId]: dataUrl }));
          }
        })
        .catch(() => {});
    });
  }, [user, campaignId, campaignData?.players, onlineUsersData, resolvedAvatars]);

  const campaign = useMemo(() => {
    if (!user || !campaignData) return null;
    const enrichedPlayers = {};
    Object.entries(campaignData.players || {}).forEach(([uid, p]) => {
      const resolvedUrl =
        (p?.avatarMediaId &&
          (resolvedAvatars[p.avatarMediaId] ||
            getCachedMediaSync(p.avatarMediaId, campaignId))) ||
        p?.photoURL ||
        null;
      enrichedPlayers[uid] = {
        ...p,
        photoURL: resolvedUrl
      };
    });
    return {
      ...campaignData,
      combatState: normalizeCombatState(campaignData.combatState),
      players: enrichedPlayers
    };
  }, [user, campaignData, resolvedAvatars, campaignId]);

  const campaignLoading = Boolean(user && loadedUid !== user.uid);

  const onlineUsers = useMemo(() => {
    if (!user || !campaign) return {};
    const enriched = {};
    Object.entries(onlineUsersData || {}).forEach(([uid, u]) => {
      const playerRecord = campaign.players?.[uid];
      const avatarRemoved =
        isPlayerAvatarRemoved(playerRecord) || u?.avatarRemoved === true;
      const avatarMediaId = avatarRemoved
        ? null
        : u?.avatarMediaId || playerRecord?.avatarMediaId || null;
      const resolvedUrl = avatarRemoved
        ? null
        : (avatarMediaId &&
            (resolvedAvatars[avatarMediaId] ||
              getCachedMediaSync(avatarMediaId, campaignId))) ||
          u?.photoURL ||
          playerRecord?.photoURL ||
          null;
      enriched[uid] = {
        ...u,
        avatarMediaId,
        photoURL: resolvedUrl
      };
    });
    return enriched;
  }, [user, campaign, onlineUsersData, resolvedAvatars, campaignId]);

  const gmId = campaign?.gmId || null;

  const isAuthorizedGmByEmail = DEFAULT_AUTHORIZED_USERS.some(
    (u) =>
      u.role === "gm" &&
      u.email.toLowerCase() === (user?.email || "").trim().toLowerCase()
  );
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

          const initialPhotoURL =
            user.photoURL && !user.photoURL.startsWith("data:")
              ? user.photoURL
              : null;

          const initialAvatarMediaId = await migrateAvatarOnce({
            attemptsRef: avatarMigrationAttemptsRef,
            attemptKey: `${campaignId}:${currentUid}`,
            dataUrl: readPendingAvatarDataUrl(currentUid),
            campaignId,
            uploadedBy: currentUid
          });

          const initialCampaign = {
            id: campaignId,
            campaignId,
            name: "Operação Ilha Gelada",
            gmId: isUserAuthorizedGM ? currentUid : null,
            activeSceneId: null,
            authorizedUsers: DEFAULT_AUTHORIZED_USERS,
            players: {
              [currentUid]: {
                uid: currentUid,
                displayName: initialDisplayName,
                avatarMediaId: initialAvatarMediaId,
                photoURL: initialPhotoURL,
                email: userEmail,
                role: matchedAuth?.role || "player",
                activeCharacterId: null,
                joinedAt: new Date().toISOString()
              }
            },
            combatState: DEFAULT_COMBAT_STATE,
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

        let resolvedAvatarMediaId = existingPlayer?.avatarMediaId || null;
        let resolvedPhotoURL =
          existingPlayer?.photoURL ||
          (isPlayerAvatarRemoved(existingPlayer) ? null : user.photoURL) ||
          null;
        let migratedInlineAvatar = false;

        // Se houver dataUrl pendente do cadastro ou dataUrl legado salvo direto em photoURL, migra para media/{mediaId}
        const pendingDataUrl = readPendingAvatarDataUrl(currentUid);
        const dataUrlToMigrate =
          pendingDataUrl ||
          (typeof resolvedPhotoURL === "string" &&
          resolvedPhotoURL.startsWith("data:")
            ? resolvedPhotoURL
            : null);

        if (dataUrlToMigrate) {
          const migratedMediaId = await migrateAvatarOnce({
            attemptsRef: avatarMigrationAttemptsRef,
            attemptKey: `${campaignId}:${currentUid}`,
            dataUrl: dataUrlToMigrate,
            campaignId,
            uploadedBy: currentUid
          });
          if (migratedMediaId) {
            resolvedAvatarMediaId = migratedMediaId;
            resolvedPhotoURL = null;
            migratedInlineAvatar = true;
          }
        }

        const isCampaignGM = expectedRole === "gm" || data.gmId === currentUid;

        const needsPlayerSync =
          !existingPlayer ||
          existingPlayer.role !== expectedRole ||
          !existingPlayer.displayName ||
          migratedInlineAvatar;

        const needsGmSync = expectedRole === "gm" && data.gmId !== currentUid;

        // Fase 3.1 (V-21): backfill de campos da raiz da campanha (campaignId, authorizedUsers, gmId)
        // é feito somente pelo Mestre e em escrita separada. O jogador grava apenas players.{uid},
        // que é o único caminho permitido a ele pelo firestore.rules.
        if (isCampaignGM) {
          const rootUpdates = {};
          if (data.campaignId !== campaignId) {
            rootUpdates.campaignId = campaignId;
          }
          if (!data.authorizedUsers) {
            rootUpdates.authorizedUsers = DEFAULT_AUTHORIZED_USERS;
          }
          if (needsGmSync) {
            rootUpdates.gmId = currentUid;
          }
          if (Object.keys(rootUpdates).length > 0) {
            try {
              await updateDoc(campaignRef, rootUpdates);
            } catch (err) {
              console.warn("Falha no backfill da campanha:", err);
            }
          }
        }

        if (needsPlayerSync) {
          try {
            await updateDoc(campaignRef, {
              [`players.${currentUid}`]: {
                uid: currentUid,
                displayName: resolvedDisplayName,
                avatarMediaId: resolvedAvatarMediaId,
                photoURL:
                  resolvedPhotoURL && !resolvedPhotoURL.startsWith("data:")
                    ? resolvedPhotoURL
                    : null,
                email: userEmail,
                role: expectedRole,
                activeCharacterId: existingPlayer?.activeCharacterId || null,
                joinedAt: existingPlayer?.joinedAt || new Date().toISOString()
              },
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.warn("Falha ao registrar jogador na campanha:", err);
          }
        }

        // Se for o Mestre da mesa, executa migração idempotente da campanha em segundo plano
        if (expectedRole === "gm" || data.gmId === currentUid) {
          runCampaignMigrations({
            campaignId,
            gmUid: data.gmId || currentUid
          });
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
    if (!user || !campaignData) return;

    const currentPlayer = campaignData.players?.[user.uid];
    const displayName =
      currentPlayer?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Pinguim";
    const avatarMediaId = currentPlayer?.avatarMediaId || null;
    const rawPhotoURL =
      currentPlayer?.photoURL ||
      (isPlayerAvatarRemoved(currentPlayer) ? null : user.photoURL) ||
      null;
    const safePhotoURL =
      typeof rawPhotoURL === "string" && !rawPhotoURL.startsWith("data:")
        ? rawPhotoURL
        : null;
    const role =
      currentPlayer?.role || (campaignData.gmId === user.uid ? "gm" : "player");

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
      campaignId,
      displayName,
      avatarMediaId,
      photoURL: safePhotoURL,
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
  }, [user, campaignData, campaignId]);

  // 2.1 Fase 3.1 (V-20) / Fase 6.7 (A32): espelha o gmId da campanha no RTDB (vtt_realtime/{campaignId}/meta/gmId)
  // para que database.rules.json reconheça o Mestre definido por gmId (e não apenas pelo e-mail).
  // Permite também que o Mestre por e-mail inicialize meta/gmId com campaignData.gmId mesmo após delegação.
  useEffect(() => {
    if (!IS_SPLIT_RTDB_LAYOUT || !user || !campaignId || !campaignData?.gmId) return;
    if (!isRealGM && !isAuthorizedGmByEmail) return;
    rtdbSet(ref(rtdb, gmMetaPath(campaignId)), campaignData.gmId).catch((err) => {
      console.warn("Falha ao espelhar gmId no RTDB:", err);
    });
  }, [user, campaignId, campaignData?.gmId, isRealGM, isAuthorizedGmByEmail]);

  // 3. Atualizar perfil do jogador (Nome e Foto próprios via media/{mediaId})
  const updatePlayerProfile = async ({
    displayName,
    photoURL,
    avatarMediaId
  }) => {
    if (!user || !campaignData) return;
    const campaignRef = doc(db, "campaigns", campaignId);
    const current = campaignData.players?.[user.uid] || {};

    const cleanName = displayName?.trim() || current.displayName || "Pinguim";

    // Fase 3.1 (V-02): a foto só é alterada quando o chamador informa explicitamente uma ação:
    // - photoURL === null/"" (ou avatarMediaId === null) => remover a foto;
    // - photoURL "data:..." => foto NOVA escolhida pelo usuário (upload único para media/);
    // - photoURL HTTP => URL externa;
    // - photoURL undefined => mantém exatamente o avatar atual (somente renomear).
    // O valor de `current` vem de campaignData (bruto do Firestore), nunca do perfil enriquecido.
    let finalAvatarMediaId = current.avatarMediaId || null;
    let finalPhotoURL =
      typeof current.photoURL === "string" && !current.photoURL.startsWith("data:")
        ? current.photoURL
        : null;
    let photoChanged = false;

    if (photoURL === null || photoURL === "" || avatarMediaId === null) {
      finalAvatarMediaId = null;
      finalPhotoURL = null;
      photoChanged = true;
    } else if (typeof photoURL === "string" && photoURL.startsWith("data:")) {
      const uploaded = await uploadDataUrlMedia({
        dataUrl: photoURL,
        category: "avatar",
        campaignId,
        uploadedBy: user.uid
      });
      if (!uploaded?.mediaId) {
        throw new Error("Não foi possível enviar a nova foto.");
      }
      finalAvatarMediaId = uploaded.mediaId;
      finalPhotoURL = null;
      photoChanged = true;
      setResolvedAvatars((prev) => ({
        ...prev,
        [uploaded.mediaId]: uploaded.dataUrl
      }));
    } else if (typeof photoURL === "string" && /^https?:\/\//i.test(photoURL)) {
      finalAvatarMediaId = null;
      finalPhotoURL = photoURL;
      photoChanged = true;
    } else if (typeof avatarMediaId === "string" && avatarMediaId) {
      finalAvatarMediaId = avatarMediaId;
      finalPhotoURL = null;
      photoChanged = true;
    }

    const finalAvatarRemoved = photoChanged
      ? !finalAvatarMediaId && !finalPhotoURL
      : Boolean(current.avatarRemoved);

    // 1. Firestore
    const profileUpdates = {
      [`players.${user.uid}.displayName`]: cleanName,
      updatedAt: serverTimestamp()
    };
    if (photoChanged) {
      profileUpdates[`players.${user.uid}.avatarMediaId`] = finalAvatarMediaId;
      profileUpdates[`players.${user.uid}.photoURL`] = finalPhotoURL;
      profileUpdates[`players.${user.uid}.avatarRemoved`] = finalAvatarRemoved;
    }
    await updateDoc(campaignRef, profileUpdates);

    // 2. RTDB presença imediata
    try {
      const userPresenceRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/presence/${user.uid}`
      );
      await rtdbSet(userPresenceRef, {
        uid: user.uid,
        campaignId,
        displayName: cleanName,
        avatarMediaId: finalAvatarMediaId,
        photoURL: finalPhotoURL,
        avatarRemoved: finalAvatarRemoved,
        role: current.role || (campaignData.gmId === user.uid ? "gm" : "player"),
        online: true,
        updatedAt: rtdbTimestamp()
      });
    } catch {}

    // 3. Firebase Auth Profile (somente URL HTTP curta, nunca Base64)
    try {
      if (auth.currentUser) {
        const authProfileUpdates = { displayName: cleanName };
        if (
          typeof finalPhotoURL === "string" &&
          /^https?:\/\//i.test(finalPhotoURL) &&
          finalPhotoURL.length < 2000
        ) {
          authProfileUpdates.photoURL = finalPhotoURL;
        } else if (photoChanged && !finalPhotoURL) {
          authProfileUpdates.photoURL = "";
        }
        await updateProfile(auth.currentUser, authProfileUpdates);
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
    if (!user || !campaignData || !targetUid) return;
    if (!isRealGM && !isAuthorizedGmByEmail) return;
    const campaignRef = doc(db, "campaigns", campaignId);

    // Fase 3.1 (V-01): grava somente o campo `role` de cada jogador (caminho pontilhado),
    // a partir de campaignData (bruto). Nunca regrava o mapa `players` inteiro a partir do
    // objeto enriquecido `campaign.players`, cujo photoURL é a DataURL resolvida do avatar.
    const roleUpdates = {};
    Object.keys(campaignData.players || {}).forEach((uid) => {
      roleUpdates[`players.${uid}.role`] = uid === targetUid ? "gm" : "player";
    });

    await updateDoc(campaignRef, {
      gmId: targetUid,
      ...roleUpdates,
      updatedAt: serverTimestamp()
    });

    // Fase 3.1 (V-20): espelha o novo Mestre no RTDB para as database.rules reconhecerem o gmId.
    // Fase 6.1: só no layout "split" (as regras publicadas não têm o nó meta/).
    if (IS_SPLIT_RTDB_LAYOUT) {
      try {
        await rtdbSet(ref(rtdb, gmMetaPath(campaignId)), targetUid);
      } catch (err) {
        console.warn("Falha ao espelhar gmId no RTDB:", err);
      }
    }
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

  const updateCombatState = async (nextCombatState) => {
    if (!isRealGM || !campaignId) return null;
    return persistCombatState(campaignId, nextCombatState);
  };

  const combatState = campaign?.combatState || DEFAULT_COMBAT_STATE;

  return (
    <CampaignContext.Provider
      value={{
        campaignId,
        switchCampaign,
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
        combatState,
        updateCombatState,
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
