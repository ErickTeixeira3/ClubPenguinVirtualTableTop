import { useCallback, useEffect, useRef } from "react";

/**
 * Fase 5: debounce com flush (DIRETRIZES §2 / auditoria §3.3.6).
 * Retorna { run, flush, cancel }:
 * - run(...args): agenda a chamada para daqui a `delay` ms (reinicia o prazo a cada chamada);
 * - flush(): executa imediatamente a chamada pendente (usado no onBlur);
 * - cancel(): descarta a chamada pendente.
 * A chamada pendente também é executada quando o componente desmonta (nada digitado se perde).
 */
export function useDebouncedCallback(callback, delay = 400) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);
  const pendingArgsRef = useRef(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingArgsRef.current) {
      const args = pendingArgsRef.current;
      pendingArgsRef.current = null;
      callbackRef.current?.(...args);
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingArgsRef.current = null;
  }, []);

  const run = useCallback(
    (...args) => {
      pendingArgsRef.current = args;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, delay);
    },
    [delay, flush]
  );

  useEffect(() => flush, [flush]);

  // Fase 6.6 (A29): garante flush ao fechar aba/janela destacada ou ocultar a página antes do timer expirar
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleWindowFlush = () => {
      flush();
    };
    const handleVisibilityChange = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        flush();
      }
    };
    window.addEventListener("pagehide", handleWindowFlush);
    window.addEventListener("beforeunload", handleWindowFlush);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    return () => {
      window.removeEventListener("pagehide", handleWindowFlush);
      window.removeEventListener("beforeunload", handleWindowFlush);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [flush]);

  return { run, flush, cancel };
}
