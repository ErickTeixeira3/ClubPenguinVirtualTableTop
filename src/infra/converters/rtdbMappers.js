import {
  combineToken,
  fromDrawingDoc,
  fromFogDoc,
  fromPingDoc,
  fromPresenceDoc,
  fromTokenDoc,
  fromTokenSecretDoc,
  normalizeFogArea,
  projectPublicBars,
  splitTokenDoc,
  toDrawingDoc,
  toFogDoc,
  toPingDoc,
  toPresenceDoc,
  toTokenDoc,
  toTokenSecretDoc
} from "../../domain/models/index.js";

function isRtdbServerTimestamp(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value[".sv"] === "timestamp"
  );
}

const TIMESTAMP_FIELDS = ["createdAt", "updatedAt", "connectedAt"];

function preserveServerTimestamps(entity, mapped) {
  if (!entity || typeof entity !== "object" || !mapped || typeof mapped !== "object") {
    return mapped;
  }
  const next = { ...mapped };
  for (const field of TIMESTAMP_FIELDS) {
    if (isRtdbServerTimestamp(entity[field])) {
      next[field] = entity[field];
    }
  }
  if (entity.areas && typeof entity.areas === "object" && next.areas && typeof next.areas === "object") {
    const nextAreas = { ...next.areas };
    for (const [areaId, rawArea] of Object.entries(entity.areas)) {
      if (rawArea && isRtdbServerTimestamp(rawArea.createdAt) && nextAreas[areaId]) {
        nextAreas[areaId] = { ...nextAreas[areaId], createdAt: rawArea.createdAt };
      }
    }
    next.areas = nextAreas;
  }
  return next;
}

function extractRtdbSnapshot(snapshotOrVal, context = {}) {
  if (snapshotOrVal && typeof snapshotOrVal.val === "function") {
    return {
      raw: snapshotOrVal.val(),
      id: context.id ?? snapshotOrVal.key ?? undefined
    };
  }
  return {
    raw: snapshotOrVal,
    id: context.id ?? undefined
  };
}

export function createRtdbMapper({ modelName, toDoc, fromDoc, includeIdInFromDoc = true }) {
  return Object.freeze({
    modelName,
    toRtdb(entity) {
      const payload = toDoc(entity ?? {});
      return preserveServerTimestamps(entity, payload);
    },
    fromRtdb(snapshotOrVal, context = {}) {
      const { raw, id } = extractRtdbSnapshot(snapshotOrVal, context);
      if (raw === null || raw === undefined) {
        return null;
      }
      return includeIdInFromDoc ? fromDoc(raw, id) : fromDoc(raw);
    }
  });
}

export const tokenMapper = createRtdbMapper({
  modelName: "token",
  toDoc: toTokenDoc,
  fromDoc: fromTokenDoc
});

export const tokenSecretMapper = createRtdbMapper({
  modelName: "tokenSecret",
  toDoc: toTokenSecretDoc,
  fromDoc: fromTokenSecretDoc,
  includeIdInFromDoc: false
});

export const drawingMapper = createRtdbMapper({
  modelName: "drawing",
  toDoc: toDrawingDoc,
  fromDoc: fromDrawingDoc
});

export const pingMapper = createRtdbMapper({
  modelName: "ping",
  toDoc: toPingDoc,
  fromDoc: fromPingDoc
});

export const fogMapper = createRtdbMapper({
  modelName: "fog",
  toDoc: toFogDoc,
  fromDoc: fromFogDoc,
  includeIdInFromDoc: false
});

export const fogAreaMapper = createRtdbMapper({
  modelName: "fogArea",
  toDoc: (area) => normalizeFogArea(area),
  fromDoc: (raw, id) => normalizeFogArea(raw, id)
});

export const presenceMapper = createRtdbMapper({
  modelName: "presence",
  toDoc: toPresenceDoc,
  fromDoc: fromPresenceDoc,
  includeIdInFromDoc: false
});

export { combineToken, projectPublicBars, splitTokenDoc };

export const RTDB_MAPPERS = Object.freeze({
  token: tokenMapper,
  tokenSecret: tokenSecretMapper,
  drawing: drawingMapper,
  ping: pingMapper,
  fog: fogMapper,
  fogArea: fogAreaMapper,
  presence: presenceMapper
});
