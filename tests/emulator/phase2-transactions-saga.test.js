// Testes de contenção (2 clientes), poda de recentOps e sagas do operationRunner contra os emuladores
// de TESTE (firebase.test.json, projeto demo-cpvtt-test).
import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { ref as rtdbRef, get as rtdbGet, set as rtdbSet } from "firebase/database";
import { doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  DEFAULT_CAMPAIGN_ID: "main-table"
}));

const { MESSAGE_STATUS, RECENT_OPS_LIMIT, RESOURCE_KEYS } = await import(
  "../../src/domain/constants.js"
);
const { characterDocPath, messageDocPath } = await import("../../src/infra/firestorePaths.js");
const { tokenPath, tokenSecretPath } = await import("../../src/infra/rtdbPaths.js");
const {
  applyFirestoreResourceDelta,
  applyRtdbResourceDelta,
  buildPendingOperationsQuery,
  recoverPendingOperations,
  runSagaOperation
} = await import("../../src/services/operationRunner.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const CAMPAIGN = "main-table";
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cpvtt-test",
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
    },
    database: {
      rules: fs.readFileSync(path.join(repoRoot, "database.rules.json"), "utf8")
    }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
});

describe("Fase 2 — Transações e contenção no emulador (2 clientes)", () => {
  it("Caso 1 (Firestore): dois clientes descontam MP 10 - 2 - 3 simultaneamente -> 5, com idempotência", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}`), {
        gmId: "gm1",
        name: "Mesa"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player1`), {
        uid: "player1",
        displayName: "P1",
        role: "player"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player2`), {
        uid: "player2",
        displayName: "P2",
        role: "player"
      });
      await setDoc(doc(adminDb, characterDocPath(CAMPAIGN, "c1")), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        editableBy: ["player1", "player2"],
        visibleTo: ["ALL"],
        type: "pc",
        isDeleted: false,
        rev: 0,
        resources: {
          hp: { current: 25, max: 25 },
          mp: { current: 10, max: 10 }
        },
        recentOps: {}
      });
    });

    const dbP1 = env.authenticatedContext("player1").firestore();
    const dbP2 = env.authenticatedContext("player2").firestore();
    const refP1 = doc(dbP1, characterDocPath(CAMPAIGN, "c1"));
    const refP2 = doc(dbP2, characterDocPath(CAMPAIGN, "c1"));

    const [res1, res2] = await Promise.all([
      applyFirestoreResourceDelta(dbP1, refP1, {
        resourceKey: RESOURCE_KEYS.MP,
        delta: -2,
        opId: "op_a",
        nowMs: 100
      }),
      applyFirestoreResourceDelta(dbP2, refP2, {
        resourceKey: RESOURCE_KEYS.MP,
        delta: -3,
        opId: "op_b",
        nowMs: 200
      })
    ]);

    expect(res1.applied).toBe(true);
    expect(res2.applied).toBe(true);

    const afterSnap = await getDoc(refP1);
    const data = afterSnap.data();
    expect(data.resources.mp.current).toBe(5);
    expect(data.resources.mp.max).toBe(10);
    expect(data.rev).toBe(2);
    expect(Object.keys(data.recentOps).sort()).toEqual(["op_a", "op_b"]);

    // Repetir op_a não muda nada
    const dup = await applyFirestoreResourceDelta(dbP1, refP1, {
      resourceKey: RESOURCE_KEYS.MP,
      delta: -2,
      opId: "op_a",
      nowMs: 300
    });
    expect(dup.applied).toBe(false);
    expect(dup.duplicate).toBe(true);

    const afterDup = (await getDoc(refP1)).data();
    expect(afterDup.resources.mp.current).toBe(5);
    expect(afterDup.rev).toBe(2);
  });

  it("Caso 2 (RTDB): dois clientes descontam MP 10 - 2 - 3 simultaneamente -> 5, com idempotência", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const adminRtdb = ctx.database();
      await rtdbSet(rtdbRef(adminRtdb, `vtt_realtime/${CAMPAIGN}/meta/members/player1`), true);
      await rtdbSet(rtdbRef(adminRtdb, `vtt_realtime/${CAMPAIGN}/meta/members/player2`), true);
      await rtdbSet(rtdbRef(adminRtdb, tokenPath(CAMPAIGN, "s1", "t1")), {
        id: "t1",
        kind: "free",
        ownerId: "player1",
        layer: "tokens",
        hidden: false,
        x: 0,
        y: 0,
        sizeInCells: 1,
        rotation: 0,
        ringColor: "#3090f0",
        showName: true,
        rev: 0,
        controlledBy: { player1: true, player2: true }
      });
      await rtdbSet(rtdbRef(adminRtdb, tokenSecretPath(CAMPAIGN, "s1", "t1")), {
        defense: 10,
        showBarsToPlayers: true,
        hp: { current: 10, max: 10 },
        mp: { current: 10, max: 10 }
      });
    });

    const rtdbP1 = env.authenticatedContext("player1").database();
    const rtdbP2 = env.authenticatedContext("player2").database();
    const tokRef1 = rtdbRef(rtdbP1, tokenSecretPath(CAMPAIGN, "s1", "t1"));
    const tokRef2 = rtdbRef(rtdbP2, tokenSecretPath(CAMPAIGN, "s1", "t1"));

    const [res1, res2] = await Promise.all([
      applyRtdbResourceDelta(tokRef1, {
        resourceKey: RESOURCE_KEYS.MP,
        delta: -2,
        opId: "op_rtdb_a",
        nowMs: 100
      }),
      applyRtdbResourceDelta(tokRef2, {
        resourceKey: RESOURCE_KEYS.MP,
        delta: -3,
        opId: "op_rtdb_b",
        nowMs: 200
      })
    ]);

    expect(res1.committed).toBe(true);
    expect(res1.applied).toBe(true);
    expect(res2.committed).toBe(true);
    expect(res2.applied).toBe(true);

    const val = (await rtdbGet(tokRef1)).val();
    expect(val.mp.current).toBe(5);
    expect(val.mp.max).toBe(10);
    expect(Object.keys(val.recentOps).sort()).toEqual(["op_rtdb_a", "op_rtdb_b"]);

    const dup = await applyRtdbResourceDelta(tokRef2, {
      resourceKey: RESOURCE_KEYS.MP,
      delta: -3,
      opId: "op_rtdb_b",
      nowMs: 300
    });
    expect(dup.applied).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect((await rtdbGet(tokRef1)).val().mp.current).toBe(5);
  });

  it("Caso 3: poda recentOps em no máximo 50 entradas dentro da mesma transação (Firestore e RTDB)", async () => {
    const initialOps = {};
    for (let i = 1; i <= 48; i += 1) {
      initialOps[`op_${String(i).padStart(2, "0")}`] = 1000 + i;
    }

    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}`), {
        gmId: "gm1",
        name: "Mesa"
      });
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/members/player1`), {
        uid: "player1",
        displayName: "P1",
        role: "player"
      });
      await rtdbSet(rtdbRef(ctx.database(), `vtt_realtime/${CAMPAIGN}/meta/members/player1`), true);
      await setDoc(doc(ctx.firestore(), characterDocPath(CAMPAIGN, "c_prune")), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        editableBy: ["player1"],
        visibleTo: ["ALL"],
        type: "pc",
        isDeleted: false,
        rev: 0,
        resources: {
          hp: { current: 100, max: 100 },
          mp: { current: 100, max: 100 }
        },
        recentOps: initialOps
      });
      await rtdbSet(rtdbRef(ctx.database(), tokenPath(CAMPAIGN, "s1", "t_prune")), {
        id: "t_prune",
        kind: "free",
        ownerId: "player1",
        layer: "tokens",
        hidden: false,
        x: 0,
        y: 0,
        sizeInCells: 1,
        rotation: 0,
        ringColor: "#3090f0",
        showName: true,
        rev: 0,
        controlledBy: { player1: true }
      });
      await rtdbSet(rtdbRef(ctx.database(), tokenSecretPath(CAMPAIGN, "s1", "t_prune")), {
        defense: 10,
        showBarsToPlayers: true,
        hp: { current: 100, max: 100 },
        mp: { current: 100, max: 100 },
        recentOps: initialOps
      });
    });

    const dbP1 = env.authenticatedContext("player1").firestore();
    const charRef = doc(dbP1, characterDocPath(CAMPAIGN, "c_prune"));
    const rtdbP1 = env.authenticatedContext("player1").database();
    const tokRef = rtdbRef(rtdbP1, tokenSecretPath(CAMPAIGN, "s1", "t_prune"));

    for (let i = 49; i <= 55; i += 1) {
      const opId = `op_${String(i).padStart(2, "0")}`;
      await applyFirestoreResourceDelta(dbP1, charRef, {
        resourceKey: RESOURCE_KEYS.HP,
        delta: -1,
        opId,
        nowMs: 1000 + i
      });
      await applyRtdbResourceDelta(tokRef, {
        resourceKey: RESOURCE_KEYS.HP,
        delta: -1,
        opId,
        nowMs: 1000 + i
      });
    }

    const fsData = (await getDoc(charRef)).data();
    expect(fsData.resources.hp.current).toBe(93);
    expect(Object.keys(fsData.recentOps)).toHaveLength(RECENT_OPS_LIMIT);
    expect(fsData.recentOps.op_01).toBeUndefined();
    expect(fsData.recentOps.op_05).toBeUndefined();
    expect(fsData.recentOps.op_06).toBe(1006);
    expect(fsData.recentOps.op_55).toBe(1055);

    const rtdbData = (await rtdbGet(tokRef)).val();
    expect(rtdbData.hp.current).toBe(93);
    expect(Object.keys(rtdbData.recentOps)).toHaveLength(RECENT_OPS_LIMIT);
    expect(rtdbData.recentOps.op_01).toBeUndefined();
    expect(rtdbData.recentOps.op_55).toBe(1055);
  });

  it("Caso 4 (Saga operationRunner): consulta de não-GM exige visibleTo e recuperação conclui sem cobrança dupla", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}`), {
        gmId: "gm1",
        name: "Mesa"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player1`), {
        uid: "player1",
        displayName: "P1",
        role: "player"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player2`), {
        uid: "player2",
        displayName: "P2",
        role: "player"
      });
      await setDoc(doc(adminDb, messageDocPath(CAMPAIGN, "msg_p1_pub")), {
        campaignId: CAMPAIGN,
        type: "roll",
        status: MESSAGE_STATUS.PENDING,
        opId: "op_seed_1",
        sender: { uid: "player1", displayName: "P1", characterId: null, image: { mediaId: null, url: null } },
        visibleTo: ["ALL"],
        isDeleted: false
      });
      await setDoc(doc(adminDb, messageDocPath(CAMPAIGN, "msg_p1_priv")), {
        campaignId: CAMPAIGN,
        type: "roll",
        status: MESSAGE_STATUS.PENDING,
        opId: "op_seed_2",
        sender: { uid: "player1", displayName: "P1", characterId: null, image: { mediaId: null, url: null } },
        visibleTo: ["gm1", "player1"],
        isDeleted: false
      });
      await setDoc(doc(adminDb, messageDocPath(CAMPAIGN, "msg_p2_other")), {
        campaignId: CAMPAIGN,
        type: "roll",
        status: MESSAGE_STATUS.PENDING,
        opId: "op_seed_3",
        sender: { uid: "player2", displayName: "P2", characterId: null, image: { mediaId: null, url: null } },
        visibleTo: ["ALL"],
        isDeleted: false
      });
    });

    // 4a. Valida a consulta contra firestore.rules real com cliente player1 autenticado
    const dbP1 = env.authenticatedContext("player1").firestore();
    const allowedSnap = await assertSucceeds(
      getDocs(
        buildPendingOperationsQuery({
          firestoreDb: dbP1,
          campaignId: CAMPAIGN,
          uid: "player1",
          isGM: false
        })
      )
    );
    expect(allowedSnap.docs.map((d) => d.id).sort()).toEqual([
      "msg_p1_priv",
      "msg_p1_pub"
    ]);

    // Sem filtro visibleTo, as regras negam a consulta para não-GM
    await assertFails(
      getDocs(
        buildPendingOperationsQuery({
          firestoreDb: dbP1,
          campaignId: CAMPAIGN,
          uid: "player1",
          isGM: true
        })
      )
    );

    // 4b. Ciclo de saga com falhas injetadas e recuperação idempotente no emulador
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}`), {
        gmId: "gm1",
        name: "Mesa"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player1`), {
        uid: "player1",
        displayName: "P1",
        role: "player"
      });
      await setDoc(doc(adminDb, `campaigns/${CAMPAIGN}/members/player2`), {
        uid: "player2",
        displayName: "P2",
        role: "player"
      });
      const charRef = doc(adminDb, characterDocPath(CAMPAIGN, "c_saga"));
      await setDoc(charRef, {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        editableBy: ["player1"],
        visibleTo: ["ALL"],
        type: "pc",
        isDeleted: false,
        rev: 0,
        resources: {
          hp: { current: 25, max: 25 },
          mp: { current: 10, max: 10 }
        },
        recentOps: {}
      });

      await expect(
        runSagaOperation({
          firestoreDb: adminDb,
          campaignId: CAMPAIGN,
          messageId: "saga_msg_1",
          opId: "op_saga_1",
          messagePayload: {
            sender: { uid: "player1", displayName: "P1" },
            seq: 1,
            roll: {
              kind: "attack",
              title: "Gelo",
              costs: [{ resource: "mp", amount: 2 }]
            }
          },
          onBeforeEffects: async () => {
            throw new Error("falha entre pending e efeito");
          },
          executeEffects: ({ opId }) =>
            applyFirestoreResourceDelta(adminDb, charRef, {
              resourceKey: RESOURCE_KEYS.MP,
              delta: -2,
              opId,
              nowMs: 100
            })
        })
      ).rejects.toThrow("falha entre pending e efeito");

      await expect(
        runSagaOperation({
          firestoreDb: adminDb,
          campaignId: CAMPAIGN,
          messageId: "saga_msg_2",
          opId: "op_saga_2",
          messagePayload: {
            sender: { uid: "player1", displayName: "P1" },
            seq: 2,
            roll: {
              kind: "attack",
              title: "Neve",
              costs: [{ resource: "mp", amount: 3 }]
            }
          },
          executeEffects: ({ opId }) =>
            applyFirestoreResourceDelta(adminDb, charRef, {
              resourceKey: RESOURCE_KEYS.MP,
              delta: -3,
              opId,
              nowMs: 200
            }),
          onAfterEffects: async () => {
            throw new Error("falha entre efeito e commit");
          }
        })
      ).rejects.toThrow("falha entre efeito e commit");

      // Antes da recuperação: MP = 7, ambas mensagens em pending
      expect((await getDoc(charRef)).data().resources.mp.current).toBe(7);

      const recovery = await recoverPendingOperations({
        firestoreDb: adminDb,
        campaignId: CAMPAIGN,
        uid: "player1",
        isGM: false,
        executeRecoveryEffects: async (message) => {
          const amount = message.roll?.costs?.[0]?.amount || 0;
          return applyFirestoreResourceDelta(adminDb, charRef, {
            resourceKey: RESOURCE_KEYS.MP,
            delta: -amount,
            opId: message.opId,
            nowMs: 300
          });
        }
      });

      expect(recovery.failed).toEqual([]);
      expect(recovery.recovered).toHaveLength(2);

      const finalChar = (await getDoc(charRef)).data();
      expect(finalChar.resources.mp.current).toBe(5);
      expect(finalChar.rev).toBe(2);
      expect(Object.keys(finalChar.recentOps).sort()).toEqual(["op_saga_1", "op_saga_2"]);

      expect((await getDoc(doc(adminDb, messageDocPath(CAMPAIGN, "saga_msg_1")))).data().status).toBe(
        MESSAGE_STATUS.COMMITTED
      );
      expect((await getDoc(doc(adminDb, messageDocPath(CAMPAIGN, "saga_msg_2")))).data().status).toBe(
        MESSAGE_STATUS.COMMITTED
      );
    });
  });
});
