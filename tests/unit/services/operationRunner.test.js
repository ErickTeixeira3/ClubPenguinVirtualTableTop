import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGE_STATUS, RECENT_OPS_LIMIT } from "../../../src/domain/constants.js";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const mockStore = new Map();
const firestoreQueries = [];

vi.mock("firebase/firestore", () => ({
  collection: (_db, ...parts) => ({ kind: "col", path: parts.join("/") }),
  doc: (_db, ...parts) => {
    const path = parts.join("/");
    return { kind: "doc", id: parts[parts.length - 1], path };
  },
  where: (field, op, value) => ({ __type: "where", field, op, value }),
  query: (colRef, ...constraints) => {
    const q = { colRef, constraints };
    firestoreQueries.push(q);
    return q;
  },
  serverTimestamp: () => "__SERVER_TIMESTAMP__",
  setDoc: async (ref, payload) => {
    mockStore.set(ref.path, structuredClone(payload));
  },
  updateDoc: async (ref, payload) => {
    const prev = mockStore.get(ref.path) || {};
    mockStore.set(ref.path, { ...prev, ...structuredClone(payload) });
  },
  getDocs: async (q) => {
    const docs = [];
    for (const [docPath, data] of mockStore.entries()) {
      if (!docPath.startsWith(`${q.colRef.path}/`)) continue;
      const id = docPath.slice(q.colRef.path.length + 1);
      const matches = q.constraints.every((c) => {
        if (c.field === "status" && c.op === "==") return data.status === c.value;
        if (c.field === "sender.uid" && c.op === "==") return data.sender?.uid === c.value;
        if (c.field === "visibleTo" && c.op === "array-contains-any") {
          return Array.isArray(data.visibleTo) && c.value.some((v) => data.visibleTo.includes(v));
        }
        return true;
      });
      if (matches) {
        docs.push({
          id,
          data: () => data,
          ref: {
            id,
            parent: {
              id: "messages",
              parent: { id: data.campaignId, parent: { id: "campaigns" } }
            }
          }
        });
      }
    }
    return { docs };
  }
}));
vi.mock("../../../src/infra/firebase.js", () => ({ db: {}, DEFAULT_CAMPAIGN_ID: "main-table" }));

const {
  buildPendingOperationsQuery,
  pruneRecentOps,
  recoverPendingOperations,
  runSagaOperation
} = await import("../../../src/services/operationRunner.js");

beforeEach(() => {
  mockStore.clear();
  firestoreQueries.length = 0;
});

const validRoll = {
  kind: "check",
  title: "Teste",
  icon: null,
  color: "#02529c",
  rolls: [],
  costs: [],
  targets: [],
  hitEvaluation: { status: "none", results: [] },
  savingThrowRequest: null,
  respondsTo: null,
  secondary: null,
  allyCostOps: [],
  appliedEffects: {}
};

describe("pruneRecentOps", () => {
  it("detecta operação duplicada sem modificar e poda acima de RECENT_OPS_LIMIT (50)", () => {
    const existing = {};
    for (let i = 1; i <= RECENT_OPS_LIMIT; i += 1) {
      existing[`op_${i}`] = 1000 + i;
    }

    const dup = pruneRecentOps(existing, "op_25", 9999);
    expect(dup.alreadyApplied).toBe(true);
    expect(Object.keys(dup.recentOps)).toHaveLength(RECENT_OPS_LIMIT);

    const added = pruneRecentOps(existing, "op_51", 5000);
    expect(added.alreadyApplied).toBe(false);
    expect(Object.keys(added.recentOps)).toHaveLength(RECENT_OPS_LIMIT);
    expect(added.recentOps.op_1).toBeUndefined();
    expect(added.recentOps.op_2).toBe(1002);
    expect(added.recentOps.op_51).toBe(5000);
  });

  it("rejeita opId inválido ou chave insegura", () => {
    for (const badOp of ["", " ", "__proto__", "constructor", null]) {
      expect(() => pruneRecentOps({}, badOp, 1000)).toThrowError();
    }
  });
});

describe("operationRunner — sagas e recuperação", () => {
  it("inclui where('visibleTo','array-contains-any',['ALL', uid]) para não-GM", () => {
    const playerQ = buildPendingOperationsQuery({
      firestoreDb: {},
      campaignId: "camp_1",
      uid: "player1",
      isGM: false
    });
    expect(playerQ.constraints).toEqual([
      { __type: "where", field: "status", op: "==", value: MESSAGE_STATUS.PENDING },
      { __type: "where", field: "sender.uid", op: "==", value: "player1" },
      { __type: "where", field: "visibleTo", op: "array-contains-any", value: ["ALL", "player1"] }
    ]);

    const gmQ = buildPendingOperationsQuery({
      firestoreDb: {},
      campaignId: "camp_1",
      uid: "gm1",
      isGM: true
    });
    expect(gmQ.constraints).toHaveLength(2);
  });

  it("executa ciclo pending -> efeitos -> committed e recupera falhas injetadas sem efeito duplo", async () => {
    let mp = 10;
    const appliedOps = new Set();
    const applyIdempotent = async (opId, amount) => {
      if (appliedOps.has(opId)) return { applied: false, duplicate: true };
      appliedOps.add(opId);
      mp -= amount;
      return { applied: true, duplicate: false };
    };

    // Caso A: falha injetada entre passo 1 (pending) e passo 2 (efeitos)
    await expect(
      runSagaOperation({
        firestoreDb: {},
        campaignId: "camp_1",
        messageId: "msg_fail_1",
        opId: "op_fail_1",
        messagePayload: {
          sender: { uid: "player1", displayName: "Pingu" },
          roll: validRoll
        },
        onBeforeEffects: async () => {
          throw new Error("crash before effects");
        },
        executeEffects: ({ opId }) => applyIdempotent(opId, 2)
      })
    ).rejects.toThrow("crash before effects");

    expect(mockStore.get("campaigns/camp_1/messages/msg_fail_1").status).toBe(
      MESSAGE_STATUS.PENDING
    );
    expect(mp).toBe(10);

    // Caso B: falha injetada entre passo 2 (efeitos) e passo 3 (committed)
    await expect(
      runSagaOperation({
        firestoreDb: {},
        campaignId: "camp_1",
        messageId: "msg_fail_2",
        opId: "op_fail_2",
        messagePayload: {
          sender: { uid: "player1", displayName: "Pingu" },
          roll: validRoll
        },
        executeEffects: ({ opId }) => applyIdempotent(opId, 3),
        onAfterEffects: async () => {
          throw new Error("crash before commit");
        }
      })
    ).rejects.toThrow("crash before commit");

    expect(mockStore.get("campaigns/camp_1/messages/msg_fail_2").status).toBe(
      MESSAGE_STATUS.PENDING
    );
    expect(mp).toBe(7);

    // Recuperação: op_fail_1 aplica (-2 -> 5); op_fail_2 é idempotente (não desconta -3 de novo!)
    const recovery = await recoverPendingOperations({
      firestoreDb: {},
      campaignId: "camp_1",
      uid: "player1",
      isGM: false,
      executeRecoveryEffects: async (message) => {
        const amount = message.opId === "op_fail_1" ? 2 : 3;
        return applyIdempotent(message.opId, amount);
      }
    });

    expect(recovery.failed).toEqual([]);
    expect(recovery.recovered).toHaveLength(2);
    expect(mp).toBe(5);
    expect(mockStore.get("campaigns/camp_1/messages/msg_fail_1").status).toBe(
      MESSAGE_STATUS.COMMITTED
    );
    expect(mockStore.get("campaigns/camp_1/messages/msg_fail_2").status).toBe(
      MESSAGE_STATUS.COMMITTED
    );
  });

  it("valida argumentos obrigatórios", async () => {
    await expect(
      recoverPendingOperations({ campaignId: "c1", uid: "u1", executeRecoveryEffects: null })
    ).rejects.toMatchObject({ code: ERROR_CODES.MISSING_REQUIRED_FIELD });
  });
});
