import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import {
  HIT_EVALUATION_STATUS,
  ID_PREFIXES,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  MESSAGE_VISIBILITY,
  ROLL_KINDS
} from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { validateMessage } from "../domain/models/message.js";
import { toMessageSender } from "../domain/speakerIdentity.js";
import { resolveSpeakerIdentity } from "../domain/speakerIdentity.js";
import {
  buildTargetInfo,
  evaluateDcFormula
} from "../engines/combat/index.js";
import { evaluateFormula } from "../engines/formula/index.js";
import { classifyRollKind } from "../engines/rolls/index.js";
import { messageConverter } from "../infra/converters/firestoreConverters.js";
import { db } from "../infra/firebase.js";
import {
  chatStateDocPath,
  messageDocPath,
  messagesCollectionPath
} from "../infra/firestorePaths.js";
import { createDeterministicSaveId, createId } from "../infra/ids.js";
import { writePendingAllyCosts } from "./allyCostService.js";
import { grantMediaAudience } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

function assertRequiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      `${field} is required.`,
      { field }
    );
  }
  return value.trim();
}

export function buildMessageAudience({ visibility, gmId, senderUid, visibleTo }) {
  if (Array.isArray(visibleTo)) {
    return Array.from(new Set(visibleTo.filter((uid) => typeof uid === "string" && uid.trim())));
  }
  return computeAudience({
    visibility: visibility || MESSAGE_VISIBILITY.PUBLIC,
    gmId,
    senderUid
  }).visibleTo;
}

async function grantSenderImageAudience({ campaignId, sender, visibleTo }) {
  const mediaId = sender?.image?.mediaId;
  if (!mediaId || !Array.isArray(visibleTo) || visibleTo.length === 0) return;
  await grantMediaAudience({ campaignId, mediaId, visibleTo });
}

/**
 * Creates every message together with the monotonic chat counter. Firestore
 * transactions intentionally fail while offline, so callers can surface an
 * explicit delivery error instead of queuing an invalid sequence.
 */
export async function createChatMessage({
  firestoreDb = db,
  campaignId,
  messageId = null,
  sender,
  gmId = null,
  type = MESSAGE_TYPES.TEXT,
  visibility = MESSAGE_VISIBILITY.PUBLIC,
  visibleTo = null,
  status = MESSAGE_STATUS.COMMITTED,
  opId = null,
  content = "",
  emote = null,
  skillPing = null,
  roll = null,
  writeAdditional = null
}) {
  assertClientUpToDate();
  const cleanCampaignId = assertRequiredString(campaignId, "campaignId");
  const cleanSender = toMessageSender(sender);
  assertRequiredString(cleanSender.uid, "sender.uid");
  const resolvedMessageId = messageId || createId(ID_PREFIXES.MESSAGE);
  const resolvedVisibleTo = buildMessageAudience({
    visibility,
    gmId,
    senderUid: cleanSender.uid,
    visibleTo
  });

  await grantSenderImageAudience({
    campaignId: cleanCampaignId,
    sender: cleanSender,
    visibleTo: resolvedVisibleTo
  });

  const chatRef = doc(firestoreDb, chatStateDocPath(cleanCampaignId));
  const messageRef = doc(
    firestoreDb,
    messageDocPath(cleanCampaignId, resolvedMessageId)
  );

  try {
    const result = await runTransaction(firestoreDb, async (tx) => {
      const chatSnapshot = await tx.get(chatRef);
      if (!chatSnapshot.exists()) {
        throw new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          "O contador do chat ainda não foi inicializado.",
          { campaignId: cleanCampaignId }
        );
      }
      const chatState = chatSnapshot.data() || {};
      const lastSeq = Number(chatState.lastSeq);
      if (!Number.isInteger(lastSeq) || lastSeq < 0) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "O contador do chat é inválido.",
          { campaignId: cleanCampaignId, lastSeq: chatState.lastSeq }
        );
      }
      const seq = lastSeq + 1;
      const entity = {
        id: resolvedMessageId,
        campaignId: cleanCampaignId,
        type,
        seq,
        visibility,
        visibleTo: resolvedVisibleTo,
        sender: cleanSender,
        status,
        opId,
        content: typeof content === "string" ? content : "",
        emote,
        skillPing,
        roll,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const validation = validateMessage(entity);
      if (!validation.ok) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "A mensagem não corresponde ao contrato v2.",
          { errors: validation.errors }
        );
      }
      const payload = messageConverter.toFirestore(entity);
      tx.set(messageRef, payload);
      tx.update(chatRef, {
        campaignId: cleanCampaignId,
        lastSeq: seq,
        lastMessageId: resolvedMessageId
      });
      if (typeof writeAdditional === "function") {
        await writeAdditional(tx, {
          campaignId: cleanCampaignId,
          messageId: resolvedMessageId,
          seq,
          entity,
          payload
        });
      }
      return { entity, payload, seq };
    });
    return {
      ...result.entity,
      id: resolvedMessageId,
      seq: result.seq
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ERROR_CODES.INVALID_STATE,
      "Não foi possível enviar a mensagem. Verifique a conexão e tente novamente.",
      { campaignId: cleanCampaignId, messageId: resolvedMessageId, cause: error }
    );
  }
}

export function sendTextMessage(options) {
  const content = typeof options?.content === "string" ? options.content.trim() : "";
  if (!content) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "Digite uma mensagem.");
  }
  return createChatMessage({ ...options, type: MESSAGE_TYPES.TEXT, content });
}

export function sendEmoteMessage(options) {
  return createChatMessage({
    ...options,
    type: MESSAGE_TYPES.EMOTE,
    emote: options?.emote || { icon: options?.icon || null }
  });
}

export function sendSkillPingMessage(options) {
  return createChatMessage({
    ...options,
    type: MESSAGE_TYPES.SKILL_PING,
    skillPing: options?.skillPing || options?.skill || null,
    content: options?.content || options?.skillPing?.description || options?.skill?.description || ""
  });
}

export function sendRollMessage(options) {
  return createChatMessage({ ...options, type: MESSAGE_TYPES.ROLL });
}

export async function sendSavingThrowResponse({
  requestMessageId,
  saveId,
  roll,
  ...options
}) {
  const deterministicId = createDeterministicSaveId(saveId);
  return sendRollMessage({
    ...options,
    messageId: deterministicId,
    roll: {
      ...(roll || {}),
      respondsTo: {
        messageId: assertRequiredString(requestMessageId, "requestMessageId"),
        saveId: assertRequiredString(saveId, "saveId")
      }
    }
  });
}

export async function updateMessageStatus({
  firestoreDb = db,
  campaignId,
  messageId,
  status
}) {
  if (![MESSAGE_STATUS.COMMITTED, MESSAGE_STATUS.FAILED].includes(status)) {
    throw new AppError(ERROR_CODES.INVALID_ENUM_VALUE, "Invalid terminal message status.");
  }
  await updateDoc(doc(firestoreDb, messageDocPath(campaignId, messageId)), {
    status,
    updatedAt: serverTimestamp()
  });
  return { messageId, status };
}

export async function softDeleteMessage({
  firestoreDb = db,
  campaignId,
  messageId,
  deletedBy
}) {
  await updateDoc(doc(firestoreDb, messageDocPath(campaignId, messageId)), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: assertRequiredString(deletedBy, "deletedBy"),
    updatedAt: serverTimestamp()
  });
}

export async function savingThrowResponseExists({
  firestoreDb = db,
  campaignId,
  saveId
}) {
  const responseId = createDeterministicSaveId(saveId);
  const q = query(
    collection(firestoreDb, messagesCollectionPath(campaignId)),
    where("roll.respondsTo.saveId", "==", saveId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.some((item) => item.id === responseId);
}

function normalizeVisibility(value) {
  return value === MESSAGE_VISIBILITY.PUBLIC
    ? MESSAGE_VISIBILITY.PUBLIC
    : MESSAGE_VISIBILITY.GM_ONLY;
}

function evaluateRollFormula(formula, character, rng = Math.random) {
  const result = evaluateFormula(formula, character, { rng });
  if (!result?.ok) {
    throw new AppError(
      result?.error?.code || ERROR_CODES.VALIDATION_FAILED,
      result?.error?.message || "Não foi possível avaliar a fórmula.",
      result?.error?.details || null
    );
  }
  return result;
}

function prepareAllyCosts(rawCosts, { campaignId, messageId, createdBy }) {
  if (!Array.isArray(rawCosts)) return [];
  return rawCosts
    .filter((cost) => cost?.characterId)
    .map((cost) => ({
      opId: cost.opId || createId(ID_PREFIXES.OPERATION),
      campaignId,
      characterId: cost.characterId,
      sourceMessageId: messageId,
      costs: cost.costs || {},
      itemId: cost.itemId || null,
      createdBy
    }));
}

function buildSenderFromLegacyOptions(options = {}) {
  return resolveSpeakerIdentity({
    character: options.character || null,
    user: options.user || null,
    member: options.member || null,
    myPlayerProfile: options.myPlayerProfile || null,
    playersMap: options.playersMap || options.campaign?.players || null,
    senderName: options.senderName || null,
    image: options.senderImage || null,
    resolvedAvatarUrl: options.senderPhotoURL || null
  });
}

export async function sendTextChatMessage(options = {}) {
  const sender = buildSenderFromLegacyOptions(options);
  return sendTextMessage({
    ...options,
    sender,
    gmId: options.gmId || options.campaign?.gmId || null,
    visibility: normalizeVisibility(options.visibility)
  });
}

export async function sendEmoteChatMessage(options = {}) {
  const sender = buildSenderFromLegacyOptions(options);
  return sendEmoteMessage({
    ...options,
    sender,
    gmId: options.gmId || options.campaign?.gmId || null,
    visibility: normalizeVisibility(options.visibility),
    emote: options.emote || { icon: options.icon || "wave" }
  });
}

export async function sendSkillPingChatMessage(options = {}) {
  const sender = buildSenderFromLegacyOptions(options);
  const skill = options.skillPing || options.skill || {};
  return sendSkillPingMessage({
    ...options,
    sender,
    gmId: options.gmId || options.campaign?.gmId || null,
    visibility: normalizeVisibility(options.visibility),
    skillPing: {
      name: skill.name || "Habilidade",
      icon: skill.icon || null,
      elementColor: skill.elementColor || skill.color || "#02529c",
      description: skill.description || "",
      hitFormula: skill.hitFormula || "",
      effectFormula: skill.effectFormula || skill.rollFormula || "",
      rollKind: skill.rollKind || null,
      trigger: skill.trigger || "active",
      effectType: skill.effectType || "utility",
      cost: skill.cost || null,
      range: skill.range || null,
      aoe: skill.aoe || null,
      savingThrow: skill.savingThrow || null
    }
  });
}

/**
 * Orquestra a rolagem no navegador (U2) e persiste somente o contrato v2.
 * Custos são registrados como saga pending -> efeito idempotente -> committed.
 */
export async function executeChatRollMessage(options = {}) {
  const sender = buildSenderFromLegacyOptions(options);
  const character = options.character || null;
  const primary = evaluateRollFormula(
    options.primaryFormula || "1d20",
    character,
    options.rng || Math.random
  );
  const secondaryFormula = String(options.secondaryFormula || "").trim();
  const deferSecondary = options.deferSecondaryDamage !== false;
  const secondaryResult =
    secondaryFormula && !deferSecondary
      ? evaluateRollFormula(secondaryFormula, character, options.rng || Math.random)
      : null;
  const kind = classifyRollKind({
    rollKind: options.rollKind,
    primaryFormula: options.primaryFormula,
    secondaryFormula,
    deferSecondaryDamage: deferSecondary,
    effectType: options.effectType
  });
  const targetedTokens = Array.isArray(options.targetedTokens)
    ? options.targetedTokens.filter(Boolean)
    : options.targetedToken
      ? [options.targetedToken]
      : [];
  const tokenSecretsById = Object.fromEntries(
    targetedTokens
      .filter((token) => token?.id && token?.secrets)
      .map((token) => [token.id, token.secrets])
  );
  const targetFacts = options.targetInfoOverride
    ? {
        targets: [options.targetInfoOverride].filter((target) => target?.tokenId).map((target) => ({
          tokenId: target.tokenId,
          sceneId: target.sceneId || null,
          characterId: target.characterId || null,
          label: target.label || target.name || "Alvo"
        })),
        hitEvaluation: { status: HIT_EVALUATION_STATUS.NONE, results: [] }
      }
    : buildTargetInfo({
        targetedToken: options.targetedToken || targetedTokens[0] || null,
        targetedTokens,
        tokenSecretsById,
        allCharacters: options.allCharacters || [],
        sceneId: options.sceneId || null,
        actorUid: options.user?.uid || null,
        isGM: Boolean(options.isGM),
        isAttackRoll: kind === ROLL_KINDS.ATTACK,
        attackTotal: primary.total,
        isCrit: primary.isCrit,
        isFumble: primary.isFumble
      }) || {
        targets: [],
        hitEvaluation: { status: HIT_EVALUATION_STATUS.NONE, results: [] }
      };
  const savingThrow = options.savingThrow?.enabled ? options.savingThrow : null;
  const savingThrowRequest = savingThrow
    ? {
        id: createId(ID_PREFIXES.SAVE),
        targetCharacterId: targetFacts.targets[0]?.characterId || null,
        targetTokenId: targetFacts.targets[0]?.tokenId || null,
        targetSceneId: targetFacts.targets[0]?.sceneId || null,
        dc: evaluateDcFormula(savingThrow.dcFormula, character, {
          rng: options.rng || Math.random
        }),
        attributeKey:
          savingThrow.attributeKey || savingThrow.attribute || "resistencia",
        effectDescription: savingThrow.effectDescription || "",
        sourceName: options.title || "Rolagem"
      }
    : null;
  const respondsTo = options.respondedToSaveId
    ? {
        messageId: assertRequiredString(
          options.parentMessageId || options.requestMessageId,
          "requestMessageId"
        ),
        saveId: options.respondedToSaveId
      }
    : null;
  const resolvedMessageId = options.respondedToSaveId
    ? createDeterministicSaveId(options.respondedToSaveId)
    : options.messageId || createId(ID_PREFIXES.MESSAGE);
  const allyCosts = prepareAllyCosts(options.allyCosts, {
    campaignId: options.campaignId,
    messageId: resolvedMessageId,
    createdBy: sender.uid
  });
  const roll = {
    kind,
    title: options.title || "Rolagem",
    icon: options.icon || null,
    color: options.categoryColor || options.color || "#02529c",
    rolls: [
      {
        label: options.primaryLabel || "Resultado",
        ...primary
      },
      ...(secondaryResult
        ? [{ label: options.secondaryLabel || "Efeito", ...secondaryResult }]
        : [])
    ],
    costs: Array.isArray(options.costs)
      ? options.costs
      : options.cost?.resource && Number(options.cost?.amount) > 0
        ? [
            {
              kind: "resource",
              characterId: character?.id || null,
              resource: options.cost.resource,
              amount: Number(options.cost.amount),
              ...(options.actorToken?.id
                ? { actorTokenId: options.actorToken.id }
                : {}),
              ...(options.sceneId ? { sceneId: options.sceneId } : {})
            }
          ]
        : [],
    targets: targetFacts.targets || [],
    hitEvaluation: targetFacts.hitEvaluation || {
      status: HIT_EVALUATION_STATUS.NONE,
      results: []
    },
    savingThrowRequest,
    respondsTo,
    secondary: secondaryFormula
      ? {
          formula: secondaryFormula,
          label: options.secondaryLabel || "Efeito",
          effectType: options.effectType || "damage",
          deferred: deferSecondary,
          rolled: Boolean(secondaryResult)
        }
      : null,
    allyCostOps: allyCosts.map((cost) => cost.opId),
    appliedEffects: {}
  };
  const visibility = normalizeVisibility(options.visibility);
  const messageOptions = {
    campaignId: options.campaignId,
    firestoreDb: options.firestoreDb || db,
    messageId: resolvedMessageId,
    sender,
    gmId: options.gmId || options.campaign?.gmId || null,
    visibility,
    type: MESSAGE_TYPES.ROLL,
    content: options.description || "",
    roll,
    writeAdditional: allyCosts.length > 0
      ? async (tx, context) => {
          writePendingAllyCosts(tx, {
            firestoreDb: options.firestoreDb || db,
            campaignId: options.campaignId,
            costs: allyCosts
          });
          await options.writeAdditional?.(tx, context);
        }
      : options.writeAdditional || null
  };
  const cost = options.cost;
  const hasCost = Number(cost?.amount) > 0 && cost?.resource;
  const executeEffects =
    typeof options.executeEffects === "function"
      ? options.executeEffects
      : hasCost && typeof options.onDeductResource === "function"
        ? async ({ opId }) => {
            const current = Number(character?.resources?.[cost.resource]?.current || 0);
            return options.onDeductResource(
              character?.id,
              cost.resource,
              Math.max(0, current - Number(cost.amount)),
              { amount: Number(cost.amount), opId }
            );
          }
        : null;
  if (!executeEffects) {
    return createChatMessage(messageOptions);
  }
  const opId = options.opId || createId(ID_PREFIXES.OPERATION);
  const pending = await createChatMessage({
    ...messageOptions,
    status: MESSAGE_STATUS.PENDING,
    opId
  });
  await executeEffects({
    opId,
    messageId: pending.id,
    message: pending,
    roll
  });
  await updateMessageStatus({
    firestoreDb: options.firestoreDb || db,
    campaignId: options.campaignId,
    messageId: pending.id,
    status: MESSAGE_STATUS.COMMITTED
  });
  return { ...pending, status: MESSAGE_STATUS.COMMITTED };
}

export async function updateChatMessageRollData({
  firestoreDb = db,
  campaignId,
  message,
  partialRollData = {}
}) {
  if (!message?.id) return null;
  const currentRoll = message.roll || message.rollData || {};
  const nextRoll = {
    ...currentRoll,
    ...partialRollData,
    kind: currentRoll.kind || currentRoll.rollKind || ROLL_KINDS.CUSTOM,
    appliedEffects: currentRoll.appliedEffects || {}
  };
  await updateDoc(doc(firestoreDb, messageDocPath(campaignId, message.id)), {
    roll: nextRoll,
    updatedAt: serverTimestamp()
  });
  return nextRoll;
}

export async function softDeleteChatMessage({ campaignId, user, msgId }) {
  return softDeleteMessage({
    campaignId,
    messageId: msgId,
    deletedBy: user?.uid
  });
}

