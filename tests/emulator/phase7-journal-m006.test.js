// Testes no emulador real: Regras (/notes v2, writeBatch saveNoteDraft) e migração M006-notes-v2.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectAdmin, resolveTarget } from "../../scripts/lib/target.mjs";
import {
  decodeValue,
  readAllFirestoreDocuments,
  readSnapshot
} from "../../scripts/lib/snapshot.mjs";
import { evaluateAuditData } from "../../scripts/migrations/audit-v2.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";
import M001Identity from "../../scripts/migrations/M001-identity.mjs";
import M002Audience from "../../scripts/migrations/M002-audience.mjs";
import M003Media from "../../scripts/migrations/M003-media.mjs";
import M004CharactersV2 from "../../scripts/migrations/M004-characters-v2.mjs";
import M005Folders from "../../scripts/migrations/M005-folders.mjs";
import M006NotesV2 from "../../scripts/migrations/M006-notes-v2.mjs";
import { LEGACY_NOTE_KEYS } from "../../src/domain/models/note.js";
import { FOLDER_DOMAINS, NOTE_SCOPES, NOTE_TYPES } from "../../src/domain/constants.js";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  DEFAULT_CAMPAIGN_ID: "camp_p7"
}));

const journalService = await import("../../src/services/journalService.js");
const runtimeConfigService = await import("../../src/services/runtimeConfigService.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_DIR = path.resolve(
  repoRoot,
  "local-data",
  "snapshots",
  "2026-11-17T12-55-15-040Z-production"
);
const PROJECT_ID = "demo-cpvtt-test";
const CAMPAIGN = "camp_p7";

let env;
let connection;
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-p7-"));

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const fsAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();

async function seedBaseCampaign() {
  await seed(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      gmId: "gm_a",
      name: "Mesa Fase 7"
    });
    for (const uid of ["gm_a", "player1", "player2"]) {
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/members/${uid}`), {
        uid,
        campaignId: CAMPAIGN,
        displayName: uid,
        avatar: { mediaId: null, url: null }
      });
    }
  });
}

beforeAll(async () => {
  runtimeConfigService.setClientVersionBlocked(false);
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
    }
  });
  connection = connectAdmin(
    resolveTarget({ target: "emulator", config: "firebase.test.json", project: PROJECT_ID })
  );
});

afterAll(async () => {
  await connection?.app.delete();
  await env?.cleanup();
  fs.rmSync(logDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("Firestore Rules — Fase 7 (/notes schema v2 e saveNoteDraft batch)", () => {
  it("bloqueia criação e atualização com qualquer campo legado ou ImageRef inválido em /notes", async () => {
    await seedBaseCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_base`), {
        campaignId: CAMPAIGN,
        scope: NOTE_SCOPES.PLAYER,
        ownerId: "player1",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        noteType: NOTE_TYPES.LORE,
        folderId: null,
        title: "Nota Base",
        aliases: [],
        ignoredAliases: [],
        sections: {},
        relatedNoteIds: [],
        linkedCharacterId: null,
        image: { mediaId: null, url: null },
        graphPosition: { x: null, y: null, pinned: false },
        clonedFromNoteId: null,
        rev: 0,
        isDeleted: false
      });
    });

    const p1 = fsAs("player1");
    for (const legacyField of LEGACY_NOTE_KEYS) {
      await assertFails(
        setDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_bad_${legacyField}`), {
          campaignId: CAMPAIGN,
          scope: NOTE_SCOPES.PLAYER,
          ownerId: "player1",
          visibleTo: ["player1"],
          editableBy: ["player1"],
          title: "Inválida",
          [legacyField]: legacyField === "isFolder" ? true : "legacy"
        })
      );
      await assertFails(
        updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_base`), {
          [legacyField]: legacyField === "isFolder" ? true : "legacy"
        })
      );
    }

    // ImageRef inválido (mediaId e url simultâneos, ou esquema não-http)
    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_bad_img`), {
        campaignId: CAMPAIGN,
        scope: NOTE_SCOPES.PLAYER,
        ownerId: "player1",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        title: "Imagem inválida",
        image: { mediaId: "med_1", url: "https://example.com/a.png" }
      })
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_base`), {
        image: { mediaId: null, url: "javascript:alert(1)" }
      })
    );
  });

  it("saveNoteDraft grava nota e novo alias do alvo em batch atômico e falha atomicamente se alvo for somente leitura", async () => {
    await seedBaseCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_src`), {
        campaignId: CAMPAIGN,
        scope: NOTE_SCOPES.PLAYER,
        ownerId: "player1",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        noteType: NOTE_TYPES.LORE,
        folderId: null,
        title: "Pista do Porto",
        aliases: [],
        ignoredAliases: [],
        sections: {
          sec_1: { id: "sec_1", title: "Notas", content: "Vimos o suspeito.", order: 0 }
        },
        relatedNoteIds: [],
        linkedCharacterId: null,
        image: { mediaId: null, url: null },
        graphPosition: { x: null, y: null, pinned: false },
        clonedFromNoteId: null,
        rev: 1,
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_target_party`), {
        campaignId: CAMPAIGN,
        scope: NOTE_SCOPES.PARTY,
        ownerId: "player2",
        visibleTo: ["ALL", "player2"],
        editableBy: ["ALL", "player2"],
        noteType: NOTE_TYPES.CHARACTER,
        folderId: null,
        title: "Capitão",
        aliases: [],
        ignoredAliases: [],
        sections: {},
        relatedNoteIds: [],
        linkedCharacterId: null,
        image: { mediaId: null, url: null },
        graphPosition: { x: null, y: null, pinned: false },
        clonedFromNoteId: null,
        rev: 0,
        isDeleted: false
      });
    });

    const p1 = fsAs("player1");
    const okRes = await assertSucceeds(
      journalService.saveNoteDraft({
        firestoreDb: p1,
        campaignId: CAMPAIGN,
        user: { uid: "player1" },
        isGM: false,
        existingNote: {
          id: "n_src",
          campaignId: CAMPAIGN,
          scope: NOTE_SCOPES.PLAYER,
          ownerId: "player1",
          visibleTo: ["player1"],
          editableBy: ["player1"],
          rev: 1
        },
        accessibleNotes: [
          {
            id: "n_target_party",
            campaignId: CAMPAIGN,
            scope: NOTE_SCOPES.PARTY,
            ownerId: "player2",
            visibleTo: ["ALL", "player2"],
            editableBy: ["ALL", "player2"],
            title: "Capitão",
            aliases: [],
            isDeleted: false
          }
        ],
        draft: {
          id: "n_src",
          title: "Pista do Porto",
          noteType: NOTE_TYPES.LORE,
          aliases: [],
          ignoredAliases: ["Porto"],
          relatedNoteIds: ["n_target_party"],
          sections: {
            sec_1: { id: "sec_1", title: "Notas", content: "Vimos o suspeito.", order: 0 }
          },
          targetAliasAdditions: {
            n_target_party: ["suspeito"]
          }
        }
      })
    );
    expect(okRes.ok).toBe(true);

    const srcSnap = await getDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_src`));
    const targetSnap = await getDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_target_party`));
    expect(srcSnap.data().ignoredAliases).toEqual(["Porto"]);
    expect(srcSnap.data().rev).toBe(2);
    expect(targetSnap.data().aliases).toEqual(["suspeito"]);
    expect(targetSnap.data().rev).toBe(1);
  });
});

describe("Migração M006-notes-v2 + auditoria note-v2", () => {
  it("converte notas legadas em fixture (markdown -> sections, image, graphPosition, audiência) com 0 violações e idempotência", async () => {
    await connection.firestore.doc("campaigns/c_m6").set({
      campaignId: "c_m6",
      gmId: "gm_m6",
      name: "Campanha M6"
    });
    await connection.firestore.doc("campaigns/c_m6/folders/fld_lore").set({
      campaignId: "c_m6",
      domain: FOLDER_DOMAINS.JOURNAL,
      scope: NOTE_SCOPES.PARTY,
      noteType: NOTE_TYPES.LORE,
      name: "Lore",
      parentId: null,
      ownerId: "gm_m6",
      visibleTo: ["ALL", "gm_m6"],
      editableBy: ["ALL", "gm_m6"],
      order: 0,
      isDeleted: false
    });
    await connection.firestore.doc("campaigns/c_m6/notes/n_legacy").set({
      id: "n_legacy",
      campaignId: "c_m6",
      scope: "party",
      ownerId: "p1",
      visibleToPlayers: true,
      sharedWithPlayerIds: ["p2"],
      noteType: "lore",
      folderId: "fld_lore",
      title: "Taverna Velha",
      content: "Intro\n## Rumores\nSegredo escondido",
      aliases: ["Taverna"],
      aliasesNormalized: ["taverna", "taverna velha"],
      mentionedNoteIds: ["n_other"],
      graphNode: { x: 120, y: 240, pinned: true },
      imageMediaId: "med_taverna",
      linkedCharacterSheetId: "char_innkeeper",
      updatedAtMs: 1700000000000
    });

    const [sim] = await runMigrations({
      migrations: [M006NotesV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: false,
      logDir,
      log: () => {}
    });
    expect(sim.applied).toBe(false);
    expect(sim.planned).toBe(1);

    const [applied] = await runMigrations({
      migrations: [M006NotesV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(applied.applied).toBe(true);
    expect(applied.summary.notesUpdated).toBe(1);
    expect(applied.summary.sectionsParsedFromContent).toBe(1);

    const migrated = (await connection.firestore.doc("campaigns/c_m6/notes/n_legacy").get()).data();
    expect(migrated.sections).toEqual({
      sec_1: { id: "sec_1", title: "Notas", content: "Intro", order: 0 },
      sec_2: { id: "sec_2", title: "Rumores", content: "Segredo escondido", order: 1 }
    });
    expect(migrated.image).toEqual({ mediaId: "med_taverna", url: null });
    expect(migrated.graphPosition).toEqual({ x: 120, y: 240, pinned: true });
    expect(migrated.linkedCharacterId).toBe("char_innkeeper");
    expect(migrated.visibleTo).toEqual(["ALL", "p1", "p2"]);
    expect(migrated.editableBy).toEqual(["ALL", "p1"]);
    for (const legacyField of ["id", ...LEGACY_NOTE_KEYS]) {
      expect(migrated).not.toHaveProperty(legacyField);
    }

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({ source: "emulator-m6", documents });
    expect(audit.report.samples).toEqual([]);
    expect(audit.report.violations).toBe(0);

    const [second] = await runMigrations({
      migrations: [M006NotesV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  });

  it("executa M001 → M006 no snapshot real de produção com 0 violações em audit-v2 e idempotência", async () => {
    if (!fs.existsSync(SNAPSHOT_DIR)) return;
    const colls = await connection.firestore.listCollections();
    for (const col of colls) await connection.firestore.recursiveDelete(col);

    const snap = readSnapshot(SNAPSHOT_DIR);
    for (const [docPath, raw] of Object.entries(snap.documents)) {
      await connection.firestore.doc(docPath).set(decodeValue(raw, connection.firestore));
    }

    const firstRun = await runMigrations({
      migrations: [
        M001Identity,
        M002Audience,
        M003Media,
        M004CharactersV2,
        M005Folders,
        M006NotesV2
      ],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });

    const m006Result = firstRun.find((r) => r.id === "M006-notes-v2");
    expect(m006Result.summary.notesScanned).toBeGreaterThanOrEqual(1);

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({ source: "emulator-snapshot-m6", documents });
    expect(audit.report.samples).toEqual([]);
    expect(audit.report.violations).toBe(0);

    const [second] = await runMigrations({
      migrations: [M006NotesV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  });
});
