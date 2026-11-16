import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, set as rtdbSet, update as rtdbUpdate } from "firebase/database";
import { db, rtdb } from "./firebase";
import {
  EFFECT_TYPES,
  advanceTurnInState,
  computeModifiedEffectValue,
  consumeActionInState,
  consumeMovementInState,
  createCombatantEntry,
  normalizeCombatState,
  regressTurnInState,
  sortTurnOrder,
  toControlledByMap,
} from "../engines/combatEngine";

/**
 * Fase 3.1: regra única "matriz GM/NPC vs. PC" (Princípio 6). Uma ficha é matriz quando é NPC
 * ou pertence ao Mestre; um token é instância de matriz quando marcado `isGmToken` (V-17).
 */
export function isGmTemplateCharacter(character, campaign, token = null) {
  return Boolean(
    token?.isGmToken ||
      character?.type === "npc" ||
      (campaign?.gmId && character?.ownerId && character.ownerId === campaign.gmId)
  );
}

/**
 * Fase 3.1 (V-05): desconta custos (MP/HP) do ATOR respeitando o Princípio 6.
 * - PC: desconta na ficha (Firestore); o sync Ficha→Token espelha nos tokens da cena ativa.
 * - Matriz GM/NPC: desconta somente na instância do token (RTDB) que está agindo. Se a instância
 *   não for identificável (ex.: janela destacada sem tabuleiro, vários tokens sem seleção),
 *   nada é descontado — a ficha-matriz nunca é alterada por uso em combate.
 * `costs` = { mp?: number, hp?: number } com valores POSITIVOS a descontar.
 */
export async function deductActorResources({
  campaignId,
  campaign,
  user = null,
  character,
  actorToken = null,
  sceneId = null,
  costs = {},
  updateCharacterResource,
}) {
  if (!character) return { deducted: false };
  const template = isGmTemplateCharacter(character, campaign, actorToken);
  let deducted = false;

  for (const [resKey, rawAmount] of Object.entries(costs || {})) {
    const amount = Number(rawAmount) || 0;
    if (amount <= 0 || (resKey !== "mp" && resKey !== "hp")) continue;

    if (template) {
      const tokenSceneId = actorToken?.sceneId || sceneId;
      if (!campaignId || !actorToken?.id || !tokenSceneId) continue;
      const curField = resKey === "mp" ? "mpCurrent" : "hpCurrent";
      const currentVal = Number(
        actorToken[curField] ?? character.resources?.[resKey]?.current ?? 0
      );
      await rtdbUpdate(
        ref(rtdb, `vtt_realtime/${campaignId}/tokens/${tokenSceneId}/${actorToken.id}`),
        {
          [curField]: Math.max(0, currentVal - amount),
          updatedBy: user?.uid || "gm",
          updatedAt: Date.now(),
        }
      );
      deducted = true;
    } else if (updateCharacterResource) {
      const currentVal = Number(character.resources?.[resKey]?.current ?? 0);
      await updateCharacterResource(character.id, resKey, Math.max(0, currentVal - amount));
      deducted = true;
    }
  }

  return { deducted, template };
}

/**
 * Consome custos de recursos (MP/HP) de habilidades e dá baixa no inventário de itens consumíveis.
 * Reutilizado por rolagens de dano/efeito e testes de resistência.
 * Fase 3.1 (V-05): MP/HP são descontados via deductActorResources (token da matriz GM/NPC,
 * nunca a ficha-matriz). A baixa de itens consumíveis continua no inventário da ficha,
 * pois tokens não possuem inventário próprio.
 */
export async function consumeCombatCosts({
  campaignId = null,
  campaign = null,
  user = null,
  character,
  actorToken = null,
  sceneId = null,
  itemsToConsume = [],
  updateCharacterResource,
  updateCharacter,
}) {
  if (!character || !Array.isArray(itemsToConsume) || itemsToConsume.length === 0) {
    return { mpChanged: false, hpChanged: false, invChanged: false };
  }

  let mpCost = 0;
  let hpCost = 0;
  let mpChanged = false;
  let hpChanged = false;
  let nextInventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
  let invChanged = false;

  for (const entry of itemsToConsume) {
    if (!entry) continue;

    if (entry.sourceType === "ability") {
      const costMp =
        Number(entry.costMp) ||
        (entry.cost?.resource === "mp" ? Number(entry.cost?.amount) || 0 : 0);
      const costHp =
        Number(entry.costHp) ||
        (entry.cost?.resource === "hp" ? Number(entry.cost?.amount) || 0 : 0);

      if (costMp > 0) {
        mpCost += costMp;
        mpChanged = true;
      }
      if (costHp > 0) {
        hpCost += costHp;
        hpChanged = true;
      }
    } else if (entry.sourceType === "item" && entry.consumeOnUse) {
      const targetItemId = entry.sourceId || entry.id;
      nextInventory = nextInventory
        .map((it) =>
          it.id === targetItemId
            ? { ...it, qty: Math.max(0, (Number(it.qty) || 1) - 1) }
            : it
        )
        .filter((it) => (it.qty !== undefined && it.qty !== null ? Number(it.qty) : 1) > 0);
      invChanged = true;
    }
  }

  let deductedResource = false;
  if (mpChanged || hpChanged) {
    const deductRes = await deductActorResources({
      campaignId,
      campaign,
      user,
      character,
      actorToken,
      sceneId,
      costs: { mp: mpCost, hp: hpCost },
      updateCharacterResource,
    });
    deductedResource = Boolean(deductRes?.deducted);
  }
  if (invChanged && updateCharacter) {
    await updateCharacter(character.id, { inventory: nextInventory });
  }

  return {
    mpChanged: mpChanged && deductedResource,
    hpChanged: hpChanged && deductedResource,
    invChanged,
  };
}

/**
 * Aplica efeito de dano/cura/PE no alvo respeitando sincronização Ficha↔Token:
 * - Players (PC): atualiza ficha no Firestore (pulando sync redundante) e token no RTDB.
 * - Mestre / NPC (Matriz): aplica o efeito somente no token individual no RTDB.
 */
export async function applyCombatEffectToTarget({
  campaignId,
  campaign,
  user,
  isGM,
  msg,
  baseValue,
  scaleMode = "full",
  customValue = null,
  effectType = "damage",
  manualModifiers = [],
  boardTokens = [],
  targetedToken = null,
  selectedTokenOnBoard = null,
  activeScene = null,
  allCharacters = [],
  updateCharacterResource,
  updateMessageRollData,
}) {
  if (!isGM || !msg) return null;

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

  // Fase 3.1 (V-04): o token é localizado PRIMEIRO pelo id exato. A busca por characterId só
  // ocorre quando não há id de token, e apenas se houver um único token daquela ficha no
  // tabuleiro — com vários inimigos idênticos, nunca se aplica o efeito "no primeiro que casar".
  const boardList = Array.isArray(boardTokens) ? boardTokens : [];
  let liveToken = null;
  if (targetTokenId) {
    liveToken =
      boardList.find((t) => t.id === targetTokenId) ||
      (targetedToken?.id === targetTokenId ? targetedToken : null) ||
      (selectedTokenOnBoard?.id === targetTokenId ? selectedTokenOnBoard : null) ||
      null;
  } else if (targetCharId) {
    const sameCharTokens = boardList.filter((t) => t.characterId === targetCharId);
    liveToken = sameCharTokens.length === 1 ? sameCharTokens[0] : null;
  }

  const effectiveCharId = targetCharId || liveToken?.characterId || null;
  const targetChar = effectiveCharId
    ? allCharacters.find((c) => c.id === effectiveCharId) || null
    : null;
  const sourceChar = msg.characterId
    ? allCharacters.find((c) => c.id === msg.characterId) || null
    : null;

  if (!targetChar && !liveToken && !targetTokenId) return null;

  const computed = computeModifiedEffectValue({
    baseValue,
    scaleMode,
    customValue,
    effectType,
    sourceCharacter: sourceChar,
    targetCharacter: targetChar,
    targetToken: liveToken,
    manualModifiers,
  });

  const resKey = computed.resourceKey || "hp";
  let syncedResourceValue = null;

  // Fase 3.1 (V-17): a instância marcada isGmToken também é tratada como matriz,
  // mesma regra de syncTokenUpdatesToCharacter.
  const isGmTemplate = Boolean(
    isGmTemplateCharacter(targetChar, campaign, liveToken) &&
      (liveToken || targetTokenId)
  );

  const effectiveTokenId = liveToken?.id || targetTokenId;
  const effectiveSceneId =
    liveToken?.sceneId ||
    targetSceneId ||
    activeScene?.id ||
    campaign?.activeSceneId;

  const isTokenResource = resKey === "hp" || resKey === "mp";
  let tokensSyncedFromSheet = false;

  if (targetChar && resKey && !isGmTemplate && updateCharacterResource) {
    const resObj = targetChar.resources?.[resKey] || { current: 20, max: 20 };
    const maxVal = Number(resObj.max) || 9999;
    const nextVal = Math.max(
      0,
      Math.min(maxVal, (Number(resObj.current) || 0) + computed.resourceDelta)
    );
    // Fase 3.1 (V-14): sem skipTokenSync — o sync Ficha→Token (useCharacters) espelha o novo
    // valor em TODOS os tokens deste PC na cena ativa da mesa, não só no token atingido.
    await updateCharacterResource(targetChar.id, resKey, nextVal);
    syncedResourceValue = nextVal;
    tokensSyncedFromSheet = Boolean(
      isTokenResource && effectiveSceneId && effectiveSceneId === campaign?.activeSceneId
    );
  }

  // Escrita direta no token: matriz GM/NPC (instância individual) ou token de PC fora da cena
  // ativa da mesa (o sync Ficha→Token só alcança a cena ativa).
  if (
    isTokenResource &&
    effectiveTokenId &&
    effectiveSceneId &&
    campaignId &&
    !tokensSyncedFromSheet
  ) {
    const curField = resKey === "mp" ? "mpCurrent" : "hpCurrent";
    const maxField = resKey === "mp" ? "mpMax" : "hpMax";
    const curTokVal = Number(
      liveToken?.[curField] ?? targetChar?.resources?.[resKey]?.current ?? 20
    );
    const maxTokVal =
      Number(liveToken?.[maxField] ?? targetChar?.resources?.[resKey]?.max ?? 9999) ||
      9999;
    const nextTokVal =
      syncedResourceValue !== null
        ? syncedResourceValue
        : Math.max(0, Math.min(maxTokVal, curTokVal + computed.resourceDelta));

    const tokRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${effectiveSceneId}/${effectiveTokenId}`
    );
    await rtdbUpdate(tokRef, {
      [curField]: nextTokVal,
      updatedBy: user?.uid || "gm",
      updatedAt: Date.now(),
    });
  }

  const effMeta =
    EFFECT_TYPES.find((e) => e.id === computed.effectType) || EFFECT_TYPES[0];
  const targetDisplayName =
    targetChar?.name || liveToken?.name || msgTarget?.name || "Alvo";

  const prevApplied = Array.isArray(msg.rollData?.appliedEffects)
    ? msg.rollData.appliedEffects
    : [];

  if (updateMessageRollData) {
    await updateMessageRollData(msg.id, {
      appliedEffects: [
        ...prevApplied,
        {
          effectType: computed.effectType,
          label: effMeta.label,
          scaleMode,
          finalValue: computed.finalValue,
          targetName: targetDisplayName,
          timestampMs: Date.now(),
        },
      ],
    });
  }

  return computed;
}

/**
 * Instancia o token de uma ficha no centro da cena ativa no RTDB.
 */
export async function spawnCharacterTokenToScene({
  campaignId,
  campaign,
  user,
  isGM,
  canEditCharacter,
  activeScene,
  char,
  spawnOptions = {},
}) {
  const targetSceneId = activeScene?.id || campaign?.activeSceneId;
  if (!char || !targetSceneId || !user || !campaignId) return null;
  if (!isGM && !canEditCharacter?.(char)) return null;

  const tokenId = `tok_${char.id}_${Date.now().toString().slice(-4)}`;
  const tokenRef = ref(
    rtdb,
    `vtt_realtime/${campaignId}/tokens/${targetSceneId}/${tokenId}`
  );

  const cellSizePx = Number(activeScene?.grid?.cellSizePx) || 64;
  const widthPx = Number(activeScene?.mapImage?.widthPx) || 1920;
  const heightPx = Number(activeScene?.mapImage?.heightPx) || 1080;
  const startX = Math.round(widthPx / 2 / cellSizePx) * cellSizePx;
  const startY = Math.round(heightPx / 2 / cellSizePx) * cellSizePx;

  const showName =
    spawnOptions?.showName !== undefined
      ? Boolean(spawnOptions.showName)
      : char.defaultToken?.showName !== false;

  const visibleToPlayers =
    spawnOptions?.visibleToPlayers !== undefined
      ? Boolean(spawnOptions.visibleToPlayers)
      : char.type !== "npc" || isGM;

  const isGmToken = isGmTemplateCharacter(char, campaign);

  // Fase 3.1 (V-12): quem não é Mestre só pode criar token cujo ownerId seja ele mesmo
  // (database.rules.json). Quem está em `editableBy` de uma ficha alheia vira dono da
  // instância; o dono da ficha continua controlando o token via controlledBy.
  const tokenOwnerId = isGM ? char.ownerId || null : user.uid;
  const controlledBy = toControlledByMap([
    campaign?.gmId,
    char.ownerId,
    isGM ? null : user.uid,
  ]);

  const payload = {
    id: tokenId,
    campaignId,
    sceneId: targetSceneId,
    characterId: char.id,
    isGmToken,
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
    controlledBy,
    ownerId: tokenOwnerId,
    characterType: char.type || "pc",
    defense: Number(char.defense ?? 12),
    hpCurrent: Number(char.resources?.hp?.current ?? 20),
    hpMax: Number(char.resources?.hp?.max ?? 20),
    mpCurrent: Number(char.resources?.mp?.current ?? 15),
    mpMax: Number(char.resources?.mp?.max ?? 15),
    showBarsToPlayers: true,
    updatedBy: user.uid,
    updatedAt: Date.now(),
  };

  await rtdbSet(tokenRef, payload);
  return payload;
}

/**
 * Sincroniza alterações feitas no Token (Tabuleiro) de volta para a Ficha (Firestore)
 * exclusivamente para personagens de jogadores (PCs). Tokens/fichas matrizes do Mestre permanecem isolados.
 */
export async function syncTokenUpdatesToCharacter({
  token,
  updatedFields = {},
  allCharacters = [],
  campaign,
  canEditCharacter,
  updateCharacter,
}) {
  if (!token?.characterId || !updatedFields || !updateCharacter) return;
  const char = allCharacters.find((c) => c.id === token.characterId);
  if (!char || !canEditCharacter?.(char)) return;

  if (isGmTemplateCharacter(char, campaign, token)) return;

  const charUpdates = {};

  if ("name" in updatedFields && updatedFields.name) {
    charUpdates.name = updatedFields.name;
  }
  if (
    "defense" in updatedFields &&
    updatedFields.defense !== undefined &&
    updatedFields.defense !== null
  ) {
    charUpdates.defense = Number(updatedFields.defense);
  }
  if ("ringColor" in updatedFields && updatedFields.ringColor) {
    charUpdates.cardColor = updatedFields.ringColor;
  }

  for (const [resKey, curField, maxField, defaultLabel, defaultMax] of [
    ["hp", "hpCurrent", "hpMax", "Vida", 25],
    ["mp", "mpCurrent", "mpMax", "Energia", 15],
  ]) {
    if (!(curField in updatedFields) && !(maxField in updatedFields)) continue;
    const existingRes = char.resources?.[resKey];
    if (!existingRes) {
      const nextCurrent =
        curField in updatedFields && updatedFields[curField] !== null
          ? Number(updatedFields[curField])
          : defaultMax;
      const nextMax =
        maxField in updatedFields && updatedFields[maxField] !== null
          ? Number(updatedFields[maxField])
          : defaultMax;
      charUpdates[`resources.${resKey}`] = {
        label: defaultLabel,
        current: Math.max(0, nextCurrent),
        max: Math.max(0, nextMax),
      };
      continue;
    }
    if (curField in updatedFields && updatedFields[curField] !== null) {
      charUpdates[`resources.${resKey}.current`] = Math.max(
        0,
        Number(updatedFields[curField])
      );
    }
    if (maxField in updatedFields && updatedFields[maxField] !== null) {
      charUpdates[`resources.${resKey}.max`] = Math.max(
        0,
        Number(updatedFields[maxField])
      );
    }
  }

  if (
    "showName" in updatedFields ||
    "sizeInCells" in updatedFields ||
    "mediaId" in updatedFields ||
    "externalUrl" in updatedFields ||
    "ringColor" in updatedFields
  ) {
    const nextDefaultToken = { ...(char.defaultToken || {}) };
    if ("showName" in updatedFields) {
      nextDefaultToken.showName = updatedFields.showName !== false;
    }
    if ("sizeInCells" in updatedFields && updatedFields.sizeInCells) {
      nextDefaultToken.sizeInCells = Math.max(
        1,
        Math.min(8, Number(updatedFields.sizeInCells) || 1)
      );
    }
    if ("mediaId" in updatedFields) {
      nextDefaultToken.mediaId = updatedFields.mediaId || null;
    }
    if ("externalUrl" in updatedFields) {
      nextDefaultToken.externalUrl = updatedFields.externalUrl || null;
    }
    if ("ringColor" in updatedFields && updatedFields.ringColor) {
      nextDefaultToken.ringColor = updatedFields.ringColor;
    }
    charUpdates.defaultToken = nextDefaultToken;
  }

  if (Object.keys(charUpdates).length > 0) {
    await updateCharacter(char.id, charUpdates, { skipTokenSync: true });
  }
}

// ============================================================================
// ORQUESTRAÇÃO DO MODO DE TURNO (combatState no Firestore da campanha)
// ============================================================================

export async function persistCombatState(campaignId, combatState) {
  if (!campaignId) return null;
  const normalized = normalizeCombatState(combatState);
  await updateDoc(doc(db, "campaigns", campaignId), {
    combatState: normalized,
    updatedAt: serverTimestamp(),
  });
  return normalized;
}

export async function startTurnCombat({
  campaignId,
  tokens = [],
  allCharacters = [],
  initialTurnOrder = null,
}) {
  if (!campaignId) return null;

  const builtOrder =
    Array.isArray(initialTurnOrder) && initialTurnOrder.length > 0
      ? sortTurnOrder(initialTurnOrder)
      : sortTurnOrder(
          tokens
            .filter((t) => (t?.layer || "tokens") === "tokens")
            .map((tok) => {
              const linkedChar = tok.characterId
                ? allCharacters.find((c) => c.id === tok.characterId) || null
                : null;
              return createCombatantEntry({
                token: tok,
                character: linkedChar,
                initiative: 0,
              });
            })
        );

  const nextState = normalizeCombatState({
    active: true,
    round: 1,
    activeTurnIndex: 0,
    lockMovementOutsideTurn: true,
    lockActionsOutsideTurn: true,
    turnOrder: builtOrder,
  });

  return persistCombatState(campaignId, nextState);
}

export async function stopTurnCombat(campaignId, currentCombatState = null) {
  const current = normalizeCombatState(currentCombatState);
  return persistCombatState(campaignId, {
    ...current,
    active: false,
    round: 1,
    activeTurnIndex: 0,
    turnOrder: [],
  });
}

export async function advanceCampaignTurn(campaignId, currentCombatState) {
  const next = advanceTurnInState(currentCombatState);
  return persistCombatState(campaignId, next);
}

export async function regressCampaignTurn(campaignId, currentCombatState) {
  const next = regressTurnInState(currentCombatState);
  return persistCombatState(campaignId, next);
}

export async function consumeCampaignTurnMovement(
  campaignId,
  currentCombatState,
  actorRef,
  distanceMeters
) {
  const next = consumeMovementInState(currentCombatState, actorRef, distanceMeters);
  return persistCombatState(campaignId, next);
}

export async function consumeCampaignTurnAction(
  campaignId,
  currentCombatState,
  actorRef,
  actionKind
) {
  const next = consumeActionInState(currentCombatState, actorRef, actionKind);
  return persistCombatState(campaignId, next);
}

const SAVE_CLAIMS_KEY_PREFIX = "cp_vtt_save_claims_v1_";
const OPEN_SHEETS_KEY_PREFIX = "cp_vtt_open_sheets_v1_";
const SAVE_CLAIM_TTL_MS = 10 * 60 * 1000;
const SAVE_SUBMITTING_TTL_MS = 30 * 1000;
const OPEN_SHEET_TTL_MS = 30 * 60 * 1000;
const MAX_SAVED_CLAIMS = 50;

function safeLocalStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readStorageJson(key) {
  const storage = safeLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorageJson(key, map) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    const entries = Object.entries(map || {});
    const trimmed =
      entries.length > MAX_SAVED_CLAIMS
        ? Object.fromEntries(
            entries
              .sort((a, b) => (Number(a[1]?.updatedAt) || 0) - (Number(b[1]?.updatedAt) || 0))
              .slice(-MAX_SAVED_CLAIMS)
          )
        : map;
    storage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // ignora quota/bloqueio de storage
  }
}

/** Registro leve das fichas destacadas abertas (preferência de janela no A20). */
export function registerOpenStandaloneSheet(campaignId, sheetId, windowId) {
  if (!campaignId || !sheetId || !windowId) return;
  const key = `${OPEN_SHEETS_KEY_PREFIX}${campaignId}`;
  const map = readStorageJson(key);
  map[sheetId] = { windowId, updatedAt: Date.now() };
  writeStorageJson(key, map);
}

export function unregisterOpenStandaloneSheet(campaignId, sheetId, windowId) {
  if (!campaignId || !sheetId) return;
  const key = `${OPEN_SHEETS_KEY_PREFIX}${campaignId}`;
  const map = readStorageJson(key);
  if (map[sheetId] && (!windowId || map[sheetId].windowId === windowId)) {
    delete map[sheetId];
    writeStorageJson(key, map);
  }
}

export function hasOpenStandaloneSheet(campaignId, targetCharacterId) {
  if (!campaignId || !targetCharacterId) return false;
  const key = `${OPEN_SHEETS_KEY_PREFIX}${campaignId}`;
  const map = readStorageJson(key);
  const entry = map[targetCharacterId];
  return Boolean(entry && Date.now() - (Number(entry.updatedAt) || 0) < OPEN_SHEET_TTL_MS);
}

export function getSavingThrowClaim(campaignId, saveId) {
  if (!campaignId || !saveId) return null;
  const map = readStorageJson(`${SAVE_CLAIMS_KEY_PREFIX}${campaignId}`);
  return map[saveId] || null;
}

export function isSavingThrowAnswered(campaignId, saveId) {
  return getSavingThrowClaim(campaignId, saveId)?.status === "answered";
}

/**
 * Fase 6.4 (A20): reivindica a exibição automática do pop-up de Teste de Resistência
 * para uma única janela. Ficha destacada do próprio personagem alvo tem prioridade (2)
 * sobre a janela principal (1); janelas já abertas ou respondidas não são sobrescritas por prioridade menor.
 */
export function tryClaimSavingThrowModal(
  campaignId,
  saveId,
  windowId,
  { priority = 1, forceManual = false } = {}
) {
  if (!saveId) return { claimed: false, ownerWindowId: null };
  const resolvedCampaign = campaignId || "default";
  const key = `${SAVE_CLAIMS_KEY_PREFIX}${resolvedCampaign}`;
  const map = readStorageJson(key);
  const existing = map[saveId];
  const now = Date.now();

  if (existing?.status === "answered") {
    return { claimed: false, ownerWindowId: existing.ownerWindowId || null, status: "answered" };
  }
  if (existing?.status === "submitting" && now - (Number(existing.updatedAt) || 0) < SAVE_SUBMITTING_TTL_MS) {
    return { claimed: false, ownerWindowId: existing.ownerWindowId || null, status: "submitting" };
  }
  if (
    !forceManual &&
    existing?.status === "open" &&
    existing.ownerWindowId !== windowId &&
    now - (Number(existing.updatedAt) || 0) < SAVE_CLAIM_TTL_MS &&
    (Number(existing.priority) || 1) >= priority
  ) {
    return {
      claimed: false,
      ownerWindowId: existing.ownerWindowId || null,
      priority: Number(existing.priority) || 1,
      status: "open",
    };
  }

  map[saveId] = {
    ownerWindowId: windowId,
    priority,
    status: "open",
    updatedAt: now,
  };
  writeStorageJson(key, map);
  const confirm = readStorageJson(key)[saveId];
  const claimed = Boolean(confirm && confirm.ownerWindowId === windowId);
  return {
    claimed,
    ownerWindowId: confirm?.ownerWindowId || windowId,
    priority: Number(confirm?.priority) || priority,
    status: confirm?.status || "open",
  };
}

/**
 * Fase 6.4 (A20): trava o envio do Teste de Resistência por `saveId`, garantindo no máximo
 * uma cobrança e uma resposta mesmo se duas janelas tentarem enviar ao mesmo tempo.
 */
export function tryBeginSavingThrowSubmission(campaignId, saveId, windowId) {
  if (!saveId) return { allowed: false, reason: "missing_id" };
  const resolvedCampaign = campaignId || "default";
  const key = `${SAVE_CLAIMS_KEY_PREFIX}${resolvedCampaign}`;
  const map = readStorageJson(key);
  const existing = map[saveId];
  const now = Date.now();

  if (existing?.status === "answered") {
    return { allowed: false, reason: "already_answered" };
  }
  if (
    existing?.status === "submitting" &&
    now - (Number(existing.updatedAt) || 0) < SAVE_SUBMITTING_TTL_MS
  ) {
    return { allowed: false, reason: "already_submitting" };
  }

  map[saveId] = {
    ownerWindowId: windowId || existing?.ownerWindowId || null,
    priority: Number(existing?.priority) || 1,
    status: "submitting",
    updatedAt: now,
  };
  writeStorageJson(key, map);
  const confirm = readStorageJson(key)[saveId];
  const allowed = Boolean(confirm && confirm.status === "submitting" && (!windowId || confirm.ownerWindowId === windowId));
  return { allowed, reason: allowed ? null : "lost_race" };
}

export function rollbackSavingThrowSubmission(campaignId, saveId, windowId) {
  if (!saveId) return;
  const resolvedCampaign = campaignId || "default";
  const key = `${SAVE_CLAIMS_KEY_PREFIX}${resolvedCampaign}`;
  const map = readStorageJson(key);
  const existing = map[saveId];
  if (existing?.status === "submitting" && (!windowId || existing.ownerWindowId === windowId)) {
    map[saveId] = { ...existing, status: "open", updatedAt: Date.now() };
    writeStorageJson(key, map);
  }
}

export function markSavingThrowAnswered(campaignId, saveId, windowId = null) {
  if (!saveId) return;
  const resolvedCampaign = campaignId || "default";
  const key = `${SAVE_CLAIMS_KEY_PREFIX}${resolvedCampaign}`;
  const map = readStorageJson(key);
  if (map[saveId]?.status === "answered") return;
  map[saveId] = {
    ownerWindowId: windowId || map[saveId]?.ownerWindowId || null,
    priority: Number(map[saveId]?.priority) || 1,
    status: "answered",
    updatedAt: Date.now(),
  };
  writeStorageJson(key, map);
}
