import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/infra/firebase.js", () => ({ db: {} }));

const { applyPendingAllyCost } = await import(
  "../../src/services/allyCostService.js"
);
const runtimeConfig = await import("../../src/services/runtimeConfigService.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const CAMPAIGN = "camp_phase9";
let env;

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const fsAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();

function roll(overrides = {}) {
  return {
    kind: "attack",
    title: "Ataque",
    icon: "sword",
    color: "#02529c",
    rolls: [{ label: "Acerto", total: 15, isCrit: false, isFumble: false }],
    costs: [],
    targets: [
      { tokenId: "tok_target", sceneId: "scene_1", characterId: "char_p2", label: "Alvo" }
    ],
    hitEvaluation: { status: "pending", results: [] },
    savingThrowRequest: null,
    respondsTo: null,
    secondary: null,
    allyCostOps: [],
    appliedEffects: {},
    ...overrides
  };
}

function message(uid, seq, overrides = {}) {
  return {
    campaignId: CAMPAIGN,
    type: "roll",
    seq,
    visibility: "public",
    visibleTo: ["ALL"],
    sender: {
      uid,
      characterId: null,
      displayName: uid,
      image: { mediaId: null, url: null }
    },
    status: "committed",
    opId: null,
    content: "",
    roll: roll(),
    isDeleted: false,
    deletedAt: null,
    deletedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function createAtomic(db, id, seq, payload) {
  const batch = writeBatch(db);
  batch.set(doc(db, `campaigns/${CAMPAIGN}/messages/${id}`), payload);
  batch.update(doc(db, `campaigns/${CAMPAIGN}/state/chat`), {
    lastSeq: seq,
    lastMessageId: id
  });
  return batch.commit();
}

async function seedBase() {
  await seed(async (db) => {
    await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      gmId: "gm1",
      name: "Mesa Fase 9"
    });
    for (const uid of ["gm1", "p1", "p2", "p3"]) {
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/members/${uid}`), {
        uid,
        campaignId: CAMPAIGN,
        displayName: uid,
        avatar: { mediaId: null, url: null }
      });
    }
    await setDoc(doc(db, `campaigns/${CAMPAIGN}/state/chat`), {
      campaignId: CAMPAIGN,
      lastSeq: 0,
      lastMessageId: null
    });
    await setDoc(doc(db, `campaigns/${CAMPAIGN}/characters/char_p2`), {
      campaignId: CAMPAIGN,
      name: "Defensor",
      type: "pc",
      ownerId: "p2",
      visibleTo: ["ALL", "p2"],
      editableBy: ["p2"],
      resources: {
        hp: { current: 20, max: 20 },
        mp: { current: 10, max: 10 }
      },
      inventory: {},
      recentOps: {},
      rev: 0,
      isDeleted: false
    });
  });
}

beforeAll(async () => {
  runtimeConfig.setClientVersionBlocked(false);
  env = await initializeTestEnvironment({
    projectId: "demo-cpvtt-test",
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
    }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedBase();
});

describe("B6 — mensagens e combate", () => {
  it("nega appliedEffects na criação e alteração de hitEvaluation pelo jogador; Mestre conclui pending", async () => {
    const p1 = fsAs("p1");
    await assertFails(
      createAtomic(
        p1,
        "msg_bad_effect",
        1,
        message("p1", 1, {
          roll: roll({ appliedEffects: { op_bad: { finalValue: 99 } } })
        })
      )
    );

    await assertSucceeds(
      createAtomic(p1, "msg_pending_hit", 1, message("p1", 1))
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/messages/msg_pending_hit`), {
        "roll.hitEvaluation": {
          status: "done",
          results: [{ tokenId: "tok_target", hit: true, crit: false, fumble: false }]
        },
        updatedAt: serverTimestamp()
      })
    );
    await assertSucceeds(
      updateDoc(doc(fsAs("gm1"), `campaigns/${CAMPAIGN}/messages/msg_pending_hit`), {
        "roll.hitEvaluation": {
          status: "done",
          results: [{ tokenId: "tok_target", hit: true, crit: false, fumble: false }]
        },
        updatedAt: serverTimestamp()
      })
    );
  });

  it("permite só pending -> terminal pelo remetente e reserva soft delete ao Mestre", async () => {
    const p1 = fsAs("p1");
    await assertSucceeds(
      createAtomic(
        p1,
        "msg_status",
        1,
        message("p1", 1, { status: "pending", opId: "op_status" })
      )
    );
    await assertSucceeds(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/messages/msg_status`), {
        status: "committed",
        updatedAt: serverTimestamp()
      })
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/messages/msg_status`), {
        status: "pending",
        updatedAt: serverTimestamp()
      })
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/messages/msg_status`), {
        isDeleted: true,
        deletedBy: "p1",
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
    await assertSucceeds(
      updateDoc(doc(fsAs("gm1"), `campaigns/${CAMPAIGN}/messages/msg_status`), {
        isDeleted: true,
        deletedBy: "gm1",
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  });

  it("exige contador atômico, seq +1 e lastMessageId exato", async () => {
    const p1 = fsAs("p1");
    await assertFails(
      setDoc(
        doc(p1, `campaigns/${CAMPAIGN}/messages/msg_without_counter`),
        message("p1", 1)
      )
    );
    await assertFails(createAtomic(p1, "msg_skip", 2, message("p1", 2)));

    const batch = writeBatch(p1);
    batch.set(
      doc(p1, `campaigns/${CAMPAIGN}/messages/msg_wrong_id`),
      message("p1", 1)
    );
    batch.update(doc(p1, `campaigns/${CAMPAIGN}/state/chat`), {
      lastSeq: 1,
      lastMessageId: "another_id"
    });
    await assertFails(batch.commit());
    await assertSucceeds(
      createAtomic(p1, "msg_valid_counter", 1, message("p1", 1))
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/state/chat`), {
        lastSeq: 3,
        lastMessageId: "msg_valid_counter"
      })
    );
  });

  it("aceita uma única resposta determinística somente do responsável", async () => {
    const p1 = fsAs("p1");
    const saveId = "save_request_1";
    await assertSucceeds(
      createAtomic(
        p1,
        "msg_save_request",
        1,
        message("p1", 1, {
          roll: roll({
            savingThrowRequest: {
              id: saveId,
              targetCharacterId: "char_p2",
              targetTokenId: "tok_target",
              targetSceneId: "scene_1",
              dc: 14,
              attributeKey: "vigor",
              effectDescription: "Evita o efeito",
              sourceName: "Rajada"
            }
          })
        })
      )
    );
    const response = (uid) =>
      message(uid, 2, {
        roll: roll({
          kind: "saving_throw",
          title: "Resistência",
          targets: [],
          hitEvaluation: { status: "none", results: [] },
          respondsTo: { messageId: "msg_save_request", saveId }
        })
      });

    await assertFails(
      createAtomic(fsAs("p3"), `save_${saveId}`, 2, response("p3"))
    );
    await assertSucceeds(
      createAtomic(fsAs("p2"), `save_${saveId}`, 2, response("p2"))
    );
    await assertFails(
      createAtomic(fsAs("p2"), `save_${saveId}`, 3, {
        ...response("p2"),
        seq: 3
      })
    );
  });

  it("aplica pendingCost junto da autoridade e nega editor não autorizado", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/pendingCosts/op_ally`), {
        opId: "op_ally",
        campaignId: CAMPAIGN,
        characterId: "char_p2",
        sourceMessageId: "msg_source",
        costs: { mp: 2 },
        itemId: null,
        createdBy: "p1",
        status: "pending",
        appliedBy: null,
        appliedAt: null,
        createdAt: serverTimestamp()
      });
    });
    await assertFails(
      updateDoc(doc(fsAs("p3"), `campaigns/${CAMPAIGN}/pendingCosts/op_ally`), {
        status: "applied",
        appliedBy: "p3",
        appliedAt: serverTimestamp()
      })
    );

    const [ownerResult, gmResult] = await Promise.all([
      applyPendingAllyCost({
        firestoreDb: fsAs("p2"),
        campaignId: CAMPAIGN,
        opId: "op_ally",
        appliedBy: "p2"
      }),
      applyPendingAllyCost({
        firestoreDb: fsAs("gm1"),
        campaignId: CAMPAIGN,
        opId: "op_ally",
        appliedBy: "gm1"
      })
    ]);
    expect([ownerResult.applied, gmResult.applied].filter(Boolean)).toHaveLength(1);
    const character = (
      await getDoc(doc(fsAs("p2"), `campaigns/${CAMPAIGN}/characters/char_p2`))
    ).data();
    expect(character.resources.mp.current).toBe(8);
    expect(character.rev).toBe(1);
    expect(character.recentOps.op_ally).toBeDefined();
  });
});

describe("B7 — contenção do contador", () => {
  it("vários clientes recebem seq únicos sem perda", async () => {
    const clients = Array.from({ length: 2 }, () => fsAs("p1"));
    await Promise.all(
      clients.map((db, index) =>
        runTransaction(db, async (tx) => {
          const stateRef = doc(db, `campaigns/${CAMPAIGN}/state/chat`);
          const snapshot = await tx.get(stateRef);
          const seq = snapshot.data().lastSeq + 1;
          const id = `msg_concurrent_${index}`;
          tx.set(
            doc(db, `campaigns/${CAMPAIGN}/messages/${id}`),
            message("p1", seq)
          );
          tx.update(stateRef, { lastSeq: seq, lastMessageId: id });
        })
      )
    );
    const snapshot = await getDocs(
      collection(fsAs("gm1"), `campaigns/${CAMPAIGN}/messages`)
    );
    const seqs = snapshot.docs.map((item) => item.data().seq).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2]);
    expect(new Set(seqs).size).toBe(2);
  });
});
