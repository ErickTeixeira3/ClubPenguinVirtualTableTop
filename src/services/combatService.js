import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ID_PREFIXES } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { computeModifiedEffectValue } from "../engines/combat/index.js";
import { db } from "../infra/firebase.js";
import { characterDocPath, messageDocPath } from "../infra/firestorePaths.js";
import { createDeterministicSaveId, createId } from "../infra/ids.js";
import {
  applyFirestoreResourceDelta,
  runFirestoreIdempotentTransaction
} from "../infra/transactions.js";
import { consumeItem } from "./characterService.js";
import { runSagaOperation } from "./operationRunner.js";
import {
  adjustTokenResource,
  spawnCharacterToken
} from "./tokenService.js";
import {
  advanceTurnInState,
  consumeActionInState,
  consumeMovementInState,
  createCombatantEntry,
  normalizeCombatState,
  regressTurnInState,
  sortTurnOrder,
} from "../engines/combatEngine";

/**
 * Fase 3.1 / Fase 8: regra única "matriz GM/NPC vs. PC" (Princípio 6). Uma ficha é matriz quando é NPC
 * ou pertence ao Mestre; um token é instância de matriz/livre quando `kind === "npc" | "free"` ou legado `isGmToken`.
 */
export function isGmTemplateCharacter(character, campaign, token = null) {
  return Boolean(
    token?.kind === "npc" ||
      token?.kind === "free" ||
      character?.type === "npc"
  );
}

/**
 * Fase 3.1 (V-05) / Fase 8 (T4): desconta custos (MP/HP) do ATOR respeitando o Princípio 6 e U3.
 * - PC: desconta na ficha (Firestore); a projeção atualiza os tokens da cena ativa.
 * - Matriz GM/NPC ou token livre: desconta transacionalmente em `tokenSecrets` + projeta `bars`.
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
  opId = null
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
      await adjustTokenResource({
        campaignId,
        sceneId: tokenSceneId,
        token: actorToken,
        inHiddenBucket: Boolean(actorToken.inHiddenBucket || actorToken.hidden),
        resourceKey: resKey,
        delta: -amount,
        opId: opId ? `${opId}_${resKey}` : null,
        user: user || { uid: campaign?.gmId || "gm" }
      });
      deducted = true;
    } else if (opId && campaignId && character.id) {
      const result = await applyCharacterCostsIdempotently({
        campaignId,
        characterId: character.id,
        costs: { [resKey]: amount },
        opId: `${opId}_${resKey}`
      });
      deducted = Boolean(result?.applied || result?.duplicate);
    } else if (updateCharacterResource) {
      const currentVal = Number(character.resources?.[resKey]?.current ?? 0);
      await updateCharacterResource(character.id, resKey, Math.max(0, currentVal - amount));
      deducted = true;
    }
  }

  return { deducted, template };
}

/** Applies all PC resource costs in one idempotent character transaction. */
export async function applyCharacterCostsIdempotently({
  firestoreDb = db,
  campaignId,
  characterId,
  costs = {},
  opId
}) {
  const characterRef = doc(
    firestoreDb,
    characterDocPath(campaignId, characterId)
  );
  return runFirestoreIdempotentTransaction(firestoreDb, characterRef, {
    opId,
    mutate: (current) => {
      const patch = {};
      for (const key of ["hp", "mp"]) {
        const amount = Number(costs?.[key]) || 0;
        if (amount <= 0) continue;
        const pool = current.resources?.[key] || { current: 0, max: 0 };
        patch[`resources.${key}.current`] = Math.max(
          0,
          Number(pool.current || 0) - amount
        );
      }
      return patch;
    }
  });
}

/**
 * Canonical pending-message saga for rolls with costs. A crash after the
 * authority update leaves the message pending; retry uses the same opId.
 */
export async function executeCostedRollSaga({
  firestoreDb = db,
  campaignId,
  messagePayload,
  character = null,
  actorToken = null,
  sceneId = null,
  campaign = null,
  user = null,
  costs = {},
  opId = null,
  messageId = null,
  onBeforeEffects = null,
  onAfterEffects = null
}) {
  const resolvedOpId = opId || createId(ID_PREFIXES.OPERATION);
  return runSagaOperation({
    firestoreDb,
    campaignId,
    messageId,
    opId: resolvedOpId,
    messagePayload,
    onBeforeEffects,
    onAfterEffects,
    executeEffects: async () => {
      if (!character) return { applied: false };
      if (isGmTemplateCharacter(character, campaign, actorToken)) {
        const results = [];
        for (const key of ["hp", "mp"]) {
          const amount = Number(costs?.[key]) || 0;
          if (amount <= 0) continue;
          if (!actorToken?.id || !(actorToken.sceneId || sceneId)) {
            throw new AppError(
              ERROR_CODES.INVALID_REFERENCE,
              "Token ator necessário para descontar custo de NPC."
            );
          }
          results.push(
            await adjustTokenResource({
              campaignId,
              sceneId: actorToken.sceneId || sceneId,
              token: actorToken,
              inHiddenBucket: Boolean(actorToken.inHiddenBucket || actorToken.hidden),
              resourceKey: key,
              delta: -amount,
              opId: `${resolvedOpId}_${key}`,
              user
            })
          );
        }
        return { applied: results.some((item) => item?.applied), results };
      }
      return applyCharacterCostsIdempotently({
        firestoreDb,
        campaignId,
        characterId: character.id,
        costs,
        opId: resolvedOpId
      });
    }
  });
}

export async function executeSavingThrowSaga({
  saveId,
  requestMessageId,
  roll,
  messagePayload = {},
  ...sagaOptions
}) {
  if (!saveId || !requestMessageId) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "saveId e requestMessageId são obrigatórios."
    );
  }
  return executeCostedRollSaga({
    ...sagaOptions,
    messageId: createDeterministicSaveId(saveId),
    messagePayload: {
      ...messagePayload,
      roll: {
        ...(roll || {}),
        respondsTo: { messageId: requestMessageId, saveId }
      }
    }
  });
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
  consumeCharacterItem = null,
  opId = null
}) {
  if (!character || !Array.isArray(itemsToConsume) || itemsToConsume.length === 0) {
    return { mpChanged: false, hpChanged: false, invChanged: false };
  }

  let mpCost = 0;
  let hpCost = 0;
  let mpChanged = false;
  let hpChanged = false;
  const itemCountsToConsume = new Map();
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
      if (targetItemId) {
        itemCountsToConsume.set(
          targetItemId,
          (itemCountsToConsume.get(targetItemId) || 0) + 1
        );
      }
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
      opId,
    });
    deductedResource = Boolean(deductRes?.deducted);
  }
  if (invChanged) {
    if (itemCountsToConsume.size > 0) {
      for (const [targetItemId, count] of itemCountsToConsume.entries()) {
        if (consumeCharacterItem && !opId) {
          await consumeCharacterItem(character.id, targetItemId, count);
        } else {
          await consumeItem({
            campaignId: campaignId || character.campaignId,
            charId: character.id,
            itemId: targetItemId,
            amount: count,
            opId: opId ? `${opId}_item_${targetItemId}` : null
          });
        }
      }
    }
  }

  return {
    mpChanged: mpChanged && deductedResource,
    hpChanged: hpChanged && deductedResource,
    invChanged,
  };
}

/**
 * GM-only effect command for message v2. The target comes exclusively from
 * the immutable message snapshot; UI selection can never redirect it.
 */
export async function applyCombatEffect({
  firestoreDb = db,
  campaignId,
  user,
  message,
  opId = null,
  baseValue,
  scaleMode = "full",
  customValue = null,
  effectType = "damage",
  manualModifiers = [],
  sourceCharacter = null,
  targetCharacter = null,
  targetToken = null
}) {
  if (!message?.id) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "message.id is required.");
  }
  const target = message.roll?.targets?.[0] || null;
  if (!target?.tokenId) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "A mensagem não contém um alvo de token."
    );
  }
  if (targetToken?.id && targetToken.id !== target.tokenId) {
    throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Token alvo divergente da mensagem.");
  }
  const resolvedOpId = opId || createId(ID_PREFIXES.OPERATION);
  const computed = computeModifiedEffectValue({
    baseValue,
    scaleMode,
    customValue,
    effectType,
    sourceCharacter,
    targetCharacter,
    targetToken,
    manualModifiers
  });
  const resourceKey = computed.resourceKey || null;
  let authorityResult = { applied: false };

  if (resourceKey && computed.resourceDelta !== 0) {
    if (targetCharacter?.type === "pc") {
      authorityResult = await applyFirestoreResourceDelta(
        firestoreDb,
        doc(firestoreDb, characterDocPath(campaignId, targetCharacter.id)),
        {
          resourceKey,
          delta: computed.resourceDelta,
          opId: resolvedOpId
        }
      );
    } else {
      if (!targetToken || !target.sceneId) {
        throw new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          "Segredo autoritativo do token alvo indisponível."
        );
      }
      authorityResult = await adjustTokenResource({
        campaignId,
        sceneId: target.sceneId,
        token: targetToken,
        inHiddenBucket: Boolean(targetToken.inHiddenBucket || targetToken.hidden),
        resourceKey,
        delta: computed.resourceDelta,
        opId: resolvedOpId,
        user
      });
    }
  }

  const appliedEffect = {
    effectType: computed.effectType,
    scaleMode,
    finalValue: computed.finalValue,
    targetTokenId: target.tokenId,
    targetLabel: target.label || targetCharacter?.name || targetToken?.label || "Alvo",
    appliedBy: user?.uid || null,
    at: serverTimestamp()
  };
  await updateDoc(
    doc(firestoreDb, messageDocPath(campaignId, message.id)),
    {
      [`roll.appliedEffects.${resolvedOpId}`]: appliedEffect,
      updatedAt: serverTimestamp()
    }
  );
  return {
    opId: resolvedOpId,
    computed,
    authorityResult,
    appliedEffect
  };
}

/**
 * Instancia o token de uma ficha no centro da cena ativa no RTDB (v2).
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
  fog = null,
}) {
  if (!isGM && !canEditCharacter?.(char)) return null;
  return spawnCharacterToken({
    campaignId,
    campaign,
    scene: activeScene,
    char,
    user,
    isGM,
    canEditCharacter,
    spawnOptions,
    fog,
  });
}

/**
 * Sincroniza alterações feitas no Token (Tabuleiro) de volta para a Ficha (Firestore)
 * exclusivamente para personagens de jogadores (PCs). Tokens/fichas matrizes do Mestre permanecem isolados.
 * INT-06: sem `skipTokenSync` — a atualização da ficha (autoridade U3) projeta em todos os tokens do PC.
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

  if ("label" in updatedFields && updatedFields.label) {
    charUpdates.name = updatedFields.label;
  } else if ("name" in updatedFields && updatedFields.name) {
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

  for (const [resKey, curField, maxField, defaultMax] of [
    ["hp", "hpCurrent", "hpMax", 25],
    ["mp", "mpCurrent", "mpMax", 15],
  ]) {
    const hasBars =
      updatedFields.bars &&
      (curField in updatedFields.bars || maxField in updatedFields.bars);
    const hasFlat = curField in updatedFields || maxField in updatedFields;
    if (!hasBars && !hasFlat) continue;
    const srcObj = hasBars ? updatedFields.bars : updatedFields;
    const existingRes = char.resources?.[resKey];
    if (!existingRes) {
      const nextCurrent =
        curField in srcObj && srcObj[curField] !== null
          ? Number(srcObj[curField])
          : defaultMax;
      const nextMax =
        maxField in srcObj && srcObj[maxField] !== null
          ? Number(srcObj[maxField])
          : defaultMax;
      charUpdates[`resources.${resKey}`] = {
        current: Math.max(0, nextCurrent),
        max: Math.max(0, nextMax),
      };
      continue;
    }
    if (curField in srcObj && srcObj[curField] !== null) {
      charUpdates[`resources.${resKey}.current`] = Math.max(
        0,
        Number(srcObj[curField])
      );
    }
    if (maxField in srcObj && srcObj[maxField] !== null) {
      charUpdates[`resources.${resKey}.max`] = Math.max(
        0,
        Number(srcObj[maxField])
      );
    }
  }

  if ("showName" in updatedFields) {
    charUpdates["token.showName"] = updatedFields.showName !== false;
  }
  if ("sizeInCells" in updatedFields && updatedFields.sizeInCells) {
    charUpdates["token.sizeInCells"] = Math.max(
      1,
      Math.min(8, Number(updatedFields.sizeInCells) || 1)
    );
  }
  if ("image" in updatedFields && updatedFields.image && typeof updatedFields.image === "object") {
    const nextMediaId = updatedFields.image.mediaId || null;
    const nextUrl = nextMediaId ? null : updatedFields.image.url || null;
    charUpdates["token.image"] = {
      mediaId: nextMediaId,
      url: nextUrl,
    };
  } else if ("mediaId" in updatedFields || "externalUrl" in updatedFields) {
    const nextMediaId =
      "mediaId" in updatedFields
        ? updatedFields.mediaId || null
        : updatedFields.externalUrl
          ? null
          : char.token?.image?.mediaId || null;
    const nextUrl = nextMediaId
      ? null
      : "externalUrl" in updatedFields
        ? updatedFields.externalUrl || null
        : char.token?.image?.url || null;
    charUpdates["token.image"] = {
      mediaId: nextMediaId,
      url: nextUrl,
    };
  }

  if (Object.keys(charUpdates).length > 0) {
    await updateCharacter(char.id, charUpdates);
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
