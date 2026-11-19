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

export const CLIENT_VERSION = "2.0.0";
export const METERS_PER_CELL = 1.5;
export const PING_LIFETIME_MS = 2200;
export const DEFAULT_MOVEMENT_BUDGET_METERS = 9;
export const MIN_GRID_CELL_SIZE_PX = 8;
export const MIN_FOG_AREA_PX = 8;
export const DEFAULT_CELL_SIZE_PX = 64;
export const TOKEN_MOVE_THROTTLE_MS = 40;
export const SPEECH_BUBBLE_DISPLAY_MS = 5000;
export const SPEECH_BUBBLE_FADE_MS = 600;
export const BOARD_ZOOM_LIMITS = deepFreeze({
  MIN: 0.25,
  MAX: 2.5,
  STEP: 0.15,
  WHEEL_FACTOR: 1.08
});
export const DEFAULT_MAP_DIMENSIONS = deepFreeze({
  widthPx: 1920,
  heightPx: 1080
});
export const CHAT_PAGE_SIZE = 50;
export const RECENT_OPS_LIMIT = 50;

export const ROLL_KINDS = deepFreeze({
  ATTACK: "attack",
  DAMAGE: "damage",
  HEAL: "heal",
  MP_DAMAGE: "mp_damage",
  MP_HEAL: "mp_heal",
  SAVING_THROW: "saving_throw",
  CHECK: "check",
  UTILITY: "utility"
});

export const EFFECT_TYPES = deepFreeze({
  DAMAGE: "damage",
  HEAL: "heal",
  MP_DAMAGE: "mp_damage",
  MP_HEAL: "mp_heal",
  UTILITY: "utility"
});

export const EFFECT_TYPE_META = deepFreeze({
  [EFFECT_TYPES.DAMAGE]: {
    id: EFFECT_TYPES.DAMAGE,
    resourceKey: "hp",
    deltaSign: -1
  },
  [EFFECT_TYPES.HEAL]: {
    id: EFFECT_TYPES.HEAL,
    resourceKey: "hp",
    deltaSign: 1
  },
  [EFFECT_TYPES.MP_DAMAGE]: {
    id: EFFECT_TYPES.MP_DAMAGE,
    resourceKey: "mp",
    deltaSign: -1
  },
  [EFFECT_TYPES.MP_HEAL]: {
    id: EFFECT_TYPES.MP_HEAL,
    resourceKey: "mp",
    deltaSign: 1
  },
  [EFFECT_TYPES.UTILITY]: {
    id: EFFECT_TYPES.UTILITY,
    resourceKey: null,
    deltaSign: 0
  }
});

export const TRIGGER_TYPES = deepFreeze({
  ACTIVE: "active",
  ON_HIT: "on_hit",
  ON_CRIT: "on_crit",
  ON_BEING_HIT: "on_being_hit",
  ON_SAVE: "on_save",
  PASSIVE: "passive"
});

export const SKILL_RANGE_TYPES = deepFreeze({
  SELF: "self",
  TOUCH: "touch",
  RANGED: "ranged"
});

export const SKILL_AOE_TYPES = deepFreeze({
  SINGLE: "single",
  CIRCLE: "circle",
  CONE: "cone"
});

export const NOTE_TYPES = deepFreeze({
  CHARACTER: "character",
  LORE: "lore",
  LOCATION: "location",
  EVENT: "event",
  QUEST: "quest"
});

export const CHARACTER_TYPES = deepFreeze({
  PC: "pc",
  NPC: "npc"
});

export const TOKEN_KINDS = deepFreeze({
  PC: "pc",
  NPC: "npc",
  FREE: "free"
});

export const FOLDER_DOMAINS = deepFreeze({
  CHARACTER: "character",
  JOURNAL: "journal"
});

export const NOTE_SCOPES = deepFreeze({
  GM: "gm",
  PLAYER: "player",
  PARTY: "party"
});

export const DRAWING_TYPES = deepFreeze({
  STROKE: "stroke",
  RECT: "rect",
  CIRCLE: "circle",
  TEXT: "text"
});

export const PING_KINDS = deepFreeze({
  PING: "ping",
  SNOWBALL: "snowball"
});

export const LAYER_NAMES = deepFreeze({
  MAP: "map",
  OBJECTS: "objects",
  TOKENS: "tokens"
});

export const COMPENDIUM_TYPES = deepFreeze({
  ABILITY: "ability",
  SPELL: "spell",
  SKILL: "skill",
  ITEM: "item"
});

export const MESSAGE_TYPES = deepFreeze({
  TEXT: "text",
  EMOTE: "emote",
  SKILL_PING: "skill_ping",
  ROLL: "roll"
});

export const MESSAGE_VISIBILITY = deepFreeze({
  PUBLIC: "public",
  GM_ONLY: "gm_only"
});

export const MESSAGE_STATUS = deepFreeze({
  COMMITTED: "committed",
  PENDING: "pending",
  FAILED: "failed"
});

export const HIT_EVALUATION_STATUS = deepFreeze({
  PENDING: "pending",
  DONE: "done",
  NONE: "none"
});

export const PENDING_COST_STATUS = deepFreeze({
  PENDING: "pending",
  APPLIED: "applied"
});

export const PRESENCE_KINDS = deepFreeze({
  MAIN: "main",
  SHEET: "sheet"
});

export const RESOURCE_KEYS = deepFreeze({
  HP: "hp",
  MP: "mp"
});

export const ROLL_SOURCE_TYPES = deepFreeze({
  ABILITY: "ability",
  SKILL: "skill",
  ITEM: "item",
  ATTRIBUTE: "attribute",
  CUSTOM: "custom"
});

export const DEFAULT_ATTRIBUTES = deepFreeze([
  { key: "forca", label: "Força", value: 2 },
  { key: "agilidade", label: "Agilidade", value: 2 },
  { key: "intelecto", label: "Intelecto", value: 2 },
  { key: "vigor", label: "Vigor", value: 2 },
  { key: "espirito", label: "Espírito", value: 2 }
]);

export const SAVE_ATTRIBUTES = deepFreeze([
  { id: "forca", label: "Força", formula: "@forca" },
  { id: "agilidade", label: "Agilidade", formula: "@agilidade" },
  { id: "intelecto", label: "Intelecto", formula: "@intelecto" },
  { id: "presenca", label: "Presença", formula: "@presenca" },
  { id: "vigor", label: "Vigor", formula: "@vigor" },
  { id: "fortitude", label: "Fortitude", formula: "@vigor + @fortitude" },
  { id: "reflexos", label: "Reflexos", formula: "@agilidade + @reflexos" },
  { id: "vontade", label: "Vontade", formula: "@presenca + @vontade" },
  { id: "resistencia", label: "Resistência", formula: "@vigor + @resistencia" }
]);

export const RESERVED_FORMULA_KEYS = deepFreeze([
  "defesa",
  "defense",
  "hp",
  "vida",
  "mp",
  "energia",
  "nivel"
]);

export const ID_PREFIXES = deepFreeze({
  CAMPAIGN: "camp",
  CHARACTER: "char",
  FOLDER: "folder",
  NOTE: "note",
  SECTION: "sec",
  SCENE: "scene",
  COMPENDIUM: "comp",
  MESSAGE: "msg",
  SAVE: "save",
  MEDIA: "media",
  TOKEN: "tok",
  DRAWING: "drw",
  DRAWING_SHAPE: "shp",
  DRAWING_TEXT: "txt",
  PING: "ping",
  FOG_AREA: "area",
  ABILITY: "ab",
  SKILL: "sk",
  INVENTORY: "inv",
  ROLL_GROUP: "grp",
  ROLL: "r",
  COMBATANT: "comb",
  OPERATION: "op",
  WINDOW: "win",
  CONNECTION: "conn"
});

export const VALID_ID_PREFIXES = deepFreeze(
  Array.from(new Set(Object.values(ID_PREFIXES)))
);
