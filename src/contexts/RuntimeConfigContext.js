import { createContext, useContext } from "react";

export const RuntimeConfigContext = createContext(null);

export function useRuntimeConfig() {
  const context = useContext(RuntimeConfigContext);
  if (!context) {
    throw new Error(
      "useRuntimeConfig deve ser utilizado dentro de um RuntimeConfigProvider"
    );
  }
  return context;
}

export function useOptionalRuntimeConfig() {
  return useContext(RuntimeConfigContext);
}
