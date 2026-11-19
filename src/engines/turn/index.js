export {
  advanceTurnInState,
  canActorAct,
  canActorMove,
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
} from "./turnState.js";
export {
  createFrozenTurnPolicy,
  createPermissiveTurnPolicy
} from "./turnPolicy.js";
export { computeMoveDistanceMeters } from "../geometry/index.js";
export { DEFAULT_COMBAT_STATE } from "../../domain/defaults.js";
export { DEFAULT_MOVEMENT_BUDGET_METERS } from "../../domain/constants.js";
