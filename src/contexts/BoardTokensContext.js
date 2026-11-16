import { createContext, useContext } from "react";

/**
 * Fase 5: tokens da cena ativa compartilhados entre a mesa (VTTLayout) e o tabuleiro (BoardViewport).
 * Substitui a mutação filho → pai via `boardSyncRef` (`onTokensSync`) da auditoria §4.5.
 * Valor: retorno de useRealtimeTokens(sceneId) + { sceneId }.
 */
export const BoardTokensContext = createContext(null);

export function useBoardTokens() {
  const ctx = useContext(BoardTokensContext);
  if (!ctx) {
    throw new Error("useBoardTokens deve ser utilizado dentro de um BoardTokensProvider");
  }
  return ctx;
}
