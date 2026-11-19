import { describe, expect, it } from "vitest";
import { DEFAULT_MOVEMENT_BUDGET_METERS } from "../../../../src/domain/constants.js";
import { DEFAULT_COMBAT_STATE } from "../../../../src/domain/defaults.js";
import {
  DEFAULT_COMBAT_STATE as BARREL_COMBAT_STATE,
  DEFAULT_MOVEMENT_BUDGET_METERS as BARREL_MOVEMENT_BUDGET,
  advanceTurnInState,
  canActorAct,
  canActorMove,
  computeMoveDistanceMeters,
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
} from "../../../../src/engines/turn/index.js";

const combatant = (id, extra = {}) => ({
  combatantId: id,
  tokenId: id,
  characterId: `c_${id}`,
  name: id,
  ...extra
});

const activeState = (extra = {}) =>
  normalizeCombatState({
    active: true,
    round: 1,
    activeTurnIndex: 0,
    turnOrder: [combatant("a"), combatant("b"), combatant("c")],
    ...extra
  });

describe("turn/index barrel & cross-engine re-export", () => {
  it("re-exports constants and computeMoveDistanceMeters from geometry", () => {
    expect(BARREL_COMBAT_STATE).toEqual(DEFAULT_COMBAT_STATE);
    expect(BARREL_MOVEMENT_BUDGET).toBe(DEFAULT_MOVEMENT_BUDGET_METERS);
    expect(
      computeMoveDistanceMeters({ fromX: 0, fromY: 0, toX: 128, toY: 0, cellSizePx: 64 })
    ).toBe(3);
  });
});

describe("turn/turnState: normalizeCombatant & normalizeCombatState", () => {
  it("normalizes null/undefined/partial combatant entries and preserves U1 0 -> 1 coercion", () => {
    expect(normalizeCombatant()).toMatchObject({
      combatantId: "comb_0",
      tokenId: null,
      characterId: null,
      ownerId: null,
      name: "Combatente",
      initiative: 0,
      movementBudgetMeters: 9,
      movementUsedMeters: 0,
      actionsMax: 1,
      actionsRemaining: 1,
      reactionsMax: 1,
      reactionsRemaining: 1
    });

    expect(normalizeCombatant(null, 2).combatantId).toBe("comb_2");
    expect(normalizeCombatant({ characterId: "char1" }).combatantId).toBe("char1");
    expect(normalizeCombatant({ tokenId: "tok1" }).combatantId).toBe("tok1");
    expect(normalizeCombatant({ combatantId: "c1", tokenId: "tok1" }).combatantId).toBe("c1");

    // Frozen U1 defect: actionsMax/reactionsMax 0 coerces to 1
    expect(normalizeCombatant({ actionsMax: 0, reactionsMax: 0 })).toMatchObject({
      actionsMax: 1,
      actionsRemaining: 1,
      reactionsMax: 1,
      reactionsRemaining: 1
    });

    expect(
      normalizeCombatant({
        movementBudgetMeters: "bad",
        movementUsedMeters: -4,
        actionsMax: 2,
        actionsRemaining: 0,
        reactionsMax: -3,
        reactionsRemaining: "bad",
        initiative: "bad"
      })
    ).toMatchObject({
      initiative: 0,
      movementBudgetMeters: 9,
      movementUsedMeters: 0,
      actionsMax: 2,
      actionsRemaining: 0,
      reactionsMax: 0,
      reactionsRemaining: 0
    });

    expect(normalizeCombatant({ movementBudgetMeters: -5 }).movementBudgetMeters).toBe(0);
  });

  it("normalizes combatState, clamps activeTurnIndex, and respects lock flags", () => {
    expect(normalizeCombatState(null)).toEqual(DEFAULT_COMBAT_STATE);
    expect(normalizeCombatState("bad")).toEqual(DEFAULT_COMBAT_STATE);

    expect(
      normalizeCombatState({
        active: true,
        round: 0,
        activeTurnIndex: 99,
        lockMovementOutsideTurn: false,
        lockActionsOutsideTurn: false,
        turnOrder: [combatant("a"), combatant("b")]
      })
    ).toMatchObject({
      active: true,
      round: 1,
      activeTurnIndex: 1,
      lockMovementOutsideTurn: false,
      lockActionsOutsideTurn: false
    });

    expect(normalizeCombatState({ activeTurnIndex: -5, turnOrder: "bad" })).toMatchObject({
      activeTurnIndex: 0,
      turnOrder: []
    });
  });

  it("gets active combatant only when active and turnOrder non-empty", () => {
    expect(getActiveCombatant(null)).toBeNull();
    expect(getActiveCombatant({ active: true, turnOrder: [] })).toBeNull();
    expect(getActiveCombatant(activeState({ activeTurnIndex: 1 })).combatantId).toBe("b");
  });
});

describe("turn/turnState: findCombatantByActor & isActorTurn", () => {
  it("matches by string ID and token/character/combatant object shapes", () => {
    const state = activeState();
    expect(findCombatantByActor(state, null)).toBeNull();
    expect(findCombatantByActor(state, 123)).toBeNull();
    expect(findCombatantByActor(state, "b").name).toBe("b");
    expect(findCombatantByActor(state, "c_b").name).toBe("b");
    expect(findCombatantByActor(state, "missing")).toBeNull();

    expect(findCombatantByActor(state, { combatantId: "a" }).name).toBe("a");
    expect(findCombatantByActor(state, { tokenId: "b" }).name).toBe("b");
    expect(findCombatantByActor(state, { id: "b", sceneId: "s1" }).name).toBe("b");
    expect(findCombatantByActor(state, { characterId: "c_c" }).name).toBe("c");
    expect(findCombatantByActor(state, { id: "c_c", attributes: {} }).name).toBe("c");
    expect(findCombatantByActor(state, { id: "a" }).name).toBe("a");
    expect(findCombatantByActor(state, { id: "c_b" }).name).toBe("b");
    expect(findCombatantByActor(state, { id: "unknown" })).toBeNull();
  });

  it("checks turn ownership and allows everyone when combat is inactive", () => {
    const state = activeState({ activeTurnIndex: 1 });
    expect(isActorTurn(state, "b")).toBe(true);
    expect(isActorTurn(state, "a")).toBe(false);
    expect(isActorTurn({ ...state, active: false }, "a")).toBe(true);
    expect(isActorTurn({ active: true, turnOrder: [] }, "a")).toBe(false);
  });
});

describe("turn/turnState: evaluateActorMove & canActorMove", () => {
  it("allows movement when inactive or isGM (including null options and unknown actor)", () => {
    const state = activeState();
    expect(evaluateActorMove({ ...state, active: false }, "a", 5, null)).toMatchObject({
      allowed: true,
      remainingMeters: 9,
      nextMovementUsedMeters: 5
    });
    expect(evaluateActorMove({ ...state, active: false }, "unknown", 5)).toMatchObject({
      allowed: true,
      remainingMeters: 9,
      nextMovementUsedMeters: 5,
      combatant: null
    });
    expect(evaluateActorMove(state, "b", 50, { isGM: true }).allowed).toBe(true);
    expect(canActorMove(state, "b", 50, { isGM: true })).toBe(true);
  });

  it("enforces lockMovementOutsideTurn, missing combatant, 0.05m tolerance, and budget", () => {
    const state = activeState({ turnOrder: [combatant("a", { movementUsedMeters: 6 }), combatant("b")] });

    expect(evaluateActorMove(state, "b", 3)).toEqual({
      allowed: false,
      reason: "Aguarde seu turno para mover este token.",
      remainingMeters: 0,
      nextMovementUsedMeters: 0,
      combatant: state.turnOrder[1]
    });

    expect(evaluateActorMove(state, "unknown", 3)).toMatchObject({
      allowed: false,
      reason: "Aguarde seu turno para mover este token.",
      combatant: null
    });

    expect(
      evaluateActorMove({ ...state, lockMovementOutsideTurn: false }, "unknown", 3)
    ).toEqual({
      allowed: true,
      reason: null,
      remainingMeters: 0,
      nextMovementUsedMeters: 0,
      combatant: null
    });

    // 3.04m <= 3m + 0.05m tolerance -> allowed
    expect(evaluateActorMove(state, "a", 3.04)).toMatchObject({
      allowed: true,
      reason: null,
      remainingMeters: 0,
      nextMovementUsedMeters: 9.04
    });

    // 3.1m > 3m + 0.05m -> blocked with Portuguese reason
    expect(evaluateActorMove(state, "a", 3.1)).toMatchObject({
      allowed: false,
      reason: "Deslocamento insuficiente (3,0m restantes).",
      remainingMeters: 3,
      nextMovementUsedMeters: 6
    });
    expect(canActorMove(state, "a", 3.1)).toBe(false);
    expect(evaluateActorMove(state, "a", "bad").allowed).toBe(true);
  });
});

describe("turn/turnState: evaluateActorAct & canActorAct", () => {
  it("allows inactive, isGM, isFollowUp, passive, and check actions with Infinity", () => {
    const state = activeState();
    expect(evaluateActorAct({ ...state, active: false }, "b", "active", null)).toMatchObject({
      allowed: true,
      budgetField: null,
      remaining: Number.POSITIVE_INFINITY
    });
    expect(evaluateActorAct(state, "b", "active", { isGM: true }).budgetField).toBeNull();
    expect(evaluateActorAct(state, "b", "active", { isFollowUp: true }).budgetField).toBeNull();
    expect(evaluateActorAct(state, "b", "passive").budgetField).toBeNull();
    expect(evaluateActorAct(state, "b", "CHECK")).toMatchObject({
      allowed: true,
      budgetField: null,
      remaining: Number.POSITIVE_INFINITY
    });
    expect(evaluateActorAct(state, "a", null).budgetField).toBe("actionsRemaining");
  });

  it("handles reactions for known and unknown combatants across all 4 reaction kinds", () => {
    const state = activeState({
      turnOrder: [combatant("a"), combatant("b", { reactionsRemaining: 0 })]
    });

    for (const kind of ["reaction", "on_save", "on_being_hit", "saving_throw", "REACTION"]) {
      expect(evaluateActorAct(state, "a", kind)).toMatchObject({
        allowed: true,
        budgetField: "reactionsRemaining",
        remaining: 1
      });
      expect(evaluateActorAct(state, "b", kind)).toMatchObject({
        allowed: false,
        reason: "Sem reações disponíveis nesta rodada.",
        budgetField: "reactionsRemaining",
        remaining: 0
      });
      expect(evaluateActorAct(state, "unknown", kind)).toEqual({
        allowed: true,
        reason: null,
        budgetField: "reactionsRemaining",
        remaining: 1,
        combatant: null
      });
    }
  });

  it("enforces turn lock, unknown actor, and remaining actions for active actions", () => {
    const state = activeState({
      turnOrder: [combatant("a", { actionsRemaining: 1 }), combatant("b")]
    });

    expect(evaluateActorAct(state, "b", "active")).toMatchObject({
      allowed: false,
      reason: "Aguarde seu turno para realizar ações ativas.",
      budgetField: "actionsRemaining"
    });
    expect(
      evaluateActorAct({ ...state, lockActionsOutsideTurn: false }, "unknown", "active")
    ).toMatchObject({
      allowed: true,
      reason: null,
      combatant: null
    });
    expect(canActorAct(state, "a", "active")).toBe(true);

    const spent = activeState({
      turnOrder: [combatant("a", { actionsRemaining: 0 })]
    });
    expect(evaluateActorAct(spent, "a", "active")).toMatchObject({
      allowed: false,
      reason: "Você já utilizou sua ação neste turno.",
      remaining: 0
    });
    expect(canActorAct(spent, "a", "active")).toBe(false);
  });
});

describe("turn/turnState: createCombatantEntry (purity & deterministic IDs)", () => {
  it("uses injectable createId or deterministic comb_N fallback without Date.now/Math.random", () => {
    const injected = createCombatantEntry({
      createId: (prefix) => `${prefix}_injected`
    });
    expect(injected.combatantId).toBe("comb_injected");

    const fallbackNullCreateId = createCombatantEntry(
      { createId: () => null, fallbackIndex: 3 }
    );
    expect(fallbackNullCreateId.combatantId).toBe("comb_3");

    const fallback2ndArg = createCombatantEntry(null, 4);
    expect(fallback2ndArg.combatantId).toBe("comb_4");

    expect(createCombatantEntry({ fallbackIndex: "bad" }).combatantId).toBe("comb_0");
  });

  it("prefers token/character metadata, supports token.label (v2), and handles bad budget/initiative", () => {
    const fromV2Token = createCombatantEntry({
      token: { id: "tok1", characterId: "char1", ownerId: "u1", label: "Pinguim V2" },
      character: { id: "char1", movementBudgetMeters: 12 },
      initiative: "7"
    });
    expect(fromV2Token).toMatchObject({
      combatantId: "tok1",
      tokenId: "tok1",
      characterId: "char1",
      ownerId: "u1",
      name: "Pinguim V2",
      initiative: 7,
      movementBudgetMeters: 12
    });

    const fromCharOnly = createCombatantEntry({
      character: { id: "char2", ownerId: "u2", name: "Mago" },
      initiative: "bad"
    });
    expect(fromCharOnly).toMatchObject({
      combatantId: "char2",
      tokenId: null,
      characterId: "char2",
      ownerId: "u2",
      name: "Mago",
      initiative: 0,
      movementBudgetMeters: 9
    });

    const badBudget = createCombatantEntry({
      combatantId: "explicit",
      token: { movementBudgetMeters: Number.NaN }
    });
    expect(badBudget.combatantId).toBe("explicit");
    expect(badBudget.movementBudgetMeters).toBe(9);
  });
});

describe("turn/turnState: sortTurnOrder, advance/regress, consume movement/action", () => {
  it("sorts descending by initiative and tie-breaks alphabetically by name", () => {
    expect(sortTurnOrder(null)).toEqual([]);
    const sorted = sortTurnOrder([
      { combatantId: "1", name: "Bruno", initiative: 10 },
      { combatantId: "2", name: "Ana", initiative: 10 },
      { combatantId: "3", name: "Caio", initiative: 15 },
      { combatantId: "4", name: "", initiative: "bad" }
    ]);
    expect(sorted.map((c) => c.combatantId)).toEqual(["3", "2", "1", "4"]);
  });

  it("advances turn (resetting incoming combatant) and regresses turn (preserving budgets)", () => {
    const empty = normalizeCombatState({ active: true });
    expect(advanceTurnInState(empty)).toEqual(empty);
    expect(regressTurnInState(empty)).toEqual(empty);

    const state = activeState({
      turnOrder: [
        combatant("a", { actionsRemaining: 0, movementUsedMeters: 4 }),
        combatant("b", {
          actionsMax: 2,
          actionsRemaining: 0,
          reactionsMax: 2,
          reactionsRemaining: 0,
          movementUsedMeters: 6
        })
      ]
    });

    const next = advanceTurnInState(state);
    expect(next).toMatchObject({ round: 1, activeTurnIndex: 1, active: true });
    expect(next.turnOrder[1]).toMatchObject({
      actionsRemaining: 2,
      reactionsRemaining: 2,
      movementUsedMeters: 0
    });
    // Outgoing combatant keeps its spent budget
    expect(next.turnOrder[0].actionsRemaining).toBe(0);

    const wrapped = advanceTurnInState(next);
    expect(wrapped).toMatchObject({ round: 2, activeTurnIndex: 0, active: true });

    // Regress at round 1 index 0 is no-op
    expect(regressTurnInState(state)).toEqual(state);

    // Regress from index 1 -> index 0 preserves spent budgets
    const back = regressTurnInState(next);
    expect(back).toMatchObject({ round: 1, activeTurnIndex: 0 });
    expect(back.turnOrder[0].actionsRemaining).toBe(0);

    // Regress wrapping round 2 index 0 -> round 1 last index
    const backWrap = regressTurnInState(wrapped);
    expect(backWrap).toMatchObject({ round: 1, activeTurnIndex: 1 });
  });

  it("consumes movement and actions only when active and matching", () => {
    const inactive = normalizeCombatState({ active: false, turnOrder: [combatant("a")] });
    expect(consumeMovementInState(inactive, "a", 3)).toEqual(inactive);
    expect(consumeActionInState(inactive, "a", "active")).toEqual(inactive);

    const state = activeState();
    expect(consumeMovementInState(state, "a", 0)).toEqual(state);
    expect(consumeMovementInState(state, "a", -2)).toEqual(state);

    const moved = consumeMovementInState(state, "a", 4.5);
    expect(moved.turnOrder[0].movementUsedMeters).toBe(4.5);
    expect(moved.turnOrder[1].movementUsedMeters).toBe(0);

    const capped = consumeMovementInState(moved, "a", 50);
    expect(capped.turnOrder[0].movementUsedMeters).toBe(9);

    expect(consumeActionInState(state, "a", "passive")).toEqual(state);
    expect(consumeActionInState(state, "a", "check")).toEqual(state);
    expect(consumeActionInState(state, "a", null).turnOrder[0].actionsRemaining).toBe(0);

    const reacted = consumeActionInState(state, "b", "on_save");
    expect(reacted.turnOrder[1].reactionsRemaining).toBe(0);
    expect(reacted.turnOrder[0].reactionsRemaining).toBe(1);
    expect(consumeActionInState(reacted, "b", "reaction").turnOrder[1].reactionsRemaining).toBe(0);
  });
});
