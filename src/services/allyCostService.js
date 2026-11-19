import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch
} from "firebase/firestore";
import { PENDING_COST_STATUS } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  characterConverter,
  pendingCostConverter
} from "../infra/converters/firestoreConverters.js";
import { db } from "../infra/firebase.js";
import {
  characterDocPath,
  pendingCostDocPath,
  pendingCostsCollectionPath
} from "../infra/firestorePaths.js";
import { pruneRecentOps } from "../infra/transactions.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

function cleanString(value, field) {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, `${field} is required.`, {
      field
    });
  }
  return clean;
}

export function buildPendingAllyCost({
  campaignId,
  opId,
  characterId,
  sourceMessageId,
  costs = {},
  itemId = null,
  createdBy,
  createdAt = null
}) {
  return {
    id: cleanString(opId, "opId"),
    opId: cleanString(opId, "opId"),
    campaignId: cleanString(campaignId, "campaignId"),
    characterId: cleanString(characterId, "characterId"),
    sourceMessageId: cleanString(sourceMessageId, "sourceMessageId"),
    costs: {
      ...(Number(costs?.hp) > 0 ? { hp: Number(costs.hp) } : {}),
      ...(Number(costs?.mp) > 0 ? { mp: Number(costs.mp) } : {})
    },
    itemId: typeof itemId === "string" && itemId.trim() ? itemId.trim() : null,
    createdBy: cleanString(createdBy, "createdBy"),
    status: PENDING_COST_STATUS.PENDING,
    appliedBy: null,
    appliedAt: null,
    createdAt: createdAt || serverTimestamp()
  };
}

export function writePendingAllyCosts(tx, {
  firestoreDb = db,
  campaignId,
  costs = []
}) {
  const entities = costs.map((cost) => buildPendingAllyCost({ campaignId, ...cost }));
  for (const entity of entities) {
    tx.set(
      doc(firestoreDb, pendingCostDocPath(campaignId, entity.opId)),
      pendingCostConverter.toFirestore(entity)
    );
  }
  return entities;
}

export async function createPendingAllyCosts({
  firestoreDb = db,
  campaignId,
  costs = []
}) {
  assertClientUpToDate();
  const batch = writeBatch(firestoreDb);
  const entities = writePendingAllyCosts(batch, {
    firestoreDb,
    campaignId,
    costs
  });
  await batch.commit();
  return entities;
}

function computeCharacterPatch(character, pendingCost, opId) {
  const recent = pruneRecentOps(character.recentOps, opId);
  if (recent.alreadyApplied) {
    return { duplicate: true, patch: null };
  }
  const patch = {
    recentOps: recent.recentOps,
    rev: (Number(character.rev) || 0) + 1,
    updatedAt: serverTimestamp()
  };
  for (const resourceKey of ["hp", "mp"]) {
    const amount = Number(pendingCost.costs?.[resourceKey]) || 0;
    if (amount <= 0) continue;
    const pool = character.resources?.[resourceKey] || { current: 0, max: 0 };
    patch[`resources.${resourceKey}.current`] = Math.max(
      0,
      Number(pool.current || 0) - amount
    );
  }
  if (pendingCost.itemId) {
    const item = character.inventory?.[pendingCost.itemId];
    if (!item) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Item aliado não encontrado.", {
        itemId: pendingCost.itemId
      });
    }
    const nextQty = Math.max(0, (Number(item.qty) || 0) - 1);
    patch[`inventory.${pendingCost.itemId}.qty`] = nextQty;
  }
  return { duplicate: false, patch };
}

/** Applies cost and marks the queue entry in one Firestore transaction. */
export async function applyPendingAllyCost({
  firestoreDb = db,
  campaignId,
  opId,
  appliedBy
}) {
  assertClientUpToDate();
  const cleanOpId = cleanString(opId, "opId");
  const pendingRef = doc(
    firestoreDb,
    pendingCostDocPath(campaignId, cleanOpId)
  );
  return runTransaction(firestoreDb, async (tx) => {
    const pendingSnapshot = await tx.get(pendingRef);
    if (!pendingSnapshot.exists()) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Custo aliado não encontrado.", {
        opId: cleanOpId
      });
    }
    const pending = pendingCostConverter.fromFirestore(pendingSnapshot);
    if (pending.status === PENDING_COST_STATUS.APPLIED) {
      return { applied: false, duplicate: true, pendingCost: pending };
    }
    const characterRef = doc(
      firestoreDb,
      characterDocPath(campaignId, pending.characterId)
    );
    const characterSnapshot = await tx.get(characterRef);
    if (!characterSnapshot.exists()) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Ficha aliada não encontrada.", {
        characterId: pending.characterId
      });
    }
    const character = characterConverter.fromFirestore(characterSnapshot);
    const computed = computeCharacterPatch(character, pending, cleanOpId);
    if (!computed.duplicate) {
      tx.update(characterRef, computed.patch);
    }
    tx.update(pendingRef, {
      status: PENDING_COST_STATUS.APPLIED,
      appliedBy: cleanString(appliedBy, "appliedBy"),
      appliedAt: serverTimestamp()
    });
    return {
      applied: !computed.duplicate,
      duplicate: computed.duplicate,
      pendingCost: pending
    };
  });
}

export function subscribePendingAllyCosts({
  firestoreDb = db,
  campaignId,
  characterId = null,
  isGM = false,
  onData,
  onError
}) {
  const constraints = [where("status", "==", PENDING_COST_STATUS.PENDING)];
  if (!isGM) {
    constraints.unshift(
      where("characterId", "==", cleanString(characterId, "characterId"))
    );
  }
  const q = query(
    collection(firestoreDb, pendingCostsCollectionPath(campaignId)),
    ...constraints
  );
  return onSnapshot(
    q,
    (snapshot) =>
      onData?.(snapshot.docs.map((item) => pendingCostConverter.fromFirestore(item))),
    onError
  );
}

