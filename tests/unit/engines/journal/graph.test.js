import { describe, expect, it } from "vitest";
import { NOTE_SCOPES, NOTE_TYPES } from "../../../../src/domain/constants.js";
import { DEFAULT_NAMES } from "../../../../src/domain/defaults.js";
import { buildGraphForReader } from "../../../../src/engines/journal/index.js";

describe("buildGraphForReader", () => {
  const sampleNotes = [
    {
      id: "n_party_1",
      title: "Taverna do Pinguim",
      noteType: NOTE_TYPES.LOCATION,
      scope: NOTE_SCOPES.PARTY,
      ownerId: "u1",
      aliases: ["Taverna"],
      ignoredAliases: ["Rei Pinguim"],
      relatedNoteIds: ["n_gm_secret", "n_party_1", "n_deleted", "n_party_2", 123, "   "],
      sections: {
        s1: { title: "Notas", content: "O Rei Pinguim e o Joao frequentam a taverna.", order: 0 }
      },
      content: "Texto legado com Fantasma",
      mentionedNoteIds: ["n_gm_secret", "n_deleted"],
      graphPosition: { x: 120, y: 240, pinned: true },
      linkedCharacterId: "char_1"
    },
    {
      id: "n_party_2",
      title: "Rei Pinguim",
      noteType: NOTE_TYPES.CHARACTER,
      scope: NOTE_SCOPES.PARTY,
      ownerId: "u2",
      aliases: ["Rei"],
      sections: {
        s1: { title: "Sobre", content: "Visita a Taverna.", order: 0 }
      },
      graphNode: { x: 999, y: 999 }
    },
    {
      id: "n_player_u1",
      title: "João",
      noteType: NOTE_TYPES.CHARACTER,
      scope: NOTE_SCOPES.PLAYER,
      ownerId: "u1",
      visibleTo: ["u1"],
      sections: []
    },
    {
      id: "n_gm_secret",
      title: "Segredo do Mestre",
      noteType: NOTE_TYPES.LORE,
      scope: NOTE_SCOPES.GM,
      ownerId: "former_gm",
      sections: {
        s1: { title: "Plano", content: "Rei Pinguim é um impostor.", order: 0 }
      }
    },
    {
      id: "n_deleted",
      title: "Fantasma",
      noteType: NOTE_TYPES.LORE,
      scope: NOTE_SCOPES.PARTY,
      isDeleted: true,
      sections: { s1: { title: "", content: "Taverna", order: 0 } }
    },
    { id: "", title: "Sem ID", scope: NOTE_SCOPES.PARTY },
    null
  ];

  it("handles missing/null options and null/anonymous viewers without throwing", () => {
    expect(buildGraphForReader()).toEqual({ nodes: [], edges: [] });
    expect(buildGraphForReader(null)).toEqual({ nodes: [], edges: [] });
    expect(buildGraphForReader({ notes: sampleNotes, viewer: null })).toEqual({
      nodes: [],
      edges: []
    });
    expect(buildGraphForReader({ notes: "bad", viewer: { uid: "u1" } })).toEqual({
      nodes: [],
      edges: []
    });
  });

  it("enforces anti-spoiler permissions, excludes deleted/idless notes, ignores persisted mentions, and respects ignoredAliases", () => {
    const graphForU2 = buildGraphForReader({
      notes: sampleNotes,
      viewer: { uid: "u2", isGM: false }
    });

    expect(graphForU2.nodes.map((n) => n.id)).toEqual(["n_party_1", "n_party_2"]);
    // Explicit edge n_party_1 <-> n_party_2 takes precedence over alias mention in n_party_2 -> Taverna
    expect(graphForU2.edges).toEqual([
      {
        id: "n_party_1__n_party_2",
        sourceId: "n_party_1",
        targetId: "n_party_2",
        kind: "explicit"
      }
    ]);

    const graphForU1 = buildGraphForReader({
      notes: sampleNotes,
      viewer: { uid: "u1", isGM: false }
    });
    expect(graphForU1.nodes.map((n) => n.id)).toEqual([
      "n_party_1",
      "n_party_2",
      "n_player_u1"
    ]);
    // n_party_1 mentions "Joao" via sections (FUN-28 matches "João") creating alias edge to n_player_u1
    expect(graphForU1.edges).toEqual([
      {
        id: "n_party_1__n_party_2",
        sourceId: "n_party_1",
        targetId: "n_party_2",
        kind: "explicit"
      },
      {
        id: "n_party_1__n_player_u1",
        sourceId: "n_party_1",
        targetId: "n_player_u1",
        kind: "alias"
      }
    ]);
  });

  it("hides GM-scoped notes even from former_gm when isGM is false, and reveals them when isGM is true", () => {
    const formerGmGraph = buildGraphForReader({
      notes: sampleNotes,
      viewer: { uid: "former_gm", isGM: false }
    });
    expect(formerGmGraph.nodes.map((n) => n.id)).toEqual(["n_party_1", "n_party_2"]);

    const activeGmGraph = buildGraphForReader({
      notes: sampleNotes,
      viewer: { uid: "gm_now", isGM: true }
    });
    expect(activeGmGraph.nodes.map((n) => n.id)).toEqual([
      "n_party_1",
      "n_party_2",
      "n_player_u1",
      "n_gm_secret"
    ]);
  });

  it("filters by enabledTypes and defaults missing noteType to lore", () => {
    const noTypeNote = {
      id: "n_notype",
      title: "",
      scope: NOTE_SCOPES.PARTY,
      sections: {}
    };
    const filtered = buildGraphForReader({
      notes: [...sampleNotes, noTypeNote],
      viewer: { uid: "u2", isGM: false },
      enabledTypes: { [NOTE_TYPES.CHARACTER]: false }
    });

    expect(filtered.nodes.map((n) => n.id)).toEqual(["n_party_1", "n_notype"]);
    expect(filtered.nodes[1].title).toBe(DEFAULT_NAMES.note);
    expect(filtered.nodes[1].noteType).toBe(NOTE_TYPES.LORE);
    expect(filtered.edges).toEqual([]);
  });

  it("emits pure node shape using graphPosition or circular fallback (never graphNode or UI styling)", () => {
    const graph = buildGraphForReader({
      notes: sampleNotes,
      viewer: { uid: "u2", isGM: false }
    });

    const node1 = graph.nodes[0];
    expect(node1.x).toBe(120);
    expect(node1.y).toBe(240);
    expect(node1.pinned).toBe(true);
    expect(node1.linkedCharacterId).toBe("char_1");
    expect(node1.color).toBeUndefined();
    expect(node1.icon).toBeUndefined();
    expect(node1.typeLabel).toBeUndefined();

    const node2 = graph.nodes[1];
    expect(Number.isFinite(node2.x)).toBe(true);
    expect(Number.isFinite(node2.y)).toBe(true);
    expect(node2.x).not.toBe(999);
    expect(node2.pinned).toBe(false);
  });

  it("ensures explicit edge wins even when alias-mentioning note precedes explicit-link note", () => {
    const orderedNotes = [
      {
        id: "n_first",
        title: "Primeiro",
        scope: NOTE_SCOPES.PARTY,
        sections: { s1: { title: "", content: "Segundo", order: 0 } }
      },
      {
        id: "n_second",
        title: "Segundo",
        scope: NOTE_SCOPES.PARTY,
        relatedNoteIds: ["n_first"],
        sections: {}
      }
    ];

    const graph = buildGraphForReader({
      notes: orderedNotes,
      viewer: { uid: "u1", isGM: false }
    });
    expect(graph.edges).toEqual([
      {
        id: "n_first__n_second",
        sourceId: "n_second",
        targetId: "n_first",
        kind: "explicit"
      }
    ]);
  });
});
