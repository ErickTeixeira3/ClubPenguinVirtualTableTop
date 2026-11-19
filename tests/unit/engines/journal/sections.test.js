import { describe, expect, it } from "vitest";
import { extractNoteText } from "../../../../src/engines/journal/index.js";

describe("extractNoteText", () => {
  it("returns empty string for nullish, primitive, array, or missing sections", () => {
    expect(extractNoteText(null)).toBe("");
    expect(extractNoteText(undefined)).toBe("");
    expect(extractNoteText("text")).toBe("");
    expect(extractNoteText([])).toBe("");
    expect(extractNoteText({ id: "n1" })).toBe("");
    expect(extractNoteText({ id: "n1", sections: null })).toBe("");
    expect(extractNoteText({ id: "n1", sections: {} })).toBe("");
    expect(extractNoteText({ id: "n1", sections: [] })).toBe("");
  });

  it("never reads persisted note.content even when sections are empty or missing", () => {
    expect(
      extractNoteText({
        id: "n1",
        content: "Conteúdo legado secreto",
        sections: {}
      })
    ).toBe("");
    expect(
      extractNoteText({
        id: "n2",
        content: "Ignorado",
        sections: { s1: { title: "Resumo", content: "Atual", order: 0 } }
      })
    ).toBe("Resumo\nAtual");
  });

  it("sorts sections map by finite order with insertion-order tie-break and skips unsafe keys", () => {
    const sections = Object.create(null);
    sections.s_late = { title: "Fim", content: "Texto final", order: 2 };
    sections.s_no_order_1 = { title: "Sem Ordem 1", content: "" };
    sections.s_first = { title: "", content: "Introdução", order: 0 };
    sections.s_no_order_2 = { title: "", content: "Sem Ordem 2", order: Number.NaN };
    sections.s_empty = { title: "   ", content: "   ", order: 1 };
    sections.s_bad = null;
    sections.constructor = { title: "Unsafe", content: "Should skip", order: -1 };

    const note = { id: "n1", sections };
    Object.freeze(note);
    Object.freeze(sections);

    expect(extractNoteText(note)).toBe(
      "Introdução\n\nFim\nTexto final\n\nSem Ordem 1\n\nSem Ordem 2"
    );
  });

  it("supports array sections preserving order or index fallback without mutating input", () => {
    const note = Object.freeze({
      id: "n1",
      sections: Object.freeze([
        Object.freeze({ title: "B", content: "2", order: 5 }),
        null,
        Object.freeze({ title: "A", content: "1", order: 1 }),
        Object.freeze({ title: 123, content: "Somente conteúdo" })
      ])
    });

    expect(extractNoteText(note)).toBe("A\n1\n\nB\n2\n\nSomente conteúdo");
  });
});
