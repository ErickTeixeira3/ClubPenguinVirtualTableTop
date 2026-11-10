import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { evaluateFormula } from "../engines/formulaEngine";
import {
  buildTargetInfo,
  evaluateDcFormula,
  loadStoredTargetedToken,
  loadStoredTargetedTokens
} from "../engines/combatEngine";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useChatRolls() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawMessages, setRawMessages] = useState([]);

  useEffect(() => {
    if (!user || !campaignId) return;

    const msgCol = collection(db, "campaigns", campaignId, "messages");
    const unsubscribe = onSnapshot(
      msgCol,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
        setRawMessages(list.slice(-100));
      },
      (err) => {
        console.error("Erro ao carregar mensagens:", err);
      }
    );

    return () => unsubscribe();
  }, [user, campaignId]);

  const messages = useMemo(() => {
    if (isGM) return rawMessages;
    return rawMessages.filter((m) => {
      const vis = Array.isArray(m.visibleTo) ? m.visibleTo : [];
      return vis.includes("ALL") || (user && vis.includes(user.uid));
    });
  }, [rawMessages, isGM, user]);

  const buildVisibleToList = (visibility) => {
    const gmUid = campaign?.gmId;
    if (visibility === "gm_only") {
      return Array.from(new Set([gmUid, user?.uid].filter(Boolean)));
    }
    if (visibility === "self") {
      return [user?.uid].filter(Boolean);
    }
    return ["ALL"];
  };

  const sendEmoteMessage = async ({
    icon,
    senderName,
    senderPhotoURL = null,
    characterId = null,
    characterMediaId = null,
    visibility = "public"
  }) => {
    if (!user || !campaignId || !icon) return null;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
    const playerProfile = campaign?.players?.[user.uid];

    const resolvedSenderName =
      senderName ||
      playerProfile?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Pinguim";

    const resolvedPhotoURL =
      senderPhotoURL !== null
        ? senderPhotoURL
        : (characterId ? null : (playerProfile?.photoURL || user.photoURL || null));

    const emoteMessage = {
      id: msgId,
      senderId: user.uid,
      senderName: resolvedSenderName,
      senderPhotoURL: resolvedPhotoURL,
      characterId,
      characterMediaId,
      type: "emote",
      visibility,
      visibleTo: buildVisibleToList(visibility),
      icon,
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    };

    await setDoc(msgRef, emoteMessage);
    return emoteMessage;
  };

  const sendTextMessage = async ({
    content,
    senderName,
    senderPhotoURL = null,
    characterId = null,
    characterMediaId = null,
    visibility = "public"
  }) => {
    if (!user || !campaignId || !content?.trim()) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
    const playerProfile = campaign?.players?.[user.uid];

    await setDoc(msgRef, {
      id: msgId,
      senderId: user.uid,
      senderName:
        senderName ||
        playerProfile?.displayName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "Pinguim",
      senderPhotoURL:
        senderPhotoURL !== null
          ? senderPhotoURL
          : (characterId ? null : (playerProfile?.photoURL || user.photoURL || null)),
      characterId,
      characterMediaId,
      type: "text",
      visibility,
      visibleTo: buildVisibleToList(visibility),
      content: content.trim(),
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    });
  };

  const sendSkillPing = async ({
    character = null,
    skill = null,
    visibility = "public"
  }) => {
    if (!user || !campaignId || !skill) return null;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
    const playerProfile = campaign?.players?.[user.uid];

    const resolvedSenderName =
      character?.name ||
      playerProfile?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Pinguim";

    const resolvedPhotoURL =
      character?.id ? null : (playerProfile?.photoURL || user.photoURL || null);
    const characterMediaId =
      character?.avatarMediaId || character?.defaultToken?.mediaId || null;

    const pingMessage = {
      id: msgId,
      senderId: user.uid,
      senderName: resolvedSenderName,
      senderPhotoURL: resolvedPhotoURL,
      characterId: character?.id || null,
      characterMediaId,
      type: "skill_ping",
      visibility,
      visibleTo: buildVisibleToList(visibility),
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
        icon: skill.icon || skill.name || null,
        attribute: skill.attribute || null,
        bonus: skill.bonus !== undefined ? skill.bonus : null
      },
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    };

    await setDoc(msgRef, pingMessage);
    return pingMessage;
  };

  const executeRoll = async ({
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
    cost = null, // { resource: 'mp' | 'hp', amount: number }
    visibility = "public",
    onDeductResource = null,
    icon = null,
    targetedToken = null,
    targetedTokens = [],
    allCharacters = [],
    effectType = null, // 'damage' | 'heal' | 'mp_damage' | 'mp_heal' | 'utility'
    savingThrow = null, // { enabled, dcFormula, attribute, effectDescription }
    rollKind = null, // 'attack' | 'damage' | 'heal' | 'saving_throw' | 'check'
    deferSecondaryDamage = true,
    targetInfoOverride = null,
    parentMessageId = null,
    respondedToSaveId = null,
    savingThrowOutcome = null
  }) => {
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
      await onDeductResource(character.id, resKey, nextVal);
      costPaid = {
        resource: resKey.toUpperCase(),
        amount
      };
    }

    const hasPrimary = Boolean(primaryFormula?.trim());
    const hasSecondary = Boolean(secondaryFormula?.trim());
    const resolvedEffectType =
      effectType || (hasSecondary ? "damage" : null);

    // Verifica se é uma rolagem de ataque/habilidade que deve exibir o botão "Rolar Dano"
    const isAttackWithDamage =
      deferSecondaryDamage && hasPrimary && hasSecondary;
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
        ...r1
      };
      rolls.push(primaryResult);
    }

    if (hasSecondary && !isAttackWithDamage && !isStandaloneDamageAbility) {
      const r2 = evaluateFormula(secondaryFormula, character);
      rolls.push({
        label: secondaryLabel || "Efeito",
        ...r2
      });
    }

    const storedTokens = rollKind !== "damage" ? loadStoredTargetedTokens(campaignId) : [];
    const effectiveTargetedTokens =
      Array.isArray(targetedTokens) && targetedTokens.length > 0
        ? targetedTokens
        : targetedToken
        ? [targetedToken]
        : storedTokens;
    const effectiveTargetedToken = effectiveTargetedTokens[0] || null;

    const isAttackRoll =
      rollKind === "attack" ||
      isAttackWithDamage ||
      primaryLabel === "Acerto" ||
      primaryLabel === "Ataque" ||
      /^(acerto|ataque|tiro|golpe)/i.test(primaryLabel || "") ||
      /^(ataque|tiro|golpe)/i.test(title || "") ||
      (/\b1?d20\b/i.test(primaryFormula || "") &&
        Boolean(effectiveTargetedToken) &&
        rollKind !== "damage" &&
        rollKind !== "heal" &&
        rollKind !== "saving_throw");

    const targetInfo =
      targetInfoOverride ||
      (effectiveTargetedTokens.length > 0
        ? buildTargetInfo({
            targetedToken: effectiveTargetedToken,
            targetedTokens: effectiveTargetedTokens,
            allCharacters,
            attackTotal: isAttackRoll ? (primaryResult?.total ?? null) : null,
            isAttackRoll
          })
        : null);

    let damageConfig = null;
    if (isAttackWithDamage || isStandaloneDamageAbility) {
      damageConfig = {
        formula: secondaryFormula.trim(),
        label: secondaryLabel || "Dano",
        effectType: resolvedEffectType || "damage",
        isCritSuggested: Boolean(primaryResult?.isCrit),
        savingThrow: savingThrow?.enabled ? savingThrow : null
      };
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
    const playerProfile = campaign?.players?.[user.uid];

    const resolvedSenderName =
      senderName ||
      character?.name ||
      playerProfile?.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Pinguim";

    const resolvedPhotoURL =
      senderPhotoURL !== null
        ? senderPhotoURL
        : (character?.id ? null : (playerProfile?.photoURL || user.photoURL || null));

    const characterMediaId =
      character?.avatarMediaId || character?.defaultToken?.mediaId || null;

    // Configura pedido de Teste de Resistência se habilitado e (não houve erro no ataque contra o alvo)
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
        attribute: savingThrow.attribute || "resistencia",
        effectDescription: savingThrow.effectDescription || "",
        sourceRollName: title,
        sourceCharacterId: character?.id || null,
        sourceCharacterName: resolvedSenderName,
        targetTokenId: targetInfo?.tokenId || null,
        targetSceneId: targetInfo?.sceneId || null,
        targetCharacterId: targetInfo?.characterId || null,
        targetName: targetInfo?.name || "Alvo",
        targetOwnerId: targetInfo?.ownerId || null,
        targetEditableBy: targetInfo?.editableBy || [],
        targetCharacterType: targetInfo?.characterType || "npc"
      };
    }

    // Valor numérico principal para aplicação de efeito pelo Mestre (dano, cura, PE)
    const effectiveRollForEffect =
      rolls.length > 1 ? rolls[rolls.length - 1] : rolls[0] || null;
    const effectValue =
      !damageConfig &&
      effectiveRollForEffect &&
      (rollKind === "damage" ||
        rollKind === "heal" ||
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
                : "#dc2626"
          }
        : savingThrowOutcome;

    const rollMessage = {
      id: msgId,
      senderId: user.uid,
      senderName: resolvedSenderName,
      senderPhotoURL: resolvedPhotoURL,
      characterId: character?.id || null,
      characterMediaId,
      type: "ability_roll",
      visibility,
      visibleTo: buildVisibleToList(visibility),
      content: description || "",
      icon: icon || null,
      rollData: {
        title,
        categoryColor: resolvedSavingThrowOutcome?.categoryColor || categoryColor,
        costPaid,
        rolls,
        primary: primaryResult,
        icon: icon || null,
        characterId: character?.id || null,
        rollKind:
          rollKind ||
          (isAttackRoll
            ? "attack"
            : resolvedEffectType === "heal"
            ? "heal"
            : resolvedEffectType === "damage"
            ? "damage"
            : "check"),
        effectType: resolvedEffectType,
        effectValue,
        targetInfo,
        damageConfig,
        savingThrowRequest,
        parentMessageId,
        respondedToSaveId,
        savingThrowOutcome: resolvedSavingThrowOutcome
      },
      timestampMs: Date.now(),
      createdAt: serverTimestamp()
    };

    await setDoc(msgRef, rollMessage);
    return rollMessage;
  };

  const updateMessageRollData = async (msgId, partialRollData) => {
    if (!isGM || !campaignId || !msgId) return;
    const targetMsg = rawMessages.find((m) => m.id === msgId);
    if (!targetMsg) return;
    const msgRef = doc(db, "campaigns", campaignId, "messages", msgId);
    await updateDoc(msgRef, {
      rollData: {
        ...(targetMsg.rollData || {}),
        ...partialRollData
      }
    });
  };

  const deleteMessage = async (msgId) => {
    if (!isRealGM || !campaignId || !msgId) return;
    await deleteDoc(doc(db, "campaigns", campaignId, "messages", msgId));
  };

  return {
    messages,
    sendTextMessage,
    sendEmoteMessage,
    sendSkillPing,
    executeRoll,
    updateMessageRollData,
    deleteMessage
  };
}

