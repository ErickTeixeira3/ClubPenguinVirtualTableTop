import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { DEFAULT_COMBAT_STATE } from "../domain/defaults.js";
import { normalizeCombatState } from "../engines/combatEngine.js";
import * as campaignService from "../services/campaignService.js";

const DEFAULT_CAMPAIGN_ID = campaignService.DEFAULT_CAMPAIGN_ID;
import { persistCombatState } from "../services/combatService.js";
import * as memberService from "../services/memberService.js";
import { runCampaignMigrations } from "../services/migrationService.js";
import { notifyError } from "../services/notificationService.js";
import { assertClientUpToDate } from "../services/runtimeConfigService.js";
import { useAuth } from "./AuthContext.jsx";

const CampaignContext = createContext(null);

export function CampaignProvider({
  campaignId: controlledCampaignId = null,
  onSwitchCampaign = null,
  children
}) {
  const { user } = useAuth();
  const [fallbackCampaignId, setFallbackCampaignId] = useState(
    campaignService.resolveInitialCampaignId
  );
  const campaignId = controlledCampaignId || fallbackCampaignId || DEFAULT_CAMPAIGN_ID;

  const [sessionState, setSessionState] = useState({
    sessionKey: null,
    campaignData: null,
    membershipDenied: false,
    canCreateCampaign: false,
    firestoreError: ""
  });
  const [viewAsPlayer, setViewAsPlayer] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const reconciledSessionsRef = useRef(new Set());

  const switchCampaign = useCallback(
    (nextCampaignId) => {
      const cleanId = String(nextCampaignId || DEFAULT_CAMPAIGN_ID).trim();
      if (!cleanId) return;
      campaignService.saveActiveCampaignId(cleanId);
      if (typeof onSwitchCampaign === "function") {
        onSwitchCampaign(cleanId);
      } else {
        setFallbackCampaignId(cleanId);
      }
    },
    [onSwitchCampaign]
  );

  const retryMembership = useCallback(() => {
    setRetryNonce((n) => n + 1);
  }, []);

  const userUid = user?.uid || null;
  const userEmail = user?.email || null;
  const userEmailVerified = Boolean(user?.emailVerified);
  const userDisplayName = user?.displayName || null;
  const userPhotoURL = user?.photoURL || null;

  const currentSessionKey =
    userUid && userEmailVerified ? `${userUid}:${campaignId}:${retryNonce}` : null;

  useEffect(() => {
    if (!userUid || !userEmailVerified || !campaignId || !currentSessionKey) {
      return undefined;
    }

    let cancelled = false;
    let unsubscribeCampaign = () => {};

    const startSession = async () => {
      try {
        const sessionUser = {
          uid: userUid,
          email: userEmail,
          emailVerified: userEmailVerified,
          displayName: userDisplayName,
          photoURL: userPhotoURL
        };

        const membership = await memberService.ensureCampaignSession({
          campaignId,
          user: sessionUser
        });

        if (cancelled) return;

        if (!membership.joined) {
          setSessionState({
            sessionKey: currentSessionKey,
            campaignData: null,
            membershipDenied: true,
            canCreateCampaign: Boolean(membership.isPlatformAdmin),
            firestoreError:
              membership.error?.message ||
              "Acesso restrito: este e-mail não foi convidado para esta campanha."
          });
          return;
        }

        unsubscribeCampaign = campaignService.subscribeCampaign({
          campaignId,
          onData: (data) => {
            if (cancelled) return;
            if (!data) {
              setSessionState({
                sessionKey: currentSessionKey,
                campaignData: null,
                membershipDenied: true,
                canCreateCampaign: false,
                firestoreError: "Campanha não encontrada."
              });
              return;
            }

            setSessionState({
              sessionKey: currentSessionKey,
              campaignData: data,
              membershipDenied: false,
              canCreateCampaign: false,
              firestoreError: ""
            });

            const reconcileKey = `${userUid}:${campaignId}`;
            if (data.gmId === userUid) {
              if (!reconciledSessionsRef.current.has(reconcileKey)) {
                reconciledSessionsRef.current.add(reconcileKey);
                memberService
                  .reconcileMirrors({
                    campaignId,
                    currentUid: userUid,
                    campaignGmId: data.gmId
                  })
                  .catch((err) => {
                    reconciledSessionsRef.current.delete(reconcileKey);
                    notifyError(
                      err?.message ||
                        "Falha ao reconciliar permissões da mesa no RTDB."
                    );
                  });
              }

              runCampaignMigrations({
                campaignId,
                gmUid: data.gmId
              });
            } else {
              reconciledSessionsRef.current.delete(reconcileKey);
              setViewAsPlayer(false);
            }
          },
          onError: (err) => {
            if (cancelled) return;
            const isDenied = err?.code === "permission-denied";
            setSessionState({
              sessionKey: currentSessionKey,
              campaignData: null,
              membershipDenied: isDenied,
              canCreateCampaign: false,
              firestoreError: isDenied
                ? "Seu acesso a esta campanha foi removido ou expirou."
                : err?.message || "Erro ao carregar campanha do Firestore."
            });
          }
        });
      } catch (err) {
        if (cancelled) return;
        setSessionState({
          sessionKey: currentSessionKey,
          campaignData: null,
          membershipDenied: false,
          canCreateCampaign: false,
          firestoreError:
            err?.message || "Erro ao inicializar sessão da campanha."
        });
      }
    };

    startSession();

    return () => {
      cancelled = true;
      unsubscribeCampaign();
    };
  }, [
    userUid,
    userEmail,
    userEmailVerified,
    userDisplayName,
    userPhotoURL,
    campaignId,
    currentSessionKey
  ]);

  const isSessionReady = Boolean(
    currentSessionKey && sessionState.sessionKey === currentSessionKey
  );
  const campaignLoading = Boolean(currentSessionKey && !isSessionReady);
  const activeSession = isSessionReady ? sessionState : null;

  const campaign = useMemo(() => {
    if (!userUid || !activeSession?.campaignData) return null;
    return {
      ...activeSession.campaignData,
      combatState: normalizeCombatState(activeSession.campaignData.combatState)
    };
  }, [userUid, activeSession]);

  const gmId = campaign?.gmId || null;
  const isRealGM = Boolean(userUid && gmId && gmId === userUid);
  // Visão Player é estritamente um modo de pré-visualização na UI; não concede nem restringe segurança no banco.
  const isGM = isRealGM && !viewAsPlayer;

  const createCampaign = useCallback(
    async ({ name, targetCampaignId = campaignId } = {}) => {
      try {
        const res = await memberService.createCampaign({
          campaignId: targetCampaignId,
          name,
          user
        });
        reconciledSessionsRef.current.delete(`${userUid}:${res.campaignId}`);
        if (res.campaignId !== campaignId) {
          switchCampaign(res.campaignId);
        } else {
          retryMembership();
        }
        return res;
      } catch (err) {
        notifyError(err?.message || "Não foi possível criar a campanha.");
        throw err;
      }
    },
    [campaignId, user, userUid, switchCampaign, retryMembership]
  );

  const assignGM = useCallback(
    async (targetUid) => {
      if (!userUid || !campaign || !targetUid || !isRealGM) return null;
      try {
        return await memberService.assignGM({
          campaignId,
          currentGmId: gmId,
          targetUid
        });
      } catch (err) {
        notifyError(err?.message || "Não foi possível transferir o Mestre.");
        throw err;
      }
    },
    [userUid, campaign, isRealGM, campaignId, gmId]
  );

  const updateCampaignName = useCallback(
    async (newName) => {
      if (!isRealGM || !newName?.trim()) return;
      try {
        await campaignService.updateCampaignName({
          campaignId,
          name: newName
        });
      } catch (err) {
        notifyError(err?.message || "Erro ao atualizar nome da campanha.");
        throw err;
      }
    },
    [isRealGM, campaignId]
  );

  const setActiveScene = useCallback(
    async (sceneId) => {
      if (!isRealGM) return;
      try {
        await campaignService.setActiveScene({
          campaignId,
          sceneId
        });
      } catch (err) {
        notifyError(err?.message || "Erro ao ativar cena.");
        throw err;
      }
    },
    [isRealGM, campaignId]
  );

  const updateCombatState = useCallback(
    async (nextCombatState) => {
      if (!isRealGM || !campaignId) return null;
      try {
        assertClientUpToDate();
        return await persistCombatState(campaignId, nextCombatState);
      } catch (err) {
        notifyError(err?.message || "Erro ao atualizar estado de turnos.");
        throw err;
      }
    },
    [isRealGM, campaignId]
  );

  const combatState = campaign?.combatState || DEFAULT_COMBAT_STATE;
  const firestoreError = activeSession?.firestoreError || "";
  const membershipDenied = Boolean(activeSession?.membershipDenied);
  const canCreateCampaign = Boolean(activeSession?.canCreateCampaign);

  const value = useMemo(
    () => ({
      campaignId,
      switchCampaign,
      retryMembership,
      campaign,
      campaignLoading,
      firestoreError,
      membershipDenied,
      canCreateCampaign,
      gmId,
      isRealGM,
      isGM,
      viewAsPlayer: isRealGM && viewAsPlayer,
      setViewAsPlayer,
      combatState,
      createCampaign,
      assignGM,
      updateCampaignName,
      setActiveScene,
      updateCombatState
    }),
    [
      campaignId,
      switchCampaign,
      retryMembership,
      campaign,
      campaignLoading,
      firestoreError,
      membershipDenied,
      canCreateCampaign,
      gmId,
      isRealGM,
      isGM,
      viewAsPlayer,
      combatState,
      createCampaign,
      assignGM,
      updateCampaignName,
      setActiveScene,
      updateCombatState
    ]
  );

  return (
    <CampaignContext.Provider value={value}>
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
