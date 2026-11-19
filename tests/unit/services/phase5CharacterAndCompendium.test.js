// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../../support/fakeFirebase.js";

vi.mock("firebase/firestore", async () => (await import("../../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../../support/fakeFirebase.js")).databaseModule);
vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);
vi.mock("../../../src/services/mediaService.js", () => ({
  grantMediaAudience: vi.fn(async () => ({ updated: true })),
  uploadCompressedMedia: vi.fn(async () => ({ mediaId: "med_test_1" }))
}));
vi.mock("../../../src/services/notificationService.js", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn()
}));
vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "p1", displayName: "Jogador 1" } })
}));
vi.mock("../../../src/contexts/CampaignContext", () => ({
  useCampaign: () => ({
    campaignId: "camp1",
    campaign: { id: "camp1", gmId: "gm1", activeSceneId: "sc1" },
    isGM: false,
    isRealGM: false
  })
}));

const {
  CP_FLASH_ICONS,
  CP_ICON_CATEGORIES,
  hasCpFlashIcon,
  renderCpFlashIcon
} = await import("../../../src/components/sheets/CpFlashIcons.jsx");
const {
  createInitialInventoryFormState,
  createInitialPlayerCardEditState,
  createInitialRollsFormState,
  createInitialSkillsFormState,
  inventoryFormReducer,
  playerCardEditReducer,
  rollsFormReducer,
  skillsFormReducer
} = await import("../../../src/components/sheets/reducers/sheetFormReducers.js");
const {
  compendiumReducer,
  createInitialCompendiumState
} = await import("../../../src/components/compendium/compendiumReducer.js");
const characterService = await import("../../../src/services/characterService.js");
const compendiumService = await import("../../../src/services/compendiumService.js");
const combatService = await import("../../../src/services/combatService.js");
const tokenService = await import("../../../src/services/tokenService.js");
const { normalizeCharacter, validateCharacter } = await import("../../../src/domain/models/character.js");
const { useCharacterActions } = await import("../../../src/hooks/useCharacterActions.js");
const { AppError, ERROR_CODES } = await import("../../../src/domain/errors.js");

beforeEach(() => {
  resetFakeDb();
});

describe("CpFlashIcons — catálogo declarativo sem heurística (Fase 5.7)", () => {
  it("resolve estritamente por ID e usa sword como fallback sem adivinhar nome", () => {
    expect(hasCpFlashIcon("fluffy_fish")).toBe(true);
    expect(hasCpFlashIcon("peixe fresco")).toBe(false);
    expect(CP_ICON_CATEGORIES.some((c) => c.id === "magic")).toBe(true);
    expect(CP_FLASH_ICONS.every((i) => !Object.hasOwn(i, "keywords"))).toBe(true);

    const peixeEspadaHtml = renderToStaticMarkup(
      renderCpFlashIcon({ icon: "sword", name: "Peixe-espada" }, 32)
    );
    const swordHtml = renderToStaticMarkup(renderCpFlashIcon("sword", 32));
    expect(peixeEspadaHtml).toBe(swordHtml);

    const unknownHtml = renderToStaticMarkup(renderCpFlashIcon("peixe fresco", 32));
    expect(unknownHtml).toBe(swordHtml);

    const aliasOldHtml = renderToStaticMarkup(renderCpFlashIcon("icecream", 32));
    expect(aliasOldHtml).toBe(swordHtml);
  });
});

describe("Reducers da Ficha e do Compêndio", () => {
  it("playerCardEditReducer unifica edição de moedas e XP", () => {
    let st = createInitialPlayerCardEditState();
    st = playerCardEditReducer(st, { type: "START_EDIT", field: "coins", value: 42 });
    expect(st).toEqual({ editingField: "coins", draftValue: 42 });
    st = playerCardEditReducer(st, { type: "SET_DRAFT", value: 100 });
    expect(st.draftValue).toBe(100);
    st = playerCardEditReducer(st, { type: "CANCEL_EDIT" });
    expect(st.editingField).toBeNull();
  });

  it("skillsFormReducer mantém rascunho em erro e carrega ability v2 com attributeKey", () => {
    let st = createInitialSkillsFormState("forca");
    st = skillsFormReducer(st, {
      type: "START_EDIT_ABILITY",
      ability: {
        id: "ab1",
        name: "Sopro Gélido",
        icon: "snowflake",
        cost: { resource: "mp", amount: 4 },
        range: { type: "ranged", distanceMeters: 12 },
        aoe: { type: "cone", radiusMeters: 6, coneAngleDeg: 60 },
        savingThrow: { enabled: true, dcFormula: "14", attributeKey: "vigor", effectDescription: "Congela" }
      }
    });
    expect(st.newAbilityOpen).toBe(true);
    expect(st.abIcon).toBe("snowflake");
    expect(st.abAoeConeAngle).toBe(60);
    expect(st.abSaveAttr).toBe("vigor");

    st = skillsFormReducer(st, { type: "SET_ERROR", error: "CD obrigatória" });
    expect(st.formError).toBe("CD obrigatória");
    expect(st.abName).toBe("Sopro Gélido");
  });

  it("inventoryFormReducer guarda apenas inspectedItemId e compendiumReducer carrega entry v2", () => {
    let inv = createInitialInventoryFormState();
    inv = inventoryFormReducer(inv, { type: "TOGGLE_INSPECT_ITEM", itemId: "it1" });
    expect(inv.inspectedItemId).toBe("it1");
    inv = inventoryFormReducer(inv, { type: "OPEN_DELETE_CONFIRM", payload: { id: "it1", label: "Poção" } });
    expect(inv.confirmDeleteItem).toEqual({ id: "it1", label: "Poção" });

    let rolls = createInitialRollsFormState();
    expect("crSaveEnabled" in rolls).toBe(false);
    rolls = rollsFormReducer(rolls, { type: "TOGGLE_CUSTOM_ROLL" });
    expect(rolls.newCustomRollOpen).toBe(true);

    let comp = createInitialCompendiumState("c1");
    comp = compendiumReducer(comp, {
      type: "START_EDIT",
      entry: {
        id: "ce1",
        type: "spell",
        name: "Tempestade",
        icon: "snowgem",
        range: { type: "ranged", distanceMeters: 18 },
        aoe: { type: "circle", radiusMeters: 9, coneAngleDeg: 45 },
        savingThrow: { enabled: true, dcFormula: "15", attributeKey: "agilidade", effectDescription: "Queda" },
        visibleTo: ["ALL"]
      }
    });
    expect(comp.form.icon).toBe("snowgem");
    expect(comp.form.aoeRadiusMeters).toBe(9);
    expect(comp.form.saveAttributeKey).toBe("agilidade");
    expect(comp.form.isPublic).toBe(true);
  });
});

describe("characterService & compendiumService — regras v2 e T3 (PERF-08)", () => {
  it("createCharacter aplica padrão npc para Mestre e pc para jogador (D-DER-4)", async () => {
    const gmChar = await characterService.createCharacter({
      campaignId: "camp1",
      user: { uid: "gm1" },
      isGM: true,
      gmId: "gm1",
      name: "Chefe"
    });
    expect(gmChar.type).toBe("npc");
    expect(gmChar.rev).toBe(0);
    expect(gmChar.hotbar["1"]).toBeNull();
    expect(gmChar.abilities.ab_bola_neve.icon).toBe("snowflake");

    const playerChar = await characterService.createCharacter({
      campaignId: "camp1",
      user: { uid: "p1" },
      isGM: false,
      gmId: "gm1",
      type: "npc",
      name: "Herói"
    });
    expect(playerChar.type).toBe("pc");
  });

  it("addEntry bloqueia chave reservada, colisão e savingThrow sem CD", async () => {
    const baseChar = {
      id: "c1",
      attributes: { forca: { key: "forca", label: "Força", value: 2, order: 0 } },
      skills: { luta: { key: "luta", name: "Luta", attributeKey: "forca", bonus: 2, order: 0 } },
      abilities: {},
      inventory: {},
      rollGroups: {}
    };

    await expect(
      characterService.addEntry({
        campaignId: "camp1",
        charId: "c1",
        collectionName: "skills",
        entry: { name: "HP", attributeKey: "forca", bonus: 1 },
        currentChar: baseChar
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.RESERVED_KEY });

    await expect(
      characterService.addEntry({
        campaignId: "camp1",
        charId: "c1",
        collectionName: "skills",
        entry: { name: "Força", attributeKey: "forca", bonus: 1 },
        currentChar: baseChar
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.KEY_COLLISION });

    await expect(
      characterService.addEntry({
        campaignId: "camp1",
        charId: "c1",
        collectionName: "abilities",
        entry: { name: "Raio", savingThrow: { enabled: true, dcFormula: "", attributeKey: "vigor" } },
        currentChar: baseChar
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("updateCharacterFields bloqueia campos legados e alterações protegidas por não-GM", async () => {
    await expect(
      characterService.updateCharacterFields({
        campaignId: "camp1",
        charId: "c1",
        updates: { visibleToPlayers: true },
        isGM: true
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });

    await expect(
      characterService.updateCharacterFields({
        campaignId: "camp1",
        charId: "c1",
        updates: { ownerId: "other" },
        isGM: false
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });
  });

  it("projectCharacterToSceneTokens (v2, substitui T3) ignora NPC e projeta PC por rev", async () => {
    await tokenService.projectCharacterToSceneTokens({
      campaignId: "camp1",
      sceneId: "sc1",
      user: { uid: "gm1" },
      isGM: true,
      character: { id: "npc1", type: "npc", rev: 2, name: "Outro" },
      publicTokens: [{ id: "tok1", kind: "npc", characterId: "npc1", ownerId: "gm1", rev: 0 }]
    });
    expect(fakeDb.writes).toHaveLength(0);

    await tokenService.projectCharacterToSceneTokens({
      campaignId: "camp1",
      sceneId: "sc1",
      user: { uid: "u1" },
      isGM: false,
      character: {
        id: "pc1",
        type: "pc",
        name: "Herói",
        rev: 2,
        resources: { hp: { current: 14, max: 20 }, mp: { current: 10, max: 10 } },
        avatar: { mediaId: null, url: "https://ex/a.png" },
        token: { image: { mediaId: null, url: "https://ex/t.png" }, sizeInCells: 2, showName: false }
      },
      publicTokens: [
        { id: "tok_pc1", kind: "pc", characterId: "pc1", ownerId: "u1", hidden: false, rev: 1 }
      ]
    });
    expect(fakeDb.writes).toHaveLength(1);
    expect(fakeDb.writes[0].payload).toMatchObject({
      label: "Herói",
      bars: { hpCurrent: 14, hpMax: 20, mpCurrent: 10, mpMax: 10 },
      showName: false,
      sizeInCells: 2,
      image: { url: "https://ex/t.png" },
      rev: 2
    });

    await tokenService.projectCharacterToSceneTokens({
      campaignId: "camp1",
      sceneId: "sc1",
      user: { uid: "u1" },
      isGM: false,
      character: {
        id: "pc1",
        type: "pc",
        name: "Herói",
        rev: 3,
        avatar: { mediaId: null, url: "https://ex/a.png" },
        token: { image: { mediaId: null, url: "https://ex/t2.png" }, sizeInCells: 2, showName: true }
      },
      publicTokens: [
        { id: "tok_pc1", kind: "pc", characterId: "pc1", ownerId: "u1", hidden: false, rev: 2 }
      ]
    });
    expect(fakeDb.writes).toHaveLength(2);
    expect(fakeDb.writes[1].payload).toMatchObject({
      image: { url: "https://ex/t2.png" },
      rev: 3
    });
  });

  it("compendiumService exige GM real e grava estrutura aninhada v2 sem visibleToPlayers", async () => {
    await expect(
      compendiumService.createCompendiumEntry({
        campaignId: "camp1",
        user: { uid: "p1" },
        isRealGM: false,
        entry: { name: "Ilegal" }
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    const created = await compendiumService.createCompendiumEntry({
      campaignId: "camp1",
      user: { uid: "gm1" },
      gmId: "gm1",
      isRealGM: true,
      entry: {
        name: "Bola de Neve",
        type: "spell",
        icon: "snowball",
        cost: { resource: "mp", amount: 2 },
        range: { type: "ranged", distanceMeters: 15 },
        aoe: { type: "circle", radiusMeters: 3, coneAngleDeg: 45 },
        savingThrow: { enabled: true, dcFormula: "13", attributeKey: "agilidade", effectDescription: "Lento" },
        isPublic: false
      }
    });
    expect(created.cost).toEqual({ resource: "mp", amount: 2 });
    expect(created.savingThrow.attributeKey).toBe("agilidade");
    expect(created.visibleTo).toEqual(["gm1"]);
    const fsWrite = fakeDb.writes.find((w) => w.op === "set");
    expect(fsWrite.payload).not.toHaveProperty("visibleToPlayers");
  });

  it("updateCompendiumEntry oculta e reexibe corretamente quando currentEntry já tem visibleTo", async () => {
    const publicEntry = {
      id: "ce1",
      campaignId: "camp1",
      name: "Bola de Neve",
      type: "spell",
      icon: "snowball",
      elementColor: "#008be3",
      visibleTo: ["ALL"],
      cost: { resource: "mp", amount: 1 },
      range: { type: "ranged", distanceMeters: 9 },
      aoe: { type: "single", radiusMeters: 0, coneAngleDeg: 45 },
      savingThrow: { enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" },
      bonus: 0,
      attributeKey: "forca",
      description: "",
      hitFormula: "1d20",
      effectFormula: "1d6",
      rollKind: "attack",
      trigger: "active",
      effectType: "damage",
      isDeleted: false
    };

    const hiddenRes = await compendiumService.updateCompendiumEntry({
      campaignId: "camp1",
      entryId: "ce1",
      user: { uid: "gm1" },
      gmId: "gm1",
      isRealGM: true,
      updates: { isPublic: false },
      currentEntry: publicEntry
    });
    expect(hiddenRes.visibleTo).toEqual(["gm1"]);

    const editHideRes = await compendiumService.updateCompendiumEntry({
      campaignId: "camp1",
      entryId: "ce1",
      user: { uid: "gm1" },
      gmId: "gm1",
      isRealGM: true,
      updates: { name: "Bola Oculta", isPublic: false },
      currentEntry: publicEntry
    });
    expect(editHideRes.name).toBe("Bola Oculta");
    expect(editHideRes.visibleTo).toEqual(["gm1"]);

    const shownRes = await compendiumService.updateCompendiumEntry({
      campaignId: "camp1",
      entryId: "ce1",
      user: { uid: "gm1" },
      gmId: "gm1",
      isRealGM: true,
      updates: { isPublic: true },
      currentEntry: { ...publicEntry, visibleTo: ["gm1"] }
    });
    expect(shownRes.visibleTo).toEqual(["ALL"]);
  });

  it("characterService valida setCharacterImageUrl e preserva overrides ao atualizar rolagem", async () => {
    await expect(
      characterService.setCharacterImageUrl({
        campaignId: "camp1",
        charId: "c1",
        targetField: "avatar",
        url: "javascript:alert(1)"
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_IMAGE_REF });

    await expect(
      characterService.setCharacterImageUrl({
        campaignId: "camp1",
        charId: "c1",
        targetField: "avatar",
        url: "data:image/png;base64,AAAA"
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_IMAGE_REF });

    const validRes = await characterService.setCharacterImageUrl({
      campaignId: "camp1",
      charId: "c1",
      targetField: "token",
      url: "https://example.com/penguin.png"
    });
    expect(validRes).toEqual({
      field: "token.image",
      imageRef: { mediaId: null, url: "https://example.com/penguin.png" }
    });

    const currentChar = {
      id: "c1",
      rollGroups: {
        rg1: {
          id: "rg1",
          name: "Combate",
          rolls: {
            r1: {
              id: "r1",
              source: { type: "custom", id: null },
              overrides: { name: "Meu Golpe", color: "#ff0000", icon: "sword" },
              custom: { hitFormula: "1d20", effectFormula: "1d8", rollKind: "attack", effectType: "damage", cost: { resource: "mp", amount: 0 }, savingThrow: { enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" } }
            }
          }
        }
      }
    };

    const updatedRoll = await characterService.updateEntry({
      campaignId: "camp1",
      charId: "c1",
      collectionName: "rolls",
      entryKey: "r1",
      rollGroupId: "rg1",
      patch: { overrides: { icon: "firegem" } },
      currentChar
    });
    expect(updatedRoll.entry.overrides).toEqual({
      name: "Meu Golpe",
      color: "#ff0000",
      icon: "firegem"
    });
  });

  it("validateCharacter rejeita rolagem custom sem payload custom ou com custo inválido", () => {
    const baseDoc = normalizeCharacter(
      {
        id: "c_val",
        name: "Pinguim",
        type: "pc",
        ownerId: "p1",
        campaignId: "camp1",
        rollGroups: {
          rg1: {
            id: "rg1",
            name: "Combate",
            order: 0,
            rolls: {
              r1: {
                id: "r1",
                order: 0,
                source: { type: "custom", id: null },
                overrides: { name: "Custom" },
                custom: {
                  hitFormula: "1d20",
                  effectFormula: "",
                  rollKind: "attack",
                  effectType: "damage",
                  cost: { resource: "mp", amount: 1 },
                  savingThrow: { enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" }
                }
              }
            }
          }
        }
      },
      { campaignId: "camp1", gmId: "gm1" }
    );
    expect(validateCharacter(baseDoc).ok).toBe(true);

    const missingCustom = structuredClone(baseDoc);
    missingCustom.rollGroups.rg1.rolls.r1.custom = null;
    expect(validateCharacter(missingCustom).ok).toBe(false);

    const badCost = structuredClone(baseDoc);
    badCost.rollGroups.rg1.rolls.r1.custom.cost = { resource: "mp", amount: -3 };
    expect(validateCharacter(badCost).ok).toBe(false);
  });

  it("useCharacterActions aplica delta de recurso (res.value) e projeta bars + rev v2 nos tokens RTDB", async () => {
    const charDoc = {
      id: "pc1",
      campaignId: "camp1",
      type: "pc",
      name: "Pinguim",
      ownerId: "p1",
      editableBy: ["p1"],
      visibleTo: ["ALL"],
      rev: 0,
      resources: {
        hp: { current: 20, max: 30 },
        mp: { current: 10, max: 15 }
      },
      recentOps: {}
    };
    fakeDb.collections.set("campaigns/camp1/characters", [charDoc]);

    const { result } = renderHook(() =>
      useCharacterActions({
        rawCharacters: [charDoc],
        boardTokens: [
          { id: "tok_pc1", kind: "pc", characterId: "pc1", ownerId: "p1", hidden: false, rev: 0 }
        ]
      })
    );

    await act(async () => {
      await result.current.applyCharacterResourceDelta("pc1", "hp", -6);
    });

    const rtdbWrites = fakeDb.writes.filter((w) => w.store === "rtdb");
    expect(rtdbWrites).toHaveLength(1);
    expect(rtdbWrites[0].payload).toMatchObject({
      bars: { hpCurrent: 14, hpMax: 30, mpCurrent: 10, mpMax: 15 },
      rev: 1
    });
  });

  it("useCharacterActions permite criar grupo de rolagens, fixar rolagem, atualizar e vincular à hotbar antes do snapshot", async () => {
    const charDoc = {
      id: "pc1",
      campaignId: "camp1",
      type: "pc",
      ownerId: "p1",
      editableBy: ["p1"],
      visibleTo: ["ALL"],
      rollGroups: {},
      recentOps: {}
    };

    const { result } = renderHook(() =>
      useCharacterActions({
        rawCharacters: [charDoc]
      })
    );

    let createdGroup;
    let createdRoll;
    let updatedRoll;
    let hotbarRes;
    await act(async () => {
      createdGroup = await result.current.addCharacterEntry("pc1", "rollGroups", {
        id: "grp_combate",
        name: "Ações de Combate"
      });
      createdRoll = await result.current.addCharacterEntry(
        "pc1",
        "rolls",
        {
          source: { type: "skill", id: "luta" },
          overrides: {}
        },
        { rollGroupId: createdGroup.key }
      );
      updatedRoll = await result.current.updateCharacterEntry(
        "pc1",
        "rolls",
        createdRoll.key,
        { overrides: { icon: "smile" } },
        { rollGroupId: createdGroup.key }
      );
      hotbarRes = await result.current.setCharacterHotbarSlot("pc1", "1", {
        rollGroupId: createdGroup.key,
        rollId: createdRoll.key
      });
    });

    expect(createdGroup.key).toBe("grp_combate");
    expect(createdRoll.path).toMatch(/^rollGroups\.grp_combate\.rolls\./);
    expect(updatedRoll.entry.overrides.icon).toBe("smile");
    expect(hotbarRes).toEqual({
      slotKey: "1",
      value: { rollGroupId: "grp_combate", rollId: createdRoll.key }
    });
  });

  it("syncTokenUpdatesToCharacter preserva invariante ImageRef e não escreve label em resources", async () => {
    const updateCharacter = vi.fn(async () => {});
    const char = {
      id: "pc1",
      type: "pc",
      token: { image: { mediaId: "med_old", url: null } },
      resources: {}
    };
    await combatService.syncTokenUpdatesToCharacter({
      token: { id: "tok1", characterId: "pc1", isGmToken: false },
      allCharacters: [char],
      canEditCharacter: () => true,
      campaign: { gmId: "gm1" },
      updatedFields: {
        hpCurrent: 12,
        externalUrl: "https://example.com/tok.png"
      },
      updateCharacter
    });

    expect(updateCharacter).toHaveBeenCalledWith("pc1", {
      "resources.hp": { current: 12, max: 25 },
      "token.image": { mediaId: null, url: "https://example.com/tok.png" }
    });
  });
});
