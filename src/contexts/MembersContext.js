import { createContext, useContext } from "react";

export const MembersContext = createContext(null);

export function useMembers() {
  const context = useContext(MembersContext);
  if (!context) {
    throw new Error("useMembers deve ser utilizado dentro de um MembersProvider");
  }
  return context;
}
