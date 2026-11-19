import { describe, expect, it } from "vitest";
import * as constants from "../../../src/domain/constants.js";

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Object.keys(value)) {
    assertDeepFrozen(value[key], seen);
  }
}

describe("domain/constants", () => {
  it("exports canonical numeric and dimension constants", () => {
    expect(constants.METERS_PER_CELL).toBe(1.5);
    expect(constants.PING_LIFETIME_MS).toBe(2200);
    expect(constants.DEFAULT_MOVEMENT_BUDGET_METERS).toBe(9);
    expect(constants.MIN_GRID_CELL_SIZE_PX).toBe(8);
    expect(constants.DEFAULT_CELL_SIZE_PX).toBe(64);
    expect(constants.DEFAULT_MAP_DIMENSIONS).toEqual({
      widthPx: 1920,
      heightPx: 1080
    });
    expect(constants.CHAT_PAGE_SIZE).toBe(50);
    expect(constants.RECENT_OPS_LIMIT).toBe(50);
  });

  it("exports canonical gameplay and schema enums", () => {
    expect(constants.ROLL_KINDS).toEqual({
      ATTACK: "attack",
      DAMAGE: "damage",
      HEAL: "heal",
      MP_DAMAGE: "mp_damage",
      MP_HEAL: "mp_heal",
      SAVING_THROW: "saving_throw",
      CHECK: "check",
      UTILITY: "utility"
    });
    expect(constants.EFFECT_TYPES).toEqual({
      DAMAGE: "damage",
      HEAL: "heal",
      MP_DAMAGE: "mp_damage",
      MP_HEAL: "mp_heal",
      UTILITY: "utility"
    });
    for (const effectId of Object.values(constants.EFFECT_TYPES)) {
      expect(constants.EFFECT_TYPE_META[effectId]).toBeDefined();
      expect(constants.EFFECT_TYPE_META[effectId].id).toBe(effectId);
    }
    expect(constants.EFFECT_TYPE_META.damage).toEqual({
      id: "damage",
      resourceKey: "hp",
      deltaSign: -1
    });
    expect(constants.EFFECT_TYPE_META.utility).toEqual({
      id: "utility",
      resourceKey: null,
      deltaSign: 0
    });

    expect(constants.TRIGGER_TYPES).toEqual({
      ACTIVE: "active",
      ON_HIT: "on_hit",
      ON_CRIT: "on_crit",
      ON_BEING_HIT: "on_being_hit",
      ON_SAVE: "on_save",
      PASSIVE: "passive"
    });
    expect(constants.SKILL_RANGE_TYPES).toEqual({
      SELF: "self",
      TOUCH: "touch",
      RANGED: "ranged"
    });
    expect(constants.SKILL_AOE_TYPES).toEqual({
      SINGLE: "single",
      CIRCLE: "circle",
      CONE: "cone"
    });
    expect(constants.NOTE_TYPES).toEqual({
      CHARACTER: "character",
      LORE: "lore",
      LOCATION: "location",
      EVENT: "event",
      QUEST: "quest"
    });
    expect(constants.CHARACTER_TYPES).toEqual({ PC: "pc", NPC: "npc" });
    expect(constants.TOKEN_KINDS).toEqual({
      PC: "pc",
      NPC: "npc",
      FREE: "free"
    });
    expect(constants.FOLDER_DOMAINS).toEqual({
      CHARACTER: "character",
      JOURNAL: "journal"
    });
    expect(constants.NOTE_SCOPES).toEqual({
      GM: "gm",
      PLAYER: "player",
      PARTY: "party"
    });
    expect(constants.DRAWING_TYPES).toEqual({
      STROKE: "stroke",
      RECT: "rect",
      CIRCLE: "circle",
      TEXT: "text"
    });
    expect(constants.PING_KINDS).toEqual({
      PING: "ping",
      SNOWBALL: "snowball"
    });
    expect(constants.LAYER_NAMES).toEqual({
      MAP: "map",
      OBJECTS: "objects",
      TOKENS: "tokens"
    });
    expect(constants.COMPENDIUM_TYPES).toEqual({
      ABILITY: "ability",
      SPELL: "spell",
      SKILL: "skill",
      ITEM: "item"
    });
    expect(constants.MESSAGE_TYPES).toEqual({
      TEXT: "text",
      EMOTE: "emote",
      SKILL_PING: "skill_ping",
      ROLL: "roll"
    });
    expect(constants.MESSAGE_VISIBILITY).toEqual({
      PUBLIC: "public",
      GM_ONLY: "gm_only"
    });
    expect(constants.MESSAGE_STATUS).toEqual({
      COMMITTED: "committed",
      PENDING: "pending",
      FAILED: "failed"
    });
    expect(constants.HIT_EVALUATION_STATUS).toEqual({
      PENDING: "pending",
      DONE: "done",
      NONE: "none"
    });
    expect(constants.PENDING_COST_STATUS).toEqual({
      PENDING: "pending",
      APPLIED: "applied"
    });
    expect(constants.PRESENCE_KINDS).toEqual({
      MAIN: "main",
      SHEET: "sheet"
    });
    expect(constants.RESOURCE_KEYS).toEqual({
      HP: "hp",
      MP: "mp"
    });
    expect(constants.ROLL_SOURCE_TYPES).toEqual({
      ABILITY: "ability",
      SKILL: "skill",
      ITEM: "item",
      ATTRIBUTE: "attribute",
      CUSTOM: "custom"
    });
  });

  it("preserves distinct DEFAULT_ATTRIBUTES (with espirito) and SAVE_ATTRIBUTES (with presenca & vontade)", () => {
    expect(constants.DEFAULT_ATTRIBUTES).toHaveLength(5);
    expect(constants.DEFAULT_ATTRIBUTES.map((a) => a.key)).toEqual([
      "forca",
      "agilidade",
      "intelecto",
      "vigor",
      "espirito"
    ]);
    expect(constants.DEFAULT_ATTRIBUTES.every((a) => a.value === 2)).toBe(true);

    expect(constants.SAVE_ATTRIBUTES).toHaveLength(9);
    expect(constants.SAVE_ATTRIBUTES.map((a) => a.id)).toEqual([
      "forca",
      "agilidade",
      "intelecto",
      "presenca",
      "vigor",
      "fortitude",
      "reflexos",
      "vontade",
      "resistencia"
    ]);
    expect(constants.SAVE_ATTRIBUTES.find((a) => a.id === "vontade").formula).toBe(
      "@presenca + @vontade"
    );
  });

  it("exports RESERVED_FORMULA_KEYS and unique VALID_ID_PREFIXES", () => {
    expect(constants.RESERVED_FORMULA_KEYS).toEqual([
      "defesa",
      "defense",
      "hp",
      "vida",
      "mp",
      "energia",
      "nivel"
    ]);
    expect(Array.isArray(constants.VALID_ID_PREFIXES)).toBe(true);
    expect(new Set(constants.VALID_ID_PREFIXES).size).toBe(
      constants.VALID_ID_PREFIXES.length
    );
    for (const prefix of Object.values(constants.ID_PREFIXES)) {
      expect(constants.VALID_ID_PREFIXES).toContain(prefix);
    }
    expect(constants.ID_PREFIXES.CHARACTER).toBe("char");
    expect(constants.ID_PREFIXES.DRAWING).toBe("drw");
    expect(constants.ID_PREFIXES.SAVE).toBe("save");
  });

  it("deep-freezes every exported object and array", () => {
    for (const exportedValue of Object.values(constants)) {
      assertDeepFrozen(exportedValue);
    }
    expect(() => {
      constants.DEFAULT_MAP_DIMENSIONS.widthPx = 800;
    }).toThrow(TypeError);
    expect(() => {
      constants.DEFAULT_ATTRIBUTES[0].value = 99;
    }).toThrow(TypeError);
    expect(() => {
      constants.VALID_ID_PREFIXES.push("evil");
    }).toThrow(TypeError);
  });
});
