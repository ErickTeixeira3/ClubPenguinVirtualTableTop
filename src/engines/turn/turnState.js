import {
  DEFAULT_MOVEMENT_BUDGET_METERS,
  ID_PREFIXES
} from "../../domain/constants.js";
import {
  DEFAULT_COMBATANT_BUDGETS,
  DEFAULT_NAMES
} from "../../domain/defaults.js";

const REACTION_KINDS = new Set([
  "reaction",
  "on_save",
  "on_being_hit",
  "saving_throw"
]);

export function normalizeCombatant(entry = {}, fallbackIndex = 0) {
  const safeEntry = entry && typeof entry === "object" ? entry : {};
  const movementBudgetMeters = Number(
    safeEntry.movementBudgetMeters ?? DEFAULT_MOVEMENT_BUDGET_METERS
  );
  const movementUsedMeters = Math.max(
    0,
    Number(safeEntry.movementUsedMeters ?? 0) || 0
  );
  // U1 frozen behavior: actionsMax/reactionsMax 0 coerces to 1
  const actionsMax = Math.max(
    0,
    Number(safeEntry.actionsMax ?? DEFAULT_COMBATANT_BUDGETS.actionsMax) || 1
  );
  const actionsRemaining = Math.max(
    0,
    Number(
      safeEntry.actionsRemaining !== undefined
        ? safeEntry.actionsRemaining
        : actionsMax
    ) || 0
  );
  const reactionsMax = Math.max(
    0,
    Number(safeEntry.reactionsMax ?? DEFAULT_COMBATANT_BUDGETS.reactionsMax) || 1
  );
  const reactionsRemaining = Math.max(
    0,
    Number(
      safeEntry.reactionsRemaining !== undefined
        ? safeEntry.reactionsRemaining
        : reactionsMax
    ) || 0
  );

  return {
    combatantId:
      safeEntry.combatantId ||
      safeEntry.tokenId ||
      safeEntry.characterId ||
      `${ID_PREFIXES.COMBATANT}_${fallbackIndex}`,
    tokenId: safeEntry.tokenId || null,
    characterId: safeEntry.characterId || null,
    ownerId: safeEntry.ownerId || null,
    name: safeEntry.name || DEFAULT_NAMES.combatant,
    initiative: Number(safeEntry.initiative) || 0,
    movementBudgetMeters: Number.isFinite(movementBudgetMeters)
      ? Math.max(0, movementBudgetMeters)
      : DEFAULT_MOVEMENT_BUDGET_METERS,
    movementUsedMeters,
    actionsMax,
    actionsRemaining,
    reactionsMax,
    reactionsRemaining
  };
}

export function normalizeCombatState(rawCombatState = null) {
  const src =
    rawCombatState && typeof rawCombatState === "object" ? rawCombatState : {};
  const turnOrder = Array.isArray(src.turnOrder)
    ? src.turnOrder.map((c, idx) => normalizeCombatant(c, idx))
    : [];
  const rawIdx = Number(src.activeTurnIndex) || 0;
  const activeTurnIndex =
    turnOrder.length > 0
      ? Math.max(0, Math.min(turnOrder.length - 1, rawIdx))
      : 0;

  return {
    active: Boolean(src.active),
    round: Math.max(1, Number(src.round) || 1),
    activeTurnIndex,
    lockMovementOutsideTurn: src.lockMovementOutsideTurn !== false,
    lockActionsOutsideTurn: src.lockActionsOutsideTurn !== false,
    turnOrder
  };
}

export function getActiveCombatant(combatState) {
  const state = normalizeCombatState(combatState);
  if (!state.active || state.turnOrder.length === 0) {
    return null;
  }
  return state.turnOrder[state.activeTurnIndex];
}

function matchesCombatant(combatant, actorRef) {
  if (!actorRef) {
    return false;
  }
  if (typeof actorRef === "string") {
    return (
      combatant.combatantId === actorRef ||
      combatant.tokenId === actorRef ||
      combatant.characterId === actorRef
    );
  }
  if (typeof actorRef !== "object") {
    return false;
  }
  const refTokenId = actorRef.tokenId || (actorRef.sceneId ? actorRef.id : null);
  const refCharId =
    actorRef.characterId ||
    (!actorRef.sceneId && actorRef.attributes ? actorRef.id : null);
  if (actorRef.combatantId && combatant.combatantId === actorRef.combatantId) {
    return true;
  }
  if (refTokenId && combatant.tokenId === refTokenId) {
    return true;
  }
  if (refCharId && combatant.characterId === refCharId) {
    return true;
  }
  if (
    actorRef.id &&
    (combatant.combatantId === actorRef.id ||
      combatant.tokenId === actorRef.id ||
      combatant.characterId === actorRef.id)
  ) {
    return true;
  }
  return false;
}

export function findCombatantByActor(combatState, actorRef) {
  const state = normalizeCombatState(combatState);
  return state.turnOrder.find((c) => matchesCombatant(c, actorRef)) || null;
}

export function isActorTurn(combatState, actorRef) {
  const state = normalizeCombatState(combatState);
  if (!state.active) {
    return true;
  }
  const active = getActiveCombatant(state);
  return Boolean(active && matchesCombatant(active, actorRef));
}

export function evaluateActorMove(
  combatState,
  actorIdOrRef,
  distanceMeters = 0,
  options = {}
) {
  const state = normalizeCombatState(combatState);
  const safeOptions = options && typeof options === "object" ? options : {};
  const isGM = Boolean(safeOptions.isGM);
  const combatant = findCombatantByActor(state, actorIdOrRef);
  const dist = Math.max(0, Number(distanceMeters) || 0);

  if (!state.active || isGM) {
    return {
      allowed: true,
      reason: null,
      remainingMeters: combatant
        ? Math.max(0, combatant.movementBudgetMeters - combatant.movementUsedMeters)
        : DEFAULT_MOVEMENT_BUDGET_METERS,
      nextMovementUsedMeters: combatant
        ? combatant.movementUsedMeters + dist
        : dist,
      combatant
    };
  }

  const onTurn = isActorTurn(state, actorIdOrRef);
  if (!onTurn && state.lockMovementOutsideTurn) {
    return {
      allowed: false,
      reason: "Aguarde seu turno para mover este token.",
      remainingMeters: 0,
      nextMovementUsedMeters: combatant ? combatant.movementUsedMeters : 0,
      combatant
    };
  }

  if (!combatant) {
    return {
      allowed: true,
      reason: null,
      remainingMeters: 0,
      nextMovementUsedMeters: 0,
      combatant: null
    };
  }

  const remaining = Math.max(
    0,
    Number(
      (combatant.movementBudgetMeters - combatant.movementUsedMeters).toFixed(2)
    )
  );
  if (dist > remaining + 0.05) {
    return {
      allowed: false,
      reason: `Deslocamento insuficiente (${remaining.toFixed(1).replace(".", ",")}m restantes).`,
      remainingMeters: remaining,
      nextMovementUsedMeters: combatant.movementUsedMeters,
      combatant
    };
  }

  return {
    allowed: true,
    reason: null,
    remainingMeters: Number(Math.max(0, remaining - dist).toFixed(2)),
    nextMovementUsedMeters: Number(
      (combatant.movementUsedMeters + dist).toFixed(2)
    ),
    combatant
  };
}

export function canActorMove(
  combatState,
  actorIdOrRef,
  distanceMeters = 0,
  options = {}
) {
  return evaluateActorMove(combatState, actorIdOrRef, distanceMeters, options)
    .allowed;
}

export function evaluateActorAct(
  combatState,
  actorIdOrRef,
  actionKind = "active",
  options = {}
) {
  const state = normalizeCombatState(combatState);
  const safeOptions = options && typeof options === "object" ? options : {};
  const isGM = Boolean(safeOptions.isGM);
  const isFollowUp = Boolean(safeOptions.isFollowUp);
  const combatant = findCombatantByActor(state, actorIdOrRef);

  if (!state.active || isGM || isFollowUp || actionKind === "passive") {
    return {
      allowed: true,
      reason: null,
      budgetField: null,
      remaining: Infinity,
      combatant
    };
  }

  const kind = String(actionKind || "active").toLowerCase();
  if (REACTION_KINDS.has(kind)) {
    if (!combatant) {
      return {
        allowed: true,
        reason: null,
        budgetField: "reactionsRemaining",
        remaining: 1,
        combatant: null
      };
    }
    const rem = combatant.reactionsRemaining;
    return {
      allowed: rem > 0,
      reason: rem > 0 ? null : "Sem reações disponíveis nesta rodada.",
      budgetField: "reactionsRemaining",
      remaining: rem,
      combatant
    };
  }

  if (kind === "check") {
    return {
      allowed: true,
      reason: null,
      budgetField: null,
      remaining: Infinity,
      combatant
    };
  }

  const onTurn = isActorTurn(state, actorIdOrRef);
  if (!onTurn && state.lockActionsOutsideTurn) {
    return {
      allowed: false,
      reason: "Aguarde seu turno para realizar ações ativas.",
      budgetField: "actionsRemaining",
      remaining: 0,
      combatant
    };
  }

  if (!combatant) {
    return {
      allowed: true,
      reason: null,
      budgetField: "actionsRemaining",
      remaining: 0,
      combatant: null
    };
  }

  const rem = combatant.actionsRemaining;
  return {
    allowed: rem > 0,
    reason: rem > 0 ? null : "Você já utilizou sua ação neste turno.",
    budgetField: "actionsRemaining",
    remaining: rem,
    combatant
  };
}

export function canActorAct(
  combatState,
  actorIdOrRef,
  actionKind = "active",
  options = {}
) {
  return evaluateActorAct(combatState, actorIdOrRef, actionKind, options).allowed;
}

export function createCombatantEntry(options = {}, fallbackIndexArg = 0) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const {
    token = null,
    character = null,
    initiative = 0,
    combatantId = null,
    createId = null,
    fallbackIndex = fallbackIndexArg
  } = safeOptions;

  const parsedIndex = Number(fallbackIndex);
  const resolvedIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0;
  const generatedId =
    typeof createId === "function" ? createId(ID_PREFIXES.COMBATANT) : null;
  const resolvedId =
    combatantId ||
    token?.id ||
    character?.id ||
    generatedId ||
    `${ID_PREFIXES.COMBATANT}_${resolvedIndex}`;

  const budget = Number(
    character?.movementBudgetMeters ??
      token?.movementBudgetMeters ??
      DEFAULT_MOVEMENT_BUDGET_METERS
  );

  return normalizeCombatant(
    {
      combatantId: resolvedId,
      tokenId: token?.id || null,
      characterId: token?.characterId || character?.id || null,
      ownerId: token?.ownerId || character?.ownerId || null,
      name:
        token?.name ||
        token?.label ||
        character?.name ||
        DEFAULT_NAMES.combatant,
      initiative: Number(initiative) || 0,
      movementBudgetMeters: Number.isFinite(budget)
        ? budget
        : DEFAULT_MOVEMENT_BUDGET_METERS,
      movementUsedMeters: 0,
      actionsMax: DEFAULT_COMBATANT_BUDGETS.actionsMax,
      actionsRemaining: DEFAULT_COMBATANT_BUDGETS.actionsRemaining,
      reactionsMax: DEFAULT_COMBATANT_BUDGETS.reactionsMax,
      reactionsRemaining: DEFAULT_COMBATANT_BUDGETS.reactionsRemaining
    },
    resolvedIndex
  );
}

export function sortTurnOrder(turnOrder = []) {
  return [...(Array.isArray(turnOrder) ? turnOrder : [])]
    .map((c, idx) => normalizeCombatant(c, idx))
    .sort((a, b) => {
      const diff = b.initiative - a.initiative;
      if (diff !== 0) {
        return diff;
      }
      return a.name.localeCompare(b.name);
    });
}

function resetCombatantTurnBudgets(combatant) {
  return {
    ...combatant,
    movementUsedMeters: 0,
    actionsRemaining: combatant.actionsMax,
    reactionsRemaining: combatant.reactionsMax
  };
}

export function advanceTurnInState(combatState) {
  const state = normalizeCombatState(combatState);
  if (state.turnOrder.length === 0) {
    return state;
  }

  const isWrapping = state.activeTurnIndex + 1 >= state.turnOrder.length;
  const nextIndex = isWrapping ? 0 : state.activeTurnIndex + 1;
  const nextRound = isWrapping ? state.round + 1 : state.round;
  const nextTurnOrder = state.turnOrder.map((c, idx) =>
    idx === nextIndex ? resetCombatantTurnBudgets(c) : c
  );

  return {
    ...state,
    active: true,
    round: nextRound,
    activeTurnIndex: nextIndex,
    turnOrder: nextTurnOrder
  };
}

export function regressTurnInState(combatState) {
  const state = normalizeCombatState(combatState);
  if (state.turnOrder.length === 0) {
    return state;
  }

  const isAtStart = state.activeTurnIndex === 0;
  if (isAtStart && state.round <= 1) {
    return state;
  }

  const nextIndex = isAtStart
    ? state.turnOrder.length - 1
    : state.activeTurnIndex - 1;
  const nextRound = isAtStart ? Math.max(1, state.round - 1) : state.round;

  return {
    ...state,
    active: true,
    round: nextRound,
    activeTurnIndex: nextIndex
  };
}

export function consumeMovementInState(
  combatState,
  actorIdOrRef,
  distanceMeters = 0
) {
  const state = normalizeCombatState(combatState);
  if (!state.active) {
    return state;
  }
  const dist = Math.max(0, Number(distanceMeters) || 0);
  if (dist <= 0) {
    return state;
  }

  return {
    ...state,
    turnOrder: state.turnOrder.map((c) => {
      if (!matchesCombatant(c, actorIdOrRef)) {
        return c;
      }
      const nextUsed = Math.min(
        c.movementBudgetMeters,
        Number((c.movementUsedMeters + dist).toFixed(2))
      );
      return {
        ...c,
        movementUsedMeters: nextUsed
      };
    })
  };
}

export function consumeActionInState(
  combatState,
  actorIdOrRef,
  actionKind = "active"
) {
  const state = normalizeCombatState(combatState);
  if (!state.active) {
    return state;
  }
  const kind = String(actionKind || "active").toLowerCase();
  if (kind === "passive" || kind === "check") {
    return state;
  }

  const isReaction = REACTION_KINDS.has(kind);

  return {
    ...state,
    turnOrder: state.turnOrder.map((c) => {
      if (!matchesCombatant(c, actorIdOrRef)) {
        return c;
      }
      if (isReaction) {
        return {
          ...c,
          reactionsRemaining: Math.max(0, c.reactionsRemaining - 1)
        };
      }
      return {
        ...c,
        actionsRemaining: Math.max(0, c.actionsRemaining - 1)
      };
    })
  };
}
