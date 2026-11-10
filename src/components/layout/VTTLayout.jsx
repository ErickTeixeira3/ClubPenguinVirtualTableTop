import { useEffect, useMemo, useRef, useState } from "react";
import { ref, set as rtdbSet, update as rtdbUpdate } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useScenes } from "../../hooks/useScenes";
import { useCharacters } from "../../hooks/useCharacters";
import { useCompendium } from "../../hooks/useCompendium";
import { useChatRolls } from "../../hooks/useChatRolls";
import { useJournalNotes } from "../../hooks/useJournalNotes";
import { getNoteTypeMeta } from "../../engines/aliasEngine";
import {
  EFFECT_TYPES,
  doubleDiceInFormula,
  computeModifiedEffectValue,
  isUserResponsibleForSavingThrow,
  getTargetStorageKey,
  saveStoredTargetedToken,
  loadStoredTargetedToken,
  saveStoredTargetedTokens,
  loadStoredTargetedTokens
} from "../../engines/combatEngine";
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
import DamageRollModal from "../combat/DamageRollModal";
import SavingThrowModal from "../combat/SavingThrowModal";

export default function VTTLayout() {
  const { user, logout } = useAuth();
  const {
    campaignId,
    campaign,
    onlineUsers,
    isRealGM,
    isGM,
    viewAsPlayer,
    setViewAsPlayer,
    myPlayerProfile,
    firestoreError
  } = useCampaign();

  const {
    scenes,
    activeScene,
    scenesError,
    createScene,
    updateScene,
    deleteScene,
    activateSceneForTable
  } = useScenes();

  const {
    characters,
    allCharacters = [],
    folders: characterFolders,
    canEditCharacter,
    createCharacter,
    updateCharacter,
    updateCharacterResource,
    uploadCharacterImage,
    deleteCharacter,
    createFolder: createCharacterFolder,
    updateFolder: updateCharacterFolder,
    deleteFolder: deleteCharacterFolder,
    moveCharacterToFolder,
    moveFolder: moveCharacterFolder
  } = useCharacters();

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
    updateMessageRollData,
    deleteMessage
  } = useChatRolls();

  const {
    accessibleNotes,
    accessibleFolders,
    createNote,
    updateNote,
    updateNodePosition,
    cloneNoteToTarget,
    shareNoteWithTarget,
    revokeNoteAccess,
    deleteNote,
    createFolder,
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
  const [targetedTokens, setTargetedTokensState] = useState(() =>
    loadStoredTargetedTokens(campaignId)
  );
  const targetedTokensRef = useRef(targetedTokens);
  const [targetedToken, setTargetedTokenState] = useState(() =>
    loadStoredTargetedToken(campaignId)
  );
  const targetedTokenRef = useRef(targetedToken);

  const setTargetedTokens = (nextListOrFn) => {
    const current = targetedTokensRef.current || [];
    const resolved = typeof nextListOrFn === "function" ? nextListOrFn(current) : nextListOrFn;
    const arr = Array.isArray(resolved) ? resolved : resolved ? [resolved] : [];
    targetedTokensRef.current = arr;
    setTargetedTokensState(arr);
    targetedTokenRef.current = arr[0] || null;
    setTargetedTokenState(arr[0] || null);
    saveStoredTargetedTokens(campaignId, arr);
  };

  const setTargetedToken = (nextTok) => {
    const resolved =
      typeof nextTok === "function" ? nextTok(targetedTokenRef.current) : nextTok;
    if (!resolved) {
      setTargetedTokens([]);
    } else {
      setTargetedTokens([resolved]);
    }
  };

  const [aoeDemarcateConfig, setAoeDemarcateConfig] = useState(null);

  const handleStartAoeDemarcate = (config) => {
    setAoeDemarcateConfig(config || null);
    try {
      if (config) {
        localStorage.setItem(`cp_vtt_aoe_demarcate_${campaignId || "default"}`, JSON.stringify(config));
      } else {
        localStorage.removeItem(`cp_vtt_aoe_demarcate_${campaignId || "default"}`);
      }
    } catch {}
  };

  useEffect(() => {
    const initialList = loadStoredTargetedTokens(campaignId);
    targetedTokensRef.current = initialList;
    setTargetedTokensState(initialList);
    targetedTokenRef.current = initialList[0] || null;
    setTargetedTokenState(initialList[0] || null);

    const storageKey = getTargetStorageKey(campaignId);
    const aoeStorageKey = `cp_vtt_aoe_demarcate_${campaignId || "default"}`;
    const handleStorage = (e) => {
      if (e.key === storageKey) {
        const updated = loadStoredTargetedTokens(campaignId);
        targetedTokensRef.current = updated;
        setTargetedTokensState(updated);
        targetedTokenRef.current = updated[0] || null;
        setTargetedTokenState(updated[0] || null);
      }
      if (e.key === aoeStorageKey) {
        try {
          const val = e.newValue ? JSON.parse(e.newValue) : null;
          setAoeDemarcateConfig(val);
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [campaignId]);

  const [damageModalMsg, setDamageModalMsg] = useState(null);
  const [activeSavingThrowReq, setActiveSavingThrowReq] = useState(null);

  const boardSyncRef = useRef({ tokens: [], updateToken: null, sceneId: null });
  const dismissedSaveIdsRef = useRef(new Set());
  const mountTimestampRef = useRef(Date.now());

  const onlineList = Object.values(onlineUsers || {}).filter((u) => u?.online);
  const currentDisplayName =
    myPlayerProfile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pinguim";

  const activeCharacter = useMemo(() => {
    // 1. Se houver um token selecionado no tabuleiro, valida se o usuário pode controlá-lo
    if (selectedTokenOnBoard) {
      const isControlled = isGM || (() => {
        const list = Array.isArray(selectedTokenOnBoard.controlledBy) ? selectedTokenOnBoard.controlledBy : [];
        return list.includes("ALL") || (user && list.includes(user.uid));
      })();

      if (isControlled) {
        if (selectedTokenOnBoard.characterId) {
          const charFromToken = characters.find((c) => c.id === selectedTokenOnBoard.characterId);
          if (charFromToken && canEditCharacter(charFromToken)) return charFromToken;
        }
        if (selectedTokenOnBoard.name) {
          const charByName = characters.find(
            (c) => c.name?.trim().toLowerCase() === selectedTokenOnBoard.name.trim().toLowerCase()
          );
          if (charByName && canEditCharacter(charByName)) return charByName;
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

  const handleExecuteSheetRoll = async (rollParams) => {
    const activeTargets =
      (Array.isArray(rollParams.targetedTokens) && rollParams.targetedTokens.length > 0)
        ? rollParams.targetedTokens
        : (targetedTokensRef.current && targetedTokensRef.current.length > 0)
        ? targetedTokensRef.current
        : loadStoredTargetedTokens(campaignId);

    const primaryTarget =
      rollParams.targetedToken ??
      activeTargets[0] ??
      targetedToken ??
      targetedTokenRef.current ??
      loadStoredTargetedToken(campaignId);

    await executeRoll({
      ...rollParams,
      targetedToken: primaryTarget,
      targetedTokens: activeTargets.length > 0 ? activeTargets : (primaryTarget ? [primaryTarget] : []),
      allCharacters,
      onDeductResource: updateCharacterResource
    });
    if (!standaloneSheetId) {
      setSidebarOpen(true);
      setActiveSidebarTab("chat");
    }
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

    // Procura do mais recente para o mais antigo por um pedido recente ainda não respondido
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const req = m?.rollData?.savingThrowRequest;
      if (!req || !req.id) continue;
      if ((m.timestampMs || 0) < mountTimestampRef.current - 15000) continue;
      if (answeredSaveIds.has(req.id) || dismissedSaveIdsRef.current.has(req.id)) continue;

      if (
        isUserResponsibleForSavingThrow({
          user,
          isGM,
          savingThrowRequest: req,
          campaignGMId: campaign?.gmId
        })
      ) {
        setActiveSavingThrowReq((prev) => (prev?.id === req.id ? prev : req));
        break;
      }
    }
  }, [messages, user, isGM, campaign?.gmId]);

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
      allCharacters.find((c) => c.id === attackMessage?.characterId) ||
      activeCharacter;

    // 1. Deduz custos de recursos ou itens dos gatilhos selecionados
    if (attacker) {
      let nextMp = Number(attacker.resources?.mp?.current ?? 0);
      let nextHp = Number(attacker.resources?.hp?.current ?? 0);
      let mpChanged = false;
      let hpChanged = false;
      let nextInventory = Array.isArray(attacker.inventory)
        ? [...attacker.inventory]
        : [];
      let invChanged = false;

      for (const trig of selectedTriggers) {
        if (trig.sourceType === "ability") {
          if (trig.costMp > 0) {
            nextMp = Math.max(0, nextMp - trig.costMp);
            mpChanged = true;
          }
          if (trig.costHp > 0) {
            nextHp = Math.max(0, nextHp - trig.costHp);
            hpChanged = true;
          }
        } else if (trig.sourceType === "item" && trig.consumeOnUse) {
          nextInventory = nextInventory
            .map((it) =>
              it.id === trig.id
                ? { ...it, qty: Math.max(0, (Number(it.qty) || 1) - 1) }
                : it
            )
            .filter((it) => (Number(it.qty) ?? 1) > 0);
          invChanged = true;
        }
      }

      if (mpChanged) await updateCharacterResource(attacker.id, "mp", nextMp);
      if (hpChanged) await updateCharacterResource(attacker.id, "hp", nextHp);
      if (invChanged) await updateCharacter(attacker.id, { inventory: nextInventory });
    }

    // 2. Fórmula final de dano (Normal vs Crítico + Extra + Gatilhos com dados dobrados no crítico)
    const coreFormula = isCrit ? doubleDiceInFormula(baseFormula) : baseFormula;
    const formattedExtra = isCrit && extraDamage
      ? doubleDiceInFormula(extraDamage)
      : extraDamage;
    const triggerFormulas = selectedTriggers
      .map((t) => (isCrit && t.formula ? doubleDiceInFormula(t.formula) : t.formula))
      .filter(Boolean);
    const parts = [coreFormula, formattedExtra, ...triggerFormulas].filter(Boolean);
    const combinedFormula = parts.join(" + ") || "1d6";

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
      rollKind: "damage",
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
      parentMessageId: attackMessage?.id || null
    });

    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  const handleExecuteSavingThrow = async ({
    savingThrowRequest,
    attributeLabel,
    formula,
    selectedAssists = [],
    defenderCharacter
  }) => {
    if (!savingThrowRequest) return;
    dismissedSaveIdsRef.current.add(savingThrowRequest.id);

    if (defenderCharacter) {
      let nextMp = Number(defenderCharacter.resources?.mp?.current ?? 0);
      let nextHp = Number(defenderCharacter.resources?.hp?.current ?? 0);
      let mpChanged = false;
      let hpChanged = false;
      let nextInventory = Array.isArray(defenderCharacter.inventory)
        ? [...defenderCharacter.inventory]
        : [];
      let invChanged = false;

      for (const ast of selectedAssists) {
        if (ast.sourceType === "ability") {
          if (ast.costMp > 0) {
            nextMp = Math.max(0, nextMp - ast.costMp);
            mpChanged = true;
          }
          if (ast.costHp > 0) {
            nextHp = Math.max(0, nextHp - ast.costHp);
            hpChanged = true;
          }
        } else if (ast.sourceType === "item" && ast.consumeOnUse) {
          nextInventory = nextInventory
            .map((it) =>
              it.id === ast.id
                ? { ...it, qty: Math.max(0, (Number(it.qty) || 1) - 1) }
                : it
            )
            .filter((it) => (Number(it.qty) ?? 1) > 0);
          invChanged = true;
        }
      }

      if (mpChanged) await updateCharacterResource(defenderCharacter.id, "mp", nextMp);
      if (hpChanged) await updateCharacterResource(defenderCharacter.id, "hp", nextHp);
      if (invChanged) await updateCharacter(defenderCharacter.id, { inventory: nextInventory });
    }

    const dc = Number(savingThrowRequest.dc) || 10;

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
      rollKind: "saving_throw",
      deferSecondaryDamage: false,
      respondedToSaveId: savingThrowRequest.id,
      parentMessageId: savingThrowRequest.parentMessageId || null,
      savingThrowOutcome: {
        dc,
        attribute: attributeLabel,
        effectDescription: savingThrowRequest.effectDescription || ""
      }
    });

    setActiveSavingThrowReq(null);
    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  const handleApplyCombatEffect = async ({
    msg,
    baseValue,
    scaleMode = "full",
    customValue = null,
    effectType = "damage",
    manualModifiers = []
  }) => {
    if (!isGM || !msg) return;

    const msgTarget = msg.rollData?.targetInfo || null;
    const targetTokenId =
      msgTarget?.tokenId || targetedToken?.id || selectedTokenOnBoard?.id || null;
    const targetSceneId =
      msgTarget?.sceneId ||
      targetedToken?.sceneId ||
      activeScene?.id ||
      campaign?.activeSceneId ||
      null;
    const targetCharId =
      msgTarget?.characterId ||
      targetedToken?.characterId ||
      selectedTokenOnBoard?.characterId ||
      null;

    const liveToken =
      boardSyncRef.current.tokens?.find(
        (t) => t.id === targetTokenId || (targetCharId && t.characterId === targetCharId)
      ) ||
      targetedToken ||
      selectedTokenOnBoard ||
      null;

    const effectiveCharId = targetCharId || liveToken?.characterId || null;
    const targetChar = effectiveCharId
      ? allCharacters.find((c) => c.id === effectiveCharId) || null
      : null;
    const sourceChar = msg.characterId
      ? allCharacters.find((c) => c.id === msg.characterId) || null
      : null;

    if (!targetChar && !liveToken && !targetTokenId) return;

    const computed = computeModifiedEffectValue({
      baseValue,
      scaleMode,
      customValue,
      effectType,
      sourceCharacter: sourceChar,
      targetCharacter: targetChar,
      targetToken: liveToken,
      manualModifiers
    });

    const resKey = computed.resourceKey || "hp";
    let syncedHpValue = null;

    if (targetChar && resKey) {
      const resObj = targetChar.resources?.[resKey] || { current: 20, max: 20 };
      const maxVal = Number(resObj.max) || 9999;
      const nextVal = Math.max(
        0,
        Math.min(maxVal, (Number(resObj.current) || 0) + computed.resourceDelta)
      );
      await updateCharacterResource(targetChar.id, resKey, nextVal);
      if (resKey === "hp") {
        syncedHpValue = nextVal;
      }
    }

    const effectiveTokenId = liveToken?.id || targetTokenId;
    const effectiveSceneId =
      liveToken?.sceneId || targetSceneId || activeScene?.id || campaign?.activeSceneId;

    if (resKey === "hp" && effectiveTokenId && effectiveSceneId && campaignId) {
      const curTokHp = Number(liveToken?.hpCurrent ?? targetChar?.resources?.hp?.current ?? 20);
      const maxTokHp = Number(liveToken?.hpMax ?? targetChar?.resources?.hp?.max ?? 9999) || 9999;
      const nextTokHp =
        syncedHpValue !== null
          ? syncedHpValue
          : Math.max(0, Math.min(maxTokHp, curTokHp + computed.resourceDelta));

      const tokRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/tokens/${effectiveSceneId}/${effectiveTokenId}`
      );
      await rtdbUpdate(tokRef, {
        hpCurrent: nextTokHp,
        updatedBy: user?.uid || "gm",
        updatedAt: Date.now()
      });
    }

    const effMeta =
      EFFECT_TYPES.find((e) => e.id === computed.effectType) || EFFECT_TYPES[0];
    const targetDisplayName =
      targetChar?.name || liveToken?.name || msgTarget?.name || "Alvo";

    const prevApplied = Array.isArray(msg.rollData?.appliedEffects)
      ? msg.rollData.appliedEffects
      : [];

    await updateMessageRollData(msg.id, {
      appliedEffects: [
        ...prevApplied,
        {
          effectType: computed.effectType,
          label: effMeta.label,
          scaleMode,
          finalValue: computed.finalValue,
          targetName: targetDisplayName,
          timestampMs: Date.now()
        }
      ]
    });
  };

  // Coloca o Token do Personagem diretamente no Mapa Ativo em Tempo Real
  const handleSpawnCharacterToken = async (char, spawnOptions = {}) => {
    const targetSceneId = activeScene?.id || campaign?.activeSceneId;
    if (!char || !targetSceneId || !user) return;

    const tokenId = `tok_${char.id}_${Date.now().toString().slice(-4)}`;
    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${targetSceneId}/${tokenId}`
    );

    const cellSizePx = Number(activeScene?.grid?.cellSizePx) || 64;
    const widthPx = Number(activeScene?.mapImage?.widthPx) || 1920;
    const heightPx = Number(activeScene?.mapImage?.heightPx) || 1080;
    const startX =
      Math.round(widthPx / 2 / cellSizePx) * cellSizePx;
    const startY =
      Math.round(heightPx / 2 / cellSizePx) * cellSizePx;

    const showName =
      spawnOptions?.showName !== undefined
        ? Boolean(spawnOptions.showName)
        : (char.defaultToken?.showName !== false);

    const visibleToPlayers =
      spawnOptions?.visibleToPlayers !== undefined
        ? Boolean(spawnOptions.visibleToPlayers)
        : (char.type !== "npc" || isGM);

    await rtdbSet(tokenRef, {
      id: tokenId,
      characterId: char.id,
      layer: "tokens",
      name: char.name || "Pinguim",
      showName,
      mediaId: char.defaultToken?.mediaId || char.avatarMediaId || null,
      externalUrl:
        char.defaultToken?.externalUrl || char.avatarExternalUrl || null,
      x: startX,
      y: startY,
      sizeInCells: Number(char.defaultToken?.sizeInCells) || 1,
      rotation: 0,
      ringColor: char.cardColor || "#3090f0",
      visibleToPlayers,
      controlledBy: Array.from(
        new Set([campaign?.gmId, char.ownerId].filter(Boolean))
      ),
      ownerId: char.ownerId || null,
      characterType: char.type || "pc",
      defense: Number(char.defense ?? 12),
      hpCurrent: Number(char.resources?.hp?.current ?? 20),
      hpMax: Number(char.resources?.hp?.max ?? 20),
      showBarsToPlayers: true,
      updatedBy: user.uid,
      updatedAt: Date.now()
    });
  };

  const handleDockChatSubmit = async (e) => {
    e.preventDefault();
    if (!dockChatText.trim()) return;
    const raw = dockChatText.trim();
    setDockChatText("");

    // Determina o emissor ativo (personagem aberto ou perfil do usuário)
    const senderName = activeCharacter?.name || currentDisplayName;
    const senderPhotoURL = activeCharacter
      ? (activeCharacter.avatarExternalUrl ||
         activeCharacter.defaultToken?.externalUrl ||
         activeCharacter.tokenImage ||
         activeCharacter.avatarImage ||
         null)
      : (myPlayerProfile?.photoURL || user?.photoURL || null);

    // Rolagens no chat
    if (raw.startsWith("/r ") || raw.startsWith("/roll ")) {
      const expr = raw.replace(/^\/r(oll)?\s+/i, "");
      await executeRoll({
        title: `Rolagem (${expr})`,
        primaryFormula: expr,
        primaryLabel: "Resultado",
        character: activeCharacter,
        senderName,
        senderPhotoURL,
        visibility: rollVisibility,
        onDeductResource: updateCharacterResource
      });
      setSidebarOpen(true);
      setActiveSidebarTab("chat");
      return;
    }

    // Mensagem de texto comum
    await sendTextMessage({
      content: raw,
      senderName,
      senderPhotoURL,
      characterId: activeCharacter?.id || null,
      characterMediaId: activeCharacter
        ? activeCharacter.avatarMediaId || activeCharacter.defaultToken?.mediaId || null
        : null
    });
    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  const handleSelectEmote = async (emote) => {
    if (!emote) return;
    setEmotePickerOpen(false);

    const senderName = activeCharacter?.name || currentDisplayName;
    const senderPhotoURL = activeCharacter
      ? (activeCharacter.avatarExternalUrl ||
         activeCharacter.defaultToken?.externalUrl ||
         activeCharacter.tokenImage ||
         activeCharacter.avatarImage ||
         null)
      : (myPlayerProfile?.photoURL || user?.photoURL || null);

    await sendEmoteMessage({
      icon: emote.id,
      senderName,
      senderPhotoURL,
      characterId: activeCharacter?.id || null,
      characterMediaId: activeCharacter
        ? activeCharacter.avatarMediaId || activeCharacter.defaultToken?.mediaId || null
        : null,
      visibility: rollVisibility
    });
    setSidebarOpen(true);
    setActiveSidebarTab("chat");
  };

  // Modo Janela Dedicada (Pop-out para tela cheia ou Alt+Tab)
  if (standaloneSheetId) {
    if (!openedSheetCharacter) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div className="cp-window">
            <h2 className="cp-title" style={{ padding: "12px 24px" }}>
              CARREGANDO FICHA...
            </h2>
          </div>
        </div>
      );
    }

    return (
      <CharacterSheetModal
        character={openedSheetCharacter}
        campaignId={campaignId}
        playersMap={campaign?.players || {}}
        compendiumEntries={compendiumEntries}
        canEdit={canEditCharacter(openedSheetCharacter)}
        isGM={isGM}
        rollVisibility={rollVisibility}
        onChangeRollVisibility={setRollVisibility}
        onUpdateCharacter={updateCharacter}
        onUploadCharacterImage={uploadCharacterImage}
        onExecuteRoll={handleExecuteSheetRoll}
        onPingSkill={handlePingSkill}
        onSpawnTokenOnMap={
          activeScene ? handleSpawnCharacterToken : null
        }
        isStandaloneWindow={true}
        onStartAoeDemarcate={handleStartAoeDemarcate}
      />
    );
  }

  const combinedError = firestoreError || scenesError;

  return (
    <div className={`vtt-shell ${snowballAimActive ? "cp-snowball-aiming" : ""}`}>
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

        {activeDockModule === "board" && (
          <BoardViewport
            activeScene={activeScene}
            campaignId={campaignId}
            playersMap={campaign?.players || {}}
            isGM={isGM}
            messages={messages}
            activeCharacter={activeCharacter}
            onUpdateSceneGrid={updateScene}
            onOpenScenesManager={() => {
              setScenesModalInitialTab("scenes");
              setScenesModalOpen(true);
            }}
            onSelectedTokenChange={setSelectedTokenOnBoard}
            targetedToken={targetedToken}
            targetedTokens={targetedTokens}
            onTargetedTokenChange={setTargetedToken}
            onTargetedTokensChange={setTargetedTokens}
            aoeDemarcateConfig={aoeDemarcateConfig}
            onCloseAoeDemarcate={() => handleStartAoeDemarcate(null)}
            onTokensSync={(syncData) => {
              boardSyncRef.current = syncData;
            }}
            snowballAimActive={snowballAimActive}
            onDeactivateSnowballAim={() => setSnowballAimActive(false)}
          />
        )}

        {activeDockModule === "journal" && (
          <JournalWorkspace
            campaignId={campaignId}
            currentUserId={user?.uid}
            isGM={isGM}
            playersMap={campaign?.players || {}}
            characters={characters}
            accessibleNotes={accessibleNotes}
            accessibleFolders={accessibleFolders}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onUpdateNodePosition={updateNodePosition}
            onCloneNoteToTarget={cloneNoteToTarget}
            onShareNoteWithTarget={shareNoteWithTarget}
            onRevokeNoteAccess={revokeNoteAccess}
            onDeleteNote={deleteNote}
            onCreateFolder={createFolder}
            onDeleteFolder={deleteFolder}
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
            src="/map-icon.png"
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
                  src="/icones/iconeAcoesRapidas.png"
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
                src="/icones/iconeBolaDeNeve.png"
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
                  src="/icones/iconeEmotes.webp"
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
                src="/icones/iconeChat.png"
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
                src="/icones/iconeFicha.png"
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
                src="/icones/iconeCompendio.png"
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
                src="/icones/iconeDiarios.png"
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
                src="/icones/iconeListaMembros.webp"
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
              onOpenSavingThrowModal={(req) => setActiveSavingThrowReq(req)}
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
              currentUser={user}
              playersMap={campaign?.players || {}}
              gmId={campaign?.gmId}
              onlineUsers={onlineUsers}
              onCreateCharacter={createCharacter}
              onOpenSheet={(charId) => setOpenCharacterId(charId)}
              onSpawnToken={activeScene ? handleSpawnCharacterToken : null}
              onDeleteCharacter={deleteCharacter}
              onCreateFolder={createCharacterFolder}
              onUpdateFolder={updateCharacterFolder}
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
          playersMap={campaign?.players || {}}
          compendiumEntries={compendiumEntries}
          canEdit={canEditCharacter(openedSheetCharacter)}
          isGM={isGM}
          rollVisibility={rollVisibility}
          onChangeRollVisibility={setRollVisibility}
          onUpdateCharacter={updateCharacter}
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

      {/* Janela de Rolagem de Dano (Normal / Crítico / Extra / Gatilho) */}
      <DamageRollModal
        open={Boolean(damageModalMsg)}
        onClose={() => setDamageModalMsg(null)}
        attackMessage={damageModalMsg}
        character={
          (damageModalMsg?.characterId &&
            allCharacters.find((c) => c.id === damageModalMsg.characterId)) ||
          activeCharacter
        }
        onExecuteDamageRoll={handleExecuteDamageRoll}
      />

      {/* Pop-up de Teste de Resistência para o Alvo */}
      <SavingThrowModal
        open={Boolean(activeSavingThrowReq)}
        onClose={() => {
          if (activeSavingThrowReq?.id) {
            dismissedSaveIdsRef.current.add(activeSavingThrowReq.id);
          }
          setActiveSavingThrowReq(null);
        }}
        savingThrowRequest={activeSavingThrowReq}
        defenderCharacter={
          (activeSavingThrowReq?.targetCharacterId &&
            allCharacters.find(
              (c) => c.id === activeSavingThrowReq.targetCharacterId
            )) ||
          activeCharacter
        }
        onExecuteSavingThrow={handleExecuteSavingThrow}
      />
    </div>
  );
}
