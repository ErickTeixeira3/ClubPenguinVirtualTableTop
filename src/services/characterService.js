import {
  collection,
  deleteField,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import {
  CHARACTER_TYPES,
  EFFECT_TYPES,
  ID_PREFIXES,
  RESERVED_FORMULA_KEYS,
  RESOURCE_KEYS,
  ROLL_KINDS,
  ROLL_SOURCE_TYPES,
  SAVE_ATTRIBUTES,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../domain/constants.js";
import {
  DEFAULT_COLORS,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultCharacterDefaults,
  createDefaultRange,
  createDefaultSavingThrow
} from "../domain/defaults.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  fromCharacterDoc,
  normalizeCharacter,
  normalizeFormulaKey,
  toCharacterDoc,
  validateCharacter
} from "../domain/models/character.js";
import { validateImageRef } from "../domain/models/imageRef.js";
import {
  mapCompendiumEntryToCharacterEntry,
  normalizeSkillKey,
  resolveUniqueSkillKey
} from "../engines/compendium/compendiumMapper.js";
import { inferAbilityRollKind } from "../engines/rolls/rollClassifier.js";
import { characterConverter } from "../infra/converters/firestoreConverters.js";
import { db } from "../infra/firebase.js";
import { characterDocPath, charactersCollectionPath } from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import {
  applyFirestoreResourceDelta,
  runFirestoreIdempotentTransaction
} from "../infra/transactions.js";
import { grantMediaAudience, uploadCompressedMedia } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { subscribeVisibleCollection } from "./visibilityService.js";

const VALID_CHARACTER_TYPES = new Set(Object.values(CHARACTER_TYPES));
const VALID_SAVE_ATTRS = new Set(SAVE_ATTRIBUTES.map((a) => a.id));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_TRIGGER_TYPES = new Set(Object.values(TRIGGER_TYPES));
const VALID_RANGE_TYPES = new Set(Object.values(SKILL_RANGE_TYPES));
const VALID_AOE_TYPES = new Set(Object.values(SKILL_AOE_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_RESOURCE_KEYS = new Set(Object.values(RESOURCE_KEYS));
const VALID_SOURCE_TYPES = new Set(Object.values(ROLL_SOURCE_TYPES));
const RESERVED_FORMULA_KEY_SET = new Set(RESERVED_FORMULA_KEYS);

const FORBIDDEN_LEGACY_FIELDS = new Set([
  "visibleToPlayers",
  "avatarMediaId",
  "avatarExternalUrl",
  "defaultToken",
  "isFolder",
  "scope",
  "migratedToFoldersCollection"
]);

const PROTECTED_GM_ONLY_FIELDS = new Set([
  "ownerId",
  "visibleTo",
  "editableBy",
  "type",
  "campaignId"
]);

const DEFAULT_CHARACTER_SKILLS = Object.freeze({
  luta: { key: "luta", name: "Luta", attributeKey: "forca", bonus: 2, order: 0 },
  pontaria: {
    key: "pontaria",
    name: "Pontaria",
    attributeKey: "agilidade",
    bonus: 2,
    order: 1
  },
  furtividade: {
    key: "furtividade",
    name: "Furtividade",
    attributeKey: "agilidade",
    bonus: 1,
    order: 2
  },
  percepcao: {
    key: "percepcao",
    name: "Percepção",
    attributeKey: "intelecto",
    bonus: 2,
    order: 3
  },
  resistencia: {
    key: "resistencia",
    name: "Resistência",
    attributeKey: "vigor",
    bonus: 2,
    order: 4
  }
});

const DEFAULT_CHARACTER_ABILITIES = Object.freeze({
  ab_bola_neve: {
    id: "ab_bola_neve",
    name: "Arremesso de Bola de Neve",
    icon: "snowflake",
    elementColor: "#00bcd4",
    cost: { resource: "mp", amount: 0 },
    hitFormula: "1d20 + @agilidade + @pontaria",
    effectFormula: "1d6 + @agilidade",
    trigger: TRIGGER_TYPES.ACTIVE,
    effectType: EFFECT_TYPES.DAMAGE,
    rollKind: ROLL_KINDS.ATTACK,
    range: { type: SKILL_RANGE_TYPES.RANGED, distanceMeters: 9 },
    aoe: { type: SKILL_AOE_TYPES.SINGLE, radiusMeters: 6, coneAngleDeg: 45 },
    savingThrow: createDefaultSavingThrow(),
    description: "Ataque rápido à distância.",
    order: 0
  }
});

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireCampaignAndChar(campaignId, charId) {
  if (!trimString(campaignId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId é obrigatório."
    );
  }
  if (!trimString(charId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "characterId é obrigatório."
    );
  }
}

function getNextOrder(mapOrList) {
  if (!mapOrList || typeof mapOrList !== "object") return 0;
  const values = Array.isArray(mapOrList) ? mapOrList : Object.values(mapOrList);
  let maxOrder = -1;
  for (let idx = 0; idx < values.length; idx += 1) {
    const order = values[idx]?.order;
    const numeric = typeof order === "number" && Number.isFinite(order) ? order : idx;
    if (numeric > maxOrder) maxOrder = numeric;
  }
  return maxOrder + 1;
}

function normalizeSavingThrowInput(rawSave) {
  const src = rawSave && typeof rawSave === "object" ? rawSave : {};
  const enabled = Boolean(src.enabled);
  const dcFormula =
    typeof src.dcFormula === "string" ? src.dcFormula.trim() : "";
  const rawAttr = trimString(src.attributeKey || src.attribute || "resistencia") || "resistencia";
  if (enabled && !dcFormula) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Fórmula de CD do teste de resistência é obrigatória quando habilitado."
    );
  }
  if (!VALID_SAVE_ATTRS.has(rawAttr)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Atributo de resistência inválido: "${rawAttr}".`
    );
  }
  return {
    enabled,
    dcFormula: dcFormula || "12",
    attributeKey: rawAttr,
    effectDescription:
      typeof src.effectDescription === "string" ? src.effectDescription : ""
  };
}

function buildAttributeEntry(raw, currentChar, { existingKey = null } = {}) {
  const label = trimString(raw?.label);
  if (!label) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Nome do atributo não pode ficar vazio."
    );
  }
  const key = trimString(raw?.key) || normalizeFormulaKey(label);
  if (!key) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Chave de fórmula inválida para o atributo."
    );
  }
  if (RESERVED_FORMULA_KEY_SET.has(key)) {
    throw new AppError(
      ERROR_CODES.RESERVED_KEY,
      `A chave "@${key}" é reservada e não pode ser usada como atributo.`
    );
  }
  const existingAttrs = currentChar?.attributes || {};
  const existingSkills = currentChar?.skills || {};
  if (
    (key !== existingKey && existingAttrs[key]) ||
    existingSkills[key]
  ) {
    throw new AppError(
      ERROR_CODES.KEY_COLLISION,
      `Já existe um atributo ou perícia com a chave "@${key}".`
    );
  }
  const numericValue = Number(raw?.value);
  return {
    key,
    label,
    value: Number.isFinite(numericValue) ? numericValue : 0,
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(existingAttrs)
  };
}

function buildSkillEntry(raw, currentChar, { existingKey = null } = {}) {
  const name = trimString(raw?.name);
  if (!name) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Nome da perícia não pode ficar vazio."
    );
  }
  const existingAttrs = currentChar?.attributes || {};
  const existingSkills = currentChar?.skills || {};

  let key;
  if (trimString(raw?.key)) {
    key = trimString(raw.key);
    if (RESERVED_FORMULA_KEY_SET.has(key)) {
      throw new AppError(
        ERROR_CODES.RESERVED_KEY,
        `A chave "@${key}" é reservada.`
      );
    }
    if ((key !== existingKey && existingSkills[key]) || existingAttrs[key]) {
      throw new AppError(
        ERROR_CODES.KEY_COLLISION,
        `Já existe um atributo ou perícia com a chave "@${key}".`
      );
    }
  } else {
    const baseKey = normalizeSkillKey(name);
    if (!baseKey) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Não foi possível gerar uma chave de fórmula válida para a perícia."
      );
    }
    const occupied = new Set([
      ...Object.keys(existingAttrs),
      ...Object.keys(existingSkills).filter((k) => k !== existingKey),
      ...RESERVED_FORMULA_KEYS
    ]);
    if (raw?.autoResolveCollision) {
      key = resolveUniqueSkillKey(baseKey, Array.from(occupied));
    } else {
      if (RESERVED_FORMULA_KEY_SET.has(baseKey)) {
        throw new AppError(
          ERROR_CODES.RESERVED_KEY,
          `A chave "@${baseKey}" é reservada.`
        );
      }
      if (occupied.has(baseKey)) {
        throw new AppError(
          ERROR_CODES.KEY_COLLISION,
          `A chave "@${baseKey}" já está em uso por outro atributo ou perícia.`
        );
      }
      key = baseKey;
    }
  }

  const attrKeys = Object.keys(existingAttrs);
  const rawAttributeKey = trimString(raw?.attributeKey || raw?.attribute);
  const resolvedAttrKey =
    rawAttributeKey && existingAttrs[rawAttributeKey]
      ? rawAttributeKey
      : raw?.allowFallbackAttribute && attrKeys.length > 0
        ? attrKeys[0]
        : rawAttributeKey;

  if (!resolvedAttrKey || (attrKeys.length > 0 && !existingAttrs[resolvedAttrKey])) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `A perícia precisa referenciar um atributo existente na ficha.`
    );
  }

  const bonus = Number(raw?.bonus);
  return {
    key,
    name,
    attributeKey: resolvedAttrKey,
    bonus: Number.isFinite(bonus) ? bonus : 0,
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(existingSkills)
  };
}

function buildAbilityEntry(raw, currentChar, { existingId = null } = {}) {
  const name = trimString(raw?.name);
  if (!name) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Nome da habilidade não pode ficar vazio."
    );
  }
  const id = existingId || trimString(raw?.id) || createId(ID_PREFIXES.ABILITY);
  const cost = createDefaultAbilityCost(raw?.cost);
  if (!VALID_RESOURCE_KEYS.has(cost.resource)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Recurso de custo inválido: "${cost.resource}".`
    );
  }
  const range = createDefaultRange(raw?.range);
  if (!VALID_RANGE_TYPES.has(range.type)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Tipo de alcance inválido: "${range.type}".`
    );
  }
  const aoe = createDefaultAoe(raw?.aoe);
  if (!VALID_AOE_TYPES.has(aoe.type)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Tipo de área inválido: "${aoe.type}".`
    );
  }
  const effectType = VALID_EFFECT_TYPES.has(raw?.effectType)
    ? raw.effectType
    : EFFECT_TYPES.DAMAGE;
  const trigger = VALID_TRIGGER_TYPES.has(raw?.trigger)
    ? raw.trigger
    : TRIGGER_TYPES.ACTIVE;
  const hitFormula = typeof raw?.hitFormula === "string" ? raw.hitFormula.trim() : "";
  const effectFormula =
    typeof raw?.effectFormula === "string" ? raw.effectFormula.trim() : "";
  const rollKind = VALID_ROLL_KINDS.has(raw?.rollKind)
    ? raw.rollKind
    : inferAbilityRollKind({ hitFormula, effectFormula, effectType });
  const savingThrow = normalizeSavingThrowInput(raw?.savingThrow);

  return {
    id,
    name,
    icon: trimString(raw?.icon) || "sword",
    elementColor: trimString(raw?.elementColor) || DEFAULT_COLORS.abilityElement,
    cost,
    hitFormula,
    effectFormula,
    trigger,
    effectType,
    rollKind,
    range,
    aoe,
    savingThrow,
    description: typeof raw?.description === "string" ? raw.description : "",
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(currentChar?.abilities)
  };
}

function buildInventoryEntry(raw, currentChar, { existingId = null } = {}) {
  const name = trimString(raw?.name);
  if (!name) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Nome do item não pode ficar vazio."
    );
  }
  const id = existingId || trimString(raw?.id) || createId(ID_PREFIXES.ITEM);
  const rawQty = Number(raw?.qty ?? 1);
  if (!Number.isFinite(rawQty) || rawQty < 0) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Quantidade do item deve ser maior ou igual a 0."
    );
  }
  const effectType = VALID_EFFECT_TYPES.has(raw?.effectType)
    ? raw.effectType
    : EFFECT_TYPES.HEAL;
  const trigger = VALID_TRIGGER_TYPES.has(raw?.trigger)
    ? raw.trigger
    : TRIGGER_TYPES.ACTIVE;
  const rollFormula =
    typeof raw?.rollFormula === "string"
      ? raw.rollFormula.trim()
      : typeof raw?.formula === "string"
        ? raw.formula.trim()
        : "";
  const rollKind = VALID_ROLL_KINDS.has(raw?.rollKind)
    ? raw.rollKind
    : rollFormula
      ? inferAbilityRollKind({
          hitFormula: "",
          effectFormula: rollFormula,
          effectType
        })
      : null;
  const savingThrow = normalizeSavingThrowInput(raw?.savingThrow);

  return {
    id,
    name,
    icon: trimString(raw?.icon) || "sword",
    qty: Math.round(rawQty),
    elementColor: trimString(raw?.elementColor) || DEFAULT_COLORS.itemElement,
    rollFormula,
    trigger,
    effectType,
    rollKind,
    consumeOnUse: Boolean(raw?.consumeOnUse),
    savingThrow,
    description: typeof raw?.description === "string" ? raw.description : "",
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(currentChar?.inventory)
  };
}

function buildRollGroupEntry(raw, currentChar, { existingId = null } = {}) {
  const name = trimString(raw?.name);
  if (!name) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Nome do grupo de rolagens não pode ficar vazio."
    );
  }
  const id = existingId || trimString(raw?.id) || createId(ID_PREFIXES.ROLL_GROUP);
  return {
    id,
    name,
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(currentChar?.rollGroups),
    rolls:
      raw?.rolls && typeof raw.rolls === "object" && !Array.isArray(raw.rolls)
        ? raw.rolls
        : {}
  };
}

function buildRollShortcutEntry(raw, currentGroup, { existingId = null } = {}) {
  const id = existingId || trimString(raw?.id) || createId(ID_PREFIXES.ROLL);
  const rawSource =
    raw?.source && typeof raw.source === "object"
      ? raw.source
      : {
          type: raw?.sourceType || ROLL_SOURCE_TYPES.CUSTOM,
          id: raw?.sourceId ?? null
        };
  const sourceType = VALID_SOURCE_TYPES.has(rawSource.type)
    ? rawSource.type
    : ROLL_SOURCE_TYPES.CUSTOM;
  const sourceId =
    sourceType === ROLL_SOURCE_TYPES.CUSTOM ? null : trimString(rawSource.id) || null;
  if (sourceType !== ROLL_SOURCE_TYPES.CUSTOM && !sourceId) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Atalho vinculado precisa referenciar um item, perícia ou habilidade válida."
    );
  }

  const overrides = {};
  const overrideSrc =
    raw?.overrides && typeof raw.overrides === "object" ? raw.overrides : raw;
  const overrideName = trimString(overrideSrc?.name);
  const overrideIcon = trimString(overrideSrc?.icon);
  const overrideColor = trimString(overrideSrc?.color || overrideSrc?.elementColor);
  if (overrideName) overrides.name = overrideName;
  if (overrideIcon) overrides.icon = overrideIcon;
  if (overrideColor) overrides.color = overrideColor;

  const entry = {
    id,
    order:
      typeof raw?.order === "number" && Number.isFinite(raw.order)
        ? raw.order
        : getNextOrder(currentGroup?.rolls),
    source: {
      type: sourceType,
      id: sourceId
    },
    overrides
  };

  if (sourceType === ROLL_SOURCE_TYPES.CUSTOM) {
    const customSrc = raw?.custom && typeof raw.custom === "object" ? raw.custom : raw;
    if (!overrides.name) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Nome da rolagem personalizada não pode ficar vazio."
      );
    }
    const cost = createDefaultAbilityCost(customSrc?.cost);
    if (!VALID_RESOURCE_KEYS.has(cost.resource)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Recurso de custo inválido: "${cost.resource}".`
      );
    }
    const effectType = VALID_EFFECT_TYPES.has(customSrc?.effectType)
      ? customSrc.effectType
      : EFFECT_TYPES.DAMAGE;
    const hitFormula =
      typeof customSrc?.hitFormula === "string" ? customSrc.hitFormula.trim() : "";
    const effectFormula =
      typeof customSrc?.effectFormula === "string"
        ? customSrc.effectFormula.trim()
        : "";
    const rollKind = VALID_ROLL_KINDS.has(customSrc?.rollKind)
      ? customSrc.rollKind
      : inferAbilityRollKind({ hitFormula, effectFormula, effectType });

    entry.custom = {
      hitFormula,
      effectFormula,
      rollKind,
      effectType,
      cost,
      savingThrow: normalizeSavingThrowInput(customSrc?.savingThrow)
    };
  }

  return entry;
}

export async function createCharacter({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  name,
  type = undefined,
  cardColor = null,
  folderId = null,
  ownerId = null,
  visibleToAll = false
}) {
  assertClientUpToDate();
  if (!trimString(campaignId)) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "campaignId é obrigatório.");
  }
  if (!user?.uid) {
    throw new AppError(ERROR_CODES.PERMISSION_DENIED, "Usuário autenticado é obrigatório.");
  }

  const resolvedType = isGM
    ? VALID_CHARACTER_TYPES.has(type)
      ? type
      : CHARACTER_TYPES.NPC
    : CHARACTER_TYPES.PC;

  const resolvedOwnerId = isGM && trimString(ownerId) ? trimString(ownerId) : user.uid;
  const resolvedGmId = trimString(gmId) || (isGM ? user.uid : "");
  const initialVisible = visibleToAll
    ? ["ALL"]
    : [resolvedOwnerId, resolvedGmId].filter(Boolean);
  const initialEditable = [resolvedOwnerId, resolvedGmId].filter(Boolean);

  const { visibleTo, editableBy } = computeAudience({
    ownerId: resolvedOwnerId,
    gmId: resolvedGmId || undefined,
    visibleTo: initialVisible,
    editableBy: initialEditable
  });

  const charId = createId(ID_PREFIXES.CHARACTER);
  const defaults = createDefaultCharacterDefaults();
  const normalized = normalizeCharacter(
    {
      ...defaults,
      id: charId,
      campaignId,
      type: resolvedType,
      ownerId: resolvedOwnerId,
      folderId: trimString(folderId) || null,
      visibleTo,
      editableBy,
      name: trimString(name) || "Novo Pinguim",
      cardColor: trimString(cardColor) || defaults.cardColor,
      skills: DEFAULT_CHARACTER_SKILLS,
      abilities: DEFAULT_CHARACTER_ABILITIES
    },
    { campaignId, gmId: resolvedGmId || undefined }
  );

  const validation = validateCharacter(normalized);
  if (!validation.ok) {
    throw validation.errors[0];
  }

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId)).withConverter(
    characterConverter
  );
  const payload = {
    ...toCharacterDoc(normalized),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(charRef, payload);
  return { id: charId, ...normalized };
}

export async function renameCharacter({
  firestoreDb = db,
  campaignId,
  charId,
  name
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  const cleanName = trimString(name);
  if (!cleanName) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "O nome da ficha não pode ficar vazio."
    );
  }
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    name: cleanName,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
  return { name: cleanName };
}

async function grantCharacterMediaAudienceIfNeeded({
  campaignId,
  targetChar,
  visibleTo,
  firestoreDb = db
}) {
  const mediaIds = Array.from(
    new Set(
      [targetChar?.avatar?.mediaId, targetChar?.token?.image?.mediaId].filter(
        (id) => typeof id === "string" && id.trim().length > 0
      )
    )
  );
  if (mediaIds.length === 0) return;
  await Promise.all(
    mediaIds.map((mediaId) =>
      grantMediaAudience({
        campaignId,
        mediaId,
        visibleTo,
        ...(firestoreDb !== db ? { firestoreDb } : {})
      })
    )
  );
}

export async function updateCharacterFields({
  firestoreDb = db,
  campaignId,
  charId,
  updates = {},
  currentChar = null,
  isGM = false,
  gmId = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Atualização de ficha inválida."
    );
  }

  const entries = Object.entries(updates).filter(([, val]) => val !== undefined);
  if (entries.length === 0) return {};

  for (const [key] of entries) {
    const rootKey = key.split(".")[0];
    if (FORBIDDEN_LEGACY_FIELDS.has(rootKey)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Campo legado não permitido no schema v2: "${key}".`
      );
    }
    if (!isGM && (PROTECTED_GM_ONLY_FIELDS.has(rootKey) || rootKey === "isDeleted" || rootKey === "deletedAt" || rootKey === "deletedBy")) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        `Apenas o Mestre pode alterar "${rootKey}".`
      );
    }
  }

  const payload = {};
  for (const [key, value] of entries) {
    if (key === "name") {
      const cleanName = trimString(value);
      if (!cleanName) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "O nome da ficha não pode ficar vazio."
        );
      }
      payload[key] = cleanName;
    } else if (key === "type") {
      if (!VALID_CHARACTER_TYPES.has(value)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Tipo de ficha inválido: "${value}".`
        );
      }
      payload[key] = value;
    } else {
      payload[key] = value;
    }
  }

  const touchesAudience =
    payload.ownerId !== undefined ||
    payload.visibleTo !== undefined ||
    payload.editableBy !== undefined;

  if (touchesAudience && currentChar) {
    const ownerId = payload.ownerId !== undefined ? payload.ownerId : currentChar.ownerId;
    const rawVisible =
      payload.visibleTo !== undefined ? payload.visibleTo : currentChar.visibleTo;
    const rawEditable =
      payload.editableBy !== undefined ? payload.editableBy : currentChar.editableBy;
    const audience = computeAudience({
      ownerId,
      gmId: trimString(gmId) || undefined,
      visibleTo: rawVisible,
      editableBy: rawEditable
    });
    payload.visibleTo = audience.visibleTo;
    payload.editableBy = audience.editableBy;

    await grantCharacterMediaAudienceIfNeeded({
      campaignId,
      targetChar: currentChar,
      visibleTo: audience.visibleTo,
      firestoreDb
    });
  }

  payload.rev = increment(1);
  payload.updatedAt = serverTimestamp();

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, payload);
  return payload;
}

export async function applyResourceDelta({
  firestoreDb = db,
  campaignId,
  charId,
  resourceKey,
  delta,
  opId = null,
  nowMs = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!VALID_RESOURCE_KEYS.has(resourceKey)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Recurso inválido: "${resourceKey}".`
    );
  }
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, "Delta de recurso inválido.");
  }
  const resolvedOpId = trimString(opId) || createId(ID_PREFIXES.OPERATION);
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  return applyFirestoreResourceDelta(firestoreDb, charRef, {
    resourceKey,
    delta: numericDelta,
    opId: resolvedOpId,
    nowMs
  });
}

export async function consumeItem({
  firestoreDb = db,
  campaignId,
  charId,
  itemId,
  amount = 1,
  opId = null,
  nowMs = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  const cleanItemId = trimString(itemId);
  if (!cleanItemId) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "itemId é obrigatório.");
  }
  const consumeAmount = Math.max(1, Math.round(Number(amount) || 1));
  const resolvedOpId = trimString(opId) || createId(ID_PREFIXES.OPERATION);
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));

  let remainingQty = 0;
  let removed = false;

  const result = await runFirestoreIdempotentTransaction(firestoreDb, charRef, {
    opId: resolvedOpId,
    nowMs,
    incrementRev: true,
    mutate: (current) => {
      const item = current?.inventory?.[cleanItemId];
      if (!item) {
        throw new AppError(
          ERROR_CODES.INVALID_REFERENCE,
          "Item não encontrado no inventário."
        );
      }
      const currentQty = Math.round(Number(item.qty ?? 0));
      if (currentQty <= 0) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "O item não possui unidades disponíveis para consumo."
        );
      }
      const nextQty = currentQty - consumeAmount;
      if (nextQty <= 0) {
        remainingQty = 0;
        removed = true;
        return {
          [`inventory.${cleanItemId}`]: deleteField()
        };
      }
      remainingQty = nextQty;
      removed = false;
      return {
        [`inventory.${cleanItemId}.qty`]: nextQty
      };
    }
  });

  return {
    ...result,
    itemId: cleanItemId,
    remainingQty,
    removed
  };
}

export async function addEntry({
  firestoreDb = db,
  campaignId,
  charId,
  collectionName,
  entry,
  currentChar,
  rollGroupId = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!currentChar || typeof currentChar !== "object") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Estado atual da ficha é obrigatório para validação."
    );
  }

  let fieldPath;
  let built;
  let entryKey;

  if (collectionName === "attributes") {
    built = buildAttributeEntry(entry, currentChar);
    entryKey = built.key;
    fieldPath = `attributes.${entryKey}`;
  } else if (collectionName === "skills") {
    built = buildSkillEntry(entry, currentChar);
    entryKey = built.key;
    fieldPath = `skills.${entryKey}`;
  } else if (collectionName === "abilities") {
    built = buildAbilityEntry(entry, currentChar);
    entryKey = built.id;
    fieldPath = `abilities.${entryKey}`;
  } else if (collectionName === "inventory") {
    built = buildInventoryEntry(entry, currentChar);
    entryKey = built.id;
    fieldPath = `inventory.${entryKey}`;
  } else if (collectionName === "rollGroups") {
    built = buildRollGroupEntry(entry, currentChar);
    entryKey = built.id;
    fieldPath = `rollGroups.${entryKey}`;
  } else if (collectionName === "rolls") {
    const cleanGroupId = trimString(rollGroupId);
    const group = currentChar?.rollGroups?.[cleanGroupId];
    if (!cleanGroupId || !group) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Grupo de rolagens não encontrado."
      );
    }
    built = buildRollShortcutEntry(entry, group);
    entryKey = built.id;
    fieldPath = `rollGroups.${cleanGroupId}.rolls.${entryKey}`;
  } else {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Coleção desconhecida: "${collectionName}".`
    );
  }

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    [fieldPath]: built,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });

  return { key: entryKey, entry: built, path: fieldPath };
}

export async function updateEntry({
  firestoreDb = db,
  campaignId,
  charId,
  collectionName,
  entryKey,
  patch = {},
  currentChar,
  rollGroupId = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  const cleanKey = trimString(entryKey);
  if (!cleanKey) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "entryKey é obrigatório.");
  }

  let basePath;
  let merged;

  if (collectionName === "attributes") {
    const prev = currentChar?.attributes?.[cleanKey];
    if (!prev) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Atributo não encontrado.");
    }
    merged = buildAttributeEntry({ ...prev, ...patch, key: cleanKey }, currentChar, {
      existingKey: cleanKey
    });
    basePath = `attributes.${cleanKey}`;
  } else if (collectionName === "skills") {
    const prev = currentChar?.skills?.[cleanKey];
    if (!prev) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Perícia não encontrada.");
    }
    merged = buildSkillEntry({ ...prev, ...patch, key: cleanKey }, currentChar, {
      existingKey: cleanKey
    });
    basePath = `skills.${cleanKey}`;
  } else if (collectionName === "abilities") {
    const prev = currentChar?.abilities?.[cleanKey];
    if (!prev) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Habilidade não encontrada.");
    }
    merged = buildAbilityEntry({ ...prev, ...patch, id: cleanKey }, currentChar, {
      existingId: cleanKey
    });
    basePath = `abilities.${cleanKey}`;
  } else if (collectionName === "inventory") {
    const prev = currentChar?.inventory?.[cleanKey];
    if (!prev) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Item não encontrado.");
    }
    merged = buildInventoryEntry({ ...prev, ...patch, id: cleanKey }, currentChar, {
      existingId: cleanKey
    });
    basePath = `inventory.${cleanKey}`;
  } else if (collectionName === "rollGroups") {
    const prev = currentChar?.rollGroups?.[cleanKey];
    if (!prev) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Grupo de rolagens não encontrado."
      );
    }
    merged = buildRollGroupEntry({ ...prev, ...patch, id: cleanKey }, currentChar, {
      existingId: cleanKey
    });
    basePath = `rollGroups.${cleanKey}`;
  } else if (collectionName === "rolls") {
    const cleanGroupId = trimString(rollGroupId);
    const group = currentChar?.rollGroups?.[cleanGroupId];
    const prev = group?.rolls?.[cleanKey];
    if (!cleanGroupId || !prev) {
      throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Atalho não encontrado.");
    }
    merged = buildRollShortcutEntry(
      {
        ...prev,
        ...patch,
        overrides:
          patch?.overrides === null
            ? {}
            : patch?.overrides !== undefined
              ? { ...(prev.overrides || {}), ...patch.overrides }
              : prev.overrides,
        id: cleanKey
      },
      group,
      { existingId: cleanKey }
    );
    basePath = `rollGroups.${cleanGroupId}.rolls.${cleanKey}`;
  } else {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Coleção desconhecida: "${collectionName}".`
    );
  }

  const dotUpdates = {};
  for (const field of Object.keys(patch)) {
    if (field === "formula" && collectionName === "inventory") {
      dotUpdates[`${basePath}.rollFormula`] = merged.rollFormula;
      continue;
    }
    if (merged[field] !== undefined) {
      dotUpdates[`${basePath}.${field}`] = merged[field];
    }
  }
  if (Object.keys(dotUpdates).length === 0) return { entry: merged };

  dotUpdates.rev = increment(1);
  dotUpdates.updatedAt = serverTimestamp();

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, dotUpdates);
  return { entry: merged, updates: dotUpdates };
}

export async function removeEntry({
  firestoreDb = db,
  campaignId,
  charId,
  collectionName,
  entryKey,
  rollGroupId = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  const cleanKey = trimString(entryKey);
  if (!cleanKey) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "entryKey é obrigatório.");
  }

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));

  if (collectionName === "rollGroups" || collectionName === "rolls") {
    const cleanGroupId =
      collectionName === "rollGroups" ? cleanKey : trimString(rollGroupId);
    if (!cleanGroupId) {
      throw new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "rollGroupId é obrigatório para remover atalho."
      );
    }

    await runTransaction(firestoreDb, async (tx) => {
      const snap = await tx.get(charRef);
      if (!snap.exists()) {
        throw new AppError(ERROR_CODES.INVALID_REFERENCE, "Ficha não encontrada.");
      }
      const data = snap.data() || {};
      const currentRev = Number.isInteger(data.rev) ? data.rev : Number(data.rev) || 0;
      const patch = {
        [collectionName === "rollGroups"
          ? `rollGroups.${cleanGroupId}`
          : `rollGroups.${cleanGroupId}.rolls.${cleanKey}`]: deleteField(),
        rev: currentRev + 1,
        updatedAt: serverTimestamp()
      };

      const hotbar = data.hotbar;
      if (hotbar && typeof hotbar === "object" && !Array.isArray(hotbar)) {
        for (const [slotKey, slotVal] of Object.entries(hotbar)) {
          if (!slotVal) continue;
          const matchesGroup = slotVal.rollGroupId === cleanGroupId;
          const matchesRoll =
            collectionName === "rollGroups" || slotVal.rollId === cleanKey;
          if (matchesGroup && matchesRoll) {
            patch[`hotbar.${slotKey}`] = null;
          }
        }
      }

      tx.update(charRef, patch);
    });
    return;
  }

  const allowedCollections = new Set(["attributes", "skills", "abilities", "inventory"]);
  if (!allowedCollections.has(collectionName)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Coleção desconhecida: "${collectionName}".`
    );
  }

  await updateDoc(charRef, {
    [`${collectionName}.${cleanKey}`]: deleteField(),
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
}

export async function reorderEntries({
  firestoreDb = db,
  campaignId,
  charId,
  collectionName,
  orderedKeys = [],
  rollGroupId = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) return;

  const basePath =
    collectionName === "rolls"
      ? `rollGroups.${trimString(rollGroupId)}.rolls`
      : collectionName;
  if (collectionName === "rolls" && !trimString(rollGroupId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "rollGroupId é obrigatório para reordenar rolagens."
    );
  }

  const updates = {};
  orderedKeys.forEach((key, index) => {
    const clean = trimString(key);
    if (clean) {
      updates[`${basePath}.${clean}.order`] = index;
    }
  });
  if (Object.keys(updates).length === 0) return;

  updates.rev = increment(1);
  updates.updatedAt = serverTimestamp();

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, updates);
}

export async function setHotbarSlot({
  firestoreDb = db,
  campaignId,
  charId,
  slotKey,
  value = null,
  currentChar = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);

  const normalizedSlotKey =
    typeof slotKey === "number" ? String(slotKey) : trimString(slotKey);
  if (!/^[1-9]$/.test(normalizedSlotKey)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Slot da hotbar inválido: "${slotKey}".`
    );
  }

  let nextSlotValue = null;
  if (value !== null) {
    const rollGroupId = trimString(value?.rollGroupId);
    const rollId = trimString(value?.rollId);
    if (!rollGroupId || !rollId) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Slot da hotbar precisa de rollGroupId e rollId."
      );
    }
    if (currentChar && !currentChar?.rollGroups?.[rollGroupId]?.rolls?.[rollId]) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        `Rolagem "${rollGroupId}.${rollId}" não existe na ficha.`
      );
    }
    nextSlotValue = { rollGroupId, rollId };
  }

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    [`hotbar.${normalizedSlotKey}`]: nextSlotValue,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
  return { slotKey: normalizedSlotKey, value: nextSlotValue };
}

export async function shareCharacter({
  firestoreDb = db,
  campaignId,
  charId,
  visibleTo,
  editableBy,
  gmId,
  isGM = false,
  currentChar
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode gerenciar compartilhamento da ficha."
    );
  }
  if (!currentChar) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Dados atuais da ficha são obrigatórios."
    );
  }

  const audience = computeAudience({
    ownerId: currentChar.ownerId,
    gmId: trimString(gmId) || undefined,
    visibleTo: visibleTo !== undefined ? visibleTo : currentChar.visibleTo,
    editableBy: editableBy !== undefined ? editableBy : currentChar.editableBy
  });

  await grantCharacterMediaAudienceIfNeeded({
    campaignId,
    targetChar: currentChar,
    visibleTo: audience.visibleTo,
    firestoreDb
  });

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
  return audience;
}

export async function transferCharacter({
  firestoreDb = db,
  campaignId,
  charId,
  newOwnerId,
  gmId,
  isGM = false,
  currentChar,
  currentFolder = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode transferir a posse de uma ficha."
    );
  }
  const cleanOwner = trimString(newOwnerId);
  if (!cleanOwner) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "newOwnerId é obrigatório."
    );
  }
  if (!currentChar) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Dados atuais da ficha são obrigatórios."
    );
  }

  const audience = computeAudience({
    ownerId: cleanOwner,
    gmId: trimString(gmId) || undefined,
    visibleTo: currentChar.visibleTo,
    editableBy: currentChar.editableBy
  });

  await grantCharacterMediaAudienceIfNeeded({
    campaignId,
    targetChar: currentChar,
    visibleTo: audience.visibleTo,
    firestoreDb
  });

  let nextFolderId = currentChar.folderId ?? null;
  if (nextFolderId) {
    const folderVisible = Array.isArray(currentFolder?.visibleTo)
      ? currentFolder.visibleTo
      : [];
    const ownerCanSeeFolder =
      currentFolder &&
      (currentFolder.ownerId === cleanOwner ||
        folderVisible.includes("ALL") ||
        folderVisible.includes(cleanOwner));
    if (!ownerCanSeeFolder) {
      nextFolderId = null;
    }
  }

  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    ownerId: cleanOwner,
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    folderId: nextFolderId,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
  return {
    ownerId: cleanOwner,
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    folderId: nextFolderId
  };
}

export async function softDeleteCharacter({
  firestoreDb = db,
  campaignId,
  charId,
  uid
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!trimString(uid)) {
    throw new AppError(ERROR_CODES.PERMISSION_DENIED, "uid é obrigatório.");
  }
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    campaignId,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: uid,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
}

export async function uploadCharacterImage({
  firestoreDb = db,
  campaignId,
  charId,
  file,
  compressed = null,
  targetField = "avatar",
  user,
  currentChar
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!user?.uid) {
    throw new AppError(ERROR_CODES.PERMISSION_DENIED, "Usuário autenticado é obrigatório.");
  }
  if (!file && !compressed) {
    throw new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "Arquivo de imagem obrigatório.");
  }
  if (!currentChar) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Dados atuais da ficha são obrigatórios."
    );
  }

  const isTokenImage = targetField === "token" || targetField === "token.image";
  const category = isTokenImage ? "token" : "avatar";
  const currentVisible = Array.isArray(currentChar.visibleTo)
    ? currentChar.visibleTo
    : [currentChar.ownerId || user.uid];
  const initialMediaAudience =
    isTokenImage && currentChar.type !== CHARACTER_TYPES.NPC
      ? Array.from(new Set([...currentVisible, "ALL"]))
      : currentVisible;

  const uploaded = await uploadCompressedMedia({
    file,
    compressed,
    category,
    campaignId,
    uploadedBy: user.uid,
    visibleTo: initialMediaAudience
  });

  const nextRef = { mediaId: uploaded.mediaId, url: null };
  const updateField = isTokenImage ? "token.image" : "avatar";
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    [updateField]: nextRef,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });

  return {
    mediaId: uploaded.mediaId,
    field: updateField,
    imageRef: nextRef
  };
}

export async function setCharacterImageUrl({
  firestoreDb = db,
  campaignId,
  charId,
  targetField = "avatar",
  url = null
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  const cleanUrl = trimString(url) || null;
  const isTokenImage = targetField === "token" || targetField === "token.image";
  const updateField = isTokenImage ? "token.image" : "avatar";
  const nextRef = { mediaId: null, url: cleanUrl };
  const validation = validateImageRef(nextRef, { fieldName: updateField });
  if (!validation.ok) {
    throw validation.errors[0];
  }
  const charRef = doc(firestoreDb, characterDocPath(campaignId, charId));
  await updateDoc(charRef, {
    [updateField]: nextRef,
    rev: increment(1),
    updatedAt: serverTimestamp()
  });
  return { field: updateField, imageRef: nextRef };
}

export function subscribeCharacters({
  campaignId,
  gmId = null,
  isRealGM = false,
  uid,
  firestoreDb = db,
  onData,
  onError
}) {
  if (!campaignId || !uid) return () => {};
  const charCol = collection(firestoreDb, charactersCollectionPath(campaignId));
  return subscribeVisibleCollection({
    colRef: charCol,
    isRealGM,
    uid,
    onNext: (snapshot) => {
      const list = [];
      for (const d of snapshot.docs) {
        const raw = d.data() || {};
        if (raw.isDeleted || raw.isFolder || raw.migratedToFoldersCollection) continue;
        list.push(
          fromCharacterDoc(raw, d.id, {
            campaignId,
            gmId: gmId || undefined
          })
        );
      }
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      onData?.(list);
    },
    onError: (err) => {
      onError?.(err);
    }
  });
}

export async function pullCompendiumEntry({
  firestoreDb = db,
  campaignId,
  charId,
  compendiumEntry,
  currentChar
}) {
  assertClientUpToDate();
  requireCampaignAndChar(campaignId, charId);
  if (!compendiumEntry || typeof compendiumEntry !== "object") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Item do compêndio é obrigatório."
    );
  }
  const existingKeys = [
    ...Object.keys(currentChar?.attributes || {}),
    ...Object.keys(currentChar?.skills || {}),
    ...RESERVED_FORMULA_KEYS
  ];
  const orderCount =
    compendiumEntry.type === "item"
      ? Object.keys(currentChar?.inventory || {}).length
      : compendiumEntry.type === "skill"
        ? Object.keys(currentChar?.skills || {}).length
        : Object.keys(currentChar?.abilities || {}).length;

  const mapped = mapCompendiumEntryToCharacterEntry(compendiumEntry, {
    createId,
    existingKeys,
    existingOrder: orderCount
  });

  return addEntry({
    firestoreDb,
    campaignId,
    charId,
    collectionName: mapped.collection,
    entry: {
      ...mapped.entry,
      allowFallbackAttribute: true
    },
    currentChar
  });
}

