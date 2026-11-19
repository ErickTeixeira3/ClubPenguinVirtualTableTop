// Security Rules v1 no emulador — regressão portada de auditoria_refatoracao/validar-regressoes.mjs
// (que avaliava as expressões do RTDB com `vm` e as regras do Firestore por busca de texto).
// A1-A3 (pings/desenhos do autor), A4 (renomear com editableBy, D-3), A32 (meta/gmId e delegação)
// e A33 (controlledBy em mapa). Não portado: a exceção por e-mail fixo do Mestre (A32), que sai na Fase 3.
// As regras v2 (Fases 3, 4, 8 e 9) substituem estes casos pelos do Apêndice B.
import fs from "node:fs";
import path from "node:path";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp as rtdbServerTimestamp } from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const CAMPAIGN = "main-table";
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cpvtt-test",
    firestore: { rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8") },
    database: { rules: fs.readFileSync(path.join(repoRoot, "database.rules.json"), "utf8") }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
});

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const rtdbAs = (uid) => env.authenticatedContext(uid).database();
const firestoreAs = (uid) => env.authenticatedContext(uid).firestore();
const rt = (suffix) => `vtt_realtime/${CAMPAIGN}/${suffix}`;

describe("A1-A3: pings e desenhos nos nós irmãos", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.database();
      await db.ref(rt("meta/members/player1")).set(true);
      await db.ref(rt("meta/members/player2")).set(true);
    });
  });

  it("o autor cria ping e desenho na camada de tokens", async () => {
    await assertSucceeds(
      rtdbAs("player1").ref(rt("pings/s1/p1")).set({
        id: "p1",
        authorId: "player1",
        kind: "ping",
        x: 1,
        y: 2,
        color: "#00f0ff",
        createdAt: rtdbServerTimestamp()
      })
    );
    await assertSucceeds(
      rtdbAs("player1").ref(rt("drawings/s1/d1")).set({
        id: "d1",
        authorId: "player1",
        layer: "tokens",
        type: "stroke",
        color: "#ffcc00",
        width: 4,
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }]
      })
    );
  });

  it("quem não é Mestre não cria desenho fora da camada de tokens nem em nome de outro", async () => {
    await assertFails(
      rtdbAs("player1").ref(rt("drawings/s1/d2")).set({
        id: "d2",
        authorId: "player1",
        layer: "map",
        type: "stroke",
        color: "#ffcc00",
        width: 4,
        points: [{ x: 0, y: 0 }]
      })
    );
    await assertFails(
      rtdbAs("player1").ref(rt("drawings/s1/d3")).set({
        id: "d3",
        authorId: "player2",
        layer: "tokens",
        type: "stroke",
        color: "#ffcc00",
        width: 4,
        points: [{ x: 0, y: 0 }]
      })
    );
  });

  it("outro jogador não apaga o ping não expirado de alguém", async () => {
    await assertSucceeds(
      rtdbAs("player1").ref(rt("pings/s1/p1")).set({
        id: "p1",
        authorId: "player1",
        kind: "ping",
        x: 1,
        y: 2,
        color: "#00f0ff",
        createdAt: rtdbServerTimestamp()
      })
    );
    await assertFails(rtdbAs("player2").ref(rt("pings/s1/p1")).remove());
    await assertSucceeds(rtdbAs("player1").ref(rt("pings/s1/p1")).remove());
  });
});

describe("A4 / D-3: pasta com editableBy", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await db.doc(`campaigns/${CAMPAIGN}`).set({ gmId: "gm1", name: "Mesa" });
      await db.doc(`campaigns/${CAMPAIGN}/members/player1`).set({ uid: "player1", displayName: "P1", role: "player" });
      await db.doc(`campaigns/${CAMPAIGN}/members/player2`).set({ uid: "player2", displayName: "P2", role: "player" });
      await db.doc(`campaigns/${CAMPAIGN}/folders/f1`).set({
        name: "Pasta",
        ownerId: "player1",
        visibleTo: ["player1", "player2"],
        editableBy: ["player1", "player2"],
        isDeleted: false
      });
    });
  });

  it("quem está em editableBy renomeia, mas não exclui", async () => {
    const asEditor = firestoreAs("player2").doc(`campaigns/${CAMPAIGN}/folders/f1`);
    await assertSucceeds(asEditor.update({ name: "Pasta Renomeada" }));
    await assertFails(asEditor.update({ isDeleted: true }));
  });

  it("o dono exclui (soft delete)", async () => {
    await assertSucceeds(firestoreAs("player1").doc(`campaigns/${CAMPAIGN}/folders/f1`).update({ isDeleted: true }));
  });
});

describe("A32: autoridade do Mestre no RTDB", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.database();
      await db.ref(rt("meta/members/player1")).set(true);
      await db.ref(rt("meta/members/player2")).set(true);
      await db.ref(rt("meta/members/player_delegated")).set(true);
    });
  });

  it("jogador comum não reivindica meta/gmId", async () => {
    await assertFails(rtdbAs("player1").ref(rt("meta/gmId")).set("player1"));
  });

  it("o Mestre delegado (meta/gmId) herda a autoridade; outro jogador não", async () => {
    await seed((ctx) => ctx.database().ref(rt("meta/gmId")).set("player_delegated"));
    await assertSucceeds(rtdbAs("player_delegated").ref(rt("fog/s1")).set({ enabled: true }));
    await assertFails(rtdbAs("player2").ref(rt("fog/s1")).set({ enabled: true }));
    await assertSucceeds(rtdbAs("player_delegated").ref(rt("meta/gmId")).set("gm_back"));
  });
});

describe("A33: controlledBy em mapa", () => {
  const token = {
    id: "t1",
    kind: "free",
    ownerId: "owner1",
    layer: "tokens",
    hidden: false,
    x: 0,
    y: 0,
    sizeInCells: 1,
    rotation: 0,
    ringColor: "#3090f0",
    showName: true,
    rev: 0,
    controlledBy: { u0: true, u1: true, u2: true, u3: true, u4: true, u5: true, u9: true }
  };

  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.database();
      await db.ref(rt("meta/members/u5")).set(true);
      await db.ref(rt("meta/members/u9")).set(true);
      await db.ref(rt("meta/members/bad")).set(true);
      await db.ref(rt("tokens/s1/t1")).set(token);
    });
  });

  it("controladores (inclusive o 6º e o 10º) movem o token", async () => {
    await assertSucceeds(rtdbAs("u5").ref(rt("tokens/s1/t1")).update({ x: 64 }));
    await assertSucceeds(rtdbAs("u9").ref(rt("tokens/s1/t1")).update({ x: 128 }));
  });

  it("membro fora de controlledBy e estranhos não movem", async () => {
    await assertFails(rtdbAs("bad").ref(rt("tokens/s1/t1")).update({ x: 0 }));
    await assertFails(rtdbAs("stranger").ref(rt("tokens/s1/t1")).update({ x: 0 }));
  });
});
