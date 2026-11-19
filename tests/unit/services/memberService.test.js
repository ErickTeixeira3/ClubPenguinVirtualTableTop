import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const firestoreSpies = vi.hoisted(() => ({
  collection: vi.fn((_db, p) => ({ path: p })),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((_db, p) => ({
    path: p,
    withConverter: () => ({ path: p })
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn((...args) => args),
  serverTimestamp: vi.fn(() => "__SERVER_TS__"),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  where: vi.fn((...args) => args),
  writeBatch: vi.fn()
}));

const rtdbSpies = vi.hoisted(() => ({
  get: vi.fn(),
  ref: vi.fn((_db, p) => ({ path: p })),
  remove: vi.fn(async () => {}),
  set: vi.fn(async () => {}),
  update: vi.fn(async () => {})
}));

const runtimeSpies = vi.hoisted(() => ({
  assertClientUpToDate: vi.fn()
}));

vi.mock("firebase/firestore", () => firestoreSpies);
vi.mock("firebase/database", () => rtdbSpies);
vi.mock("../../../src/infra/firebase.js", () => ({ db: {}, rtdb: {} }));
vi.mock("../../../src/services/runtimeConfigService.js", () => runtimeSpies);

const memberService = await import("../../../src/services/memberService.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("memberService", () => {
  it("buildPlayersMapFromMembers constrói mapa compatível respeitando avatarRemoved e gmId", () => {
    const map = memberService.buildPlayersMapFromMembers(
      [
        {
          uid: "gm1",
          displayName: "Mestre",
          avatar: { mediaId: "med_gm", url: null },
          activeCharacterId: null,
          joinedAt: 100
        },
        {
          uid: "p1",
          displayName: "P1",
          avatar: { mediaId: null, url: null },
          activeCharacterId: "c1",
          joinedAt: 200
        },
        {
          uid: "p2",
          displayName: "P2",
          avatar: { mediaId: null, url: "https://example.invalid/p2.png" },
          activeCharacterId: null,
          joinedAt: 300
        }
      ],
      "gm1",
      { med_gm: "blob:gm-avatar" }
    );

    expect(map.gm1).toMatchObject({
      uid: "gm1",
      role: "gm",
      avatarMediaId: "med_gm",
      photoURL: "blob:gm-avatar",
      avatarRemoved: false
    });
    expect(map.p1).toMatchObject({
      uid: "p1",
      role: "player",
      avatarMediaId: null,
      photoURL: null,
      avatarRemoved: true,
      activeCharacterId: "c1"
    });
    expect(map.p2).toMatchObject({
      uid: "p2",
      role: "player",
      photoURL: "https://example.invalid/p2.png",
      avatarRemoved: false
    });
  });

  it("assignGM executa protocolo em 4 passos, valida membro, trata corrida do Passo 3 e limpa pendingGm", async () => {
    const order = [];
    firestoreSpies.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ uid: "gmB", campaignId: "camp1", displayName: "B" })
    });
    rtdbSpies.set.mockImplementation(async (ref, val) => {
      order.push(["rtdbSet", ref.path, val]);
    });
    firestoreSpies.updateDoc.mockImplementation(async (ref, val) => {
      order.push(["fsUpdate", ref.path, val.gmId]);
    });
    rtdbSpies.update.mockImplementation(async (ref, val) => {
      order.push(["rtdbUpdate", ref.path, val]);
    });

    await memberService.assignGM({
      campaignId: "camp1",
      currentGmId: "gmA",
      targetUid: "gmB",
      firestoreDb: {},
      realtimeDb: {}
    });

    expect(order).toEqual([
      ["rtdbSet", "vtt_realtime/camp1/meta/pendingGm", "gmB"],
      ["fsUpdate", "campaigns/camp1", "gmB"],
      ["rtdbUpdate", "vtt_realtime/camp1/meta", { gmId: "gmB", pendingGm: null }]
    ]);

    // Alvo não membro falha antes de tocar em meta/pendingGm
    firestoreSpies.getDoc.mockResolvedValueOnce({ exists: () => false });
    rtdbSpies.set.mockClear();
    await expect(
      memberService.assignGM({
        campaignId: "camp1",
        currentGmId: "gmA",
        targetUid: "stranger",
        firestoreDb: {},
        realtimeDb: {}
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND });
    expect(rtdbSpies.set).not.toHaveBeenCalled();

    // Se o novo Mestre já concluiu o Passo 4 antes do Passo 3 do antigo Mestre, não falha falsamente
    rtdbSpies.update.mockRejectedValueOnce({ code: "PERMISSION_DENIED" });
    rtdbSpies.get.mockResolvedValueOnce({ val: () => "gmB" });
    await expect(
      memberService.assignGM({
        campaignId: "camp1",
        currentGmId: "gmA",
        targetUid: "gmB",
        firestoreDb: {},
        realtimeDb: {}
      })
    ).resolves.toEqual({ gmId: "gmB" });

    // Falha no Firestore limpa pendingGm
    firestoreSpies.updateDoc.mockRejectedValueOnce(new Error("boom-firestore"));
    await expect(
      memberService.assignGM({
        campaignId: "camp1",
        currentGmId: "gmA",
        targetUid: "gmB",
        firestoreDb: {},
        realtimeDb: {}
      })
    ).rejects.toThrow("boom-firestore");
    expect(rtdbSpies.set).toHaveBeenLastCalledWith(
      { path: "vtt_realtime/camp1/meta/pendingGm" },
      null
    );
  });

  it("revokeMember recusa remover o Mestre atual e revoga membro, presença e convite em lote", async () => {
    await expect(
      memberService.revokeMember({
        campaignId: "camp1",
        targetUid: "gm1",
        currentGmId: "gm1",
        firestoreDb: {},
        realtimeDb: {}
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    const batchOps = [];
    firestoreSpies.writeBatch.mockReturnValue({
      delete: (ref) => batchOps.push(["delete", ref.path]),
      commit: vi.fn(async () => batchOps.push(["commit"]))
    });
    firestoreSpies.getDocs.mockResolvedValue({
      docs: [{ id: "alice@example.com", ref: { path: "campaigns/camp1/invites/alice@example.com" } }]
    });

    const res = await memberService.revokeMember({
      campaignId: "camp1",
      targetUid: "u_alice",
      currentGmId: "gm1",
      firestoreDb: {},
      realtimeDb: {}
    });

    expect(res).toEqual({ uid: "u_alice", removedInvites: 1 });
    expect(batchOps).toEqual([
      ["delete", "campaigns/camp1/members/u_alice"],
      ["delete", "campaigns/camp1/invites/alice@example.com"],
      ["commit"]
    ]);
    expect(rtdbSpies.update).toHaveBeenCalledWith(
      { path: "vtt_realtime/camp1" },
      {
        "meta/members/u_alice": null,
        "presence/u_alice": null,
        "meta/invites/alice@example,com": null
      }
    );
  });

  it("reconcileMirrors remove presença e membros órfãos e evita escrita redundante quando tudo bate", async () => {
    firestoreSpies.getDocs
      .mockResolvedValueOnce({ docs: [{ id: "gm1" }] })
      .mockResolvedValueOnce({
        docs: [{ id: "a@b.com", data: () => ({ acceptedBy: null }) }]
      });
    const rtdbMap1 = {
      "vtt_realtime/camp1/meta/gmId": "gm1",
      "vtt_realtime/camp1/meta/pendingGm": null,
      "vtt_realtime/camp1/meta/members": { gm1: true, u_stale: true },
      "vtt_realtime/camp1/meta/invites": { "a@b,com": true, "old@b,com": true },
      "vtt_realtime/camp1/presence": { gm1: { c1: {} }, u_stale: { c2: {} } }
    };
    rtdbSpies.get.mockImplementation(async (ref) => ({
      val: () => (Object.hasOwn(rtdbMap1, ref.path) ? rtdbMap1[ref.path] : null)
    }));

    const res = await memberService.reconcileMirrors({
      campaignId: "camp1",
      currentUid: "gm1",
      campaignGmId: "gm1",
      firestoreDb: {},
      realtimeDb: {}
    });

    expect(res.changed).toBe(true);
    expect(rtdbSpies.update).toHaveBeenCalledWith(
      { path: "vtt_realtime/camp1" },
      {
        "meta/members/u_stale": null,
        "presence/u_stale": null,
        "meta/invites/old@b,com": null
      }
    );

    rtdbSpies.update.mockClear();
    firestoreSpies.getDocs
      .mockResolvedValueOnce({ docs: [{ id: "gm1" }] })
      .mockResolvedValueOnce({ docs: [] });
    const rtdbMap2 = {
      "vtt_realtime/camp1/meta/gmId": "gm1",
      "vtt_realtime/camp1/meta/pendingGm": null,
      "vtt_realtime/camp1/meta/members": { gm1: true },
      "vtt_realtime/camp1/meta/invites": {},
      "vtt_realtime/camp1/presence": { gm1: { c1: {} } }
    };
    rtdbSpies.get.mockImplementation(async (ref) => ({
      val: () => (Object.hasOwn(rtdbMap2, ref.path) ? rtdbMap2[ref.path] : null)
    }));

    const noop = await memberService.reconcileMirrors({
      campaignId: "camp1",
      currentUid: "gm1",
      campaignGmId: "gm1",
      firestoreDb: {},
      realtimeDb: {}
    });
    expect(noop).toEqual({ changed: false, updatedKeys: [] });
    expect(rtdbSpies.update).not.toHaveBeenCalled();
  });

  it("revokeInvite delega para revokeMember quando convite já foi aceito", async () => {
    firestoreSpies.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ acceptedBy: "u_bob" })
    });
    firestoreSpies.getDocs.mockResolvedValue({
      docs: [{ id: "bob@example.com", ref: { path: "campaigns/camp1/invites/bob@example.com" } }]
    });
    const commit = vi.fn(async () => {});
    firestoreSpies.writeBatch.mockReturnValue({ delete: vi.fn(), commit });

    const res = await memberService.revokeInvite({
      campaignId: "camp1",
      email: "BOB@example.com",
      currentGmId: "gm1",
      firestoreDb: {},
      realtimeDb: {}
    });

    expect(res).toEqual({ uid: "u_bob", removedInvites: 1 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(firestoreSpies.deleteDoc).not.toHaveBeenCalled();
  });
});
