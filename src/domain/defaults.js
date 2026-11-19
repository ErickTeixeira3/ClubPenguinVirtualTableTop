import {
  CHARACTER_TYPES,
  COMPENDIUM_TYPES,
  DEFAULT_ATTRIBUTES,
  DEFAULT_CELL_SIZE_PX,
  DEFAULT_MAP_DIMENSIONS,
  DEFAULT_MOVEMENT_BUDGET_METERS,
  EFFECT_TYPES,
  LAYER_NAMES,
  RESOURCE_KEYS,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TOKEN_KINDS,
  TRIGGER_TYPES
} from "./constants.js";

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

function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

function deepCloneSafe(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepCloneSafe(item));
  }
  const cloned = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!UNSAFE_KEYS.has(key)) {
      cloned[key] = deepCloneSafe(entry);
    }
  }
  return cloned;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function resolveFiniteNumber(value, fallback) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function resolveDcFormula(value, fallback) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function resolveNonEmptyString(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function createEmptyImageRef() {
  return { mediaId: null, url: null };
}

export const DEFAULT_CHARACTER_HP = deepFreeze({ current: 25, max: 25 });
export const DEFAULT_CHARACTER_MP = deepFreeze({ current: 15, max: 15 });
export const DEFAULT_CHARACTER_DEFENSE = 12;

export const DEFAULT_FREE_TOKEN_DEFENSE = 10;
export const DEFAULT_FREE_TOKEN_RESOURCES = deepFreeze({ hp: null, mp: null });

export const DEFAULT_SAVING_THROW = deepFreeze({
  enabled: false,
  dcFormula: "12",
  attributeKey: "resistencia",
  effectDescription: ""
});

export const DEFAULT_RANGE = deepFreeze({
  type: SKILL_RANGE_TYPES.RANGED,
  distanceMeters: 9
});

export const DEFAULT_AOE = deepFreeze({
  type: SKILL_AOE_TYPES.SINGLE,
  radiusMeters: 6,
  coneAngleDeg: 45
});

export const DEFAULT_ABILITY_COST = deepFreeze({
  resource: RESOURCE_KEYS.MP,
  amount: 0
});

export const DEFAULT_ROLL_GROUP_ID = "grp_combate";
export const DEFAULT_ROLL_GROUP_NAME = "Ações de Combate";

export const DEFAULT_GRID_CONFIG = deepFreeze({
  enabled: true,
  snapToGrid: true,
  cellSizePx: DEFAULT_CELL_SIZE_PX,
  offsetX: 0,
  offsetY: 0,
  color: "#ffffff",
  opacity: 0.28
});

export const DEFAULT_FOG_DEFAULTS = deepFreeze({
  enabled: false,
  defaultOpaque: false
});

export const DEFAULT_COLORS = deepFreeze({
  characterCard: "#02529c",
  tokenRing: "#3090f0",
  abilityElement: "#e53935",
  compendiumElement: "#e53935",
  itemElement: "#38c172",
  customRoll: "#3090f0",
  attributeRoll: "#02529c",
  gridLine: "#ffffff",
  drawingStroke: "#ffcc00",
  drawingFill: "#00f0ff",
  ping: "#00f0ff",
  fogOverlay: "#040d1a"
});

export const DEFAULT_NAMES = deepFreeze({
  character: "Novo Pinguim",
  member: "Pinguim",
  token: "Token",
  scene: "Novo Mapa",
  compendiumEntry: "Item do Compêndio",
  folder: "Nova Pasta",
  note: "Sem Título",
  combatant: "Combatente",
  target: "Alvo",
  roll: "Rolagem",
  rollGroup: DEFAULT_ROLL_GROUP_NAME
});

export const DEFAULT_COMBATANT_BUDGETS = deepFreeze({
  movementBudgetMeters: DEFAULT_MOVEMENT_BUDGET_METERS,
  movementUsedMeters: 0,
  actionsMax: 1,
  actionsRemaining: 1,
  reactionsMax: 1,
  reactionsRemaining: 1
});

export const DEFAULT_COMBAT_STATE = deepFreeze({
  active: false,
  round: 1,
  activeTurnIndex: 0,
  lockMovementOutsideTurn: true,
  lockActionsOutsideTurn: true,
  turnOrder: []
});

export function calculateDefaultCharacterDefense(overrides = {}) {
  const src = asRecord(overrides);
  return resolveFiniteNumber(src.defense, DEFAULT_CHARACTER_DEFENSE);
}

export function createDefaultCharacterResources(overrides = {}) {
  const src = asRecord(overrides);
  const hpSrc = asRecord(src.hp);
  const mpSrc = asRecord(src.mp);
  return {
    hp: {
      current: resolveFiniteNumber(hpSrc.current, DEFAULT_CHARACTER_HP.current),
      max: resolveFiniteNumber(hpSrc.max, DEFAULT_CHARACTER_HP.max)
    },
    mp: {
      current: resolveFiniteNumber(mpSrc.current, DEFAULT_CHARACTER_MP.current),
      max: resolveFiniteNumber(mpSrc.max, DEFAULT_CHARACTER_MP.max)
    }
  };
}

export function createDefaultAttributesMap() {
  const map = {};
  DEFAULT_ATTRIBUTES.forEach((attr, index) => {
    map[attr.key] = {
      key: attr.key,
      label: attr.label,
      value: attr.value,
      order: index
    };
  });
  return map;
}

export function createDefaultHotbar() {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null
  };
}

export function createDefaultSavingThrow(overrides = {}) {
  const src = asRecord(overrides);
  const dcFormula = resolveDcFormula(
    src.dcFormula,
    DEFAULT_SAVING_THROW.dcFormula
  );
  const attrKey = resolveNonEmptyString(
    src.attributeKey,
    resolveNonEmptyString(src.attribute, DEFAULT_SAVING_THROW.attributeKey)
  );

  return {
    enabled: Boolean(src.enabled ?? DEFAULT_SAVING_THROW.enabled),
    dcFormula,
    attributeKey: attrKey,
    effectDescription:
      typeof src.effectDescription === "string"
        ? src.effectDescription
        : DEFAULT_SAVING_THROW.effectDescription
  };
}

export function createDefaultRange(overrides = {}) {
  const src = asRecord(overrides);
  return {
    type: resolveNonEmptyString(src.type, DEFAULT_RANGE.type),
    distanceMeters: resolveFiniteNumber(
      src.distanceMeters,
      DEFAULT_RANGE.distanceMeters
    )
  };
}

export function createDefaultAoe(overrides = {}) {
  const src = asRecord(overrides);
  return {
    type: resolveNonEmptyString(src.type, DEFAULT_AOE.type),
    radiusMeters: resolveFiniteNumber(src.radiusMeters, DEFAULT_AOE.radiusMeters),
    coneAngleDeg: resolveFiniteNumber(src.coneAngleDeg, DEFAULT_AOE.coneAngleDeg)
  };
}

export function createDefaultAbilityCost(overrides = {}) {
  const src = asRecord(overrides);
  return {
    resource: resolveNonEmptyString(src.resource, DEFAULT_ABILITY_COST.resource),
    amount: Math.max(
      0,
      resolveFiniteNumber(src.amount, DEFAULT_ABILITY_COST.amount)
    )
  };
}

export function createDefaultRollGroup(overrides = {}) {
  const src = asRecord(overrides);
  const rolls = {};
  if (src.rolls && typeof src.rolls === "object" && !Array.isArray(src.rolls)) {
    for (const [rollId, rollEntry] of Object.entries(src.rolls)) {
      if (!UNSAFE_KEYS.has(rollId)) {
        rolls[rollId] = deepCloneSafe(rollEntry);
      }
    }
  }
  return {
    id: resolveNonEmptyString(src.id, DEFAULT_ROLL_GROUP_ID),
    name: resolveNonEmptyString(src.name, DEFAULT_ROLL_GROUP_NAME),
    order: resolveFiniteNumber(src.order, 0),
    rolls
  };
}

export function createDefaultCharacterDefaults() {
  return {
    type: CHARACTER_TYPES.PC,
    folderId: null,
    visibleTo: [],
    editableBy: [],
    name: DEFAULT_NAMES.character,
    cardColor: DEFAULT_COLORS.characterCard,
    level: 1,
    xp: 0,
    coins: 0,
    defense: calculateDefaultCharacterDefense(),
    movementBudgetMeters: DEFAULT_MOVEMENT_BUDGET_METERS,
    avatar: createEmptyImageRef(),
    token: {
      image: createEmptyImageRef(),
      sizeInCells: 1,
      showName: true
    },
    resources: createDefaultCharacterResources(),
    attributes: createDefaultAttributesMap(),
    skills: {},
    abilities: {},
    inventory: {},
    rollGroups: {
      [DEFAULT_ROLL_GROUP_ID]: createDefaultRollGroup()
    },
    hotbar: createDefaultHotbar(),
    biography: "",
    notes: "",
    rev: 0,
    recentOps: {},
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  };
}

export function createDefaultTokenDefaults() {
  return {
    kind: TOKEN_KINDS.FREE,
    characterId: null,
    controlledBy: {},
    layer: LAYER_NAMES.TOKENS,
    hidden: false,
    label: DEFAULT_NAMES.token,
    image: createEmptyImageRef(),
    x: 0,
    y: 0,
    sizeInCells: 1,
    rotation: 0,
    ringColor: DEFAULT_COLORS.tokenRing,
    showName: true,
    bars: null,
    rev: 0,
    secrets: {
      defense: DEFAULT_FREE_TOKEN_DEFENSE,
      hp: DEFAULT_FREE_TOKEN_RESOURCES.hp,
      mp: DEFAULT_FREE_TOKEN_RESOURCES.mp,
      showBarsToPlayers: true,
      recentOps: {}
    }
  };
}

export function createDefaultSceneDefaults() {
  return {
    name: DEFAULT_NAMES.scene,
    visibleTo: [],
    mapImage: {
      image: createEmptyImageRef(),
      mimeType: null,
      widthPx: DEFAULT_MAP_DIMENSIONS.widthPx,
      heightPx: DEFAULT_MAP_DIMENSIONS.heightPx
    },
    grid: { ...DEFAULT_GRID_CONFIG },
    fogDefaults: { ...DEFAULT_FOG_DEFAULTS },
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  };
}

export function createDefaultCompendiumDefaults() {
  return {
    type: COMPENDIUM_TYPES.ABILITY,
    name: DEFAULT_NAMES.compendiumEntry,
    category: "",
    icon: "sword",
    elementColor: DEFAULT_COLORS.compendiumElement,
    visibleTo: [],
    cost: createDefaultAbilityCost(),
    hitFormula: "",
    effectFormula: "",
    rollKind: null,
    trigger: TRIGGER_TYPES.ACTIVE,
    effectType: EFFECT_TYPES.DAMAGE,
    range: createDefaultRange(),
    aoe: createDefaultAoe(),
    savingThrow: createDefaultSavingThrow(),
    bonus: 0,
    attributeKey: "forca",
    description: "",
    isDeleted: false,
    deletedAt: null,
    deletedBy: null
  };
}
