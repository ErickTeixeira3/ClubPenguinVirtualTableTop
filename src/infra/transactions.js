import {
  runTransaction as runFirestoreTransaction,
  serverTimestamp
} from "firebase/firestore";
import { runTransaction as runRtdbTransaction } from "firebase/database";
import { RECENT_OPS_LIMIT, RESOURCE_KEYS } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { systemClock } from "./clock.js";

const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));
const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

function assertValidOpId(opId) {
  if (typeof opId !== "string") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Operation opId must be a non-empty string.",
      { opId }
    );
  }
  const clean = opId.trim();
  if (!clean || clean !== opId || UNSAFE_KEYS.has(clean)) {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      `Invalid operation opId "${opId}".`,
      { opId }
    );
  }
  return clean;
}

function assertValidResourceDelta(resourceKey, delta) {
  if (!VALID_RESOURCE_KEYS.has(resourceKey)) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Resource key "${String(resourceKey)}" is invalid.`,
      { resourceKey }
    );
  }
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    throw new AppError(
      ERROR_CODES.INVALID_TYPE,
      "Resource delta must be a finite number.",
      { delta }
    );
  }
}

export function pruneRecentOps(
  recentOps,
  nextOpId,
  timestampMs = systemClock.now(),
  limit = RECENT_OPS_LIMIT
) {
  const cleanOpId = assertValidOpId(nextOpId);
  const safeLimit =
    typeof limit === "number" && Number.isInteger(limit) && limit > 0
      ? limit
      : RECENT_OPS_LIMIT;
  const safeTs =
    typeof timestampMs === "number" && Number.isFinite(timestampMs) && timestampMs >= 0
      ? timestampMs
      : systemClock.now();

  const existing = {};
  if (recentOps && typeof recentOps === "object" && !Array.isArray(recentOps)) {
    for (const [k, v] of Object.entries(recentOps)) {
      if (!UNSAFE_KEYS.has(k) && typeof k === "string" && k.trim() && typeof v === "number" && Number.isFinite(v)) {
        existing[k] = v;
      }
    }
  }

  if (Object.hasOwn(existing, cleanOpId)) {
    return {
      alreadyApplied: true,
      recentOps: existing
    };
  }

  const entries = Object.entries(existing).map(([k, ts]) => ({
    key: k,
    ts,
    isNew: false
  }));
  entries.push({ key: cleanOpId, ts: safeTs, isNew: true });

  entries.sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    if (a.isNew !== b.isNew) return a.isNew ? 1 : -1;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  const kept = entries.slice(Math.max(0, entries.length - safeLimit));
  const pruned = {};
  for (const item of kept) {
    pruned[item.key] = item.ts;
  }

  return {
    alreadyApplied: false,
    recentOps: pruned
  };
}

export async function runFirestoreIdempotentTransaction(
  firestoreDb,
  docRef,
  { opId, nowMs = null, mutate, incrementRev = true, limit = RECENT_OPS_LIMIT }
) {
  const cleanOpId = assertValidOpId(opId);
  const resolvedNow =
    typeof nowMs === "number" && Number.isFinite(nowMs) && nowMs >= 0
      ? nowMs
      : systemClock.now();

  return runFirestoreTransaction(firestoreDb, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists()) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Document does not exist for transaction.",
        { path: docRef.path }
      );
    }

    const current = snap.data() || {};
    const pruned = pruneRecentOps(current.recentOps, cleanOpId, resolvedNow, limit);
    if (pruned.alreadyApplied) {
      return {
        applied: false,
        duplicate: true,
        rev: Number.isInteger(current.rev) ? current.rev : Number(current.rev) || 0,
        data: current
      };
    }

    const patch = typeof mutate === "function"
      ? mutate(current, { opId: cleanOpId, nowMs: resolvedNow, tx }) || {}
      : {};

    const nextRev =
      (Number.isInteger(current.rev) ? current.rev : Number(current.rev) || 0) + 1;

    const updatePayload = {
      ...patch,
      recentOps: pruned.recentOps,
      updatedAt: serverTimestamp()
    };
    if (incrementRev) {
      updatePayload.rev = nextRev;
    }

    tx.update(docRef, updatePayload);

    return {
      applied: true,
      duplicate: false,
      rev: incrementRev ? nextRev : current.rev ?? 0,
      patch,
      recentOps: pruned.recentOps
    };
  });
}

export async function applyFirestoreResourceDelta(
  firestoreDb,
  docRef,
  { resourceKey, delta, opId, nowMs = null, limit = RECENT_OPS_LIMIT }
) {
  assertValidResourceDelta(resourceKey, delta);

  let computedNext = null;
  let computedPrev = null;

  const result = await runFirestoreIdempotentTransaction(firestoreDb, docRef, {
    opId,
    nowMs,
    limit,
    incrementRev: true,
    mutate: (current) => {
      const pool = current?.resources?.[resourceKey];
      const currentVal = Number(pool?.current ?? 0);
      const hasMax = typeof pool?.max === "number" && Number.isFinite(pool.max);
      const maxVal = hasMax ? pool.max : Number.POSITIVE_INFINITY;
      const nextVal = Math.max(0, Math.min(maxVal, currentVal + delta));
      computedPrev = currentVal;
      computedNext = nextVal;

      if (pool && typeof pool === "object") {
        return {
          [`resources.${resourceKey}.current`]: nextVal
        };
      }
      return {
        [`resources.${resourceKey}`]: {
          current: nextVal,
          max: hasMax ? maxVal : Math.max(nextVal, 0)
        }
      };
    }
  });

  return {
    ...result,
    resourceKey,
    previousValue: computedPrev,
    value: computedNext
  };
}

export async function runRtdbIdempotentTransaction(
  targetRef,
  { opId, nowMs = null, mutate, limit = RECENT_OPS_LIMIT }
) {
  const cleanOpId = assertValidOpId(opId);
  const resolvedNow =
    typeof nowMs === "number" && Number.isFinite(nowMs) && nowMs >= 0
      ? nowMs
      : systemClock.now();

  let status = {
    applied: false,
    duplicate: false,
    missing: false,
    value: null
  };

  const txResult = await runRtdbTransaction(targetRef, (currentData) => {
    if (currentData === null) {
      status = {
        applied: false,
        duplicate: false,
        missing: true,
        value: null
      };
      // Retorna null na passagem especulativa inicial para o servidor devolver o snapshot real caso exista.
      return null;
    }

    const currentObj =
      typeof currentData === "object" && !Array.isArray(currentData)
        ? currentData
        : {};
    const pruned = pruneRecentOps(currentObj.recentOps, cleanOpId, resolvedNow, limit);

    if (pruned.alreadyApplied) {
      status = {
        applied: false,
        duplicate: true,
        missing: false,
        value: currentObj
      };
      return undefined;
    }

    const nextObj =
      typeof mutate === "function"
        ? mutate(currentObj, { opId: cleanOpId, nowMs: resolvedNow })
        : { ...currentObj };

    const finalObj = {
      ...nextObj,
      recentOps: pruned.recentOps
    };

    status = {
      applied: true,
      duplicate: false,
      missing: false,
      value: finalObj
    };
    return finalObj;
  });

  if (status.missing) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "RTDB node does not exist for transaction.",
      { key: targetRef?.key ?? null }
    );
  }

  const snapshotVal = txResult?.snapshot?.val ? txResult.snapshot.val() : status.value;
  return {
    committed: Boolean(txResult?.committed),
    applied: status.applied,
    duplicate: status.duplicate,
    data: snapshotVal
  };
}

export async function applyRtdbResourceDelta(
  targetRef,
  { resourceKey, delta, opId, nowMs = null, limit = RECENT_OPS_LIMIT }
) {
  assertValidResourceDelta(resourceKey, delta);

  let previousValue = null;
  let nextValue = null;

  const result = await runRtdbIdempotentTransaction(targetRef, {
    opId,
    nowMs,
    limit,
    mutate: (current) => {
      const legacyCurrentKey = resourceKey === RESOURCE_KEYS.HP ? "hpCurrent" : "mpCurrent";
      const legacyMaxKey = resourceKey === RESOURCE_KEYS.HP ? "hpMax" : "mpMax";
      const v2Pool = current?.[resourceKey];

      if (v2Pool && typeof v2Pool === "object") {
        const currentVal = Number(v2Pool.current ?? 0);
        const hasMax = typeof v2Pool.max === "number" && Number.isFinite(v2Pool.max);
        const maxVal = hasMax ? v2Pool.max : Number.POSITIVE_INFINITY;
        const clamped = Math.max(0, Math.min(maxVal, currentVal + delta));
        previousValue = currentVal;
        nextValue = clamped;
        return {
          ...current,
          [resourceKey]: {
            ...v2Pool,
            current: clamped
          }
        };
      }

      if (typeof current?.showBarsToPlayers === "boolean" && current?.[legacyCurrentKey] === undefined) {
        previousValue = null;
        nextValue = null;
        return current;
      }

      const currentVal = Number(current?.[legacyCurrentKey] ?? 0);
      const hasMax =
        typeof current?.[legacyMaxKey] === "number" && Number.isFinite(current[legacyMaxKey]);
      const maxVal = hasMax ? current[legacyMaxKey] : Number.POSITIVE_INFINITY;
      const clamped = Math.max(0, Math.min(maxVal, currentVal + delta));
      previousValue = currentVal;
      nextValue = clamped;
      return {
        ...current,
        [legacyCurrentKey]: clamped
      };
    }
  });

  return {
    ...result,
    resourceKey,
    previousValue,
    value: nextValue
  };
}
