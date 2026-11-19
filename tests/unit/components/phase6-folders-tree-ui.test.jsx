// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNotifications,
  getNotifications
} from "../../../src/services/notificationService.js";

vi.mock("../../../src/hooks/useMediaUrl", () => ({
  useMediaUrl: () => ({ url: null, loading: false })
}));

vi.mock("../../../src/components/journal/JournalGraphWebView", () => ({
  default: function MockGraph({ notes = [] }) {
    return <div data-testid="mock-journal-graph">{notes.length}</div>;
  }
}));

const CharactersSidebarList = (
  await import("../../../src/components/sheets/CharactersSidebarList.jsx")
).default;
const JournalWorkspace = (
  await import("../../../src/components/journal/JournalWorkspace.jsx")
).default;
const NoteEditorModal = (
  await import("../../../src/components/journal/NoteEditorModal.jsx")
).default;

function createDataTransfer(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    dropEffect: "move",
    effectAllowed: "move",
    setData: (type, val) => store.set(type, String(val)),
    getData: (type) => store.get(type) ?? ""
  };
}

beforeEach(() => {
  clearNotifications();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("Fase 6 UI — CharactersSidebarList (decomposição, D-DER-5, A11, ciclos, posse)", () => {
  it("renderiza seção própria + seções compartilhadas por dono (D-DER-5) e respeita A11", () => {
    render(
      <CharactersSidebarList
        campaignId="camp1"
        isGM={false}
        currentUser={{ uid: "p1" }}
        gmId="gm1"
        playersMap={{
          gm1: { uid: "gm1", displayName: "Mestre" },
          p1: { uid: "p1", displayName: "Jogador 1" },
          p2: { uid: "p2", displayName: "Jogador 2" }
        }}
        folders={[
          {
            id: "f_own",
            domain: "character",
            name: "Meus Aliados",
            ownerId: "p1",
            parentId: null,
            visibleTo: ["ALL"],
            editableBy: ["p1"]
          },
          {
            id: "f_shared_p2",
            domain: "character",
            name: "Esquadrão P2",
            ownerId: "p2",
            parentId: null,
            visibleTo: ["p2", "p1"],
            editableBy: ["p2", "p1"]
          },
          {
            id: "f_gm_parent",
            domain: "character",
            name: "NPCs do Norte",
            ownerId: "gm1",
            parentId: null,
            visibleTo: ["ALL"],
            editableBy: ["gm1"]
          },
          {
            id: "f_all_other",
            domain: "character",
            name: "Pasta ALL Secreta",
            ownerId: "p2",
            parentId: null,
            visibleTo: ["ALL"],
            editableBy: ["p2"]
          }
        ]}
        characters={[
          {
            id: "c_own",
            name: "Meu Herói",
            ownerId: "p1",
            folderId: "f_own",
            visibleTo: ["ALL"],
            editableBy: ["p1"]
          },
          {
            id: "c_shared_p2",
            name: "Companheiro P2",
            ownerId: "p2",
            folderId: "f_shared_p2",
            visibleTo: ["p2", "p1"],
            editableBy: ["p2"]
          },
          {
            id: "c_gm_ally",
            name: "Guia do Mestre",
            ownerId: "gm1",
            folderId: "f_gm_parent",
            visibleTo: ["gm1", "p1"],
            editableBy: ["gm1"]
          },
          {
            id: "c_all_other",
            name: "Ficha Alheia ALL",
            ownerId: "p2",
            folderId: null,
            visibleTo: ["ALL"],
            editableBy: ["p2"]
          }
        ]}
        canEditCharacter={(c) => c.ownerId === "p1"}
        canEditFolder={(f) => f.ownerId === "p1" || f.editableBy?.includes("p1")}
        canDeleteFolder={(f) => f.ownerId === "p1"}
        onOpenSheet={() => {}}
      />
    );

    expect(screen.getByText("Suas Fichas")).toBeTruthy();
    expect(screen.getByText("Compartilhado — Mestre")).toBeTruthy();
    expect(screen.getByText("Compartilhado — Jogador 2")).toBeTruthy();
    expect(screen.getByText("Meu Herói")).toBeTruthy();
    expect(screen.getByText("Esquadrão P2")).toBeTruthy();
    expect(screen.getByText("Companheiro P2")).toBeTruthy();
    expect(screen.getByText("NPCs do Norte")).toBeTruthy();
    expect(screen.getByText("Guia do Mestre")).toBeTruthy();

    expect(screen.queryByText("Ficha Alheia ALL")).toBeNull();
    expect(screen.queryByText("Pasta ALL Secreta")).toBeNull();

    // Em f_shared_p2 (editableBy inclui p1, mas ownerId é p2), p1 pode renomear (✏️), nunca excluir (✕)
    const sharedFolderHeader = screen.getByText("Esquadrão P2").closest("[draggable]");
    expect(sharedFolderHeader.getAttribute("draggable")).toBe("false");
    expect(within(sharedFolderHeader).getByTitle("Renomear Pasta")).toBeTruthy();
    expect(within(sharedFolderHeader).queryByTitle("Excluir Pasta")).toBeNull();
  });

  it("bloqueia ciclo ao arrastar pasta mãe para subpasta descendente e permite soltar subpasta na raiz", async () => {
    const onMoveFolder = vi.fn(async () => true);

    render(
      <CharactersSidebarList
        campaignId="camp1"
        isGM
        currentUser={{ uid: "gm1" }}
        gmId="gm1"
        playersMap={{}}
        folders={[
          {
            id: "f_root",
            domain: "character",
            name: "Vilões",
            ownerId: "gm1",
            parentId: null
          },
          {
            id: "f_sub",
            domain: "character",
            name: "Chefes",
            ownerId: "gm1",
            parentId: "f_root"
          }
        ]}
        characters={[]}
        onOpenSheet={() => {}}
        onMoveFolder={onMoveFolder}
      />
    );

    const subHeader = screen.getByText("Chefes").closest("[draggable]");
    await act(async () => {
      fireEvent.drop(subHeader, {
        dataTransfer: createDataTransfer({ "text/folder-id": "f_root" })
      });
    });

    expect(onMoveFolder).not.toHaveBeenCalled();
    expect(getNotifications().some((n) => n.type === "error")).toBe(true);

    // Soltar subpasta na seção raiz do Mestre promove parentId -> null
    const gmSectionHeader = screen.getByText("Mestre (Você)").parentElement.parentElement;
    await act(async () => {
      fireEvent.drop(gmSectionHeader, {
        dataTransfer: createDataTransfer({ "text/folder-id": "f_sub" })
      });
    });

    expect(onMoveFolder).toHaveBeenCalledWith("f_sub", null, "gm1");
  });

  it("solicita ConfirmDialog antes de transferir posse em drop entre donos (Mestre)", async () => {
    const onMoveFolder = vi.fn(async () => true);
    const onMoveCharacterToFolder = vi.fn(async () => true);

    render(
      <CharactersSidebarList
        campaignId="camp1"
        isGM
        currentUser={{ uid: "gm1" }}
        gmId="gm1"
        playersMap={{
          gm1: { uid: "gm1", displayName: "Mestre" },
          p1: { uid: "p1", displayName: "P1" },
          p2: { uid: "p2", displayName: "P2" }
        }}
        folders={[
          {
            id: "f_p1",
            domain: "character",
            name: "Pasta P1",
            ownerId: "p1",
            parentId: null
          },
          {
            id: "f_p2",
            domain: "character",
            name: "Pasta P2",
            ownerId: "p2",
            parentId: null
          }
        ]}
        characters={[
          { id: "c_p1", name: "Ficha P1", ownerId: "p1", folderId: null }
        ]}
        onOpenSheet={() => {}}
        onMoveFolder={onMoveFolder}
        onMoveCharacterToFolder={onMoveCharacterToFolder}
      />
    );

    // Drop de ficha de P1 na pasta de P2 abre confirmação
    const p2FolderHeader = screen.getByText("Pasta P2").closest("[draggable]");
    await act(async () => {
      fireEvent.drop(p2FolderHeader, {
        dataTransfer: createDataTransfer({ "text/character-id": "c_p1" })
      });
    });
    expect(onMoveCharacterToFolder).not.toHaveBeenCalled();
    expect(screen.getByText("Transferir Ficha?")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("Transferir"));
    });
    expect(onMoveCharacterToFolder).toHaveBeenCalledWith("c_p1", "f_p2", "p2");

    // Drop de pasta de P1 na pasta de P2 abre confirmação de transferência da subárvore
    await act(async () => {
      fireEvent.drop(p2FolderHeader, {
        dataTransfer: createDataTransfer({ "text/folder-id": "f_p1" })
      });
    });
    expect(onMoveFolder).not.toHaveBeenCalled();
    expect(screen.getByText("Transferir Pasta?")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("Transferir"));
    });
    expect(onMoveFolder).toHaveBeenCalledWith("f_p1", "f_p2", "p2");
  });

  it("MoveCharacterModal deriva targetOwnerId explícito da ficha e exibe caminho completo", async () => {
    const onMoveCharacterToFolder = vi.fn(async () => true);

    render(
      <CharactersSidebarList
        campaignId="camp1"
        isGM
        currentUser={{ uid: "gm1" }}
        gmId="gm1"
        playersMap={{
          gm1: { uid: "gm1", displayName: "Mestre" },
          p1: { uid: "p1", displayName: "P1" }
        }}
        folders={[
          {
            id: "f_p1_root",
            domain: "character",
            name: "Aliados",
            ownerId: "p1",
            parentId: null
          },
          {
            id: "f_p1_child",
            domain: "character",
            name: "Elfos",
            ownerId: "p1",
            parentId: "f_p1_root"
          },
          {
            id: "f_gm_other",
            domain: "character",
            name: "Pasta do Mestre",
            ownerId: "gm1",
            parentId: null
          }
        ]}
        characters={[
          { id: "c_p1", name: "Arqueiro P1", ownerId: "p1", folderId: null }
        ]}
        onOpenSheet={() => {}}
        onMoveCharacterToFolder={onMoveCharacterToFolder}
      />
    );

    fireEvent.mouseEnter(screen.getByText("Arqueiro P1").closest("[draggable]"));
    fireEvent.click(screen.getByTitle("Mover para pasta..."));

    const select = screen.getByRole("combobox");
    expect(within(select).queryByText(/Pasta do Mestre/)).toBeNull();
    expect(within(select).getByText(/Aliados \/ Elfos/)).toBeTruthy();

    fireEvent.change(select, { target: { value: "f_p1_child" } });
    await act(async () => {
      fireEvent.click(screen.getByText("Salvar"));
    });

    expect(onMoveCharacterToFolder).toHaveBeenCalledWith(
      "c_p1",
      "f_p1_child",
      "p1"
    );
  });

  it("sincroniza tempName quando a pasta é renomeada remotamente e promove órfãos à raiz", async () => {
    const onRenameFolder = vi.fn(async () => true);
    const baseFolders = [
      {
        id: "f1",
        domain: "character",
        name: "Antigo",
        ownerId: "p1",
        parentId: "f_missing_parent"
      }
    ];
    const baseChars = [
      {
        id: "c_orphan",
        name: "Viajante",
        ownerId: "p1",
        folderId: "f_deleted_missing"
      }
    ];

    const { rerender } = render(
      <CharactersSidebarList
        campaignId="camp1"
        isGM={false}
        currentUser={{ uid: "p1" }}
        folders={baseFolders}
        characters={baseChars}
        onOpenSheet={() => {}}
        onRenameFolder={onRenameFolder}
      />
    );

    // Subpasta e ficha órfãs renderizam normalmente na raiz
    expect(screen.getByText("Antigo")).toBeTruthy();
    expect(screen.getByText("Viajante")).toBeTruthy();

    rerender(
      <CharactersSidebarList
        campaignId="camp1"
        isGM={false}
        currentUser={{ uid: "p1" }}
        folders={[{ ...baseFolders[0], name: "Renomeada Remotamente" }]}
        characters={baseChars}
        onOpenSheet={() => {}}
        onRenameFolder={onRenameFolder}
      />
    );

    expect(screen.getByText("Renomeada Remotamente")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Renomear Pasta"));
    const renameInput = screen.getByDisplayValue("Renomeada Remotamente");
    fireEvent.change(renameInput, { target: { value: "Novo Local" } });
    await act(async () => {
      fireEvent.submit(renameInput.closest("form"));
    });

    expect(onRenameFolder).toHaveBeenCalledWith("f1", "Novo Local");
  });
});

describe("Fase 6 UI — JournalWorkspace e NoteEditorModal (buildFolderTree, escopo, '/' e hover)", () => {
  it("constrói árvore por IDs sem colisão entre party/player e rejeita '/' na criação de pasta", async () => {
    const onCreateFolder = vi.fn(async () => "f_created");

    render(
      <JournalWorkspace
        campaignId="camp1"
        currentUserId="p1"
        isGM={false}
        accessibleFolders={[
          {
            id: "f_player_lore",
            domain: "journal",
            scope: "player",
            ownerId: "p1",
            noteType: "lore",
            name: "Segredos",
            parentId: null
          },
          {
            id: "f_party_lore",
            domain: "journal",
            scope: "party",
            ownerId: "gm1",
            noteType: "lore",
            name: "Segredos",
            parentId: null,
            visibleTo: ["ALL"],
            editableBy: ["ALL", "gm1"]
          },
          {
            id: "f_party_child",
            domain: "journal",
            scope: "party",
            ownerId: "gm1",
            noteType: "lore",
            name: "Capitulo 2",
            parentId: "f_party_lore",
            visibleTo: ["ALL"],
            editableBy: ["ALL", "gm1"]
          }
        ]}
        accessibleNotes={[
          {
            id: "n_player",
            scope: "player",
            ownerId: "p1",
            noteType: "lore",
            folderId: "f_player_lore",
            title: "Nota Privada",
            visibleTo: ["p1"],
            editableBy: ["p1"]
          },
          {
            id: "n_party",
            scope: "party",
            ownerId: "gm1",
            noteType: "lore",
            folderId: "f_party_child",
            title: "Nota do Grupo",
            visibleTo: ["ALL"],
            editableBy: ["ALL", "gm1"]
          }
        ]}
        onCreateFolder={onCreateFolder}
      />
    );

    // Na aba Meu Diário (player), só a nota privada aparece dentro da pasta player
    expect(screen.getByText("Nota Privada")).toBeTruthy();
    expect(screen.queryByText("Nota do Grupo")).toBeNull();

    // Tenta criar pasta com "/" em Lore
    fireEvent.click(screen.getByTitle("Criar pasta em Lore"));
    const input = screen.getByPlaceholderText("Nome da pasta...");
    fireEvent.change(input, { target: { value: "Ato 1/Cena" } });
    await act(async () => {
      fireEvent.submit(input.closest("form"));
    });

    expect(onCreateFolder).not.toHaveBeenCalled();
    expect(getNotifications().some((n) => n.type === "error")).toBe(true);
    expect(screen.getByPlaceholderText("Nome da pasta...")).toBeTruthy();

    // Muda para aba Grupo: só a pasta party + subpasta Capitulo 2 + Nota do Grupo aparecem
    fireEvent.click(screen.getByText("Grupo"));
    expect(screen.getByText("Capitulo 2")).toBeTruthy();
    expect(screen.getByText("Nota do Grupo")).toBeTruthy();
    expect(screen.queryByText("Nota Privada")).toBeNull();
  });

  it("expande pasta recolhida via hover-intent sem timers e notifica erro em drop não autorizado", async () => {
    let fakeNow = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);

    const onMoveNoteToFolder = vi.fn(async () => true);

    render(
      <JournalWorkspace
        campaignId="camp1"
        currentUserId="p1"
        isGM={false}
        accessibleFolders={[
          {
            id: "f_target",
            domain: "journal",
            scope: "player",
            ownerId: "p1",
            noteType: "lore",
            name: "Arquivo",
            parentId: null,
            visibleTo: ["p1"],
            editableBy: ["p1"]
          },
          {
            id: "f_sub_target",
            domain: "journal",
            scope: "player",
            ownerId: "p1",
            noteType: "lore",
            name: "Subarquivo",
            parentId: "f_target",
            visibleTo: ["p1"],
            editableBy: ["p1"]
          }
        ]}
        accessibleNotes={[
          {
            id: "n_ro",
            scope: "player",
            ownerId: "gm1",
            noteType: "lore",
            folderId: null,
            title: "Pergaminho Somente Leitura",
            visibleTo: ["gm1", "p1"],
            editableBy: ["gm1"]
          }
        ]}
        onMoveNoteToFolder={onMoveNoteToFolder}
      />
    );

    const folderHeader = screen.getByText("Arquivo").parentElement.parentElement;

    // Recolhe a pasta primeiro (Subarquivo desaparece)
    fireEvent.click(folderHeader);
    expect(screen.queryByText("Subarquivo")).toBeNull();

    // Hover intent por >= 420ms via Date.now() expande sem setTimeout
    const dt = createDataTransfer({ "text/journal-note-id": "n_ro" });
    fireEvent.dragEnter(folderHeader, { dataTransfer: dt });
    fakeNow = 1500;
    fireEvent.dragOver(folderHeader, { dataTransfer: dt });
    expect(screen.getByText("Subarquivo")).toBeTruthy();

    // Tenta soltar nota somente leitura de outro dono -> notifica erro e não chama serviço
    await act(async () => {
      fireEvent.drop(folderHeader, { dataTransfer: dt });
    });

    expect(onMoveNoteToFolder).not.toHaveBeenCalled();
    expect(getNotifications().some((n) => n.type === "error")).toBe(true);
  });

  it("NoteEditorModal usa select por folderId com getFolderDisplayPath e filtra escopo compatível", async () => {
    const onSave = vi.fn(async () => ({ ok: true }));

    render(
      <NoteEditorModal
        note={null}
        defaultScope="party"
        defaultOwnerId="gm1"
        isGM
        currentUserId="gm1"
        accessibleFolders={[
          {
            id: "f_a1",
            domain: "journal",
            scope: "party",
            ownerId: "gm1",
            noteType: "lore",
            name: "Arco 1",
            parentId: null
          },
          {
            id: "f_a2",
            domain: "journal",
            scope: "party",
            ownerId: "gm1",
            noteType: "lore",
            name: "Taverna",
            parentId: "f_a1"
          },
          {
            id: "f_wrong_scope",
            domain: "journal",
            scope: "player",
            ownerId: "p1",
            noteType: "lore",
            name: "Pasta P1",
            parentId: null
          }
        ]}
        accessibleNotes={[]}
        characters={[]}
        onSave={onSave}
        onClose={() => {}}
      />
    );

    const titleInput = screen.getByPlaceholderText("Título do Card");
    fireEvent.change(titleInput, { target: { value: "Boato da Taverna" } });

    const folderSelect = screen.getByLabelText("Pasta");
    expect(within(folderSelect).getByText("Arco 1 / Taverna")).toBeTruthy();
    expect(within(folderSelect).queryByText("Pasta P1")).toBeNull();

    fireEvent.change(folderSelect, { target: { value: "f_a2" } });
    await act(async () => {
      fireEvent.submit(titleInput.closest("form"));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].folderId).toBe("f_a2");
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("folder");
  });
});
