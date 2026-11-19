import { describe, expect, it } from "vitest";
import { DEFAULT_ATTRIBUTES } from "../../../src/domain/constants.js";
import {
  DEFAULT_ABILITY_COST,
  DEFAULT_AOE,
  DEFAULT_CHARACTER_DEFENSE,
  DEFAULT_CHARACTER_HP,
  DEFAULT_CHARACTER_MP,
  DEFAULT_COLORS,
  DEFAULT_COMBATANT_BUDGETS,
  DEFAULT_COMBAT_STATE,
  DEFAULT_FOG_DEFAULTS,
  DEFAULT_FREE_TOKEN_DEFENSE,
  DEFAULT_FREE_TOKEN_RESOURCES,
  DEFAULT_GRID_CONFIG,
  DEFAULT_NAMES,
  DEFAULT_RANGE,
  DEFAULT_ROLL_GROUP_ID,
  DEFAULT_ROLL_GROUP_NAME,
  DEFAULT_SAVING_THROW,
  calculateDefaultCharacterDefense,
  createDefaultAbilityCost,
  createDefaultAoe,
  createDefaultAttributesMap,
  createDefaultCharacterDefaults,
  createDefaultCharacterResources,
  createDefaultCompendiumDefaults,
  createDefaultHotbar,
  createDefaultRange,
  createDefaultRollGroup,
  createDefaultSavingThrow,
  createDefaultSceneDefaults,
  createDefaultTokenDefaults
} from "../../../src/domain/defaults.js";

describe("domain/defaults", () => {
  it("exposes unified canonical defaults", () => {
    expect(DEFAULT_CHARACTER_HP).toEqual({ current: 25, max: 25 });
    expect(DEFAULT_CHARACTER_MP).toEqual({ current: 15, max: 15 });
    expect(DEFAULT_CHARACTER_DEFENSE).toBe(12);

    expect(DEFAULT_FREE_TOKEN_DEFENSE).toBe(10);
    expect(DEFAULT_FREE_TOKEN_RESOURCES).toEqual({ hp: null, mp: null });

    expect(DEFAULT_SAVING_THROW).toEqual({
      enabled: false,
      dcFormula: "12",
      attributeKey: "resistencia",
      effectDescription: ""
    });
    expect(DEFAULT_RANGE).toEqual({ type: "ranged", distanceMeters: 9 });
    expect(DEFAULT_AOE).toEqual({
      type: "single",
      radiusMeters: 6,
      coneAngleDeg: 45
    });
    expect(DEFAULT_ABILITY_COST).toEqual({ resource: "mp", amount: 0 });

    expect(DEFAULT_ROLL_GROUP_ID).toBe("grp_combate");
    expect(DEFAULT_ROLL_GROUP_NAME).toBe("Ações de Combate");

    expect(DEFAULT_GRID_CONFIG).toEqual({
      enabled: true,
      snapToGrid: true,
      cellSizePx: 64,
      offsetX: 0,
      offsetY: 0,
      color: "#ffffff",
      opacity: 0.28
    });
    expect(DEFAULT_FOG_DEFAULTS).toEqual({
      enabled: false,
      defaultOpaque: false
    });
    expect(DEFAULT_COLORS.characterCard).toBe("#02529c");
    expect(DEFAULT_COLORS.tokenRing).toBe("#3090f0");
    expect(DEFAULT_NAMES.character).toBe("Novo Pinguim");
    expect(DEFAULT_NAMES.rollGroup).toBe("Ações de Combate");
    expect(DEFAULT_COMBATANT_BUDGETS).toEqual({
      movementBudgetMeters: 9,
      movementUsedMeters: 0,
      actionsMax: 1,
      actionsRemaining: 1,
      reactionsMax: 1,
      reactionsRemaining: 1
    });
    expect(DEFAULT_COMBAT_STATE).toEqual({
      active: false,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true,
      turnOrder: []
    });
  });

  it("deep-freezes all exported default objects and nested structures", () => {
    const frozenTargets = [
      DEFAULT_CHARACTER_HP,
      DEFAULT_CHARACTER_MP,
      DEFAULT_FREE_TOKEN_RESOURCES,
      DEFAULT_SAVING_THROW,
      DEFAULT_RANGE,
      DEFAULT_AOE,
      DEFAULT_ABILITY_COST,
      DEFAULT_GRID_CONFIG,
      DEFAULT_FOG_DEFAULTS,
      DEFAULT_COLORS,
      DEFAULT_NAMES,
      DEFAULT_COMBATANT_BUDGETS,
      DEFAULT_COMBAT_STATE,
      DEFAULT_COMBAT_STATE.turnOrder
    ];
    for (const target of frozenTargets) {
      expect(Object.isFrozen(target)).toBe(true);
    }
    expect(() => {
      DEFAULT_CHARACTER_HP.current = 0;
    }).toThrow(TypeError);
    expect(() => {
      DEFAULT_COMBAT_STATE.turnOrder.push({});
    }).toThrow(TypeError);
  });

  it("calculates character defense and resources while preserving explicit zero", () => {
    expect(calculateDefaultCharacterDefense()).toBe(12);
    expect(calculateDefaultCharacterDefense(null)).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: "" })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: "   " })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: false })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: true })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: [] })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: {} })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: NaN })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: Infinity })).toBe(12);
    expect(calculateDefaultCharacterDefense({ defense: 0 })).toBe(0);
    expect(calculateDefaultCharacterDefense({ defense: "0" })).toBe(0);
    expect(calculateDefaultCharacterDefense({ defense: " 15 " })).toBe(15);
    expect(calculateDefaultCharacterDefense({ defense: 16 })).toBe(16);

    expect(createDefaultCharacterResources()).toEqual({
      hp: { current: 25, max: 25 },
      mp: { current: 15, max: 15 }
    });
    expect(createDefaultCharacterResources(null)).toEqual({
      hp: { current: 25, max: 25 },
      mp: { current: 15, max: 15 }
    });
    expect(
      createDefaultCharacterResources({
        hp: { current: "   ", max: false },
        mp: { current: [], max: true }
      })
    ).toEqual({
      hp: { current: 25, max: 25 },
      mp: { current: 15, max: 15 }
    });
    expect(
      createDefaultCharacterResources({
        hp: { current: 0, max: 30 },
        mp: { current: "0" }
      })
    ).toEqual({
      hp: { current: 0, max: 30 },
      mp: { current: 0, max: 15 }
    });
  });

  it("builds fresh attribute maps and 9-slot hotbars", () => {
    const attrsA = createDefaultAttributesMap();
    const attrsB = createDefaultAttributesMap();

    expect(Object.keys(attrsA)).toEqual(DEFAULT_ATTRIBUTES.map((a) => a.key));
    expect(attrsA.forca).toEqual({
      key: "forca",
      label: "Força",
      value: 2,
      order: 0
    });
    expect(attrsA.espirito.order).toBe(4);

    attrsA.forca.value = 99;
    expect(attrsB.forca.value).toBe(2);

    const hotbarA = createDefaultHotbar();
    const hotbarB = createDefaultHotbar();
    expect(Object.keys(hotbarA)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
    expect(Object.values(hotbarA).every((v) => v === null)).toBe(true);
    hotbarA["1"] = { rollGroupId: "grp_combate", rollId: "r_1" };
    expect(hotbarB["1"]).toBeNull();
  });

  it("creates savingThrow with attributeKey fallback, zero dcFormula preservation, and fresh copies", () => {
    expect(createDefaultSavingThrow()).toEqual({
      enabled: false,
      dcFormula: "12",
      attributeKey: "resistencia",
      effectDescription: ""
    });
    expect(createDefaultSavingThrow(null)).toEqual(DEFAULT_SAVING_THROW);
    expect(
      createDefaultSavingThrow({
        enabled: true,
        dcFormula: 0,
        attribute: "vontade",
        effectDescription: "Atordoado"
      })
    ).toEqual({
      enabled: true,
      dcFormula: "0",
      attributeKey: "vontade",
      effectDescription: "Atordoado"
    });
    expect(
      createDefaultSavingThrow({
        dcFormula: "  ",
        attributeKey: "reflexos",
        attribute: "vontade",
        effectDescription: 123
      })
    ).toEqual({
      enabled: false,
      dcFormula: "12",
      attributeKey: "reflexos",
      effectDescription: ""
    });

    for (const invalidDc of [NaN, Infinity, -Infinity, false, true, {}, []]) {
      expect(createDefaultSavingThrow({ dcFormula: invalidDc }).dcFormula).toBe(
        "12"
      );
    }
    expect(createDefaultSavingThrow({ dcFormula: " 15 " }).dcFormula).toBe("15");
  });

  it("creates range, aoe, abilityCost, and rollGroup with overrides and isolation", () => {
    expect(createDefaultRange()).toEqual({ type: "ranged", distanceMeters: 9 });
    expect(createDefaultRange(null)).toEqual(DEFAULT_RANGE);
    expect(
      createDefaultRange({ type: "touch", distanceMeters: 0 })
    ).toEqual({ type: "touch", distanceMeters: 0 });
    expect(
      createDefaultRange({ type: "  ", distanceMeters: "bad" })
    ).toEqual({ type: "ranged", distanceMeters: 9 });

    expect(createDefaultAoe()).toEqual({
      type: "single",
      radiusMeters: 6,
      coneAngleDeg: 45
    });
    expect(createDefaultAoe(null)).toEqual(DEFAULT_AOE);
    expect(
      createDefaultAoe({ type: "cone", radiusMeters: 0, coneAngleDeg: 60 })
    ).toEqual({ type: "cone", radiusMeters: 0, coneAngleDeg: 60 });

    expect(createDefaultAbilityCost()).toEqual({ resource: "mp", amount: 0 });
    expect(createDefaultAbilityCost(null)).toEqual(DEFAULT_ABILITY_COST);
    expect(
      createDefaultAbilityCost({ resource: "hp", amount: 5 })
    ).toEqual({ resource: "hp", amount: 5 });
    expect(
      createDefaultAbilityCost({ resource: " ", amount: -4 })
    ).toEqual({ resource: "mp", amount: 0 });

    const sourceRoll = {
      id: "r1",
      order: 0,
      meta: { a: 1, tags: ["fire"] },
      steps: [{ kind: "damage" }]
    };
    const origInput = {
      id: "grp_magias",
      name: "Magias",
      order: 2,
      rolls: { r1: sourceRoll, r2: null, r3: ["a", "b"] }
    };
    const grp = createDefaultRollGroup(origInput);
    const grp2 = createDefaultRollGroup(origInput);
    expect(grp).toEqual({
      id: "grp_magias",
      name: "Magias",
      order: 2,
      rolls: {
        r1: {
          id: "r1",
          order: 0,
          meta: { a: 1, tags: ["fire"] },
          steps: [{ kind: "damage" }]
        },
        r2: null,
        r3: ["a", "b"]
      }
    });
    expect(Array.isArray(grp.rolls.r3)).toBe(true);
    grp.rolls.r1.order = 99;
    grp.rolls.r1.meta.a = 999;
    grp.rolls.r1.meta.tags.push("ice");
    grp.rolls.r1.steps[0].kind = "heal";
    grp.rolls.r3.push("c");
    expect(sourceRoll.order).toBe(0);
    expect(sourceRoll.meta.a).toBe(1);
    expect(sourceRoll.meta.tags).toEqual(["fire"]);
    expect(sourceRoll.steps[0].kind).toBe("damage");
    expect(origInput.rolls.r3).toEqual(["a", "b"]);
    expect(grp2.rolls.r1.meta.a).toBe(1);
    expect(grp2.rolls.r1.meta.tags).toEqual(["fire"]);

    const pollutedPayload = JSON.parse(
      '{"rolls":{"__proto__":{"isAdmin":true},"constructor":{"bad":true},"rSafe":{"__proto__":{"polluted":true},"ok":1}}}'
    );
    const safeGrp = createDefaultRollGroup(pollutedPayload);
    expect(Object.keys(safeGrp.rolls)).toEqual(["rSafe"]);
    expect(safeGrp.rolls.isAdmin).toBeUndefined();
    expect(safeGrp.rolls.rSafe).toEqual({ ok: 1 });
    expect(safeGrp.rolls.rSafe.polluted).toBeUndefined();

    expect(createDefaultRollGroup({ rolls: [] })).toEqual({
      id: "grp_combate",
      name: "Ações de Combate",
      order: 0,
      rolls: {}
    });
    expect(createDefaultRollGroup(null)).toEqual({
      id: "grp_combate",
      name: "Ações de Combate",
      order: 0,
      rolls: {}
    });
  });

  it("returns completely isolated entity default trees from all entity factories", () => {
    const charA = createDefaultCharacterDefaults();
    const charB = createDefaultCharacterDefaults();
    expect(charA.type).toBe("pc");
    expect(charA.defense).toBe(12);
    expect(charA.avatar).toEqual({ mediaId: null, url: null });
    expect(charA.token.image).toEqual({ mediaId: null, url: null });
    charA.visibleTo.push("u1");
    charA.resources.hp.current = 1;
    charA.avatar.mediaId = "media_1";
    charA.token.image.url = "https://example.com/tok.png";
    charA.rollGroups.grp_combate.rolls.r1 = { id: "r1" };
    charA.hotbar["1"] = { rollGroupId: "grp_combate", rollId: "r1" };
    expect(charB.visibleTo).toEqual([]);
    expect(charB.resources.hp.current).toBe(25);
    expect(charB.avatar).toEqual({ mediaId: null, url: null });
    expect(charB.token.image).toEqual({ mediaId: null, url: null });
    expect(charB.rollGroups.grp_combate.rolls).toEqual({});
    expect(charB.hotbar["1"]).toBeNull();

    const tokA = createDefaultTokenDefaults();
    const tokB = createDefaultTokenDefaults();
    expect(tokA.kind).toBe("free");
    expect(tokA.secrets.defense).toBe(10);
    expect(tokA.secrets.hp).toBeNull();
    expect(tokA.secrets.mp).toBeNull();
    tokA.secrets.defense = 20;
    tokA.secrets.recentOps.op1 = 100;
    expect(tokB.secrets.defense).toBe(10);
    expect(tokB.secrets.recentOps).toEqual({});

    const sceneA = createDefaultSceneDefaults();
    const sceneB = createDefaultSceneDefaults();
    expect(sceneA.mapImage.widthPx).toBe(1920);
    expect(sceneA.mapImage.heightPx).toBe(1080);
    sceneA.grid.cellSizePx = 32;
    sceneA.fogDefaults.enabled = true;
    sceneA.mapImage.image.mediaId = "media_map";
    expect(sceneB.grid.cellSizePx).toBe(64);
    expect(sceneB.fogDefaults.enabled).toBe(false);
    expect(sceneB.mapImage.image.mediaId).toBeNull();

    const compA = createDefaultCompendiumDefaults();
    const compB = createDefaultCompendiumDefaults();
    compA.cost.amount = 10;
    compA.range.distanceMeters = 18;
    compA.aoe.type = "cone";
    compA.savingThrow.enabled = true;
    expect(compB.cost.amount).toBe(0);
    expect(compB.range.distanceMeters).toBe(9);
    expect(compB.aoe.type).toBe("single");
    expect(compB.savingThrow.enabled).toBe(false);
  });
});
