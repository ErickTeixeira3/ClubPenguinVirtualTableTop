// @vitest-environment jsdom
import { useReducer } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", async () => (await import("../../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../../support/fakeFirebase.js")).databaseModule);
vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);

const { default: CompendiumModal } = await import("../../../src/components/compendium/CompendiumModal.jsx");
const { default: QuickActionsHotbar } = await import("../../../src/components/layout/QuickActionsHotbar.jsx");
const { default: CharacterSheetModal } = await import("../../../src/components/sheets/CharacterSheetModal.jsx");
const { default: CharactersSidebarList } = await import("../../../src/components/sheets/CharactersSidebarList.jsx");
const { default: SheetInventoryTab } = await import("../../../src/components/sheets/tabs/SheetInventoryTab.jsx");
const { default: SheetRollsTab } = await import("../../../src/components/sheets/tabs/SheetRollsTab.jsx");
const { default: SheetSkillsTab } = await import("../../../src/components/sheets/tabs/SheetSkillsTab.jsx");
const { default: SheetSkillsToolbar } = await import("../../../src/components/sheets/tabs/SheetSkillsToolbar.jsx");
const {
  createInitialRollsFormState,
  createInitialSkillsFormState,
  skillsFormReducer
} = await import("../../../src/components/sheets/reducers/sheetFormReducers.js");

afterEach(cleanup);

const baseChar = {
  id: "c1",
  name: "Pinguim Teste",
  type: "pc",
  attributes: {
    forca: { key: "forca", label: "Força", value: 3, order: 0 },
    agilidade: { key: "agilidade", label: "Agilidade", value: 2, order: 1 }
  },
  skills: {
    luta: { key: "luta", name: "Luta", attributeKey: "forca", bonus: 2, order: 0 }
  },
  abilities: {
    ab1: {
      id: "ab1",
      name: "Bola de Fogo",
      icon: "firegem",
      elementColor: "#e53935",
      hitFormula: "1d20",
      effectFormula: "2d6",
      effectType: "damage",
      rollKind: "attack",
      cost: { resource: "mp", amount: 2 },
      range: { type: "ranged", distanceMeters: 12 },
      aoe: { type: "circle", radiusMeters: 6, coneAngleDeg: 45 },
      savingThrow: { enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" }
    }
  },
  inventory: {
    it1: { id: "it1", name: "Poção", icon: "potion_red", qty: 2, rollFormula: "2d4", effectType: "heal", consumeOnUse: true }
  },
  rollGroups: {
    rg1: {
      id: "rg1",
      name: "Combate",
      order: 0,
      rolls: {
        r1: { id: "r1", order: 0, source: { type: "ability", id: "ab1" }, overrides: {} },
        r2: { id: "r2", order: 1, source: { type: "skill", id: "luta" }, overrides: {} }
      }
    }
  },
  hotbar: { "1": { rollGroupId: "rg1", rollId: "r1" }, "2": null }
};

describe("Fase 5 UI — Ficha de Personagem e Compêndio", () => {
  it("FUN-08: SheetSkillsToolbar inclui magias (spell) no seletor do compêndio", () => {
    const onPull = vi.fn();
    render(
      <SheetSkillsToolbar
        compendiumEntries={[
          { id: "s1", name: "Raio Arcano", type: "spell" },
          { id: "a1", name: "Golpe", type: "ability" },
          { id: "i1", name: "Poção", type: "item" }
        ]}
        handlePullFromCompendium={onPull}
        onToggleNewAbility={() => {}}
      />
    );
    expect(screen.getByText("Raio Arcano")).toBeTruthy();
    expect(screen.getByText("Golpe")).toBeTruthy();
    expect(screen.queryByText("Poção")).toBeNull();
  });

  it("FUN-09 & U6: SkillList só lista atributos existentes na ficha, valida chaves e confirma exclusão", () => {
    const onRemoveEntry = vi.fn();
    function SkillsHarness() {
      const [skillsState, dispatchSkills] = useReducer(
        skillsFormReducer,
        "forca",
        createInitialSkillsFormState
      );
      return (
        <SheetSkillsTab
          canEdit
          abilities={[]}
          expandedSkillIds={new Set()}
          handleDemarcateArea={() => {}}
          triggerRoll={() => {}}
          pinToRollGroup={() => {}}
          skills={Object.values(baseChar.skills)}
          attributes={Object.values(baseChar.attributes)}
          setExpandedSkillIds={() => {}}
          character={baseChar}
          rollVisibility="public"
          onUpdateCharacter={() => {}}
          onRemoveCharacterEntry={onRemoveEntry}
          skillsState={skillsState}
          dispatchSkills={dispatchSkills}
        />
      );
    }

    const { container } = render(<SkillsHarness />);
    const attrOptions = Array.from(container.querySelectorAll("select option")).map((o) => o.value);
    expect(attrOptions).toEqual(["forca", "agilidade"]);

    // Digita chave reservada "HP" -> bloqueia envio sem chamar atualização
    const input = screen.getByPlaceholderText("Nova Perícia...");
    fireEvent.change(input, { target: { value: "HP" } });
    fireEvent.submit(input.closest("form"));
    expect(screen.getByRole("alert").textContent).toContain("reservada");

    // Excluir perícia abre ConfirmDialog (U6) antes de chamar onRemoveEntry
    fireEvent.click(screen.getByTitle("Excluir Perícia"));
    expect(onRemoveEntry).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir perícia?")).toBeTruthy();
    fireEvent.click(screen.getByText("Excluir"));
    expect(onRemoveEntry).toHaveBeenCalledWith("c1", "skills", "luta");
  });

  it("INT-18 & U6: SheetInventoryTab deriva inspetor por ID e exige confirmação antes de excluir", () => {
    const onRemoveEntry = vi.fn();
    const dispatchInv = vi.fn();
    const { rerender } = render(
      <SheetInventoryTab
        inventory={Object.values(baseChar.inventory)}
        inspectedItemId="it1"
        inspectedIconPickerOpen={false}
        confirmDeleteItem={null}
        dispatchInventory={dispatchInv}
        canEdit
        triggerRoll={vi.fn(async () => true)}
        pinToRollGroup={() => {}}
        onUpdateCharacter={() => {}}
        onRemoveCharacterEntry={onRemoveEntry}
        character={baseChar}
      />
    );
    expect(screen.getAllByText("x2")).toHaveLength(2);

    // Atualiza inventário externamente -> inspetor mostra x5 sem objeto obsoleto
    rerender(
      <SheetInventoryTab
        inventory={[{ ...baseChar.inventory.it1, qty: 5 }]}
        inspectedItemId="it1"
        inspectedIconPickerOpen={false}
        confirmDeleteItem={null}
        dispatchInventory={dispatchInv}
        canEdit
        triggerRoll={vi.fn(async () => true)}
        pinToRollGroup={() => {}}
        onUpdateCharacter={() => {}}
        onRemoveCharacterEntry={onRemoveEntry}
        character={baseChar}
      />
    );
    expect(screen.getAllByText("x5")).toHaveLength(2);
    expect(screen.queryByText("x2")).toBeNull();

    fireEvent.click(screen.getByTitle("Excluir Item"));
    expect(onRemoveEntry).not.toHaveBeenCalled();
    expect(dispatchInv).toHaveBeenCalledWith({
      type: "OPEN_DELETE_CONFIRM",
      payload: { id: "it1", label: "Poção" }
    });
  });

  it("SheetRollsTab oferece ↑ e ↓, passa skillId de origem na AoE e não adivinha arco", () => {
    const onReorder = vi.fn();
    const onDemarcate = vi.fn();
    const onPin = vi.fn();
    const rollsState = { ...createInitialRollsFormState(), importFromSheetOpen: true };

    render(
      <SheetRollsTab
        canEdit
        selectedGroupId="rg1"
        setSelectedGroupId={() => {}}
        rollGroups={Object.values(baseChar.rollGroups)}
        skills={[{ key: "arcodefesa", name: "Arco e Flecha", attributeKey: "agilidade", bonus: 3 }]}
        abilities={Object.values(baseChar.abilities)}
        character={baseChar}
        pinToRollGroup={onPin}
        triggerRoll={() => {}}
        handleDemarcateArea={onDemarcate}
        onUpdateCharacter={() => {}}
        onReorderCharacterEntries={onReorder}
        rollsState={rollsState}
        dispatchRolls={() => {}}
      />
    );

    // Pin de perícia com "Arco" usa ícone padrão "clover", nunca "bow"
    fireEvent.click(screen.getAllByText("+ Rolagem")[0]);
    expect(onPin).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "clover", sourceId: "arcodefesa" }),
      "rg1"
    );

    // Demarcar AoE passa source.id ("ab1"), não o id do atalho ("r1")
    fireEvent.click(screen.getByTitle("Demarcar Área no Mapa"));
    expect(onDemarcate).toHaveBeenCalledWith(expect.objectContaining({ id: "ab1" }));

    // Reordenação bidirecional (↑ / ↓)
    fireEvent.click(screen.getAllByTitle("Mover para baixo")[0]);
    expect(onReorder).toHaveBeenCalledWith("c1", "rolls", ["r2", "r1"], { rollGroupId: "rg1" });
  });

  it("QuickActionsHotbar resolve hotbar v2 e pede confirmação ao remover slot (U6)", () => {
    const onSetSlot = vi.fn();
    render(
      <QuickActionsHotbar
        character={baseChar}
        onExecuteRoll={() => {}}
        onUpdateCharacter={() => {}}
        onSetHotbarSlot={onSetSlot}
        onOpenSheet={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByTitle(/Bola de Fogo/)).toBeTruthy();
    fireEvent.click(screen.getByTitle("Remover atalho"));
    expect(onSetSlot).not.toHaveBeenCalled();
    expect(screen.getByText("Remover atalho da barra?")).toBeTruthy();

    fireEvent.click(screen.getByText("Remover"));
    expect(onSetSlot).toHaveBeenCalledWith("c1", "1", null);
  });

  it("CompendiumModal bloqueia fichas sem permissão quando canEditCharacter falta e exige ConfirmDialog ao excluir", async () => {
    const onDelete = vi.fn();
    render(
      <CompendiumModal
        entries={[
          {
            id: "ce1",
            name: "Gelo Cortante",
            type: "spell",
            icon: "snowgem",
            visibleTo: ["ALL"]
          }
        ]}
        isGM
        characters={[baseChar]}
        activeCharacter={baseChar}
        onUpdateCharacter={() => {}}
        onCreateEntry={vi.fn(async () => {})}
        onUpdateEntry={vi.fn(async () => {})}
        onDeleteEntry={onDelete}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getAllByText("X")[1]);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir item do compêndio?")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText("Excluir"));
    });
    expect(onDelete).toHaveBeenCalledWith("ce1");
  });

  it("CompendiumModal permite alternar visibilidade sem causar rejeição não tratada", async () => {
    const onUpdate = vi.fn(async () => {});
    render(
      <CompendiumModal
        entries={[
          { id: "ce1", name: "Gelo Cortante", type: "spell", icon: "snowgem", visibleTo: ["ALL"] }
        ]}
        isGM
        characters={[baseChar]}
        activeCharacter={baseChar}
        onUpdateCharacter={() => {}}
        onCreateEntry={vi.fn(async () => {})}
        onUpdateEntry={onUpdate}
        onDeleteEntry={vi.fn(async () => {})}
        onClose={() => {}}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Visível"));
    });
    expect(onUpdate).toHaveBeenCalledWith("ce1", { isPublic: false });
  });

  it("CompendiumModal não-GM oculta personagens quando canEditCharacter não é fornecido", () => {
    render(
      <CompendiumModal
        entries={[{ id: "ce1", name: "Poção", type: "item", visibleTo: ["ALL"] }]}
        isGM={false}
        characters={[baseChar]}
        onUpdateCharacter={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText("+ Na Ficha")).toBeNull();
  });

  it("CharacterSheetModal monta completo (somente leitura vs edição) e fixa atalho sem congelar overrides", async () => {
    const onAddEntry = vi.fn(async () => ({ entryKey: "r_new" }));
    const onUpdateEntry = vi.fn(async () => {});
    const onSetHotbar = vi.fn(async () => {});
    const onUpdateChar = vi.fn(async () => {});

    const { rerender } = render(
      <CharacterSheetModal
        character={{
          ...baseChar,
          ownerId: "p1",
          avatar: { mediaId: null, url: null },
          token: { image: { mediaId: null, url: null }, sizeInCells: 1, showName: true },
          resources: { hp: { current: 20, max: 30 }, mp: { current: 10, max: 15 } }
        }}
        campaignId="camp1"
        canEdit={false}
        isGM={false}
        onUpdateCharacter={onUpdateChar}
        onAddCharacterEntry={onAddEntry}
        onUpdateCharacterEntry={onUpdateEntry}
        onSetHotbarSlot={onSetHotbar}
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("+ Item")).toBeNull();

    rerender(
      <CharacterSheetModal
        character={{
          ...baseChar,
          ownerId: "p1",
          avatar: { mediaId: null, url: null },
          token: { image: { mediaId: null, url: null }, sizeInCells: 1, showName: true },
          resources: { hp: { current: 20, max: 30 }, mp: { current: 10, max: 15 } }
        }}
        campaignId="camp1"
        canEdit
        isGM={false}
        onUpdateCharacter={onUpdateChar}
        onAddCharacterEntry={onAddEntry}
        onUpdateCharacterEntry={onUpdateEntry}
        onSetHotbarSlot={onSetHotbar}
        onClose={() => {}}
      />
    );

    // Trocar aba para Rolagens e abrir painel "+ Da Ficha"
    fireEvent.click(screen.getByTitle("Trocar aba da ficha"));
    fireEvent.click(screen.getByText(/Rolagens/));
    fireEvent.click(screen.getByText("+ Da Ficha (Perícias/Magias)"));

    // Fixar habilidade da ficha no grupo: overrides não deve copiar nome/ícone/cor da fonte
    const pinButtons = screen.getAllByText("+ Rolagem");
    await act(async () => {
      fireEvent.click(pinButtons[pinButtons.length - 1]);
    });
    expect(onAddEntry).toHaveBeenCalledWith(
      "c1",
      "rolls",
      expect.objectContaining({
        source: { type: "ability", id: "ab1" },
        overrides: {}
      }),
      { rollGroupId: "rg1" }
    );

    // Abrir RollIconModal e trocar ícone do atalho
    fireEvent.click(screen.getAllByTitle("Clique para alterar o ícone desta rolagem")[0]);
    expect(screen.getByText("Alterar Ícone")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTitle("Sorriso Feliz"));
    });
    expect(onUpdateEntry).toHaveBeenCalledWith(
      "c1",
      "rolls",
      "r1",
      { overrides: { icon: "smile" } },
      { rollGroupId: "rg1" }
    );

    // Abrir HotbarSlotModal e atribuir slot 2
    fireEvent.click(screen.getByTitle(/Atalho no Slot 1 da Hotbar/));
    expect(screen.getByText("Hotbar (Bola de Neve)")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTitle("Fixar no Slot 2"));
    });
    expect(onSetHotbar).toHaveBeenCalledWith("c1", "2", expect.objectContaining({ rollId: "r1" }));
  });

  it("CharacterSheetModal usa createdGroup.key ao fixar rolagem em grupo recém-criado e não recria o grupo antes do snapshot", async () => {
    const onAddEntry = vi.fn(async (_charId, collectionName) => {
      if (collectionName === "rollGroups") {
        return { key: "grp_created_99", entry: { id: "grp_created_99", name: "Ações de Combate", rolls: {} } };
      }
      return { key: "r_created_1" };
    });

    render(
      <CharacterSheetModal
        character={{
          ...baseChar,
          rollGroups: {},
          hotbar: {},
          ownerId: "p1",
          avatar: { mediaId: null, url: null },
          token: { image: { mediaId: null, url: null }, sizeInCells: 1, showName: true },
          resources: { hp: { current: 20, max: 30 }, mp: { current: 10, max: 15 } }
        }}
        campaignId="camp1"
        canEdit
        isGM={false}
        onUpdateCharacter={vi.fn(async () => {})}
        onAddCharacterEntry={onAddEntry}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle("Trocar aba da ficha"));
    fireEvent.click(screen.getByText("Skills"));

    const pinButtons = screen.getAllByTitle("Fixar na Aba Rolagens");
    await act(async () => {
      fireEvent.click(pinButtons[0]);
      fireEvent.click(pinButtons[1]);
    });

    const rollGroupCalls = onAddEntry.mock.calls.filter(([, col]) => col === "rollGroups");
    expect(rollGroupCalls).toHaveLength(1);
    expect(onAddEntry).toHaveBeenNthCalledWith(
      1,
      "c1",
      "rollGroups",
      { id: "grp_combate", name: "Ações de Combate" }
    );
    expect(onAddEntry).toHaveBeenNthCalledWith(
      2,
      "c1",
      "rolls",
      expect.objectContaining({
        source: { type: "ability", id: "ab1" }
      }),
      { rollGroupId: "grp_created_99" }
    );
    expect(onAddEntry).toHaveBeenNthCalledWith(
      3,
      "c1",
      "rolls",
      expect.objectContaining({
        source: { type: "skill", id: "luta" }
      }),
      { rollGroupId: "grp_created_99" }
    );
  });

  it("CharactersSidebarList exige confirmação (ConfirmDialog / U6) antes de excluir ficha", async () => {
    const onDeleteChar = vi.fn(async () => {});
    render(
      <CharactersSidebarList
        characters={[{ ...baseChar, ownerId: "p1", visibleTo: ["ALL"], editableBy: ["p1"] }]}
        folders={[]}
        campaignId="camp1"
        isGM={false}
        currentUser={{ uid: "p1" }}
        onOpenSheet={() => {}}
        onDeleteCharacter={onDeleteChar}
        onCreateCharacter={vi.fn(async () => {})}
        onCreateFolder={vi.fn(async () => {})}
        onUpdateFolder={vi.fn(async () => {})}
        onDeleteFolder={vi.fn(async () => {})}
        onMoveCharacterToFolder={vi.fn(async () => {})}
        onMoveFolder={vi.fn(async () => {})}
      />
    );

    fireEvent.mouseEnter(screen.getByText("Pinguim Teste").closest("[draggable]"));
    fireEvent.click(screen.getByTitle("Excluir Personagem"));
    expect(onDeleteChar).not.toHaveBeenCalled();
    expect(screen.getByText("Excluir ficha?")).toBeTruthy();

    fireEvent.click(screen.getByText("Cancelar"));
    expect(onDeleteChar).not.toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByText("Pinguim Teste").closest("[draggable]"));
    fireEvent.click(screen.getByTitle("Excluir Personagem"));
    await act(async () => {
      fireEvent.click(screen.getByText("Excluir"));
    });
    expect(onDeleteChar).toHaveBeenCalledWith("c1");
  });
});
