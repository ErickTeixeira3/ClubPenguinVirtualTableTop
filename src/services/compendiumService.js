import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import {
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  ID_PREFIXES,
  RESOURCE_KEYS,
  ROLL_KINDS,
  SAVE_ATTRIBUTES,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../domain/constants.js";
import {
  DEFAULT_COLORS,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultCompendiumDefaults,
  createDefaultRange,
  createDefaultSavingThrow
} from "../domain/defaults.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  fromCompendiumEntryDoc,
  normalizeCompendiumEntry,
  toCompendiumEntryDoc,
  validateCompendiumEntry
} from "../domain/models/compendiumEntry.js";
import { inferAbilityRollKind } from "../engines/rolls/rollClassifier.js";
import { compendiumEntryConverter } from "../infra/converters/firestoreConverters.js";
import { db } from "../infra/firebase.js";
import {
  compendiumCollectionPath,
  compendiumEntryDocPath
} from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { subscribeVisibleCollection } from "./visibilityService.js";

const VALID_TYPES = new Set(Object.values(COMPENDIUM_TYPES));
const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_TRIGGER_TYPES = new Set(Object.values(TRIGGER_TYPES));
const VALID_RANGE_TYPES = new Set(Object.values(SKILL_RANGE_TYPES));
const VALID_AOE_TYPES = new Set(Object.values(SKILL_AOE_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_SAVE_ATTRS = new Set(SAVE_ATTRIBUTES.map((a) => a.id));

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertGmWrite({ campaignId, isRealGM }) {
  if (!trimString(campaignId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId é obrigatório."
    );
  }
  if (!isRealGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode alterar o compêndio."
    );
  }
}

function resolveCompendiumVisibility({ visibleTo, isPublic, gmUid }) {
  if (Array.isArray(visibleTo)) {
    if (isPublic === false) {
      const restricted = visibleTo.filter((id) => id && id !== "ALL");
      return computeAudience({
        visibleTo: [gmUid, ...restricted].filter(Boolean)
      }).visibleTo;
    }
    if (visibleTo.includes("ALL")) return ["ALL"];
    return computeAudience({
      visibleTo: [gmUid, ...visibleTo].filter(Boolean)
    }).visibleTo;
  }
  if (isPublic === false) {
    return gmUid ? [gmUid] : [];
  }
  return ["ALL"];
}

function normalizeSavingThrowInput(rawSave) {
  if (!rawSave || typeof rawSave !== "object") {
    return createDefaultSavingThrow();
  }
  const enabled = Boolean(rawSave.enabled);
  const dcFormula =
    typeof rawSave.dcFormula === "string" ? rawSave.dcFormula.trim() : "";
  const attributeKey =
    trimString(rawSave.attributeKey || rawSave.attribute || "resistencia") ||
    "resistencia";
  if (enabled && !dcFormula) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Fórmula de CD do teste de resistência é obrigatória quando habilitado."
    );
  }
  if (!VALID_SAVE_ATTRS.has(attributeKey)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Atributo de resistência inválido: "${attributeKey}".`
    );
  }
  return {
    enabled,
    dcFormula: dcFormula || "12",
    attributeKey,
    effectDescription:
      typeof rawSave.effectDescription === "string"
        ? rawSave.effectDescription
        : ""
  };
}

function normalizeEntryPayload(raw = {}, { campaignId, entryId, gmUid }) {
  const defaults = createDefaultCompendiumDefaults();
  const type = VALID_TYPES.has(raw.type) ? raw.type : defaults.type;
  const name = trimString(raw.name) || defaults.name;
  const cost = createDefaultAbilityCost(
    raw.cost && typeof raw.cost === "object"
      ? raw.cost
      : {
          resource: raw.costResource ?? defaults.cost.resource,
          amount: raw.costAmount ?? defaults.cost.amount
        }
  );
  if (!VALID_RESOURCE_KEYS.has(cost.resource)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Recurso de custo inválido: "${cost.resource}".`
    );
  }

  const range = createDefaultRange(
    raw.range && typeof raw.range === "object"
      ? raw.range
      : {
          type: raw.rangeType ?? defaults.range.type,
          distanceMeters: raw.rangeMeters ?? defaults.range.distanceMeters
        }
  );
  if (!VALID_RANGE_TYPES.has(range.type)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Tipo de alcance inválido: "${range.type}".`
    );
  }

  const aoe = createDefaultAoe(
    raw.aoe && typeof raw.aoe === "object"
      ? raw.aoe
      : {
          type: raw.aoeType ?? defaults.aoe.type,
          radiusMeters: raw.aoeRadiusMeters ?? defaults.aoe.radiusMeters,
          coneAngleDeg: raw.aoeConeAngleDeg ?? defaults.aoe.coneAngleDeg
        }
  );
  if (!VALID_AOE_TYPES.has(aoe.type)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Tipo de área inválido: "${aoe.type}".`
    );
  }

  const effectType = VALID_EFFECT_TYPES.has(raw.effectType)
    ? raw.effectType
    : EFFECT_TYPES.DAMAGE;
  const trigger = VALID_TRIGGER_TYPES.has(raw.trigger)
    ? raw.trigger
    : TRIGGER_TYPES.ACTIVE;
  const hitFormula =
    typeof raw.hitFormula === "string" ? raw.hitFormula.trim() : "";
  const effectFormula =
    typeof raw.effectFormula === "string"
      ? raw.effectFormula.trim()
      : typeof raw.rollFormula === "string"
        ? raw.rollFormula.trim()
        : "";
  const rollKind = VALID_ROLL_KINDS.has(raw.rollKind)
    ? raw.rollKind
    : type === COMPENDIUM_TYPES.SKILL
      ? ROLL_KINDS.CHECK
      : inferAbilityRollKind({ hitFormula, effectFormula, effectType });

  const savingThrow = normalizeSavingThrowInput(raw.savingThrow);
  const attributeKey =
    trimString(raw.attributeKey || raw.attribute || defaults.attributeKey) ||
    defaults.attributeKey;
  const visibleTo = resolveCompendiumVisibility({
    visibleTo: raw.visibleTo,
    isPublic: raw.isPublic,
    gmUid
  });

  const normalized = normalizeCompendiumEntry(
    {
      ...defaults,
      id: entryId,
      campaignId,
      type,
      name,
      category: trimString(raw.category),
      icon: trimString(raw.icon) || "sword",
      elementColor:
        trimString(raw.elementColor) || DEFAULT_COLORS.compendiumElement,
      visibleTo,
      cost,
      hitFormula,
      effectFormula,
      rollKind,
      trigger,
      effectType,
      range,
      aoe,
      savingThrow,
      bonus: Number(raw.bonus) || 0,
      attributeKey,
      description:
        typeof raw.description === "string" ? raw.description : ""
    },
    { campaignId, gmId: gmUid }
  );

  const validation = validateCompendiumEntry(normalized);
  if (!validation.ok) {
    throw validation.errors[0];
  }
  return normalized;
}

export async function createCompendiumEntry({
  firestoreDb = db,
  campaignId,
  user,
  gmId = null,
  isRealGM = false,
  entry = {}
}) {
  assertClientUpToDate();
  assertGmWrite({ campaignId, isRealGM });

  const gmUid = trimString(gmId) || trimString(user?.uid);
  const entryId = createId(ID_PREFIXES.COMPENDIUM);
  const normalized = normalizeEntryPayload(entry, {
    campaignId,
    entryId,
    gmUid
  });

  const itemRef = doc(
    firestoreDb,
    compendiumEntryDocPath(campaignId, entryId)
  ).withConverter(compendiumEntryConverter);
  await setDoc(itemRef, {
    ...toCompendiumEntryDoc(normalized),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: entryId, ...normalized };
}

export async function updateCompendiumEntry({
  firestoreDb = db,
  campaignId,
  entryId,
  user,
  gmId = null,
  isRealGM = false,
  updates = {},
  currentEntry = null
}) {
  assertClientUpToDate();
  assertGmWrite({ campaignId, isRealGM });
  if (!trimString(entryId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "entryId é obrigatório."
    );
  }

  const gmUid = trimString(gmId) || trimString(user?.uid);
  const {
    isPublic: nextIsPublic,
    visibleToPlayers: _legacyVisibleFlag,
    attribute: legacyAttribute,
    ...restUpdates
  } = updates || {};

  const nextUpdates = {
    campaignId,
    updatedAt: serverTimestamp()
  };
  const hasExplicitVisibleTo = Array.isArray(restUpdates.visibleTo);

  if (currentEntry) {
    const mergedInput = {
      ...currentEntry,
      ...restUpdates,
      ...(legacyAttribute !== undefined && restUpdates.attributeKey === undefined
        ? { attributeKey: legacyAttribute }
        : {}),
      ...(nextIsPublic !== undefined ? { isPublic: nextIsPublic } : {})
    };
    if (nextIsPublic !== undefined && !hasExplicitVisibleTo) {
      delete mergedInput.visibleTo;
    }
    const normalized = normalizeEntryPayload(mergedInput, {
      campaignId,
      entryId,
      gmUid
    });
    const docPayload = toCompendiumEntryDoc(normalized);
    for (const [k, v] of Object.entries(docPayload)) {
      if (k !== "createdAt") {
        nextUpdates[k] = v;
      }
    }
  } else {
    if (nextIsPublic !== undefined || hasExplicitVisibleTo) {
      nextUpdates.visibleTo = resolveCompendiumVisibility({
        visibleTo: restUpdates.visibleTo,
        isPublic: nextIsPublic,
        gmUid
      });
    }
    if (restUpdates.savingThrow !== undefined) {
      nextUpdates.savingThrow = normalizeSavingThrowInput(restUpdates.savingThrow);
    }
    if (legacyAttribute !== undefined && restUpdates.attributeKey === undefined) {
      nextUpdates.attributeKey = trimString(legacyAttribute) || "forca";
    }
    for (const [k, v] of Object.entries(restUpdates)) {
      if (
        k !== "visibleTo" &&
        k !== "savingThrow" &&
        k !== "id" &&
        k !== "createdAt" &&
        k !== "isDeleted" &&
        k !== "deletedAt" &&
        k !== "deletedBy" &&
        v !== undefined
      ) {
        if (k === "name") {
          const cleanName = trimString(v);
          if (!cleanName) {
            throw new AppError(
              ERROR_CODES.VALIDATION_FAILED,
              "Nome da entrada do compêndio é obrigatório."
            );
          }
          nextUpdates.name = cleanName;
        } else {
          nextUpdates[k] = v;
        }
      }
    }
  }

  const itemRef = doc(firestoreDb, compendiumEntryDocPath(campaignId, entryId));
  await updateDoc(itemRef, nextUpdates);
  return nextUpdates;
}

export async function setCompendiumVisibility({
  firestoreDb = db,
  campaignId,
  entryId,
  isPublic,
  user,
  gmId = null,
  isRealGM = false
}) {
  return updateCompendiumEntry({
    firestoreDb,
    campaignId,
    entryId,
    user,
    gmId,
    isRealGM,
    updates: { isPublic: Boolean(isPublic) }
  });
}

export async function softDeleteCompendiumEntry({
  firestoreDb = db,
  campaignId,
  entryId,
  user,
  isRealGM = false
}) {
  assertClientUpToDate();
  assertGmWrite({ campaignId, isRealGM });
  if (!trimString(entryId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "entryId é obrigatório."
    );
  }
  const itemRef = doc(firestoreDb, compendiumEntryDocPath(campaignId, entryId));
  await updateDoc(itemRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user?.uid || "gm",
    updatedAt: serverTimestamp()
  });
}

export function subscribeCompendium({
  campaignId,
  gmId = null,
  isRealGM = false,
  uid,
  firestoreDb = db,
  onData,
  onError
}) {
  if (!campaignId || !uid) return () => {};
  const compCol = collection(firestoreDb, compendiumCollectionPath(campaignId)).withConverter(
    compendiumEntryConverter
  );
  return subscribeVisibleCollection({
    colRef: compCol,
    isRealGM,
    uid,
    onNext: (snapshot) => {
      const list = snapshot.docs
        .map((d) =>
          fromCompendiumEntryDoc(d.data(), d.id, {
            campaignId,
            gmId: gmId || undefined
          })
        )
        .filter((e) => !e.isDeleted);
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      onData?.(list);
    },
    onError: (err) => {
      onError?.(err);
    }
  });
}

