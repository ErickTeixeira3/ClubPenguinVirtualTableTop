// Caracterização (Fase 0): Modo de Turno com comportamento CONGELADO (Decisão U1).
// Cobre o estado puro (combatEngine), a persistência (combatService, Firestore simulado) e a regra de
// desconto que vive inline no VTTLayout/BoardViewport (fixada por source pin):
// - "Mestre na Visão Player rola ação ativa no turno do ator e actionsRemaining é descontado";
// - "Mestre fora da Visão Player rola e nada é descontado";
// - "movimento descontado só quando o Mestre real arrasta".
// Defeitos congelados de propósito: consumo só pelo cliente do Mestre real e `actionsMax: 0` virando 1.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COMBAT_STATE,
  DEFAULT_MOVEMENT_BUDGET_METERS,
  advanceTurnInState,
  consumeActionInState,
  consumeMovementInState,
  createCombatantEntry,
  evaluateActorAct,
  evaluateActorMove,
  findCombatantByActor,
  getActiveCombatant,
  isActorTurn,
  normalizeCombatState,
  normalizeCombatant,
  regressTurnInState,
  sortTurnOrder
} from "../../src/engines/combatEngine.js";
import { sourceContains } from "../support/sourcePin.js";

const firestoreWrites = vi.hoisted(() => []);

vi.mock("../../src/infra/firebase.js", () => ({ db: {}, rtdb: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => ({ path: parts.join("/") }),
  serverTimestamp: () => "__SERVER_TIMESTAMP__",
  updateDoc: async (ref, payload) => {
    firestoreWrites.push({ path: ref.path, payload });
  }
}));
vi.mock("firebase/database", () => ({ ref: () => ({}), set: async () => {}, update: async () => {} }));

const combatService = await import("../../src/services/combatService.js");

const combatant = (id, extra = {}) => ({ combatantId: id, tokenId: id, characterId: `c_${id}`, name: id, ...extra });
const activeState = (extra = {}) =>
  normalizeCombatState({
    active: true,
    round: 1,
    activeTurnIndex: 0,
    turnOrder: [combatant("a"), combatant("b"), combatant("c")],
    ...extra
  });

beforeEach(() => {
  firestoreWrites.length = 0;
});

describe("estado: normalização e padrões", () => {
  it("estado vazio é inativo, rodada 1, travas ligadas", () => {
    expect(normalizeCombatState(null)).toEqual(DEFAULT_COMBAT_STATE);
    expect(normalizeCombatState({ lockMovementOutsideTurn: false, round: 0 })).toMatchObject({
      round: 1,
      lockMovementOutsideTurn: false,
      lockActionsOutsideTurn: true
    });
  });

  it("combatente recebe orçamentos padrão; actionsMax 0 vira 1 (defeito congelado)", () => {
    expect(normalizeCombatant({ tokenId: "t1" }, 0)).toEqual({
      combatantId: "t1",
      tokenId: "t1",
      characterId: null,
      ownerId: null,
      name: "Combatente",
      initiative: 0,
      movementBudgetMeters: DEFAULT_MOVEMENT_BUDGET_METERS,
      movementUsedMeters: 0,
      actionsMax: 1,
      actionsRemaining: 1,
      reactionsMax: 1,
      reactionsRemaining: 1
    });
    expect(normalizeCombatant({ actionsMax: 0 }).actionsMax).toBe(1);
    expect(normalizeCombatant({}, 4).combatantId).toBe("comb_4");
  });

  it("limita o índice ativo à ordem existente", () => {
    expect(normalizeCombatState({ turnOrder: [combatant("a")], activeTurnIndex: 9 }).activeTurnIndex).toBe(0);
  });

  it("ordena por iniciativa decrescente e desempata pelo nome", () => {
    const order = sortTurnOrder([
      combatant("Bruno", { initiative: 10 }),
      combatant("Ana", { initiative: 10 }),
      combatant("Caio", { initiative: 15 })
    ]);
    expect(order.map((c) => c.name)).toEqual(["Caio", "Ana", "Bruno"]);
  });

  it("createCombatantEntry usa o token e a ficha vinculada", () => {
    const entry = createCombatantEntry({
      token: { id: "tok1", characterId: "char1", ownerId: "u1", name: "Pinguim" },
      character: { id: "char1", movementBudgetMeters: 12 },
      initiative: "7"
    });
    expect(entry).toMatchObject({
      combatantId: "tok1",
      tokenId: "tok1",
      characterId: "char1",
      ownerId: "u1",
      name: "Pinguim",
      initiative: 7,
      movementBudgetMeters: 12,
      actionsRemaining: 1,
      reactionsRemaining: 1
    });
  });
});

describe("estado: identificação do ator e da vez", () => {
  it("encontra o combatente por id do combatente, do token ou da ficha, e por objetos de token/ficha", () => {
    const state = activeState();
    expect(findCombatantByActor(state, "b").name).toBe("b");
    expect(findCombatantByActor(state, "c_b").name).toBe("b");
    expect(findCombatantByActor(state, { id: "b", sceneId: "s1" }).name).toBe("b");
    expect(findCombatantByActor(state, { id: "c_c", attributes: [] }).name).toBe("c");
    expect(findCombatantByActor(state, "zzz")).toBeNull();
  });

  it("só é a vez do combatente ativo; com o turno inativo, é a vez de todos", () => {
    const state = activeState({ activeTurnIndex: 1 });
    expect(getActiveCombatant(state).name).toBe("b");
    expect(isActorTurn(state, "b")).toBe(true);
    expect(isActorTurn(state, "a")).toBe(false);
    expect(isActorTurn({ ...state, active: false }, "a")).toBe(true);
    expect(getActiveCombatant({ ...state, active: false })).toBeNull();
  });
});

describe("estado: iniciar, avançar, regredir, encerrar", () => {
  it("startTurnCombat ordena os tokens da camada de tokens e persiste no documento da campanha", async () => {
    await combatService.startTurnCombat({
      campaignId: "camp1",
      tokens: [
        { id: "t1", name: "Zed", layer: "tokens" },
        { id: "t2", name: "Ana" },
        { id: "t3", name: "Mapa", layer: "map" }
      ],
      allCharacters: []
    });
    expect(firestoreWrites).toHaveLength(1);
    const { path, payload } = firestoreWrites[0];
    expect(path).toBe("campaigns/camp1");
    expect(payload.updatedAt).toBe("__SERVER_TIMESTAMP__");
    expect(payload.combatState).toMatchObject({
      active: true,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true
    });
    expect(payload.combatState.turnOrder.map((c) => c.name)).toEqual(["Ana", "Zed"]);
  });

  it("avançar passa a vez, renova o orçamento de quem entra e vira a rodada no fim da ordem", () => {
    const spent = activeState({
      turnOrder: [combatant("a"), combatant("b", { actionsRemaining: 0, movementUsedMeters: 6, reactionsRemaining: 0 })]
    });
    const next = advanceTurnInState(spent);
    expect(next).toMatchObject({ round: 1, activeTurnIndex: 1 });
    expect(next.turnOrder[1]).toMatchObject({ actionsRemaining: 1, movementUsedMeters: 0, reactionsRemaining: 1 });

    const wrapped = advanceTurnInState(next);
    expect(wrapped).toMatchObject({ round: 2, activeTurnIndex: 0, active: true });
    expect(advanceTurnInState(normalizeCombatState({ active: true })).turnOrder).toEqual([]);
  });

  it("regredir volta a vez sem renovar orçamentos; no início da rodada 1 não faz nada", () => {
    const start = activeState();
    expect(regressTurnInState(start)).toEqual(start);
    const second = activeState({ activeTurnIndex: 1, turnOrder: [combatant("a", { actionsRemaining: 0 }), combatant("b")] });
    expect(regressTurnInState(second)).toMatchObject({ activeTurnIndex: 0, round: 1 });
    expect(regressTurnInState(second).turnOrder[0].actionsRemaining).toBe(0);
    const round2 = activeState({ round: 2, activeTurnIndex: 0 });
    expect(regressTurnInState(round2)).toMatchObject({ activeTurnIndex: 2, round: 1 });
  });

  it("encerrar desativa, zera a rodada e esvazia a ordem, mantendo as travas", async () => {
    await combatService.stopTurnCombat("camp1", activeState({ round: 3, lockActionsOutsideTurn: false }));
    expect(firestoreWrites[0].payload.combatState).toEqual({
      active: false,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: false,
      turnOrder: []
    });
  });

  it("avançar e regredir persistem o próximo estado", async () => {
    await combatService.advanceCampaignTurn("camp1", activeState());
    await combatService.regressCampaignTurn("camp1", activeState({ activeTurnIndex: 2 }));
    expect(firestoreWrites.map((w) => w.payload.combatState.activeTurnIndex)).toEqual([1, 1]);
  });
});

describe("travas: movimento", () => {
  it("fora do turno com trava: bloqueia; sem trava: permite", () => {
    const state = activeState();
    expect(evaluateActorMove(state, "b", 3)).toMatchObject({ allowed: false, reason: "Aguarde seu turno para mover este token." });
    expect(evaluateActorMove({ ...state, lockMovementOutsideTurn: false }, "b", 3).allowed).toBe(true);
  });

  it("na vez: limita ao deslocamento restante (com tolerância de 0,05 m)", () => {
    const state = activeState({ turnOrder: [combatant("a", { movementUsedMeters: 6 })] });
    expect(evaluateActorMove(state, "a", 3.04)).toMatchObject({ allowed: true, remainingMeters: 0, nextMovementUsedMeters: 9.04 });
    expect(evaluateActorMove(state, "a", 3.1)).toMatchObject({
      allowed: false,
      reason: "Deslocamento insuficiente (3,0m restantes).",
      remainingMeters: 3
    });
  });

  it("Mestre efetivo (isGM) e turno inativo não sofrem trava", () => {
    const state = activeState();
    expect(evaluateActorMove(state, "b", 50, { isGM: true }).allowed).toBe(true);
    expect(evaluateActorMove({ ...state, active: false }, "b", 50).allowed).toBe(true);
  });

  it("token fora da ordem de iniciativa: bloqueado com trava", () => {
    const state = activeState({ turnOrder: [] });
    expect(evaluateActorMove({ ...state, active: true }, "x", 1)).toMatchObject({ allowed: false });
  });

  it("consumir movimento soma ao usado, até o orçamento; inativo ou 0 m não muda", () => {
    const state = activeState();
    expect(consumeMovementInState(state, "a", 4.5).turnOrder[0].movementUsedMeters).toBe(4.5);
    expect(consumeMovementInState(state, "a", 50).turnOrder[0].movementUsedMeters).toBe(9);
    expect(consumeMovementInState(state, "a", 0)).toEqual(state);
    const inactive = { ...state, active: false };
    expect(consumeMovementInState(inactive, "a", 3)).toEqual(normalizeCombatState(inactive));
  });
});

describe("travas: ações", () => {
  it("ação ativa fora do turno com trava: bloqueia, indicando o orçamento de ações", () => {
    expect(evaluateActorAct(activeState(), "b", "active")).toMatchObject({
      allowed: false,
      reason: "Aguarde seu turno para realizar ações ativas.",
      budgetField: "actionsRemaining"
    });
  });

  it("ação ativa na vez: permitida enquanto houver ação; sem ação, bloqueia", () => {
    expect(evaluateActorAct(activeState(), "a", "active")).toMatchObject({ allowed: true, budgetField: "actionsRemaining", remaining: 1 });
    const spent = activeState({ turnOrder: [combatant("a", { actionsRemaining: 0 })] });
    expect(evaluateActorAct(spent, "a", "active")).toMatchObject({
      allowed: false,
      reason: "Você já utilizou sua ação neste turno."
    });
  });

  it.each(["reaction", "on_save", "on_being_hit", "saving_throw"])("%s usa o orçamento de reações em qualquer vez", (kind) => {
    expect(evaluateActorAct(activeState(), "b", kind)).toMatchObject({ allowed: true, budgetField: "reactionsRemaining" });
    const spent = activeState({ turnOrder: [combatant("a"), combatant("b", { reactionsRemaining: 0 })] });
    expect(evaluateActorAct(spent, "b", kind)).toMatchObject({ allowed: false, reason: "Sem reações disponíveis nesta rodada." });
  });

  it("teste, passiva, continuação e Mestre efetivo não usam orçamento", () => {
    const state = activeState();
    expect(evaluateActorAct(state, "b", "check")).toMatchObject({ allowed: true, budgetField: null });
    expect(evaluateActorAct(state, "b", "passive")).toMatchObject({ allowed: true, budgetField: null });
    expect(evaluateActorAct(state, "b", "active", { isFollowUp: true })).toMatchObject({ allowed: true, budgetField: null });
    expect(evaluateActorAct(state, "b", "active", { isGM: true })).toMatchObject({ allowed: true, budgetField: null });
  });

  it("consumir ação desconta a ação ou a reação; teste e passiva não descontam", () => {
    const state = activeState();
    expect(consumeActionInState(state, "a", "active").turnOrder[0].actionsRemaining).toBe(0);
    expect(consumeActionInState(state, "a", "on_being_hit").turnOrder[0].reactionsRemaining).toBe(0);
    expect(consumeActionInState(state, "a", "check")).toEqual(state);
    expect(consumeActionInState(state, "a", "passive")).toEqual(state);
  });
});

describe("desconto pelo cliente do Mestre real (VTTLayout/TurnPolicy/useTokenDrag)", () => {
  const VTT = "src/components/layout/VTTLayout.jsx";
  const DRAG = "src/components/canvas/useTokenDrag.js";

  it("o código do desconto continua o mesmo (via TurnPolicyContext na Fase 8)", () => {
    expect(sourceContains("src/contexts/CampaignContext.jsx", "const isGM = isRealGM && !viewAsPlayer;")).toBe(true);
    expect(
      sourceContains(
        VTT,
        "const actCheck = evaluateActorAct(combatState, actor, resolvedActionKind, { isGM, isFollowUp: Boolean(rollParams.isFollowUp || rollParams.parentMessageId) });"
      )
    ).toBe(true);
    expect(
      sourceContains(
        VTT,
        "if ( combatState?.active && isRealGM && actor && actCheck.budgetField && !rollParams.isFollowUp && !rollParams.parentMessageId ) { await consumeCampaignTurnAction(campaignId, combatState, actor, resolvedActionKind); }"
      )
    ).toBe(true);
    expect(sourceContains(VTT, "if (!combatState?.active || !isRealGM) return; await consumeCampaignTurnMovement(campaignId, combatState, tokenObj, distanceMeters);")).toBe(true);
    expect(sourceContains(VTT, "onConsumeMovement={isRealGM ? handleConsumeTurnMovement : null}")).toBe(true);
    expect(sourceContains(DRAG, "const moveCheck = turnPolicy.canActorMove(tokenObj, distanceMeters, { isGM });")).toBe(true);
    expect(
      sourceContains(
        DRAG,
        'if (turnPolicy.isActive && tokenLayer === "tokens" && distanceMeters > 0.05) { turnPolicy.consumeMovement(tokenObj, distanceMeters); }'
      )
    ).toBe(true);
  });

  // Réplica fiel de handleExecuteSheetRoll (avaliação + desconto após a mensagem ser enviada).
  async function rollAndMaybeDiscount({ combatState, actor, kind, isRealGM, viewAsPlayer, isFollowUp = false }) {
    const isGM = isRealGM && !viewAsPlayer;
    const actCheck = evaluateActorAct(combatState, actor, kind, { isGM, isFollowUp });
    if (!actCheck.allowed) return { allowed: false };
    if (combatState?.active && isRealGM && actor && actCheck.budgetField && !isFollowUp) {
      await combatService.consumeCampaignTurnAction("camp1", combatState, actor, kind);
    }
    return { allowed: true };
  }

  // Réplica fiel do fim do arraste (BoardViewport) + handleConsumeTurnMovement (VTTLayout).
  async function dragAndMaybeDiscount({ combatState, token, meters, isRealGM, viewAsPlayer }) {
    const isGM = isRealGM && !viewAsPlayer;
    const onConsumeTurnMovement = isRealGM
      ? async (tok, dist) => {
          if (!combatState?.active || !isRealGM) return;
          await combatService.consumeCampaignTurnMovement("camp1", combatState, tok, dist);
        }
      : null;
    if (combatState?.active && meters > 0.05) {
      const moveCheck = evaluateActorMove(combatState, token, meters, { isGM });
      if (!moveCheck.allowed) return { allowed: false };
      await onConsumeTurnMovement?.(token, meters);
    }
    return { allowed: true };
  }

  it("Mestre na Visão Player rola ação ativa no turno do ator e actionsRemaining é descontado", async () => {
    const result = await rollAndMaybeDiscount({
      combatState: activeState(),
      actor: "a",
      kind: "active",
      isRealGM: true,
      viewAsPlayer: true
    });
    expect(result.allowed).toBe(true);
    expect(firestoreWrites).toHaveLength(1);
    expect(firestoreWrites[0].payload.combatState.turnOrder[0].actionsRemaining).toBe(0);
  });

  it("Mestre fora da Visão Player rola e nada é descontado", async () => {
    const result = await rollAndMaybeDiscount({
      combatState: activeState(),
      actor: "a",
      kind: "active",
      isRealGM: true,
      viewAsPlayer: false
    });
    expect(result.allowed).toBe(true);
    expect(firestoreWrites).toHaveLength(0);
  });

  it("jogador rola na própria vez: permitido, mas o cliente dele não desconta", async () => {
    const result = await rollAndMaybeDiscount({ combatState: activeState(), actor: "a", kind: "active", isRealGM: false });
    expect(result.allowed).toBe(true);
    expect(firestoreWrites).toHaveLength(0);
  });

  it("continuação de rolagem não é avaliada nem descontada", async () => {
    await rollAndMaybeDiscount({ combatState: activeState(), actor: "b", kind: "active", isRealGM: true, viewAsPlayer: true, isFollowUp: true });
    expect(firestoreWrites).toHaveLength(0);
  });

  it("movimento descontado só quando o Mestre real arrasta", async () => {
    await dragAndMaybeDiscount({ combatState: activeState(), token: { id: "a", sceneId: "s1" }, meters: 3, isRealGM: false });
    expect(firestoreWrites).toHaveLength(0);

    await dragAndMaybeDiscount({ combatState: activeState(), token: { id: "a", sceneId: "s1" }, meters: 3, isRealGM: true, viewAsPlayer: false });
    expect(firestoreWrites).toHaveLength(1);
    expect(firestoreWrites[0].payload.combatState.turnOrder[0].movementUsedMeters).toBe(3);

    firestoreWrites.length = 0;
    const blocked = await dragAndMaybeDiscount({
      combatState: activeState(),
      token: { id: "b", sceneId: "s1" },
      meters: 3,
      isRealGM: true,
      viewAsPlayer: true
    });
    expect(blocked.allowed).toBe(false);
    expect(firestoreWrites).toHaveLength(0);
  });
});
