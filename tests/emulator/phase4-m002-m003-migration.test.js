// Testes de integração no emulador para M002-audience e M003-media (Fase 4 / INT-10).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertAudience } from "../../src/domain/audience.js";
import { validateMedia } from "../../src/domain/models/media.js";
import { connectAdmin, resolveTarget } from "../../scripts/lib/target.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";
import M001Identity from "../../scripts/migrations/M001-identity.mjs";
import M002Audience from "../../scripts/migrations/M002-audience.mjs";
import M003Media from "../../scripts/migrations/M003-media.mjs";
import { decodeValue, readSnapshot } from "../../scripts/lib/snapshot.mjs";

const PHASE0_SNAPSHOT_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "local-data",
  "snapshots",
  "2026-11-17T12-55-15-040Z-production"
);

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const PROJECT_ID = "demo-cpvtt-test";
const CAMPAIGN = "main-table";

async function clearTestEmulatorAuth() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) return;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: "DELETE"
  });
}

describe("M002-audience e M003-media no emulador", () => {
  const target = resolveTarget({
    target: "emulator",
    config: "firebase.test.json",
    project: PROJECT_ID
  });
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-m002-m003-"));
  let connection;

  beforeAll(async () => {
    connection = connectAdmin(target);
    await clearTestEmulatorAuth();
    await connection.database.ref().set(null);

    const colls = await connection.firestore.listCollections();
    for (const col of colls) {
      await connection.firestore.recursiveDelete(col);
    }

    await connection.auth.createUser({
      uid: "uid_gm",
      email: "gm@example.invalid",
      emailVerified: true,
      displayName: "Mestre"
    });
    await connection.auth.createUser({
      uid: "uid_p1",
      email: "p1@example.invalid",
      emailVerified: true,
      displayName: "Jogador 1"
    });
    await connection.auth.createUser({
      uid: "uid_p2",
      email: "p2@example.invalid",
      emailVerified: true,
      displayName: "Jogador 2"
    });

    // Campanha v1 fiel ao snapshot (sem members iniciais -> M001 roda antes)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}`).set({
      name: "Mesa V1 Snapshot",
      gmId: "uid_gm",
      activeSceneId: "scene_pub",
      players: {
        uid_gm: { uid: "uid_gm", displayName: "Mestre", email: "gm@example.invalid", role: "gm" },
        uid_p1: {
          uid: "uid_p1",
          displayName: "Jogador 1",
          email: "p1@example.invalid",
          role: "player",
          avatarMediaId: "med_member_p1"
        },
        uid_p2: { uid: "uid_p2", displayName: "Jogador 2", email: "p2@example.invalid", role: "player" }
      }
    });

    // Characters (um sem ownerId em visibleTo, outro NPC privado)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/characters/char_pc`).set({
      name: "Pinguim 1",
      type: "pc",
      ownerId: "uid_p1",
      visibleTo: ["ALL"],
      editableBy: ["uid_p1"],
      avatarMediaId: "med_char_pub",
      defaultToken: { mediaId: "med_tok_pub" }
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/characters/char_npc`).set({
      name: "Chefe Oculto",
      type: "npc",
      ownerId: "uid_gm",
      visibleTo: [],
      editableBy: []
    });

    // Folders (character folder com scope legado + journal folder)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/folders/fld_char`).set({
      folderType: "character",
      scope: "player",
      ownerId: "uid_p1",
      name: "Minhas Fichas",
      visibleTo: ["ALL"],
      editableBy: ["uid_p1"]
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/folders/fld_gm`).set({
      folderType: "journal",
      noteType: "lore",
      scope: "gm",
      ownerId: "uid_gm",
      name: "Pasta Secreta",
      visibleTo: ["ALL", "uid_gm"],
      editableBy: ["ALL", "uid_gm"]
    });

    // Notes (party sem ownerId em visibleTo/editableBy, player com sharedWithPlayerIds, gm)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/notes/note_party_bug`).set({
      scope: "party",
      ownerId: "uid_p1",
      visibleTo: ["ALL"],
      editableBy: ["ALL"],
      title: "Nota do Grupo",
      imageMediaId: "med_note_party"
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/notes/note_shared`).set({
      scope: "player",
      ownerId: "uid_p1",
      visibleTo: [],
      editableBy: ["ALL", "uid_p1"],
      sharedWithPlayerIds: ["uid_p2"],
      title: "Nota Privada Compartilhada",
      imageMediaId: "med_note_p1_p2"
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/notes/note_gm`).set({
      scope: "gm",
      ownerId: "uid_gm",
      visibleTo: ["ALL", "uid_p1"],
      editableBy: ["uid_gm"],
      title: "Segredo GM",
      imageMediaId: "med_note_gm"
    });

    // Scenes (A6: visibleToPlayers false com visibleTo ["ALL"] stale!)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/scenes/scene_pub`).set({
      name: "Praça",
      visibleToPlayers: true,
      visibleTo: ["uid_gm"],
      mapImage: { mediaId: "med_scene_pub" }
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/scenes/scene_priv`).set({
      name: "Caverna",
      visibleToPlayers: false,
      visibleTo: ["ALL"],
      mapImage: { mediaId: "med_scene_priv" }
    });

    // Compendium (A6)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/compendium/comp_priv`).set({
      name: "Magia Secreta",
      visibleToPlayers: false,
      visibleTo: ["ALL"]
    });

    // Messages (incluindo mensagem legada Base64 e mídia por senderAvatarMediaId)
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/messages/msg_gm_only`).set({
      senderId: "uid_gm",
      visibility: "gm_only",
      visibleTo: ["uid_gm", "uid_p1"],
      senderAvatarMediaId: "med_msg_gm_p1",
      content: "Sussurro"
    });
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/messages/msg_base64`).set({
      senderId: "uid_p1",
      visibility: "public",
      visibleTo: ["ALL"],
      senderPhotoURL: "data:image/png;base64,iVBORw0KGgo=",
      content: "Legado base64"
    });

    // RTDB tokens (token oculto controlado por p2)
    await connection.database.ref(`vtt_realtime/${CAMPAIGN}/tokens/scene_pub/tok_hidden`).set({
      id: "tok_hidden",
      mediaId: "med_rtdb_hidden",
      ownerId: "uid_gm",
      visibleToPlayers: false,
      controlledBy: { uid_p2: true }
    });

    // Media legadas (sem campaignId, sem byteLength, com sizeBytes/isDeleted/updatedAt e chunks)
    const sampleDataUrl = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4";
    for (const [mid, uploader] of [
      ["med_char_pub", "uid_p1"],
      ["med_tok_pub", "uid_p1"],
      ["med_member_p1", "uid_p1"],
      ["med_note_party", "uid_p1"],
      ["med_note_p1_p2", "uid_p1"],
      ["med_note_gm", "uid_gm"],
      ["med_scene_pub", "uid_gm"],
      ["med_scene_priv", "uid_gm"],
      ["med_msg_gm_p1", "uid_gm"],
      ["med_rtdb_hidden", "uid_gm"],
      ["med_orphan", "uid_p1"]
    ]) {
      await connection.firestore.doc(`campaigns/${CAMPAIGN}/media/${mid}`).set({
        category: mid.startsWith("med_scene") ? "scene" : "avatar",
        mimeType: "image/webp",
        widthPx: 256,
        heightPx: 256,
        sizeBytes: 999,
        isDeleted: false,
        updatedAt: 123,
        dataUrl: sampleDataUrl,
        uploadedBy: uploader
      });
    }
    await connection.firestore.doc(`campaigns/${CAMPAIGN}/media/med_orphan/chunks/0`).set({
      index: 0,
      data: "legacy_chunk"
    });
  });

  afterAll(async () => {
    fs.rmSync(logDir, { recursive: true, force: true });
    await connection?.app?.delete();
  });

  it("dry-run de M002 e M003 planeja sem alterar banco; apply normaliza tudo; re-execução é idempotente e passa em rules", async () => {
    // Primeiro aplica M001 para materializar members
    await runMigrations({
      migrations: [M001Identity],
      connection,
      target,
      apply: true,
      logDir
    });

    // Dry-run M002 + M003
    const dryRun = await runMigrations({
      migrations: [M002Audience, M003Media],
      connection,
      target,
      apply: false,
      logDir
    });
    expect(dryRun[0].planned).toBeGreaterThan(0);
    expect(dryRun[0].applied).toBe(false);
    expect(dryRun[1].planned).toBeGreaterThan(0);
    expect(dryRun[1].applied).toBe(false);

    // Verifica que scene_priv ainda tem visibleToPlayers no dry-run
    const preScene = (
      await connection.firestore.doc(`campaigns/${CAMPAIGN}/scenes/scene_priv`).get()
    ).data();
    expect(preScene.visibleToPlayers).toBe(false);

    // Apply M002 -> M003
    const applied = await runMigrations({
      migrations: [M002Audience, M003Media],
      connection,
      target,
      apply: true,
      logDir
    });
    expect(applied[0].applied).toBe(true);
    expect(applied[1].applied).toBe(true);

    // Verifica M002 resultados e invariantes
    const fsDb = connection.firestore;
    const charPc = (await fsDb.doc(`campaigns/${CAMPAIGN}/characters/char_pc`).get()).data();
    expect(charPc.visibleTo).toEqual(["uid_p1", "ALL"]);
    expect(charPc.editableBy).toEqual(["uid_p1"]);
    expect(assertAudience(charPc, { entityType: "character" }).ok).toBe(true);

    const charFolder = (await fsDb.doc(`campaigns/${CAMPAIGN}/folders/fld_char`).get()).data();
    expect(Object.hasOwn(charFolder, "scope")).toBe(false);
    expect(assertAudience(charFolder, { entityType: "folder" }).ok).toBe(true);

    const gmFolder = (await fsDb.doc(`campaigns/${CAMPAIGN}/folders/fld_gm`).get()).data();
    expect(gmFolder.visibleTo).toEqual([]);
    expect(gmFolder.editableBy).toEqual([]);

    const partyNote = (await fsDb.doc(`campaigns/${CAMPAIGN}/notes/note_party_bug`).get()).data();
    expect(partyNote.visibleTo).toEqual(["ALL", "uid_p1"]);
    expect(partyNote.editableBy).toEqual(["ALL", "uid_p1"]);
    expect(assertAudience(partyNote, { entityType: "note" }).ok).toBe(true);

    const sharedNote = (await fsDb.doc(`campaigns/${CAMPAIGN}/notes/note_shared`).get()).data();
    expect(sharedNote.visibleTo).toEqual(["uid_p1", "uid_p2"]);
    expect(sharedNote.editableBy).toEqual(["uid_p1"]);
    expect(assertAudience(sharedNote, { entityType: "note" }).ok).toBe(true);

    const gmNote = (await fsDb.doc(`campaigns/${CAMPAIGN}/notes/note_gm`).get()).data();
    expect(gmNote.visibleTo).toEqual([]);
    expect(gmNote.editableBy).toEqual([]);

    const pubScene = (await fsDb.doc(`campaigns/${CAMPAIGN}/scenes/scene_pub`).get()).data();
    expect(pubScene.visibleTo).toEqual(["ALL"]);
    expect(Object.hasOwn(pubScene, "visibleToPlayers")).toBe(false);

    const privScene = (await fsDb.doc(`campaigns/${CAMPAIGN}/scenes/scene_priv`).get()).data();
    expect(privScene.visibleTo).toEqual(["uid_gm"]);
    expect(Object.hasOwn(privScene, "visibleToPlayers")).toBe(false);

    const privComp = (await fsDb.doc(`campaigns/${CAMPAIGN}/compendium/comp_priv`).get()).data();
    expect(privComp.visibleTo).toEqual(["uid_gm"]);
    expect(Object.hasOwn(privComp, "visibleToPlayers")).toBe(false);

    // Verifica M003 resultados e schema v2 em media
    const expectedAudiences = {
      med_char_pub: ["ALL"],
      med_tok_pub: ["ALL"],
      med_member_p1: ["ALL"],
      med_note_party: ["ALL"],
      med_note_p1_p2: ["uid_p1", "uid_p2"],
      med_note_gm: ["uid_gm"],
      med_scene_pub: ["ALL"],
      med_scene_priv: ["uid_gm"],
      med_msg_gm_p1: ["uid_gm", "uid_p1"],
      med_rtdb_hidden: ["uid_gm", "uid_p2"],
      med_orphan: ["uid_gm"]
    };

    for (const [mid, expectedVis] of Object.entries(expectedAudiences)) {
      const mData = (await fsDb.doc(`campaigns/${CAMPAIGN}/media/${mid}`).get()).data();
      expect(mData.campaignId).toBe(CAMPAIGN);
      expect(mData.byteLength).toBe(Buffer.byteLength(mData.dataUrl, "utf8"));
      expect(Object.hasOwn(mData, "sizeBytes")).toBe(false);
      expect(Object.hasOwn(mData, "isDeleted")).toBe(false);
      expect(Object.hasOwn(mData, "updatedAt")).toBe(false);
      expect(mData.visibleTo.sort()).toEqual([...expectedVis].sort());
      expect(validateMedia(mData).ok).toBe(true);
    }

    const remainingChunks = await fsDb
      .collection(`campaigns/${CAMPAIGN}/media/med_orphan/chunks`)
      .get();
    expect(remainingChunks.empty).toBe(true);

    // Idempotência: segunda execução planeja 0 operações para M002 e M003
    const rerun = await runMigrations({
      migrations: [M002Audience, M003Media],
      connection,
      target,
      apply: true,
      logDir
    });
    expect(rerun[0].planned).toBe(0);
    expect(rerun[1].planned).toBe(0);

    // Verificação ponta a ponta contra firestore.rules carregado no rules-unit-testing
    const rulesEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
      }
    });
    try {
      const dbP2 = rulesEnv.authenticatedContext("uid_p2", { email_verified: true }).firestore();
      const visibleNotes = await getDocs(
        query(
          collection(dbP2, `campaigns/${CAMPAIGN}/notes`),
          where("visibleTo", "array-contains-any", ["ALL", "uid_p2"]),
          where("isDeleted", "==", false)
        )
      );
      expect(visibleNotes.docs.map((d) => d.id).sort()).toEqual([
        "note_party_bug",
        "note_shared"
      ]);

      // Após assignGM (uid_gm -> uid_p1), o antigo GM consulta notes e folders normalmente sem ver scope="gm"
      await connection.firestore.doc(`campaigns/${CAMPAIGN}`).update({ gmId: "uid_p1" });
      const dbFormerGm = rulesEnv
        .authenticatedContext("uid_gm", { email_verified: true })
        .firestore();
      const formerGmNotes = await getDocs(
        query(
          collection(dbFormerGm, `campaigns/${CAMPAIGN}/notes`),
          where("visibleTo", "array-contains-any", ["ALL", "uid_gm"]),
          where("isDeleted", "==", false)
        )
      );
      expect(formerGmNotes.docs.map((d) => d.id).sort()).toEqual(["note_party_bug"]);

      const formerGmFolders = await getDocs(
        query(
          collection(dbFormerGm, `campaigns/${CAMPAIGN}/folders`),
          where("visibleTo", "array-contains-any", ["ALL", "uid_gm"]),
          where("isDeleted", "==", false)
        )
      );
      expect(formerGmFolders.docs.map((d) => d.id).sort()).toEqual(["fld_char"]);
    } finally {
      await rulesEnv.cleanup();
    }
  });

  const runRealSnapshotTest = fs.existsSync(PHASE0_SNAPSHOT_DIR) ? it : it.skip;
  runRealSnapshotTest(
    "executa M001 → M002 → M003 no snapshot local de produção (dry-run, apply, idempotência e queries em rules)",
    async () => {
      await clearTestEmulatorAuth();
      await connection.database.ref().set(null);
      const colls = await connection.firestore.listCollections();
      for (const col of colls) {
        await connection.firestore.recursiveDelete(col);
      }

      const snap = readSnapshot(PHASE0_SNAPSHOT_DIR);
      const entries = Object.entries(snap.documents);
      for (let i = 0; i < entries.length; i += 400) {
        const batch = connection.firestore.batch();
        for (const [docPath, data] of entries.slice(i, i + 400)) {
          batch.set(connection.firestore.doc(docPath), decodeValue(data, connection.firestore));
        }
        await batch.commit();
      }
      await connection.database.ref("/").set(snap.database ?? null);

      // Dry-run não altera nada
      const dryRun = await runMigrations({
        migrations: [M001Identity, M002Audience, M003Media],
        connection,
        target,
        apply: false,
        logDir,
        log: () => {}
      });
      expect(dryRun.every((r) => r.applied === false && r.planned > 0)).toBe(true);

      // Apply + re-execução idempotente
      const applied = await runMigrations({
        migrations: [M001Identity, M002Audience, M003Media],
        connection,
        target,
        apply: true,
        logDir,
        log: () => {}
      });
      expect(applied.every((r) => r.applied === true)).toBe(true);

      const rerun = await runMigrations({
        migrations: [M001Identity, M002Audience, M003Media],
        connection,
        target,
        apply: true,
        logDir,
        log: () => {}
      });
      expect(rerun.map((r) => r.planned)).toEqual([0, 0, 0]);

      const rulesEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
        }
      });
      try {
        const camps = await connection.firestore.collection("campaigns").get();
        expect(camps.empty).toBe(false);

        for (const campDoc of camps.docs) {
          const cid = campDoc.id;
          const gmId = campDoc.data().gmId;
          for (const colName of ["characters", "folders", "notes", "scenes", "compendium"]) {
            const colSnap = await connection.firestore.collection(`campaigns/${cid}/${colName}`).get();
            for (const d of colSnap.docs) {
              const data = d.data();
              expect(Object.hasOwn(data, "visibleToPlayers")).toBe(false);
              expect(Array.isArray(data.visibleTo)).toBe(true);
            }
          }

          const mediaSnap = await connection.firestore.collection(`campaigns/${cid}/media`).get();
          for (const med of mediaSnap.docs) {
            const md = med.data();
            expect(validateMedia(md).ok).toBe(true);
            expect(Object.hasOwn(md, "sizeBytes")).toBe(false);
            expect(Object.hasOwn(md, "isDeleted")).toBe(false);
            expect((await med.ref.collection("chunks").get()).empty).toBe(true);
          }

          const membersSnap = await connection.firestore.collection(`campaigns/${cid}/members`).get();
          for (const mDoc of membersSnap.docs) {
            const uid = mDoc.id;
            if (uid === gmId) continue;
            const userFs = rulesEnv.authenticatedContext(uid, { email_verified: true }).firestore();
            for (const colName of ["characters", "folders", "notes", "scenes", "compendium"]) {
              const qSnap = await getDocs(
                query(
                  collection(userFs, `campaigns/${cid}/${colName}`),
                  where("isDeleted", "==", false),
                  where("visibleTo", "array-contains-any", ["ALL", uid])
                )
              );
              expect(qSnap.size).toBeGreaterThanOrEqual(0);
            }
          }
        }
      } finally {
        await rulesEnv.cleanup();
      }
    }
  );
});
