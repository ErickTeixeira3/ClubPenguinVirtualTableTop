import {
  CHARACTER_TYPES,
  HIT_EVALUATION_STATUS,
  TOKEN_KINDS
} from "../../domain/constants.js";
import {
  DEFAULT_CHARACTER_DEFENSE,
  DEFAULT_FREE_TOKEN_DEFENSE,
  DEFAULT_NAMES
} from "../../domain/defaults.js";
import { canSeeSecret } from "../../domain/permissions.js";

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

function hasFiniteNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value.trim()));
  }
  return false;
}

function parseFinite(value, fallback) {
  if (!hasFiniteNumber(value)) {
    return fallback;
  }
  return typeof value === "string" ? Number(value.trim()) : value;
}

function findCharacterById(allCharacters, characterId) {
  if (typeof characterId !== "string" || !characterId.trim()) {
    return null;
  }
  const cleanId = characterId.trim();
  if (Array.isArray(allCharacters)) {
    return allCharacters.find((c) => c && c.id === cleanId) || null;
  }
  if (allCharacters && typeof allCharacters === "object") {
    if (UNSAFE_KEYS.has(cleanId) || !Object.hasOwn(allCharacters, cleanId)) {
      return null;
    }
    return allCharacters[cleanId] || null;
  }
  return null;
}

function getSecretForToken(tokenSecretsById, token) {
  if (
    !tokenSecretsById ||
    typeof tokenSecretsById !== "object" ||
    Array.isArray(tokenSecretsById)
  ) {
    return null;
  }
  const tokenId = token?.id || token?.tokenId;
  if (typeof tokenId !== "string" || !tokenId || UNSAFE_KEYS.has(tokenId)) {
    return null;
  }
  return Object.hasOwn(tokenSecretsById, tokenId)
    ? tokenSecretsById[tokenId] ?? null
    : null;
}

export function resolveTokenTargetData(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const targetedToken = src.targetedToken;
  if (!targetedToken || typeof targetedToken !== "object") {
    return null;
  }

  const tokenSecret =
    src.tokenSecret && typeof src.tokenSecret === "object"
      ? src.tokenSecret
      : null;
  const allCharacters = src.allCharacters ?? [];
  const sceneId = src.sceneId ?? null;

  const linkedChar = findCharacterById(
    allCharacters,
    targetedToken.characterId
  );

  const kind =
    targetedToken.kind ||
    (linkedChar?.type === CHARACTER_TYPES.PC ||
    targetedToken.characterType === CHARACTER_TYPES.PC
      ? TOKEN_KINDS.PC
      : targetedToken.characterId
        ? TOKEN_KINDS.NPC
        : TOKEN_KINDS.FREE);

  const isPc = kind === TOKEN_KINDS.PC;

  let defense = null;
  if (isPc) {
    if (linkedChar) {
      defense = parseFinite(linkedChar.defense, DEFAULT_CHARACTER_DEFENSE);
    }
  } else if (tokenSecret) {
    const fallbackDef = linkedChar
      ? parseFinite(linkedChar.defense, DEFAULT_FREE_TOKEN_DEFENSE)
      : DEFAULT_FREE_TOKEN_DEFENSE;
    defense = parseFinite(tokenSecret.defense, fallbackDef);
  } else if (hasFiniteNumber(targetedToken.defense)) {
    defense = parseFinite(targetedToken.defense, null);
  }

  const label = isPc
    ? linkedChar?.name ||
      targetedToken.label ||
      targetedToken.name ||
      DEFAULT_NAMES.target
    : targetedToken.label ||
      targetedToken.name ||
      linkedChar?.name ||
      DEFAULT_NAMES.target;

  const image = isPc
    ? (linkedChar?.avatar ?? targetedToken.image ?? null)
    : (targetedToken.image ?? linkedChar?.avatar ?? null);

  return {
    tokenId: targetedToken.id || targetedToken.tokenId || null,
    sceneId: targetedToken.sceneId || sceneId || null,
    kind,
    characterType: isPc ? CHARACTER_TYPES.PC : CHARACTER_TYPES.NPC,
    characterId: linkedChar?.id || targetedToken.characterId || null,
    label,
    image,
    defense,
    linkedCharacter: linkedChar,
    tokenSecret
  };
}

function evaluateTargets(
  tokenList,
  {
    tokenSecretsById,
    allCharacters,
    sceneId,
    actorUid,
    isGM,
    attackTotal,
    isCrit,
    isFumble
  }
) {
  const pairs = tokenList.map((tok) => {
    const tokenSecret = getSecretForToken(tokenSecretsById, tok);
    const resolved = resolveTokenTargetData({
      targetedToken: tok,
      tokenSecret,
      allCharacters,
      sceneId
    });
    return { tok, resolved };
  });

  const hasAttackTotal =
    attackTotal !== null &&
    attackTotal !== undefined &&
    hasFiniteNumber(attackTotal);
  const numericAttackTotal = hasAttackTotal ? parseFinite(attackTotal, 0) : 0;

  const allEvaluated =
    hasAttackTotal &&
    pairs.every(
      ({ tok, resolved }) =>
        resolved.defense !== null &&
        Number.isFinite(resolved.defense) &&
        canSeeSecret(tok, resolved.linkedCharacter, { uid: actorUid, isGM })
    );

  const hitEvaluation = allEvaluated
    ? {
        status: HIT_EVALUATION_STATUS.DONE,
        results: pairs.map(({ resolved }) => ({
          tokenId: resolved.tokenId,
          hit: numericAttackTotal >= Number(resolved.defense),
          crit: Boolean(isCrit),
          fumble: Boolean(isFumble)
        }))
      }
    : {
        status: HIT_EVALUATION_STATUS.PENDING,
        results: []
      };

  return { pairs, hitEvaluation };
}

export function buildTargetInfo(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const targetedToken = src.targetedToken ?? null;
  const targetedTokens = Array.isArray(src.targetedTokens)
    ? src.targetedTokens
    : [];
  const rawList =
    targetedTokens.length > 0
      ? targetedTokens
      : targetedToken
        ? [targetedToken]
        : [];
  const tokenList = rawList.filter((t) => t && typeof t === "object");

  if (tokenList.length === 0) {
    return null;
  }

  const isAttackRoll = Boolean(src.isAttackRoll);

  if (!isAttackRoll) {
    const targets = tokenList.map((tok) => {
      const tokenSecret = getSecretForToken(src.tokenSecretsById, tok);
      const resolved = resolveTokenTargetData({
        targetedToken: tok,
        tokenSecret,
        allCharacters: src.allCharacters ?? [],
        sceneId: src.sceneId ?? null
      });
      return {
        tokenId: resolved.tokenId,
        sceneId: resolved.sceneId,
        characterId: resolved.characterId,
        label: resolved.label
      };
    });
    return {
      targets,
      hitEvaluation: {
        status: HIT_EVALUATION_STATUS.NONE,
        results: []
      },
      targetCount: targets.length,
      isAttackRoll: false
    };
  }

  const { pairs, hitEvaluation } = evaluateTargets(tokenList, {
    tokenSecretsById: src.tokenSecretsById ?? null,
    allCharacters: src.allCharacters ?? [],
    sceneId: src.sceneId ?? null,
    actorUid: src.actorUid ?? null,
    isGM: Boolean(src.isGM),
    attackTotal: src.attackTotal ?? null,
    isCrit: Boolean(src.isCrit),
    isFumble: Boolean(src.isFumble)
  });

  const targets = pairs.map(({ resolved }) => ({
    tokenId: resolved.tokenId,
    sceneId: resolved.sceneId,
    characterId: resolved.characterId,
    label: resolved.label
  }));

  return {
    targets,
    hitEvaluation,
    targetCount: targets.length,
    isAttackRoll: true
  };
}

export function evaluatePendingHitEvaluation(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const tokenList = Array.isArray(src.targetedTokens)
    ? src.targetedTokens.filter((t) => t && typeof t === "object")
    : [];

  if (tokenList.length === 0) {
    return {
      status: HIT_EVALUATION_STATUS.PENDING,
      results: []
    };
  }

  const { hitEvaluation } = evaluateTargets(tokenList, {
    tokenSecretsById: src.tokenSecretsById ?? null,
    allCharacters: src.allCharacters ?? [],
    sceneId: src.sceneId ?? null,
    actorUid: src.actorUid ?? null,
    isGM: src.isGM !== undefined ? Boolean(src.isGM) : true,
    attackTotal: src.attackTotal ?? null,
    isCrit: Boolean(src.isCrit),
    isFumble: Boolean(src.isFumble)
  });

  return hitEvaluation;
}
