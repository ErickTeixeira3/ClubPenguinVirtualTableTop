// Regressão portada de auditoria_refatoracao/validar-regressoes.mjs: A14, A15 (seletor), A18-A19, A21,
// A22, A23, A24-A27 e A33 (spawn). Não portados, por deixarem de valer no v2: A15 `attackWhenTargeted`
// (sai na Fase 9), A16-A17 (migração dentro do app, Fase 13) e A20 (protocolo de resistência em
// localStorage, que sai na Fase 9).
// Correção do porte (A21): o script original passava `costResource`/`costAmount`, que executeChatRollMessage
// ignora, e por isso nunca exercitava o desconto. Aqui o custo vai em `cost`, com controle positivo (PC).
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../support/fakeFirebase.js";
import { sourceContains } from "../support/sourcePin.js";

vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../support/fakeFirebase.js")).databaseModule);
vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);

const { ROLL_KINDS, evaluateActorAct, normalizeCombatState, resolveTokenTargetData } = await import(
  "../../src/engines/combatEngine.js"
);
const rollService = await import("../../src/services/rollService.js");
const combatService = await import("../../src/services/combatService.js");
const { readPendingAvatarDataUrl, savePendingAvatarDataUrl } = await import("../../src/infra/pendingAvatarStore.js");
const SheetRollsTab = (await import("../../src/components/sheets/tabs/SheetRollsTab.jsx")).default;

beforeEach(() => {
  resetFakeDb();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

describe("A14: /r com alvos", () => {
  it("anexa os alvos sem comparar Defesa (teste não é ataque)", async () => {
    const msg = await rollService.executeChatRollMessage({
      campaignId: "main-table",
      campaign: { gmId: "gm1" },
      user: { uid: "player1" },
      title: "Rolagem (/r)",
      primaryFormula: "1d20 + 2",
      primaryLabel: "Resultado",
      rollKind: ROLL_KINDS.CHECK,
      targetedTokens: [
        { id: "t1", defense: 12, sceneId: "s1" },
        { id: "t2", defense: 18, sceneId: "s1" }
      ]
    });
    expect(msg.rollData.targetInfo.targets).toHaveLength(2);
    expect(msg.rollData.targetInfo.isHit).toBeNull();
  });
});

describe("A15/A18/A19: atalhos e seletor de tipo", () => {
  it("A18: nome salvo no atalho que difere da perícia de origem é preservado", () => {
    const resolved = rollService.resolveDynamicRollEntry(
      { id: "r_lut", source: { type: "skill", id: "sk_luta" }, overrides: { name: "Perícia Luta" } },
      { skills: { sk_luta: { id: "sk_luta", name: "Combate Corpo a Corpo", attributeKey: "forca", bonus: 3 } } }
    );
    expect(resolved.name).toBe("Perícia Luta");
  });

  it("A19: o slot da hotbar resolvido preserva o rollId", () => {
    const resolved = rollService.resolveHotbarSlot(
      { rollId: "r_disp" },
      { id: "c1", rollGroups: { g1: { id: "g1", rolls: { r_disp: { id: "r_disp", source: { type: "custom", id: null }, overrides: { name: "Disparo" }, custom: { hitFormula: "1d20+5" } } } } } }
    );
    expect(resolved.rollId).toBe("r_disp");
  });

  it("A15: o formulário de rolagem personalizada oferece Ataque e Teste", () => {
    const noop = () => {};
    const html = renderToStaticMarkup(
      <SheetRollsTab
        canEdit
        selectedGroupId={null}
        setSelectedGroupId={noop}
        rollGroups={[]}
        skills={[]}
        abilities={[]}
        character={{ id: "c1", rollGroups: [], attributes: [], abilities: [], skills: [], inventory: [], hotbar: [] }}
        triggerRoll={noop}
        handleDemarcateArea={noop}
        onUpdateCharacter={noop}
        pinToRollGroup={noop}
        rollsForm={{
          newGroupName: "", setNewGroupName: noop, setNewCustomRollOpen: noop, importFromSheetOpen: false,
          setImportFromSheetOpen: noop, newCustomRollOpen: true, crName: "", setCrName: noop,
          setShowRollIconPicker: noop, crIcon: "sword", showRollIconPicker: false, setCrIcon: noop,
          crColor: "#02529c", setCrColor: noop, crHit: "1d20", setCrHit: noop, crEffect: "", setCrEffect: noop,
          crCostRes: "mp", setCrCostRes: noop, crCostAmt: 0, setCrCostAmt: noop, crEffectType: "damage",
          setCrEffectType: noop, crRollKind: "attack", setCrRollKind: noop, setEditingRollIconTarget: noop,
          setHotbarModalRoll: noop, crSaveEnabled: false, crSaveDc: "12", crSaveAttr: "vigor", crSaveDesc: "",
          setCrSaveEnabled: noop, setCrSaveDc: noop, setCrSaveAttr: noop, setCrSaveDesc: noop
        }}
      />
    );
    expect(html).toContain(`<option value="${ROLL_KINDS.ATTACK}" selected="">Ataque</option>`);
    expect(html).toContain(`<option value="${ROLL_KINDS.CHECK}">Teste</option>`);
  });
});

describe("A21: custo de habilidade de NPC sem instância identificável", () => {
  const rollWithCost = (character, onDeductResource) =>
    rollService.executeChatRollMessage({
      campaignId: "main-table",
      campaign: { gmId: "gm1" },
      user: { uid: "gm1" },
      character,
      title: "Habilidade",
      primaryFormula: "1d20",
      primaryLabel: "Acerto",
      rollKind: ROLL_KINDS.ATTACK,
      cost: { resource: "mp", amount: 3 },
      onDeductResource
    });

  it("matriz NPC sem token não desconta nem grava costPaid", async () => {
    const npc = { id: "npc_1", name: "Guarda", type: "npc", ownerId: "gm1", resources: { mp: { current: 15, max: 15 } } };
    const updateCharacterResource = vi.fn();
    const msg = await rollWithCost(npc, () =>
      combatService.deductActorResources({
        campaignId: "main-table",
        campaign: { gmId: "gm1" },
        character: npc,
        costs: { mp: 3 },
        actorToken: null,
        updateCharacterResource
      })
    );
    expect(msg.rollData.costPaid).toBeNull();
    expect(updateCharacterResource).not.toHaveBeenCalled();
  });

  it("controle: PC desconta na ficha e registra costPaid", async () => {
    const pc = { id: "pc_1", name: "Herói", type: "pc", ownerId: "player1", resources: { mp: { current: 15, max: 15 } } };
    const updateCharacterResource = vi.fn(async () => {});
    const msg = await rollWithCost(pc, () =>
      combatService.deductActorResources({
        campaignId: "main-table",
        campaign: { gmId: "gm1" },
        character: pc,
        costs: { mp: 3 },
        updateCharacterResource
      })
    );
    expect(updateCharacterResource).toHaveBeenCalledWith("pc_1", "mp", 12);
    expect(msg.rollData.costPaid).toEqual({ resource: "MP", amount: 3 });
  });
});

describe("A22: Defesa de instância de NPC", () => {
  it("a Defesa do token é a autoridade em cena", () => {
    const resolved = resolveTokenTargetData({
      targetedToken: { id: "tok_npc", characterId: "npc_1", characterType: "npc", isGmToken: true, defense: 18 },
      allCharacters: [{ id: "npc_1", type: "npc", defense: 12 }]
    });
    expect(resolved.defense).toBe(18);
  });
});

describe("A23: Modo de Turno e consumo de item", () => {
  it("bloqueia ação ativa fora da vez", () => {
    const offTurn = evaluateActorAct(
      normalizeCombatState({
        active: true,
        turnOrder: [
          { characterId: "other", actionsRemaining: 1 },
          { characterId: "pc1", actionsRemaining: 1 }
        ]
      }),
      { id: "pc1", attributes: [] },
      "active",
      { isGM: false }
    );
    expect(offTurn.allowed).toBe(false);
  });

  it("o inventário só consome o item quando a rolagem é aceita", () => {
    expect(
      sourceContains("src/components/sheets/tabs/SheetInventoryTab.jsx", "if (rollAccepted !== false && inspectedItem.consumeOnUse) {")
    ).toBe(true);
  });
});

describe("A24-A27: avatares e identidade do remetente", () => {
  it("A24: ficha com imagem externa envia a URL persistível", () => {
    const identity = rollService.resolveSpeakerIdentity({
      character: { id: "c1", name: "Pinguim URL", avatar: { mediaId: null, url: "https://example.invalid/p.png" } },
      user: { uid: "player1" }
    });
    expect(identity.senderPhotoURL).toBe("https://example.invalid/p.png");
  });

  it("A25-A26: jogador sem personagem fala como jogador e foto removida não volta à do Google", () => {
    const identity = rollService.resolveSpeakerIdentity({
      character: null,
      user: { uid: "player1", photoURL: "https://example.invalid/google.png" },
      playersMap: { player1: { uid: "player1", avatar: { mediaId: "med_p1", url: null } } }
    });
    expect(identity).toMatchObject({ type: "player", characterId: null, senderAvatarMediaId: "med_p1", photoURL: null });
    expect(sourceContains("src/services/profileService.js", 'authProfileUpdates.photoURL = "";')).toBe(true);
  });

  it("A27: o avatar pendente do cadastro fica isolado por uid", () => {
    const memory = new Map();
    vi.stubGlobal("sessionStorage", {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k)
    });
    savePendingAvatarDataUrl("uid_a", "data:image/webp;base64,QUJD");
    expect(readPendingAvatarDataUrl("uid_b")).toBeNull();
    savePendingAvatarDataUrl("uid_a", "data:image/webp;base64,QUJD");
    expect(readPendingAvatarDataUrl("uid_a")).toBe("data:image/webp;base64,QUJD");
    vi.unstubAllGlobals();
  });
});

describe("A33: token criado por quem não é Mestre", () => {
  it("controlledBy em mapa inclui o Mestre e o dono da ficha; o dono do token é quem criou", async () => {
    const token = await combatService.spawnCharacterTokenToScene({
      campaignId: "main-table",
      campaign: { gmId: "gm1" },
      user: { uid: "owner1" },
      isGM: false,
      canEditCharacter: () => true,
      activeScene: { id: "s1" },
      char: { id: "pc1", ownerId: "owner1", type: "pc", name: "Herói" }
    });
    expect(token.controlledBy).toEqual({ gm1: true, owner1: true });
    expect(token.ownerId).toBe("owner1");
    expect(fakeDb.writes[0]).toMatchObject({ store: "rtdb", op: "set", path: `vtt_realtime/main-table/tokens/s1/${token.id}` });
  });
});
