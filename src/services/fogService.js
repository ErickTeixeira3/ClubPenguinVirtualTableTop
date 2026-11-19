import {
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import { ID_PREFIXES, MIN_FOG_AREA_PX } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  normalizeFog,
  normalizeFogArea,
  validateFogArea
} from "../domain/models/index.js";
import { fogMapper } from "../infra/converters/rtdbMappers.js";
import { rtdb } from "../infra/firebase.js";
import { createId } from "../infra/ids.js";
import { sceneFogPath } from "../infra/rtdbPaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { cleanRtdbValue } from "./tokenService.js";

const DEFAULT_EMPTY_FOG = Object.freeze({
  enabled: false,
  areas: {},
  updatedAt: null
});

export function subscribeFog({
  campaignId,
  sceneId,
  realtimeDb = rtdb,
  onData,
  onError
}) {
  if (!campaignId || !sceneId) {
    onData?.({ ...DEFAULT_EMPTY_FOG, areas: {} });
    return () => {};
  }

  return onValue(
    ref(realtimeDb, sceneFogPath(campaignId, sceneId)),
    (snap) => {
      if (!snap.exists()) {
        onData?.({ ...DEFAULT_EMPTY_FOG, areas: {} });
        return;
      }
      const parsed = fogMapper.fromRtdb(snap.val());
      onData?.(parsed || normalizeFog({}));
    },
    (err) => {
      onError?.(err);
    }
  );
}

export async function setFogEnabled({
  campaignId,
  sceneId,
  enabled,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode alterar a névoa de guerra."
    );
  }
  if (!campaignId || !sceneId) return;

  await rtdbUpdate(ref(realtimeDb, sceneFogPath(campaignId, sceneId)), {
    enabled: Boolean(enabled),
    updatedAt: rtdbServerTimestamp()
  });
}

export async function addFogArea({
  campaignId,
  sceneId,
  rect,
  op = "reveal",
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode editar áreas da névoa de guerra."
    );
  }
  if (!campaignId || !sceneId || !rect) return null;

  const w = Math.round(Number(rect.w) || 0);
  const h = Math.round(Number(rect.h) || 0);
  if (w < MIN_FOG_AREA_PX || h < MIN_FOG_AREA_PX) {
    return null;
  }

  const areaId = createId(ID_PREFIXES.FOG_AREA);
  const normalized = normalizeFogArea(
    {
      id: areaId,
      op: op === "hide" ? "hide" : "reveal",
      x: Math.round(Number(rect.x) || 0),
      y: Math.round(Number(rect.y) || 0),
      w,
      h,
      createdAt: null
    },
    areaId
  );

  const check = validateFogArea(normalized, areaId);
  if (!check.ok) {
    throw check.errors[0];
  }

  const wireArea = cleanRtdbValue(normalized) || {};
  wireArea.createdAt = rtdbServerTimestamp();

  await rtdbUpdate(ref(realtimeDb, sceneFogPath(campaignId, sceneId)), {
    enabled: true,
    [`areas/${areaId}`]: wireArea,
    updatedAt: rtdbServerTimestamp()
  });

  return normalized;
}

export async function resetFogCoverAll({
  campaignId,
  sceneId,
  isGM = false,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode recobrir o mapa inteiro."
    );
  }
  if (!campaignId || !sceneId) return;

  await rtdbSet(ref(realtimeDb, sceneFogPath(campaignId, sceneId)), {
    enabled: true,
    updatedAt: rtdbServerTimestamp()
  });
}
