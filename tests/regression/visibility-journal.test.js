// Regressão portada de auditoria_refatoracao/validar-regressoes.mjs: A1-A3 (caminhos), A7-A8, A9, A31 (serviço).
// As partes de regras (A1-A3, A4, A32, A33) estão em tests/rules/v1-regression.test.js, contra o emulador.
// Partes não portadas, por não continuarem aplicáveis no v2: o modo de layout "legacy" do RTDB (A1-A3)
// e a presença obrigatória do Mestre em visibleTo (A7-A9; no v2 o Mestre lê pela regra, Seção 6.3.1).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../support/fakeFirebase.js";

vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);
vi.mock("../../src/services/mediaService.js", () => ({
  uploadCompressedMedia: async () => ({ mediaId: "med_stub", byteLength: 100 }),
  grantMediaAudience: async () => null
}));

const rtdbPaths = await import("../../src/infra/rtdbPaths.js");
const { applyOwnerAndGmAudience } = await import("../../src/services/visibilityService.js");
const journalService = await import("../../src/services/journalService.js");

beforeEach(resetFakeDb);

describe("A1-A3: desenhos e pings em nós irmãos do RTDB", () => {
  it("usa drawings/{cena} e pings/{cena}", () => {
    expect(rtdbPaths.drawingsPath("main-table", "s1")).toBe("vtt_realtime/main-table/drawings/s1");
    expect(rtdbPaths.pingsPath("main-table", "s1")).toBe("vtt_realtime/main-table/pings/s1");
  });
});

describe("A7-A8: transferência e audiência mínima", () => {
  it("transferir inclui o novo dono em visibleTo e editableBy", () => {
    const merged = applyOwnerAndGmAudience(
      { ownerId: "player2" },
      { ownerId: "gm1", visibleTo: ["gm1"], editableBy: ["gm1"] },
      "gm1"
    );
    expect(merged.visibleTo).toContain("player2");
    expect(merged.editableBy).toContain("player2");
  });

  it("remover ALL mantém o dono na audiência", () => {
    const removedAll = applyOwnerAndGmAudience(
      { visibleTo: [] },
      { ownerId: "player1", visibleTo: ["ALL"], editableBy: ["player1"] },
      "gm1"
    );
    expect(removedAll.visibleTo).toContain("player1");
    expect(removedAll.visibleTo).not.toContain("ALL");
  });
});

describe("A9: revogar o Grupo de um card", () => {
  it("passa o card para escopo de jogador e preserva o dono em visibleTo", async () => {
    const note = { id: "n1", ownerId: "player1", scope: "party", visibleTo: ["ALL"] };
    await journalService.revokeJournalNoteAccess({
      campaignId: "main-table",
      campaign: { gmId: "gm1" },
      user: { uid: "player1" },
      isGM: false,
      isRealGM: false,
      note,
      noteId: note.id,
      target: "party"
    });
    const write = fakeDb.writes.find((w) => w.path === "campaigns/main-table/notes/n1");
    expect(write.payload.scope).toBe("player");
    expect(write.payload.visibleTo).toContain("player1");
    expect(write.payload.visibleTo).not.toContain("ALL");
  });
});

describe("A31: edição de card sem permissão", () => {
  it("updateJournalNote recusa com permission-denied e não grava", async () => {
    const roNote = { id: "n_ro", ownerId: "gm1", scope: "player", visibleTo: ["gm1", "player1"], editableBy: ["gm1"], title: "Secreto" };
    const result = await journalService.updateJournalNote({
      campaignId: "main-table",
      campaign: { gmId: "gm1" },
      user: { uid: "player1" },
      isGM: false,
      existingNote: roNote,
      noteId: roNote.id,
      updates: { title: "Alterado" }
    });
    expect(result).toMatchObject({ ok: false, reason: "permission-denied" });
    expect(fakeDb.writes).toHaveLength(0);
  });
});
