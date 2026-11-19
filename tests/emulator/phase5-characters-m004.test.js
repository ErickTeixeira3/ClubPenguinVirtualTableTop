// Testes no emulador real: regras de Firestore, concorrência/idempotência e migração M004-characters-v2.
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
import { readAllFirestoreDocuments, readSnapshot } from "../../scripts/lib/snapshot.mjs";
import { evaluateAuditData } from "../../scripts/migrations/audit-v2.mjs";
import { runMigrations } from "../../scripts/migrations/lib/runner.mjs";
import M001Identity from "../../scripts/migrations/M001-identity.mjs";
import M002Audience from "../../scripts/migrations/M002-audience.mjs";
import M003Media from "../../scripts/migrations/M003-media.mjs";
import M004CharactersV2 from "../../scripts/migrations/M004-characters-v2.mjs";
import M005Folders from "../../scripts/migrations/M005-folders.mjs";
import M006NotesV2 from "../../scripts/migrations/M006-notes-v2.mjs";
import { normalizeCharacter, toCharacterDoc } from "../../src/domain/models/character.js";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  DEFAULT_CAMPAIGN_ID: "camp_p5"
}));

const characterService = await import("../../src/services/characterService.js");
const runtimeConfigService = await import("../../src/services/runtimeConfigService.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_DIR = path.resolve(
  repoRoot,
  "local-data",
  "snapshots",
  "2026-11-17T12-55-15-040Z-production"
);
const PROJECT_ID = "demo-cpvtt-test";
const CAMPAIGN = "camp_p5";

let env;
let connection;
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-p5-"));

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const fsAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();

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

async function seedCampaignAndChar() {
  const baseChar = normalizeCharacter(
    {
      id: "pc_1",
      campaignId: CAMPAIGN,
      type: "pc",
      ownerId: "player1",
      visibleTo: ["gm_a", "player1", "player2"],
      editableBy: ["gm_a", "player1", "player2"],
      name: "Pinguim Concorrente",
      resources: { hp: { current: 10, max: 20 }, mp: { current: 15, max: 15 } },
      rollGroups: {
        rg1: {
          id: "rg1",
          name: "Geral",
          order: 0,
          rolls: {
            r_cut: { id: "r_cut", order: 0, source: { type: "custom", id: null }, overrides: { name: "Corte", icon: "sword" }, custom: { hitFormula: "1d20", effectFormula: "", rollKind: "attack", effectType: "damage", cost: { resource: "mp", amount: 0 }, savingThrow: { enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" } } }
          }
        }
      },
      hotbar: { "1": { rollGroupId: "rg1", rollId: "r_cut" } }
    },
    { campaignId: CAMPAIGN, gmId: "gm_a" }
  );

  await seed(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      gmId: "gm_a",
      name: "Mesa Concorrência"
    });
    for (const uid of ["gm_a", "player1", "player2"]) {
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/members/${uid}`), {
        uid,
        campaignId: CAMPAIGN,
        displayName: uid,
        avatar: { mediaId: null, url: null }
      });
    }
    await setDoc(doc(db, `campaigns/${CAMPAIGN}/characters/pc_1`), toCharacterDoc(baseChar));
  });

  return baseChar;
}

describe("Regras de Segurança Firestore — characters e compendium (Fase 5)", () => {
  it("quem só edita (editableBy) pode alterar notas, mas não ownerId, visibleTo, editableBy nem type", async () => {
    await seedCampaignAndChar();
    const editorDb = fsAs("player2");
    const ref = doc(editorDb, `campaigns/${CAMPAIGN}/characters/pc_1`);

    await assertSucceeds(updateDoc(ref, { notes: "Atualizado por editor" }));
    await assertFails(updateDoc(ref, { ownerId: "player2" }));
    await assertFails(updateDoc(ref, { visibleTo: ["ALL"] }));
    await assertFails(updateDoc(ref, { editableBy: ["player1"] }));
    await assertFails(updateDoc(ref, { type: "npc" }));

    const compendiumRef = doc(editorDb, `campaigns/${CAMPAIGN}/compendium/ce_bad`);
    await assertFails(setDoc(compendiumRef, { name: "Cheat", visibleTo: ["ALL"] }));
  });
});

describe("Concorrência e Idempotência em Emulator real — characterService", () => {
  it("dois clientes adicionando habilidades distintas preservam ambas e delta simultâneo soma exato", async () => {
    const baseChar = await seedCampaignAndChar();
    const dbClientA = fsAs("player1");
    const dbClientB = fsAs("player2");

    await Promise.all([
      characterService.addEntry({
        firestoreDb: dbClientA,
        campaignId: CAMPAIGN,
        charId: "pc_1",
        collectionName: "abilities",
        entry: { id: "ab_a", name: "Golpe A", hitFormula: "1d20" },
        currentChar: baseChar
      }),
      characterService.addEntry({
        firestoreDb: dbClientB,
        campaignId: CAMPAIGN,
        charId: "pc_1",
        collectionName: "abilities",
        entry: { id: "ab_b", name: "Golpe B", hitFormula: "1d20" },
        currentChar: baseChar
      })
    ]);

    await Promise.all([
      characterService.applyResourceDelta({
        firestoreDb: dbClientA,
        campaignId: CAMPAIGN,
        charId: "pc_1",
        resourceKey: "hp",
        delta: -2,
        opId: "op_dmg_a"
      }),
      characterService.applyResourceDelta({
        firestoreDb: dbClientB,
        campaignId: CAMPAIGN,
        charId: "pc_1",
        resourceKey: "hp",
        delta: -3,
        opId: "op_dmg_b"
      })
    ]);

    // Repetir o mesmo opId não aplica de novo nem altera rev
    const dup = await characterService.applyResourceDelta({
      firestoreDb: dbClientA,
      campaignId: CAMPAIGN,
      charId: "pc_1",
      resourceKey: "hp",
      delta: -2,
      opId: "op_dmg_a"
    });
    expect(dup.duplicate).toBe(true);

    const finalSnap = await getDoc(doc(dbClientA, `campaigns/${CAMPAIGN}/characters/pc_1`));
    const finalData = finalSnap.data();
    expect(Object.keys(finalData.abilities).sort()).toEqual(["ab_a", "ab_b"]);
    expect(finalData.resources.hp.current).toBe(5);
    expect(finalData.rev).toBe(4);
  });

  it("removeEntry de rolagem limpa o slot correspondente na hotbar", async () => {
    await seedCampaignAndChar();
    const dbClient = fsAs("player1");

    await characterService.removeEntry({
      firestoreDb: dbClient,
      campaignId: CAMPAIGN,
      charId: "pc_1",
      collectionName: "rolls",
      entryKey: "r_cut",
      rollGroupId: "rg1"
    });

    const snap = await getDoc(doc(dbClient, `campaigns/${CAMPAIGN}/characters/pc_1`));
    expect(snap.data().hotbar["1"]).toBeNull();
  });
});

describe("M004-characters-v2 e audit-v2 em fixture v1 e snapshot de produção", () => {
  it("migra fixture v1 com colisões de perícia, órfãos na hotbar, ícones explícitos e idempotência", async () => {
    const colls = await connection.firestore.listCollections();
    for (const col of colls) await connection.firestore.recursiveDelete(col);

    await connection.firestore.doc("campaigns/c_fix").set({ name: "Mesa Fix", gmId: "gm1" });
    await connection.firestore.doc("campaigns/c_fix/characters/ch_gm_pc").set({
      id: "ch_gm_pc",
      name: "Vilão",
      type: "pc",
      ownerId: "gm1",
      visibleTo: ["gm1"],
      editableBy: ["gm1"],
      avatarMediaId: "med1",
      defaultToken: { mediaId: "med_t1", sizeInCells: 2, showName: false },
      attributes: [{ key: "forca", label: "Força", value: 4 }],
      skills: [
        { id: "sk_dup", name: "Força", attribute: "forca", bonus: 2 },
        { id: "sk_res", name: "HP", attribute: "forca", bonus: 1 }
      ],
      abilities: [{ id: "ab1", name: "Bola de Fogo" }],
      inventory: [
        { id: "it1", name: "Peixe-espada", icon: "sword", formula: "1d6" },
        { id: "it2", name: "Peixe fresco", formula: "" }
      ],
      rollGroups: [
        {
          id: "g1",
          name: "Geral",
          rolls: [
            { id: "r1", sourceType: "skill", sourceId: "sk_dup", name: "Força" },
            { id: "r2", sourceType: "ability", sourceId: "ab1", name: "Bola de Fogo" }
          ]
        }
      ],
      hotbar: [
        { rollId: "r2" },
        { rollId: "r_inexistente" }
      ]
    });
    await connection.firestore.doc("campaigns/c_fix/compendium/comp1").set({
      name: "Machado Gelado",
      type: "ability",
      costResource: "mp",
      costAmount: 3,
      rangeType: "touch",
      aoeType: "cone",
      aoeRadiusMeters: 6,
      coneAngleDeg: 60,
      rollFormula: "3d6",
      saveEnabled: true,
      saveDc: "14",
      saveAttribute: "vigor",
      saveEffect: "Congela",
      visibleTo: ["ALL"],
      visibleToPlayers: true
    });

    const [sim] = await runMigrations({
      migrations: [M004CharactersV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      logDir,
      log: () => {}
    });
    expect(sim.applied).toBe(false);
    expect(sim.summary.gmTypeFixedToNpc).toBe(1);
    expect(sim.summary.skillKeyCollisions).toBe(2);
    expect(sim.summary.collisionReport).toEqual([
      {
        path: "campaigns/c_fix/characters/ch_gm_pc",
        legacySkillId: "sk_dup",
        originalKey: "forca",
        resolvedKey: "forca_2",
        reason: "attribute_collision"
      },
      {
        path: "campaigns/c_fix/characters/ch_gm_pc",
        legacySkillId: "sk_res",
        originalKey: "hp",
        resolvedKey: "hp_2",
        reason: "reserved_key"
      }
    ]);
    expect(sim.summary.orphanHotbarSlotsCleared).toBe(1);

    const [applied] = await runMigrations({
      migrations: [M004CharactersV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(applied.applied).toBe(true);

    const migratedChar = (await connection.firestore.doc("campaigns/c_fix/characters/ch_gm_pc").get()).data();
    expect(migratedChar.type).toBe("npc");
    expect(migratedChar.inventory.it1.icon).toBe("sword");
    expect(migratedChar.inventory.it1.rollFormula).toBe("1d6");
    expect(migratedChar.inventory.it2.icon).toBe("fluffy_fish");
    expect(migratedChar.skills.forca).toBeUndefined();
    expect(migratedChar.skills.hp).toBeUndefined();
    expect(migratedChar.hotbar["1"]).toEqual({ rollGroupId: "g1", rollId: "r2" });
    expect(migratedChar.hotbar["2"]).toBeNull();
    expect(migratedChar).not.toHaveProperty("defaultToken");

    const migratedComp = (await connection.firestore.doc("campaigns/c_fix/compendium/comp1").get()).data();
    expect(migratedComp.aoe).toEqual({ type: "cone", radiusMeters: 6, coneAngleDeg: 60 });
    expect(migratedComp.effectFormula).toBe("3d6");
    expect(migratedComp).not.toHaveProperty("coneAngleDeg");
    expect(migratedComp).not.toHaveProperty("rollFormula");
    expect(migratedComp).not.toHaveProperty("visibleToPlayers");

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({ source: "emulator", documents });
    expect(audit.report.violations).toBe(0);

    const [second] = await runMigrations({
      migrations: [M004CharactersV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  });

  it("roda M001 → M004 no snapshot real de produção com 0 violações em audit-v2", async () => {
    if (!fs.existsSync(SNAPSHOT_DIR)) return;
    const colls = await connection.firestore.listCollections();
    for (const col of colls) await connection.firestore.recursiveDelete(col);

    const snap = readSnapshot(SNAPSHOT_DIR);
    for (const [docPath, raw] of Object.entries(snap.documents)) {
      const { decodeValue } = await import("../../scripts/lib/snapshot.mjs");
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
    const m004Summary = firstRun.find((r) => r.id === "M004-characters-v2");
    expect(m004Summary.summary.charactersScanned).toBe(5);
    expect(m004Summary.summary.gmTypeFixedToNpc).toBeGreaterThanOrEqual(2);
    expect(m004Summary.summary.compendiumScanned).toBe(1);

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({ source: "emulator-snapshot", documents });
    expect(audit.report.violations).toBe(0);

    const secondM004 = await runMigrations({
      migrations: [M004CharactersV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(secondM004[0].planned).toBe(0);
  });
});
