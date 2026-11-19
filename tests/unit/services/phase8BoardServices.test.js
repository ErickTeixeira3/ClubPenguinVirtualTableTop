import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../../support/fakeFirebase.js";

const grantMediaAudienceMock = vi.fn(async () => ({ updated: true }));
const uploadCompressedMediaMock = vi.fn(async () => ({ mediaId: "med_tok_up" }));

vi.mock("firebase/firestore", async () => (await import("../../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../../support/fakeFirebase.js")).databaseModule);
vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);
vi.mock("../../../src/services/mediaService.js", () => ({
  grantMediaAudience: grantMediaAudienceMock,
  uploadCompressedMedia: uploadCompressedMediaMock
}));

const {
  CHARACTER_TYPES,
  LAYER_NAMES,
  MIN_FOG_AREA_PX,
  PING_KINDS,
  PING_LIFETIME_MS,
  TOKEN_KINDS,
  TOKEN_MOVE_THROTTLE_MS
} = await import("../../../src/domain/constants.js");
const rtdbModule = await import("firebase/database");
const { ERROR_CODES } = await import("../../../src/domain/errors.js");
const {
  buildPcProjectionFromCharacter,
  resolveCharacterTokenImage
} = await import("../../../src/domain/models/token.js");
const { canUserWriteTokenProjection } = await import("../../../src/domain/permissions.js");
const {
  createFrozenTurnPolicy,
  createPermissiveTurnPolicy
} = await import("../../../src/engines/turn/index.js");
const tokenService = await import("../../../src/services/tokenService.js");
const drawingService = await import("../../../src/services/drawingService.js");
const pingService = await import("../../../src/services/pingService.js");
const fogService = await import("../../../src/services/fogService.js");

beforeEach(() => {
  resetFakeDb();
  grantMediaAudienceMock.mockClear();
  uploadCompressedMediaMock.mockClear();
});

describe("Fase 8 — Domain helpers & TurnPolicy", () => {
  it("resolveCharacterTokenImage e buildPcProjectionFromCharacter priorizam tokenImage e preservam rev", () => {
    expect(resolveCharacterTokenImage(null)).toEqual({ mediaId: null, url: null });
    expect(
      resolveCharacterTokenImage({
        tokenImage: { mediaId: "m_tok", url: null },
        avatar: { mediaId: "m_av", url: null }
      })
    ).toEqual({ mediaId: "m_tok", url: null });
    expect(
      resolveCharacterTokenImage({
        tokenImage: { mediaId: null, url: null },
        avatar: { mediaId: null, url: "https://example.com/a.png" }
      })
    ).toEqual({ mediaId: null, url: "https://example.com/a.png" });

    expect(buildPcProjectionFromCharacter(null)).toBeNull();
    const proj = buildPcProjectionFromCharacter({
      name: "Pinguim",
      rev: 7,
      resources: { hp: { current: 18, max: 25 }, mp: { current: 5, max: 10 } },
      avatar: { mediaId: "m_av", url: null }
    });
    expect(proj).toEqual({
      label: "Pinguim",
      image: { mediaId: "m_av", url: null },
      bars: { hpCurrent: 18, hpMax: 25, mpCurrent: 5, mpMax: 10 },
      ringColor: "#3090f0",
      showName: true,
      sizeInCells: 1,
      rev: 7
    });

    const noBarsProj = buildPcProjectionFromCharacter({ name: "Sem Barras", rev: -1 });
    expect(noBarsProj.bars).toBeNull();
    expect(noBarsProj.rev).toBe(0);
  });

  it("canUserWriteTokenProjection bloqueia hiddenBucket para não-GM e permite GM/controlador", () => {
    const pubTok = { id: "t1", ownerId: "p1", controlledBy: { p2: true }, hidden: false };
    expect(canUserWriteTokenProjection(null, { uid: "gm1", isGM: true })).toBe(false);
    expect(canUserWriteTokenProjection(pubTok, { uid: "", isGM: true })).toBe(false);
    expect(canUserWriteTokenProjection(pubTok, { uid: "gm1", isGM: true, inHiddenBucket: true })).toBe(true);
    expect(canUserWriteTokenProjection(pubTok, { uid: "p1", isGM: false, inHiddenBucket: true })).toBe(false);
    expect(canUserWriteTokenProjection({ ...pubTok, hidden: true }, { uid: "p1", isGM: false })).toBe(false);
    expect(canUserWriteTokenProjection(pubTok, { uid: "p2", isGM: false })).toBe(true);
    expect(canUserWriteTokenProjection(pubTok, { uid: "p3", isGM: false })).toBe(false);
  });

  it("createFrozenTurnPolicy e createPermissiveTurnPolicy expõem a interface congelada (U1)", () => {
    const onMove = vi.fn();
    const onAct = vi.fn();
    const combatState = {
      active: true,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true,
      turnOrder: [
        { combatantId: "a", tokenId: "a", name: "A", movementBudgetMeters: 9, movementUsedMeters: 0, actionsMax: 1, actionsRemaining: 1 },
        { combatantId: "b", tokenId: "b", name: "B", movementBudgetMeters: 9, movementUsedMeters: 0, actionsMax: 1, actionsRemaining: 1 }
      ]
    };

    const frozen = createFrozenTurnPolicy({
      combatState,
      isGM: false,
      onConsumeMovement: onMove,
      onConsumeAction: onAct
    });
    expect(frozen.isActive).toBe(true);
    expect(frozen.isActorTurn("a")).toBe(true);
    expect(frozen.isActorTurn("b")).toBe(false);
    expect(frozen.findCombatant("a")?.combatantId).toBe("a");
    expect(frozen.canActorMove("a", 3).allowed).toBe(true);
    expect(frozen.canActorMove("b", 3).allowed).toBe(false);
    expect(frozen.canActorAct("a", "active").allowed).toBe(true);
    expect(frozen.canActorAct("b", "active").allowed).toBe(false);
    frozen.consumeMovement("a", 3);
    frozen.consumeMovement("a", 0);
    frozen.consumeAction("a", "active");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onAct).toHaveBeenCalledTimes(1);

    const perm = createPermissiveTurnPolicy();
    expect(perm.isActive).toBe(false);
    expect(perm.canActorMove("b", 99).allowed).toBe(true);
    expect(perm.canActorAct("b", "active").allowed).toBe(true);
    expect(perm.isActorTurn("b")).toBe(true);
    expect(perm.findCombatant("b")).toBeNull();
    expect(perm.consumeMovement("b", 3)).toBeNull();
    expect(perm.consumeAction("b", "active")).toBeNull();
  });
});

describe("Fase 8 — tokenService (v2, split tokens/hiddenTokens/tokenSecrets, projeção e névoa)", () => {
  it("spawnCharacterToken cria PC sem tokenSecrets e NPC com tokenSecrets atômico (e respeita névoa)", async () => {
    const pcResult = await tokenService.spawnCharacterToken({
      campaignId: "camp1",
      campaign: { gmId: "gm1", activeSceneId: "sc1" },
      scene: { id: "sc1", grid: { cellSizePx: 64 }, mapImage: { widthPx: 640, heightPx: 640 } },
      char: {
        id: "pc1",
        type: "pc",
        name: "Agente",
        ownerId: "p1",
        rev: 4,
        resources: { hp: { current: 18, max: 20 }, mp: { current: 8, max: 10 } }
      },
      user: { uid: "p1" },
      isGM: false,
      canEditCharacter: () => true
    });
    expect(pcResult.kind).toBe(TOKEN_KINDS.PC);
    expect(pcResult.secrets).toBeNull();
    expect(pcResult.rev).toBe(4);
    expect(fakeDb.writes.filter((w) => w.store === "rtdb")).toHaveLength(1);
    expect(fakeDb.writes[0].path).toContain("/tokens/sc1/");

    resetFakeDb();
    const npcResult = await tokenService.spawnCharacterToken({
      campaignId: "camp1",
      campaign: { gmId: "gm1", activeSceneId: "sc1" },
      scene: { id: "sc1", grid: { cellSizePx: 64 }, mapImage: { widthPx: 640, heightPx: 640 } },
      char: {
        id: "npc1",
        type: "npc",
        name: "Chefe",
        ownerId: "gm1",
        defense: 15,
        resources: { hp: { current: 40, max: 40 }, mp: { current: 10, max: 10 } }
      },
      user: { uid: "gm1" },
      isGM: true,
      fog: { enabled: true, areas: {} }
    });
    expect(npcResult.kind).toBe(TOKEN_KINDS.NPC);
    expect(npcResult.secrets.defense).toBe(15);
    const rtdbWrite = fakeDb.writes.find((w) => w.store === "rtdb" && w.op === "update");
    expect(rtdbWrite.path).toBe("vtt_realtime/camp1");
    const writtenKeys = Object.keys(rtdbWrite.payload);
    // NPC sob névoa nasce direto em hiddenTokens + tokenSecrets na mesma atualização
    expect(writtenKeys.some((k) => k.startsWith("hiddenTokens/sc1/"))).toBe(true);
    expect(writtenKeys.some((k) => k.startsWith("tokenSecrets/sc1/"))).toBe(true);
  });

  it("createFreeToken e removeToken operam atomicamente sobre token + tokenSecrets", async () => {
    const created = await tokenService.createFreeToken({
      campaignId: "camp1",
      sceneId: "sc1",
      user: { uid: "p1" },
      isGM: false,
      data: { label: "Barril", defense: 8, hp: { current: 10, max: 10 } }
    });
    expect(created.token.kind).toBe(TOKEN_KINDS.FREE);
    const createWrite = fakeDb.writes.find((w) => w.store === "rtdb" && w.op === "update");
    expect(Object.keys(createWrite.payload).sort()).toEqual([
      `tokenSecrets/sc1/${created.token.id}`,
      `tokens/sc1/${created.token.id}`
    ]);

    resetFakeDb();
    await tokenService.removeToken({
      campaignId: "camp1",
      sceneId: "sc1",
      token: created.token
    });
    const delWrite = fakeDb.writes.find((w) => w.store === "rtdb" && w.op === "update");
    expect(delWrite.payload).toEqual({
      [`tokens/sc1/${created.token.id}`]: null,
      [`tokenSecrets/sc1/${created.token.id}`]: null
    });
  });

  it("adjustTokenResource rejeita PC e aplica transação em tokenSecrets + projeção de bars em NPC", async () => {
    await expect(
      tokenService.adjustTokenResource({
        campaignId: "camp1",
        sceneId: "sc1",
        token: { id: "tok_pc", kind: TOKEN_KINDS.PC, rev: 1 },
        resourceKey: "hp",
        delta: -5,
        user: { uid: "gm1" }
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });

    fakeDb.rtdb["vtt_realtime/camp1/tokenSecrets/sc1/tok_npc"] = {
      defense: 12,
      hp: { current: 20, max: 20 },
      mp: { current: 10, max: 10 },
      showBarsToPlayers: true,
      recentOps: {}
    };

    const res = await tokenService.adjustTokenResource({
      campaignId: "camp1",
      sceneId: "sc1",
      token: { id: "tok_npc", kind: TOKEN_KINDS.NPC, rev: 1 },
      resourceKey: "hp",
      delta: -6,
      opId: "op_dmg_1",
      user: { uid: "gm1" }
    });
    expect(res.value).toBe(14);
    expect(res.bars).toEqual({ hpCurrent: 14, hpMax: 20, mpCurrent: 10, mpMax: 10 });
    const barUpdate = fakeDb.writes.find((w) => w.op === "update" && w.path.endsWith("/tok_npc"));
    expect(barUpdate.payload.bars).toEqual({ hpCurrent: 14, hpMax: 20, mpCurrent: 10, mpMax: 10 });
    expect(barUpdate.payload.rev).toBe(2);
  });

  it("reconcileSceneFogPartition move NPC coberto para hiddenTokens e nunca revela token hidden===true", async () => {
    const publicNpcCovered = {
      id: "npc_covered",
      kind: TOKEN_KINDS.NPC,
      characterId: "c1",
      ownerId: "gm1",
      controlledBy: { gm1: true },
      layer: LAYER_NAMES.TOKENS,
      hidden: false,
      label: "Goblin",
      image: { mediaId: null, url: null },
      x: 500,
      y: 500,
      sizeInCells: 1,
      rotation: 0,
      ringColor: "#3090f0",
      showName: true,
      bars: null,
      rev: 0
    };
    const manuallyHiddenInRevealedArea = {
      ...publicNpcCovered,
      id: "npc_manual_hidden",
      hidden: true,
      x: 10,
      y: 10
    };
    const fogHiddenNowRevealed = {
      ...publicNpcCovered,
      id: "npc_revealed",
      hidden: false,
      image: { mediaId: "med_rev", url: null },
      x: 10,
      y: 10
    };

    const res = await tokenService.reconcileSceneFogPartition({
      campaignId: "camp1",
      sceneId: "sc1",
      publicTokens: [publicNpcCovered],
      hiddenTokens: [manuallyHiddenInRevealedArea, fogHiddenNowRevealed],
      fog: {
        enabled: true,
        areas: {
          a1: { id: "a1", op: "reveal", x: 0, y: 0, w: 200, h: 200, createdAt: 1 }
        }
      },
      cellSizePx: 64,
      gmId: "gm1",
      user: { uid: "gm1" },
      isGM: true
    });

    expect(res.movedCount).toBe(2);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_rev",
      visibleTo: ["ALL"]
    });
    const updateWrite = fakeDb.writes.find((w) => w.op === "update" && w.path === "vtt_realtime/camp1");
    expect(updateWrite.payload["tokens/sc1/npc_covered"]).toBeNull();
    expect(updateWrite.payload["hiddenTokens/sc1/npc_covered"]).toBeTruthy();
    expect(updateWrite.payload["hiddenTokens/sc1/npc_revealed"]).toBeNull();
    expect(updateWrite.payload["tokens/sc1/npc_revealed"]).toBeTruthy();
    // Token ocultado manualmente nunca é movido para tokens/
    expect(updateWrite.payload["tokens/sc1/npc_manual_hidden"]).toBeUndefined();
  });
});

describe("Fase 8 — drawingService (INT-19 multi-caminho), pingService (onDisconnect) e fogService", () => {
  it("moveDrawings e rotateDrawings enviam UMA única atualização multi-caminho para N itens (INT-19)", async () => {
    const items = [
      { id: "drw_1", type: "stroke", points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] },
      { id: "shp_1", type: "rect", x: 100, y: 100, w: 40, h: 20, rotation: 0 },
      { id: "txt_1", type: "text", x: 50, y: 50, rotation: 0 }
    ];

    await drawingService.moveDrawings({
      campaignId: "camp1",
      sceneId: "sc1",
      drawings: items,
      dx: 15,
      dy: -10,
      user: { uid: "p1" }
    });
    const moveWrites = fakeDb.writes.filter((w) => w.store === "rtdb" && w.op === "update");
    expect(moveWrites).toHaveLength(1);
    expect(moveWrites[0].path).toBe("vtt_realtime/camp1/drawings/sc1");
    expect(moveWrites[0].payload["drw_1/points"]).toEqual([{ x: 25, y: 10 }, { x: 45, y: 30 }]);
    expect(moveWrites[0].payload["shp_1/x"]).toBe(115);
    expect(moveWrites[0].payload["txt_1/y"]).toBe(40);

    resetFakeDb();
    await drawingService.rotateDrawings({
      campaignId: "camp1",
      sceneId: "sc1",
      drawings: items,
      deltaAngleDeg: 90,
      pivot: { x: 0, y: 0 },
      user: { uid: "p1" }
    });
    const rotWrites = fakeDb.writes.filter((w) => w.store === "rtdb" && w.op === "update");
    expect(rotWrites).toHaveLength(1);
    expect(rotWrites[0].payload["shp_1/rotation"]).toBe(90);
    expect(rotWrites[0].payload["txt_1/rotation"]).toBe(90);
    // (10, 20) rotacionado 90° em torno de (0,0) -> (-20, 10)
    expect(rotWrites[0].payload["drw_1/points"][0]).toEqual({ x: -20, y: 10 });
  });

  it("pingService usa serverTimestamp, registra onDisconnect().remove() e limpa expirados", async () => {
    const created = await pingService.sendPing({
      campaignId: "camp1",
      sceneId: "sc1",
      x: 120,
      y: 240,
      kind: PING_KINDS.SNOWBALL,
      from: { x: 10, y: 20 },
      color: "#00f0ff",
      user: { uid: "p1" }
    });
    expect(created.kind).toBe(PING_KINDS.SNOWBALL);
    expect(created.from).toEqual({ x: 10, y: 20 });

    const onDisc = fakeDb.writes.find((w) => w.op === "onDisconnectRemove");
    const setOp = fakeDb.writes.find((w) => w.op === "set");
    expect(onDisc.path).toBe(setOp.path);
    expect(setOp.payload.createdAt).toEqual({ ".sv": "timestamp" });
    expect(setOp.payload).not.toHaveProperty("expiresAt");

    resetFakeDb();
    const cleaned = await pingService.cleanupExpiredPings({
      campaignId: "camp1",
      sceneId: "sc1",
      pings: [
        { id: "p_old", createdAt: 1000 },
        { id: "p_fresh", createdAt: 5000 }
      ],
      serverNowMs: 1000 + PING_LIFETIME_MS + 100
    });
    expect(cleaned).toBe(1);
    expect(fakeDb.writes.filter((w) => w.op === "remove").map((w) => w.path)).toEqual([
      "vtt_realtime/camp1/pings/sc1/p_old"
    ]);
  });

  it("fogService respeita MIN_FOG_AREA_PX e exige isGM", async () => {
    await expect(
      fogService.setFogEnabled({ campaignId: "camp1", sceneId: "sc1", enabled: true, isGM: false })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    const tooSmall = await fogService.addFogArea({
      campaignId: "camp1",
      sceneId: "sc1",
      rect: { x: 0, y: 0, w: MIN_FOG_AREA_PX - 1, h: 20 },
      op: "reveal",
      isGM: true
    });
    expect(tooSmall).toBeNull();
    expect(fakeDb.writes).toHaveLength(0);

    const added = await fogService.addFogArea({
      campaignId: "camp1",
      sceneId: "sc1",
      rect: { x: 10, y: 20, w: 100, h: 80 },
      op: "reveal",
      isGM: true
    });
    expect(added.op).toBe("reveal");
    expect(fakeDb.writes[0].payload.enabled).toBe(true);
  });

  it("moveToken aplica throttle por token, suporta forceImmediate, arredonda x/y e reseta com resetMoveTokenThrottle", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(10_000);
      tokenService.resetMoveTokenThrottle();

      const first = await tokenService.moveToken({
        campaignId: "camp1",
        sceneId: "sc1",
        tokenId: "tok_a",
        x: 12.6,
        y: 34.4,
        forceImmediate: false,
        user: { uid: "p1" }
      });
      expect(first).toBe(true);
      expect(fakeDb.writes).toHaveLength(1);
      expect(fakeDb.writes[0].payload).toMatchObject({ x: 13, y: 34 });

      // Chamada dentro da janela (< TOKEN_MOVE_THROTTLE_MS) com forceImmediate: false é ignorada
      vi.advanceTimersByTime(Math.max(1, TOKEN_MOVE_THROTTLE_MS - 10));
      const throttled = await tokenService.moveToken({
        campaignId: "camp1",
        sceneId: "sc1",
        tokenId: "tok_a",
        x: 50.2,
        y: 60.8,
        forceImmediate: false,
        user: { uid: "p1" }
      });
      expect(throttled).toBe(false);
      expect(fakeDb.writes).toHaveLength(1);

      // Outro token tem throttle independente
      const otherTok = await tokenService.moveToken({
        campaignId: "camp1",
        sceneId: "sc1",
        tokenId: "tok_b",
        x: 70.1,
        y: 80.9,
        forceImmediate: false,
        user: { uid: "p1" }
      });
      expect(otherTok).toBe(true);
      expect(fakeDb.writes).toHaveLength(2);

      // forceImmediate: true fura o throttle imediatamente
      const forced = await tokenService.moveToken({
        campaignId: "camp1",
        sceneId: "sc1",
        tokenId: "tok_a",
        x: 99.6,
        y: 100.2,
        forceImmediate: true,
        user: { uid: "p1" }
      });
      expect(forced).toBe(true);
      expect(fakeDb.writes).toHaveLength(3);
      expect(fakeDb.writes[2].payload).toMatchObject({ x: 100, y: 100 });

      // resetMoveTokenThrottle limpa histórico
      tokenService.resetMoveTokenThrottle();
      const afterReset = await tokenService.moveToken({
        campaignId: "camp1",
        sceneId: "sc1",
        tokenId: "tok_a",
        x: 120.4,
        y: 130.6,
        forceImmediate: false,
        user: { uid: "p1" }
      });
      expect(afterReset).toBe(true);
      expect(fakeDb.writes).toHaveLength(4);
    } finally {
      tokenService.resetMoveTokenThrottle();
      vi.useRealTimers();
    }
  });

  it("adjustTokenResource faz retry limitado (3 tentativas) em PERMISSION_DENIED e sinaliza projectionDeferred quando esgota", async () => {
    fakeDb.rtdb["vtt_realtime/camp1/tokens/sc1/tok_npc"] = {
      id: "tok_npc",
      kind: TOKEN_KINDS.NPC,
      rev: 1
    };
    fakeDb.rtdb["vtt_realtime/camp1/tokenSecrets/sc1/tok_npc"] = {
      defense: 12,
      hp: { current: 20, max: 20 },
      mp: { current: 10, max: 10 },
      showBarsToPlayers: true,
      recentOps: {}
    };

    const origUpdate = rtdbModule.update;
    let attemptCount = 0;
    const updateSpy = vi.spyOn(rtdbModule, "update").mockImplementation(async (ref, payload) => {
      attemptCount += 1;
      if (attemptCount === 1) {
        const err = new Error("PERMISSION_DENIED");
        err.code = "PERMISSION_DENIED";
        throw err;
      }
      return origUpdate(ref, payload);
    });

    try {
      const okRetry = await tokenService.adjustTokenResource({
        campaignId: "camp1",
        sceneId: "sc1",
        token: { id: "tok_npc", kind: TOKEN_KINDS.NPC, rev: 1 },
        resourceKey: "hp",
        delta: -4,
        opId: "op_retry_ok",
        user: { uid: "gm1" }
      });
      expect(attemptCount).toBe(2);
      expect(okRetry.projectionDeferred).toBeUndefined();
      expect(okRetry.bars.hpCurrent).toBe(16);

      attemptCount = 0;
      updateSpy.mockImplementation(async () => {
        attemptCount += 1;
        const err = new Error("PERMISSION_DENIED");
        err.code = "PERMISSION_DENIED";
        throw err;
      });

      const deferredRes = await tokenService.adjustTokenResource({
        campaignId: "camp1",
        sceneId: "sc1",
        token: { id: "tok_npc", kind: TOKEN_KINDS.NPC, rev: 2 },
        resourceKey: "hp",
        delta: -2,
        opId: "op_retry_fail",
        user: { uid: "gm1" }
      });
      expect(attemptCount).toBe(3);
      expect(deferredRes.projectionDeferred).toBe(true);
      expect(deferredRes.bars.hpCurrent).toBe(14);
    } finally {
      updateSpy.mockRestore();
    }
  });

  it("tokens ocultos não vazam grantMediaAudience e updateTokenAdmin preserva rev de PC", async () => {
    await tokenService.spawnCharacterToken({
      campaignId: "camp1",
      campaign: { gmId: "gm1", activeSceneId: "sc1" },
      scene: { id: "sc1" },
      char: {
        id: "npc_hid",
        name: "Assassino",
        type: CHARACTER_TYPES.NPC,
        ownerId: "gm1",
        token: { image: { mediaId: "med_hid_npc", url: null } }
      },
      spawnOptions: { hidden: true },
      user: { uid: "gm1" },
      isGM: true
    });
    await tokenService.createFreeToken({
      campaignId: "camp1",
      sceneId: "sc1",
      campaign: { gmId: "gm1" },
      data: {
        label: "Armadilha",
        hidden: true,
        image: { mediaId: "med_hid_free", url: null }
      },
      user: { uid: "gm1" },
      isGM: true
    });
    expect(grantMediaAudienceMock).not.toHaveBeenCalled();

    const pcTok = {
      id: "tok_pc_adm",
      kind: TOKEN_KINDS.PC,
      characterId: "pc1",
      ownerId: "p1",
      controlledBy: { p1: true },
      layer: LAYER_NAMES.TOKENS,
      hidden: false,
      label: "Herói",
      image: { mediaId: "med_pc1", url: null },
      x: 0,
      y: 0,
      sizeInCells: 1,
      rotation: 0,
      ringColor: "#3090f0",
      showName: true,
      bars: null,
      rev: 5
    };
    fakeDb.rtdb["vtt_realtime/camp1/tokens/sc1/tok_pc_adm"] = pcTok;

    const updatedHidden = await tokenService.updateTokenAdmin({
      campaignId: "camp1",
      sceneId: "sc1",
      token: pcTok,
      patch: { hidden: true, layer: LAYER_NAMES.MAP },
      user: { uid: "gm1" },
      isGM: true
    });
    expect(updatedHidden.token.rev).toBe(5);
    expect(grantMediaAudienceMock).not.toHaveBeenCalled();

    fakeDb.rtdb["vtt_realtime/camp1/hiddenTokens/sc1/tok_pc_adm"] = updatedHidden.token;
    const revealed = await tokenService.updateTokenAdmin({
      campaignId: "camp1",
      sceneId: "sc1",
      token: updatedHidden.token,
      inHiddenBucket: true,
      patch: { hidden: false },
      user: { uid: "gm1" },
      isGM: true
    });
    expect(revealed.token.rev).toBe(5);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_pc1",
      visibleTo: ["ALL"]
    });
  });

  it("projectCharacterToSceneTokens projeta ringColor, showName, sizeInCells e token.image em tokens públicos e ocultos", async () => {
    const pubPc = {
      id: "tok_pc_pub",
      kind: TOKEN_KINDS.PC,
      characterId: "pc1",
      ownerId: "p1",
      controlledBy: { p1: true },
      hidden: false,
      rev: 1
    };
    const hidPc = {
      id: "tok_pc_hid",
      kind: TOKEN_KINDS.PC,
      characterId: "pc1",
      ownerId: "p1",
      controlledBy: { p1: true },
      hidden: true,
      rev: 1
    };

    const res = await tokenService.projectCharacterToSceneTokens({
      campaignId: "camp1",
      sceneId: "sc1",
      character: {
        id: "pc1",
        type: CHARACTER_TYPES.PC,
        name: "Cavaleiro",
        cardColor: "#ef4444",
        rev: 3,
        resources: { hp: { current: 15, max: 20 } },
        token: {
          image: { mediaId: "med_tok_nested", url: null },
          showName: false,
          sizeInCells: 2
        }
      },
      publicTokens: [pubPc],
      hiddenTokens: [hidPc],
      user: { uid: "gm1" },
      isGM: true
    });

    expect(res.updatedCount).toBe(2);
    const rtdbWrites = fakeDb.writes.filter((w) => w.store === "rtdb" && w.op === "update");
    expect(rtdbWrites).toHaveLength(2);
    const pubWrite = rtdbWrites.find((w) => w.path.endsWith("/tokens/sc1/tok_pc_pub"));
    const hidWrite = rtdbWrites.find((w) => w.path.endsWith("/hiddenTokens/sc1/tok_pc_hid"));
    expect(pubWrite?.payload).toMatchObject({
      label: "Cavaleiro",
      image: { mediaId: "med_tok_nested" },
      ringColor: "#ef4444",
      showName: false,
      sizeInCells: 2,
      rev: 3
    });
    expect(hidWrite?.payload).toMatchObject({
      label: "Cavaleiro",
      image: { mediaId: "med_tok_nested" },
      ringColor: "#ef4444",
      showName: false,
      sizeInCells: 2,
      rev: 3
    });
  });
});
