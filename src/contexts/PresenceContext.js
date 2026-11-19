import { createContext, useContext } from "react";

export const PresenceContext = createContext(null);

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error(
      "usePresence deve ser utilizado dentro de um PresenceProvider"
    );
  }
  return context;
}
