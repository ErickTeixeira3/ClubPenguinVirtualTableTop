import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import { FOLDER_DOMAINS, NOTE_SCOPES, NOTE_TYPES } from "../../../src/domain/constants.js";
import { fakeDb, firestoreModule, resetFakeDb } from "../../support/fakeFirebase.js";

const grantMediaAudienceMock = vi.fn(async () => ({ updated: true }));
const assertClientUpToDateMock = vi.fn();

let commitFailure = null;
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
        if (commitFailure) {
          const err = commitFailure;
          commitFailure = null;
          throw err;
        }
        batchCommits.push(ops);
        fakeDb.writes.push(...ops);
      }
    };
  }
}));

vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);
vi.mock("../../../src/services/mediaService.js", () => ({
  grantMediaAudience: grantMediaAudienceMock
}));
vi.mock("../../../src/services/runtimeConfigService.js", () => ({
  assertClientUpToDate: assertClientUpToDateMock
}));

const folderService = await import("../../../src/services/folderService.js");

beforeEach(() => {
  resetFakeDb();
  batchCommits.length = 0;
  commitFailure = null;
  grantMediaAudienceMock.mockClear();
  assertClientUpToDateMock.mockClear();
});

describe("folderService — Fase 6 (Pastas Unificadas)", () => {
  it("cria pastas v2 (character e journal) e rejeita nomes com '/' ou pai incompatível", async () => {
    const charFolder = await folderService.createFolder({
      campaignId: "camp1",
      user: { uid: "p1" },
      isGM: false,
      gmId: "gm1",
      domain: FOLDER_DOMAINS.CHARACTER,
      name: "  Aliados  "
    });
    expect(charFolder.domain).toBe("character");
    expect(charFolder.name).toBe("Aliados");
    expect(charFolder.ownerId).toBe("p1");
    expect(charFolder.scope).toBeNull();

    const setCharWrite = fakeDb.writes.find((w) => w.op === "set" && w.path.endsWith(`/${charFolder.id}`));
    expect(setCharWrite.payload.domain).toBe("character");
    expect(setCharWrite.payload).not.toHaveProperty("scope");
    expect(setCharWrite.payload).not.toHaveProperty("noteType");
    expect(setCharWrite.payload).not.toHaveProperty("isFolder");
    expect(setCharWrite.payload).not.toHaveProperty("folderType");

    const gmJournalFolder = await folderService.createFolder({
      campaignId: "camp1",
      user: { uid: "gm1" },
      isGM: true,
      gmId: "gm1",
      domain: FOLDER_DOMAINS.JOURNAL,
      scope: NOTE_SCOPES.GM,
      noteType: NOTE_TYPES.QUEST,
      name: "Atos Secretos"
    });
    expect(gmJournalFolder.domain).toBe("journal");
    expect(gmJournalFolder.scope).toBe("gm");
    expect(gmJournalFolder.noteType).toBe("quest");
    expect(gmJournalFolder.visibleTo).toEqual([]);
    expect(gmJournalFolder.editableBy).toEqual([]);

    await expect(
      folderService.createFolder({
        campaignId: "camp1",
        user: { uid: "p1" },
        domain: FOLDER_DOMAINS.JOURNAL,
        scope: NOTE_SCOPES.PARTY,
        noteType: NOTE_TYPES.LORE,
        name: "Ato 1/Cena 2"
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_FOLDER_NAME });

    await expect(
      folderService.createFolder({
        campaignId: "camp1",
        user: { uid: "p1" },
        domain: FOLDER_DOMAINS.JOURNAL,
        scope: NOTE_SCOPES.PARTY,
        noteType: NOTE_TYPES.LORE,
        name: "Sub",
        parentId: gmJournalFolder.id,
        existingFolders: [gmJournalFolder]
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.INCOMPATIBLE_FOLDER });
  });

  it("permite renomear via editableBy (A4) sem '/', mas bloqueia quem não tem acesso", async () => {
    const folder = {
      id: "fld_1",
      campaignId: "camp1",
      domain: FOLDER_DOMAINS.CHARACTER,
      name: "Antiga",
      parentId: null,
      ownerId: "p1",
      visibleTo: ["p1", "p2"],
      editableBy: ["p1", "p2"],
      isDeleted: false
    };

    await folderService.renameFolder({
      campaignId: "camp1",
      user: { uid: "p2" },
      isGM: false,
      folderId: "fld_1",
      name: "Renomeada",
      folder
    });
    expect(fakeDb.writes[0].payload.name).toBe("Renomeada");

    await expect(
      folderService.renameFolder({
        campaignId: "camp1",
        user: { uid: "p2" },
        isGM: false,
        folderId: "fld_1",
        name: "A/B",
        folder
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.INVALID_FOLDER_NAME });

    await expect(
      folderService.renameFolder({
        campaignId: "camp1",
        user: { uid: "p3" },
        isGM: false,
        folderId: "fld_1",
        name: "Invasão",
        folder
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });
  });

  it("bloqueia ciclo A<->B, auto-pai, movimento por não-dono e permite voltar à raiz", async () => {
    const folders = [
      { id: "f_a", domain: "character", name: "A", parentId: null, ownerId: "p1", visibleTo: ["p1", "p2"], editableBy: ["p1", "p2"] },
      { id: "f_b", domain: "character", name: "B", parentId: "f_a", ownerId: "p1", visibleTo: ["p1"], editableBy: ["p1"] }
    ];

    // Ciclo A -> B (B já é filha de A)
    await expect(
      folderService.moveFolder({
        campaignId: "camp1",
        user: { uid: "p1" },
        isGM: false,
        folderId: "f_a",
        targetParentId: "f_b",
        folders
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.CYCLE_DETECTED });
    expect(fakeDb.writes).toHaveLength(0);

    // Editor não-dono não pode mover pasta
    await expect(
      folderService.moveFolder({
        campaignId: "camp1",
        user: { uid: "p2" },
        isGM: false,
        folderId: "f_a",
        targetParentId: null,
        folders
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    // Dono pode mover B para a raiz (parentId: null)
    await folderService.moveFolder({
      campaignId: "camp1",
      user: { uid: "p1" },
      isGM: false,
      folderId: "f_b",
      targetParentId: null,
      folders
    });
    expect(fakeDb.writes[0].payload.parentId).toBeNull();
  });

  it("transfere dono de subárvore em cascata num único writeBatch (somente Mestre) e concede mídia", async () => {
    const folders = [
      { id: "f_root", domain: "character", name: "Raiz", parentId: null, ownerId: "gm1", visibleTo: ["gm1"], editableBy: ["gm1"] },
      { id: "f_child", domain: "character", name: "Sub", parentId: "f_root", ownerId: "gm1", visibleTo: ["gm1"], editableBy: ["gm1"] },
      { id: "f_other", domain: "character", name: "Outra", parentId: null, ownerId: "gm1", visibleTo: ["gm1"], editableBy: ["gm1"] }
    ];
    const characters = [
      { id: "c1", ownerId: "gm1", folderId: "f_child", visibleTo: ["gm1"], editableBy: ["gm1"], avatar: { mediaId: "med_1", url: null } },
      { id: "c2", ownerId: "gm1", folderId: "f_other", visibleTo: ["gm1"], editableBy: ["gm1"] }
    ];

    await expect(
      folderService.transferFolderOwnership({
        campaignId: "camp1",
        user: { uid: "p1" },
        isGM: false,
        folderId: "f_root",
        newOwnerId: "p1",
        folders,
        characters
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    const res = await folderService.transferFolderOwnership({
      campaignId: "camp1",
      user: { uid: "gm1" },
      isGM: true,
      gmId: "gm1",
      folderId: "f_root",
      newOwnerId: "p1",
      targetParentId: null,
      folders,
      characters
    });

    expect(res.folderIds).toEqual(["f_root", "f_child"]);
    expect(res.characterIds).toEqual(["c1"]);
    expect(batchCommits).toHaveLength(1);
    expect(batchCommits[0]).toHaveLength(3);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_1",
      visibleTo: expect.arrayContaining(["p1", "gm1"])
    });
    const charOp = batchCommits[0].find((op) => op.path.endsWith("/c1"));
    expect(charOp.payload.ownerId).toBe("p1");
    expect(charOp.payload.visibleTo).toContain("p1");
    expect(charOp.payload.editableBy).toContain("p1");
    expect(charOp.payload.rev).toEqual({ __op: "increment", value: 1 });
  });

  it("deleteFolder moveToParent (D-2) preserva subpastas inteiras na pasta pai", async () => {
    const folders = [
      { id: "f_grand", domain: "journal", scope: "party", noteType: "lore", name: "Avô", parentId: null, ownerId: "p1", visibleTo: ["ALL", "p1"], editableBy: ["ALL", "p1"] },
      { id: "f_mid", domain: "journal", scope: "party", noteType: "lore", name: "Meio", parentId: "f_grand", ownerId: "p1", visibleTo: ["ALL", "p1"], editableBy: ["ALL", "p1"] },
      { id: "f_sub", domain: "journal", scope: "party", noteType: "lore", name: "Sub", parentId: "f_mid", ownerId: "p1", visibleTo: ["ALL", "p1"], editableBy: ["ALL", "p1"] },
      { id: "f_leaf", domain: "journal", scope: "party", noteType: "lore", name: "Neta", parentId: "f_sub", ownerId: "p1", visibleTo: ["ALL", "p1"], editableBy: ["ALL", "p1"] }
    ];
    const items = [
      { id: "n_mid", scope: "party", noteType: "lore", folderId: "f_mid", ownerId: "p1" },
      { id: "n_sub", scope: "party", noteType: "lore", folderId: "f_sub", ownerId: "p1" }
    ];

    await folderService.deleteFolder({
      campaignId: "camp1",
      user: { uid: "p1" },
      isGM: false,
      folderId: "f_mid",
      mode: "moveToParent",
      folders,
      items
    });

    expect(batchCommits).toHaveLength(1);
    const ops = batchCommits[0];
    const delMid = ops.find((o) => o.path.endsWith("/folders/f_mid"));
    const moveSub = ops.find((o) => o.path.endsWith("/folders/f_sub"));
    const moveNoteMid = ops.find((o) => o.path.endsWith("/notes/n_mid"));
    expect(delMid.payload.isDeleted).toBe(true);
    expect(moveSub.payload.parentId).toBe("f_grand");
    expect(moveNoteMid.payload.folderId).toBe("f_grand");
    // Neta e nota dentro da subpasta permanecem intactas na subpasta f_sub!
    expect(ops.find((o) => o.path.endsWith("/folders/f_leaf"))).toBeUndefined();
    expect(ops.find((o) => o.path.endsWith("/notes/n_sub"))).toBeUndefined();
  });

  it("deleteFolder deleteAll respeita D-3 (editableBy não exclui, itens alheios vão para o pai) e isola donos (Codex)", async () => {
    const folders = [
      { id: "f_p1", domain: "journal", scope: "party", noteType: "lore", name: "X", parentId: null, ownerId: "p1", visibleTo: ["ALL", "p1"], editableBy: ["ALL", "p1"] },
      { id: "f_p1_sub_p2", domain: "journal", scope: "party", noteType: "lore", name: "SubP2", parentId: "f_p1", ownerId: "p2", visibleTo: ["ALL", "p2"], editableBy: ["ALL", "p2"] },
      // Pasta homônima "X" de outro dono, fora da subárvore
      { id: "f_p2_x", domain: "journal", scope: "party", noteType: "lore", name: "X", parentId: null, ownerId: "p2", visibleTo: ["ALL", "p2"], editableBy: ["ALL", "p2"] }
    ];
    const items = [
      { id: "n_own", scope: "party", noteType: "lore", folderId: "f_p1", ownerId: "p1" },
      { id: "n_other", scope: "party", noteType: "lore", folderId: "f_p1", ownerId: "p2" },
      { id: "n_in_p2_x", scope: "party", noteType: "lore", folderId: "f_p2_x", ownerId: "p2" }
    ];

    // Editor não-dono não pode excluir pasta de p1
    await expect(
      folderService.deleteFolder({
        campaignId: "camp1",
        user: { uid: "p2" },
        isGM: false,
        folderId: "f_p1",
        mode: "deleteAll",
        folders,
        items
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    // p1 exclui f_p1 em deleteAll: n_own vai para isDeleted; f_p1_sub_p2 e n_other vão para raiz (null); f_p2_x intocada
    await folderService.deleteFolder({
      campaignId: "camp1",
      user: { uid: "p1" },
      isGM: false,
      folderId: "f_p1",
      mode: "deleteAll",
      folders,
      items
    });

    const ops = batchCommits[0];
    expect(ops.find((o) => o.path.endsWith("/folders/f_p1")).payload.isDeleted).toBe(true);
    expect(ops.find((o) => o.path.endsWith("/notes/n_own")).payload.isDeleted).toBe(true);
    expect(ops.find((o) => o.path.endsWith("/folders/f_p1_sub_p2")).payload.parentId).toBeNull();
    expect(ops.find((o) => o.path.endsWith("/notes/n_other")).payload.folderId).toBeNull();
    expect(ops.find((o) => o.path.endsWith("/folders/f_p2_x"))).toBeUndefined();
    expect(ops.find((o) => o.path.endsWith("/notes/n_in_p2_x"))).toBeUndefined();
  });

  it("aborta antes de comitar acima de 450 escritas e propaga falha de batch sem engolir erro", async () => {
    const folders = [
      { id: "f_big", domain: "character", name: "Grande", parentId: null, ownerId: "p1", visibleTo: ["p1"], editableBy: ["p1"] }
    ];
    const manyItems = Array.from({ length: 451 }, (_, idx) => ({
      id: `c_${idx}`,
      ownerId: "p1",
      folderId: "f_big"
    }));

    await expect(
      folderService.deleteFolder({
        campaignId: "camp1",
        user: { uid: "p1" },
        isGM: false,
        folderId: "f_big",
        mode: "deleteAll",
        folders,
        items: manyItems
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.OUT_OF_RANGE });
    expect(batchCommits).toHaveLength(0);
    expect(fakeDb.writes).toHaveLength(0);

    commitFailure = new Error("Simulated batch failure");
    await expect(
      folderService.deleteFolder({
        campaignId: "camp1",
        user: { uid: "p1" },
        isGM: false,
        folderId: "f_big",
        mode: "deleteAll",
        folders,
        items: [{ id: "c_1", ownerId: "p1", folderId: "f_big" }]
      })
    ).rejects.toThrow("Simulated batch failure");
    expect(fakeDb.writes).toHaveLength(0);
  });
});
