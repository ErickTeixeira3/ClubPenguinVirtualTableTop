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
import { getNoteTypeMeta } from "../../../src/components/journal/noteTypesUi.js";
import { resetFakeDb } from "../../support/fakeFirebase.js";

vi.mock("firebase/firestore", async () => (await import("../../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../../support/fakeFirebase.js")).databaseModule);
vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);
vi.mock("../../../src/services/mediaService.js", () => ({
  uploadCompressedMedia: async () => ({ mediaId: "med_stub" })
}));
vi.mock("../../../src/hooks/useMediaUrl", () => ({
  useMediaUrl: () => ({ url: null, loading: false })
}));

const NoteEditorModal = (
  await import("../../../src/components/journal/NoteEditorModal.jsx")
).default;
const JournalGraphWebView = (
  await import("../../../src/components/journal/JournalGraphWebView.jsx")
).default;

beforeEach(() => {
  resetFakeDb();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const partyOwnerNote = {
  id: "n_source",
  campaignId: "camp_1",
  scope: "party",
  ownerId: "p1",
  visibleTo: ["ALL", "p1"],
  editableBy: ["ALL", "p1"],
  noteType: "lore",
  title: "Diário da Taverna",
  aliases: [],
  ignoredAliases: [],
  sections: {
    sec_1: {
      id: "sec_1",
      title: "Relato",
      content: "Encontramos o Rei Pinguim e um viajante misterioso.",
      order: 0
    }
  },
  relatedNoteIds: [],
  rev: 1,
  isDeleted: false
};

const targetEditableNote = {
  id: "n_rei",
  campaignId: "camp_1",
  scope: "party",
  ownerId: "p1",
  visibleTo: ["ALL", "p1"],
  editableBy: ["ALL", "p1"],
  noteType: "character",
  title: "Rei Pinguim",
  aliases: [],
  ignoredAliases: [],
  sections: { sec_1: { id: "sec_1", title: "", content: "Governante.", order: 0 } },
  relatedNoteIds: [],
  rev: 0,
  isDeleted: false
};

const targetReadonlyNote = {
  id: "n_gm_ro",
  campaignId: "camp_1",
  scope: "player",
  ownerId: "gm_1",
  visibleTo: ["gm_1", "p1"],
  editableBy: ["gm_1"],
  noteType: "quest",
  title: "Ordem Secreta",
  aliases: [],
  ignoredAliases: [],
  sections: {},
  relatedNoteIds: [],
  rev: 0,
  isDeleted: false
};

describe("Fase 7 UI — NoteEditorModal, useNoteDraft, Permissões e NoteTypes", () => {
  it("staging em rascunho: vincular card não grava até salvar, e bloquear vínculo de alias em card não-editável", async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    const onClose = vi.fn();

    render(
      <NoteEditorModal
        note={partyOwnerNote}
        currentUserId="p1"
        isGM={false}
        playersList={[{ uid: "p1", displayName: "P1" }, { uid: "p2", displayName: "P2" }]}
        accessibleNotes={[partyOwnerNote, targetEditableNote, targetReadonlyNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={onSave}
        onClose={onClose}
      />
    );

    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "viajante"
    });
    const textDiv = screen.getByText(/Encontramos o/).closest("div");
    fireEvent.mouseUp(textDiv);

    const linkBtn = screen.getByText(/Vincular card/).closest("button");
    fireEvent.click(linkBtn);

    // Tentativa em card não editável exibe erro e não fecha nem chama onSave
    const roCandidate = screen.getByText("Ordem Secreta").closest("button");
    fireEvent.click(roCandidate);
    expect(screen.getByRole("alert").textContent).toContain("permissão para vincular alias");
    expect(onSave).not.toHaveBeenCalled();

    // Selecionar card editável faz stage no rascunho sem chamar onSave imediatamente
    const okCandidate = screen
      .getAllByText(/Rei Pinguim/)
      .map((el) => el.closest("button"))
      .find(Boolean);
    fireEvent.click(okCandidate);
    expect(onSave).not.toHaveBeenCalled();

    // Agora o termo "viajante" já aparece como link no modo Visualizar via applyPendingAliasesToNotes
    const linkedViajante = screen.getByText("viajante");
    expect(linkedViajante.getAttribute("title")).toContain("Rei Pinguim");

    // Cancelar não persiste nada no alvo
    fireEvent.click(screen.getByText("Cancelar").closest("button"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  it("negar vínculo adiciona apenas a ignoredAliases sem gravar até Salvar Card", async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    const { container } = render(
      <NoteEditorModal
        note={partyOwnerNote}
        currentUserId="p1"
        isGM={false}
        playersList={[]}
        accessibleNotes={[partyOwnerNote, targetEditableNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={onSave}
        onClose={() => {}}
      />
    );

    const linkSpan = screen.getByText("Rei Pinguim");
    fireEvent.mouseEnter(linkSpan);
    const removeLinkBtn = screen.getByTitle("Remover vínculo");
    fireEvent.click(removeLinkBtn);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByTitle("Personagem: Rei Pinguim")).toBeNull();

    const form = container.ownerDocument.querySelector("form");
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    const savedPayload = onSave.mock.calls[0][0];
    expect(savedPayload.ignoredAliases).toContain("Rei Pinguim");
    expect(savedPayload.targetAliasAdditions).toEqual({});
  });

  it("D-DER-6: navegar com alterações não salvas abre ConfirmDialog Salvar / Descartar / Cancelar", async () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    const onOpenNote = vi.fn();

    render(
      <NoteEditorModal
        note={partyOwnerNote}
        currentUserId="p1"
        isGM={false}
        playersList={[]}
        accessibleNotes={[partyOwnerNote, targetEditableNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={onSave}
        onOpenNote={onOpenNote}
        onClose={() => {}}
      />
    );

    // Suja o rascunho
    fireEvent.change(screen.getByPlaceholderText("Título do Card"), {
      target: { value: "Diário Editado" }
    });

    // Tenta navegar para outro card
    fireEvent.click(screen.getByText("Rei Pinguim"));
    expect(onOpenNote).not.toHaveBeenCalled();
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();

    // Cancelar fecha apenas o diálogo
    const confirmBox = screen.getByText("Alterações não salvas").parentElement;
    fireEvent.click(within(confirmBox).getByText("Cancelar").closest("button"));
    expect(screen.queryByText("Alterações não salvas")).toBeNull();
    expect(onOpenNote).not.toHaveBeenCalled();

    // Reabrir e escolher Salvar -> salva e navega
    fireEvent.click(screen.getByText("Rei Pinguim"));
    const saveConfirmBox = screen.getByText("Alterações não salvas").parentElement;
    await act(async () => {
      fireEvent.click(within(saveConfirmBox).getByText("Salvar").closest("button"));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpenNote).toHaveBeenCalledWith(targetEditableNote);
  }, 15000);

  it("D-DER-6: opção Descartar limpa alterações e navega sem chamar onSave", () => {
    const onSave = vi.fn(async () => ({ ok: true }));
    const onOpenNote = vi.fn();

    render(
      <NoteEditorModal
        note={partyOwnerNote}
        currentUserId="p1"
        isGM={false}
        playersList={[]}
        accessibleNotes={[partyOwnerNote, targetEditableNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={onSave}
        onOpenNote={onOpenNote}
        onClose={() => {}}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Título do Card"), {
      target: { value: "Rascunho Descartado" }
    });
    fireEvent.click(screen.getByText("Rei Pinguim"));
    fireEvent.click(screen.getByText("Descartar").closest("button"));

    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenNote).toHaveBeenCalledWith(targetEditableNote);
  }, 15000);

  it("FUN-11 + U6: Excluir visível só para dono/GM com ConfirmDialog; acesso revogável pelo dono e pelo GM", async () => {
    const onDelete = vi.fn(async () => {});
    const onRevoke = vi.fn(async () => {});

    // 1. Editor não-dono não vê Excluir e não vê controles de revogação no Acesso
    const viewEditor = render(
      <NoteEditorModal
        note={{ ...partyOwnerNote, ownerId: "p1", visibleTo: ["ALL", "p1", "p2"] }}
        currentUserId="p2"
        isGM={false}
        playersList={[{ uid: "p1", displayName: "P1" }, { uid: "p2", displayName: "P2" }]}
        accessibleNotes={[partyOwnerNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={async () => ({ ok: true })}
        onDelete={onDelete}
        onRevokeNoteAccess={onRevoke}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText("Excluir")).toBeNull();
    fireEvent.click(screen.getByText(/Acesso/).closest("button"));
    expect(screen.queryByTitle("Remover acesso do grupo")).toBeNull();
    viewEditor.unmount();

    // 2. GM em card pertencente a P1 vê Excluir (com ConfirmDialog) e controles de acesso
    render(
      <NoteEditorModal
        note={{ ...partyOwnerNote, ownerId: "p1", visibleTo: ["ALL", "p1", "p2"] }}
        currentUserId="gm_1"
        isGM={true}
        playersList={[{ uid: "p1", displayName: "P1" }, { uid: "p2", displayName: "P2" }]}
        accessibleNotes={[partyOwnerNote]}
        accessibleFolders={[]}
        characters={[]}
        onSave={async () => ({ ok: true })}
        onDelete={onDelete}
        onRevokeNoteAccess={onRevoke}
        onClose={() => {}}
      />
    );

    fireEvent.click(screen.getByText(/Acesso/).closest("button"));
    const revokeGroupBtn = screen.getByTitle("Remover acesso do grupo");
    fireEvent.click(revokeGroupBtn);
    expect(onRevoke).toHaveBeenCalledWith("n_source", "party");

    fireEvent.click(screen.getByText("Excluir").closest("button"));
    expect(onDelete).not.toHaveBeenCalled();
    const dialog = screen.getByText("Excluir Card?").parentElement;
    await act(async () => {
      fireEvent.click(within(dialog).getByText("Excluir").closest("button"));
    });
    expect(onDelete).toHaveBeenCalledWith("n_source");
  }, 15000);

  it("metadado de UI quest define contraste escuro para badge (#001b3a)", () => {
    const questMeta = getNoteTypeMeta("quest");
    const loreMeta = getNoteTypeMeta("lore");
    expect(questMeta.color).toBe("#fdd835");
    expect(questMeta.badgeTextColor).toBe("#001b3a");
    expect(loreMeta.badgeTextColor).toBe("#ffffff");
  });
});

describe("Fase 7 UI — JournalGraphWebView (zoom wheel não-passivo, permissão drag e INT-09)", () => {
  it("respeita ignoredAliases mesmo se mentionedNoteIds legado existir (INT-09)", () => {
    const notesWithNegation = [
      {
        ...partyOwnerNote,
        ignoredAliases: ["Rei Pinguim"],
        mentionedNoteIds: ["n_rei"]
      },
      targetEditableNote
    ];

    const { container, rerender } = render(
      <JournalGraphWebView
        notes={notesWithNegation}
        currentUserId="p1"
        isGM={false}
      />
    );

    expect(container.querySelectorAll("svg line")).toHaveLength(0);

    rerender(
      <JournalGraphWebView
        notes={[{ ...partyOwnerNote, ignoredAliases: [] }, targetEditableNote]}
        currentUserId="p1"
        isGM={false}
      />
    );
    expect(container.querySelectorAll("svg line")).toHaveLength(1);
  });

  it("aplica zoom no listener wheel não-passivo e bloqueia drag sem permissão de edição", async () => {
    const onUpdateNodePosition = vi.fn(async () => {});
    const roNote = {
      ...targetReadonlyNote,
      graphPosition: { x: 200, y: 200, pinned: true },
      sections: { sec_1: { id: "sec_1", title: "Resumo", content: "Detalhes secretos.", order: 0 } }
    };

    const { container, rerender } = render(
      <JournalGraphWebView
        notes={[roNote]}
        currentUserId="p1"
        isGM={false}
        canEditNote={() => false}
        onUpdateNodePosition={onUpdateNodePosition}
      />
    );

    const screenEl = container.querySelector(".epf-screen");
    const wheelEvt = new WheelEvent("wheel", {
      deltaY: -120,
      cancelable: true,
      bubbles: true
    });
    act(() => {
      screenEl.dispatchEvent(wheelEvt);
    });
    expect(wheelEvt.defaultPrevented).toBe(true);
    expect(screen.getByText("Centralizar (110%)")).toBeTruthy();

    // Drag negado quando !canEditNote, mas ainda seleciona e mostra texto extraído das seções
    const nodeEl = container.querySelector('[data-graph-node="true"]');
    fireEvent.mouseDown(nodeEl, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(screenEl, { clientX: 90, clientY: 90 });
    await act(async () => {
      fireEvent.mouseUp(screenEl);
    });
    expect(onUpdateNodePosition).not.toHaveBeenCalled();
    expect(screen.getByText(/Detalhes secretos\./)).toBeTruthy();

    // Com permissão de edição, drag > 4px chama onUpdateNodePosition
    rerender(
      <JournalGraphWebView
        notes={[roNote]}
        currentUserId="gm_1"
        isGM={true}
        canEditNote={() => true}
        onUpdateNodePosition={onUpdateNodePosition}
      />
    );
    const editableNode = container.querySelector('[data-graph-node="true"]');
    fireEvent.mouseDown(editableNode, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(screenEl, { clientX: 90, clientY: 90 });
    await act(async () => {
      fireEvent.mouseUp(screenEl);
    });
    expect(onUpdateNodePosition).toHaveBeenCalledTimes(1);
    expect(onUpdateNodePosition.mock.calls[0][0]).toBe("n_gm_ro");
  });
});
