import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../infra/firebase.js";
import {
  ROLL_KINDS,
  buildTargetInfo,
  evaluateDcFormula,
} from "../engines/combatEngine";
import { evaluateFormula } from "../engines/formulaEngine";
import { classifyRollKind } from "../engines/rolls/index.js";
import { normalizeText } from "../utils/stringUtils";
import { grantMediaAudience } from "./mediaService.js";

// Fase 1 / Fase 5 (T2): classificação e resolução de atalhos vêm do engine puro `engines/rolls`,
// que lê os mapas v2 de `rollGroups`/`hotbar`. A divisão do rollService acontece na Fase 9.
export {
  buildHotbarSlotFromRoll,
  buildShortcutRollParams,
  classifyRollKind,
  effectRollKind,
  inferAbilityRollKind,
  isAttackRollMessage,
  resolveDynamicRollEntry,
  resolveHotbarSlot,
} from "../engines/rolls/index.js";

/**
 * Indica se o jogador removeu explicitamente a própria foto de perfil (A26),
 * bloqueando o fallback automático para `user.photoURL` do provedor de auth.
 */
export function isPlayerAvatarRemoved(playerRecord) {
  if (!playerRecord || typeof playerRecord !== "object") return false;
  if (playerRecord.avatarRemoved === true) return true;
  return (
    Object.hasOwn(playerRecord, "photoURL") &&
    playerRecord.photoURL === null &&
    !playerRecord.avatarMediaId
  );
}

/**
 * Fase 6.3 (A17): ícones que o código grava por padrão num atalho de atributo
 * ("sword" no 711451e, "clover" a partir da Fase 3.1). Qualquer outro foi escolhido pelo usuário.
 */
const DEFAULT_ATTRIBUTE_SHORTCUT_ICONS = new Set(["sword", "clover"]);

export function isCustomAttributeShortcutIcon(entry) {
  if (!entry) return false;
  if (entry.customIcon) return true;
  const icon = String(entry.icon || "").trim();
  if (!icon || DEFAULT_ATTRIBUTE_SHORTCUT_ICONS.has(icon)) return false;
  return normalizeText(icon) !== normalizeText(entry.name);
}

/**
 * Fase 3.1 (V-08): somente URLs HTTP(S) curtas podem ser persistidas em mensagens.
 * DataURLs (Base64) resolvidas para a tela nunca são gravadas no Firestore; a foto do
 * jogador é persistida por referência (`senderAvatarMediaId`) e resolvida na renderização.
 */
export function toPersistablePhotoUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) && url.length < 2000
    ? url
    : null;
}

/**
 * Resolve identidade unificada do emissor (personagem ativo ou perfil do jogador).
 * Ponto único de verdade usado em useChatRolls, VTTLayout e ChatSidebarPanel.
 * - `photoURL`: URL para exibição imediata na UI (pode ser DataURL resolvida).
 * - `senderPhotoURL`: valor seguro para persistir (apenas HTTP(S) ou null).
 * - `senderAvatarMediaId`: referência à foto do jogador em media/{mediaId} (mensagens sem personagem).
 * Fase 5 (T2): lê `avatar`/`token.image` (ImageRef v2) com fallback para os campos v1.
 */
export function resolveSpeakerIdentity({
  character = null,
  user = null,
  myPlayerProfile = null,
  playersMap = null,
  senderName = null,
  senderPhotoURL = null,
  resolvedAvatarUrl = null,
}) {
  const playerProfile =
    myPlayerProfile || (user?.uid && playersMap?.[user.uid]) || null;

  const fallbackPlayerName =
    playerProfile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pinguim";

  const resolvedName = senderName || character?.name || fallbackPlayerName;

  if (!character) {
    const allowAuthPhotoFallback = !isPlayerAvatarRemoved(playerProfile);
    const playerAvatarMediaId =
      playerProfile?.avatarMediaId || playerProfile?.avatar?.mediaId || null;
    const playerPhoto =
      senderPhotoURL !== null && senderPhotoURL !== undefined
        ? senderPhotoURL
        : playerProfile?.photoURL ||
          playerProfile?.avatar?.url ||
          (allowAuthPhotoFallback && !playerAvatarMediaId ? user?.photoURL : null) ||
          null;

    return {
      type: "player",
      name: resolvedName,
      senderName: resolvedName,
      photoURL: playerPhoto,
      senderPhotoURL: toPersistablePhotoUrl(playerPhoto),
      senderAvatarMediaId: playerAvatarMediaId,
      character: null,
      characterId: null,
      characterMediaId: null,
    };
  }

  const externalPhoto =
    character.avatar?.url ||
    character.token?.image?.url ||
    character.avatarExternalUrl ||
    character.defaultToken?.externalUrl ||
    character.tokenImage ||
    character.avatarImage ||
    null;

  const charMediaId =
    character.avatar?.mediaId ||
    character.token?.image?.mediaId ||
    character.avatarMediaId ||
    character.defaultToken?.mediaId ||
    null;

  const uiPhotoUrl = resolvedAvatarUrl || externalPhoto || null;
  const persistedPhotoUrl =
    senderPhotoURL !== null && senderPhotoURL !== undefined
      ? senderPhotoURL
      : charMediaId
      ? null
      : externalPhoto;

  return {
    type: "character",
    name: resolvedName,
    senderName: resolvedName,
    photoURL: uiPhotoUrl,
    senderPhotoURL: toPersistablePhotoUrl(persistedPhotoUrl),
    senderAvatarMediaId: null,
    character,
    characterId: character.id || null,
    characterMediaId: charMediaId,
  };
}

/**
 * Fase 4: antes de publicar a mensagem, a mídia do remetente (foto do jogador ou do personagem)
 * passa a incluir a audiência da mensagem.
 */
async function grantSenderMediaAudience({ campaignId, identity, visibleTo, characterMediaId = null }) {
  const mediaId =
    characterMediaId || identity?.characterMediaId || identity?.senderAvatarMediaId || null;
  if (!campaignId || !mediaId) return;
  await grantMediaAudience({ campaignId, mediaId, visibleTo });
}

/**
 * Fase 3.1 (errata Fase 3 §4.2): escritas de mensagens que ainda estavam no hook useChatRolls.
 * Mescla `partialRollData` no rollData atual da mensagem (aplicação de efeitos pelo Mestre).
 */
export async function updateChatMessageRollData({ campaignId, message, partialRollData = {} }) {
  if (!campaignId || !message?.id) return;
  await updateDoc(doc(db, "campaigns", campaignId, "messages", message.id), {
    campaignId,
    rollData: {
      ...(message.rollData || {}),
      ...partialRollData,
    },
  });
}

/** Soft Delete de mensagem (D-3: somente o Mestre apaga mensagens; garantido também pela rule). */
export async function softDeleteChatMessage({ campaignId, user, msgId }) {
  if (!campaignId || !msgId) return;
  await updateDoc(doc(db, "campaigns", campaignId, "messages", msgId), {
    campaignId,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user?.uid || "gm",
  });
}

export function buildVisibilityAudience(visibility, campaign, user) {
  const gmUid = campaign?.gmId;
  if (visibility === "gm_only") {
    return Array.from(new Set([gmUid, user?.uid].filter(Boolean)));
  }
  if (visibility === "self") {
    return [user?.uid].filter(Boolean);
  }
  return ["ALL"];
}

export async function sendEmoteChatMessage({
  campaignId,
  campaign,
  user,
  icon,
  senderName = null,
  senderPhotoURL = null,
  character = null,
  characterId = null,
  characterMediaId = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !icon) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character: character || (characterId ? { id: characterId, name: senderName, avatarMediaId: characterMediaId } : null),
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  const emoteVisibleTo = buildVisibilityAudience(visibility, campaign, user);
  await grantSenderMediaAudience({
    campaignId,
    identity,
    visibleTo: emoteVisibleTo,
    characterMediaId,
  });

  const emoteMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: characterId || identity.characterId,
    characterMediaId: characterMediaId || identity.characterMediaId,
    type: "emote",
    visibility,
    visibleTo: emoteVisibleTo,
    icon,
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, emoteMessage);
  return emoteMessage;
}

export async function sendTextChatMessage({
  campaignId,
  campaign,
  user,
  content,
  senderName = null,
  senderPhotoURL = null,
  character = null,
  characterId = null,
  characterMediaId = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !content?.trim()) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character: character || (characterId ? { id: characterId, name: senderName, avatarMediaId: characterMediaId } : null),
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  const textVisibleTo = buildVisibilityAudience(visibility, campaign, user);
  await grantSenderMediaAudience({
    campaignId,
    identity,
    visibleTo: textVisibleTo,
    characterMediaId,
  });

  const payload = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: characterId || identity.characterId,
    characterMediaId: characterMediaId || identity.characterMediaId,
    type: "text",
    visibility,
    visibleTo: textVisibleTo,
    content: content.trim(),
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, payload);
  return payload;
}

export async function sendSkillPingChatMessage({
  campaignId,
  campaign,
  user,
  character = null,
  skill = null,
  visibility = "public",
}) {
  if (!user || !campaignId || !skill) return null;

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character,
    user,
    playersMap: campaign?.players,
  });

  const pingVisibleTo = buildVisibilityAudience(visibility, campaign, user);
  await grantSenderMediaAudience({ campaignId, identity, visibleTo: pingVisibleTo });

  const pingMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: identity.characterId,
    characterMediaId: identity.characterMediaId,
    type: "skill_ping",
    visibility,
    visibleTo: pingVisibleTo,
    content: skill.description || "",
    skillData: {
      id: skill.id || `sk_${Date.now()}`,
      name: skill.name || "Habilidade",
      elementColor: skill.elementColor || "#02529c",
      cost: skill.cost || null,
      hitFormula: skill.hitFormula || skill.formula || "",
      effectFormula: skill.effectFormula || "",
      trigger: skill.trigger || null,
      effectType: skill.effectType || null,
      savingThrow: skill.savingThrow || null,
      range: skill.range || null,
      aoe: skill.aoe || null,
      description: skill.description || "",
      icon: skill.icon || null,
      attribute: skill.attribute || null,
      bonus: skill.bonus !== undefined ? skill.bonus : null,
    },
    isDeleted: false,
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, pingMessage);
  return pingMessage;
}

export async function executeChatRollMessage({
  campaignId,
  campaign,
  user,
  title = "Rolagem",
  categoryColor = "#3090f0",
  description = "",
  character = null,
  senderName = null,
  senderPhotoURL = null,
  primaryFormula = "1d20",
  primaryLabel = "Resultado",
  secondaryFormula = "",
  secondaryLabel = "Efeito / Dano",
  cost = null,
  visibility = "public",
  onDeductResource = null,
  icon = null,
  targetedToken = null,
  targetedTokens = [],
  allCharacters = [],
  effectType = null,
  savingThrow = null,
  rollKind = null,
  deferSecondaryDamage = true,
  targetInfoOverride = null,
  parentMessageId = null,
  respondedToSaveId = null,
  savingThrowOutcome = null,
}) {
  if (!user || !campaignId) return null;

  let costPaid = null;
  if (
    cost &&
    Number(cost.amount) > 0 &&
    cost.resource &&
    character &&
    onDeductResource
  ) {
    const resKey = cost.resource;
    const currentVal = Number(character.resources?.[resKey]?.current) || 0;
    const amount = Number(cost.amount) || 0;
    const nextVal = Math.max(0, currentVal - amount);
    // Fase 3.1 (V-05): o 4º argumento informa o custo bruto para que o chamador possa
    // descontar da instância do token (matriz GM/NPC) em vez da ficha-matriz.
    // Fase 6.4 (A21): só registra costPaid quando o desconto realmente ocorreu.
    const deductResult = await onDeductResource(character.id, resKey, nextVal, { amount });
    const didDeduct =
      deductResult === undefined
        ? true
        : typeof deductResult === "boolean"
        ? deductResult
        : Boolean(deductResult?.deducted);
    if (didDeduct) {
      costPaid = {
        resource: resKey.toUpperCase(),
        amount,
      };
    }
  }

  const hasPrimary = Boolean(primaryFormula?.trim());
  const hasSecondary = Boolean(secondaryFormula?.trim());
  const resolvedEffectType = effectType || (hasSecondary ? "damage" : null);

  const isAttackWithDamage = deferSecondaryDamage && hasPrimary && hasSecondary;
  const isStandaloneDamageAbility =
    deferSecondaryDamage &&
    !hasPrimary &&
    hasSecondary &&
    resolvedEffectType === "damage";

  const rolls = [];
  let primaryResult = null;

  if (hasPrimary && !isStandaloneDamageAbility) {
    const r1 = evaluateFormula(primaryFormula, character);
    primaryResult = {
      label: primaryLabel || (hasSecondary ? "Ataque" : "Rolagem"),
      ...r1,
    };
    rolls.push(primaryResult);
  }

  if (hasSecondary && !isAttackWithDamage && !isStandaloneDamageAbility) {
    const r2 = evaluateFormula(secondaryFormula, character);
    rolls.push({
      label: secondaryLabel || "Efeito",
      ...r2,
    });
  }

  const effectiveTargetedTokens =
    Array.isArray(targetedTokens) && targetedTokens.length > 0
      ? targetedTokens
      : targetedToken
      ? [targetedToken]
      : [];
  const effectiveTargetedToken = effectiveTargetedTokens[0] || null;

  const resolvedRollKind = classifyRollKind({
    rollKind,
    primaryFormula,
    secondaryFormula,
    effectType: resolvedEffectType,
    deferSecondaryDamage,
  });

  const isAttackRoll = resolvedRollKind === ROLL_KINDS.ATTACK;

  const targetInfo =
    targetInfoOverride ||
    (effectiveTargetedTokens.length > 0
      ? buildTargetInfo({
          targetedToken: effectiveTargetedToken,
          targetedTokens: effectiveTargetedTokens,
          allCharacters,
          attackTotal: isAttackRoll ? primaryResult?.total ?? null : null,
          isAttackRoll,
        })
      : null);

  let damageConfig = null;
  if (isAttackWithDamage || isStandaloneDamageAbility) {
    damageConfig = {
      formula: secondaryFormula.trim(),
      label: secondaryLabel || "Dano",
      effectType: resolvedEffectType || "damage",
      isCritSuggested: Boolean(primaryResult?.isCrit),
      savingThrow: savingThrow?.enabled ? savingThrow : null,
    };
  }

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
  const identity = resolveSpeakerIdentity({
    character,
    user,
    playersMap: campaign?.players,
    senderName,
    senderPhotoURL,
  });

  let savingThrowRequest = null;
  if (
    savingThrow?.enabled &&
    (!isAttackRoll || !targetInfo || targetInfo.isHit !== false)
  ) {
    const dcVal = evaluateDcFormula(savingThrow.dcFormula, character);
    savingThrowRequest = {
      id: `save_${msgId}`,
      parentMessageId: msgId,
      dc: dcVal,
      dcFormula: savingThrow.dcFormula || String(dcVal),
      attribute: savingThrow.attributeKey || savingThrow.attribute || "resistencia",
      effectDescription: savingThrow.effectDescription || "",
      sourceRollName: title,
      sourceCharacterId: character?.id || null,
      sourceCharacterName: identity.senderName,
      targetTokenId: targetInfo?.tokenId || null,
      targetSceneId: targetInfo?.sceneId || null,
      targetCharacterId: targetInfo?.characterId || null,
      targetName: targetInfo?.name || "Alvo",
      targetOwnerId: targetInfo?.ownerId || null,
      targetEditableBy: targetInfo?.editableBy || [],
      targetCharacterType: targetInfo?.characterType || "npc",
    };
  }

  const effectiveRollForEffect =
    rolls.length > 1 ? rolls[rolls.length - 1] : rolls[0] || null;
  const effectValue =
    !damageConfig &&
    effectiveRollForEffect &&
    (resolvedRollKind === ROLL_KINDS.DAMAGE ||
      resolvedRollKind === ROLL_KINDS.HEAL ||
      resolvedRollKind === ROLL_KINDS.MP_DAMAGE ||
      resolvedRollKind === ROLL_KINDS.MP_HEAL ||
      resolvedEffectType === "damage" ||
      resolvedEffectType === "heal" ||
      resolvedEffectType === "mp_damage" ||
      resolvedEffectType === "mp_heal")
      ? Number(effectiveRollForEffect.total) || 0
      : null;

  const resolvedSavingThrowOutcome =
    savingThrowOutcome && primaryResult
      ? {
          ...savingThrowOutcome,
          total: primaryResult.total,
          passed: Number(primaryResult.total) >= Number(savingThrowOutcome.dc || 10),
          categoryColor:
            Number(primaryResult.total) >= Number(savingThrowOutcome.dc || 10)
              ? "#16a34a"
              : "#dc2626",
        }
      : savingThrowOutcome;

  const rollVisibleTo = buildVisibilityAudience(visibility, campaign, user);
  await grantSenderMediaAudience({ campaignId, identity, visibleTo: rollVisibleTo });

  const rollMessage = {
    id: msgId,
    campaignId,
    senderId: user.uid,
    senderName: identity.senderName,
    senderPhotoURL: identity.senderPhotoURL,
    senderAvatarMediaId: identity.senderAvatarMediaId || null,
    characterId: identity.characterId,
    characterMediaId: identity.characterMediaId,
    type: "ability_roll",
    visibility,
    visibleTo: rollVisibleTo,
    content: description || "",
    icon: icon || null,
    isDeleted: false,
    rollData: {
      title,
      categoryColor: resolvedSavingThrowOutcome?.categoryColor || categoryColor,
      costPaid,
      rolls,
      primary: primaryResult,
      icon: icon || null,
      characterId: identity.characterId,
      rollKind: resolvedRollKind,
      effectType: resolvedEffectType,
      effectValue,
      targetInfo,
      damageConfig,
      savingThrowRequest,
      parentMessageId,
      respondedToSaveId,
      savingThrowOutcome: resolvedSavingThrowOutcome,
    },
    timestampMs: Date.now(),
    createdAt: serverTimestamp(),
  };

  await setDoc(msgRef, rollMessage);
  return rollMessage;
}
