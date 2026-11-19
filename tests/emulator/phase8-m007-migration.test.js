// Testes no emulador real: Migração M007-rtdb-v2 e auditoria rtdb-v2
// (fixture v1 sintética completa + cadeia M001 -> M007 no snapshot real de produção).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import M007RtdbV2 from "../../scripts/migrations/M007-rtdb-v2.mjs";
import { CHARACTER_TYPES, LAYER_NAMES, TOKEN_KINDS } from "../../src/domain/constants.js";
import { normalizeCharacter, toCharacterDoc } from "../../src/domain/models/character.js";
import { LEGACY_TOKEN_KEYS } from "../../src/domain/models/token.js";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const SNAPSHOT_DIR = path.resolve(
  repoRoot,
  "local-data",
  "snapshots",
  "2026-11-17T12-55-15-040Z-production"
);
const PROJECT_ID = "demo-cpvtt-test";

let connection;
const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cpvtt-p8-"));

async function clearEmulators() {
  const colls = await connection.firestore.listCollections();
  for (const col of colls) {
    await connection.firestore.recursiveDelete(col);
  }
  await connection.database.ref("/").set(null);
}

beforeAll(() => {
  connection = connectAdmin(
    resolveTarget({ target: "emulator", config: "firebase.test.json", project: PROJECT_ID })
  );
});

afterAll(async () => {
  await connection?.app.delete();
  fs.rmSync(logDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await clearEmulators();
});

describe("Migração M007-rtdb-v2 + auditoria rtdb-v2", () => {
  it("converte fixture v1 completa (tokens, hiddenTokens, tokenSecrets, fog, drawings, pings, presence) com 0 violações e idempotência", async () => {
    const campId = "camp_m7_fixture";
    await connection.firestore.doc(`campaigns/${campId}`).set({
      campaignId: campId,
      gmId: "gm_m7",
      name: "Mesa M7"
    });
    await connection.firestore.doc(`campaigns/${campId}/scenes/scene_fog`).set({
      campaignId: campId,
      name: "Caverna",
      ownerId: "gm_m7",
      visibleTo: ["ALL"],
      editableBy: ["gm_m7"],
      grid: { cellSizePx: 64, visible: true, color: "#ffffff", opacity: 0.2 },
      mapImage: { mediaId: null, url: null, widthPx: 1024, heightPx: 1024 },
      isDeleted: false
    });
    await connection.firestore.doc(`campaigns/${campId}/characters/char_pc1`).set(
      toCharacterDoc(
        normalizeCharacter({
          campaignId: campId,
          type: CHARACTER_TYPES.PC,
          ownerId: "player1",
          visibleTo: ["ALL", "player1"],
          editableBy: ["player1"],
          name: "Pinguim Herói",
          cardColor: "#00aaee",
          rev: 7,
          resources: {
            hp: { current: 24, max: 30 },
            mp: { current: 9, max: 12 }
          },
          avatar: { mediaId: "med_avatar_pc1", url: null },
          token: {
            image: { mediaId: null, url: null },
            sizeInCells: 1,
            showName: true
          },
          isDeleted: false
        })
      )
    );

    await connection.database.ref(`vtt_realtime/${campId}`).set({
      meta: {
        gmId: "gm_m7",
        members: { gm_m7: true, player1: true }
      },
      presence: {
        player1: {
          uid: "player1",
          online: true,
          lastSeen: 1700000000000
        },
        gm_m7: {
          conn_valid: {
            kind: "main",
            connectedAt: 1700000001000
          }
        }
      },
      fog: {
        // Cena com névoa ativa + desenhos legados aninhados
        scene_fog: {
          enabled: true,
          areas: {
            a1: { id: "a1", op: "reveal", x: 0, y: 0, w: 128, h: 128, createdAt: 1000 }
          },
          drawings: {
            drw_text_from_fog: {
              id: "drw_text_from_fog",
              type: "text",
              layer: LAYER_NAMES.TOKENS,
              authorId: "gm_m7",
              text: "Entrada",
              fontSize: 28,
              fontFamily: "Georgia, serif",
              color: "#ffee00",
              x: 40,
              y: 50,
              rotation: 0
            }
          }
        },
        // Cena cujo nó fog contém APENAS drawings legados -> deve remover fog/scene_drawings_only
        scene_drawings_only: {
          drawings: {
            drw_stroke_only: {
              id: "drw_stroke_only",
              type: "stroke",
              layer: LAYER_NAMES.MAP,
              authorId: "gm_m7",
              color: "#ff0000",
              width: 5,
              points: [{ x: 10, y: 10 }, { x: 80, y: 90 }]
            }
          }
        }
      },
      tokens: {
        scene_fog: {
          // PC na área coberta pela névoa (x=500) -> PC permanece público e alinha rev/bars/image com Firestore
          tok_pc: {
            id: "tok_pc",
            type: "pc",
            characterId: "char_pc1",
            ownerId: "player1",
            controlledBy: ["player1"],
            visibleToPlayers: true,
            name: "Nome Desatualizado",
            x: 500,
            y: 500,
            size: 1
          },
          // NPC dentro da área revelada (x=32, y=32) com showBarsToPlayers: false -> fica público sem bars, cria secret
          tok_npc_revealed: {
            id: "tok_npc_revealed",
            characterType: "npc",
            ownerId: "gm_m7",
            controlledBy: { gm_m7: true },
            visibleToPlayers: true,
            name: "Guarda Revelado",
            externalUrl: "https://example.com/guard.png",
            defense: 16,
            hpCurrent: 14,
            hpMax: 20,
            mpCurrent: 4,
            mpMax: 6,
            showBarsToPlayers: false,
            x: 32,
            y: 32,
            sizeInCells: 1
          },
          // NPC sob névoa não revelada (x=600, y=600) -> vai para hiddenTokens + secret
          tok_npc_fogged: {
            id: "tok_npc_fogged",
            characterType: "npc",
            ownerId: "gm_m7",
            controlledBy: { gm_m7: true },
            visibleToPlayers: true,
            name: "Emboscador",
            mediaId: "med_ambush",
            defense: 15,
            hpCurrent: 30,
            hpMax: 30,
            x: 600,
            y: 600,
            sizeInCells: 1
          },
          // Token livre com visibleToPlayers: false -> hidden: true em hiddenTokens + secret
          tok_free_hidden: {
            id: "tok_free_hidden",
            ownerId: "gm_m7",
            visibleToPlayers: false,
            name: "Armadilha",
            defense: 12,
            x: 32,
            y: 32,
            sizeInCells: 1
          }
        }
      },
      pings: {
        scene_fog: {
          ping_stale: {
            id: "ping_stale",
            authorId: "player1",
            kind: "ping",
            x: 10,
            y: 20,
            color: "#00f0ff",
            createdAt: 1000,
            expiresAt: 3200
          }
        }
      }
    });

    // 1. Dry-run não altera nada
    const [sim] = await runMigrations({
      migrations: [M007RtdbV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: false,
      logDir,
      log: () => {}
    });
    expect(sim.applied).toBe(false);
    expect(sim.planned).toBeGreaterThan(0);
    const beforeApply = (await connection.database.ref(`vtt_realtime/${campId}`).once("value")).val();
    expect(beforeApply.fog.scene_drawings_only).toBeDefined();
    expect(beforeApply.hiddenTokens).toBeUndefined();

    // 2. Apply executa migração completa
    const [applied] = await runMigrations({
      migrations: [M007RtdbV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(applied.applied).toBe(true);
    expect(applied.summary.drawingsMigratedFromFog).toBe(2);
    expect(applied.summary.fogNodesRemovedEmpty).toBe(1);
    expect(applied.summary.tokensMovedToHidden).toBe(2);
    expect(applied.summary.tokenSecretsWritten).toBe(3);
    expect(applied.summary.pingsRemoved).toBe(1);
    expect(applied.summary.presenceNodesCleaned).toBe(1);

    const after = (await connection.database.ref(`vtt_realtime/${campId}`).once("value")).val();

    // fog/scene_drawings_only removido e desenhos preservados com estilo em drawings/
    expect(after.fog?.scene_drawings_only).toBeUndefined();
    expect(after.fog?.scene_fog?.drawings).toBeUndefined();
    expect(after.drawings?.scene_fog?.drw_text_from_fog).toMatchObject({
      text: "Entrada",
      fontSize: 28,
      fontFamily: "Georgia, serif"
    });
    expect(after.drawings?.scene_drawings_only?.drw_stroke_only?.type).toBe("stroke");

    // PC alinhado com Firestore (rev 7, label, image.mediaId, bars, ringColor, showName, sizeInCells) e mantido público mesmo sob névoa
    expect(after.tokens?.scene_fog?.tok_pc).toMatchObject({
      kind: TOKEN_KINDS.PC,
      characterId: "char_pc1",
      label: "Pinguim Herói",
      rev: 7,
      image: { mediaId: "med_avatar_pc1" },
      bars: { hpCurrent: 24, hpMax: 30, mpCurrent: 9, mpMax: 12 },
      ringColor: "#00aaee",
      showName: true,
      sizeInCells: 1,
      controlledBy: { player1: true }
    });
    for (const legacyKey of LEGACY_TOKEN_KEYS) {
      expect(after.tokens.scene_fog.tok_pc).not.toHaveProperty(legacyKey);
    }

    // NPC revelado público sem bars (showBarsToPlayers: false), mas com secret completo
    expect(after.tokens?.scene_fog?.tok_npc_revealed?.bars).toBeUndefined();
    expect(after.tokens?.scene_fog?.tok_npc_revealed?.image).toEqual({
      url: "https://example.com/guard.png"
    });
    expect(after.tokenSecrets?.scene_fog?.tok_npc_revealed).toEqual({
      defense: 16,
      showBarsToPlayers: false,
      hp: { current: 14, max: 20 },
      mp: { current: 4, max: 6 }
    });

    // NPC sob névoa e token livre invisível em hiddenTokens + tokenSecrets
    expect(after.tokens?.scene_fog?.tok_npc_fogged).toBeUndefined();
    expect(after.hiddenTokens?.scene_fog?.tok_npc_fogged?.hidden).toBe(false);
    expect(after.hiddenTokens?.scene_fog?.tok_npc_fogged?.image).toEqual({
      mediaId: "med_ambush"
    });
    expect(after.tokens?.scene_fog?.tok_free_hidden).toBeUndefined();
    expect(after.hiddenTokens?.scene_fog?.tok_free_hidden?.hidden).toBe(true);
    expect(after.tokenSecrets?.scene_fog?.tok_free_hidden?.defense).toBe(12);

    // Pings expirados removidos e presence legado limpo sem tocar no connId válido
    expect(after.pings).toBeUndefined();
    expect(after.presence?.player1).toBeUndefined();
    expect(after.presence?.gm_m7?.conn_valid?.kind).toBe("main");

    // 3. Auditoria audit-v2: 0 violações
    const documents = await readAllFirestoreDocuments(connection.firestore);
    const database = (await connection.database.ref("/").once("value")).val();
    const audit = evaluateAuditData({ source: "emulator-m7-fixture", documents, database });
    expect(audit.report.samples).toEqual([]);
    expect(audit.report.violations).toBe(0);

    // 4. Idempotência: segunda execução planeja 0 operações
    const [second] = await runMigrations({
      migrations: [M007RtdbV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  });

  it("executa cadeia completa M001 → M007 no snapshot real de produção com 0 violações em audit-v2 e idempotência", async () => {
    if (!fs.existsSync(SNAPSHOT_DIR)) return;

    const snap = readSnapshot(SNAPSHOT_DIR);
    for (const [docPath, raw] of Object.entries(snap.documents || {})) {
      await connection.firestore.doc(docPath).set(decodeValue(raw, connection.firestore));
    }
    if (snap.database !== undefined && snap.database !== null) {
      await connection.database.ref("/").set(snap.database);
    }

    const firstRun = await runMigrations({
      migrations: [
        M001Identity,
        M002Audience,
        M003Media,
        M004CharactersV2,
        M005Folders,
        M006NotesV2,
        M007RtdbV2
      ],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });

    const m007Result = firstRun.find((r) => r.id === "M007-rtdb-v2");
    expect(m007Result).toBeDefined();
    expect(m007Result.summary.campaignsProcessed).toBeGreaterThanOrEqual(1);
    expect(m007Result.summary.drawingsMigratedFromFog).toBeGreaterThanOrEqual(1);
    expect(m007Result.summary.fogNodesRemovedEmpty).toBeGreaterThanOrEqual(1);

    const database = (await connection.database.ref("/").once("value")).val();
    const mainTable = database?.vtt_realtime?.["main-table"];
    expect(mainTable?.fog?.scene_1793998208523_dapr).toBeUndefined();
    expect(Object.keys(mainTable?.drawings?.scene_1793998208523_dapr || {}).length).toBeGreaterThan(0);

    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({
      source: "emulator-snapshot-m7",
      documents,
      database
    });
    expect(audit.report.samples).toEqual([]);
    expect(audit.report.violations).toBe(0);

    const [second] = await runMigrations({
      migrations: [M007RtdbV2],
      connection,
      target: { kind: "emulator", projectId: PROJECT_ID },
      apply: true,
      logDir,
      log: () => {}
    });
    expect(second.planned).toBe(0);
  }, 60_000);

  it("audit-rtdb-v2 sinaliza INVALID_FOG_AREAS_NODE e campaignId/sceneId aninhados em fog/{sceneId}/areas/{areaId}", async () => {
    const documents = await readAllFirestoreDocuments(connection.firestore);
    const audit = evaluateAuditData({
      source: "emulator-audit-fog-areas",
      documents,
      database: {
        vtt_realtime: {
          camp_audit_fog: {
            meta: { gmId: "gm_1", members: { gm_1: true } },
            fog: {
              scene_bad_array: {
                enabled: true,
                areas: [{ id: "a1", op: "reveal", x: 0, y: 0, w: 64, h: 64, createdAt: 1 }]
              },
              scene_nested_legacy: {
                enabled: true,
                areas: {
                  a1: {
                    id: "a1",
                    op: "reveal",
                    x: 0,
                    y: 0,
                    w: 64,
                    h: 64,
                    createdAt: 1,
                    campaignId: "camp_audit_fog",
                    sceneId: "scene_nested_legacy"
                  }
                }
              }
            }
          }
        }
      }
    });

    const codes = audit.report.samples.map((s) => ({ path: s.path, code: s.code }));
    expect(codes).toEqual(
      expect.arrayContaining([
        { path: "vtt_realtime/camp_audit_fog/fog/scene_bad_array/areas", code: "INVALID_FOG_AREAS_NODE" },
        { path: "vtt_realtime/camp_audit_fog/fog/scene_nested_legacy/areas/a1", code: "LEGACY_FIELD_campaignId" },
        { path: "vtt_realtime/camp_audit_fog/fog/scene_nested_legacy/areas/a1", code: "LEGACY_FIELD_sceneId" }
      ])
    );
  });
});
