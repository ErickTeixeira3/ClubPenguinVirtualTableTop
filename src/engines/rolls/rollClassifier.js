import { EFFECT_TYPES, ROLL_KINDS } from "../../domain/constants.js";

const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));

export function effectRollKind(effectType) {
  switch (effectType) {
    case EFFECT_TYPES.HEAL:
      return ROLL_KINDS.HEAL;
    case EFFECT_TYPES.MP_HEAL:
      return ROLL_KINDS.MP_HEAL;
    case EFFECT_TYPES.MP_DAMAGE:
      return ROLL_KINDS.MP_DAMAGE;
    case EFFECT_TYPES.UTILITY:
      return ROLL_KINDS.UTILITY;
    default:
      return ROLL_KINDS.DAMAGE;
  }
}

export function inferAbilityRollKind(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const hasHit = Boolean(String(src.hitFormula ?? "").trim());
  const hasEffect = Boolean(String(src.effectFormula ?? "").trim());

  if (Boolean(src.isSkill) && !hasEffect) {
    return ROLL_KINDS.CHECK;
  }
  if (hasHit) {
    return ROLL_KINDS.ATTACK;
  }
  if (hasEffect) {
    return effectRollKind(src.effectType ?? null);
  }
  return ROLL_KINDS.CHECK;
}

export function classifyRollKind(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const deferSecondaryDamage = src.deferSecondaryDamage !== false;

  if (src.rollKind && VALID_ROLL_KINDS.has(src.rollKind)) {
    return src.rollKind;
  }

  const hasPrimary = Boolean(String(src.primaryFormula ?? "").trim());
  const hasSecondary = Boolean(String(src.secondaryFormula ?? "").trim());

  if (deferSecondaryDamage && hasPrimary && hasSecondary) {
    return ROLL_KINDS.ATTACK;
  }

  if (src.effectType && VALID_EFFECT_TYPES.has(src.effectType)) {
    return effectRollKind(src.effectType);
  }

  return ROLL_KINDS.CHECK;
}

export function isAttackRollMessage(messageOrData = null) {
  if (!messageOrData || typeof messageOrData !== "object") {
    return false;
  }

  const roll =
    messageOrData.roll && typeof messageOrData.roll === "object"
      ? messageOrData.roll
      : messageOrData.rollData && typeof messageOrData.rollData === "object"
        ? messageOrData.rollData
        : messageOrData;

  const explicitKind = roll.kind ?? roll.rollKind ?? null;
  if (explicitKind && VALID_ROLL_KINDS.has(explicitKind)) {
    return explicitKind === ROLL_KINDS.ATTACK;
  }

  if (
    Boolean(roll.parentMessageId && !roll.savingThrowOutcome) ||
    Boolean(roll.respondsTo)
  ) {
    return false;
  }

  if (
    Boolean(roll.secondary?.deferred) ||
    Boolean(
      roll.hitEvaluation &&
        roll.hitEvaluation.status &&
        roll.hitEvaluation.status !== "none"
    ) ||
    Boolean(roll.damageConfig) ||
    Boolean(roll.targetInfo?.isAttackRoll)
  ) {
    return true;
  }

  return false;
}
