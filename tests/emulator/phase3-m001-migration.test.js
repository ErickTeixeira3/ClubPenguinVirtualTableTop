// Validação de M001-identity e scripts operacionais Fase 3 no emulador de teste (demo-cpvtt-test).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { validateInvite } from "../../src/domain/models/invite.js";
import { validateMember } from "../../src/domain/models/member.js";
import { validatePlatformAdmin } from "../../src/domain/models/platformAdmin.js";
import { connectAdmin, resolveTarget } from "../../scripts/lib/target.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";
import M001Identity from "../../scripts/migrations/M001-identity.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const TEST_EMULATOR = ["--config", "firebase.test.json", "--project", "demo-cpvtt-test"];
const PROJECT_ID = "demo-cpvtt-test";

function runScript(script, args) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, script), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

async function clearTestEmulatorAuth() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) return;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE"
  });
}

describe("M001-identity e scripts Fase 3 no emulador", () => {
  const target = resolveTarget({ target: "emulator", config: "firebase.test.json", project: PROJECT_ID });
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-m001-"));
  let connection;

  beforeAll(async () => {
    connection = connectAdmin(target);
    await clearTestEmulatorAuth();
    await connection.database.ref().set(null);

    const colls = await connection.firestore.listCollections();
    for (const col of colls) {
      await connection.firestore.recursiveDelete(col);
    }

    // Seed usuários v1 no Auth (Google verificado + password não verificado)
    await connection.auth.createUser({
      uid: "uid_gm",
      email: "mestre@example.invalid",
      emailVerified: true,
      displayName: "Mestre Atual"
    });
    await connection.auth.createUser({
      uid: "uid_p1",
      email: "player.one@example.invalid",
      emailVerified: false,
      displayName: "Pinguim Um"
    });

    // Seed campanha v1 com players, authorizedUsers, authorizedEmails e campos que ficam (combatState)
    await connection.firestore.doc("campaigns/main-table").set({
      name: "Mesa V1",
      gmId: "uid_gm",
      activeSceneId: "s1",
      combatState: { active: false, round: 1, participants: [] },
      players: {
        uid_gm: {
          uid: "uid_gm",
          displayName: "Mestre Atual",
          email: "mestre@example.invalid",
          role: "gm",
          photoURL: "https://example.invalid/gm.png"
        },
        uid_p1: {
          uid: "uid_p1",
          displayName: "Pinguim Um",
          email: "player.one@example.invalid",
          role: "player",
          avatarMediaId: "med_p1",
          avatarRemoved: false,
          activeCharacterId: "char_1"
        }
      },
      authorizedUsers: [
        { email: "player.one@example.invalid", defaultDisplayName: "Pinguim Um", role: "player" },
        { email: "convite.pendente@example.invalid", defaultDisplayName: "Convidado", role: "player" }
      ],
      authorizedEmails: ["extra.pendente@example.invalid"]
    });

    await connection.database.ref("vtt_realtime/main-table").set({
      meta: { gmId: "uid_gm", staleMirror: true, invites: { old_key: true } }
    });
  });

  afterAll(async () => {
    await clearTestEmulatorAuth();
    connection?.database?.goOffline();
    await connection?.app.delete();
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it("dry-run planeja sem mutar Firestore, RTDB nem Auth", async () => {
    const [dry] = await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      logDir,
      apply: false,
      log: () => {}
    });

    expect(dry.applied).toBe(false);
    expect(dry.planned).toBeGreaterThan(0);

    const camp = (await connection.firestore.doc("campaigns/main-table").get()).data();
    expect(camp.players).toBeDefined();
    expect(camp.authorizedUsers).toBeDefined();
    expect((await connection.auth.getUser("uid_p1")).emailVerified).toBe(false);
    expect((await connection.firestore.doc("platformAdmins/uid_gm").get()).exists).toBe(false);
  });

  it("apply migra players -> members, authorizedUsers -> invites, seeda platformAdmins, espelhos RTDB, verifica Auth e é idempotente", async () => {
    const [first] = await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      logDir,
      apply: true,
      log: () => {}
    });

    expect(first.applied).toBe(true);

    // 1) Campaign limpo (sem players, authorizedUsers, authorizedEmails) e combatState preservado
    const camp = (await connection.firestore.doc("campaigns/main-table").get()).data();
    expect(camp.players).toBeUndefined();
    expect(camp.authorizedUsers).toBeUndefined();
    expect(camp.authorizedEmails).toBeUndefined();
    expect(camp.campaignId).toBe("main-table");
    expect(camp.schemaVersion).toBe(2);
    expect(camp.combatState).toEqual({ active: false, round: 1, participants: [] });

    // 2) Members validados contra o contrato do domínio
    const membersSnap = await connection.firestore.collection("campaigns/main-table/members").get();
    expect(membersSnap.docs.map((d) => d.id).sort()).toEqual(["uid_gm", "uid_p1"]);
    for (const docSnap of membersSnap.docs) {
      const check = validateMember(docSnap.data(), { uid: docSnap.id, campaignId: "main-table" });
      expect(check.ok).toBe(true);
      expect(docSnap.data().role).toBeUndefined();
      expect(docSnap.data().email).toBeUndefined();
    }
    expect(membersSnap.docs.find((d) => d.id === "uid_p1").data().avatar).toEqual({
      mediaId: "med_p1",
      url: null
    });

    // 3) Invites validados: aceitos recebem acceptedBy e pendentes ficam com acceptedBy = null
    const invitesSnap = await connection.firestore.collection("campaigns/main-table/invites").get();
    expect(invitesSnap.docs.map((d) => d.id).sort()).toEqual([
      "convite.pendente@example.invalid",
      "extra.pendente@example.invalid",
      "player.one@example.invalid"
    ]);
    for (const docSnap of invitesSnap.docs) {
      const check = validateInvite(docSnap.data(), {
        emailLower: docSnap.id,
        campaignId: "main-table"
      });
      expect(check.ok).toBe(true);
    }
    const p1Inv = invitesSnap.docs.find((d) => d.id === "player.one@example.invalid").data();
    expect(p1Inv.acceptedBy).toBe("uid_p1");
    const pendingInv = invitesSnap.docs.find((d) => d.id === "convite.pendente@example.invalid").data();
    expect(pendingInv.acceptedBy).toBeNull();

    // 4) platformAdmins seeded no Firestore e RTDB
    const fsAdminSnap = await connection.firestore.doc("platformAdmins/uid_gm").get();
    expect(fsAdminSnap.exists).toBe(true);
    expect(validatePlatformAdmin(fsAdminSnap.data(), { docId: "uid_gm" }).ok).toBe(true);
    const rtdbAdminVal = (await connection.database.ref("platformAdmins/uid_gm").once("value")).val();
    expect(rtdbAdminVal).toBe(true);

    // 5) Auth emailVerified marcado para membro password existente
    expect((await connection.auth.getUser("uid_p1")).emailVerified).toBe(true);

    // 6) RTDB meta espelhado e chave antiga de convite limpa
    const rtdbMeta = (await connection.database.ref("vtt_realtime/main-table/meta").once("value")).val();
    expect(rtdbMeta.gmId).toBe("uid_gm");
    expect(rtdbMeta.members).toEqual({ uid_gm: true, uid_p1: true });
    expect(rtdbMeta.invites).toEqual({
      "convite,pendente@example,invalid": true,
      "extra,pendente@example,invalid": true
    });

    // 7) Segunda execução é idempotente (0 operações)
    const [second] = await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      logDir,
      apply: true,
      log: () => {}
    });
    expect(second.planned).toBe(0);
    expect(second.applied).toBe(false);
  });

  it("script operacional set-runtime-config em dry-run não grava no Firestore", async () => {
    const rtDry = runScript("scripts/ops/set-runtime-config.mjs", [
      "--target",
      "emulator",
      ...TEST_EMULATOR,
      "--min-client-version",
      "2.0.0"
    ]);
    expect(rtDry.code).toBe(0);
    expect(JSON.parse(rtDry.out)).toMatchObject({ dryRun: true, applied: false });
    expect((await connection.firestore.doc("appConfig/runtime").get()).exists).toBe(false);
  });

  it("script operacional set-runtime-config com --apply grava appConfig/runtime", async () => {
    const rtApply = runScript("scripts/ops/set-runtime-config.mjs", [
      "--target",
      "emulator",
      ...TEST_EMULATOR,
      "--min-client-version",
      "2.1.0",
      "--apply"
    ]);
    expect(rtApply.code).toBe(0);
    const runtimeDoc = (await connection.firestore.doc("appConfig/runtime").get()).data();
    expect(runtimeDoc).toMatchObject({ minClientVersion: "2.1.0", schemaVersion: 2 });
  });

  it("script operacional set-platform-admin concede platformAdmins nos dois bancos", async () => {
    const admApply = runScript("scripts/ops/set-platform-admin.mjs", [
      "--target",
      "emulator",
      ...TEST_EMULATOR,
      "--uid",
      "uid_admin_ops",
      "--apply"
    ]);
    expect(admApply.code).toBe(0);
    expect((await connection.firestore.doc("platformAdmins/uid_admin_ops").get()).exists).toBe(true);
    expect(
      (await connection.database.ref("platformAdmins/uid_admin_ops").once("value")).val()
    ).toBe(true);
  });

  it("script operacional set-platform-admin --remove revoga platformAdmins nos dois bancos", async () => {
    const admRemove = runScript("scripts/ops/set-platform-admin.mjs", [
      "--target",
      "emulator",
      ...TEST_EMULATOR,
      "--uid",
      "uid_admin_ops",
      "--remove",
      "--apply"
    ]);
    expect(admRemove.code).toBe(0);
    expect((await connection.firestore.doc("platformAdmins/uid_admin_ops").get()).exists).toBe(false);
    expect(
      (await connection.database.ref("platformAdmins/uid_admin_ops").once("value")).exists()
    ).toBe(false);
  });

  it("M001-identity suporta authorizedUsers em mapa, duplicados, membros com campos legados e limpa meta/members órfãos", async () => {
    await connection.firestore.doc("campaigns/camp-map").set({
      name: "Mesa Mapa",
      gmId: "uid_gm",
      players: {
        uid_gm: { uid: "uid_gm", displayName: "Mestre", role: "gm" },
        uid_p1: { uid: "uid_p1", displayName: "P1", role: "player" }
      },
      authorizedUsers: {
        p1_key: { email: "Player.One@Example.invalid", defaultDisplayName: "P1", role: "player" },
        dup_key: { email: "player.one@example.invalid", defaultDisplayName: "P1 Dup", role: "player" },
        pending_key: { email: "Mapa.Pendente@Example.invalid", defaultDisplayName: "Mapa Pend", role: "player" }
      }
    });
    await connection.firestore.doc("campaigns/camp-map/members/uid_p1").set({
      uid: "uid_p1",
      campaignId: "camp-map",
      displayName: "P1",
      role: "player",
      email: "player.one@example.invalid",
      avatar: { mediaId: null, url: null }
    });
    await connection.database.ref("vtt_realtime/camp-map/meta").set({
      gmId: "uid_gm",
      members: { uid_gm: true, uid_p1: true, uid_ghost: true }
    });

    const [res] = await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      logDir,
      apply: true,
      log: () => {}
    });
    expect(res.applied).toBe(true);

    const p1Member = (await connection.firestore.doc("campaigns/camp-map/members/uid_p1").get()).data();
    expect(p1Member.role).toBeUndefined();
    expect(p1Member.email).toBeUndefined();
    expect(validateMember(p1Member, { uid: "uid_p1", campaignId: "camp-map" }).ok).toBe(true);

    const invitesSnap = await connection.firestore.collection("campaigns/camp-map/invites").get();
    expect(invitesSnap.docs.map((d) => d.id).sort()).toEqual([
      "mapa.pendente@example.invalid",
      "player.one@example.invalid"
    ]);
    const metaAfter = (await connection.database.ref("vtt_realtime/camp-map/meta").once("value")).val();
    expect(metaAfter.members).toEqual({ uid_gm: true, uid_p1: true });
    expect(metaAfter.invites).toEqual({ "mapa,pendente@example,invalid": true });

    const [idemp] = await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      logDir,
      apply: true,
      log: () => {}
    });
    expect(idemp.planned).toBe(0);
    expect(idemp.applied).toBe(false);
  });
});
