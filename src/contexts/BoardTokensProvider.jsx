import { BoardTokensContext } from "./BoardTokensContext";

/**
 * Fase 5: provedor dos tokens da cena ativa. O VTTLayout assina os tokens (useRealtimeTokens) uma
 * única vez e entrega o mesmo valor ao BoardViewport e às ações de combate da mesa.
 */
export default function BoardTokensProvider({ value, children }) {
  return <BoardTokensContext.Provider value={value}>{children}</BoardTokensContext.Provider>;
}
