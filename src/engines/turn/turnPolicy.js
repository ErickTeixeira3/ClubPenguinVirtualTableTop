import { DEFAULT_MOVEMENT_BUDGET_METERS } from "../../domain/constants.js";
import {
  evaluateActorAct,
  evaluateActorMove,
  findCombatantByActor,
  getActiveCombatant,
  isActorTurn,
  normalizeCombatState
} from "./turnState.js";

/**
 * Interface de politica de Modo de Turno (U1 — comportamento congelado).
 * Isola o tabuleiro e acoes de combate de `combatState`, permitindo trocar a
 * implementacao futura sem reescrever componentes.
 */
export function createFrozenTurnPolicy({
  combatState = null,
  isGM = false,
  onConsumeMovement = null,
  onConsumeAction = null
} = {}) {
  const state = normalizeCombatState(combatState);
  const activeCombatant = getActiveCombatant(state);

  const canMove = (actorRef, distanceMeters = 0, options = {}) =>
    evaluateActorMove(state, actorRef, distanceMeters, {
      isGM: options.isGM ?? isGM
    });
  const canAct = (actorRef, actionKind = "active", options = {}) =>
    evaluateActorAct(state, actorRef, actionKind, {
      isGM: options.isGM ?? isGM,
      isFollowUp: options.isFollowUp ?? false
    });

  return Object.freeze({
    isActive: state.active,
    combatState: state,
    activeCombatant,
    canMove,
    canAct,
    canActorMove: canMove,
    canActorAct: canAct,
    isActorTurn(actorRef) {
      return isActorTurn(state, actorRef);
    },
    findCombatant(actorRef) {
      return findCombatantByActor(state, actorRef);
    },
    consumeMovement(actorRef, distanceMeters) {
      if (typeof onConsumeMovement === "function" && distanceMeters > 0) {
        return onConsumeMovement(actorRef, distanceMeters);
      }
      return null;
    },
    consumeAction(actorRef, actionKind = "active") {
      if (typeof onConsumeAction === "function") {
        return onConsumeAction(actorRef, actionKind);
      }
      return null;
    }
  });
}

export function createPermissiveTurnPolicy() {
  const state = normalizeCombatState(null);
  const canMove = (_actorRef, distanceMeters = 0) => ({
    allowed: true,
    reason: null,
    remainingMeters: DEFAULT_MOVEMENT_BUDGET_METERS,
    nextMovementUsedMeters: Math.max(0, Number(distanceMeters) || 0),
    combatant: null
  });
  const canAct = () => ({
    allowed: true,
    reason: null,
    budgetField: null,
    combatant: null
  });

  return Object.freeze({
    isActive: false,
    combatState: state,
    activeCombatant: null,
    canMove,
    canAct,
    canActorMove: canMove,
    canActorAct: canAct,
    isActorTurn() {
      return true;
    },
    findCombatant() {
      return null;
    },
    consumeMovement() {
      return null;
    },
    consumeAction() {
      return null;
    }
  });
}
