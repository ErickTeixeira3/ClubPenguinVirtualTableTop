import { useMemo } from "react";
import { createFrozenTurnPolicy } from "../engines/turn/index.js";
import { TurnPolicyContext } from "./TurnPolicyContext.js";

/**
 * Provedor da política de Modo de Turno (U1 — comportamento congelado).
 * Aceita uma `policy` injetada para testes ou constrói a política congelada a partir de `combatState`.
 */
export default function TurnPolicyProvider({
  combatState = null,
  isGM = false,
  onConsumeMovement = null,
  onConsumeAction = null,
  policy = null,
  children
}) {
  const value = useMemo(() => {
    if (policy) return policy;
    return createFrozenTurnPolicy({
      combatState,
      isGM,
      onConsumeMovement,
      onConsumeAction
    });
  }, [policy, combatState, isGM, onConsumeMovement, onConsumeAction]);

  return (
    <TurnPolicyContext.Provider value={value}>
      {children}
    </TurnPolicyContext.Provider>
  );
}
