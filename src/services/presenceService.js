import {
  onDisconnect,
  onValue,
  ref as rtdbRef,
  remove as rtdbRemove,
  serverTimestamp as rtdbTimestamp,
  set as rtdbSet
} from "firebase/database";
import { ID_PREFIXES, PRESENCE_KINDS } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { validatePresence } from "../domain/models/presence.js";
import { presenceMapper } from "../infra/converters/index.js";
import { rtdb } from "../infra/firebase.js";
import { createId } from "../infra/ids.js";
import {
  connectionPresencePath,
  presenceRootPath,
  rtdbConnectedInfoPath
} from "../infra/rtdbPaths.js";

const activeDisconnectHandlers = new Set();
const pendingRemovals = new Map();

function isPermissionDeniedError(err) {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    code.includes("permission-denied") ||
    code.includes("permission_denied") ||
    msg.includes("permission_denied")
  );
}

export async function disconnectAllActivePresence() {
  const handlers = Array.from(activeDisconnectHandlers);
  await Promise.all(handlers.map((fn) => Promise.resolve(fn())));
}

export function generatePresenceConnectionId() {
  return createId(ID_PREFIXES.CONNECTION);
}

export function connectPresence({
  campaignId,
  uid,
  connId,
  kind = PRESENCE_KINDS.MAIN,
  sheetId = null,
  realtimeDb = rtdb,
  onConnectionChange,
  onError
}) {
  if (!campaignId || !uid || !connId) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Campanha, UID e connId são obrigatórios para presença."
    );
  }

  const check = validatePresence({
    kind,
    sheetId: kind === PRESENCE_KINDS.SHEET ? sheetId : null,
    connectedAt: 0
  });
  if (!check.ok) {
    throw check.errors[0];
  }

  const path = connectionPresencePath(campaignId, uid, connId);
  const connRef = rtdbRef(realtimeDb, path);
  const infoRef = rtdbRef(realtimeDb, rtdbConnectedInfoPath());
  let active = true;
  let written = false;
  let removed = false;
  let disconnectHook = null;

  const removeConnection = () => {
    if (!written || removed) return Promise.resolve();
    removed = true;
    const op = rtdbRemove(connRef)
      .catch((err) => {
        if (isPermissionDeniedError(err)) {
          return;
        }
        onError?.(err);
      })
      .finally(() => {
        if (pendingRemovals.get(path) === op) {
          pendingRemovals.delete(path);
        }
      });
    pendingRemovals.set(path, op);
    return op;
  };

  let unsubscribeConnected = () => {};

  const stop = () => {
    if (!active && removed) return Promise.resolve();
    active = false;
    activeDisconnectHandlers.delete(stop);
    unsubscribeConnected();
    if (!written && disconnectHook && typeof disconnectHook.cancel === "function") {
      disconnectHook.cancel().catch((err) => {
        if (!isPermissionDeniedError(err)) {
          onError?.(err);
        }
      });
    }
    return removeConnection();
  };
  activeDisconnectHandlers.add(stop);

  unsubscribeConnected = onValue(
    infoRef,
    async (snapshot) => {
      if (!active) return;
      const connected = Boolean(snapshot.val());
      if (!connected) {
        onConnectionChange?.(false);
        return;
      }

      try {
        const inflightRemoval = pendingRemovals.get(path);
        if (inflightRemoval) {
          await inflightRemoval;
        }
        if (!active) return;

        disconnectHook = onDisconnect(connRef);
        await disconnectHook.remove();
        if (!active) {
          if (typeof disconnectHook.cancel === "function") {
            disconnectHook.cancel().catch((err) => {
              if (!isPermissionDeniedError(err)) {
                onError?.(err);
              }
            });
          }
          return;
        }
        written = true;
        removed = false;
        const payload = presenceMapper.toRtdb({
          kind,
          sheetId: kind === PRESENCE_KINDS.SHEET ? sheetId : null,
          connectedAt: rtdbTimestamp()
        });
        await rtdbSet(connRef, payload);
        if (active) {
          onConnectionChange?.(true);
        }
      } catch (err) {
        if (active) {
          onConnectionChange?.(false);
          onError?.(err);
        }
      }
    },
    (err) => {
      if (active) {
        onConnectionChange?.(false);
        onError?.(err);
      }
    }
  );

  return () => {
    void stop();
  };
}

export function subscribePresence({
  campaignId,
  realtimeDb = rtdb,
  onData,
  onError
}) {
  const rootRef = rtdbRef(realtimeDb, presenceRootPath(campaignId));
  return onValue(
    rootRef,
    (snapshot) => {
      const raw = snapshot.val() || {};
      const parsed = {};
      for (const [uid, conns] of Object.entries(raw)) {
        if (!conns || typeof conns !== "object") continue;
        const userConns = {};
        for (const [connId, entry] of Object.entries(conns)) {
          const mapped = presenceMapper.fromRtdb(entry);
          if (mapped) {
            userConns[connId] = mapped;
          }
        }
        if (Object.keys(userConns).length > 0) {
          parsed[uid] = userConns;
        }
      }
      onData?.(parsed);
    },
    (err) => {
      onError?.(err);
    }
  );
}

// TRANSITION(T1): constrói onlineUsers compatível com UI v1 a partir de presence/{uid}/{connId} + playersMap
export function buildOnlineUsersMap({
  presenceByUid = {},
  playersMap = {}
}) {
  const onlineUsers = {};
  for (const [uid, connections] of Object.entries(presenceByUid || {})) {
    const connList = Object.values(connections || {});
    if (connList.length === 0) continue;
    const memberProfile = playersMap?.[uid];
    if (!memberProfile) continue;
    onlineUsers[uid] = {
      uid,
      displayName: memberProfile.displayName || "Pinguim",
      photoURL: memberProfile.photoURL || null,
      avatarMediaId: memberProfile.avatarMediaId || null,
      online: true,
      connections
    };
  }
  return onlineUsers;
}

export function hasSheetConnectionOpen(presenceByUid = {}, uid, sheetId) {
  if (!uid || !sheetId) return false;
  const userConns = presenceByUid?.[uid];
  if (!userConns || typeof userConns !== "object") return false;
  return Object.values(userConns).some(
    (conn) => conn?.kind === PRESENCE_KINDS.SHEET && conn?.sheetId === sheetId
  );
}
