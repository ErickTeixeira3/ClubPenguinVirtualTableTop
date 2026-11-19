import { describe, expect, it } from "vitest";
import {
  EFFECT_TYPES,
  RESOURCE_KEYS,
  ROLL_KINDS,
  ROLL_SOURCE_TYPES,
  TRIGGER_TYPES
} from "../../../../src/domain/constants.js";
import {
  buildHotbarSlotFromRoll,
  buildShortcutRollParams,
  buildSkillFormula,
  resolveDynamicRollEntry,
  resolveHotbarSlot
} from "../../../../src/engines/rolls/index.js";

const SAMPLE_CHARACTER = {
  attributes: {
    forca: { key: "forca", label: "Força", value: 3 },
    agilidade: { key: "agilidade", label: "Agilidade", value: 4 }
  },
  skills: {
    sk_luta: {
      key: "sk_luta",
      name: "Luta",
      attributeKey: "forca",
      bonus: 5,
      icon: "fist"
    },
    sk_furtividade: {
      key: "sk_furtividade",
      name: "Furtividade",
      attributeKey: "agilidade",
      bonus: -2
    },
    sk_zero: {
      key: "sk_zero",
      name: "Atletismo",
      attributeKey: "forca",
      bonus: 0
    }
  },
  abilities: {
    ab_1: {
      id: "ab_1",
      name: "Bola de Fogo",
      icon: "fire",
      elementColor: "#ff5500",
      hitFormula: "1d20 + @intelecto",
      effectFormula: "3d6",
      effectType: EFFECT_TYPES.DAMAGE,
      cost: { resource: RESOURCE_KEYS.MP, amount: 4 },
      trigger: TRIGGER_TYPES.ACTIVE,
      description: "Explosão flamejante"
    },
    ab_heal: {
      id: "ab_heal",
      name: "Restaurar Energia",
      effectFormula: "2d4",
      effectType: EFFECT_TYPES.MP_HEAL,
      rollKind: ROLL_KINDS.MP_HEAL
    }
  },
  inventory: {
    inv_1: {
      id: "inv_1",
      name: "Poção de Mana",
      icon: "potion_blue",
      elementColor: "#2288ff",
      rollFormula: "2d4 + 2",
      effectType: EFFECT_TYPES.MP_HEAL,
      consumeOnUse: true,
      qty: 3
    }
  },
  rollGroups: {
    grp_combate: {
      id: "grp_combate",
      name: "Ações de Combate",
      rolls: {
        r_ab1: {
          id: "r_ab1",
          order: 0,
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_1" },
          overrides: {}
        },
        r_missing: {
          id: "r_missing",
          order: 1,
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_deleted" },
          overrides: { name: "Bola de Fogo" }
        }
      }
    }
  }
};

describe("engines/rolls/shortcutResolver", () => {
  describe("buildSkillFormula", () => {
    it("formats positive, negative, zero, and missing bonuses cleanly", () => {
      expect(buildSkillFormula(null)).toBe("1d20 + @forca");
      expect(
        buildSkillFormula({ attributeKey: "agilidade", bonus: 5 })
      ).toBe("1d20 + @agilidade + 5");
      expect(
        buildSkillFormula({ attributeKey: "agilidade", bonus: -2 })
      ).toBe("1d20 + @agilidade - 2");
      expect(buildSkillFormula({ attributeKey: "forca", bonus: 0 })).toBe(
        "1d20 + @forca"
      );
      expect(buildSkillFormula({ attributeKey: "  ", bonus: "bad" })).toBe(
        "1d20 + @forca"
      );
    });
  });

  describe("resolveDynamicRollEntry", () => {
    it("returns null for nullish or primitive entries", () => {
      expect(resolveDynamicRollEntry(null, SAMPLE_CHARACTER)).toBeNull();
      expect(resolveDynamicRollEntry("bad", SAMPLE_CHARACTER)).toBeNull();
    });

    it("resolves ability, skill, item, attribute, and custom entries from v2 maps", () => {
      const ab = resolveDynamicRollEntry(
        {
          id: "r1",
          order: 2,
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_1" }
        },
        SAMPLE_CHARACTER
      );
      expect(ab).toMatchObject({
        id: "r1",
        order: 2,
        name: "Bola de Fogo",
        icon: "fire",
        color: "#ff5500",
        rollKind: ROLL_KINDS.ATTACK,
        cost: { resource: RESOURCE_KEYS.MP, amount: 4 },
        isLinkedMissing: false
      });

      const abHeal = resolveDynamicRollEntry(
        {
          id: "r2",
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_heal" }
        },
        SAMPLE_CHARACTER
      );
      expect(abHeal.rollKind).toBe(ROLL_KINDS.MP_HEAL);
      expect(abHeal.icon).toBe("sword");

      const sk = resolveDynamicRollEntry(
        {
          id: "r3",
          source: { type: ROLL_SOURCE_TYPES.SKILL, id: "sk_furtividade" }
        },
        SAMPLE_CHARACTER
      );
      expect(sk).toMatchObject({
        name: "Furtividade",
        icon: "clover",
        hitFormula: "1d20 + @agilidade - 2",
        rollKind: ROLL_KINDS.CHECK,
        description: "Perícia (agilidade -2)",
        isLinkedMissing: false
      });

      const item = resolveDynamicRollEntry(
        {
          id: "r4",
          source: { type: ROLL_SOURCE_TYPES.ITEM, id: "inv_1" }
        },
        SAMPLE_CHARACTER
      );
      expect(item).toMatchObject({
        name: "Poção de Mana",
        icon: "potion_blue",
        rollKind: ROLL_KINDS.MP_HEAL,
        consumeOnUse: true,
        qty: 3,
        isLinkedMissing: false
      });

      const attr = resolveDynamicRollEntry(
        {
          id: "r5",
          source: { type: ROLL_SOURCE_TYPES.ATTRIBUTE, id: "forca" }
        },
        SAMPLE_CHARACTER
      );
      expect(attr).toMatchObject({
        name: "Teste Força",
        hitFormula: "1d20 + @forca",
        rollKind: ROLL_KINDS.CHECK,
        isLinkedMissing: false
      });

      const customNoEffect = resolveDynamicRollEntry(
        {
          id: "r6",
          source: { type: ROLL_SOURCE_TYPES.CUSTOM, id: null },
          overrides: { name: "Iniciativa", icon: "bolt", color: "#112233" },
          custom: {
            hitFormula: "1d20 + @agilidade",
            effectFormula: "",
            effectType: EFFECT_TYPES.DAMAGE,
            cost: { resource: RESOURCE_KEYS.HP, amount: 2 }
          }
        },
        SAMPLE_CHARACTER
      );
      expect(customNoEffect).toMatchObject({
        name: "Iniciativa",
        icon: "bolt",
        color: "#112233",
        effectType: null,
        rollKind: ROLL_KINDS.CHECK,
        cost: { resource: RESOURCE_KEYS.HP, amount: 2 },
        isLinkedMissing: false
      });
    });

    it("applies overrides over live entity and handles minimal entity fallbacks", () => {
      const overridden = resolveDynamicRollEntry(
        {
          id: "r_ov",
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_heal" },
          overrides: { name: "Custom Name", icon: "star", color: "#00ff00" }
        },
        SAMPLE_CHARACTER
      );
      expect(overridden.name).toBe("Custom Name");
      expect(overridden.icon).toBe("star");
      expect(overridden.color).toBe("#00ff00");

      const minimalChar = {
        abilities: { ab_min: {} },
        skills: { sk_min: {} },
        inventory: { it_min: { qty: "bad" } },
        attributes: { attr_min: {} }
      };
      expect(
        resolveDynamicRollEntry(
          {
            order: "bad",
            source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_min" }
          },
          minimalChar
        )
      ).toMatchObject({
        order: 0,
        name: "Rolagem",
        icon: "sword",
        rollKind: ROLL_KINDS.CHECK
      });
      expect(
        resolveDynamicRollEntry(
          { source: { type: ROLL_SOURCE_TYPES.SKILL, id: "sk_min" } },
          minimalChar
        )
      ).toMatchObject({ name: "Rolagem", icon: "clover", hitFormula: "1d20 + @forca" });
      expect(
        resolveDynamicRollEntry(
          { source: { type: ROLL_SOURCE_TYPES.ITEM, id: "it_min" } },
          minimalChar
        )
      ).toMatchObject({ name: "Rolagem", icon: "sword", qty: 0 });
      expect(
        resolveDynamicRollEntry(
          { source: { type: ROLL_SOURCE_TYPES.ATTRIBUTE, id: "attr_min" } },
          minimalChar
        )
      ).toMatchObject({ name: "Teste attr_min", hitFormula: "1d20 + @attr_min" });

      const omittedSource = resolveDynamicRollEntry(
        {
          custom: { effectFormula: "1d6" }
        },
        minimalChar
      );
      expect(omittedSource.effectType).toBe(EFFECT_TYPES.DAMAGE);
      expect(omittedSource.rollKind).toBe(ROLL_KINDS.DAMAGE);
    });

    it("returns isLinkedMissing: true for missing links, unknown types, or prototype keys without matching by name", () => {
      const missingByName = resolveDynamicRollEntry(
        {
          id: "r_miss",
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "ab_nonexistent" },
          overrides: { name: "Bola de Fogo" }
        },
        SAMPLE_CHARACTER
      );
      expect(missingByName.isLinkedMissing).toBe(true);
      expect(missingByName.name).toBe("Bola de Fogo");

      const protoKey = resolveDynamicRollEntry(
        {
          id: "r_proto",
          source: { type: ROLL_SOURCE_TYPES.ABILITY, id: "constructor" }
        },
        SAMPLE_CHARACTER
      );
      expect(protoKey.isLinkedMissing).toBe(true);

      const unknownSource = resolveDynamicRollEntry(
        {
          id: "r_unk",
          source: { type: "spell_unknown", id: "x" },
          custom: { rollKind: ROLL_KINDS.SAVING_THROW }
        },
        null
      );
      expect(unknownSource.isLinkedMissing).toBe(true);
      expect(unknownSource.rollKind).toBe(ROLL_KINDS.SAVING_THROW);
    });
  });

  describe("resolveHotbarSlot", () => {
    it("returns null for nullish/non-object slots", () => {
      expect(resolveHotbarSlot(null, SAMPLE_CHARACTER)).toBeNull();
      expect(resolveHotbarSlot("1", SAMPLE_CHARACTER)).toBeNull();
    });

    it("resolves live roll group entry and omitted rollGroupId scan strictly by ID", () => {
      const resolved = resolveHotbarSlot(
        { rollGroupId: "grp_combate", rollId: "r_ab1" },
        SAMPLE_CHARACTER
      );
      expect(resolved).toMatchObject({
        id: "r_ab1",
        rollGroupId: "grp_combate",
        rollId: "r_ab1",
        name: "Bola de Fogo",
        isLinkedMissing: false
      });

      const scanned = resolveHotbarSlot({ rollId: "r_ab1" }, SAMPLE_CHARACTER);
      expect(scanned.rollGroupId).toBe("grp_combate");
      expect(scanned.isLinkedMissing).toBe(false);

      const unsafeGroupMap = JSON.parse(
        '{"__proto__": {"rolls": {"r_x": {"source": {"type": "custom"}}}}, "grp_safe": {"rolls": {"r_x": {"source": {"type": "custom"}}}}}'
      );
      const scannedSafe = resolveHotbarSlot(
        { rollId: "r_x" },
        { rollGroups: unsafeGroupMap }
      );
      expect(scannedSafe.rollGroupId).toBe("grp_safe");
      expect(scannedSafe.id).toBe("r_x");
      expect(scannedSafe.isLinkedMissing).toBe(false);
    });

    it("returns missing descriptor when group, roll, or linked entity is missing or unsafe", () => {
      expect(
        resolveHotbarSlot(
          { rollGroupId: "grp_missing", rollId: "r_ab1" },
          SAMPLE_CHARACTER
        ).isLinkedMissing
      ).toBe(true);

      expect(
        resolveHotbarSlot(
          { rollGroupId: "grp_combate", rollId: "r_missing" },
          SAMPLE_CHARACTER
        ).isLinkedMissing
      ).toBe(true);

      expect(
        resolveHotbarSlot(
          { rollGroupId: "__proto__", rollId: "r_ab1" },
          SAMPLE_CHARACTER
        ).isLinkedMissing
      ).toBe(true);
    });
  });

  describe("buildHotbarSlotFromRoll", () => {
    it("returns reference-only { rollGroupId, rollId } or null when incomplete", () => {
      expect(buildHotbarSlotFromRoll(null)).toBeNull();
      expect(buildHotbarSlotFromRoll({ id: "r_1" })).toBeNull();
      expect(buildHotbarSlotFromRoll({ rollGroupId: "grp_1" })).toBeNull();

      const slot = buildHotbarSlotFromRoll(
        {
          id: "r_1",
          rollGroupId: "grp_1",
          name: "Should Not Copy",
          hitFormula: "1d20"
        },
        "grp_override"
      );
      expect(slot).toEqual({ rollGroupId: "grp_override", rollId: "r_1" });
    });
  });

  describe("buildShortcutRollParams", () => {
    it("returns null for non-object and formats primaryLabel, cost, and fallbacks", () => {
      expect(buildShortcutRollParams(null)).toBeNull();

      const attack = buildShortcutRollParams(
        {
          name: "Espada",
          hitFormula: "1d20 + @forca",
          effectFormula: "1d8",
          rollKind: ROLL_KINDS.ATTACK,
          cost: { resource: RESOURCE_KEYS.MP, amount: 3 }
        },
        SAMPLE_CHARACTER
      );
      expect(attack.primaryLabel).toBe("Acerto");
      expect(attack.cost).toEqual({ resource: RESOURCE_KEYS.MP, amount: 3 });
      expect(attack.character).toBe(SAMPLE_CHARACTER);

      const save = buildShortcutRollParams({
        rollKind: ROLL_KINDS.SAVING_THROW,
        cost: { resource: RESOURCE_KEYS.MP, amount: 0 }
      });
      expect(save.primaryLabel).toBe("Resistência");
      expect(save.cost).toBeNull();

      const inferred = buildShortcutRollParams({
        hitFormula: "",
        effectFormula: "2d6"
      });
      expect(inferred.primaryLabel).toBe("Rolagem");
      expect(inferred.rollKind).toBe(ROLL_KINDS.DAMAGE);
      expect(inferred.title).toBe("Rolagem");
      expect(inferred.icon).toBe("sword");

      const emptyParams = buildShortcutRollParams({});
      expect(emptyParams.rollKind).toBe(ROLL_KINDS.CHECK);
      expect(emptyParams.effectType).toBeNull();
    });
  });
});
