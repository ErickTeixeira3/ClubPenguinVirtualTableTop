import { createContext, useContext } from "react";
import { createPermissiveTurnPolicy } from "../engines/turn/index.js";

const DEFAULT_POLICY = createPermissiveTurnPolicy();

export const TurnPolicyContext = createContext(DEFAULT_POLICY);

export function useTurnPolicy() {
  return useContext(TurnPolicyContext) || DEFAULT_POLICY;
}
