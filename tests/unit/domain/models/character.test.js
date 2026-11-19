import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  fromCharacterDoc,
  normalizeCharacter,
  normalizeCharacterAttributes,
  normalizeCharacterSkills,
  normalizeFormulaKey,
  toCharacterDoc,
  validateCharacter
} from "../../../../src/domain/models/character.js";

function makeValidChar(overrides = {}) {
  return normalizeCharacter(
    {
      id: "char_1",
      campaignId: "camp_1",
      type: "pc",
      ownerId: "u_1",
      name: "Pinguim Guerreiro",
      ...overrides
    }
  );
}

describe("domain/models/character", () => {
  it("normalizes formula keys and default v2 character structure", () => {
    expect(normalizeFormulaKey("  Atenção & Fúria! ")).toBe("atencaofuria");
    expect(normalizeFormulaKey(null)).toBe("");

    const char = makeValidChar();
    expect(char.level).toBe(1);
    expect(char.defense).toBe(12);
    expect(char.resources).toEqual({
      hp: { current: 25, max: 25 },
      mp: { current: 15, max: 15 }
    });
    expect(Object.keys(char.attributes)).toEqual([
      "forca",
      "agilidade",
      "intelecto",
      "vigor",
      "espirito"
    ]);
    expect(Object.keys(char.hotbar)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9"
    ]);
    expect(validateCharacter(char)).toEqual({ ok: true, errors: [] });

    const docOut = toCharacterDoc(char);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut.token).not.toHaveProperty("ringColor");
    expect(fromCharacterDoc(docOut, "char_1")).toEqual(char);
  });

  it("converts v1 array attributes, skills, abilities, inventory, rollGroups, hotbar, and remaps sk_* IDs", () => {
    const legacyDoc = {
      campaignId: "camp_1",
      type: "pc",
      ownerId: "u_1",
      name: "Mago",
      avatarMediaId: "med_av",
      avatarExternalUrl: "https://ignored.com/av.png",
      defaultToken: {
        mediaId: "med_tok",
        sizeInCells: 2,
        showName: false,
        ringColor: "#ff0000"
      },
      attributes: [
        { key: "forca", label: "Força", value: 3 },
        { key: "intelecto", label: "Intelecto", value: 5 }
      ],
      skills: [
        { id: "sk_101", name: "Arcanismo!", attribute: "intelecto", bonus: 4 }
      ],
      abilities: [
        {
          id: "ab_1",
          name: "Bola de Fogo",
          costResource: "mp",
          costAmount: 5,
          rangeType: "ranged",
          rangeMeters: 18,
          aoeType: "circle",
          aoeRadiusMeters: 6,
          savingThrow: {
            enabled: true,
            dcFormula: "0",
            attribute: "reflexos"
          }
        }
      ],
      inventory: [
        {
          id: "inv_1",
          name: "Poção",
          quantity: 3,
          consumeOnUse: true
        }
      ],
      rollGroups: [
        {
          id: "grp_combate",
          name: "Ações de Combate",
          rolls: [
            {
              id: "r_1",
              sourceType: "skill",
              sourceId: "sk_101",
              customName: "Teste Arcano"
            },
            {
              id: "r_2",
              sourceType: "custom",
              hitFormula: "1d20+@intelecto",
              effectFormula: "2d6",
              rollKind: "attack",
              effectType: "damage"
            }
          ]
        }
      ],
      hotbar: [
        { rollId: "r_1" },
        { rollGroupId: "grp_combate", rollId: "r_2" },
        { rollId: "missing_roll" }
      ]
    };

    const converted = fromCharacterDoc(legacyDoc, "char_legacy");
    expect(converted.avatar).toEqual({ mediaId: "med_av", url: null });
    expect(converted.token).toEqual({
      image: { mediaId: "med_tok", url: null },
      sizeInCells: 2,
      showName: false
    });
    expect(converted.skills.arcanismo).toEqual({
      key: "arcanismo",
      name: "Arcanismo!",
      attributeKey: "intelecto",
      bonus: 4,
      order: 0
    });
    expect(converted.abilities.ab_1.cost).toEqual({ resource: "mp", amount: 5 });
    expect(converted.abilities.ab_1.range).toEqual({
      type: "ranged",
      distanceMeters: 18
    });
    expect(converted.abilities.ab_1.aoe).toEqual({
      type: "circle",
      radiusMeters: 6,
      coneAngleDeg: 45
    });
    expect(converted.abilities.ab_1.savingThrow).toEqual({
      enabled: true,
      dcFormula: "0",
      attributeKey: "reflexos",
      effectDescription: ""
    });
    expect(converted.inventory.inv_1.qty).toBe(3);
    expect(converted.rollGroups.grp_combate.rolls.r_1.source).toEqual({
      type: "skill",
      id: "arcanismo"
    });
    expect(converted.rollGroups.grp_combate.rolls.r_1.overrides).toEqual({
      name: "Teste Arcano"
    });
    expect(converted.rollGroups.grp_combate.rolls.r_1.custom).toBeUndefined();
    expect(converted.rollGroups.grp_combate.rolls.r_2.custom).toBeDefined();
    expect(converted.hotbar["1"]).toEqual({
      rollGroupId: "grp_combate",
      rollId: "r_1"
    });
    expect(converted.hotbar["2"]).toEqual({
      rollGroupId: "grp_combate",
      rollId: "r_2"
    });
    expect(converted.hotbar["3"]).toBeNull();
    expect(validateCharacter(converted)).toEqual({ ok: true, errors: [] });
  });

  it("enforces §6.3.6 unique attr/skill keys vs RESERVED_FORMULA_KEYS and hotbar/savingThrow invariants", () => {
    const reservedAttr = makeValidChar({
      attributes: {
        defesa: { key: "defesa", label: "Defesa", value: 10, order: 0 }
      }
    });
    expect(validateCharacter(reservedAttr).errors.map((e) => e.code)).toContain(
      ERROR_CODES.RESERVED_KEY
    );

    const reservedSkill = makeValidChar({
      skills: {
        nivel: { key: "nivel", name: "Nivel", attributeKey: "forca", bonus: 0, order: 0 }
      }
    });
    expect(validateCharacter(reservedSkill).errors.map((e) => e.code)).toContain(
      ERROR_CODES.RESERVED_KEY
    );

    const collidingSkill = makeValidChar({
      skills: {
        forca: { key: "forca", name: "Força", attributeKey: "forca", bonus: 1, order: 0 }
      }
    });
    expect(validateCharacter(collidingSkill).errors.map((e) => e.code)).toContain(
      ERROR_CODES.KEY_COLLISION
    );

    const badHotbar = makeValidChar({
      hotbar: {
        1: { rollGroupId: "grp_combate", rollId: "nonexistent" }
      }
    });
    expect(validateCharacter(badHotbar).errors.map((e) => e.code)).toContain(
      ERROR_CODES.INVALID_REFERENCE
    );

    const badSave = makeValidChar({
      abilities: {
        ab_1: {
          id: "ab_1",
          name: "Golpe",
          savingThrow: {
            enabled: true,
            dcFormula: "   ",
            attributeKey: "nao_existe"
          }
        }
      }
    });
    const saveCodes = validateCharacter(badSave).errors.map((e) => e.code);
    expect(saveCodes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(saveCodes).toContain(ERROR_CODES.INVALID_ENUM_VALUE);
  });

  it("protects against UNSAFE_KEYS and rejects legacy fields and out-of-range values", () => {
    const polluted = JSON.parse(
      '{"__proto__":{"key":"x","value":1},"constructor":{"key":"y","value":2},"forca":3}'
    );
    const attrs = normalizeCharacterAttributes(polluted);
    expect(Object.hasOwn(attrs, "__proto__")).toBe(false);
    expect(Object.hasOwn(attrs, "constructor")).toBe(false);
    expect(attrs.forca.value).toBe(3);

    const pollutedSkills = JSON.parse(
      '{"__proto__":{"name":"Bad"},"luta":{"name":"Luta","attributeKey":"forca","bonus":2}}'
    );
    const skills = normalizeCharacterSkills(pollutedSkills, { legacyMode: true });
    expect(Object.hasOwn(skills, "__proto__")).toBe(false);
    expect(skills.luta.bonus).toBe(2);

    expect(validateCharacter(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const tooManyOps = {};
    for (let i = 0; i < 51; i += 1) {
      tooManyOps[`op_${i}`] = i;
    }

    const badChar = {
      ...makeValidChar({
        id: "",
        campaignId: "",
        type: "boss",
        folderId: "bad/folder",
        name: "",
        cardColor: "",
        level: 0,
        xp: -1,
        rev: -1,
        token: { image: { mediaId: null, url: null }, sizeInCells: 9, showName: true },
        recentOps: tooManyOps
      }),
      defaultToken: {}
    };
    const res = validateCharacter(badChar);
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.INVALID_ENUM_VALUE);
    expect(codes).toContain(ERROR_CODES.INVALID_REFERENCE);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);

    const mapAttrsAndLegacyHotbar = fromCharacterDoc(
      {
        campaignId: "c1",
        ownerId: "u1",
        name: 123,
        cardColor: 123,
        folderId: 99,
        deletedBy: " ",
        attributes: {
          forca: 4,
          bad_null: null,
          agilidade: { key: "agilidade", label: "Agilidade", value: "3" }
        },
        skills: {
          acrobacia: { name: "Acrobacia", attribute: "agilidade", bonus: "2" },
          bad_null: null
        },
        abilities: {
          ab_1: {
            id: "ab_1",
            name: "Gelo",
            cost: { resource: "mp", amount: 1 },
            rollKind: "damage",
            range: { type: "touch", distanceMeters: 1.5 },
            aoe: { type: "single", radiusMeters: 0, coneAngleDeg: 45 },
            savingThrow: null
          }
        },
        inventory: {
          inv_1: { id: "inv_1", name: "Item", qty: "2", rollKind: "utility" }
        },
        rollGroups: {
          grp_combate: {
            id: "grp_combate",
            name: "Combate",
            rolls: {
              r_1: {
                id: "r_1",
                source: { type: "ability", id: "ab_1" },
                overrides: { name: "N", icon: "star", color: "#111" }
              },
              r_2: {
                id: "r_2",
                sourceType: "custom",
                custom: {
                  hitFormula: "1d20",
                  effectFormula: "1d6",
                  rollKind: "attack",
                  effectType: "damage"
                }
              }
            }
          }
        },
        hotbar: {
          1: { rollId: "r_1" },
          2: null
        }
      },
      null,
      null
    );
    expect(mapAttrsAndLegacyHotbar.attributes.forca.value).toBe(4);
    expect(mapAttrsAndLegacyHotbar.hotbar["1"].rollGroupId).toBe("grp_combate");
    expect(mapAttrsAndLegacyHotbar.inventory.inv_1.qty).toBe(2);

    const badSubStructures = validateCharacter({
      id: "char_bad",
      campaignId: "c1",
      type: "pc",
      ownerId: "u1",
      visibleTo: ["u1"],
      editableBy: ["u1"],
      folderId: "  ",
      name: "Pingu",
      cardColor: "#000",
      level: 1,
      xp: 0,
      coins: 0,
      defense: 10,
      movementBudgetMeters: 9,
      rev: 0,
      avatar: { mediaId: null, url: null },
      token: "bad",
      resources: "bad",
      attributes: "bad",
      skills: "bad",
      abilities: "bad",
      inventory: "bad",
      rollGroups: "bad",
      hotbar: "bad",
      recentOps: "bad"
    });
    expect(badSubStructures.ok).toBe(false);

    const badMapEntries = validateCharacter({
      ...makeValidChar({}),
      token: { image: { mediaId: null, url: null }, sizeInCells: 1, showName: "no" },
      resources: { hp: "bad", mp: { current: -1, max: "bad" } },
      attributes: JSON.parse('{"__proto__":{},"bad_null":null,"bad_val":{"key":"wrong","value":"NaN"}}'),
      skills: JSON.parse('{"__proto__":{},"bad_null":null,"bad_sk":{"key":"wrong","attributeKey":"","bonus":"NaN"}}'),
      abilities: JSON.parse('{"__proto__":{},"bad_ab":{"id":"wrong"},"ab_bad":{"id":"ab_bad","trigger":"bad","effectType":"bad","rollKind":"bad","cost":{"resource":"bad","amount":-1},"savingThrow":"bad"}}'),
      inventory: JSON.parse('{"__proto__":{},"bad_it":{"id":"wrong"},"it_bad":{"id":"it_bad","qty":-1,"trigger":"bad","effectType":"bad","rollKind":"bad","savingThrow":{"attribute":"forca","enabled":"no","dcFormula":1,"attributeKey":"forca","effectDescription":1}}}'),
      rollGroups: JSON.parse('{"__proto__":{},"bad_grp":{"id":"wrong"},"grp_bad":{"id":"grp_bad","rolls":"bad"},"grp_bad2":{"id":"grp_bad2","rolls":{"__proto__":{},"bad_r":{"id":"wrong"},"r_bad":{"id":"r_bad","source":{"type":"bad"}},"r_cust":{"id":"r_cust","source":{"type":"custom","id":null},"custom":{"rollKind":"bad","effectType":"bad","savingThrow":null}}}}}'),
      hotbar: { 1: null },
      recentOps: JSON.parse('{"__proto__":1,"bad":-1}')
    });
    expect(badMapEntries.ok).toBe(false);

    const badHotbarSlotShape = validateCharacter({
      ...makeValidChar(),
      hotbar: {
        1: "bad_slot",
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null
      }
    });
    expect(badHotbarSlotShape.ok).toBe(false);
    expect(fromCharacterDoc(null, null, null).name).toBe("Novo Pinguim");
    expect(normalizeCharacter(null, null).level).toBe(1);
    expect(
      normalizeCharacterAttributes([null, { key: "__proto__", value: 1 }, { label: "Força", value: "2" }])
        .forca.value
    ).toBe(2);
    expect(
      normalizeCharacterSkills([null, { name: "__proto__" }, { name: "Luta", bonus: "1" }])
        .luta.bonus
    ).toBe(1);
  });
});
