import { FieldValue } from "firebase-admin/firestore";
import {
  CHARACTER_TYPES,
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  ID_PREFIXES,
  RESERVED_FORMULA_KEYS,
  ROLL_KINDS,
  ROLL_SOURCE_TYPES,
  SAVE_ATTRIBUTES,
  TRIGGER_TYPES
} from "../../src/domain/constants.js";
import {
  DEFAULT_COLORS,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultRange,
  createDefaultRollGroup
} from "../../src/domain/defaults.js";
import {
  fromCharacterDoc,
  toCharacterDoc,
  validateCharacter
} from "../../src/domain/models/character.js";
import {
  LEGACY_COMPENDIUM_KEYS as MODEL_LEGACY_COMPENDIUM_KEYS,
  fromCompendiumEntryDoc,
  toCompendiumEntryDoc,
  validateCompendiumEntry
} from "../../src/domain/models/compendiumEntry.js";
import {
  normalizeSkillKey,
  resolveUniqueSkillKey
} from "../../src/engines/compendium/compendiumMapper.js";
import { inferAbilityRollKind } from "../../src/engines/rolls/rollClassifier.js";

const LEGACY_CHARACTER_KEYS = [
  "id",
  "avatarMediaId",
  "avatarExternalUrl",
  "defaultToken",
  "visibleToPlayers",
  "scope",
  "isFolder",
  "migratedToFoldersCollection"
];

const LEGACY_COMPENDIUM_KEYS = [
  "id",
  "formula",
  "distanceMeters",
  ...MODEL_LEGACY_COMPENDIUM_KEYS
];

const RESERVED_FORMULA_KEY_SET = new Set(RESERVED_FORMULA_KEYS);
const UNSAFE_SKILL_KEYS = new Set([
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

const VALID_SAVE_ATTRS = new Set(SAVE_ATTRIBUTES.map((a) => a.id));
const VALID_EFFECT_TYPES = new Set(Object.values(EFFECT_TYPES));
const VALID_TRIGGER_TYPES = new Set(Object.values(TRIGGER_TYPES));
const VALID_ROLL_KINDS = new Set(Object.values(ROLL_KINDS));
const VALID_COMP_TYPES = new Set(Object.values(COMPENDIUM_TYPES));

const KNOWN_FLASH_ICON_IDS = new Set([
  "smile", "grin", "neutral", "sad", "wink", "surprised", "tongue", "sick", "angry",
  "worried", "skeptical", "cool_sunglasses", "freezing", "unibrow", "nerd", "cute_eyes",
  "clown", "8bit_smile", "penguin_woohoo", "sword", "wooden_sword", "dagger", "bow",
  "axe", "battle_axe", "prehistoric_club", "prehistoric_hammer", "bomb", "snowball",
  "pow_explosion", "shield", "skate_helmet", "ninja_headband", "crown", "queen_crown",
  "princess_crown", "cape", "wand", "shooting_star", "prehistoric_clock", "potion_red",
  "potion_blue", "potion_magic", "firegem", "watergem", "snowgem", "pizza", "cheese",
  "meat", "soup", "popcorn", "chopsticks", "fortune_cookie", "cake", "ice_cream",
  "ice_cream_chocolate", "cookie", "candy", "apple", "oberry", "prehistoric_oberry",
  "coffee", "teapot", "fluffy_fish", "blue_puffle", "rainbow_puffle", "cat_yarn",
  "dog_bone", "paw_print", "ghost", "bat", "pumpkin", "ogre", "vampire",
  "cyclops_monster", "pirate", "coin", "money_bag", "treasure_chest", "key", "pickaxe",
  "magnifier", "ruby", "diamond_ring", "campfire", "camera", "gift", "beach_ball",
  "surfboard", "fishing_rod", "whistle", "red_card", "yellow_card", "foam_finger",
  "joystick", "movie_clapper", "music_note", "music_notes", "spy_phone", "epf_badge",
  "epf_sunglasses", "police_badge", "police_siren", "alert_beacon", "heart", "flower",
  "clover", "sun", "moon", "rainbow", "igloo", "lightbulb", "exclamation", "question"
]);

const ONE_TIME_ICON_ALIASES = {
  emote_grin: "grin",
  emote_smile: "smile",
  emote_neutral: "neutral",
  emote_sad: "sad",
  emote_wink: "wink",
  emote_surprised: "surprised",
  emote_tongue: "tongue",
  emote_sick: "sick",
  emote_angry: "angry",
  emote_worried: "worried",
  emote_skeptical: "skeptical",
  helmet: "skate_helmet",
  spyphone: "spy_phone",
  coroa_do_rei: "crown",
  coroa_da_rainha: "queen_crown",
  coroa_da_princesa: "princess_crown",
  vara_de_pescar: "fishing_rod",
  anel: "diamond_ring",
  gem: "diamond_ring",
  potion_green: "potion_magic",
  potion_purple: "potion_magic",
  fish: "fluffy_fish",
  peixe: "fluffy_fish",
  inv_peixe: "fluffy_fish",
  "peixe fresco": "fluffy_fish",
  icecream: "ice_cream",
  tea: "teapot"
};

const ONE_TIME_KEYWORD_RULES = [
  { id: "firegem", keywords: [["fogo", "gema"]] },
  { id: "watergem", keywords: ["agua", ["água", "gema"]] },
  { id: "snowgem", keywords: [["neve", "gema"]] },
  { id: "red_card", keywords: [["vermelho", "cartao"]] },
  { id: "yellow_card", keywords: [["amarelo", "cartao"]] },
  { id: "queen_crown", keywords: ["rainha"] },
  { id: "princess_crown", keywords: ["princesa", "tiara"] },
  { id: "rainbow", keywords: ["arco-iris", "arco-íris", "rainbow"] },
  { id: "fluffy_fish", keywords: ["peixe", "fluffy", "fish"] },
  { id: "ice_cream_chocolate", keywords: ["chocolate"] },
  { id: "axe", keywords: ["machado", "axe"] },
  { id: "bow", keywords: ["arco", "flecha", "bow"] },
  { id: "dagger", keywords: ["kunai", "adaga", "dagger"] },
  { id: "bomb", keywords: ["bomba", "bomb"] },
  { id: "snowball", keywords: ["neve", "gelo", "snowball"] },
  { id: "shield", keywords: ["escudo", "protecao", "shield"] },
  { id: "skate_helmet", keywords: ["capacete", "helmet"] },
  { id: "ninja_headband", keywords: ["faixa", "ninja", "headband"] },
  { id: "crown", keywords: ["coroa", "crown", "rei"] },
  { id: "cape", keywords: ["capa", "cape", "manto"] },
  { id: "wand", keywords: ["varinha", "cajado", "wand"] },
  { id: "shooting_star", keywords: ["estrela", "star"] },
  { id: "prehistoric_clock", keywords: ["relogio", "relógio", "clock"] },
  { id: "potion_red", keywords: ["cura", "vida", "pot_red"] },
  { id: "potion_blue", keywords: ["mana", "energia", "pot_blue"] },
  { id: "potion_magic", keywords: ["pocao", "poção", "alquimia", "mistica", "mística", "arcano", "pot_magic"] },
  { id: "pizza", keywords: ["pizza"] },
  { id: "cheese", keywords: ["queijo", "cheese"] },
  { id: "meat", keywords: ["carne", "meat"] },
  { id: "soup", keywords: ["sopa", "soup"] },
  { id: "apple", keywords: ["maca", "maçã", "apple"] },
  { id: "coffee", keywords: ["cafe", "café", "caneca"] },
  { id: "teapot", keywords: ["cha", "chá", "bule", "teapot", "tea"] },
  { id: "coin", keywords: ["moeda", "coin", "ouro"] },
  { id: "treasure_chest", keywords: ["bau", "baú", "chest"] },
  { id: "key", keywords: ["chave", "key"] },
  { id: "pickaxe", keywords: ["picareta", "mina", "pickaxe"] },
  { id: "magnifier", keywords: ["lupa", "detetive", "investig", "magnifier"] },
  { id: "ruby", keywords: ["rubi", "ruby"] },
  { id: "diamond_ring", keywords: ["anel", "ring", "diamante", "esmeralda", "gem"] },
  { id: "campfire", keywords: ["fogueira", "fogo", "campfire"] },
  { id: "fishing_rod", keywords: ["pesca", "vara", "fishing"] },
  { id: "heart", keywords: ["coracao", "coração", "heart"] },
  { id: "flower", keywords: ["flor", "flower"] },
  { id: "clover", keywords: ["trevo", "clover"] },
  { id: "sun", keywords: ["sol", "sun"] },
  { id: "moon", keywords: ["lua", "moon"] },
  { id: "sword", keywords: ["espada", "sword", "arma"] }
];

function trimOrEmpty(v) {
  return typeof v === "string" ? v.trim() : "";
}

function isPlainRecord(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function stableEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  if (typeof a.toMillis === "function" && typeof b.toMillis === "function") {
    return a.toMillis() === b.toMillis();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, idx) => stableEquals(v, b[idx]));
  }
  const keysA = Object.keys(a).filter((k) => a[k] !== undefined).sort();
  const keysB = Object.keys(b).filter((k) => b[k] !== undefined).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k, idx) => k === keysB[idx] && stableEquals(a[k], b[k]));
}

function resolveOneTimeIcon(existingIcon, fallbackName, defaultIcon = "sword") {
  const rawIcon = trimOrEmpty(existingIcon);
  if (rawIcon) {
    if (KNOWN_FLASH_ICON_IDS.has(rawIcon)) {
      return { icon: rawIcon, assigned: false };
    }
    const lower = rawIcon.toLowerCase();
    if (ONE_TIME_ICON_ALIASES[lower]) {
      return { icon: ONE_TIME_ICON_ALIASES[lower], assigned: true };
    }
    if (KNOWN_FLASH_ICON_IDS.has(lower)) {
      return { icon: lower, assigned: true };
    }
  }

  const haystack = trimOrEmpty(fallbackName).toLowerCase();
  if (haystack) {
    for (const rule of ONE_TIME_KEYWORD_RULES) {
      const matched = rule.keywords.some((kw) =>
        Array.isArray(kw) ? kw.every((part) => haystack.includes(part)) : haystack.includes(kw)
      );
      if (matched) {
        return { icon: rule.id, assigned: true };
      }
    }
  }

  return { icon: defaultIcon, assigned: !rawIcon || !KNOWN_FLASH_ICON_IDS.has(rawIcon) };
}

function migrateSavingThrow(rawEntry) {
  const rawSave = isPlainRecord(rawEntry?.savingThrow) ? rawEntry.savingThrow : {};
  const enabled = Boolean(
    rawEntry?.savingThrow !== undefined ? rawSave.enabled : rawEntry?.saveEnabled
  );
  const dcFormula =
    trimOrEmpty(
      rawSave.dcFormula ?? rawEntry?.saveDc ?? "12"
    ) || "12";
  const rawAttr =
    trimOrEmpty(
      rawSave.attributeKey ??
        rawSave.attribute ??
        rawEntry?.saveAttr ??
        rawEntry?.saveAttribute
    ) || "resistencia";
  const attributeKey = VALID_SAVE_ATTRS.has(rawAttr) ? rawAttr : "resistencia";
  const effectDescription =
    typeof rawSave.effectDescription === "string"
      ? rawSave.effectDescription
      : typeof rawEntry?.saveEffect === "string"
        ? rawEntry.saveEffect
        : "";
  return {
    enabled,
    dcFormula,
    attributeKey,
    effectDescription
  };
}

function migrateCharacterData({ charId, campaignId, raw, gmUid, summary }) {
  const ownerId = trimOrEmpty(raw.ownerId) || gmUid || "system";
  let nextType =
    raw.type === CHARACTER_TYPES.NPC || raw.type === CHARACTER_TYPES.PC
      ? raw.type
      : CHARACTER_TYPES.PC;

  // Decisão D-DER-4: fichas do Mestre que vieram como "pc" na v1 viram "npc" na M004.
  if (gmUid && ownerId === gmUid && nextType !== CHARACTER_TYPES.NPC) {
    nextType = CHARACTER_TYPES.NPC;
    summary.gmTypeFixedToNpc += 1;
  }

  const baseNormalized = fromCharacterDoc(
    { ...raw, type: nextType, ownerId },
    charId,
    { campaignId, gmId: gmUid || undefined }
  );

  // Atributos: garante mapa indexado por key normalizada
  const attributes = { ...baseNormalized.attributes };

  // Perícias: migra array/mapa evitando colisões com RESERVED_FORMULA_KEYS e atributos
  const rawSkillsList = Array.isArray(raw.skills)
    ? raw.skills
    : isPlainRecord(raw.skills)
      ? Object.entries(raw.skills).map(([k, val], idx) => ({
          ...(isPlainRecord(val) ? val : {}),
          key: isPlainRecord(val) && trimOrEmpty(val.key) ? val.key : k,
          order: isPlainRecord(val) && typeof val.order === "number" ? val.order : idx
        }))
      : [];

  const skills = {};
  const legacySkillIdToKey = {};
  const occupiedSkillKeys = new Set([
    ...RESERVED_FORMULA_KEYS,
    ...Object.keys(attributes)
  ]);

  rawSkillsList.forEach((rawSk, idx) => {
    if (!isPlainRecord(rawSk)) return;
    const skName = trimOrEmpty(rawSk.name) || "Perícia";
    const explicitKey = trimOrEmpty(rawSk.key);
    const normalizedExplicit = explicitKey ? normalizeSkillKey(explicitKey) : "";
    const normSkName = normalizeSkillKey(skName);
    const baseKey = normalizedExplicit || normSkName || `pericia_${idx + 1}`;
    const oldId = trimOrEmpty(rawSk.id);

    const isReserved = RESERVED_FORMULA_KEY_SET.has(baseKey);
    const isAttributeCollision = Object.hasOwn(attributes, baseKey);
    const isSkillCollision =
      occupiedSkillKeys.has(baseKey) && !isReserved && !isAttributeCollision;
    const needsResolve =
      occupiedSkillKeys.has(baseKey) ||
      /^[0-9]/.test(baseKey) ||
      UNSAFE_SKILL_KEYS.has(baseKey);

    const resolvedKey = needsResolve
      ? resolveUniqueSkillKey(baseKey, Array.from(occupiedSkillKeys))
      : baseKey;
    occupiedSkillKeys.add(resolvedKey);

    if (resolvedKey !== baseKey) {
      summary.skillKeyCollisions += 1;
      summary.collisionReport.push({
        path: `campaigns/${campaignId}/characters/${charId}`,
        legacySkillId: oldId || null,
        originalKey: baseKey,
        resolvedKey,
        reason: isReserved
          ? "reserved_key"
          : isAttributeCollision
            ? "attribute_collision"
            : isSkillCollision
              ? "skill_collision"
              : "invalid_key"
      });
    }

    if (oldId) legacySkillIdToKey[oldId] = resolvedKey;
    if (explicitKey && !legacySkillIdToKey[explicitKey]) {
      legacySkillIdToKey[explicitKey] = resolvedKey;
    }
    if (normSkName && !legacySkillIdToKey[normSkName]) {
      legacySkillIdToKey[normSkName] = resolvedKey;
    }

    const attrKey =
      trimOrEmpty(rawSk.attributeKey ?? rawSk.attribute) ||
      Object.keys(attributes)[0] ||
      "forca";
    const normAttrKey = normalizeSkillKey(attrKey);
    const resolvedAttrKey = Object.hasOwn(attributes, attrKey)
      ? attrKey
      : Object.hasOwn(attributes, normAttrKey)
        ? normAttrKey
        : Object.keys(attributes)[0] || attrKey;

    skills[resolvedKey] = {
      key: resolvedKey,
      name: skName,
      attributeKey: resolvedAttrKey,
      bonus: Number.isFinite(Number(rawSk.bonus)) ? Number(rawSk.bonus) : 0,
      order: typeof rawSk.order === "number" && Number.isFinite(rawSk.order) ? rawSk.order : idx
    };
  });

  // Habilidades
  const rawAbilitiesList = Array.isArray(raw.abilities)
    ? raw.abilities
    : isPlainRecord(raw.abilities)
      ? Object.entries(raw.abilities).map(([k, val], idx) => ({
          ...(isPlainRecord(val) ? val : {}),
          id: isPlainRecord(val) && trimOrEmpty(val.id) ? val.id : k,
          order: isPlainRecord(val) && typeof val.order === "number" ? val.order : idx
        }))
      : [];

  const abilities = {};
  rawAbilitiesList.forEach((rawAb, idx) => {
    if (!isPlainRecord(rawAb)) return;
    const abId = trimOrEmpty(rawAb.id) || `${ID_PREFIXES.ABILITY}_${idx + 1}`;
    const abName = trimOrEmpty(rawAb.name) || "Habilidade";
    const { icon, assigned } = resolveOneTimeIcon(rawAb.icon, abName, "sword");
    if (assigned) summary.iconsAssigned += 1;

    const cost = createDefaultAbilityCost(
      isPlainRecord(rawAb.cost)
        ? rawAb.cost
        : { resource: rawAb.costResource, amount: rawAb.costAmount }
    );
    const rawAbRange = isPlainRecord(rawAb.range) ? rawAb.range : {};
    const range = createDefaultRange({
      type: rawAbRange.type ?? rawAb.rangeType,
      distanceMeters:
        rawAbRange.distanceMeters ?? rawAb.rangeMeters ?? rawAb.distanceMeters
    });
    const rawAbAoe = isPlainRecord(rawAb.aoe) ? rawAb.aoe : {};
    const aoe = createDefaultAoe({
      type: rawAbAoe.type ?? rawAb.aoeType,
      radiusMeters: rawAbAoe.radiusMeters ?? rawAb.aoeRadiusMeters,
      coneAngleDeg:
        rawAbAoe.coneAngleDeg ?? rawAb.aoeConeAngleDeg ?? rawAb.coneAngleDeg
    });
    const effectType = VALID_EFFECT_TYPES.has(rawAb.effectType)
      ? rawAb.effectType
      : EFFECT_TYPES.DAMAGE;
    const trigger = VALID_TRIGGER_TYPES.has(rawAb.trigger)
      ? rawAb.trigger
      : TRIGGER_TYPES.ACTIVE;
    const hitFormula = typeof rawAb.hitFormula === "string" ? rawAb.hitFormula : "";
    const effectFormula =
      typeof rawAb.effectFormula === "string" ? rawAb.effectFormula : "";
    const rollKind = VALID_ROLL_KINDS.has(rawAb.rollKind)
      ? rawAb.rollKind
      : inferAbilityRollKind({ hitFormula, effectFormula, effectType });

    abilities[abId] = {
      id: abId,
      name: abName,
      icon,
      elementColor: trimOrEmpty(rawAb.elementColor) || DEFAULT_COLORS.abilityElement,
      cost,
      hitFormula,
      effectFormula,
      trigger,
      effectType,
      rollKind,
      range,
      aoe,
      savingThrow: migrateSavingThrow(rawAb),
      description: typeof rawAb.description === "string" ? rawAb.description : "",
      order: typeof rawAb.order === "number" && Number.isFinite(rawAb.order) ? rawAb.order : idx
    };
  });

  // Inventário
  const rawInventoryList = Array.isArray(raw.inventory)
    ? raw.inventory
    : isPlainRecord(raw.inventory)
      ? Object.entries(raw.inventory).map(([k, val], idx) => ({
          ...(isPlainRecord(val) ? val : {}),
          id: isPlainRecord(val) && trimOrEmpty(val.id) ? val.id : k,
          order: isPlainRecord(val) && typeof val.order === "number" ? val.order : idx
        }))
      : [];

  const inventory = {};
  rawInventoryList.forEach((rawIt, idx) => {
    if (!isPlainRecord(rawIt)) return;
    const itId = trimOrEmpty(rawIt.id) || `${ID_PREFIXES.ITEM}_${idx + 1}`;
    const itName = trimOrEmpty(rawIt.name) || "Item";
    const { icon, assigned } = resolveOneTimeIcon(rawIt.icon, itName, "sword");
    if (assigned) summary.iconsAssigned += 1;

    const rollFormula =
      typeof rawIt.rollFormula === "string"
        ? rawIt.rollFormula
        : typeof rawIt.formula === "string"
          ? rawIt.formula
          : "";
    const effectType = VALID_EFFECT_TYPES.has(rawIt.effectType)
      ? rawIt.effectType
      : EFFECT_TYPES.HEAL;
    const trigger = VALID_TRIGGER_TYPES.has(rawIt.trigger)
      ? rawIt.trigger
      : TRIGGER_TYPES.ACTIVE;
    const rollKind = VALID_ROLL_KINDS.has(rawIt.rollKind)
      ? rawIt.rollKind
      : rollFormula
        ? inferAbilityRollKind({ hitFormula: "", effectFormula: rollFormula, effectType })
        : null;
    const qtyNum = Number(rawIt.qty ?? rawIt.quantity ?? 1);

    inventory[itId] = {
      id: itId,
      name: itName,
      icon,
      qty: Number.isFinite(qtyNum) && qtyNum >= 0 ? qtyNum : 1,
      elementColor: trimOrEmpty(rawIt.elementColor) || DEFAULT_COLORS.itemElement,
      rollFormula,
      trigger,
      effectType,
      rollKind,
      consumeOnUse: Boolean(rawIt.consumeOnUse),
      savingThrow: migrateSavingThrow(rawIt),
      description: typeof rawIt.description === "string" ? rawIt.description : "",
      order: typeof rawIt.order === "number" && Number.isFinite(rawIt.order) ? rawIt.order : idx
    };
  });

  // Grupos de Rolagens
  const rawGroupsList = Array.isArray(raw.rollGroups)
    ? raw.rollGroups
    : isPlainRecord(raw.rollGroups)
      ? Object.entries(raw.rollGroups).map(([k, val], idx) => ({
          ...(isPlainRecord(val) ? val : {}),
          id: isPlainRecord(val) && trimOrEmpty(val.id) ? val.id : k,
          order: isPlainRecord(val) && typeof val.order === "number" ? val.order : idx
        }))
      : [createDefaultRollGroup()];

  const rollGroups = {};
  const rollIdToGroupId = {};

  rawGroupsList.forEach((rawGrp, gIdx) => {
    if (!isPlainRecord(rawGrp)) return;
    const grpId = trimOrEmpty(rawGrp.id) || `${ID_PREFIXES.ROLL_GROUP}_${gIdx + 1}`;
    const rawRollsList = Array.isArray(rawGrp.rolls)
      ? rawGrp.rolls
      : isPlainRecord(rawGrp.rolls)
        ? Object.entries(rawGrp.rolls).map(([k, val], idx) => ({
            ...(isPlainRecord(val) ? val : {}),
            id: isPlainRecord(val) && trimOrEmpty(val.id) ? val.id : k,
            order: isPlainRecord(val) && typeof val.order === "number" ? val.order : idx
          }))
        : [];

    const rolls = {};
    rawRollsList.forEach((rawR, rIdx) => {
      if (!isPlainRecord(rawR)) return;
      const rId = trimOrEmpty(rawR.id) || `${ID_PREFIXES.ROLL}_${rIdx + 1}`;
      rollIdToGroupId[rId] = grpId;

      const rawSource = isPlainRecord(rawR.source) ? rawR.source : null;
      const srcType = trimOrEmpty(rawSource?.type ?? rawR.sourceType) || ROLL_SOURCE_TYPES.CUSTOM;
      let srcId = rawSource?.id !== undefined ? rawSource.id : rawR.sourceId ?? null;
      srcId = srcType === ROLL_SOURCE_TYPES.CUSTOM ? null : trimOrEmpty(srcId) || null;

      if (srcType === ROLL_SOURCE_TYPES.SKILL && srcId) {
        if (!Object.hasOwn(skills, srcId)) {
          const normSrcId = normalizeSkillKey(srcId);
          srcId =
            (Object.hasOwn(legacySkillIdToKey, srcId)
              ? legacySkillIdToKey[srcId]
              : undefined) ||
            (Object.hasOwn(legacySkillIdToKey, normSrcId)
              ? legacySkillIdToKey[normSrcId]
              : undefined) ||
            srcId;
        }
      }

      const rawOverrides = isPlainRecord(rawR.overrides) ? rawR.overrides : {};
      const overrides = {};
      const customName = trimOrEmpty(rawOverrides.name ?? (rawR.customName || srcType === "custom" ? rawR.name : ""));
      if (customName) overrides.name = customName;

      const existingOverrideIcon = trimOrEmpty(
        rawOverrides.icon ?? (rawR.customIcon || srcType === "custom" ? rawR.icon : "")
      );
      if (existingOverrideIcon) {
        const iconRes = resolveOneTimeIcon(existingOverrideIcon, overrides.name || rawR.name, srcType === "attribute" ? "clover" : "sword");
        overrides.icon = iconRes.icon;
        if (iconRes.assigned) summary.iconsAssigned += 1;
      } else if (srcType === ROLL_SOURCE_TYPES.CUSTOM) {
        const iconRes = resolveOneTimeIcon("", overrides.name || rawR.name, "sword");
        overrides.icon = iconRes.icon;
        if (iconRes.assigned) summary.iconsAssigned += 1;
      }

      const overrideColor = trimOrEmpty(rawOverrides.color ?? rawR.color);
      if (overrideColor) overrides.color = overrideColor;

      const nextRoll = {
        id: rId,
        order: typeof rawR.order === "number" && Number.isFinite(rawR.order) ? rawR.order : rIdx,
        source: {
          type: srcType,
          id: srcId
        },
        overrides
      };

      if (srcType === ROLL_SOURCE_TYPES.CUSTOM) {
        const customSrc = isPlainRecord(rawR.custom) ? rawR.custom : rawR;
        const effectType = VALID_EFFECT_TYPES.has(customSrc.effectType)
          ? customSrc.effectType
          : EFFECT_TYPES.DAMAGE;
        const hitFormula = typeof customSrc.hitFormula === "string" ? customSrc.hitFormula : "";
        const effectFormula = typeof customSrc.effectFormula === "string" ? customSrc.effectFormula : "";
        const rollKind = VALID_ROLL_KINDS.has(customSrc.rollKind)
          ? customSrc.rollKind
          : inferAbilityRollKind({ hitFormula, effectFormula, effectType });
        nextRoll.custom = {
          hitFormula,
          effectFormula,
          rollKind,
          effectType,
          cost: createDefaultAbilityCost(
            isPlainRecord(customSrc.cost)
              ? customSrc.cost
              : { resource: customSrc.costResource, amount: customSrc.costAmount }
          ),
          savingThrow: migrateSavingThrow(customSrc)
        };
      }

      rolls[rId] = nextRoll;
    });

    rollGroups[grpId] = {
      id: grpId,
      name: trimOrEmpty(rawGrp.name) || "Grupo de Rolagens",
      order: typeof rawGrp.order === "number" && Number.isFinite(rawGrp.order) ? rawGrp.order : gIdx,
      rolls
    };
  });

  // Hotbar "1".."9"
  const hotbar = {};
  for (let slotNum = 1; slotNum <= 9; slotNum += 1) {
    const slotKey = String(slotNum);
    const rawSlot = Array.isArray(raw.hotbar)
      ? raw.hotbar[slotNum - 1]
      : isPlainRecord(raw.hotbar)
        ? raw.hotbar[slotKey]
        : null;
    if (isPlainRecord(rawSlot)) {
      const rId = trimOrEmpty(rawSlot.rollId);
      const explicitGid = trimOrEmpty(rawSlot.rollGroupId);
      const resolvedGid =
        (explicitGid && rollGroups[explicitGid]?.rolls?.[rId] ? explicitGid : null) ||
        (rId && rollIdToGroupId[rId] && rollGroups[rollIdToGroupId[rId]]?.rolls?.[rId]
          ? rollIdToGroupId[rId]
          : null);
      if (resolvedGid && rId) {
        hotbar[slotKey] = { rollGroupId: resolvedGid, rollId: rId };
      } else {
        hotbar[slotKey] = null;
        summary.orphanHotbarSlotsCleared += 1;
      }
    } else {
      hotbar[slotKey] = null;
    }
  }

  const candidate = {
    ...baseNormalized,
    type: nextType,
    ownerId,
    attributes,
    skills,
    abilities,
    inventory,
    rollGroups,
    hotbar,
    rev: Number.isInteger(raw.rev) && raw.rev >= 0 ? raw.rev : 0,
    recentOps: isPlainRecord(raw.recentOps) ? raw.recentOps : {}
  };

  const validation = validateCharacter(candidate);
  if (!validation.ok) {
    throw validation.errors[0];
  }

  return toCharacterDoc(candidate);
}

function migrateCompendiumData({ entryId, campaignId, raw, gmUid, summary }) {
  const { icon, assigned } = resolveOneTimeIcon(raw.icon, raw.name, "sword");
  if (assigned) summary.iconsAssigned += 1;

  const base = fromCompendiumEntryDoc(
    {
      ...raw,
      icon,
      hitFormula: trimOrEmpty(raw.hitFormula)
        ? raw.hitFormula
        : raw.type === COMPENDIUM_TYPES.SKILL
          ? raw.formula
          : raw.hitFormula,
      effectFormula: trimOrEmpty(raw.effectFormula)
        ? raw.effectFormula
        : raw.rollFormula,
      attributeKey: trimOrEmpty(raw.attributeKey ?? raw.attribute) || "forca",
      savingThrow: migrateSavingThrow(raw)
    },
    entryId,
    { campaignId, gmId: gmUid || undefined }
  );

  const type = VALID_COMP_TYPES.has(base.type) ? base.type : COMPENDIUM_TYPES.ABILITY;
  const rollKind = VALID_ROLL_KINDS.has(base.rollKind)
    ? base.rollKind
    : type === COMPENDIUM_TYPES.SKILL
      ? ROLL_KINDS.CHECK
      : inferAbilityRollKind({
          hitFormula: base.hitFormula,
          effectFormula: base.effectFormula,
          effectType: base.effectType
        });

  const rawRange = isPlainRecord(raw.range) ? raw.range : {};
  const rawAoe = isPlainRecord(raw.aoe) ? raw.aoe : {};

  const candidate = {
    ...base,
    type,
    rollKind,
    range: createDefaultRange({
      type: rawRange.type ?? raw.rangeType,
      distanceMeters:
        rawRange.distanceMeters ?? raw.rangeMeters ?? raw.distanceMeters
    }),
    aoe: createDefaultAoe({
      type: rawAoe.type ?? raw.aoeType,
      radiusMeters: rawAoe.radiusMeters ?? raw.aoeRadiusMeters,
      coneAngleDeg:
        rawAoe.coneAngleDeg ?? raw.aoeConeAngleDeg ?? raw.coneAngleDeg
    })
  };

  const validation = validateCompendiumEntry(candidate);
  if (!validation.ok) {
    throw validation.errors[0];
  }
  return toCompendiumEntryDoc(candidate);
}

function hasAnyKey(obj, keys) {
  return keys.some((k) => Object.hasOwn(obj, k));
}

export default {
  id: "M004-characters-v2",
  description:
    "Migra characters e compendium para o schema v2 (mapas indexados, chaves normalizadas, type pc/npc explícito, rev/recentOps, ImageRef, ícones explícitos).",

  async plan({ firestore }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      charactersScanned: 0,
      charactersUpdated: 0,
      legacyFoldersSkipped: 0,
      gmTypeFixedToNpc: 0,
      skillKeyCollisions: 0,
      collisionReport: [],
      orphanHotbarSlotsCleared: 0,
      iconsAssigned: 0,
      compendiumScanned: 0,
      compendiumUpdated: 0
    };

    const campaignsSnap = await firestore.collection("campaigns").get();

    for (const campDoc of campaignsSnap.docs) {
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};
      const gmUid = trimOrEmpty(campData.gmId) || null;
      summary.campaignsProcessed += 1;

      // 1. Characters
      const charsSnap = await firestore
        .collection(`campaigns/${campaignId}/characters`)
        .get();

      for (const charDoc of charsSnap.docs) {
        const raw = charDoc.data() || {};
        if (raw.isFolder === true) {
          summary.legacyFoldersSkipped += 1;
          continue;
        }
        summary.charactersScanned += 1;

        const targetDoc = migrateCharacterData({
          charId: charDoc.id,
          campaignId,
          raw,
          gmUid,
          summary
        });

        const hasLegacyTopKey = hasAnyKey(raw, LEGACY_CHARACTER_KEYS);
        const targetComparable = {
          ...targetDoc,
          createdAt: raw.createdAt ?? targetDoc.createdAt,
          updatedAt: raw.updatedAt ?? targetDoc.updatedAt,
          deletedAt: raw.deletedAt ?? targetDoc.deletedAt
        };

        if (hasLegacyTopKey || !stableEquals(raw, targetComparable)) {
          const updateData = { ...targetComparable };
          if (!updateData.updatedAt) {
            updateData.updatedAt = FieldValue.serverTimestamp();
          }
          for (const legacyKey of LEGACY_CHARACTER_KEYS) {
            if (Object.hasOwn(raw, legacyKey)) {
              updateData[legacyKey] = FieldValue.delete();
            }
          }
          operations.push({
            kind: "fs.update",
            path: charDoc.ref.path,
            data: updateData
          });
          summary.charactersUpdated += 1;
        }
      }

      // 2. Compendium
      const compSnap = await firestore
        .collection(`campaigns/${campaignId}/compendium`)
        .get();

      for (const compDoc of compSnap.docs) {
        const raw = compDoc.data() || {};
        summary.compendiumScanned += 1;

        const targetDoc = migrateCompendiumData({
          entryId: compDoc.id,
          campaignId,
          raw,
          gmUid,
          summary
        });

        const hasLegacyTopKey = hasAnyKey(raw, LEGACY_COMPENDIUM_KEYS);
        const targetComparable = {
          ...targetDoc,
          createdAt: raw.createdAt ?? targetDoc.createdAt,
          updatedAt: raw.updatedAt ?? targetDoc.updatedAt,
          deletedAt: raw.deletedAt ?? targetDoc.deletedAt
        };

        if (hasLegacyTopKey || !stableEquals(raw, targetComparable)) {
          const updateData = { ...targetComparable };
          if (!updateData.updatedAt) {
            updateData.updatedAt = FieldValue.serverTimestamp();
          }
          for (const legacyKey of LEGACY_COMPENDIUM_KEYS) {
            if (Object.hasOwn(raw, legacyKey)) {
              updateData[legacyKey] = FieldValue.delete();
            }
          }
          operations.push({
            kind: "fs.update",
            path: compDoc.ref.path,
            data: updateData
          });
          summary.compendiumUpdated += 1;
        }
      }
    }

    return { operations, summary };
  }
};
