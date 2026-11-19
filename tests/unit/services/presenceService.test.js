import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENCE_KINDS } from "../../../src/domain/constants.js";

const rtdbSpies = vi.hoisted(() => ({
  onDisconnect: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn((_db, p) => ({ path: p })),
  remove: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => ({ ".sv": "timestamp" })),
  set: vi.fn(async () => {})
}));

vi.mock("firebase/database", () => rtdbSpies);
vi.mock("../../../src/infra/firebase.js", () => ({ rtdb: {} }));

const presenceService = await import("../../../src/services/presenceService.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("presenceService", () => {
  it("reconecta ao voltar .info/connected (true -> false -> true) e evita remoção indevida antes de escrever", async () => {
    let infoCallback;
    const infoUnsub = vi.fn();
    rtdbSpies.onValue.mockImplementation((_ref, cb) => {
      infoCallback = cb;
      return infoUnsub;
    });
    const cancelSpy = vi.fn(async () => {});
    const removeOnDisconnectSpy = vi.fn(async () => {});
    rtdbSpies.onDisconnect.mockReturnValue({
      remove: removeOnDisconnectSpy,
      cancel: cancelSpy
    });

    // 1) Montagem + desmontagem rápida (StrictMode) antes de gravar: não chama rtdbRemove
    const stopEarly = presenceService.connectPresence({
      campaignId: "c1",
      uid: "u1",
      connId: "conn_strict",
      kind: PRESENCE_KINDS.MAIN,
      realtimeDb: {}
    });
    stopEarly();
    expect(rtdbSpies.remove).not.toHaveBeenCalled();

    // 2) Ciclo normal: conecta -> cai -> reconecta -> disconnectAllActivePresence
    const changes = [];
    presenceService.connectPresence({
      campaignId: "c1",
      uid: "u1",
      connId: "conn_live",
      kind: PRESENCE_KINDS.SHEET,
      sheetId: "char_1",
      realtimeDb: {},
      onConnectionChange: (v) => changes.push(v)
    });

    await infoCallback({ val: () => true });
    expect(removeOnDisconnectSpy).toHaveBeenCalledTimes(1);
    expect(rtdbSpies.set).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([true]);

    await infoCallback({ val: () => false });
    expect(changes).toEqual([true, false]);

    await infoCallback({ val: () => true });
    expect(rtdbSpies.set).toHaveBeenCalledTimes(2);
    expect(changes).toEqual([true, false, true]);

    await presenceService.disconnectAllActivePresence();
    expect(infoUnsub).toHaveBeenCalled();
    expect(rtdbSpies.remove).toHaveBeenCalledWith({
      path: "vtt_realtime/c1/presence/u1/conn_live"
    });

    // Evento tardio após disconnectAllActivePresence não regrava presença
    await infoCallback({ val: () => true });
    expect(rtdbSpies.set).toHaveBeenCalledTimes(2);
  });

  it("buildOnlineUsersMap e hasSheetConnectionOpen derivam estado correto a partir das conexões", () => {
    const presenceByUid = {
      u1: {
        conn_a: { kind: PRESENCE_KINDS.MAIN, sheetId: null, connectedAt: 10 },
        conn_b: { kind: PRESENCE_KINDS.SHEET, sheetId: "char_9", connectedAt: 11 }
      },
      u_empty: {}
    };
    const playersMap = {
      u1: { uid: "u1", displayName: "P1", photoURL: null, avatarMediaId: null },
      u_empty: { uid: "u_empty", displayName: "P2" }
    };

    const online = presenceService.buildOnlineUsersMap({ presenceByUid, playersMap });
    expect(Object.keys(online)).toEqual(["u1"]);
    expect(online.u1.online).toBe(true);
    expect(presenceService.hasSheetConnectionOpen(presenceByUid, "u1", "char_9")).toBe(true);
    expect(presenceService.hasSheetConnectionOpen(presenceByUid, "u1", "char_other")).toBe(false);
  });
});
