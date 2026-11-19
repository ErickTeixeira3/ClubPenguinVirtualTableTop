// @vitest-environment jsdom
// Regressão portada de auditoria_refatoracao/validar-regressoes.mjs: A28-A30 e A31 (componente).
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetFakeDb } from "../support/fakeFirebase.js";

vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../support/fakeFirebase.js")).databaseModule);
vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);
vi.mock("../../src/services/mediaService.js", () => ({ uploadCompressedMedia: async () => ({ mediaId: "med_stub" }) }));

const DebouncedField = (await import("../../src/components/ui/DebouncedField.jsx")).default;
const { useDebouncedCallback } = await import("../../src/hooks/useDebouncedCallback.js");
const { syncTokenUpdatesToCharacter } = await import("../../src/services/combatService.js");
const SheetAttributesTab = (await import("../../src/components/sheets/tabs/SheetAttributesTab.jsx")).default;
const NoteEditorModal = (await import("../../src/components/journal/NoteEditorModal.jsx")).default;

const flushMicrotasks = () => act(async () => {});
const wait = (ms) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

beforeEach(resetFakeDb);
afterEach(cleanup);

describe("A28: DebouncedField realinha o rascunho ao valor salvo", () => {
  it("depois do commit, o campo volta ao valor persistido quando o banco não mudou", async () => {
    const onCommit = vi.fn();
    render(<DebouncedField type="number" value={1} delay={20} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("0");
    await flushMicrotasks();
    expect(input.value).toBe("1");
  });
});

describe("A30: alteração externa durante a digitação", () => {
  it("cancela o commit pendente e mostra o valor externo", async () => {
    const onCommit = vi.fn();
    const { rerender } = render(<DebouncedField type="number" value={30} delay={40} onCommit={onCommit} />);
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2" } });
    rerender(<DebouncedField type="number" value={20} delay={40} onCommit={onCommit} />);
    await wait(80);
    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("20");
  });
});

describe("A29: flush ao sair da página", () => {
  it("executa a gravação pendente em pagehide e em beforeunload", () => {
    const flushed = [];
    const { result } = renderHook(() => useDebouncedCallback((v) => flushed.push(v), 5000));
    result.current.run("p1");
    window.dispatchEvent(new Event("pagehide"));
    result.current.run("b1");
    window.dispatchEvent(new Event("beforeunload"));
    expect(flushed).toEqual(["p1", "b1"]);
  });
});

describe("A30: gravações por caminho de campo", () => {
  it("token → ficha grava só resources.hp.current", async () => {
    const updateCharacter = vi.fn(async () => {});
    await syncTokenUpdatesToCharacter({
      token: { id: "t1", characterId: "c1" },
      updatedFields: { hpCurrent: 18 },
      allCharacters: [{ id: "c1", ownerId: "player1", type: "pc", resources: { hp: { current: 30, max: 30 } } }],
      campaign: { gmId: "gm1" },
      canEditCharacter: () => true,
      updateCharacter
    });
    expect(updateCharacter).toHaveBeenCalledTimes(1);
    expect(updateCharacter.mock.calls[0][1]).toMatchObject({ "resources.hp.current": 18 });
  });

  it("a aba de atributos grava só resources.hp.max", async () => {
    const onUpdateCharacter = vi.fn(async () => {});
    const { container } = render(
      <SheetAttributesTab
        canEdit
        hp={{ current: 30, max: 30, label: "Vida" }}
        mp={{ current: 10, max: 10, label: "Energia" }}
        character={{ id: "c1", resources: { hp: { current: 30, max: 30 } }, attributes: [] }}
        onUpdateCharacter={onUpdateCharacter}
        cardBgColor="#fff"
        tokenUrl={null}
        onUploadCharacterImage={() => {}}
        onSpawnTokenOnMap={() => {}}
        attributes={[]}
        triggerRoll={() => {}}
        pinToRollGroup={() => {}}
        newAttrLabel=""
        setNewAttrLabel={() => {}}
      />
    );
    const hpMax = container.querySelectorAll('input[type="number"]')[1];
    fireEvent.change(hpMax, { target: { value: "40" } });
    fireEvent.blur(hpMax);
    await flushMicrotasks();
    expect(onUpdateCharacter).toHaveBeenCalledWith("c1", { "resources.hp.max": 40 });
  });
});

describe("A31: editor de card com falha ao salvar e somente leitura", () => {
  const roNote = {
    id: "n_ro",
    ownerId: "gm1",
    scope: "player",
    visibleTo: ["gm1", "player1"],
    editableBy: ["gm1"],
    title: "Secreto",
    sections: [{ id: "s1", title: "A", content: "B" }]
  };
  const baseProps = { note: roNote, playersList: [], accessibleNotes: [roNote], accessibleFolders: [], characters: [] };

  it("falha ao salvar mantém o editor aberto e mostra o erro", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <NoteEditorModal
        {...baseProps}
        isGM
        currentUserId="gm1"
        onSave={async () => ({ ok: false, error: "Erro no servidor" })}
        onClose={onClose}
      />
    );
    const form = container.ownerDocument.querySelector("form");
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByRole("alert").textContent).toContain("Erro no servidor");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("quem não pode editar vê só Fechar, sem Salvar Card", () => {
    render(<NoteEditorModal {...baseProps} isGM={false} currentUserId="player1" onSave={async () => ({ ok: true })} onClose={() => {}} />);
    const labels = screen.getAllByRole("button").map((b) => b.textContent.trim());
    expect(labels).toContain("Fechar");
    expect(labels.some((t) => t.includes("Salvar Card"))).toBe(false);
  });
});
