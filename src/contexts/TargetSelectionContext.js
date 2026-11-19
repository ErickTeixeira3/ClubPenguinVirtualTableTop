import { createContext, useContext } from "react";

const NOOP = () => {};

const DEFAULT_TARGET_SELECTION = Object.freeze({
  targetedTokenIds: [],
  targetedTokens: [],
  primaryTarget: null,
  toggleTarget: NOOP,
  setTargetIds: NOOP,
  clearTargets: NOOP,
  isTargeted: () => false
});

export const TargetSelectionContext = createContext(DEFAULT_TARGET_SELECTION);

export function useTargetSelection() {
  return useContext(TargetSelectionContext) || DEFAULT_TARGET_SELECTION;
}
