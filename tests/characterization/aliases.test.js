// Caracterização: detecção de aliases do Diário (src/engines/journal/).
import { describe, expect, it } from "vitest";
import {
  buildNormalizedAliases,
  detectAliasMentions as detectAliasMentionsInText,
  tokenizeTextWithAliases as parseTextWithAliases
} from "../../src/engines/journal/index.js";

const notes = [
  { id: "n_rei", title: "Rei Pinguim", noteType: "character", aliases: ["Rei"] },
  { id: "n_ice", title: "Iceberg", noteType: "location", aliases: [] },
  { id: "n_joao", title: "João Silva", noteType: "character", aliases: ["Joãozinho", "J"] },
  { id: "n_mau", title: "Monstro do Mau", noteType: "character", aliases: ["Monstro"] }
];

describe("buildNormalizedAliases", () => {
  it("normaliza título e aliases (sem acento, minúsculas, espaços), sem repetir e com pelo menos 2 letras", () => {
    expect(buildNormalizedAliases("João  Silva", ["Joãozinho", "J", "joão silva"])).toEqual([
      "joao silva",
      "joaozinho"
    ]);
    expect(buildNormalizedAliases("Iceberg")).toEqual(["iceberg"]);
  });
});

describe("detectAliasMentionsInText", () => {
  it("encontra menções pelo título e pelos aliases, ignorando acento e caixa", () => {
    const { mentionedNoteIds, matchedDetails } = detectAliasMentionsInText(
      "Ontem o JOAOZINHO subiu o iceberg.",
      notes
    );
    expect(mentionedNoteIds).toEqual(["n_joao", "n_ice"]);
    expect(matchedDetails.find((d) => d.noteId === "n_joao")).toMatchObject({
      title: "João Silva",
      noteType: "character",
      matchedAlias: "joaozinho"
    });
  });

  it("respeita limites de palavra", () => {
    expect(detectAliasMentionsInText("Os icebergs derretem.", notes).mentionedNoteIds).toEqual([]);
    expect(detectAliasMentionsInText("Reino distante.", notes).mentionedNoteIds).toEqual([]);
  });

  it("prefere o termo mais longo da mesma nota", () => {
    const { matchedDetails } = detectAliasMentionsInText("O monstro do mau atacou.", notes);
    expect(matchedDetails).toEqual([
      { noteId: "n_mau", title: "Monstro do Mau", noteType: "character", matchedAlias: "monstro do mau" }
    ]);
  });

  it("exclui a própria nota e os aliases ignorados", () => {
    expect(detectAliasMentionsInText("O Rei Pinguim chegou.", notes, "n_rei").mentionedNoteIds).toEqual([]);
    expect(
      detectAliasMentionsInText("O Rei chegou.", notes, null, ["Rei", "Rei Pinguim"]).mentionedNoteIds
    ).toEqual([]);
  });

  it("resolve aliases a partir do campo v2 aliases sem depender de aliasesNormalized", () => {
    const v2Note = [{ id: "n_x", title: "Qualquer", aliases: ["Farol Velho"] }];
    expect(detectAliasMentionsInText("Fomos ao Farol Velho.", v2Note).mentionedNoteIds).toEqual(["n_x"]);
  });

  it("texto vazio não menciona nada", () => {
    expect(detectAliasMentionsInText("", notes)).toEqual({ mentionedNoteIds: [], matchedDetails: [] });
  });
});

describe("parseTextWithAliases", () => {
  it("divide o texto em trechos comuns e links, preservando o texto original", () => {
    const tokens = parseTextWithAliases("Encontramos o Rei Pinguim no Iceberg.", notes);
    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ["text", "Encontramos o "],
      ["link", "Rei Pinguim"],
      ["text", " no "],
      ["link", "Iceberg"],
      ["text", "."]
    ]);
    expect(tokens[1].note.id).toBe("n_rei");
    expect(tokens[1].term).toBe("Rei Pinguim");
  });

  it("ignora caixa e prefere o termo mais longo sem sobrepor", () => {
    const tokens = parseTextWithAliases("o rei pinguim e o rei", notes);
    expect(tokens.filter((t) => t.type === "link").map((t) => [t.text, t.term])).toEqual([
      ["rei pinguim", "Rei Pinguim"],
      ["rei", "Rei"]
    ]);
  });

  it("respeita limites de palavra com letras acentuadas", () => {
    const tokens = parseTextWithAliases("Reinado e Icebergão.", notes);
    expect(tokens.every((t) => t.type === "text")).toBe(true);
  });

  it("exclui a própria nota e os aliases ignorados", () => {
    expect(parseTextWithAliases("Rei Pinguim", notes, "n_rei")).toEqual([{ type: "text", text: "Rei Pinguim" }]);
    const tokens = parseTextWithAliases("Rei Pinguim", notes, null, ["Rei Pinguim"]);
    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ["link", "Rei"],
      ["text", " Pinguim"]
    ]);
  });

  it("conteúdo vazio ou não textual não gera trechos", () => {
    expect(parseTextWithAliases("", notes)).toEqual([]);
    expect(parseTextWithAliases(null, notes)).toEqual([]);
  });
});
