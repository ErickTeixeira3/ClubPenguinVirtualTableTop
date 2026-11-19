import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useMembers } from "../../contexts/MembersContext";
import { usePresence } from "../../contexts/PresenceContext";
import { useTargetSelection } from "../../contexts/TargetSelectionContext.js";
import TargetSelectionProvider from "../../contexts/TargetSelectionProvider.jsx";
import TurnPolicyProvider from "../../contexts/TurnPolicyProvider.jsx";
import { useScenes } from "../../hooks/useScenes";
import { useCharacters } from "../../hooks/useCharacters";
import { useCompendium } from "../../hooks/useCompendium";
import { useChatRolls } from "../../hooks/useChatRolls";
import { useJournalNotes } from "../../hooks/useJournalNotes";
import { useCrossWindowSync } from "../../hooks/useCrossWindowSync";
import { useFog } from "../../hooks/useFog.js";
import { useSceneTokens } from "../../hooks/useSceneTokens.js";
import { useTokenSecrets } from "../../hooks/useTokenSecrets.js";
import { useBoardReconciliation } from "../../hooks/useBoardReconciliation.js";
import { useAllyCostsProcessor } from "../../hooks/useAllyCostsProcessor.js";
import { useRefereeLoop } from "../../hooks/useRefereeLoop.js";
import { useTurnPolicy } from "../../contexts/TurnPolicyContext.js";
import { isUserResponsibleForSavingThrow } from "../../domain/permissions.js";
import { getNoteTypeMeta } from "../journal/noteTypesUi";
import {
  ROLL_KINDS,
  doubleDiceInFormula,
  getActiveCombatant,
  hasControlledByAccess
} from "../../engines/combatEngine";
import {
  advanceCampaignTurn,
  applyCombatEffect,
  consumeCampaignTurnAction,
  consumeCampaignTurnMovement,
  consumeCombatCosts,
  deductActorResources,
  regressCampaignTurn,
  spawnCharacterTokenToScene,
  startTurnCombat,
  stopTurnCombat,
  syncTokenUpdatesToCharacter
} from "../../services/combatService";
import { resolveSpeakerIdentity } from "../../domain/speakerIdentity.js";
import { getAssetUrl } from "../../utils/stringUtils";
import GMPanelModal from "../gm/GMPanelModal";
import BoardViewport from "../canvas/BoardViewport";
import ScenesManagerModal from "../scenes/ScenesManagerModal";
import CharacterSheetModal from "../sheets/CharacterSheetModal";
import CharactersSidebarList from "../sheets/CharactersSidebarList";
import CompendiumModal from "../compendium/CompendiumModal";
import ChatSidebarPanel from "../chat/ChatSidebarPanel";
import JournalWorkspace from "../journal/JournalWorkspace";
import PlayerProfileModal from "./PlayerProfileModal";
import QuickActionsHotbar from "./QuickActionsHotbar";
import EmotePickerMenu from "./EmotePickerMenu";
import CombatModals from "../combat/CombatModals";
import StandaloneSheetView from "./StandaloneSheetView";

// Fase 4: cursor da mira da bola de neve com a URL resolvida via BASE_URL (consumido em App.css
// por `.cp-snowball-aiming { cursor: var(--cp-snowball-cursor) }`).
const SNOWBALL_CURSOR_STYLE = {
  "--cp-snowball-cursor": `url("${getAssetUrl("icones/iconeMiraBolaDeNeve.png")}") 32 32, crosshair`
};

export default function VTTLayout() {
  const { campaignId, combatState, isRealGM, isGM } = useCampaign();
  const scenesApi = useScenes();
  const charactersApi = useCharacters();

  const activeSceneId = scenesApi.activeScene?.id || null;
  const cellSizePx = Math.max(16, Number(scenesApi.activeScene?.grid?.cellSizePx) || 64);

  const fogApi = useFog(activeSceneId);
  const tokensApi = useSceneTokens(activeSceneId, {
    fog: fogApi.fog,
    cellSizePx
  });
  const secretsByTokenId = useTokenSecrets(activeSceneId, tokensApi.publicTokens);

  useBoardReconciliation({
    sceneId: activeSceneId,
    characters: charactersApi.allCharacters || [],
    publicTokens: tokensApi.publicTokens,
    hiddenTokens: tokensApi.hiddenTokens,
    tokensLoaded: tokensApi.loaded,
    fog: fogApi.fog,
    cellSizePx
  });

  const liveTokensWithSecrets = useMemo(
    () =>
      (tokensApi.tokens || []).map((tok) => ({
        ...tok,
        secrets: secretsByTokenId[tok.id] || null,
        inHiddenBucket: tokensApi.isTokenInHiddenBucket(tok.id),
        sceneId: activeSceneId
      })),
    [tokensApi, secretsByTokenId, activeSceneId]
  );

  const externalTargetReceiverRef = useRef(null);
  const broadcastTargetsRef = useRef(null);

  const registerExternalTargetReceiver = useCallback((fn) => {
    externalTargetReceiverRef.current = fn;
    return () => {
      if (externalTargetReceiverRef.current === fn) {
        externalTargetReceiverRef.current = null;
      }
    };
  }, []);

  const handleTargetsChange = useCallback((_ids, resolvedTokens) => {
    broadcastTargetsRef.current?.(resolvedTokens);
  }, []);

  const handleConsumeTurnMovement = useCallback(
    async (tokenObj, distanceMeters) => {
      if (!combatState?.active || !isRealGM) return;
      await consumeCampaignTurnMovement(campaignId, combatState, tokenObj, distanceMeters);
    },
    [campaignId, combatState, isRealGM]
  );

  return (
    <TurnPolicyProvider
      combatState={combatState}
      isGM={isGM}
      onConsumeMovement={isRealGM ? handleConsumeTurnMovement : null}
    >
      <TargetSelectionProvider
        sceneId={activeSceneId}
        sceneTokens={liveTokensWithSecrets}
        tokensLoaded={tokensApi.loaded}
        registerExternalReceiver={registerExternalTargetReceiver}
        onTargetsChange={handleTargetsChange}
      >
        <VTTLayoutInner
          scenesApi={scenesApi}
          charactersApi={charactersApi}
          fogApi={fogApi}
          tokensApi={tokensApi}
          secretsByTokenId={secretsByTokenId}
          liveTokensWithSecrets={liveTokensWithSecrets}
          externalTargetReceiverRef={externalTargetReceiverRef}
          broadcastTargetsRef={broadcastTargetsRef}
        />
      </TargetSelectionProvider>
    </TurnPolicyProvider>
  );
}

function VTTLayoutInner({
  scenesApi,
  charactersApi,
  fogApi,
  tokensApi,
  secretsByTokenId,
  liveTokensWithSecrets,
  externalTargetReceiverRef,
  broadcastTargetsRef
}) {
  const { user, logout } = useAuth();
  const {
    campaignId,
    campaign,
    combatState,
    isRealGM,
    isGM,
    viewAsPlayer,
    setViewAsPlayer,
    firestoreError
  } = useCampaign();
  // TRANSITION(T1): playersMap / myPlayerProfile / onlineUsers derivados de Members/Presence até Fase 11
  const { playersMap, myPlayerProfile } = useMembers();
  const { onlineUsers, hasSheetOpen } = usePresence();
  const turnPolicy = useTurnPolicy();

  const {
    scenes,
    activeScene,
    scenesError,
    createScene,
    updateScene,
    deleteScene,
    activateSceneForTable
  } = scenesApi;

  const {
    characters,
    allCharacters = [],
    folders: characterFolders,
    canEditCharacter,
    canEditFolder: canEditCharacterFolder,
    canDeleteCharacter,
    canDeleteFolder: canDeleteCharacterFolder,
    createCharacter,
    renameCharacter,
    updateCharacter,
    updateCharacterResource,
    applyCharacterResourceDelta,
    consumeCharacterItem,
    addCharacterEntry,
    updateCharacterEntry,
    removeCharacterEntry,
    reorderCharacterEntries,
    setCharacterHotbarSlot,
    shareCharacter,
    transferCharacter,
    pullCompendiumEntry,
    uploadCharacterImage,
    deleteCharacter,
    createFolder: createCharacterFolder,
    renameFolder: renameCharacterFolder,
    updateFolder: updateCharacterFolder,
    transferFolderOwnership: transferCharacterFolderOwnership,
    deleteFolder: deleteCharacterFolder,
    moveCharacterToFolder,
    moveFolder: moveCharacterFolder
  } = charactersApi;

  const {
    entries: compendiumEntries,
    createEntry,
    updateEntry,
    deleteEntry
  } = useCompendium();

  const {
    messages,
    sendTextMessage,
    sendEmoteMessage,
    sendSkillPing,
    executeRoll,
    deleteMessage
  } = useChatRolls();

  const {
    accessibleNotes,
    accessibleFolders,
    canEditNote,
    canDeleteNote,
    canEditFolder: canEditJournalFolder,
    canDeleteFolder: canDeleteJournalFolder,
    createNote,
    updateNote,
    saveNoteDraft,
    updateNodePosition,
    cloneNoteToTarget,
    shareNoteWithTarget,
    revokeNoteAccess,
    deleteNote,
    createFolder,
    renameFolder: renameJournalFolder,
    moveFolder: moveJournalFolder,
    moveNoteToFolder,
    deleteFolder
  } = useJournalNotes();

  // Verifica se foi aberto via botão "Nova Janela ↗" (?sheetId=...)
  const standaloneSheetId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("sheetId") || null;
  }, []);

  const [activeDockModule, setActiveDockModule] = useState("board");
  const [activeSidebarTab, setActiveSidebarTab] = useState("sheets"); // 'chat' | 'sheets' | 'journal'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [gmModalOpen, setGmModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [scenesModalOpen, setScenesModalOpen] = useState(false);
  const [scenesModalInitialTab, setScenesModalInitialTab] = useState("map");
  const [compendiumModalOpen, setCompendiumModalOpen] = useState(false);
  const [openCharacterId, setOpenCharacterId] = useState(null);
  const [rollVisibility, setRollVisibility] = useState("public"); // 'public' | 'gm_only'
  const [dockChatText, setDockChatText] = useState("");
  const [hotbarOpen, setHotbarOpen] = useState(false);
  const [emotePickerOpen, setEmotePickerOpen] = useState(false);
  const [snowballAimActive, setSnowballAimActive] = useState(false);
  const [selectedTokenOnBoard, setSelectedTokenOnBoard] = useState(null);
  const { targetedTokens, primaryTarget: targetedToken } = useTargetSelection();

  const [aoeDemarcateConfig, setAoeDemarcateConfig] = useState(null);
  const [actionBlockNotice, setActionBlockNotice] = useState(null);
  const actionNoticeTimerRef = useRef(null);

  const showActionBlockNotice = (msg) => {
    if (!msg) return;
    setActionBlockNotice(msg);
    if (actionNoticeTimerRef.current) clearTimeout(actionNoticeTimerRef.current);
    actionNoticeTimerRef.current = setTimeout(() => setActionBlockNotice(null), 2600);
  };

  useEffect(() => {
    return () => {
      if (actionNoticeTimerRef.current) clearTimeout(actionNoticeTimerRef.current);
    };
  }, []);

  const { broadcastTargets, broadcastAoeDemarcate } = useCrossWindowSync({
    campaignId,
    targetedTokens,
    aoeDemarcateConfig,
    onTargetsReceived: (payload) => {
      externalTargetReceiverRef.current?.(payload);
    },
    onAoeDemarcateReceived: (config) => {
      setAoeDemarcateConfig(config || null);
    }
  });

  useEffect(() => {
    broadcastTargetsRef.current = broadcastTargets;
  }, [broadcastTargets, broadcastTargetsRef]);

  const handleStartAoeDemarcate = (config) => {
    const next = config || null;
    setAoeDemarcateConfig(next);
    broadcastAoeDemarcate(next);
  };

  const [damageModalMsg, setDamageModalMsg] = useState(null);
  const [activeSavingThrowReq, setActiveSavingThrowReq] = useState(null);

  const activeSceneId = activeScene?.id || null;
  const dismissedSaveIdsRef = useRef(new Set());
  const inFlightSaveIdsRef = useRef(new Set());

  const editableCharacterIds = useMemo(
    () =>
      allCharacters
        .filter((character) => canEditCharacter(character))
        .map((character) => character.id),
    [allCharacters, canEditCharacter]
  );
  useAllyCostsProcessor({
    campaignId,
    uid: user?.uid || null,
    isGM: isRealGM,
    editableCharacterIds,
    enabled: Boolean(campaignId && user)
  });
  useRefereeLoop({
    campaignId,
    isRealGM,
    isMainWindow: !standaloneSheetId,
    tokens: liveTokensWithSecrets,
    tokenSecretsById: secretsByTokenId,
    characters: allCharacters
  });

    // Revisão pós-6.8 (A20): renova o registro enquanto a ficha destacada estiver aberta. Sem isso,
    // ele expirava em OPEN_SHEET_TTL_MS (30 min) e a janela principal deixava de ceder a vez,
    // abrindo o pop-up por um instante antes de a ficha destacada assumi-lo.

  const onlineList = Object.values(onlineUsers || {}).filter((u) => u?.online);
  // Fase 3.1 (errata Fase 3 §4.2): nome do jogador resolvido pelo ponto único resolveSpeakerIdentity
  const currentDisplayName = resolveSpeakerIdentity({
    user,
    myPlayerProfile,
    playersMap
  }).senderName;

  const activeCharacter = useMemo(() => {
    // 1. Se houver um token selecionado no tabuleiro, valida se o usuário pode controlá-lo
    if (selectedTokenOnBoard) {
      const isControlled =
        isGM ||
        Boolean(user && selectedTokenOnBoard.ownerId === user.uid) ||
        hasControlledByAccess(selectedTokenOnBoard.controlledBy, user?.uid);

      if (isControlled) {
        if (selectedTokenOnBoard.characterId) {
          const charFromToken = characters.find((c) => c.id === selectedTokenOnBoard.characterId);
          if (charFromToken && canEditCharacter(charFromToken)) return charFromToken;
        }
      }
    }

    // 2. Se houver ficha aberta
    if (openCharacterId) {
      const opened = characters.find((c) => c.id === openCharacterId);
      if (opened && canEditCharacter(opened)) return opened;
    }

    // 3. Primeiro personagem pertencente ao usuário
    return (
      characters.find((c) => c.ownerId === user?.uid) ||
      (isGM ? characters[0] : null) ||
      null
    );
  }, [selectedTokenOnBoard, isGM, user, characters, openCharacterId, canEditCharacter]);

  const openedSheetCharacter = useMemo(() => {
    const targetId = standaloneSheetId || openCharacterId;
    if (!targetId) return null;
    return characters.find((c) => c.id === targetId) || null;
  }, [characters, standaloneSheetId, openCharacterId]);

  // Fase 3.1 (V-05): identifica a instância de token que está agindo por uma ficha.
  // Prioriza o token selecionado no tabuleiro; sem seleção, só aceita um token único da ficha.
  const resolveActorToken = (character, preferredTokenId = null) => {
    if (!character) return null;
    const boardTokens = liveTokensWithSecrets || [];
    if (preferredTokenId) {
      const preferred = boardTokens.find((t) => t.id === preferredTokenId);
      if (preferred) return preferred;
    }
    if (selectedTokenOnBoard?.characterId === character.id) {
      return boardTokens.find((t) => t.id === selectedTokenOnBoard.id) || selectedTokenOnBoard;
    }
    const sameCharTokens = boardTokens.filter((t) => t.characterId === character.id);
    return sameCharTokens.length === 1 ? sameCharTokens[0] : null;
  };

  const handleExecuteSheetRoll = async (incomingRollParams) => {
    const activeTargets =
      Array.isArray(incomingRollParams.targetedTokens) && incomingRollParams.targetedTokens.length > 0
        ? incomingRollParams.targetedTokens
        : targetedTokens;

    const primaryTarget = incomingRollParams.targetedToken ?? activeTargets[0] ?? null;

    const rollParams = incomingRollParams;

    const actor = rollParams.character || activeCharacter;
    const resolvedActionKind =
      rollParams.trigger ||
      (rollParams.rollKind === ROLL_KINDS.SAVING_THROW
        ? "saving_throw"
        : rollParams.rollKind === ROLL_KINDS.CHECK
          ? "check"
          : "active");
    const actCheck = turnPolicy.canActorAct(actor, resolvedActionKind, {
      isGM,
      isFollowUp: Boolean(rollParams.isFollowUp || rollParams.parentMessageId)
    });
    if (!actCheck.allowed) {
      showActionBlockNotice(actCheck.reason);
      return false;
    }
    const sentMsg = await executeRoll({
      ...rollParams,
      character: actor,
      actorToken: resolveActorToken(actor),
      sceneId: activeSceneId,
      targetedToken: primaryTarget,
      targetedTokens: activeTargets.length > 0 ? activeTargets : (primaryTarget ? [primaryTarget] : []),
      allCharacters,
      // Fase 3.1 (V-05): custo da habilidade sai do token da matriz GM/NPC, nunca da ficha-matriz
      onDeductResource: async (charId, resKey, nextVal, meta = {}) => {
        const payer = allCharacters.find((c) => c.id === charId) || actor;
        const amount =
          Number(meta.amount) ||
          Math.max(0, Number(payer?.resources?.[resKey]?.current ?? 0) - Number(nextVal));
        return await deductActorResources({
          campaignId,
          campaign,
          user,
          character: payer,
          actorToken: resolveActorToken(payer),
          sceneId: activeSceneId,
          costs: { [resKey]: amount },
          updateCharacterResource,
          opId: meta.opId || null
        });
      }
    });
    if (!sentMsg) return false;

    if (
      combatState?.active &&
      isRealGM &&
      actor &&
      actCheck.budgetField &&
      !rollParams.isFollowUp &&
      !rollParams.parentMessageId
    ) {
      await consumeCampaignTurnAction(campaignId, combatState, actor, resolvedActionKind);
    }

    if (!standaloneSheetId) {
      setSidebarOpen(true);
      setActiveSidebarTab("chat");
    }
    return true;
  };

  const handlePingSkill = async (pingParams) => {
    await sendSkillPing({
      character: pingParams.character || activeCharacter,
      skill: pingParams.skill,
      visibility: pingParams.visibility || rollVisibility
    });
    if (!standaloneSheetId) {
      setSidebarOpen(true);
      setActiveSidebarTab("chat");
    }
  };

  // Detecta automaticamente novos pedidos de Teste de Resistência direcionados ao jogador / Mestre
  useEffect(() => {
    if (!user || !Array.isArray(messages) || messages.length === 0) return;

    const answeredSaveIds = new Set(
      messages
        .map((m) => m.rollData?.respondedToSaveId)
        .filter(Boolean)
    );

    // Fase 6.4 (A20): fecha o pop-up automaticamente assim que a resposta chegar ao chat.
    setActiveSavingThrowReq((prev) =>
      prev?.id && answeredSaveIds.has(prev.id) ? null : prev
    );

    // Procura do mais recente para o mais antigo por um pedido recente ainda não respondido
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const req = m?.rollData?.savingThrowRequest;
      if (!req || !req.id) continue;
      if (answeredSaveIds.has(req.id) || dismissedSaveIdsRef.current.has(req.id)) continue;

      const targetCharacter = req.targetCharacterId
        ? allCharacters.find((character) => character.id === req.targetCharacterId) || null
        : null;
      const targetToken = req.targetTokenId
        ? liveTokensWithSecrets.find((token) => token.id === req.targetTokenId) || null
        : null;

      if (
        !isUserResponsibleForSavingThrow({
          uid: user.uid,
          isGM,
          savingThrowRequest: req,
          campaignGmId: campaign?.gmId,
          targetCharacter,
          targetToken
        })
      ) {
        continue;
      }

      // Janela destacada (?sheetId=...) só abre automaticamente pedidos do próprio personagem.
      if (standaloneSheetId && req.targetCharacterId !== standaloneSheetId) {
        continue;
      }

      // Se a janela principal detectar que a ficha destacada do alvo está aberta, dá preferência
      // a ela antes de reivindicar o pop-up para evitar abertura dupla entre janelas.
      if (!standaloneSheetId && hasSheetOpen(user.uid, req.targetCharacterId)) continue;
      setActiveSavingThrowReq((prev) =>
        prev?.id === req.id ? prev : { ...req, parentMessageId: m.id }
      );
      break;
    }
  }, [
    messages,
    user,
    isGM,
    campaign?.gmId,
    standaloneSheetId,
    allCharacters,
    liveTokensWithSecrets,
    hasSheetOpen
  ]);

  const handleExecuteDamageRoll = async ({
    isCrit,
    baseFormula,
    critFormula,
    extraDamage,
    selectedTriggers = [],
    attackMessage,
    character
  }) => {
    const attacker =
      character ||
      allCharacters.find(
        (c) => c.id === (attackMessage?.sender?.characterId || attackMessage?.characterId)
      ) ||
      activeCharacter;

    // 1. Deduz custos de recursos ou itens dos gatilhos selecionados
    // (Fase 3.1 / V-05: MP/HP de matriz GM/NPC saem da instância do token atacante)
    // 2. Fórmula final de dano (Normal vs Crítico + Extra + Gatilhos com dados dobrados no crítico)
    const coreFormula = isCrit
      ? String(critFormula || "").trim() || doubleDiceInFormula(baseFormula)
      : baseFormula;
    const formattedExtra = isCrit && extraDamage
      ? doubleDiceInFormula(extraDamage)
      : extraDamage;
    const triggerFormulas = selectedTriggers
      .map((t) => (isCrit && t.formula ? doubleDiceInFormula(t.formula) : t.formula))
      .filter(Boolean);
    const parts = [coreFormula, formattedExtra, ...triggerFormulas].filter(Boolean);
    const combinedFormula = parts.join(" + ");

    // 3. Verifica se algum gatilho exige Teste de Resistência
    const triggerWithSave = selectedTriggers.find(
      (t) => t.savingThrow?.enabled
    );
    const saveToAttach =
      triggerWithSave?.savingThrow ||
      (!attackMessage?.rollData?.savingThrowRequest &&
      attackMessage?.rollData?.damageConfig?.savingThrow?.enabled
        ? attackMessage.rollData.damageConfig.savingThrow
        : null);

    const triggerNames = selectedTriggers.map((t) => t.name);
    const baseTitle = attackMessage?.rollData?.title || "Ataque";
    const rollTitle = `${baseTitle} — ${isCrit ? "Dano Crítico" : "Dano"}${
      triggerNames.length > 0 ? ` (+ ${triggerNames.join(", ")})` : ""
    }`;

    const prevTargetInfo = attackMessage?.rollData?.targetInfo || null;

    await executeRoll({
      title: rollTitle,
      categoryColor: isCrit
        ? "#f59e0b"
        : (attackMessage?.rollData?.categoryColor || "#e53935"),
      description:
        triggerNames.length > 0
          ? `Gatilhos: ${triggerNames.join(", ")}`
          : "",
      character: attacker,
      primaryFormula: combinedFormula,
      primaryLabel: isCrit ? "Dano Crítico (2x)" : "Dano",
      secondaryFormula: "",
      visibility: attackMessage?.visibility || rollVisibility,
      icon: attackMessage?.icon || attackMessage?.rollData?.icon || "sword",
      targetedToken: null,
      allCharacters,
      effectType:
        triggerWithSave?.effectType ||
        attackMessage?.rollData?.damageConfig?.effectType ||
        "damage",
      savingThrow: saveToAttach,
      rollKind: ROLL_KINDS.DAMAGE,
      deferSecondaryDamage: false,
      targetInfoOverride: prevTargetInfo
        ? {
            tokenId: prevTargetInfo.tokenId,
            sceneId: prevTargetInfo.sceneId,
            characterId: prevTargetInfo.characterId,
            name: prevTargetInfo.name,
            imageUrl: prevTargetInfo.imageUrl,
            isAttackRoll: false,
            isHit: null
          }
        : null,
      parentMessageId: attackMessage?.id || null,
      costs: [
        {
          kind: "combat_items",
          characterId: attacker?.id || null,
          actorTokenId: resolveActorToken(attacker)?.id || null,
          sceneId: activeSceneId,
          items: selectedTriggers
        }
      ],
      executeEffects: ({ opId }) =>
        consumeCombatCosts({
          campaignId,
          campaign,
          user,
          character: attacker,
          actorToken: resolveActorToken(attacker),
          sceneId: activeSceneId,
          itemsToConsume: selectedTriggers,
          updateCharacterResource,
          consumeCharacterItem,
          opId
        })
    });

    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  const handleOpenSavingThrowModal = (req) => {
    if (!req?.id) return;
    if (messages.some((m) => m.rollData?.respondedToSaveId === req.id)) {
      return;
    }
    const targetCharacter = req.targetCharacterId
      ? allCharacters.find((character) => character.id === req.targetCharacterId) || null
      : null;
    const targetToken = req.targetTokenId
      ? liveTokensWithSecrets.find((token) => token.id === req.targetTokenId) || null
      : null;
    if (
      !isUserResponsibleForSavingThrow({
        uid: user?.uid,
        isGM,
        savingThrowRequest: req,
        campaignGmId: campaign?.gmId,
        targetCharacter,
        targetToken
      })
    ) {
      return;
    }
    setActiveSavingThrowReq(req);
  };

  const handleExecuteSavingThrow = async ({
    savingThrowRequest,
    attributeLabel,
    formula,
    selectedAssists = [],
    defenderCharacter
  }) => {
    const saveId = savingThrowRequest?.id;
    if (!savingThrowRequest || !saveId) return false;
    if (inFlightSaveIdsRef.current.has(saveId)) return false;

    const alreadyAnswered = messages.some(
      (m) => m.rollData?.respondedToSaveId === saveId
    );
    if (alreadyAnswered) {
      dismissedSaveIdsRef.current.add(saveId);
      setActiveSavingThrowReq((prev) => (prev?.id === saveId ? null : prev));
      return false;
    }

    inFlightSaveIdsRef.current.add(saveId);
    dismissedSaveIdsRef.current.add(saveId);

    try {
      // Fase 3.1 (V-05): MP/HP de matriz GM/NPC saem da instância do token defensor
      const parsedDc = Number(savingThrowRequest.dc);
      const dc = Number.isFinite(parsedDc) ? parsedDc : 10;

      await executeRoll({
        title: `Resistência (${attributeLabel}) — ${savingThrowRequest.sourceRollName || "Teste"}`,
        categoryColor: "#7e22ce",
        description: savingThrowRequest.effectDescription || "",
        character: defenderCharacter,
        senderName:
          savingThrowRequest.targetName ||
          defenderCharacter?.name ||
          currentDisplayName,
        primaryFormula: formula,
        primaryLabel: `${attributeLabel} (CD ${dc})`,
        secondaryFormula: "",
        visibility: rollVisibility,
        icon: "shield",
        rollKind: ROLL_KINDS.SAVING_THROW,
        deferSecondaryDamage: false,
        respondedToSaveId: saveId,
        requestMessageId: savingThrowRequest.parentMessageId,
        parentMessageId: savingThrowRequest.parentMessageId,
        savingThrowOutcome: {
          dc,
          attribute: attributeLabel,
          effectDescription: savingThrowRequest.effectDescription || ""
        },
        costs: [
          {
            kind: "combat_items",
            characterId: defenderCharacter?.id || null,
            actorTokenId: savingThrowRequest.targetTokenId || null,
            sceneId: savingThrowRequest.targetSceneId || activeSceneId,
            items: selectedAssists
          }
        ],
        executeEffects: ({ opId }) =>
          consumeCombatCosts({
            campaignId,
            campaign,
            user,
            character: defenderCharacter,
            actorToken: resolveActorToken(
              defenderCharacter,
              savingThrowRequest.targetTokenId
            ),
            sceneId: savingThrowRequest.targetSceneId || activeSceneId,
            itemsToConsume: selectedAssists,
            updateCharacterResource,
            consumeCharacterItem,
            opId
          })
      });

      setActiveSavingThrowReq(null);
      if (!standaloneSheetId) {
        setSidebarOpen(true);
        setActiveSidebarTab("chat");
      }
      return true;
    } finally {
      inFlightSaveIdsRef.current.delete(saveId);
    }
  };

  const handleApplyCombatEffect = async ({
    msg,
    baseValue,
    scaleMode = "full",
    customValue = null,
    effectType = "damage",
    manualModifiers = []
  }) => {
    const targetRef = msg?.roll?.targets?.[0] || null;
    const targetToken = targetRef?.tokenId
      ? liveTokensWithSecrets.find((token) => token.id === targetRef.tokenId) || null
      : null;
    const targetCharacter = targetRef?.characterId
      ? allCharacters.find((character) => character.id === targetRef.characterId) || null
      : null;
    const sourceCharacter = msg?.sender?.characterId
      ? allCharacters.find((character) => character.id === msg.sender.characterId) || null
      : null;
    await applyCombatEffect({
      campaignId,
      user,
      message: msg,
      baseValue,
      scaleMode,
      customValue,
      effectType,
      manualModifiers,
      sourceCharacter,
      targetCharacter,
      targetToken
    });
  };

  // Coloca o Token do Personagem diretamente no Mapa Ativo em Tempo Real
  const handleSpawnCharacterToken = async (char, spawnOptions = {}) => {
    // Fase 6.2 (A11): sem permissão de edição, o serviço não grava nada; avisa em vez de falhar em silêncio
    if (char && !isGM && !canEditCharacter(char)) {
      showActionBlockNotice("Só quem pode editar esta ficha coloca o token dela no mapa.");
      return;
    }
    try {
      await spawnCharacterTokenToScene({
        campaignId,
        campaign,
        user,
        isGM,
        canEditCharacter,
        activeScene,
        char,
        spawnOptions,
        fog: fogApi.fog
      });
    } catch (err) {
      // Fase 3.1 (V-12): falha de escrita no RTDB deixa de ser silenciosa
      console.warn("Falha ao colocar token no mapa:", err);
      showActionBlockNotice("Não foi possível colocar o token no mapa.");
    }
  };

  // Sincronização Token (Tabuleiro) -> Ficha (Firestore) apenas para PCs (nunca para NPC/Matriz do Mestre)
  const handleSyncTokenToCharacter = async (token, updatedFields = {}) => {
    await syncTokenUpdatesToCharacter({
      token,
      updatedFields,
      allCharacters,
      campaign,
      canEditCharacter,
      updateCharacter
    });
  };

  const handleDockChatSubmit = async (e) => {
    e.preventDefault();
    if (!dockChatText.trim()) return;
    const raw = dockChatText.trim();
    setDockChatText("");

    const speaker = resolveSpeakerIdentity({
      character: activeCharacter,
      user,
      myPlayerProfile,
      playersMap
    });

    // Rolagens no chat
    // Fase 6.3 (A14): passa pelo mesmo caminho da barra lateral (handleExecuteSheetRoll), que
    // anexa os alvos atuais e aplica o bloqueio do Modo de Turno.
    if (raw.startsWith("/r ") || raw.startsWith("/roll ")) {
      const expr = raw.replace(/^\/r(oll)?\s+/i, "");
      await handleExecuteSheetRoll({
        title: `Rolagem (${expr})`,
        primaryFormula: expr,
        primaryLabel: "Resultado",
        // Fase 3.1 (V-03): rolagem livre é teste (CHECK), nunca ataque contra a Defesa
        rollKind: ROLL_KINDS.CHECK,
        character: activeCharacter,
        senderName: speaker.senderName,
        senderPhotoURL: speaker.senderPhotoURL,
        visibility: rollVisibility
      });
      return;
    }

    // Mensagem de texto comum
    await sendTextMessage({
      content: raw,
      senderName: speaker.senderName,
      senderPhotoURL: speaker.senderPhotoURL,
      characterId: speaker.characterId,
      characterMediaId: speaker.characterMediaId
    });
    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  const handleSelectEmote = async (emote) => {
    if (!emote) return;
    setEmotePickerOpen(false);

    const speaker = resolveSpeakerIdentity({
      character: activeCharacter,
      user,
      myPlayerProfile,
      playersMap
    });

    await sendEmoteMessage({
      icon: emote.id,
      senderName: speaker.senderName,
      senderPhotoURL: speaker.senderPhotoURL,
      characterId: speaker.characterId,
      characterMediaId: speaker.characterMediaId,
      visibility: rollVisibility
    });
    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  // Fase 5: props dos modais de combate, compartilhadas pela mesa e pela janela destacada
  const combatModalsProps = {
    damageModalMsg,
    setDamageModalMsg,
    activeSavingThrowReq,
    setActiveSavingThrowReq,
    dismissedSaveIdsRef,
    allCharacters,
    handleExecuteDamageRoll,
    handleExecuteSavingThrow
  };

  // Modo Janela Dedicada (Pop-out para tela cheia ou Alt+Tab) — Fase 5: StandaloneSheetView
  // renderiza a ficha e os modais de combate (antes só a ficha).
  if (standaloneSheetId) {
    return (
      <StandaloneSheetView
        character={openedSheetCharacter}
        combatModalsProps={combatModalsProps}
        sheetProps={{
          campaignId,
          playersMap,
          compendiumEntries,
          canEdit: openedSheetCharacter ? canEditCharacter(openedSheetCharacter) : false,
          isGM,
          rollVisibility,
          onChangeRollVisibility: setRollVisibility,
          onUpdateCharacter: updateCharacter,
          onRenameCharacter: renameCharacter,
          onUpdateCharacterResource: updateCharacterResource,
          onAddCharacterEntry: addCharacterEntry,
          onUpdateCharacterEntry: updateCharacterEntry,
          onRemoveCharacterEntry: removeCharacterEntry,
          onReorderCharacterEntries: reorderCharacterEntries,
          onSetHotbarSlot: setCharacterHotbarSlot,
          onShareCharacter: shareCharacter,
          onTransferCharacter: transferCharacter,
          onConsumeCharacterItem: consumeCharacterItem,
          onPullCompendiumEntry: pullCompendiumEntry,
          onUploadCharacterImage: uploadCharacterImage,
          onExecuteRoll: handleExecuteSheetRoll,
          onPingSkill: handlePingSkill,
          onSpawnTokenOnMap: activeScene ? handleSpawnCharacterToken : null,
          onStartAoeDemarcate: handleStartAoeDemarcate
        }}
      />
    );
  }

  const activeCombatant = combatState?.active ? getActiveCombatant(combatState) : null;
  const combinedError = firestoreError || scenesError;

  return (
    <div
      className={`vtt-shell ${snowballAimActive ? "cp-snowball-aiming" : ""}`}
      style={SNOWBALL_CURSOR_STYLE}
    >
      {/* Barra Superior */}
      <header className="vtt-topbar">
        <div className="vtt-topbar-left">
          <h2 className="cp-title" style={{ fontSize: "20px" }}>
            {campaign?.name || "CLUB PENGUIN VTT"}
          </h2>

          <span
            className={`cp-badge ${isGM ? "cp-badge-gm" : "cp-badge-player"}`}
          >
            {isGM ? "MESTRE EPF" : "PLAYER"}
          </span>

          {isRealGM && (
            <button
              type="button"
              className={`cp-btn cp-btn-epf ${viewAsPlayer ? "active" : ""}`}
              style={{ padding: "5px 12px", fontSize: "12px" }}
              onClick={() => setViewAsPlayer((prev) => !prev)}
            >
              {viewAsPlayer ? "Visão: Player" : "Visão: Mestre"}
            </button>
          )}
        </div>

        <div className="vtt-topbar-center">
          <div className="presence-list">
            {onlineList.map((u) => (
              <div key={u.uid} className="presence-pill">
                <span className="presence-dot" />
                {u.photoURL && (
                  <img
                    src={u.photoURL}
                    alt=""
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                )}
                <span>{u.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="vtt-topbar-right">
          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
            onClick={() => setProfileModalOpen(true)}
            title="Editar Perfil do Jogador"
          >
            {myPlayerProfile?.photoURL ? (
              <img
                src={myPlayerProfile.photoURL}
                alt=""
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1.5px solid #001b3a"
                }}
              />
            ) : (
              <span style={{ fontSize: "14px" }}>🐧</span>
            )}
            <span>{currentDisplayName}</span>
          </button>

          {isGM && !combatState?.active && (
            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{ padding: "6px 12px", fontSize: "13px" }}
              onClick={() =>
                startTurnCombat({
                  campaignId,
                  tokens: liveTokensWithSecrets,
                  allCharacters
                })
              }
              title="Iniciar Modo de Turnos"
            >
              ⚔️ Turnos
            </button>
          )}

          {isGM && (
            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{ padding: "6px 12px", fontSize: "13px" }}
              onClick={() => setGmModalOpen(true)}
              title="Painel de Agentes (Mestre)"
            >
              Agentes
            </button>
          )}

          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Área Principal do Tabuleiro */}
      <main className="vtt-stage">
        {combinedError && (
          <div
            className="cp-window"
            style={{
              maxWidth: "460px",
              zIndex: 30,
              position: "absolute",
              top: "64px"
            }}
          >
            <div
              className="cp-window-inner"
              style={{ color: "#b71c1c", fontWeight: 700 }}
            >
              {combinedError}
            </div>
          </div>
        )}

        {actionBlockNotice && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              zIndex: 49,
              background: "rgba(185, 28, 28, 0.95)",
              border: "2px solid #fca5a5",
              borderRadius: "999px",
              padding: "5px 14px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 900,
              boxShadow: "0 6px 20px rgba(0,0,0,0.55)"
            }}
          >
            ⏳ {actionBlockNotice}
          </div>
        )}

        {combatState?.active && (
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "14px",
              zIndex: 47,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(11, 25, 44, 0.92)",
              border: "2px solid #f59e0b",
              borderRadius: "999px",
              padding: "4px 12px",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 900,
              boxShadow: "0 4px 14px rgba(0,0,0,0.55)"
            }}
          >
            <span style={{ color: "#fbbf24" }}>R{combatState.round}</span>
            <span>{activeCombatant?.name || "Turno"}</span>
            {activeCombatant && (
              <span style={{ color: "#38bdf8", fontSize: "11px" }}>
                {Math.max(
                  0,
                  activeCombatant.movementBudgetMeters - activeCombatant.movementUsedMeters
                )
                  .toFixed(1)
                  .replace(".", ",")}
                m
              </span>
            )}
            {isGM && (
              <>
                <button
                  type="button"
                  className="cp-btn"
                  style={{ padding: "2px 6px", fontSize: "10px", height: "22px" }}
                  onClick={() => regressCampaignTurn(campaignId, combatState)}
                  title="Turno Anterior"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{ padding: "2px 6px", fontSize: "10px", height: "22px" }}
                  onClick={() => advanceCampaignTurn(campaignId, combatState)}
                  title="Próximo Turno"
                >
                  ▶
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{ padding: "2px 6px", fontSize: "10px", height: "22px" }}
                  onClick={() => stopTurnCombat(campaignId, combatState)}
                  title="Encerrar Turnos"
                >
                  ■
                </button>
              </>
            )}
          </div>
        )}

        {activeDockModule === "board" && (
          <BoardViewport
            activeScene={activeScene}
            campaignId={campaignId}
            playersMap={playersMap}
            isGM={isGM}
            messages={messages}
            activeCharacter={activeCharacter}
            allCharacters={allCharacters}
            tokensApi={tokensApi}
            secretsByTokenId={secretsByTokenId}
            fogApi={fogApi}
            onUpdateSceneGrid={updateScene}
            onOpenScenesManager={() => {
              setScenesModalInitialTab("scenes");
              setScenesModalOpen(true);
            }}
            onSelectedTokenChange={setSelectedTokenOnBoard}
            aoeDemarcateConfig={aoeDemarcateConfig}
            onCloseAoeDemarcate={() => handleStartAoeDemarcate(null)}
            snowballAimActive={snowballAimActive}
            onDeactivateSnowballAim={() => setSnowballAimActive(false)}
            onSyncTokenToCharacter={handleSyncTokenToCharacter}
            onAdjustPcResource={applyCharacterResourceDelta}
          />
        )}

        {activeDockModule === "journal" && (
          <JournalWorkspace
            campaignId={campaignId}
            currentUserId={user?.uid}
            isGM={isGM}
            playersMap={playersMap}
            characters={characters}
            accessibleNotes={accessibleNotes}
            accessibleFolders={accessibleFolders}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onSaveNoteDraft={saveNoteDraft}
            onUpdateNodePosition={updateNodePosition}
            onCloneNoteToTarget={cloneNoteToTarget}
            onShareNoteWithTarget={shareNoteWithTarget}
            onRevokeNoteAccess={revokeNoteAccess}
            onDeleteNote={deleteNote}
            onCreateFolder={createFolder}
            onRenameFolder={renameJournalFolder}
            onMoveFolder={moveJournalFolder}
            onMoveNoteToFolder={moveNoteToFolder}
            onDeleteFolder={deleteFolder}
            canEditNote={canEditNote}
            canDeleteNote={canDeleteNote}
            canEditFolder={canEditJournalFolder}
            canDeleteFolder={canDeleteJournalFolder}
            onOpenCharacterSheet={(charId) => setOpenCharacterId(charId)}
          />
        )}

        {/* Alça Lateral (Pull Handle) Estilo Roll20 / Foundry para Puxar o Menu Direito */}
        <button
          type="button"
          className="cp-btn cp-btn-gold"
          onClick={() => setSidebarOpen((prev) => !prev)}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 28,
            padding: "14px 8px",
            borderRadius: "12px 0 0 12px"
          }}
        >
          {sidebarOpen ? "▶" : "◀"}
        </button>

        {/* Botão de Mapa no canto inferior esquerdo para todos (Mestre e Players) */}
        <button
          type="button"
          className={`cp-dock-map-trigger ${scenesModalOpen ? "active" : ""}`}
          onClick={() => {
            setScenesModalInitialTab("map");
            setScenesModalOpen(true);
          }}
          title="Mapa da Campanha"
        >
          <img
            src={getAssetUrl("map-icon.png")}
            alt="Mapa da Campanha"
            className="cp-dock-map-img"
          />
        </button>

        {/* Dock Inferior Clássico do Club Penguin */}
        <nav className="vtt-dock">
          {/* Grupo Esquerda */}
          <div className="cp-dock-group">
            {/* Tabuleiro / Mapa Atual */}
            <button
              type="button"
              className={`cp-dock-btn ${activeDockModule === "board" ? "active" : ""}`}
              onClick={() => setActiveDockModule("board")}
              title="Tabuleiro (Mapa Atual)"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
                <path d="M9 3v18" />
                <path d="M15 3v18" />
              </svg>
            </button>

            {/* Ações Rápidas (Hotbar 3x3) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className={`cp-dock-btn ${hotbarOpen ? "active" : ""}`}
                title="Ações Rápidas"
                onClick={() => setHotbarOpen((prev) => !prev)}
              >
                <img
                  src={getAssetUrl("icones/iconeAcoesRapidas.png")}
                  alt="Ações Rápidas"
                  width="22"
                  height="22"
                  draggable={false}
                  style={{ objectFit: "contain", pointerEvents: "none" }}
                />
              </button>

              {hotbarOpen && (
                <QuickActionsHotbar
                  character={activeCharacter}
                  onExecuteRoll={handleExecuteSheetRoll}
                  onUpdateCharacter={updateCharacter}
                  onSetHotbarSlot={setCharacterHotbarSlot}
                  onOpenSheet={(charId) => setOpenCharacterId(charId)}
                  onClose={() => setHotbarOpen(false)}
                />
              )}
            </div>

            {/* Novo Botão Bola de Neve (à esquerda do chat) */}
            <button
              type="button"
              className={`cp-dock-btn ${snowballAimActive ? "active" : ""}`}
              title="Bola de Neve"
              onClick={() => {
                if (!snowballAimActive) {
                  if (activeDockModule !== "board") {
                    setActiveDockModule("board");
                  }
                  setSnowballAimActive(true);
                } else {
                  setSnowballAimActive(false);
                }
              }}
            >
              <img
                src={getAssetUrl("icones/iconeBolaDeNeve.png")}
                alt="Bola de Neve"
                width="22"
                height="22"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>

            {/* Novo Botão Emotes (à esquerda do chat) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className={`cp-dock-btn ${emotePickerOpen ? "active" : ""}`}
                title="Emotes"
                onClick={() => setEmotePickerOpen((prev) => !prev)}
              >
                <img
                  src={getAssetUrl("icones/iconeEmotes.webp")}
                  alt="Emotes"
                  width="22"
                  height="22"
                  draggable={false}
                  style={{ objectFit: "contain", pointerEvents: "none" }}
                />
              </button>

              {emotePickerOpen && (
                <EmotePickerMenu
                  onSelectEmote={handleSelectEmote}
                  onClose={() => setEmotePickerOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Barra de Chat Central */}
          <form className="cp-dock-chat-form" onSubmit={handleDockChatSubmit}>
            <input
              type="text"
              className="cp-dock-chat-input"
              placeholder="Falar ou /r 1d20+4..."
              value={dockChatText}
              onChange={(e) => setDockChatText(e.target.value)}
            />
            <button
              type="submit"
              className="cp-dock-chat-send"
              title="Enviar mensagem / rolar"
            >
              <img
                src={getAssetUrl("icones/iconeChat.png")}
                alt="Enviar"
                width="16"
                height="16"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>
          </form>

          {/* Grupo Direita */}
          <div className="cp-dock-group">
            {/* Meu Pinguim (Ficha) - Movido para a direita do chat */}
            <button
              type="button"
              className={`cp-dock-btn ${openCharacterId ? "active" : ""}`}
              title="Meu Pinguim (Ficha)"
              onClick={async () => {
                if (activeCharacter) {
                  setOpenCharacterId(activeCharacter.id);
                } else {
                  const displayName =
                    user?.displayName || user?.email?.split("@")[0] || "Pinguim";
                  const createdId = await createCharacter({
                    name: displayName,
                    type: "pc",
                    visibleToAll: true
                  });
                  if (createdId) {
                    setOpenCharacterId(createdId);
                  } else {
                    setSidebarOpen(true);
                    setActiveSidebarTab("sheets");
                  }
                }
              }}
            >
              <img
                src={getAssetUrl("icones/iconeFicha.png")}
                alt="Meu Pinguim"
                width="22"
                height="22"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>

            {/* Livro / Compêndio */}
            <button
              type="button"
              className={`cp-dock-btn ${compendiumModalOpen ? "active" : ""}`}
              onClick={() => setCompendiumModalOpen(true)}
              title="Livro / Compêndio"
            >
              <img
                src={getAssetUrl("icones/iconeCompendio.png")}
                alt="Livro / Compêndio"
                width="22"
                height="22"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>

            {/* Diários e Teias */}
            <button
              type="button"
              className={`cp-dock-btn ${activeDockModule === "journal" ? "active" : ""}`}
              onClick={() => setActiveDockModule("journal")}
              title="Diários e Teias"
            >
              <img
                src={getAssetUrl("icones/iconeDiarios.png")}
                alt="Diários e Teias"
                width="22"
                height="22"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>

            {/* Lista de Amigos / Agentes */}
            <button
              type="button"
              className={`cp-dock-btn ${gmModalOpen ? "active" : ""}`}
              onClick={() => setGmModalOpen(true)}
              title="Lista de Amigos / Agentes"
            >
              <img
                src={getAssetUrl("icones/iconeListaMembros.webp")}
                alt="Lista de Amigos"
                width="22"
                height="22"
                draggable={false}
                style={{ objectFit: "contain", pointerEvents: "none" }}
              />
            </button>
          </div>
        </nav>
      </main>

      {/* Menu Lateral Direito Puxável (Estilo Roll20 / Foundry) */}
      <aside className={`vtt-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="vtt-sidebar-tabs">
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "chat" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "sheets" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("sheets")}
          >
            Personagens ({characters.length})
          </button>
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "journal" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("journal")}
          >
            Diários ({accessibleNotes.length})
          </button>
        </div>

        <div className="vtt-sidebar-content">
          {activeSidebarTab === "chat" && (
            <ChatSidebarPanel
              messages={messages}
              campaignId={campaignId}
              activeCharacter={activeCharacter}
              characters={characters}
              allCharacters={allCharacters}
              targetedToken={targetedToken}
              targetedTokens={targetedTokens}
              canEditCharacter={canEditCharacter}
              rollVisibility={rollVisibility}
              onChangeRollVisibility={setRollVisibility}
              onSendText={sendTextMessage}
              onExecuteRoll={handleExecuteSheetRoll}
              onOpenDamageModal={(msg) => setDamageModalMsg(msg)}
              onOpenSavingThrowModal={handleOpenSavingThrowModal}
              onApplyEffect={handleApplyCombatEffect}
              onDeleteMessage={deleteMessage}
              isGM={isGM}
            />
          )}

          {activeSidebarTab === "sheets" && (
            <CharactersSidebarList
              characters={characters}
              folders={characterFolders}
              campaignId={campaignId}
              isGM={isGM}
              canEditCharacter={canEditCharacter}
              canDeleteCharacter={canDeleteCharacter}
              canEditFolder={canEditCharacterFolder}
              canDeleteFolder={canDeleteCharacterFolder}
              currentUser={user}
              playersMap={playersMap}
              gmId={campaign?.gmId}
              onlineUsers={onlineUsers}
              onCreateCharacter={createCharacter}
              onOpenSheet={(charId) => setOpenCharacterId(charId)}
              onSpawnToken={activeScene ? handleSpawnCharacterToken : null}
              onDeleteCharacter={deleteCharacter}
              onCreateFolder={createCharacterFolder}
              onRenameFolder={renameCharacterFolder}
              onUpdateFolder={updateCharacterFolder}
              onTransferFolderOwnership={transferCharacterFolderOwnership}
              onDeleteFolder={deleteCharacterFolder}
              onMoveCharacterToFolder={moveCharacterToFolder}
              onMoveFolder={moveCharacterFolder}
            />
          )}

          {activeSidebarTab === "journal" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                height: "100%",
                minHeight: 0
              }}
            >
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ width: "100%" }}
                onClick={() => setActiveDockModule("journal")}
              >
                Abrir Diários & Teia ({accessibleNotes.length})
              </button>

              <button
                type="button"
                className="cp-btn"
                style={{ width: "100%" }}
                onClick={() => setCompendiumModalOpen(true)}
              >
                Abrir Livro do Mestre
              </button>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingRight: "2px"
                }}
              >
                {accessibleNotes.map((note) => {
                  const meta = getNoteTypeMeta(note.noteType);
                  return (
                    <div
                      key={note.id}
                      onClick={() => setActiveDockModule("journal")}
                      style={{
                        background: "#ffffff",
                        border: "2px solid #001b3a",
                        borderLeft: `6px solid ${meta.color}`,
                        borderRadius: "10px",
                        padding: "7px 9px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "12px",
                            color: "#001b3a"
                          }}
                        >
                          {note.title}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            color: "#02529c"
                          }}
                        >
                          {meta.singular.toUpperCase()}
                        </span>
                      </div>
                      {Array.isArray(note.aliases) &&
                        note.aliases.length > 0 && (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#475569",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {note.aliases.join(", ")}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modais Flutuantes */}
      {profileModalOpen && (
        <PlayerProfileModal onClose={() => setProfileModalOpen(false)} />
      )}

      {gmModalOpen && <GMPanelModal onClose={() => setGmModalOpen(false)} />}

      {scenesModalOpen && (
        <ScenesManagerModal
          scenes={scenes}
          activeSceneId={campaign?.activeSceneId || null}
          campaignId={campaignId}
          isGM={isGM}
          initialTab={scenesModalInitialTab}
          onCreateScene={createScene}
          onUpdateScene={updateScene}
          onDeleteScene={deleteScene}
          onActivateScene={activateSceneForTable}
          onClose={() => setScenesModalOpen(false)}
        />
      )}

      {compendiumModalOpen && (
        <CompendiumModal
          entries={compendiumEntries}
          isGM={isGM}
          characters={characters}
          activeCharacter={activeCharacter}
          canEditCharacter={canEditCharacter}
          onUpdateCharacter={updateCharacter}
          onAddCharacterEntry={addCharacterEntry}
          onPullCompendiumEntry={pullCompendiumEntry}
          onCreateEntry={createEntry}
          onUpdateEntry={updateEntry}
          onDeleteEntry={deleteEntry}
          onClose={() => setCompendiumModalOpen(false)}
        />
      )}

      {openedSheetCharacter && (
        <CharacterSheetModal
          character={openedSheetCharacter}
          campaignId={campaignId}
          playersMap={playersMap}
          compendiumEntries={compendiumEntries}
          canEdit={canEditCharacter(openedSheetCharacter)}
          isGM={isGM}
          rollVisibility={rollVisibility}
          onChangeRollVisibility={setRollVisibility}
          onUpdateCharacter={updateCharacter}
          onRenameCharacter={renameCharacter}
          onUpdateCharacterResource={updateCharacterResource}
          onAddCharacterEntry={addCharacterEntry}
          onUpdateCharacterEntry={updateCharacterEntry}
          onRemoveCharacterEntry={removeCharacterEntry}
          onReorderCharacterEntries={reorderCharacterEntries}
          onSetHotbarSlot={setCharacterHotbarSlot}
          onShareCharacter={shareCharacter}
          onTransferCharacter={transferCharacter}
          onConsumeCharacterItem={consumeCharacterItem}
          onPullCompendiumEntry={pullCompendiumEntry}
          onUploadCharacterImage={uploadCharacterImage}
          onExecuteRoll={handleExecuteSheetRoll}
          onPingSkill={handlePingSkill}
          onSpawnTokenOnMap={
            activeScene ? handleSpawnCharacterToken : null
          }
          onStartAoeDemarcate={handleStartAoeDemarcate}
          onClose={() => setOpenCharacterId(null)}
        />
      )}

      {/* Modais de Combate (Dano e Teste de Resistência) — Fase 5: componente compartilhado com a janela destacada */}
      <CombatModals {...combatModalsProps} />
    </div>
  );
}
