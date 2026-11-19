import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const firestoreSpies = vi.hoisted(() => {
  const docs = new Map();
  return {
    docs,
    collection: vi.fn((_db, ...parts) => ({ kind: "col", path: parts.join("/") })),
    doc: vi.fn((_db, ...parts) => {
      const p = parts.join("/");
      const id = p.slice(p.lastIndexOf("/") + 1);
      return { kind: "doc", id, path: p };
    }),
    where: vi.fn((field, op, value) => ({ kind: "where", field, op, value })),
    query: vi.fn((colRef, ...constraints) => ({
      kind: "query",
      colRef,
      constraints
    })),
    onSnapshot: vi.fn(),
    getDoc: vi.fn(async (ref) => {
      const val = docs.get(ref.path) || null;
      return {
        id: ref.id,
        exists: () => val !== null,
        data: () => val
      };
    }),
    setDoc: vi.fn(async (ref, payload) => {
      docs.set(ref.path, payload);
    }),
    updateDoc: vi.fn(async (ref, payload) => {
      const cur = docs.get(ref.path) || {};
      docs.set(ref.path, { ...cur, ...payload });
    }),
    serverTimestamp: vi.fn(() => "__SERVER_TS__")
  };
});

const cacheSpies = vi.hoisted(() => ({
  getCachedMediaSync: vi.fn(() => null),
  resolveWithCache: vi.fn(async (_c, _id, fetcher) => fetcher()),
  setCachedMedia: vi.fn(async () => {})
}));

const compressionSpies = vi.hoisted(() => ({
  compressImageToWebP: vi.fn(async () => ({
    mimeType: "image/webp",
    widthPx: 320,
    heightPx: 240,
    sizeBytes: 1234,
    originalSizeBytes: 5000,
    dataUrl: "data:image/webp;base64,QUFB"
  })),
  measureDataUrlBytes: vi.fn((str) => Buffer.byteLength(str, "utf8"))
}));

vi.mock("firebase/firestore", () => firestoreSpies);
vi.mock("../../../src/infra/firebase.js", () => ({
  db: {},
  DEFAULT_CAMPAIGN_ID: "main-table"
}));
vi.mock("../../../src/infra/mediaCache.js", () => cacheSpies);
vi.mock("../../../src/infra/imageCompression.js", () => compressionSpies);
vi.mock("../../../src/services/runtimeConfigService.js", () => ({
  assertClientUpToDate: vi.fn()
}));

const visibilityService = await import("../../../src/services/visibilityService.js");
const mediaService = await import("../../../src/services/mediaService.js");
const journalService = await import("../../../src/services/journalService.js");

beforeEach(() => {
  vi.clearAllMocks();
  firestoreSpies.docs.clear();
});

describe("Fase 4 — visibilityService canônico", () => {
  it("buildPlayerVisibilityQuery combina apenas visibleTo array-contains-any e isDeleted == false, sem or()", () => {
    const colRef = { kind: "col", path: "campaigns/c1/notes" };
    const q = visibilityService.buildPlayerVisibilityQuery(colRef, "player1");

    expect(q.constraints).toEqual([
      { kind: "where", field: "visibleTo", op: "array-contains-any", value: ["ALL", "player1"] },
      { kind: "where", field: "isDeleted", op: "==", value: false }
    ]);
  });

  it("subscribeVisibleCollection propaga erro diretamente sem fallback silencioso nem console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    const unsub = vi.fn();
    firestoreSpies.onSnapshot.mockImplementation((_q, _next, errCb) => {
      errCb(new Error("permission-denied"));
      return unsub;
    });

    const retUnsub = visibilityService.subscribeVisibleCollection({
      colRef: { kind: "col", path: "campaigns/c1/scenes" },
      isRealGM: false,
      uid: "player1",
      onNext: vi.fn(),
      onError
    });

    expect(firestoreSpies.onSnapshot).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "permission-denied" }));
    expect(warnSpy).not.toHaveBeenCalled();
    retUnsub();
    expect(unsub).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("isReleasedToPlayers ignora visibleToPlayers legado e bloqueia scope gm", () => {
    expect(
      visibilityService.isReleasedToPlayers({ visibleToPlayers: true, visibleTo: ["gm1"] }, null)
    ).toBe(false);
    expect(
      visibilityService.isReleasedToPlayers({ visibleToPlayers: false, visibleTo: ["ALL"] }, null)
    ).toBe(true);
    expect(
      visibilityService.isReleasedToPlayers({ scope: "gm", visibleTo: ["ALL"] }, "gm1")
    ).toBe(false);
    expect(
      visibilityService.isReleasedToPlayers({ visibleTo: ["gm1", "player1"] }, "player1")
    ).toBe(true);
    expect(
      visibilityService.isReleasedToPlayers({ visibleTo: ["gm1"] }, null)
    ).toBe(false);
  });
});

describe("Fase 4 — mediaService v2 e grantAudience", () => {
  it("não exporta deleteMedia (T-SERV-1 removido)", () => {
    expect(mediaService.deleteMedia).toBeUndefined();
  });

  it("uploadCompressedMedia e uploadDataUrlMedia gravam byteLength e visibleTo sem sizeBytes nem isDeleted", async () => {
    const compressed = await mediaService.uploadCompressedMedia({
      file: {},
      category: "scene",
      campaignId: "camp1",
      uploadedBy: "gm1"
    });
    const storedCompressed = firestoreSpies.docs.get(`campaigns/camp1/media/${compressed.mediaId}`);
    expect(storedCompressed).toMatchObject({
      campaignId: "camp1",
      category: "scene",
      byteLength: 1234,
      uploadedBy: "gm1",
      visibleTo: ["gm1"]
    });
    expect(Object.hasOwn(storedCompressed, "sizeBytes")).toBe(false);
    expect(Object.hasOwn(storedCompressed, "isDeleted")).toBe(false);

    const dataUploaded = await mediaService.uploadDataUrlMedia({
      dataUrl: "data:image/webp;base64,AAAA",
      category: "avatar",
      campaignId: "camp1",
      uploadedBy: "u1",
      visibleTo: ["ALL"]
    });
    const storedAvatar = firestoreSpies.docs.get(`campaigns/camp1/media/${dataUploaded.mediaId}`);
    expect(storedAvatar.byteLength).toBe(27);
    expect(storedAvatar.visibleTo).toEqual(["ALL"]);
    expect(Object.hasOwn(storedAvatar, "sizeBytes")).toBe(false);
    expect(Object.hasOwn(storedAvatar, "isDeleted")).toBe(false);
  });

  it("grantMediaAudience expande visibleTo monotonicamente e evita gravação redundante", async () => {
    firestoreSpies.docs.set("campaigns/camp1/media/med_1", {
      id: "med_1",
      campaignId: "camp1",
      uploadedBy: "p1",
      visibleTo: ["p1"],
      byteLength: 100,
      dataUrl: "data:image/webp;base64,AA"
    });

    const res1 = await mediaService.grantAudience({
      campaignId: "camp1",
      mediaId: "med_1",
      visibleTo: ["p2", "ALL"]
    });
    expect(res1.updated).toBe(true);
    expect(res1.visibleTo).toEqual(["p1", "p2", "ALL"]);
    expect(firestoreSpies.updateDoc).toHaveBeenCalledTimes(1);

    firestoreSpies.updateDoc.mockClear();
    const res2 = await mediaService.grantAudience({
      campaignId: "camp1",
      mediaId: "med_1",
      visibleTo: ["p3"]
    });
    expect(res2.updated).toBe(false);
    expect(firestoreSpies.updateDoc).not.toHaveBeenCalled();
  });

  it("grantMediaAudience valida invariantes e propaga erro se expand falhar", async () => {
    firestoreSpies.docs.set("campaigns/camp1/media/med_bad", {
      id: "med_bad",
      campaignId: "camp1",
      uploadedBy: "p1",
      visibleTo: ["p1"]
    });
    firestoreSpies.updateDoc.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: ERROR_CODES.PERMISSION_DENIED })
    );

    await expect(
      mediaService.grantMediaAudience({
        campaignId: "camp1",
        mediaId: "med_bad",
        visibleTo: ["ALL"]
      })
    ).rejects.toThrow("denied");
  });
});

describe("Fase 4 — journalService simetria e media grant", () => {
  it("buildJournalPermissions e filterAccessibleJournalItems respeitam invariantes 6.3.1", () => {
    const partyPerms = journalService.buildJournalPermissions({
      scope: "party",
      targetOwnerId: "player1",
      campaignGmId: "gm1",
      currentUserId: "player1"
    });
    expect(partyPerms.visibleTo).toEqual(["ALL", "player1"]);
    expect(partyPerms.editableBy).toEqual(["ALL", "player1"]);

    const playerPerms = journalService.buildJournalPermissions({
      scope: "player",
      targetOwnerId: "player1",
      campaignGmId: "gm1",
      currentUserId: "player1"
    });
    expect(playerPerms.visibleTo).toEqual(["player1"]);
    expect(playerPerms.editableBy).toEqual(["player1"]);

    const items = [
      { id: "n_broken_party", scope: "party", ownerId: "gm1", visibleTo: ["gm1"] },
      { id: "n_gm", scope: "gm", ownerId: "player1", visibleTo: ["ALL"] },
      { id: "n_ok", scope: "player", ownerId: "p2", visibleTo: ["p2", "player1"] }
    ];
    const visibleToP1 = journalService.filterAccessibleJournalItems(items, {
      user: { uid: "player1" },
      isGM: false
    });
    expect(visibleToP1.map((x) => x.id)).toEqual(["n_ok"]);
  });

  it("share e revoke de party são simétricos e expandem mídia ANTES de publicar a nota", async () => {
    const opOrder = [];
    firestoreSpies.docs.set("campaigns/camp1/media/med_note", {
      id: "med_note",
      campaignId: "camp1",
      uploadedBy: "player1",
      visibleTo: ["player1"]
    });
    firestoreSpies.updateDoc.mockImplementation(async (ref, payload) => {
      opOrder.push({ path: ref.path, payload });
      const cur = firestoreSpies.docs.get(ref.path) || {};
      firestoreSpies.docs.set(ref.path, { ...cur, ...payload });
    });

    const notePlayer = {
      id: "n_priv",
      ownerId: "player1",
      scope: "player",
      visibleTo: ["player1"],
      editableBy: ["player1"],
      imageMediaId: "med_note"
    };

    // Share para party -> expande mídia primeiro, depois promove scope/visibleTo/editableBy
    await journalService.shareJournalNoteWithTarget({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      user: { uid: "player1" },
      isGM: false,
      note: notePlayer,
      noteId: "n_priv",
      target: "party"
    });

    expect(opOrder).toHaveLength(2);
    expect(opOrder[0].path).toBe("campaigns/camp1/media/med_note");
    expect(opOrder[0].payload.visibleTo).toEqual(["player1", "ALL"]);
    expect(opOrder[1].path).toBe("campaigns/camp1/notes/n_priv");
    expect(opOrder[1].payload.scope).toBe("party");
    expect(opOrder[1].payload.visibleTo).toEqual(["ALL", "player1"]);
    expect(opOrder[1].payload.editableBy).toEqual(["ALL", "player1"]);

    // Revoke de party -> volta para scope "player", remove "ALL" de visibleTo E editableBy mantendo dono
    opOrder.length = 0;
    await journalService.revokeJournalNoteAccess({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      user: { uid: "player1" },
      isGM: false,
      isRealGM: false,
      note: {
        id: "n_priv",
        ownerId: "player1",
        scope: "party",
        visibleTo: ["ALL", "player1", "player2"],
        editableBy: ["ALL", "player1"]
      },
      noteId: "n_priv",
      target: "party"
    });

    expect(opOrder).toHaveLength(1);
    expect(opOrder[0].payload.scope).toBe("player");
    expect(opOrder[0].payload.visibleTo).toEqual(["player1", "player2"]);
    expect(opOrder[0].payload.editableBy).toEqual(["player1"]);
  });

  it("editor não-dono não consegue compartilhar nota com outro jogador", async () => {
    await journalService.shareJournalNoteWithTarget({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      user: { uid: "editor2" },
      isGM: false,
      note: {
        id: "n_shared",
        ownerId: "player1",
        scope: "player",
        visibleTo: ["player1", "editor2"],
        editableBy: ["player1", "editor2"]
      },
      noteId: "n_shared",
      target: "player3"
    });

    expect(firestoreSpies.updateDoc).not.toHaveBeenCalled();
  });
});
