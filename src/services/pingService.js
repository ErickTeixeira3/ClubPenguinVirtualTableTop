import {
  onDisconnect,
  onValue,
  ref,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet
} from "firebase/database";
import {
  ID_PREFIXES,
  PING_KINDS,
  PING_LIFETIME_MS
} from "../domain/constants.js";
import { DEFAULT_COLORS } from "../domain/defaults.js";
import {
  isPingExpired,
  normalizePing,
  toPingDoc,
  validatePing
} from "../domain/models/index.js";
import { pingMapper } from "../infra/converters/rtdbMappers.js";
import { rtdb } from "../infra/firebase.js";
import { createId } from "../infra/ids.js";
import {
  pingItemPath,
  pingsPath,
  rtdbServerTimeOffsetPath
} from "../infra/rtdbPaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { cleanRtdbValue } from "./tokenService.js";

export function subscribeServerTimeOffset({
  realtimeDb = rtdb,
  onOffset,
  onError
}) {
  return onValue(
    ref(realtimeDb, rtdbServerTimeOffsetPath()),
    (snap) => {
      const offset = Number(snap.val());
      onOffset?.(Number.isFinite(offset) ? offset : 0);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribePings({
  campaignId,
  sceneId,
  realtimeDb = rtdb,
  onData,
  onError
}) {
  if (!campaignId || !sceneId) {
    onData?.([]);
    return () => {};
  }

  return onValue(
    ref(realtimeDb, pingsPath(campaignId, sceneId)),
    (snap) => {
      if (!snap.exists()) {
        onData?.([]);
        return;
      }
      const rawMap = snap.val() || {};
      const list = Object.entries(rawMap)
        .filter(([, val]) => val && typeof val === "object")
        .map(([id, val]) => pingMapper.fromRtdb(val, { id }))
        .filter(Boolean)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      onData?.(list);
    },
    (err) => {
      onError?.(err);
    }
  );
}

/**
 * Cria ping ou bola de neve com `createdAt: serverTimestamp()` e `onDisconnect().remove()`.
 * Sem `setTimeout`: a expiração é garantida pela comparação com `PING_LIFETIME_MS` e limpeza por qualquer membro.
 */
export async function sendPing({
  campaignId,
  sceneId,
  x,
  y,
  kind = PING_KINDS.PING,
  from = null,
  color = DEFAULT_COLORS.ping,
  user,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !sceneId || !user?.uid) return null;

  const id = createId(ID_PREFIXES.PING);
  const resolvedKind =
    kind === PING_KINDS.SNOWBALL && from ? PING_KINDS.SNOWBALL : PING_KINDS.PING;

  const normalized = normalizePing(
    {
      id,
      authorId: user.uid,
      kind: resolvedKind,
      x: Math.round(Number(x) || 0),
      y: Math.round(Number(y) || 0),
      from:
        resolvedKind === PING_KINDS.SNOWBALL && from
          ? {
              x: Math.round(Number(from.x) || 0),
              y: Math.round(Number(from.y) || 0)
            }
          : null,
      color: typeof color === "string" && color.trim() ? color.trim() : DEFAULT_COLORS.ping,
      createdAt: null
    },
    { id }
  );

  const check = validatePing(normalized);
  if (!check.ok) {
    throw check.errors[0];
  }

  const wire = cleanRtdbValue(toPingDoc(normalized)) || {};
  wire.createdAt = rtdbServerTimestamp();

  const itemRef = ref(realtimeDb, pingItemPath(campaignId, sceneId, id));
  if (typeof onDisconnect === "function") {
    try {
      await onDisconnect(itemRef).remove();
    } catch {
      // Alguns ambientes/mocks sem socket ativo não suportam onDisconnect; a limpeza por expiração cobre o nó.
    }
  }
  await rtdbSet(itemRef, wire);
  return normalized;
}

/**
 * Remove pings expirados (`serverNowMs > createdAt + PING_LIFETIME_MS`) por qualquer membro.
 * Executa por nó individualmente para tolerar jitter de relógio entre pings distintos.
 */
export async function cleanupExpiredPings({
  campaignId,
  sceneId,
  pings = [],
  serverNowMs = Date.now(),
  lifetimeMs = PING_LIFETIME_MS,
  realtimeDb = rtdb
}) {
  if (!campaignId || !sceneId || !Array.isArray(pings) || pings.length === 0) {
    return 0;
  }
  const expired = pings.filter(
    (p) => p?.id && isPingExpired(p, serverNowMs, lifetimeMs)
  );
  if (expired.length === 0) {
    return 0;
  }

  const results = await Promise.allSettled(
    expired.map((p) =>
      rtdbRemove(ref(realtimeDb, pingItemPath(campaignId, sceneId, p.id)))
    )
  );
  return results.filter((r) => r.status === "fulfilled").length;
}
