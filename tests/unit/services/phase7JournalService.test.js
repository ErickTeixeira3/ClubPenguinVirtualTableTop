import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOTE_SCOPES, NOTE_TYPES } from "../../../src/domain/constants.js";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import { LEGACY_NOTE_KEYS } from "../../../src/domain/models/note.js";
import { fakeDb, firestoreModule, resetFakeDb } from "../../support/fakeFirebase.js";

const grantMediaAudienceMock = vi.fn(async () => ({ updated: true }));
const uploadCompressedMediaMock = vi.fn(async () => ({ mediaId: "med_uploaded" }));
const assertClientUpToDateMock = vi.fn();
const batchCommits = [];

vi.mock("firebase/firestore", () => ({
  ...firestoreModule,
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, payload) => ops.push({ store: "fs", op: "batchSet", path: ref.path, payload }),
      update: (ref, payload) => ops.push({ store: "fs", op: "batchUpdate", path: ref.path, payload }),
      delete: (ref) => ops.push({ store: "fs", op: "batchDelete", path: ref.path }),
      commit: async () => {
        batchCommits.push(ops);
        fakeDb.writes.push(...ops);
      }
    };
  }
}));

vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);
vi.mock("../../../src/services/mediaService.js", () => ({
  grantMediaAudience: grantMediaAudienceMock,
  uploadCompressedMedia: uploadCompressedMediaMock
}));
vi.mock("../../../src/services/runtimeConfigService.js", () => ({
  assertClientUpToDate: assertClientUpToDateMock
}));

const journalService = await import("../../../src/services/journalService.js");

beforeEach(() => {
  resetFakeDb();
  batchCommits.length = 0;
  grantMediaAudienceMock.mockClear();
  uploadCompressedMediaMock.mockClear();
  assertClientUpToDateMock.mockReset();
});

function expectNoLegacyFields(payload) {
  expect(payload).not.toHaveProperty("id");
  for (const legacyKey of LEGACY_NOTE_KEYS) {
    expect(payload).not.toHaveProperty(legacyKey);
  }
}

describe("Phase 7 — journalService v2", () => {
  it("subscribeNotes ignora docs deletados/legados de pasta, converte v2 e ordena por updatedAt desc", () => {
    fakeDb.collections.set("campaigns/camp_1/notes", [
      {
        id: "n_old",
        campaignId: "camp_1",
        scope: NOTE_SCOPES.PARTY,
        ownerId: "u_1",
        visibleTo: ["ALL", "u_1"],
        editableBy: ["ALL", "u_1"],
        noteType: NOTE_TYPES.LORE,
        title: "Antiga",
        sections: { sec_1: { id: "sec_1", title: "", content: "Txt", order: 0 } },
        updatedAt: { seconds: 100 }
      },
      {
        id: "n_new",
        campaignId: "camp_1",
        scope: NOTE_SCOPES.PARTY,
        ownerId: "u_1",
        visibleTo: ["ALL", "u_1"],
        editableBy: ["ALL", "u_1"],
        noteType: NOTE_TYPES.QUEST,
        title: "Nova",
        image: { mediaId: "med_n", url: null },
        graphPosition: { x: 40, y: 80, pinned: true },
        updatedAt: { toMillis: () => 500000 }
      },
      {
        id: "n_del",
        campaignId: "camp_1",
        scope: NOTE_SCOPES.PARTY,
        ownerId: "u_1",
        isDeleted: true,
        title: "Apagada"
      },
      {
        id: "n_fld",
        campaignId: "camp_1",
        isFolder: true,
        title: "Pasta legada"
      }
    ]);

    const received = [];
    const unsub = journalService.subscribeNotes({
      campaignId: "camp_1",
      gmId: "gm_1",
      isRealGM: true,
      uid: "gm_1",
      onNext: (notes) => received.push(notes)
    });

    expect(typeof unsub).toBe("function");
    expect(received).toHaveLength(1);
    expect(received[0].map((n) => n.id)).toEqual(["n_new", "n_old"]);
    expect(received[0][0].image).toEqual({ mediaId: "med_n", url: null });
    expect(received[0][0].graphPosition).toEqual({ x: 40, y: 80, pinned: true });
    unsub();

    expect(typeof journalService.subscribeNotes({ campaignId: "", uid: "u1" })).toBe("function");
  });

  it("createJournalNote e updateJournalNote gravam apenas campos v2 (sem legados/derivados)", async () => {
    const created = await journalService.createJournalNote({
      campaignId: "camp_1",
      campaign: { gmId: "gm_1" },
      user: { uid: "u_1" },
      scope: NOTE_SCOPES.PARTY,
      noteType: NOTE_TYPES.CHARACTER,
      folderId: "fld_1",
      title: "Pinguim Ancião",
      aliases: ["Ancião"],
      content: "Texto convertido em seção",
      image: { mediaId: "med_card", url: null },
      linkedCharacterSheetId: "char_legacy_prop"
    });

    expect(created.ok).toBe(true);
    expect(assertClientUpToDateMock).toHaveBeenCalledTimes(1);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp_1",
      mediaId: "med_card",
      visibleTo: ["ALL", "u_1"]
    });

    const createWrite = fakeDb.writes.find((w) => w.op === "set");
    expectNoLegacyFields(createWrite.payload);
    expect(createWrite.payload.image).toEqual({ mediaId: "med_card", url: null });
    expect(createWrite.payload.linkedCharacterId).toBe("char_legacy_prop");
    expect(createWrite.payload.graphPosition).toEqual({ x: null, y: null, pinned: false });
    expect(createWrite.payload.rev).toBe(0);
    expect(createWrite.payload.sections.sec_1.content).toBe("Texto convertido em seção");

    const existing = { id: created.noteId, ...createWrite.payload };
    const updated = await journalService.updateJournalNote({
      campaignId: "camp_1",
      campaign: { gmId: "gm_1" },
      user: { uid: "u_2" },
      isGM: false,
      existingNote: existing,
      noteId: created.noteId,
      updates: {
        title: "Pinguim Ancião Editado",
        content: "ignorado",
        mentionedNoteIds: ["x"],
        aliasesNormalized: ["anciao"],
        scope: NOTE_SCOPES.GM,
        sections: { sec_1: { id: "sec_1", title: "História", content: "Novo corpo", order: 0 } }
      }
    });

    expect(updated).toEqual({ ok: true, noteId: created.noteId });
    const updateWrite = fakeDb.writes.find((w) => w.op === "update");
    expectNoLegacyFields(updateWrite.payload);
    expect(updateWrite.payload.scope).toBeUndefined();
    expect(updateWrite.payload.rev).toBe(1);
  });

  it("saveNoteDraft envia atualização da nota e novos aliases dos alvos em writeBatch atômico", async () => {
    const sourceNote = {
      id: "note_src",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PARTY,
      ownerId: "u_1",
      visibleTo: ["ALL", "u_1"],
      editableBy: ["ALL", "u_1"],
      noteType: NOTE_TYPES.LORE,
      title: "Investigação",
      aliases: [],
      ignoredAliases: [],
      sections: { sec_1: { id: "sec_1", title: "", content: "Falamos com o Barba Branca.", order: 0 } },
      relatedNoteIds: [],
      rev: 3,
      isDeleted: false
    };
    const targetEditable = {
      id: "note_target",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PARTY,
      ownerId: "u_2",
      visibleTo: ["ALL", "u_2"],
      editableBy: ["ALL", "u_2"],
      title: "Capitão",
      aliases: ["Cap"],
      isDeleted: false
    };

    const res = await journalService.saveNoteDraft({
      campaignId: "camp_1",
      campaign: { gmId: "gm_1" },
      user: { uid: "u_1" },
      isGM: false,
      existingNote: sourceNote,
      accessibleNotes: [sourceNote, targetEditable],
      draft: {
        id: "note_src",
        title: "Investigação",
        noteType: NOTE_TYPES.LORE,
        aliases: [],
        ignoredAliases: ["Porto"],
        relatedNoteIds: ["note_target"],
        sections: sourceNote.sections,
        targetAliasAdditions: {
          note_target: ["Barba Branca", "Cap"]
        }
      }
    });

    expect(res).toEqual({ ok: true, noteId: "note_src" });
    expect(batchCommits).toHaveLength(1);
    const ops = batchCommits[0];
    expect(ops).toHaveLength(2);
    const noteUpdate = ops.find((o) => o.path === "campaigns/camp_1/notes/note_src");
    const targetUpdate = ops.find((o) => o.path === "campaigns/camp_1/notes/note_target");
    expectNoLegacyFields(noteUpdate.payload);
    expect(noteUpdate.payload.ignoredAliases).toEqual(["Porto"]);
    expect(noteUpdate.payload.relatedNoteIds).toEqual(["note_target"]);
    expect(noteUpdate.payload.rev).toBe(4);
    expect(targetUpdate.payload.aliases).toEqual(["Cap", "Barba Branca"]);
    expect(targetUpdate.payload.rev).toEqual({ __op: "increment", value: 1 });
  });

  it("saveNoteDraft aborta antes de qualquer gravação quando um card-alvo não é editável pelo usuário", async () => {
    const sourceNote = {
      id: "note_src",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PLAYER,
      ownerId: "u_1",
      visibleTo: ["u_1"],
      editableBy: ["u_1"],
      noteType: NOTE_TYPES.LORE,
      title: "Diário do P1",
      sections: {},
      rev: 0
    };
    const readonlyTarget = {
      id: "note_ro",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PLAYER,
      ownerId: "gm_1",
      visibleTo: ["gm_1", "u_1"],
      editableBy: ["gm_1"],
      title: "Segredo do Mestre",
      aliases: [],
      isDeleted: false
    };

    const res = await journalService.saveNoteDraft({
      campaignId: "camp_1",
      user: { uid: "u_1" },
      isGM: false,
      existingNote: sourceNote,
      accessibleNotes: [sourceNote, readonlyTarget],
      draft: {
        id: "note_src",
        title: "Diário do P1",
        targetAliasAdditions: {
          note_ro: ["Inimigo Oculto"]
        }
      }
    });

    expect(res.ok).toBe(false);
    expect(res.reason).toBe("permission-denied");
    expect(fakeDb.writes).toEqual([]);
  });

  it("cloneJournalNoteToTarget copia apenas campos de origem v2 sem herdar graphPosition nem legados", async () => {
    const sourceNote = {
      id: "note_orig",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.GM,
      ownerId: "gm_1",
      visibleTo: [],
      editableBy: [],
      noteType: NOTE_TYPES.EVENT,
      folderId: "fld_gm",
      title: "Emboscada",
      aliases: ["Cerco"],
      ignoredAliases: ["Neve"],
      sections: { s1: { id: "s1", title: "Cena", content: "Detalhes", order: 0 } },
      relatedNoteIds: ["n_2"],
      linkedCharacterId: "char_boss",
      image: { mediaId: "med_img", url: null },
      graphPosition: { x: 250, y: 120, pinned: true },
      content: "legado",
      mentionedNoteIds: ["n_9"],
      aliasesNormalized: ["emboscada"]
    };

    const res = await journalService.cloneJournalNoteToTarget({
      campaignId: "camp_1",
      campaign: { gmId: "gm_1" },
      user: { uid: "gm_1" },
      isGM: true,
      sourceNote,
      targetScope: NOTE_SCOPES.PLAYER,
      targetOwnerId: "u_2"
    });

    const cloneWrite = fakeDb.writes.find((w) => w.op === "set");
    expect(res.noteId).toBeTruthy();
    expectNoLegacyFields(cloneWrite.payload);
    expect(cloneWrite.payload.clonedFromNoteId).toBe("note_orig");
    expect(cloneWrite.payload.ownerId).toBe("u_2");
    expect(cloneWrite.payload.folderId).toBeNull();
    expect(cloneWrite.payload.graphPosition).toEqual({ x: null, y: null, pinned: false });
    expect(cloneWrite.payload.sections).toEqual(sourceNote.sections);
    expect(cloneWrite.payload.image).toEqual({ mediaId: "med_img", url: null });
    expect(cloneWrite.payload.linkedCharacterId).toBe("char_boss");
  });

  it("updateJournalNodePosition atualiza graphPosition com rev++ e bloqueia não editores", async () => {
    const partyNote = {
      id: "n_pos",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PLAYER,
      ownerId: "u_1",
      visibleTo: ["u_1", "u_2"],
      editableBy: ["u_1"],
      rev: 2
    };

    await expect(
      journalService.updateJournalNodePosition({
        campaignId: "camp_1",
        user: { uid: "u_2" },
        isGM: false,
        existingNote: partyNote,
        noteId: "n_pos",
        x: 100,
        y: 200
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });
    expect(fakeDb.writes).toEqual([]);

    const okRes = await journalService.updateJournalNodePosition({
      campaignId: "camp_1",
      user: { uid: "u_1" },
      isGM: false,
      existingNote: partyNote,
      noteId: "n_pos",
      x: 100.4,
      y: 200.6
    });
    expect(okRes).toEqual({ ok: true, noteId: "n_pos" });
    const write = fakeDb.writes.find((w) => w.op === "update");
    expect(write.payload.graphPosition).toEqual({ x: 100, y: 201, pinned: true });
    expect(write.payload.rev).toBe(3);
  });

  it("softDeleteJournalNote aplica D-3 (isDeleted/deletedAt/deletedBy/rev++) apenas para dono ou GM e propaga assertClientUpToDate", async () => {
    const partyNote = {
      id: "n_del_test",
      campaignId: "camp_1",
      scope: NOTE_SCOPES.PARTY,
      ownerId: "u_1",
      visibleTo: ["ALL", "u_1"],
      editableBy: ["ALL", "u_1"],
      rev: 4
    };

    // Editor não-dono não exclui (nem escreve)
    await journalService.softDeleteJournalNote({
      campaignId: "camp_1",
      user: { uid: "u_2" },
      isGM: false,
      note: partyNote,
      noteId: "n_del_test"
    });
    expect(fakeDb.writes).toEqual([]);

    // Dono aplica soft delete D-3
    await journalService.softDeleteJournalNote({
      campaignId: "camp_1",
      user: { uid: "u_1" },
      isGM: false,
      note: partyNote,
      noteId: "n_del_test"
    });
    const delWrite = fakeDb.writes.find((w) => w.op === "update");
    expect(delWrite.payload.isDeleted).toBe(true);
    expect(delWrite.payload.deletedBy).toBe("u_1");
    expect(delWrite.payload.rev).toBe(5);

    assertClientUpToDateMock.mockImplementation(() => {
      throw new Error("CLIENT_OUTDATED");
    });
    await expect(
      journalService.createJournalNote({
        campaignId: "camp_1",
        user: { uid: "u_1" },
        title: "Bloqueado"
      })
    ).rejects.toThrow("CLIENT_OUTDATED");
  });
});
