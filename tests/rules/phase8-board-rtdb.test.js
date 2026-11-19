// Testes adversariais obrigatórios no emulador real de RTDB:
// Apêndice B — Bloco B5 (B5.1 a B5.9), B7.1 (HP concorrente de NPC em tokenSecrets),
// B7.5 (projeção de PC fora de ordem) e expiração de ping com emissor desconectado.
import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  get as rtdbGet,
  ref as rtdbRef,
  remove as rtdbRemove,
  serverTimestamp as rtdbServerTimestamp,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTER_TYPES,
  LAYER_NAMES,
  PING_LIFETIME_MS,
  RESOURCE_KEYS,
  TOKEN_KINDS
} from "../../src/domain/constants.js";
import {
  drawingItemPath,
  drawingsPath,
  sceneFogPath,
  hiddenTokenPath,
  pingItemPath,
  sceneHiddenTokensPath,
  sceneTokenSecretsPath,
  tokenPath,
  tokenSecretPath
} from "../../src/infra/rtdbPaths.js";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  DEFAULT_CAMPAIGN_ID: "camp_p8"
}));

const tokenService = await import("../../src/services/tokenService.js");
const drawingService = await import("../../src/services/drawingService.js");
const pingService = await import("../../src/services/pingService.js");
const runtimeConfigService = await import("../../src/services/runtimeConfigService.js");

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const PROJECT_ID = "demo-cpvtt-test";
const CAMPAIGN = "camp_p8";
const SCENE = "scene_1";
const rulesRaw = fs.readFileSync(path.join(repoRoot, "database.rules.json"), "utf8");

let env;

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const rtdbAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).database();

function buildValidPublicToken(overrides = {}) {
  return {
    id: "tok_1",
    kind: TOKEN_KINDS.FREE,
    ownerId: "gm_a",
    controlledBy: { player1: true },
    layer: LAYER_NAMES.TOKENS,
    hidden: false,
    label: "Goblin",
    x: 64,
    y: 128,
    sizeInCells: 1,
    rotation: 0,
    ringColor: "#3090f0",
    showName: true,
    bars: { hpCurrent: 20, hpMax: 20, mpCurrent: 10, mpMax: 10 },
    rev: 1,
    ...overrides
  };
}

function buildValidSecret(overrides = {}) {
  return {
    defense: 14,
    showBarsToPlayers: true,
    hp: { current: 20, max: 20 },
    mp: { current: 10, max: 10 },
    ...overrides
  };
}

async function seedCampaignMembers() {
  await seed(async (ctx) => {
    const db = ctx.database();
    await rtdbSet(rtdbRef(db, `vtt_realtime/${CAMPAIGN}/meta`), {
      gmId: "gm_a",
      members: {
        gm_a: true,
        player1: true,
        player2: true,
        player3: true
      }
    });
  });
}

beforeAll(async () => {
  runtimeConfigService.setClientVersionBlocked(false);
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: { rules: rulesRaw }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearDatabase();
  await seedCampaignMembers();
});

describe("B5.1 & B5.2 — Tokens: proteção de campos administrativos e reprodução do Codex", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      await rtdbSet(
        rtdbRef(ctx.database(), tokenPath(CAMPAIGN, SCENE, "tok_1")),
        buildValidPublicToken({ id: "tok_1", controlledBy: { player1: true } })
      );
    });
  });

  it("B5.1: controlador move e gira, mas é negado ao alterar controlledBy, kind, characterId, ownerId, layer ou hidden", async () => {
    const p1 = rtdbAs("player1");
    const refTok = rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_1"));

    await assertSucceeds(
      rtdbUpdate(refTok, {
        x: 192,
        y: 256,
        rotation: 90,
        updatedAt: rtdbServerTimestamp(),
        updatedBy: "player1"
      })
    );

    const forbiddenPatches = [
      { controlledBy: { ALL: true } },
      { controlledBy: { player1: true, player2: true } },
      { kind: TOKEN_KINDS.PC, characterId: "char_1" },
      { characterId: "char_hijack" },
      { ownerId: "player1" },
      { layer: LAYER_NAMES.MAP },
      { hidden: true }
    ];

    for (const patch of forbiddenPatches) {
      await assertFails(rtdbUpdate(refTok, patch));
    }
  });

  it("B5.2 (Codex): controlador tenta conceder controle a player2 -> negado no primeiro passo; player2 segue sem poder mover", async () => {
    const p1 = rtdbAs("player1");
    const p2 = rtdbAs("player2");

    await assertFails(
      rtdbSet(rtdbRef(p1, `${tokenPath(CAMPAIGN, SCENE, "tok_1")}/controlledBy/player2`), true)
    );
    await assertFails(
      rtdbUpdate(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_1")), {
        controlledBy: { player1: true, player2: true }
      })
    );
    await assertFails(
      rtdbUpdate(rtdbRef(p2, tokenPath(CAMPAIGN, SCENE, "tok_1")), {
        x: 320,
        y: 320
      })
    );
  });
});

describe("B5.3 — Sigilo de hiddenTokens e tokenSecrets", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.database();
      await rtdbSet(
        rtdbRef(db, hiddenTokenPath(CAMPAIGN, SCENE, "tok_hidden")),
        buildValidPublicToken({ id: "tok_hidden", hidden: true })
      );
      await rtdbSet(
        rtdbRef(db, tokenPath(CAMPAIGN, SCENE, "tok_boss")),
        buildValidPublicToken({
          id: "tok_boss",
          kind: TOKEN_KINDS.NPC,
          ownerId: "gm_a",
          controlledBy: { gm_a: true }
        })
      );
      await rtdbSet(
        rtdbRef(db, tokenSecretPath(CAMPAIGN, SCENE, "tok_boss")),
        buildValidSecret({ defense: 19, showBarsToPlayers: false })
      );
      await rtdbSet(
        rtdbRef(db, tokenPath(CAMPAIGN, SCENE, "tok_ally")),
        buildValidPublicToken({
          id: "tok_ally",
          kind: TOKEN_KINDS.NPC,
          ownerId: "gm_a",
          controlledBy: { player1: true }
        })
      );
      await rtdbSet(
        rtdbRef(db, tokenSecretPath(CAMPAIGN, SCENE, "tok_ally")),
        buildValidSecret({ defense: 15, showBarsToPlayers: true })
      );
    });
  });

  it("jogador não lê hiddenTokens, lista completa de tokenSecrets nem segredo de token que não controla; lê segredo do que controla; Mestre lê tudo", async () => {
    const p1 = rtdbAs("player1");
    const gm = rtdbAs("gm_a");

    await assertFails(rtdbGet(rtdbRef(p1, sceneHiddenTokensPath(CAMPAIGN, SCENE))));
    await assertFails(rtdbGet(rtdbRef(p1, hiddenTokenPath(CAMPAIGN, SCENE, "tok_hidden"))));
    await assertFails(rtdbGet(rtdbRef(p1, sceneTokenSecretsPath(CAMPAIGN, SCENE))));
    await assertFails(rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_boss"))));

    const allySecret = await assertSucceeds(
      rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_ally")))
    );
    expect(allySecret.val().defense).toBe(15);

    const hiddenSnap = await assertSucceeds(
      rtdbGet(rtdbRef(gm, sceneHiddenTokensPath(CAMPAIGN, SCENE)))
    );
    expect(hiddenSnap.val().tok_hidden.hidden).toBe(true);
    const allSecretsSnap = await assertSucceeds(
      rtdbGet(rtdbRef(gm, sceneTokenSecretsPath(CAMPAIGN, SCENE)))
    );
    expect(allSecretsSnap.val().tok_boss.defense).toBe(19);
  });
});

describe("B5.4 — Desenhos: imutabilidade de layer e autoria", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      const db = ctx.database();
      await rtdbSet(rtdbRef(db, drawingItemPath(CAMPAIGN, SCENE, "drw_p1")), {
        id: "drw_p1",
        type: "text",
        layer: LAYER_NAMES.TOKENS,
        authorId: "player1",
        authorName: "P1",
        text: "Olá",
        fontSize: 20,
        fontFamily: "sans-serif",
        color: "#ffffff",
        x: 100,
        y: 100,
        rotation: 0
      });
      await rtdbSet(rtdbRef(db, drawingItemPath(CAMPAIGN, SCENE, "drw_p2")), {
        id: "drw_p2",
        type: "rect",
        layer: LAYER_NAMES.TOKENS,
        authorId: "player2",
        authorName: "P2",
        strokeColor: "#ff0000",
        strokeWidth: 4,
        hasFill: false,
        x: 50,
        y: 50,
        w: 80,
        h: 60,
        rotation: 0
      });
    });
  });

  it("autor edita e move o próprio desenho preservando layer, mas não altera layer nem edita/apaga desenho alheio", async () => {
    const p1 = rtdbAs("player1");
    const gm = rtdbAs("gm_a");

    await assertSucceeds(
      drawingService.moveDrawings({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        drawings: [{ id: "drw_p1", type: "text", x: 100, y: 100 }],
        dx: 30,
        dy: -10,
        user: { uid: "player1" },
        realtimeDb: p1
      })
    );

    // Autor não-GM não pode trocar layer
    await assertFails(
      rtdbUpdate(rtdbRef(p1, drawingItemPath(CAMPAIGN, SCENE, "drw_p1")), {
        layer: LAYER_NAMES.MAP
      })
    );

    // Autor não-GM não pode editar nem apagar desenho de player2
    await assertFails(
      rtdbUpdate(rtdbRef(p1, drawingItemPath(CAMPAIGN, SCENE, "drw_p2")), {
        x: 999
      })
    );
    await assertFails(rtdbRemove(rtdbRef(p1, drawingItemPath(CAMPAIGN, SCENE, "drw_p2"))));

    // Autor não-GM não pode apagar todos os desenhos da cena
    await assertFails(rtdbRemove(rtdbRef(p1, drawingsPath(CAMPAIGN, SCENE))));

    // Mestre pode mudar layer e editar qualquer desenho
    await assertSucceeds(
      rtdbUpdate(rtdbRef(gm, drawingItemPath(CAMPAIGN, SCENE, "drw_p1")), {
        layer: LAYER_NAMES.MAP
      })
    );
  });
});

describe("B5.5 — Pings: createdAt do servidor, expiração com emissor desconectado e constante sincronizada", () => {
  it("constante de expiração em database.rules.json é idêntica a PING_LIFETIME_MS de domain/constants", () => {
    const rules = JSON.parse(rulesRaw);
    const writeRule = rules.rules.vtt_realtime.$campaignId.pings.$sceneId.$pingId[".write"];
    const match = writeRule.match(/createdAt'\)\.val\(\)\s*\+\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match[1])).toBe(PING_LIFETIME_MS);
  });

  it("nega ping com createdAt forjado, nega remoção antecipada por outro membro e permite remoção após expiração mesmo com emissor desconectado", async () => {
    const p1 = rtdbAs("player1");
    const p2 = rtdbAs("player2");

    // Forjar createdAt != now -> negado
    await assertFails(
      rtdbSet(rtdbRef(p1, pingItemPath(CAMPAIGN, SCENE, "ping_forged")), {
        id: "ping_forged",
        authorId: "player1",
        kind: "ping",
        x: 10,
        y: 20,
        color: "#00f0ff",
        createdAt: Date.now() - 10_000
      })
    );

    // Ping legítimo via pingService (usa serverTimestamp)
    const sent = await assertSucceeds(
      pingService.sendPing({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        x: 150,
        y: 250,
        color: "#00f0ff",
        user: { uid: "player1" },
        realtimeDb: p1
      })
    );
    expect(sent?.id).toBeTruthy();
    const freshSnap = await rtdbGet(rtdbRef(p2, pingItemPath(CAMPAIGN, SCENE, sent.id)));
    expect(freshSnap.exists()).toBe(true);

    // Antes de expirar, player2 não pode remover o ping de player1
    await assertFails(rtdbRemove(rtdbRef(p2, pingItemPath(CAMPAIGN, SCENE, sent.id))));

    // Simula emissor desconectado (ping antigo já no banco sem aba ativa do autor)
    const expiredId = "ping_old_disconnected";
    await seed(async (ctx) => {
      await rtdbSet(rtdbRef(ctx.database(), pingItemPath(CAMPAIGN, SCENE, expiredId)), {
        id: expiredId,
        authorId: "player1",
        kind: "ping",
        x: 80,
        y: 90,
        color: "#ffcc00",
        createdAt: Date.now() - (PING_LIFETIME_MS + 1000)
      });
    });

    // Qualquer membro remove o ping expirado via cleanupExpiredPings
    const removedCount = await pingService.cleanupExpiredPings({
      campaignId: CAMPAIGN,
      sceneId: SCENE,
      pings: [
        {
          id: expiredId,
          createdAt: Date.now() - (PING_LIFETIME_MS + 1000)
        }
      ],
      serverNowMs: Date.now(),
      realtimeDb: p2
    });
    expect(removedCount).toBe(1);
    const afterCleanup = await rtdbGet(rtdbRef(p2, pingItemPath(CAMPAIGN, SCENE, expiredId)));
    expect(afterCleanup.exists()).toBe(false);

    // Também testa expiração real por relógio do emulador após PING_LIFETIME_MS
    await new Promise((resolve) => setTimeout(resolve, PING_LIFETIME_MS + 350));
    await assertSucceeds(rtdbRemove(rtdbRef(p2, pingItemPath(CAMPAIGN, SCENE, sent.id))));
    const afterRealExpiry = await rtdbGet(rtdbRef(p2, pingItemPath(CAMPAIGN, SCENE, sent.id)));
    expect(afterRealExpiry.exists()).toBe(false);
  }, 15_000);
});

describe("B5.6 & B5.7 — Validação de schema (.validate) e proteção de fog/", () => {
  it("B5.6: nega tipos inválidos, campos obrigatórios ausentes, campos legados e ImageRef malformado", async () => {
    const gm = rtdbAs("gm_a");

    // x como string
    await assertFails(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_bad_x")),
        buildValidPublicToken({ id: "tok_bad_x", x: "100" })
      )
    );

    // campos obrigatórios ausentes (sem rev)
    const withoutRev = buildValidPublicToken({ id: "tok_no_rev" });
    delete withoutRev.rev;
    await assertFails(rtdbSet(rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_no_rev")), withoutRev));

    // campo legado proibido ($other: false)
    await assertFails(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_legacy")),
        buildValidPublicToken({ id: "tok_legacy", visibleToPlayers: true })
      )
    );

    // ImageRef com mediaId e url simultâneos
    await assertFails(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_bad_img")),
        buildValidPublicToken({
          id: "tok_bad_img",
          image: { mediaId: "med_1", url: "https://example.com/a.png" }
        })
      )
    );

    // PC sem characterId
    await assertFails(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_pc_nochar")),
        buildValidPublicToken({ id: "tok_pc_nochar", kind: TOKEN_KINDS.PC })
      )
    );
  });

  it("B5.7: jogador não grava em fog/; Mestre grava fog válido", async () => {
    const p1 = rtdbAs("player1");
    const gm = rtdbAs("gm_a");

    await assertFails(
      rtdbSet(rtdbRef(p1, sceneFogPath(CAMPAIGN, SCENE)), {
        enabled: true
      })
    );

    await assertSucceeds(
      rtdbSet(rtdbRef(gm, sceneFogPath(CAMPAIGN, SCENE)), {
        enabled: true,
        areas: {
          area_1: {
            id: "area_1",
            op: "reveal",
            x: 0,
            y: 0,
            w: 128,
            h: 128,
            createdAt: 1000
          }
        }
      })
    );
  });
});

describe("B5.8 — tokenSecrets: transação de controlador, proteção de segredos e criação/exclusão atômica pelo dono", () => {
  it("controlador ajusta hp/mp/recentOps mas não altera defense/hp.max/mp.max/showBarsToPlayers; dono cria e apaga token livre + segredo atomicamente; terceiro é negado", async () => {
    const p1 = rtdbAs("player1");
    const p2 = rtdbAs("player2");

    // Dono (player1) cria token livre + segredos em uma única atualização atômica
    const created = await assertSucceeds(
      tokenService.createFreeToken({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        user: { uid: "player1" },
        isGM: false,
        data: {
          label: "Invocação",
          x: 64,
          y: 64,
          defense: 13,
          hp: { current: 18, max: 18 },
          mp: { current: 6, max: 6 },
          showBarsToPlayers: true
        },
        realtimeDb: p1
      })
    );
    const createdId = created.token.id;

    // Seed de um segundo token controlado por player1 mas de propriedade do GM
    await seed(async (ctx) => {
      const db = ctx.database();
      await rtdbSet(
        rtdbRef(db, tokenPath(CAMPAIGN, SCENE, "tok_ctrl")),
        buildValidPublicToken({
          id: "tok_ctrl",
          kind: TOKEN_KINDS.NPC,
          ownerId: "gm_a",
          controlledBy: { player1: true }
        })
      );
      await rtdbSet(
        rtdbRef(db, tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl")),
        buildValidSecret({
          defense: 16,
          showBarsToPlayers: true,
          hp: { current: 20, max: 20 },
          mp: { current: 10, max: 10 }
        })
      );
    });

    // Controlador não-GM faz transação em hp.current / mp.current / recentOps -> permitido
    const adj = await assertSucceeds(
      tokenService.adjustTokenResource({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        token: buildValidPublicToken({
          id: "tok_ctrl",
          kind: TOKEN_KINDS.NPC,
          ownerId: "gm_a",
          controlledBy: { player1: true },
          rev: 1
        }),
        resourceKey: RESOURCE_KEYS.HP,
        delta: -4,
        opId: "op_ctrl_1",
        user: { uid: "player1" },
        realtimeDb: p1
      })
    );
    expect(adj.applied).toBe(true);
    expect((await rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl")))).val().hp.current).toBe(16);

    // Controlador não-GM tenta alterar defense, hp.max, mp.max, showBarsToPlayers ou remover hp -> negado
    const ctrlSecretRef = rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl"));
    await assertFails(rtdbUpdate(ctrlSecretRef, { defense: 99 }));
    await assertFails(rtdbUpdate(ctrlSecretRef, { showBarsToPlayers: false }));
    await assertFails(rtdbSet(rtdbRef(p1, `${tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl")}/hp/max`), 999));
    await assertFails(rtdbSet(rtdbRef(p1, `${tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl")}/mp/max`), 999));
    await assertFails(rtdbUpdate(ctrlSecretRef, { hp: null }));

    // Terceiro (player2) não pode criar segredo órfão nem apagar segredo de outrem
    await assertFails(
      rtdbSet(rtdbRef(p2, tokenSecretPath(CAMPAIGN, SCENE, "tok_orphan")), buildValidSecret())
    );
    await assertFails(rtdbRemove(rtdbRef(p2, tokenSecretPath(CAMPAIGN, SCENE, createdId))));
    await assertFails(rtdbRemove(rtdbRef(p2, tokenSecretPath(CAMPAIGN, SCENE, "tok_ctrl"))));

    // Dono (player1) exclui token livre + segredos juntos em uma única atualização atômica
    await assertSucceeds(
      tokenService.removeToken({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        token: created.token,
        realtimeDb: p1
      })
    );
    expect((await rtdbGet(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, createdId)))).exists()).toBe(false);
    await assertFails(rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, createdId))));
    expect(
      (await rtdbGet(rtdbRef(rtdbAs("gm_a"), tokenSecretPath(CAMPAIGN, SCENE, createdId)))).exists()
    ).toBe(false);
  });
});

describe("B5.9 & B7.5 — Projeção de PC: controle de escrita e convergência por maior rev fora de ordem", () => {
  beforeEach(async () => {
    await seed(async (ctx) => {
      await rtdbSet(
        rtdbRef(ctx.database(), tokenPath(CAMPAIGN, SCENE, "tok_pc")),
        buildValidPublicToken({
          id: "tok_pc",
          kind: TOKEN_KINDS.PC,
          characterId: "char_pc_1",
          ownerId: "player1",
          controlledBy: { player1: true },
          label: "Pinguim v3",
          bars: { hpCurrent: 15, hpMax: 20, mpCurrent: 8, mpMax: 10 },
          rev: 3
        })
      );
    });
  });

  it("B5.9: membro sem controle é negado em campos de projeção; controlador é negado com rev <= atual e permitido com rev > atual", async () => {
    const p1 = rtdbAs("player1");
    const p2 = rtdbAs("player2");

    // player2 (não é GM, nem dono, nem controlador) -> negado
    await assertFails(
      rtdbUpdate(rtdbRef(p2, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        label: "Hackeado",
        rev: 4
      })
    );
    await assertFails(
      rtdbUpdate(rtdbRef(p2, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        bars: { hpCurrent: 1, hpMax: 20, mpCurrent: 1, mpMax: 10 },
        rev: 4
      })
    );

    // player1 (controlador) com rev igual (3) ou menor (2) -> negado
    await assertFails(
      rtdbUpdate(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        label: "Igual",
        rev: 3
      })
    );
    await assertFails(
      rtdbUpdate(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        label: "Antigo",
        rev: 2
      })
    );

    // player1 (controlador) com rev maior (4) -> permitido
    await assertSucceeds(
      rtdbUpdate(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        label: "Pinguim v4",
        ringColor: "#ff5500",
        bars: { hpCurrent: 12, hpMax: 20, mpCurrent: 7, mpMax: 10 },
        rev: 4
      })
    );
    const snap = await rtdbGet(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_pc")));
    expect(snap.val().label).toBe("Pinguim v4");
    expect(snap.val().rev).toBe(4);
  });

  it("B7.5: duas escritas de projeção fora de ordem (rev 6 chega antes de rev 4) convergem para rev 6", async () => {
    const p1 = rtdbAs("player1");
    const gm = rtdbAs("gm_a");

    // Projeção mais nova (rev 6) chega primeiro
    const resNewer = await tokenService.projectCharacterToSceneTokens({
      campaignId: CAMPAIGN,
      sceneId: SCENE,
      character: {
        id: "char_pc_1",
        type: CHARACTER_TYPES.PC,
        name: "Pinguim v6",
        cardColor: "#00cc88",
        rev: 6,
        resources: {
          hp: { current: 18, max: 20 },
          mp: { current: 9, max: 10 }
        },
        token: { showName: true, sizeInCells: 1, image: { mediaId: null, url: null } }
      },
      user: { uid: "player1" },
      isGM: false,
      realtimeDb: p1
    });
    expect(resNewer.updatedCount).toBe(1);

    // Projeção atrasada (rev 4) tenta gravar depois tanto via serviço (ignorada) quanto direto no RTDB (negada até para GM)
    const resOlder = await tokenService.projectCharacterToSceneTokens({
      campaignId: CAMPAIGN,
      sceneId: SCENE,
      character: {
        id: "char_pc_1",
        type: CHARACTER_TYPES.PC,
        name: "Pinguim v4 Atrasado",
        cardColor: "#ff0000",
        rev: 4,
        resources: {
          hp: { current: 5, max: 20 },
          mp: { current: 2, max: 10 }
        },
        token: { showName: true, sizeInCells: 1, image: { mediaId: null, url: null } }
      },
      user: { uid: "gm_a" },
      isGM: true,
      realtimeDb: gm
    });
    expect(resOlder.updatedCount).toBe(0);

    // Mesmo escrita direta no RTDB com rev inferior falha em .validate
    await assertFails(
      rtdbUpdate(rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_pc")), {
        label: "Regressão",
        rev: 4
      })
    );

    const finalSnap = (await rtdbGet(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_pc")))).val();
    expect(finalSnap.rev).toBe(6);
    expect(finalSnap.label).toBe("Pinguim v6");
    expect(finalSnap.bars.hpCurrent).toBe(18);
  });
});

describe("B7.1 — Concorrência de dois clientes em HP de NPC (tokenSecrets + projeção de bars)", () => {
  it("dois controladores descontam -5 e -3 simultaneamente de HP 20 -> 12 com ambos opIds e bars sincronizado", async () => {
    const initialToken = buildValidPublicToken({
      id: "tok_npc_race",
      kind: TOKEN_KINDS.NPC,
      ownerId: "gm_a",
      controlledBy: { player1: true, player2: true },
      bars: { hpCurrent: 20, hpMax: 20, mpCurrent: 10, mpMax: 10 },
      rev: 1
    });

    await seed(async (ctx) => {
      const db = ctx.database();
      await rtdbSet(rtdbRef(db, tokenPath(CAMPAIGN, SCENE, "tok_npc_race")), initialToken);
      await rtdbSet(
        rtdbRef(db, tokenSecretPath(CAMPAIGN, SCENE, "tok_npc_race")),
        buildValidSecret({
          defense: 14,
          showBarsToPlayers: true,
          hp: { current: 20, max: 20 },
          mp: { current: 10, max: 10 }
        })
      );
    });

    const p1 = rtdbAs("player1");
    const p2 = rtdbAs("player2");

    const [r1, r2] = await Promise.all([
      tokenService.adjustTokenResource({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        token: initialToken,
        resourceKey: RESOURCE_KEYS.HP,
        delta: -5,
        opId: "op_npc_a",
        user: { uid: "player1" },
        realtimeDb: p1
      }),
      tokenService.adjustTokenResource({
        campaignId: CAMPAIGN,
        sceneId: SCENE,
        token: initialToken,
        resourceKey: RESOURCE_KEYS.HP,
        delta: -3,
        opId: "op_npc_b",
        user: { uid: "player2" },
        realtimeDb: p2
      })
    ]);

    expect(r1.applied).toBe(true);
    expect(r2.applied).toBe(true);

    const secretFinal = (
      await rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_npc_race")))
    ).val();
    expect(secretFinal.hp.current).toBe(12);
    expect(Object.keys(secretFinal.recentOps || {}).sort()).toEqual(["op_npc_a", "op_npc_b"]);

    const tokenFinal = (
      await rtdbGet(rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_npc_race")))
    ).val();
    expect(tokenFinal.bars.hpCurrent).toBe(12);
    expect(tokenFinal.rev).toBeGreaterThanOrEqual(2);

    // Repetir op_npc_a (B7.2) não altera HP
    const dup = await tokenService.adjustTokenResource({
      campaignId: CAMPAIGN,
      sceneId: SCENE,
      token: { ...initialToken, rev: tokenFinal.rev },
      resourceKey: RESOURCE_KEYS.HP,
      delta: -5,
      opId: "op_npc_a",
      user: { uid: "player1" },
      realtimeDb: p1
    });
    expect(dup.applied).toBe(false);
    expect(dup.duplicate).toBe(true);
    const afterDup = (
      await rtdbGet(rtdbRef(p1, tokenSecretPath(CAMPAIGN, SCENE, "tok_npc_race")))
    ).val();
    expect(afterDup.hp.current).toBe(12);
  });
});

describe("Hardening Fase 8 — Restrições de kind e image.url nas regras RTDB", () => {
  it("rejeita criação por não-GM com kind: 'npc' e aceita kind: 'free'", async () => {
    const p1 = rtdbAs("player1");
    await assertFails(
      rtdbSet(
        rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_p1_npc")),
        buildValidPublicToken({
          id: "tok_p1_npc",
          kind: TOKEN_KINDS.NPC,
          ownerId: "player1",
          controlledBy: { player1: true }
        })
      )
    );
    await assertSucceeds(
      rtdbSet(
        rtdbRef(p1, tokenPath(CAMPAIGN, SCENE, "tok_p1_free")),
        buildValidPublicToken({
          id: "tok_p1_free",
          kind: TOKEN_KINDS.FREE,
          ownerId: "player1",
          controlledBy: { player1: true }
        })
      )
    );
  });

  it("rejeita image.url com comprimento >= 2048 em tokens e hiddenTokens", async () => {
    const gm = rtdbAs("gm_a");
    const validUrl = "https://example.com/" + "a".repeat(32);
    const oversizedUrl = "https://example.com/" + "a".repeat(2030);
    expect(oversizedUrl.length).toBeGreaterThanOrEqual(2048);

    await assertFails(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_pub_longurl")),
        buildValidPublicToken({
          id: "tok_pub_longurl",
          ownerId: "gm_a",
          image: { url: oversizedUrl }
        })
      )
    );
    await assertSucceeds(
      rtdbSet(
        rtdbRef(gm, tokenPath(CAMPAIGN, SCENE, "tok_pub_okurl")),
        buildValidPublicToken({
          id: "tok_pub_okurl",
          ownerId: "gm_a",
          image: { url: validUrl }
        })
      )
    );

    await assertFails(
      rtdbSet(
        rtdbRef(gm, hiddenTokenPath(CAMPAIGN, SCENE, "tok_hid_longurl")),
        buildValidPublicToken({
          id: "tok_hid_longurl",
          ownerId: "gm_a",
          hidden: true,
          image: { url: oversizedUrl }
        })
      )
    );
    await assertSucceeds(
      rtdbSet(
        rtdbRef(gm, hiddenTokenPath(CAMPAIGN, SCENE, "tok_hid_okurl")),
        buildValidPublicToken({
          id: "tok_hid_okurl",
          ownerId: "gm_a",
          hidden: true,
          image: { url: validUrl }
        })
      )
    );
  });
});
