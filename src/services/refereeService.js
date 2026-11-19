import {
  collection,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  doc
} from "firebase/firestore";
import { HIT_EVALUATION_STATUS } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { evaluatePendingHitEvaluation } from "../engines/combat/index.js";
import { messageConverter } from "../infra/converters/firestoreConverters.js";
import { db } from "../infra/firebase.js";
import {
  messageDocPath,
  messagesCollectionPath
} from "../infra/firestorePaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

export function buildPendingHitEvaluationsQuery({
  firestoreDb = db,
  campaignId
}) {
  return query(
    collection(firestoreDb, messagesCollectionPath(campaignId)),
    where("roll.hitEvaluation.status", "==", HIT_EVALUATION_STATUS.PENDING)
  );
}

export function subscribePendingHitEvaluations({
  firestoreDb = db,
  campaignId,
  onData,
  onError
}) {
  return onSnapshot(
    buildPendingHitEvaluationsQuery({ firestoreDb, campaignId }),
    (snapshot) => onData?.(snapshot.docs.map((item) => messageConverter.fromFirestore(item))),
    onError
  );
}

function resolveEvaluation(message, { tokens = [], tokenSecretsById = {}, characters = [] }) {
  const targetIds = new Set((message.roll?.targets || []).map((target) => target.tokenId));
  const targetedTokens = tokens.filter((token) => targetIds.has(token.id));
  const primary = message.roll?.rolls?.[0] || null;
  return evaluatePendingHitEvaluation({
    targetedTokens,
    tokenSecretsById,
    allCharacters: characters,
    sceneId: message.roll?.targets?.[0]?.sceneId || null,
    actorUid: message.sender?.uid || null,
    isGM: true,
    attackTotal: primary?.total ?? null,
    isCrit: Boolean(primary?.isCrit),
    isFumble: Boolean(primary?.isFumble)
  });
}

/** Transactionally turns pending into done; repeated referee loops are no-ops. */
export async function evaluatePendingMessage({
  firestoreDb = db,
  campaignId,
  message,
  tokens = [],
  tokenSecretsById = {},
  characters = []
}) {
  assertClientUpToDate();
  if (!message?.id) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "message.id is required.");
  }
  const evaluation = resolveEvaluation(message, {
    tokens,
    tokenSecretsById,
    characters
  });
  if (evaluation.status !== HIT_EVALUATION_STATUS.DONE) {
    return { updated: false, reason: "missing_authoritative_target", evaluation };
  }

  const messageRef = doc(firestoreDb, messageDocPath(campaignId, message.id));
  return runTransaction(firestoreDb, async (tx) => {
    const snapshot = await tx.get(messageRef);
    if (!snapshot.exists()) {
      return { updated: false, reason: "missing_message", evaluation };
    }
    const raw = snapshot.data() || {};
    if (raw.roll?.hitEvaluation?.status !== HIT_EVALUATION_STATUS.PENDING) {
      return { updated: false, reason: "already_evaluated", evaluation };
    }
    tx.update(messageRef, {
      "roll.hitEvaluation": evaluation,
      updatedAt: serverTimestamp()
    });
    return { updated: true, evaluation };
  });
}

export async function processPendingHitEvaluations({
  firestoreDb = db,
  campaignId,
  resolveContext
}) {
  const snapshot = await getDocs(
    buildPendingHitEvaluationsQuery({ firestoreDb, campaignId })
  );
  const results = [];
  for (const item of snapshot.docs) {
    const message = messageConverter.fromFirestore(item);
    const context = (await resolveContext?.(message)) || {};
    results.push(
      await evaluatePendingMessage({
        firestoreDb,
        campaignId,
        message,
        ...context
      })
    );
  }
  return results;
}

