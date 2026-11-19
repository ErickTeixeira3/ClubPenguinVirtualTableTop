import { DEFAULT_MOVEMENT_BUDGET_METERS } from "../constants.js";
import { DEFAULT_NAMES } from "../defaults.js";
import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCombatant(entry = {}, fallbackIndex = 0) {
  const src = isPlainRecord(entry) ? entry : {};
  const tokenId = trimOrNull(src.tokenId);
  const characterId = trimOrNull(src.characterId);
  const combatantId =
    trimOrNull(src.combatantId) ||
    tokenId ||
    characterId ||
    `comb_${fallbackIndex}`;
  const ownerId = trimOrNull(src.ownerId);
  const name = trimOrNull(src.name) || DEFAULT_NAMES.combatant;

  const rawBudget = Number(src.movementBudgetMeters);
  const movementBudgetMeters =
    Number.isFinite(rawBudget) && rawBudget >= 0
      ? rawBudget
      : DEFAULT_MOVEMENT_BUDGET_METERS;

  const movementUsedMeters = Math.max(
    0,
    Number(src.movementUsedMeters ?? 0) || 0
  );
  const actionsMax = Math.max(0, Number(src.actionsMax ?? 1) || 1);
  const actionsRemaining = Math.max(
    0,
    Number(
      src.actionsRemaining !== undefined ? src.actionsRemaining : actionsMax
    ) || 0
  );
  const reactionsMax = Math.max(0, Number(src.reactionsMax ?? 1) || 1);
  const reactionsRemaining = Math.max(
    0,
    Number(
      src.reactionsRemaining !== undefined
        ? src.reactionsRemaining
        : reactionsMax
    ) || 0
  );

  return {
    combatantId,
    tokenId,
    characterId,
    ownerId,
    name,
    initiative: Number(src.initiative) || 0,
    movementBudgetMeters,
    movementUsedMeters,
    actionsMax,
    actionsRemaining,
    reactionsMax,
    reactionsRemaining
  };
}

export function normalizeTurnState(raw = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const rawOrder = Array.isArray(src.turnOrder) ? src.turnOrder : [];
  const turnOrder = rawOrder.map((entry, idx) => normalizeCombatant(entry, idx));

  const round = Math.max(1, Number(src.round) || 1);
  const activeTurnIndex =
    turnOrder.length > 0
      ? Math.max(
          0,
          Math.min(turnOrder.length - 1, Math.trunc(Number(src.activeTurnIndex) || 0))
        )
      : 0;

  return {
    active: Boolean(src.active),
    round,
    activeTurnIndex,
    lockMovementOutsideTurn: src.lockMovementOutsideTurn !== false,
    lockActionsOutsideTurn: src.lockActionsOutsideTurn !== false,
    turnOrder
  };
}

export function validateTurnState(turnState) {
  const errors = [];

  if (!isPlainRecord(turnState)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "TurnState must be a non-null plain object.",
        { field: "turnState" }
      )
    ]);
  }

  for (const boolField of [
    "active",
    "lockMovementOutsideTurn",
    "lockActionsOutsideTurn"
  ]) {
    if (typeof turnState[boolField] !== "boolean") {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_TYPE,
          `TurnState ${boolField} must be a boolean.`,
          { field: boolField }
        )
      );
    }
  }

  if (
    typeof turnState.round !== "number" ||
    !Number.isInteger(turnState.round) ||
    turnState.round < 1
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "TurnState round must be an integer >= 1.",
        { field: "round", value: turnState.round }
      )
    );
  }

  if (!Array.isArray(turnState.turnOrder)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "TurnState turnOrder must be an array.",
        { field: "turnOrder" }
      )
    );
  } else {
    if (
      typeof turnState.activeTurnIndex !== "number" ||
      !Number.isInteger(turnState.activeTurnIndex) ||
      turnState.activeTurnIndex < 0 ||
      (turnState.turnOrder.length === 0 && turnState.activeTurnIndex !== 0) ||
      (turnState.turnOrder.length > 0 &&
        turnState.activeTurnIndex >= turnState.turnOrder.length)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.OUT_OF_RANGE,
          "TurnState activeTurnIndex is out of bounds for turnOrder.",
          { field: "activeTurnIndex", value: turnState.activeTurnIndex }
        )
      );
    }

    turnState.turnOrder.forEach((comb, idx) => {
      if (!isPlainRecord(comb)) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `turnOrder[${idx}] must be a plain object.`,
            { field: `turnOrder[${idx}]` }
          )
        );
        return;
      }
      if (!isTrimmedNonEmpty(comb.combatantId)) {
        errors.push(
          new AppError(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            `turnOrder[${idx}].combatantId must be a trimmed non-empty string.`,
            { field: `turnOrder[${idx}].combatantId` }
          )
        );
      }
      if (!isTrimmedNonEmpty(comb.name)) {
        errors.push(
          new AppError(
            ERROR_CODES.MISSING_REQUIRED_FIELD,
            `turnOrder[${idx}].name must be a trimmed non-empty string.`,
            { field: `turnOrder[${idx}].name` }
          )
        );
      }
      if (
        typeof comb.initiative !== "number" ||
        !Number.isFinite(comb.initiative)
      ) {
        errors.push(
          new AppError(
            ERROR_CODES.INVALID_TYPE,
            `turnOrder[${idx}].initiative must be a finite number.`,
            { field: `turnOrder[${idx}].initiative` }
          )
        );
      }
      for (const nonNeg of [
        "movementBudgetMeters",
        "movementUsedMeters",
        "actionsRemaining",
        "reactionsRemaining"
      ]) {
        if (
          typeof comb[nonNeg] !== "number" ||
          !Number.isFinite(comb[nonNeg]) ||
          comb[nonNeg] < 0
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.OUT_OF_RANGE,
              `turnOrder[${idx}].${nonNeg} must be >= 0.`,
              { field: `turnOrder[${idx}].${nonNeg}`, value: comb[nonNeg] }
            )
          );
        }
      }
      for (const posField of ["actionsMax", "reactionsMax"]) {
        if (
          typeof comb[posField] !== "number" ||
          !Number.isFinite(comb[posField]) ||
          comb[posField] < 1
        ) {
          errors.push(
            new AppError(
              ERROR_CODES.OUT_OF_RANGE,
              `turnOrder[${idx}].${posField} must be >= 1.`,
              { field: `turnOrder[${idx}].${posField}`, value: comb[posField] }
            )
          );
        }
      }
    });
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData) {
  return normalizeTurnState(docData);
}

export function toDoc(turnState) {
  return normalizeTurnState(turnState);
}

export { toDoc as toTurnStateDoc, fromDoc as fromTurnStateDoc };
