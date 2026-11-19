import { useCallback, useEffect, useMemo, useState } from "react";
import { CLIENT_VERSION } from "../domain/constants.js";
import { notifyError } from "../services/notificationService.js";
import {
  hasUnsavedChanges,
  performProtectedReload,
  registerUnsavedGuard,
  subscribeRuntimeConfig
} from "../services/runtimeConfigService.js";
import { useAuth } from "./AuthContext.jsx";
import { RuntimeConfigContext } from "./RuntimeConfigContext.js";

const DEFAULT_RUNTIME_STATE = {
  uid: null,
  exists: false,
  config: null,
  updateRequired: false,
  clientVersion: CLIENT_VERSION,
  error: ""
};

export default function RuntimeConfigProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(DEFAULT_RUNTIME_STATE);

  const uid = user?.uid || null;

  useEffect(() => {
    if (!uid) {
      return undefined;
    }

    return subscribeRuntimeConfig({
      clientVersion: CLIENT_VERSION,
      onChange: (next) => {
        setState({
          uid,
          exists: next.exists,
          config: next.config,
          updateRequired: next.updateRequired,
          clientVersion: next.clientVersion,
          error: ""
        });
      },
      onError: (err) => {
        const msg =
          err?.message || "Erro ao verificar a configuração de versão do cliente.";
        setState((prev) => ({
          ...prev,
          uid,
          error: msg
        }));
        notifyError(msg);
      }
    });
  }, [uid]);

  const activeState = uid && state.uid === uid ? state : DEFAULT_RUNTIME_STATE;

  const requestReload = useCallback(
    (options) => performProtectedReload(options),
    []
  );

  const value = useMemo(
    () => ({
      runtimeConfig: activeState.config,
      runtimeConfigExists: activeState.exists,
      updateRequired: activeState.updateRequired,
      clientVersion: activeState.clientVersion,
      runtimeConfigError: activeState.error,
      hasUnsavedChanges,
      registerUnsavedGuard,
      requestReload
    }),
    [activeState, requestReload]
  );

  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}
