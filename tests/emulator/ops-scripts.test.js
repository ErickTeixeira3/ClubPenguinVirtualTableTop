// Scripts operacionais contra os emuladores de TESTE (firebase.test.json, projeto demo-cpvtt-test).
// Roda em `npm run test:rules` (os emuladores sobem via `firebase emulators:exec`). Nada aqui toca a produção:
// os testes das travas de produção falham antes de qualquer conexão.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSnapshot, writeSnapshot } from "../../scripts/lib/snapshot.mjs";
import { connectAdmin, resolveTarget } from "../../scripts/lib/target.mjs";
import { evaluateAuditData } from "../../scripts/migrations/audit-v2.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const TEST_EMULATOR = ["--config", "firebase.test.json", "--project", "demo-cpvtt-test"];
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-ops-"));

function runScript(script, args) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

const fixture = {
  manifest: { createdAt: "2026-11-17T00:00:00.000Z", source: "fixture", projectId: "fixture", counts: {} },
  documents: {
    "campaigns/main-table": {
      name: "Mesa",
      gmId: "gm1",
      createdAt: { __type: "timestamp", seconds: 1763000000, nanoseconds: 5000 },
      players: { gm1: { displayName: "Mestre" } }
    },
    "campaigns/main-table/characters/c1": { name: "Pinguim", ownerId: "p1", visibleTo: ["ALL"], abilities: [{ id: "a1", name: "Rajada" }] },
    "campaigns/main-table/messages/m1": { type: "text", content: "oi", senderId: "p1", timestampMs: 1763000000123 },
    "orphanParent/x/children/y": { ok: true }
  },
  database: {
    vtt_realtime: {
      "main-table": {
        meta: { gmId: "gm1" },
        tokens: { s1: { t1: { ownerId: "p1", x: 64, y: 128, controlledBy: { p1: true } } } }
      }
    }
  },
  users: [
    {
      uid: "gm1",
      email: "gm@example.invalid",
      emailVerified: true,
      displayName: "Mestre",
      photoURL: null,
      disabled: false,
      providerData: [{ providerId: "google.com", uid: "google-sub-1", email: "gm@example.invalid", displayName: "Mestre", photoURL: null }]
    },
    {
      uid: "p1",
      email: "p1@example.invalid",
      emailVerified: false,
      displayName: null,
      photoURL: null,
      disabled: false,
      providerData: [{ providerId: "password", uid: "p1@example.invalid", email: "p1@example.invalid", displayName: null, photoURL: null }]
    }
  ]
};

beforeAll(() => {
  writeSnapshot(path.join(tmpRoot, "fixture"), fixture);
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("travas de alvo", () => {
  it("sem --target, os scripts recusam rodar", () => {
    const res = runScript("scripts/ops/export-production.mjs", []);
    expect(res.code).not.toBe(0);
    expect(res.err).toContain("--target emulator ou --target production");
  });

  it("produção exige --confirm-production", () => {
    const res = runScript("scripts/migrations/run.mjs", ["--target", "production"]);
    expect(res.code).not.toBe(0);
    expect(res.err).toContain("--confirm-production");
  });

  it("produção é recusada com variáveis de emulador no ambiente", () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
    const res = runScript("scripts/ops/export-production.mjs", ["--target", "production", "--confirm-production"]);
    expect(res.code).not.toBe(0);
    expect(res.err).toContain("variáveis de emulador");
  });

  it("o emulador só aceita projeto demo-", () => {
    expect(() => resolveTarget({ target: "emulator", config: "firebase.test.json", project: "clubpenguintabletop" })).toThrow(/demo-/);
  });
});

describe("snapshot → seed → export", () => {
  it("o estado exportado do emulador é idêntico ao snapshot semeado", () => {
    const seeded = runScript("scripts/ops/seed-emulator.mjs", [...TEST_EMULATOR, "--snapshot", path.join(tmpRoot, "fixture")]);
    expect(seeded.err).toBe("");
    expect(seeded.code).toBe(0);

    const exported = runScript("scripts/ops/export-production.mjs", [
      "--target", "emulator", ...TEST_EMULATOR, "--out", tmpRoot, "--label", "roundtrip"
    ]);
    expect(exported.code).toBe(0);

    const back = readSnapshot(path.join(tmpRoot, "roundtrip"));
    expect(back.documents).toEqual(fixture.documents);
    expect(back.database).toEqual(fixture.database);
    expect(back.manifest).toMatchObject({ source: "emulator", projectId: "demo-cpvtt-test" });
    expect(back.manifest.counts).toMatchObject({ firestoreDocuments: 4, authUsers: 2 });
    expect(back.users.map((u) => [u.uid, u.email, u.emailVerified, u.providerData.map((p) => p.providerId).sort()])).toEqual([
      ["gm1", "gm@example.invalid", true, ["google.com"]],
      ["p1", "p1@example.invalid", false, ["password"]]
    ]);
  });

  it("a conta de e-mail e senha entra com a senha local de desenvolvimento e mantém o UID", async () => {
    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const res = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "p1@example.invalid", password: "pinguim123", returnSecureToken: true })
    });
    expect(res.status).toBe(200);
    expect((await res.json()).localId).toBe("p1");
  });

  it("a auditoria sem validadores é inconclusiva (código 2), e com validadores v2 detecta o v1 na fixture", () => {
    const emptyCheck = evaluateAuditData(readSnapshot(path.join(tmpRoot, "fixture")), []);
    expect(emptyCheck.exitCode).toBe(2);
    expect(emptyCheck.report).toMatchObject({ documents: 4, validators: 0, violations: 0 });

    const res = runScript("scripts/migrations/audit-v2.mjs", ["--snapshot", path.join(tmpRoot, "fixture")]);
    expect(res.code).toBe(1);
    const parsed = JSON.parse(res.out);
    expect(parsed.validators).toBeGreaterThanOrEqual(2);
    expect(parsed.violations).toBeGreaterThan(0);
  });
});

describe("executor de migrações", () => {
  const target = resolveTarget({ target: "emulator", config: "firebase.test.json", project: "demo-cpvtt-test" });
  const logDir = path.join(tmpRoot, "migration-logs");
  let connection;

  beforeAll(async () => {
    connection = connectAdmin(target);
    await connection.firestore.doc("campaigns/c1").set({ name: "Teste" });
    await connection.database.ref("vtt_realtime/c1").set({ meta: { gmId: "gm1" } });
  });

  afterAll(async () => {
    await connection?.app.delete();
  });

  const sampleMigration = {
    id: "MTEST-sample",
    async plan({ firestore }) {
      const campaign = (await firestore.doc("campaigns/c1").get()).data();
      if (campaign.schemaVersion === 2) return { operations: [], summary: { campaigns: 0 } };
      return {
        operations: [
          { kind: "fs.update", path: "campaigns/c1", data: { schemaVersion: 2 } },
          { kind: "rtdb.update", path: "vtt_realtime/c1", data: { "meta/a": 1, "meta/b": 2 } }
        ],
        summary: { campaigns: 1 }
      };
    }
  };

  it("simulação não grava nada", async () => {
    const [result] = await runMigrations({ migrations: [sampleMigration], connection, target, logDir, log: () => {} });
    expect(result).toMatchObject({ planned: 2, writes: 3, applied: false });
    expect((await connection.firestore.doc("campaigns/c1").get()).data().schemaVersion).toBeUndefined();
  });

  it("aborta antes de gravar quando passaria do limite diário", async () => {
    await expect(
      runMigrations({ migrations: [sampleMigration], connection, target, logDir, apply: true, dailyWriteLimit: 2, log: () => {} })
    ).rejects.toThrow(/limite diário/);
    expect((await connection.firestore.doc("campaigns/c1").get()).data().schemaVersion).toBeUndefined();
  });

  it("aplica, registra as escritas do dia e é idempotente", async () => {
    const [first] = await runMigrations({ migrations: [sampleMigration], connection, target, logDir, apply: true, log: () => {} });
    expect(first).toMatchObject({ applied: true, writes: 3 });
    expect((await connection.firestore.doc("campaigns/c1").get()).data().schemaVersion).toBe(2);
    expect((await connection.database.ref("vtt_realtime/c1/meta").once("value")).val()).toEqual({ gmId: "gm1", a: 1, b: 2 });

    const ledger = JSON.parse(fs.readFileSync(path.join(logDir, "write-ledger.json"), "utf8"));
    expect(Object.values(ledger)).toEqual([3]);

    const [second] = await runMigrations({ migrations: [sampleMigration], connection, target, logDir, apply: true, log: () => {} });
    expect(second).toMatchObject({ planned: 0, applied: false });
  });
});
