// Testes no emulador real: Regras (/folders, /characters.folderId), concorrência/lotes e migração M005-folders.
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
import { AUDIT_VALIDATORS } from "../../scripts/migrations/lib/auditValidators.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";
import M001Identity from "../../scripts/migrations/M001-identity.mjs";
import M002Audience from "../../scripts/migrations/M002-audience.mjs";
import M003Media from "../../scripts/migrations/M003-media.mjs";
import M004CharactersV2 from "../../scripts/migrations/M004-characters-v2.mjs";
import M005Folders from "../../scripts/migrations/M005-folders.mjs";
import M006NotesV2 from "../../scripts/migrations/M006-notes-v2.mjs";
import { normalizeCharacter, toCharacterDoc } from "../../src/domain/models/character.js";
import { FOLDER_DOMAINS } from "../../src/domain/constants.js";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  DEFAULT_CAMPAIGN_ID: "camp_p6"
}));

const folderService = await import("../../src/services/folderService.js");
const runtimeConfigService = await import("../../src/services/runtimeConfigService.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_DIR = path.resolve(
  repoRoot,
  "local-data",
  "snapshots",
  "2026-11-17T12-55-15-040Z-production"
);
const PROJECT_ID = "demo-cpvtt-test";
const CAMPAIGN = "camp_p6";

let env;
let connection;
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-p6-"));

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const fsAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();

async function seedBaseCampaign() {
  await seed(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      gmId: "gm_a",
      name: "Mesa Fase 6"
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

describe("Firestore Rules — Fase 6 (/folders e /characters.folderId)", () => {
  it("A4: editor em editableBy pode renomear, mas não alterar parentId/scope/owner/audience/soft-delete nem usar '/'", async () => {
    await seedBaseCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/f_p2`), {
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Diário Compartilhado",
        parentId: null,
        ownerId: "player2",
        visibleTo: ["ALL", "player2"],
        editableBy: ["ALL", "player2"],
        order: 0,
        isDeleted: false
      });
    });

    const dbP1 = fsAs("player1");
    const ref = doc(dbP1, `campaigns/${CAMPAIGN}/folders/f_p2`);

    // Editor não-dono pode renomear com nome válido sem '/'
    await assertSucceeds(updateDoc(ref, { name: "Renomeado P1" }));

    // Rejeita '/' e nome vazio
    await assertFails(updateDoc(ref, { name: "Ato 1/Cena 2" }));
    await assertFails(updateDoc(ref, { name: "   " }));

    // Rejeita alteração de parentId/audiência/scope/domínio/soft-delete por não-dono
    await assertFails(updateDoc(ref, { parentId: "outra_pasta" }));
    await assertFails(updateDoc(ref, { visibleTo: ["player1", "player2"] }));
    await assertFails(updateDoc(ref, { editableBy: ["player2"] }));
    await assertFails(updateDoc(ref, { scope: "player" }));
    await assertFails(updateDoc(ref, { domain: "character" }));
    await assertFails(updateDoc(ref, { noteType: "quest" }));
    await assertFails(updateDoc(ref, { isDeleted: true }));

    // Rejeita criação com '/' no nome
    await assertFails(
      setDoc(doc(dbP1, `campaigns/${CAMPAIGN}/folders/f_bad`), {
        campaignId: CAMPAIGN,
        domain: "character",
        name: "Sub/Invalida",
        parentId: null,
        ownerId: "player1",
        visibleTo: ["ALL"],
        editableBy: ["player1"],
        isDeleted: false
      })
    );
  });

  it("não-dono em editableBy de ficha não pode alterar folderId; dono pode", async () => {
    await seedBaseCampaign();
    const charDoc = toCharacterDoc(
      normalizeCharacter(
        {
          id: "ch_p2",
          campaignId: CAMPAIGN,
          type: "pc",
          ownerId: "player2",
          visibleTo: ["ALL"],
          editableBy: ["player2", "player1"],
          name: "Pinguim P2",
          folderId: null
        },
        { campaignId: CAMPAIGN, gmId: "gm_a" }
      )
    );
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/characters/ch_p2`), charDoc);
    });

    const dbP1 = fsAs("player1");
    const dbP2 = fsAs("player2");
    const refP1 = doc(dbP1, `campaigns/${CAMPAIGN}/characters/ch_p2`);
    const refP2 = doc(dbP2, `campaigns/${CAMPAIGN}/characters/ch_p2`);

    // Editor pode alterar campo de ficha (ex: bio), mas não folderId
    await assertSucceeds(updateDoc(refP1, { bio: "Editado por P1" }));
    await assertFails(updateDoc(refP1, { folderId: "f_qualquer" }));

    // Dono altera folderId normalmente
    await assertSucceeds(updateDoc(refP2, { folderId: "f_p2_dir" }));
  });

  it("permite reparenting de subpasta de terceiro apenas no batch que exclui o pai (D-2)", async () => {
    await seedBaseCampaign();
    const folders = [
      {
        id: "f_p1_parent",
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Pasta P1",
        parentId: null,
        ownerId: "player1",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        order: 0,
        isDeleted: false
      },
      {
        id: "f_p2_child",
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Subpasta P2",
        parentId: "f_p1_parent",
        ownerId: "player2",
        visibleTo: ["ALL", "player2"],
        editableBy: ["ALL", "player2"],
        order: 0,
        isDeleted: false
      }
    ];

    await seed(async (ctx) => {
      const db = ctx.firestore();
      for (const f of folders) {
        await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/${f.id}`), f);
      }
    });

    const dbP1 = fsAs("player1");

    // Atualização arbitrária de parentId fora do batch de exclusão é bloqueada
    await assertFails(
      updateDoc(doc(dbP1, `campaigns/${CAMPAIGN}/folders/f_p2_child`), {
        parentId: null
      })
    );

    // Exclusão em batch via folderService (mode: "moveToParent") funciona via getAfter()
    await assertSucceeds(
      folderService.deleteFolder({
        firestoreDb: dbP1,
        campaignId: CAMPAIGN,
        user: { uid: "player1" },
        isGM: false,
        folderId: "f_p1_parent",
        mode: "moveToParent",
        folders,
        items: []
      })
    );

    const parentSnap = await getDoc(doc(dbP1, `campaigns/${CAMPAIGN}/folders/f_p1_parent`));
    const childSnap = await getDoc(doc(dbP1, `campaigns/${CAMPAIGN}/folders/f_p2_child`));
    expect(parentSnap.data().isDeleted).toBe(true);
    expect(childSnap.data().parentId).toBeNull();
  });
});

describe("Codex — reproduções reais no emulador via folderService", () => {
  it("bloqueia ciclo em moveFolder e promove subpasta alheia em deleteAll (D-3)", async () => {
    await seedBaseCampaign();
    const seededFolders = [
      {
        id: "f_gm_root",
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Raiz Sobrevivente",
        parentId: null,
        ownerId: "gm_a",
        visibleTo: ["ALL", "gm_a"],
        editableBy: ["ALL", "gm_a"],
        order: 0,
        isDeleted: false
      },
      {
        id: "f_p1_mid",
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Pasta P1",
        parentId: "f_gm_root",
        ownerId: "player1",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        order: 0,
        isDeleted: false
      },
      {
        id: "f_p2_leaf",
        campaignId: CAMPAIGN,
        domain: "journal",
        scope: "party",
        noteType: "lore",
        name: "Subpasta P2",
        parentId: "f_p1_mid",
        ownerId: "player2",
        visibleTo: ["ALL", "player2"],
        editableBy: ["ALL", "player2"],
        order: 0,
        isDeleted: false
      }
    ];

    await seed(async (ctx) => {
      const db = ctx.firestore();
      for (const f of seededFolders) {
        await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/${f.id}`), f);
      }
    });

    const dbGm = fsAs("gm_a");
    await expect(
      folderService.moveFolder({
        firestoreDb: dbGm,
        campaignId: CAMPAIGN,
        user: { uid: "gm_a" },
        isGM: true,
        gmId: "gm_a",
        folderId: "f_gm_root",
        targetParentId: "f_p2_leaf",
        folders: seededFolders
      })
    ).rejects.toMatchObject({ code: "CYCLE_DETECTED" });

    const rootAfterCycle = await getDoc(doc(dbGm, `campaigns/${CAMPAIGN}/folders/f_gm_root`));
    expect(rootAfterCycle.data().parentId).toBeNull();

    // Player1 exclui f_p1_mid em deleteAll: f_p2_leaf (outro dono) sobrevive e sobe para f_gm_root
    const dbP1 = fsAs("player1");
    await assertSucceeds(
      folderService.deleteFolder({
        firestoreDb: dbP1,
        campaignId: CAMPAIGN,
        user: { uid: "player1" },
        isGM: false,
        folderId: "f_p1_mid",
        mode: "deleteAll",
        folders: seededFolders,
        items: []
      })
    );

    const midAfter = await getDoc(doc(dbGm, `campaigns/${CAMPAIGN}/folders/f_p1_mid`));
    const leafAfter = await getDoc(doc(dbGm, `campaigns/${CAMPAIGN}/folders/f_p2_leaf`));
    expect(midAfter.data().isDeleted).toBe(true);
    expect(leafAfter.data().isDeleted).toBe(false);
    expect(leafAfter.data().parentId).toBe("f_gm_root");
  });
});

describe("M005-folders e audit-v2 em fixture complexa v1 e snapshot real", () => {
  it("migra fixture v1 complexa (legados, paths '/', ciclos, refs cruzadas) com 0 violações e idempotência", async () => {
    const colls = await connection.firestore.listCollections();
    for (const col of colls) await connection.firestore.recursiveDelete(col);

    await connection.firestore.doc("campaigns/c_m5").set({
      name: "Mesa M005",
      gmId: "gm1"
    });

    // Pasta legada dentro de characters/
    await connection.firestore.doc("campaigns/c_m5/characters/fld_char_p1").set({
      id: "fld_char_p1",
      name: "Aliados/Norte",
      isFolder: true,
      ownerId: "p1",
      visibleTo: ["ALL"],
      editableBy: ["p1"],
      isDeleted: false
    });

    const mkValidChar = (id, ownerId, folderId) => ({
      ...toCharacterDoc(
        normalizeCharacter(
          {
            id,
            campaignId: "c_m5",
            type: ownerId === "gm1" ? "npc" : "pc",
            ownerId,
            visibleTo: ownerId === "gm1" ? ["gm1"] : ["ALL", ownerId],
            editableBy: [ownerId],
            name: `Char ${id}`,
            folderId
          },
          { campaignId: "c_m5", gmId: "gm1" }
        )
      ),
      folderId
    });

    await connection.firestore.doc("campaigns/c_m5/characters/ch_ok").set(
      mkValidChar("ch_ok", "p1", "fld_char_p1")
    );
    await connection.firestore.doc("campaigns/c_m5/characters/ch_cross").set(
      mkValidChar("ch_cross", "p2", "fld_char_p1")
    );
    await connection.firestore.doc("campaigns/c_m5/characters/ch_dangling").set(
      mkValidChar("ch_dangling", "p1", "fld_inexistente")
    );

    // Pastas com ciclo em folders/
    await connection.firestore.doc("campaigns/c_m5/folders/f_cyc_a").set({
      id: "f_cyc_a",
      campaignId: "c_m5",
      folderType: "character",
      isFolder: true,
      name: "Ciclo A",
      title: "Ciclo A",
      parentId: "f_cyc_b",
      ownerId: "gm1",
      visibleTo: ["ALL"],
      editableBy: ["gm1"],
      isDeleted: false
    });
    await connection.firestore.doc("campaigns/c_m5/folders/f_cyc_b").set({
      id: "f_cyc_b",
      campaignId: "c_m5",
      folderType: "character",
      name: "Ciclo B",
      parentId: "f_cyc_a",
      ownerId: "gm1",
      visibleTo: ["ALL"],
      editableBy: ["gm1"],
      isDeleted: false
    });

    // Pasta legada dentro de notes/ com caminho "Ato 1/Taverna"
    await connection.firestore.doc("campaigns/c_m5/notes/fld_note_party").set({
      id: "fld_note_party",
      campaignId: "c_m5",
      isFolder: true,
      scope: "party",
      noteType: "lore",
      name: "Ato 1/Taverna",
      title: "Ato 1/Taverna",
      ownerId: "gm1",
      visibleTo: ["ALL"],
      editableBy: ["ALL", "gm1"],
      isDeleted: false
    });

    // Notas em escopos diferentes com nomes de caminho parecidos (não devem colidir)
    await connection.firestore.doc("campaigns/c_m5/notes/n_party").set({
      id: "n_party",
      campaignId: "c_m5",
      scope: "party",
      noteType: "lore",
      folder: "Ato 1/Taverna",
      title: "Taverneiro",
      content: "História preservada",
      ownerId: "gm1",
      visibleTo: ["ALL"],
      editableBy: ["ALL", "gm1"],
      isDeleted: false
    });
    await connection.firestore.doc("campaigns/c_m5/notes/n_player").set({
      id: "n_player",
      campaignId: "c_m5",
      scope: "player",
      noteType: "lore",
      folder: "Ato 1/Taverna/Sala Secreta",
      title: "Segredo P1",
      content: "Diário preservado",
      ownerId: "p1",
      visibleTo: ["p1"],
      editableBy: ["p1"],
      isDeleted: false
    });

    const [sim] = await runMigrations({
      migrations: [M005Folders],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      logDir,
      log: () => {}
    });
    expect(sim.applied).toBe(false);
    expect(sim.summary.legacyCharacterFoldersMigrated).toBe(1);
    expect(sim.summary.legacyNoteFoldersMigrated).toBe(1);
    expect(sim.summary.folderCyclesBroken).toBeGreaterThanOrEqual(1);
    expect(sim.summary.characterFolderIdsReset).toBe(2);

    const [applied] = await runMigrations({
      migrations: [M005Folders],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(applied.applied).toBe(true);

    // Legados dentro de characters/ e notes/ foram removidos
    expect((await connection.firestore.doc("campaigns/c_m5/characters/fld_char_p1").get()).exists).toBe(false);
    expect((await connection.firestore.doc("campaigns/c_m5/notes/fld_note_party").get()).exists).toBe(false);

    // Personagens válidos vs resetados
    expect((await connection.firestore.doc("campaigns/c_m5/characters/ch_ok").get()).data().folderId).toBe("fld_char_p1");
    expect((await connection.firestore.doc("campaigns/c_m5/characters/ch_cross").get()).data().folderId).toBeNull();
    expect((await connection.firestore.doc("campaigns/c_m5/characters/ch_dangling").get()).data().folderId).toBeNull();

    // Pastas migradas & hierarquia do diário por escopo separado
    const migratedCharFolder = (await connection.firestore.doc("campaigns/c_m5/folders/fld_char_p1").get()).data();
    expect(migratedCharFolder.domain).toBe(FOLDER_DOMAINS.CHARACTER);
    expect(migratedCharFolder.name).toBe("Aliados - Norte");
    expect(migratedCharFolder).not.toHaveProperty("scope");
    expect(migratedCharFolder).not.toHaveProperty("isFolder");

    const partyLeafFolder = (await connection.firestore.doc("campaigns/c_m5/folders/fld_note_party").get()).data();
    expect(partyLeafFolder.domain).toBe(FOLDER_DOMAINS.JOURNAL);
    expect(partyLeafFolder.name).toBe("Taverna");
    expect(partyLeafFolder.parentId).toMatch(/^folder_/);

    const nParty = (await connection.firestore.doc("campaigns/c_m5/notes/n_party").get()).data();
    const nPlayer = (await connection.firestore.doc("campaigns/c_m5/notes/n_player").get()).data();
    expect(nParty.folderId).toBe("fld_note_party");
    expect(nPlayer.folderId).toMatch(/^folder_/);
    expect(nPlayer.folderId).not.toBe(nParty.folderId);
    expect(nParty).not.toHaveProperty("folder");
    expect(nPlayer).not.toHaveProperty("folder");
    expect(nParty.content).toBe("História preservada");

    // Auditoria global v2 (pré-M006): 0 violações nos validadores até a Fase 6
    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData(
      { source: "emulator", documents },
      AUDIT_VALIDATORS.filter((v) => v.id !== "note-v2")
    );
    expect(audit.report.samples).toEqual([]);
    expect(audit.report.violations).toBe(0);

    // Segunda execução idempotente
    const [second] = await runMigrations({
      migrations: [M005Folders],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  });

  it("executa M001 → M005 no snapshot real de produção com 0 violações em audit-v2 e idempotência", async () => {
    if (!fs.existsSync(SNAPSHOT_DIR)) return;
    const colls = await connection.firestore.listCollections();
    for (const col of colls) await connection.firestore.recursiveDelete(col);

    const snap = readSnapshot(SNAPSHOT_DIR);
    for (const [docPath, raw] of Object.entries(snap.documents)) {
      await connection.firestore.doc(docPath).set(decodeValue(raw, connection.firestore));
    }

    const firstRun = await runMigrations({
      migrations: [M001Identity, M002Audience, M003Media, M004CharactersV2, M005Folders, M006NotesV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });

    const m005Result = firstRun.find((r) => r.id === "M005-folders");
    expect(m005Result.summary.legacyCharacterFoldersMigrated).toBeGreaterThanOrEqual(2);
    expect(m005Result.summary.legacyNoteFoldersMigrated).toBeGreaterThanOrEqual(1);
    expect(m005Result.summary.notesUpdated).toBeGreaterThanOrEqual(6);

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({ source: "emulator-snapshot", documents });
    expect(audit.report.violations).toBe(0);

    const [secondM005] = await runMigrations({
      migrations: [M005Folders],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(secondM005.planned).toBe(0);
  });
});
