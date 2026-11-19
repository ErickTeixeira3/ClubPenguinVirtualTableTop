import { assertAudience, computeAudience } from "../audience.js";
import {
  EFFECT_TYPES,
  HIT_EVALUATION_STATUS,
  MESSAGE_STATUS,
  MESSAGE_TYPES,
  MESSAGE_VISIBILITY,
  ROLL_KINDS
} from "../constants.js";
import {
  DEFAULT_COLORS,
  DEFAULT_NAMES,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultRange,
  createDefaultSavingThrow
} from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";
import {
  fromDoc as fromImageRefDoc,
  normalizeImageRef,
  toDoc as toImageRefDoc,
  validateImageRef
} from "./imageRef.js";

const VALID_MESSAGE_TYPES = new Set(Object.values(MESSAGE_TYPES));
const VALID_VISIBILITIES = new Set(Object.values(MESSAGE_VISIBILITY));
const VALID_STATUSES = new Set(Object.values(MESSAGE_STATUS));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_HIT_EVAL_STATUSES = new Set(Object.values(HIT_EVALUATION_STATUS));

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

const LEGACY_MESSAGE_KEYS = [
  "timestampMs",
  "rollData",
  "skillData",
  "senderId",
  "senderName",
  "senderPhotoURL",
  "senderAvatarMediaId",
  "characterId",
  "characterMediaId",
  "icon"
];

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanStringList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) {
        seen.add(clean);
      }
    }
  }
  return Array.from(seen);
}

function resolveNumberOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "number" ? value : Number(value);
}

function normalizeSender(rawSender) {
  const src = isPlainRecord(rawSender) ? rawSender : {};
  const displayName =
    src.displayName === undefined || src.displayName === null
      ? DEFAULT_NAMES.member
      : typeof src.displayName === "string"
        ? src.displayName.trim()
        : "";
  return {
    uid: trimOrEmpty(src.uid),
    characterId: trimOrNull(src.characterId),
    displayName,
    image: normalizeImageRef(src.image)
  };
}

function normalizeEmote(rawEmote) {
  if (!isPlainRecord(rawEmote)) {
    return null;
  }
  return {
    icon: trimOrEmpty(rawEmote.icon)
  };
}

function normalizeSkillPing(rawSkill) {
  if (!isPlainRecord(rawSkill)) {
    return null;
  }
  return {
    id: trimOrNull(rawSkill.id),
    name: typeof rawSkill.name === "string" ? rawSkill.name.trim() : "",
    elementColor:
      trimOrEmpty(rawSkill.elementColor) || DEFAULT_COLORS.abilityElement,
    icon: trimOrEmpty(rawSkill.icon) || "sword",
    cost: createDefaultAbilityCost(rawSkill.cost),
    hitFormula:
      typeof rawSkill.hitFormula === "string" ? rawSkill.hitFormula : "",
    effectFormula:
      typeof rawSkill.effectFormula === "string" ? rawSkill.effectFormula : "",
    trigger: trimOrEmpty(rawSkill.trigger) || "active",
    effectType: trimOrEmpty(rawSkill.effectType) || EFFECT_TYPES.DAMAGE,
    savingThrow: createDefaultSavingThrow(rawSkill.savingThrow),
    range: createDefaultRange(rawSkill.range),
    aoe: createDefaultAoe(rawSkill.aoe),
    attributeKey:
      trimOrEmpty(rawSkill.attributeKey ?? rawSkill.attribute) || "forca",
    bonus:
      typeof rawSkill.bonus === "number" && Number.isFinite(rawSkill.bonus)
        ? rawSkill.bonus
        : Number(rawSkill.bonus) || 0,
    description:
      typeof rawSkill.description === "string" ? rawSkill.description : ""
  };
}

function normalizeTarget(rawTarget) {
  const src = isPlainRecord(rawTarget) ? rawTarget : {};
  return {
    tokenId: trimOrNull(src.tokenId),
    sceneId: trimOrNull(src.sceneId),
    characterId: trimOrNull(src.characterId),
    label: trimOrEmpty(src.label ?? src.name) || DEFAULT_NAMES.target
  };
}

function normalizeHitResult(rawResult) {
  const src = isPlainRecord(rawResult) ? rawResult : {};
  return {
    tokenId: trimOrNull(src.tokenId),
    hit: Boolean(src.hit),
    crit: Boolean(src.crit),
    fumble: Boolean(src.fumble)
  };
}

function normalizeHitEvaluation(rawEval) {
  if (!isPlainRecord(rawEval)) {
    return {
      status: HIT_EVALUATION_STATUS.NONE,
      results: []
    };
  }
  return {
    status:
      rawEval.status === undefined || rawEval.status === null
        ? HIT_EVALUATION_STATUS.NONE
        : trimOrEmpty(rawEval.status),
    results: Array.isArray(rawEval.results)
      ? rawEval.results.map(normalizeHitResult)
      : []
  };
}

function normalizeSavingThrowRequest(rawReq) {
  if (!isPlainRecord(rawReq)) {
    return null;
  }
  const dcVal =
    rawReq.dc === undefined || rawReq.dc === null
      ? Number.NaN
      : typeof rawReq.dc === "number"
        ? rawReq.dc
        : Number(rawReq.dc);
  return {
    id: trimOrEmpty(rawReq.id),
    targetCharacterId: trimOrNull(rawReq.targetCharacterId),
    targetTokenId: trimOrNull(rawReq.targetTokenId),
    targetSceneId: trimOrNull(rawReq.targetSceneId),
    dc: dcVal,
    attributeKey: trimOrEmpty(rawReq.attributeKey ?? rawReq.attribute),
    effectDescription:
      typeof rawReq.effectDescription === "string"
        ? rawReq.effectDescription
        : "",
    sourceName: trimOrEmpty(rawReq.sourceName ?? rawReq.sourceRollName)
  };
}

function normalizeRespondsTo(rawResp) {
  if (!isPlainRecord(rawResp)) {
    return null;
  }
  return {
    messageId: trimOrEmpty(rawResp.messageId),
    saveId: trimOrEmpty(rawResp.saveId)
  };
}

function normalizeSecondary(rawSec) {
  if (!isPlainRecord(rawSec)) {
    return null;
  }
  return {
    formula: typeof rawSec.formula === "string" ? rawSec.formula : "",
    label: trimOrEmpty(rawSec.label) || "Dano",
    effectType:
      rawSec.effectType === undefined || rawSec.effectType === null
        ? EFFECT_TYPES.DAMAGE
        : trimOrEmpty(rawSec.effectType),
    deferred: Boolean(rawSec.deferred),
    rolled: Boolean(rawSec.rolled)
  };
}

function normalizeAppliedEffects(rawEffects) {
  if (!isPlainRecord(rawEffects)) {
    return {};
  }
  const map = {};
  for (const [opId, effect] of Object.entries(rawEffects)) {
    if (UNSAFE_KEYS.has(opId) || !isPlainRecord(effect)) {
      continue;
    }
    const cleanOpId = opId.trim();
    if (!cleanOpId || UNSAFE_KEYS.has(cleanOpId)) {
      continue;
    }
    map[cleanOpId] = {
      effectType: trimOrEmpty(effect.effectType) || EFFECT_TYPES.DAMAGE,
      scaleMode: trimOrEmpty(effect.scaleMode) || "full",
      finalValue: Number(effect.finalValue) || 0,
      targetTokenId: trimOrNull(effect.targetTokenId),
      targetLabel: trimOrEmpty(effect.targetLabel ?? effect.targetName),
      appliedBy: trimOrNull(effect.appliedBy),
      at: effect.at ?? null
    };
  }
  return map;
}

function normalizeRollPayload(rawRoll) {
  if (!isPlainRecord(rawRoll)) {
    return null;
  }
  const title =
    rawRoll.title === undefined || rawRoll.title === null
      ? DEFAULT_NAMES.roll
      : typeof rawRoll.title === "string"
        ? rawRoll.title.trim()
        : "";

  const normalizedTargets = Array.isArray(rawRoll.targets)
    ? rawRoll.targets.map((target) => {
        if (isPlainRecord(target) && Object.hasOwn(target, "defense")) {
          const base = normalizeTarget(target);
          base.defense = target.defense;
          return base;
        }
        return normalizeTarget(target);
      })
    : [];

  const normalizedHitEval = normalizeHitEvaluation(rawRoll.hitEvaluation);
  if (isPlainRecord(rawRoll.hitEvaluation)) {
    if (Object.hasOwn(rawRoll.hitEvaluation, "defense")) {
      normalizedHitEval.defense = rawRoll.hitEvaluation.defense;
    }
    if (Array.isArray(rawRoll.hitEvaluation.results)) {
      rawRoll.hitEvaluation.results.forEach((res, idx) => {
        if (isPlainRecord(res) && Object.hasOwn(res, "defense")) {
          normalizedHitEval.results[idx].defense = res.defense;
        }
      });
    }
  }

  return {
    kind:
      rawRoll.kind === undefined || rawRoll.kind === null
        ? ""
        : trimOrEmpty(rawRoll.kind),
    title,
    icon: trimOrNull(rawRoll.icon),
    color: trimOrEmpty(rawRoll.color) || DEFAULT_COLORS.customRoll,
    rolls: Array.isArray(rawRoll.rolls) ? rawRoll.rolls : [],
    costs: Array.isArray(rawRoll.costs) ? rawRoll.costs : [],
    targets: normalizedTargets,
    hitEvaluation: normalizedHitEval,
    savingThrowRequest: normalizeSavingThrowRequest(rawRoll.savingThrowRequest),
    respondsTo: normalizeRespondsTo(rawRoll.respondsTo),
    secondary: normalizeSecondary(rawRoll.secondary),
    allyCostOps: cleanStringList(rawRoll.allyCostOps),
    appliedEffects: normalizeAppliedEffects(rawRoll.appliedEffects)
  };
}

export function normalizeMessage(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id);
  const campaignId = trimOrNull(src.campaignId ?? ctx.campaignId);
  const type =
    src.type === undefined || src.type === null
      ? MESSAGE_TYPES.TEXT
      : trimOrEmpty(src.type);

  const seq = resolveNumberOrNull(src.seq ?? ctx.seq);

  const visibility =
    src.visibility === undefined || src.visibility === null
      ? MESSAGE_VISIBILITY.PUBLIC
      : trimOrEmpty(src.visibility);

  const sender = normalizeSender(src.sender);

  let visibleTo;
  if (src.visibleTo === undefined || src.visibleTo === null) {
    if (VALID_VISIBILITIES.has(visibility)) {
      visibleTo = computeAudience({
        visibility,
        gmId: ctx.gmId,
        senderUid: sender.uid
      }).visibleTo;
    } else {
      visibleTo = [];
    }
  } else {
    visibleTo = cleanStringList(src.visibleTo);
  }

  const status =
    src.status === undefined || src.status === null
      ? MESSAGE_STATUS.COMMITTED
      : trimOrEmpty(src.status);

  let opId = null;
  if (src.opId !== undefined && src.opId !== null) {
    opId = typeof src.opId === "string" ? trimOrNull(src.opId) : src.opId;
  }

  const deletedBy =
    src.deletedBy !== undefined && src.deletedBy !== null
      ? typeof src.deletedBy === "string"
        ? trimOrNull(src.deletedBy)
        : src.deletedBy
      : null;

  return {
    id,
    campaignId,
    type,
    seq,
    visibility,
    visibleTo,
    sender,
    status,
    opId,
    content: typeof src.content === "string" ? src.content : "",
    emote: normalizeEmote(src.emote),
    skillPing: normalizeSkillPing(src.skillPing),
    roll: normalizeRollPayload(src.roll),
    isDeleted: Boolean(src.isDeleted),
    deletedAt: src.deletedAt ?? null,
    deletedBy,
    createdAt: src.createdAt ?? null,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateMessage(message) {
  const errors = [];

  if (!isPlainRecord(message)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Message must be a non-null plain object.",
        { field: "message" }
      )
    ]);
  }

  if (!isTrimmedNonEmpty(message.campaignId)) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Message campaignId must be a trimmed non-empty string.",
        { field: "campaignId" }
      )
    );
  }

  if (!VALID_MESSAGE_TYPES.has(message.type)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Message type "${String(message.type)}" is invalid.`,
        { field: "type", value: message.type }
      )
    );
  }

  if (
    typeof message.seq !== "number" ||
    !Number.isInteger(message.seq) ||
    message.seq < 1
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "Message seq must be an integer >= 1.",
        { field: "seq", value: message.seq }
      )
    );
  }

  if (!VALID_VISIBILITIES.has(message.visibility)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Message visibility "${String(message.visibility)}" is invalid.`,
        { field: "visibility", value: message.visibility }
      )
    );
  }

  if (!isPlainRecord(message.sender)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Message sender must be a plain object.",
        { field: "sender" }
      )
    );
  } else {
    if (!isTrimmedNonEmpty(message.sender.uid)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Message sender.uid must be a trimmed non-empty string.",
          { field: "sender.uid" }
        )
      );
    }
    if (!isTrimmedNonEmpty(message.sender.displayName)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Message sender.displayName must be a trimmed non-empty string.",
          { field: "sender.displayName" }
        )
      );
    }
    if (
      message.sender.characterId !== null &&
      !isTrimmedNonEmpty(message.sender.characterId)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          "Message sender.characterId must be null or a trimmed non-empty string.",
          { field: "sender.characterId" }
        )
      );
    }
    const imgRes = validateImageRef(message.sender.image, {
      fieldName: "sender.image"
    });
    if (!imgRes.ok) {
      errors.push(...imgRes.errors);
    }
  }

  const audienceRes = assertAudience(message, {
    entityType: "message",
    senderUid: message.sender?.uid
  });
  if (!audienceRes.ok) {
    errors.push(...audienceRes.errors);
  }

  if (!VALID_STATUSES.has(message.status)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Message status "${String(message.status)}" is invalid.`,
        { field: "status", value: message.status }
      )
    );
  }

  if (message.opId !== null && !isTrimmedNonEmpty(message.opId)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Message opId must be null or a trimmed non-empty string.",
        { field: "opId" }
      )
    );
  } else if (
    message.status === MESSAGE_STATUS.PENDING &&
    !isTrimmedNonEmpty(message.opId)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Message opId is required when status is pending.",
        { field: "opId" }
      )
    );
  }

  if (message.type === MESSAGE_TYPES.TEXT) {
    if (!isTrimmedNonEmpty(message.content)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Text message requires non-empty content.",
          { field: "content" }
        )
      );
    }
  } else if (message.type === MESSAGE_TYPES.EMOTE) {
    if (!isPlainRecord(message.emote) || !isTrimmedNonEmpty(message.emote.icon)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Emote message requires emote.icon.",
          { field: "emote.icon" }
        )
      );
    }
  } else if (message.type === MESSAGE_TYPES.SKILL_PING) {
    if (
      !isPlainRecord(message.skillPing) ||
      !isTrimmedNonEmpty(message.skillPing.name)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Skill ping message requires skillPing.name.",
          { field: "skillPing.name" }
        )
      );
    }
  } else if (message.type === MESSAGE_TYPES.ROLL) {
    if (!isPlainRecord(message.roll)) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "Roll message requires roll payload.",
          { field: "roll" }
        )
      );
    } else {
      const r = message.roll;
      if (!VALID_ROLL_KINDS.has(r.kind)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_ENUM_VALUE,
            `Roll kind "${String(r.kind)}" is invalid.`,
            { field: "roll.kind", value: r.kind }
          )
        );
      }
      if (!isTrimmedNonEmpty(r.title)) {
        errors.push(
          new AppError(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            "Roll title must be a trimmed non-empty string.",
            { field: "roll.title" }
          )
        );
      }
      for (const arrField of ["rolls", "costs", "targets", "allyCostOps"]) {
        if (!Array.isArray(r[arrField])) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              `roll.${arrField} must be an array.`,
              { field: `roll.${arrField}` }
            )
          );
        }
      }
      if (Array.isArray(r.targets)) {
        r.targets.forEach((target, idx) => {
          if (isPlainRecord(target) && Object.hasOwn(target, "defense")) {
            errors.push(
              new AppError(
                ERROR_CODES.VALIDATION_FAILED,
                "roll.targets must not expose defense.",
                { field: `roll.targets[${idx}].defense` }
              )
            );
          }
        });
      }
      if (!isPlainRecord(r.hitEvaluation)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "roll.hitEvaluation must be a plain object.",
            { field: "roll.hitEvaluation" }
          )
        );
      } else {
        if (Object.hasOwn(r.hitEvaluation, "defense")) {
          errors.push(
            new AppError(
              ERROR_CODES.VALIDATION_FAILED,
              "roll.hitEvaluation must not expose defense.",
              { field: "roll.hitEvaluation.defense" }
            )
          );
        }
        if (!VALID_HIT_EVAL_STATUSES.has(r.hitEvaluation.status)) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_ENUM_VALUE,
              `roll.hitEvaluation.status "${String(r.hitEvaluation.status)}" is invalid.`,
              { field: "roll.hitEvaluation.status" }
            )
          );
        }
        if (!Array.isArray(r.hitEvaluation.results)) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              "roll.hitEvaluation.results must be an array.",
              { field: "roll.hitEvaluation.results" }
            )
          );
        } else {
          r.hitEvaluation.results.forEach((entry, idx) => {
            if (isPlainRecord(entry) && Object.hasOwn(entry, "defense")) {
              errors.push(
                new AppError(
                  ERROR_CODES.VALIDATION_FAILED,
                  "roll.hitEvaluation.results must not expose defense.",
                  { field: `roll.hitEvaluation.results[${idx}].defense` }
                )
              );
            }
          });
        }
      }
      if (r.savingThrowRequest !== null && r.savingThrowRequest !== undefined) {
        if (!isPlainRecord(r.savingThrowRequest)) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              "roll.savingThrowRequest must be null or a plain object.",
              { field: "roll.savingThrowRequest" }
            )
          );
        } else {
          if (!isTrimmedNonEmpty(r.savingThrowRequest.id)) {
            errors.push(
              new AppError(
                ERROR_CODES.MISSING_REQUIRED_FIELD,
                "roll.savingThrowRequest.id is required.",
                { field: "roll.savingThrowRequest.id" }
              )
            );
          }
          if (!isTrimmedNonEmpty(r.savingThrowRequest.attributeKey)) {
            errors.push(
              new AppError(
                ERROR_CODES.MISSING_REQUIRED_FIELD,
                "roll.savingThrowRequest.attributeKey is required.",
                { field: "roll.savingThrowRequest.attributeKey" }
              )
            );
          }
          if (
            typeof r.savingThrowRequest.dc !== "number" ||
            !Number.isFinite(r.savingThrowRequest.dc)
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                "roll.savingThrowRequest.dc must be a finite number (0 allowed).",
                { field: "roll.savingThrowRequest.dc" }
              )
            );
          }
        }
      }
      if (r.respondsTo !== null && r.respondsTo !== undefined) {
        if (
          !isPlainRecord(r.respondsTo) ||
          !isTrimmedNonEmpty(r.respondsTo.messageId) ||
          !isTrimmedNonEmpty(r.respondsTo.saveId)
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.MISSING_REQUIRED_FIELD,
              "roll.respondsTo requires non-empty messageId and saveId.",
              { field: "roll.respondsTo" }
            )
          );
        }
      }
      if (r.secondary !== null && r.secondary !== undefined) {
        if (!isPlainRecord(r.secondary)) {
          errors.push(
            new AppError(
              ERROR_CODES.INVALID_TYPE,
              "roll.secondary must be null or a plain object.",
              { field: "roll.secondary" }
            )
          );
        } else {
          if (typeof r.secondary.formula !== "string") {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                "roll.secondary.formula must be a string.",
                { field: "roll.secondary.formula" }
              )
            );
          }
          if (!VALID_EFFECT_TYPES.has(r.secondary.effectType)) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_ENUM_VALUE,
                `roll.secondary.effectType "${String(r.secondary.effectType)}" is invalid.`,
                { field: "roll.secondary.effectType" }
              )
            );
          }
          if (
            typeof r.secondary.deferred !== "boolean" ||
            typeof r.secondary.rolled !== "boolean"
          ) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                "roll.secondary deferred and rolled must be booleans.",
                { field: "roll.secondary" }
              )
            );
          }
        }
      }
      if (!isPlainRecord(r.appliedEffects)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            "roll.appliedEffects must be a plain object map.",
            { field: "roll.appliedEffects" }
          )
        );
      } else {
        for (const key of Object.keys(r.appliedEffects)) {
          if (UNSAFE_KEYS.has(key)) {
            errors.push(
              new AppError(
                ERROR_CODES.INVALID_TYPE,
                "roll.appliedEffects contains an unsafe key.",
                { field: "roll.appliedEffects", key }
              )
            );
          }
        }
      }
    }
  }

  if (typeof message.isDeleted !== "boolean") {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "Message isDeleted must be a boolean.",
        { field: "isDeleted" }
      )
    );
  }

  for (const legacyKey of LEGACY_MESSAGE_KEYS) {
    if (Object.hasOwn(message, legacyKey)) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Legacy message field "${legacyKey}" is not allowed in v2.`,
          { field: legacyKey }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

function convertLegacyRollData(src, rawRollData) {
  if (!isPlainRecord(rawRollData)) {
    return null;
  }
  const targetInfo = isPlainRecord(rawRollData.targetInfo)
    ? rawRollData.targetInfo
    : null;
  let targets = Array.isArray(rawRollData.targets)
    ? rawRollData.targets.map(normalizeTarget)
    : [];
  if (targets.length === 0 && targetInfo) {
    if (Array.isArray(targetInfo.targets)) {
      targets = targetInfo.targets.map(normalizeTarget);
    } else if (targetInfo.tokenId) {
      targets = [normalizeTarget(targetInfo)];
    }
  }

  let hitEvaluation = rawRollData.hitEvaluation;
  if (!isPlainRecord(hitEvaluation)) {
    if (targetInfo && targetInfo.isAttackRoll && typeof targetInfo.isHit === "boolean") {
      const results = targets.map((t) => ({
        tokenId: t.tokenId,
        hit: Boolean(targetInfo.isHit),
        crit: Boolean(targetInfo.isCrit),
        fumble: Boolean(targetInfo.isFumble)
      }));
      hitEvaluation = {
        status: HIT_EVALUATION_STATUS.DONE,
        results
      };
    } else {
      hitEvaluation = {
        status: HIT_EVALUATION_STATUS.NONE,
        results: []
      };
    }
  }

  const rolls = Array.isArray(rawRollData.rolls)
    ? rawRollData.rolls
    : rawRollData.primary
      ? [rawRollData.primary]
      : [];

  const costs = Array.isArray(rawRollData.costs)
    ? rawRollData.costs
    : isPlainRecord(rawRollData.costPaid)
      ? [
          {
            resource: String(rawRollData.costPaid.resource || "mp").toLowerCase(),
            amount: Number(rawRollData.costPaid.amount) || 0
          }
        ]
      : [];

  let respondsTo = rawRollData.respondsTo ?? null;
  if (!respondsTo && rawRollData.parentMessageId && rawRollData.respondedToSaveId) {
    respondsTo = {
      messageId: rawRollData.parentMessageId,
      saveId: rawRollData.respondedToSaveId
    };
  }

  let secondary = rawRollData.secondary ?? null;
  if (!secondary && isPlainRecord(rawRollData.damageConfig)) {
    secondary = {
      formula: rawRollData.damageConfig.formula || "",
      label: rawRollData.damageConfig.label || "Dano",
      effectType: rawRollData.damageConfig.effectType || EFFECT_TYPES.DAMAGE,
      deferred: true,
      rolled: false
    };
  }

  let appliedEffects = rawRollData.appliedEffects;
  if (Array.isArray(appliedEffects)) {
    const converted = {};
    appliedEffects.forEach((eff, idx) => {
      if (!isPlainRecord(eff)) {
        return;
      }
      const key =
        typeof eff.opId === "string" && eff.opId.trim()
          ? eff.opId.trim()
          : `legacy_${idx}`;
      if (!UNSAFE_KEYS.has(key)) {
        converted[key] = eff;
      }
    });
    appliedEffects = converted;
  }

  return {
    kind: rawRollData.kind ?? rawRollData.rollKind ?? ROLL_KINDS.CHECK,
    title: rawRollData.title,
    icon: rawRollData.icon ?? src.icon ?? null,
    color: rawRollData.color ?? rawRollData.categoryColor,
    rolls,
    costs,
    targets,
    hitEvaluation,
    savingThrowRequest: rawRollData.savingThrowRequest ?? null,
    respondsTo,
    secondary,
    allyCostOps: rawRollData.allyCostOps ?? [],
    appliedEffects: appliedEffects ?? {}
  };
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};

  const type = src.type === "ability_roll" ? MESSAGE_TYPES.ROLL : src.type;

  let sender = src.sender;
  if (!isPlainRecord(sender)) {
    const charId = trimOrNull(src.characterId);
    const mediaId = charId
      ? src.characterMediaId || src.senderAvatarMediaId
      : src.senderAvatarMediaId || src.characterMediaId;
    sender = {
      uid: src.senderId ?? "",
      characterId: charId,
      displayName: src.senderName ?? DEFAULT_NAMES.member,
      image: fromImageRefDoc({
        mediaId,
        url: src.senderPhotoURL
      })
    };
  } else {
    sender = {
      ...sender,
      image: fromImageRefDoc(sender.image)
    };
  }

  const emote =
    src.emote ??
    (type === MESSAGE_TYPES.EMOTE && src.icon ? { icon: src.icon } : null);

  const skillPing = src.skillPing ?? src.skillData ?? null;
  const roll = isPlainRecord(src.roll)
    ? convertLegacyRollData(src, src.roll)
    : isPlainRecord(src.rollData)
      ? convertLegacyRollData(src, src.rollData)
      : null;

  return normalizeMessage(
    {
      ...src,
      type,
      sender,
      emote,
      skillPing,
      roll,
      createdAt: src.createdAt ?? src.timestampMs ?? null
    },
    { ...ctx, id: id ?? ctx.id ?? src.id ?? null }
  );
}

export function toDoc(message) {
  const normalized = normalizeMessage(message);

  let rollDoc = null;
  if (normalized.roll !== null) {
    const r = normalized.roll;
    rollDoc = {
      kind: r.kind,
      title: r.title,
      icon: r.icon,
      color: r.color,
      rolls: r.rolls,
      costs: r.costs,
      targets: r.targets.map(normalizeTarget),
      hitEvaluation: normalizeHitEvaluation(r.hitEvaluation),
      savingThrowRequest: r.savingThrowRequest,
      respondsTo: r.respondsTo,
      secondary: r.secondary,
      allyCostOps: r.allyCostOps,
      appliedEffects: r.appliedEffects
    };
  }

  const payload = {
    campaignId: normalized.campaignId,
    type: normalized.type,
    seq: normalized.seq,
    visibility: normalized.visibility,
    visibleTo: normalized.visibleTo,
    sender: {
      uid: normalized.sender.uid,
      characterId: normalized.sender.characterId,
      displayName: normalized.sender.displayName,
      image: toImageRefDoc(normalized.sender.image)
    },
    status: normalized.status,
    opId: normalized.opId,
    content: normalized.content,
    isDeleted: normalized.isDeleted,
    deletedAt: normalized.deletedAt,
    deletedBy: normalized.deletedBy,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };

  if (normalized.emote !== null) {
    payload.emote = normalized.emote;
  }
  if (normalized.skillPing !== null) {
    payload.skillPing = normalized.skillPing;
  }
  if (rollDoc !== null) {
    payload.roll = rollDoc;
  }

  return payload;
}

export { toDoc as toMessageDoc, fromDoc as fromMessageDoc };
