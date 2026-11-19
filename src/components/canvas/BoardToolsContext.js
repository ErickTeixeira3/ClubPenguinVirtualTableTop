import { createContext, useContext } from "react";

export const BoardToolsContext = createContext(null);

export function useBoardToolsContext() {
  const ctx = useContext(BoardToolsContext);
  if (!ctx) {
    throw new Error("useBoardToolsContext deve ser usado dentro de BoardToolsContext.Provider");
  }
  return ctx;
}
