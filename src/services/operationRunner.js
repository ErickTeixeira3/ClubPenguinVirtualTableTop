import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import {
  ID_PREFIXES,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  MESSAGE_VISIBILITY
} from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { db } from "../infra/firebase.js";
import { messagesCollectionPath } from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import {
  applyFirestoreResourceDelta,
  applyRtdbResourceDelta,
  pruneRecentOps,
  runFirestoreIdempotentTransaction,
  runRtdbIdempotentTransaction
} from "../infra/transactions.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import {
  createChatMessage,
  updateMessageStatus
} from "./chatMessageService.js";
import { messageConverter } from "../infra/converters/firestoreConverters.js";

export {
  applyFirestoreResourceDelta,
  applyRtdbResourceDelta,
  pruneRecentOps,
  runFirestoreIdempotentTransaction,
  runRtdbIdempotentTransaction
};

const TERMINAL_OPERATION_STATUSES = new Set([
  MESSAGE_STATUS.COMMITTED,
  MESSAGE_STATUS.FAILED
]);

export async function createPendingOperationMessage({
  firestoreDb = db,
  campaignId,
  messageId = null,
  opId = null,
  sender,
  visibleTo = null,
  visibility = MESSAGE_VISIBILITY.PUBLIC,
  gmId = null,
  type = MESSAGE_TYPES.ROLL,
  content = "",
  emote = null,
  skillPing = null,
  roll = null
}) {
  assertClientUpToDate();
  if (!campaignId || typeof campaignId !== "string") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId is required to create a pending operation message."
    );
  }
  const resolvedSenderUid = sender?.uid;
  if (!resolvedSenderUid || typeof resolvedSenderUid !== "string") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "sender.uid is required to create a pending operation message."
    );
  }

  const resolvedOpId = opId || createId(ID_PREFIXES.OPERATION);
  const resolvedMessageId = messageId || createId(ID_PREFIXES.MESSAGE);
  const resolvedVisibleTo = Array.isArray(visibleTo)
    ? visibleTo
    : computeAudience({
        visibility,
        gmId,
        senderUid: resolvedSenderUid
      }).visibleTo;

  const created = await createChatMessage({
    firestoreDb,
    campaignId,
    messageId: resolvedMessageId,
    sender,
    visibleTo: resolvedVisibleTo,
    visibility,
    gmId,
    type,
    status: MESSAGE_STATUS.PENDING,
    opId: resolvedOpId,
    content,
    emote,
    skillPing,
    roll
  });

  return {
    opId: resolvedOpId,
    messageId: resolvedMessageId,
    payload: created,
    seq: created.seq
  };
}

export async function commitOperationStatus({
  firestoreDb = db,
  campaignId,
  messageId,
  status = MESSAGE_STATUS.COMMITTED
}) {
  assertClientUpToDate();
  if (!TERMINAL_OPERATION_STATUSES.has(status)) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Invalid operation commit status "${String(status)}".`,
      { status }
    );
  }
  return updateMessageStatus({
    firestoreDb,
    campaignId,
    messageId,
    status
  });
}

export async function runSagaOperation({
  firestoreDb = db,
  campaignId,
  messageId = null,
  opId = null,
  messagePayload = {},
  executeEffects,
  onBeforeEffects = null,
  onAfterEffects = null
}) {
  const created = await createPendingOperationMessage({
    firestoreDb,
    campaignId,
    messageId,
    opId,
    ...messagePayload
  });

  if (typeof onBeforeEffects === "function") {
    await onBeforeEffects({
      opId: created.opId,
      messageId: created.messageId,
      campaignId
    });
  }

  const effectResult =
    typeof executeEffects === "function"
      ? await executeEffects({
          opId: created.opId,
          messageId: created.messageId,
          campaignId
        })
      : null;

  if (typeof onAfterEffects === "function") {
    await onAfterEffects({
      opId: created.opId,
      messageId: created.messageId,
      campaignId,
      effectResult
    });
  }

  await commitOperationStatus({
    firestoreDb,
    campaignId,
    messageId: created.messageId,
    status: MESSAGE_STATUS.COMMITTED
  });

  return {
    opId: created.opId,
    messageId: created.messageId,
    status: MESSAGE_STATUS.COMMITTED,
    effectResult
  };
}

export function buildPendingOperationsQuery({
  firestoreDb = db,
  campaignId,
  uid,
  isGM = false
}) {
  if (!campaignId || typeof campaignId !== "string") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId is required to query pending operations."
    );
  }
  if (!uid || typeof uid !== "string") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "uid is required to query pending operations."
    );
  }

  const colRef = collection(firestoreDb, messagesCollectionPath(campaignId));
  const constraints = [
    where("status", "==", MESSAGE_STATUS.PENDING),
    where("sender.uid", "==", uid)
  ];
  if (!isGM) {
    constraints.push(where("visibleTo", "array-contains-any", ["ALL", uid]));
  }
  return query(colRef, ...constraints);
}

export async function recoverPendingOperations({
  firestoreDb = db,
  campaignId,
  uid,
  isGM = false,
  executeRecoveryEffects,
  markFailedOnError = false
}) {
  if (typeof executeRecoveryEffects !== "function") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "executeRecoveryEffects callback is required."
    );
  }

  const pendingQuery = buildPendingOperationsQuery({
    firestoreDb,
    campaignId,
    uid,
    isGM
  });
  const snapshot = await getDocs(pendingQuery);

  const recovered = [];
  const failed = [];

  for (const docSnap of snapshot.docs) {
    const message = messageConverter.fromFirestore(docSnap);
    if (!message.opId) {
      continue;
    }

    try {
      const effectResult = await executeRecoveryEffects(message);
      await commitOperationStatus({
        firestoreDb,
        campaignId,
        messageId: message.id,
        status: MESSAGE_STATUS.COMMITTED
      });
      recovered.push({
        messageId: message.id,
        opId: message.opId,
        effectResult
      });
    } catch (err) {
      if (markFailedOnError) {
        await commitOperationStatus({
          firestoreDb,
          campaignId,
          messageId: message.id,
          status: MESSAGE_STATUS.FAILED
        });
      }
      failed.push({
        messageId: message.id,
        opId: message.opId,
        error: err
      });
    }
  }

  return { recovered, failed };
}
