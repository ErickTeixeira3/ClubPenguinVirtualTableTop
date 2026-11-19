import { describe, expect, it } from "vitest";
import {
  buildNormalizedAliases,
  detectAliasMentions,
  normalizeAliasText,
  normalizeWithMap,
  tokenizeTextWithAliases
} from "../../../../src/engines/journal/index.js";

const notes = [
  { id: "n_rei", title: "Rei Pinguim", noteType: "character", aliases: ["Rei"] },
  { id: "n_ice", title: "Iceberg", noteType: "location", aliases: [] },
  { id: "n_joao", title: "João Silva", noteType: "character", aliases: ["Joãozinho", "J", "Café"] },
  { id: "n_mau", title: "Monstro do Mau", noteType: "character", aliases: ["Monstro"] }
];

describe("normalizeWithMap & normalizeAliasText", () => {
  it("handles empty, non-string, whitespace collapsing, accents, Turkish İ, and combining marks", () => {
    expect(normalizeWithMap("")).toEqual({ norm: "", origStarts: [], origEnds: [] });
    expect(normalizeWithMap(null)).toEqual({ norm: "", origStarts: [], origEnds: [] });
    expect(normalizeAliasText("  João   Silva \t ")).toBe("joao silva");
    expect(normalizeAliasText("\u0130stanbul")).toBe("istanbul");
    expect(normalizeAliasText("   ")).toBe("");
    expect(normalizeAliasText("\u0301  a\u0301")).toBe("a");
  });

  it("preserves exact original slice boundaries across decomposed combining marks and surrogate pairs", () => {
    const decomposed = "  \uD83D\uDC27  Joa\u0303o   Cafe\u0301!  ";
    const mapped = normalizeWithMap(decomposed);
    expect(mapped.norm).toBe("\uD83D\uDC27 joao cafe!");
    const joaoStart = mapped.norm.indexOf("joao");
    const cafeStart = mapped.norm.indexOf("cafe");
    expect(
      decomposed.slice(mapped.origStarts[joaoStart], mapped.origEnds[joaoStart + 3])
    ).toBe("Joa\u0303o");
    expect(
      decomposed.slice(mapped.origStarts[cafeStart], mapped.origEnds[cafeStart + 3])
    ).toBe("Cafe\u0301");
  });
});

describe("buildNormalizedAliases", () => {
  it("normalizes, deduplicates, and filters terms shorter than 2 characters", () => {
    expect(buildNormalizedAliases("João  Silva", ["Joãozinho", "J", "joão silva", 42])).toEqual([
      "joao silva",
      "joaozinho"
    ]);
    expect(buildNormalizedAliases("Iceberg", null)).toEqual(["iceberg"]);
  });
});

describe("FUN-28 symmetry: detectAliasMentions & tokenizeTextWithAliases", () => {
  it("matches accented and unaccented queries identically in both detector and tokenizer", () => {
    const text = "Ontem Joao Silva e JOAOZINHO beberam Cafe\u0301 no Iceberg.";
    const detected = detectAliasMentions(text, notes);
    const tokens = tokenizeTextWithAliases(text, notes);

    expect(detected.mentionedNoteIds).toEqual(["n_joao", "n_ice"]);
    expect(detected.matchedDetails).toEqual([
      {
        noteId: "n_joao",
        title: "João Silva",
        noteType: "character",
        matchedAlias: "joao silva"
      },
      {
        noteId: "n_ice",
        title: "Iceberg",
        noteType: "location",
        matchedAlias: "iceberg"
      }
    ]);

    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ["text", "Ontem "],
      ["link", "Joao Silva"],
      ["text", " e "],
      ["link", "JOAOZINHO"],
      ["text", " beberam "],
      ["link", "Cafe\u0301"],
      ["text", " no "],
      ["link", "Iceberg"],
      ["text", "."]
    ]);
  });

  it("handles multi-codepoint combining marks, surrogate emojis, and non-decomposing Unicode letters", () => {
    const unicodeNotes = [
      { id: "n_ren", title: "Ren", aliases: [] },
      { id: "n_rei", title: "Rei", aliases: [] },
      { id: "n_soren", title: "Søren", aliases: [] },
      { id: "n_ee", title: "e\u0323\u0302a", aliases: [] }
    ];
    const text = "Søren viu \uD83D\uDC27Rei\uD83D\uDC27 e e\u0323\u0302a!";
    const detected = detectAliasMentions(text, unicodeNotes);
    expect(detected.mentionedNoteIds).toEqual(["n_soren", "n_rei", "n_ee"]);

    const tokens = tokenizeTextWithAliases(text, unicodeNotes);
    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ["link", "Søren"],
      ["text", " viu \uD83D\uDC27"],
      ["link", "Rei"],
      ["text", "\uD83D\uDC27 e "],
      ["link", "e\u0323\u0302a"],
      ["text", "!"]
    ]);
  });

  it("escapes regex metacharacters and respects word boundaries", () => {
    const specialNotes = [
      { id: "n_npc", title: "NPC (A*)", aliases: [] },
      { id: "n_ice", title: "Iceberg", aliases: [] }
    ];
    expect(detectAliasMentions("Icebergão e Reino", notes).mentionedNoteIds).toEqual([]);
    const tokens = tokenizeTextWithAliases("Fale com NPC (A*) agora", specialNotes);
    expect(tokens.filter((t) => t.type === "link").map((t) => t.text)).toEqual(["NPC (A*)"]);
  });

  it("prefers longest match first, avoids cross-note overlap, and picks longest matched alias per note", () => {
    const overlapNotes = [
      { id: "n_short", title: "Rei", aliases: [] },
      { id: "n_long", title: "Rei Pinguim", aliases: ["Pinguim"] }
    ];
    const text = "O Rei e o Rei Pinguim";
    const tokens = tokenizeTextWithAliases(text, overlapNotes);
    expect(tokens.filter((t) => t.type === "link").map((t) => [t.text, t.note.id])).toEqual([
      ["Rei", "n_short"],
      ["Rei Pinguim", "n_long"]
    ]);

    const sameNote = [{ id: "n_rei", title: "Rei Pinguim", aliases: ["Rei"] }];
    expect(detectAliasMentions("O Rei e o Rei Pinguim", sameNote).matchedDetails[0].matchedAlias).toBe(
      "rei pinguim"
    );
  });

  it("excludes currentNoteId, deleted notes, invalid notes, and normalized ignoredAliases", () => {
    const mixedNotes = [
      ...notes,
      { id: "n_del", title: "Fantasma", isDeleted: true, aliases: [] },
      { id: "", title: "SemId" },
      null,
      { id: "n_notitle", title: 123, aliases: ["Apelido"] }
    ];

    expect(detectAliasMentions("Fantasma e Apelido", mixedNotes).mentionedNoteIds).toEqual([
      "n_notitle"
    ]);
    expect(
      detectAliasMentions("Rei Pinguim", mixedNotes, "n_rei").mentionedNoteIds
    ).toEqual([]);

    const tokens = tokenizeTextWithAliases(
      "Rei Pinguim visitou Joao",
      mixedNotes,
      null,
      ["rei pinguim", "JOÃO SILVA"]
    );
    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ["link", "Rei"],
      ["text", " Pinguim visitou Joao"]
    ]);
  });

  it("handles empty/non-string content and non-array inputs safely", () => {
    expect(detectAliasMentions("", notes)).toEqual({ mentionedNoteIds: [], matchedDetails: [] });
    expect(detectAliasMentions(null, notes)).toEqual({ mentionedNoteIds: [], matchedDetails: [] });
    expect(detectAliasMentions("   ", notes)).toEqual({ mentionedNoteIds: [], matchedDetails: [] });
    expect(detectAliasMentions("Rei", null, null, null)).toEqual({
      mentionedNoteIds: [],
      matchedDetails: []
    });

    expect(tokenizeTextWithAliases("", notes)).toEqual([]);
    expect(tokenizeTextWithAliases(null, notes)).toEqual([]);
    expect(tokenizeTextWithAliases("   ", notes)).toEqual([{ type: "text", text: "   " }]);
    expect(tokenizeTextWithAliases("Sem match", "bad-notes")).toEqual([
      { type: "text", text: "Sem match" }
    ]);
  });
});
