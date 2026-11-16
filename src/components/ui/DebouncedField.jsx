import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";

/**
 * Fase 5: campo controlado com rascunho local e gravação debounced (400ms) + flush no onBlur.
 * Substitui inputs/textareas da Ficha que gravavam no Firestore a cada tecla.
 *
 * Fase 6.6 (A28, A30):
 * - A28: após onCommit concluir (ou normalizar/falhar mantendo externalValue), realinha o rascunho ao valor persistido.
 * - A30: se o valor externo mudar durante a digitação (ex.: dano do Mestre no token/ficha), cancela o commit pendente.
 *
 * Uso: troque `onChange={(e) => salvar(e.target.value)}` por `onCommit={(v) => salvar(v)}`.
 * - `as`: "input" (padrão) ou "textarea";
 * - `value`: valor persistido (atualizações externas aparecem imediatamente quando não há conflito);
 * - demais props são repassadas ao elemento NA MESMA ORDEM (HTML idêntico ao campo original).
 */
export default function DebouncedField(props) {
  const { as = "input", onCommit, delay = 400, ...domProps } = props;
  const externalValue = domProps.value;

  const [draft, setDraft] = useState(externalValue);
  const [prevExternal, setPrevExternal] = useState(externalValue);
  const [isDirty, setIsDirty] = useState(false);

  const mountedRef = useRef(true);
  const isDirtyRef = useRef(false);
  const editBaseExternalRef = useRef(externalValue);
  const latestExternalRef = useRef(externalValue);
  const commitSeqRef = useRef(0);

  // Sincroniza o valor vindo do banco (ex.: outro jogador, dano do Mestre, sync Token→Ficha)
  if (externalValue !== prevExternal) {
    setPrevExternal(externalValue);
    setDraft(externalValue);
    if (isDirty) setIsDirty(false);
  }

  const { run, flush, cancel } = useDebouncedCallback((nextValue) => {
    isDirtyRef.current = false;
    setIsDirty(false);
    const seq = ++commitSeqRef.current;
    const syncDraftToSaved = () => {
      if (
        mountedRef.current &&
        seq === commitSeqRef.current &&
        !isDirtyRef.current
      ) {
        setDraft(latestExternalRef.current);
      }
    };
    let result;
    try {
      result = onCommit?.(nextValue);
    } catch {
      syncDraftToSaved();
      return;
    }
    if (result && typeof result.then === "function") {
      result.then(syncDraftToSaved, syncDraftToSaved);
    } else {
      Promise.resolve().then(() => {
        if (nextValue !== latestExternalRef.current) {
          syncDraftToSaved();
        }
      });
    }
  }, delay);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestExternalRef.current = externalValue;
    if (
      isDirtyRef.current &&
      externalValue !== editBaseExternalRef.current
    ) {
      cancel();
      isDirtyRef.current = false;
      commitSeqRef.current += 1;
    }
  }, [externalValue, cancel]);

  const elementProps = {};
  for (const key of Object.keys(domProps)) {
    elementProps[key] = key === "value" ? draft : domProps[key];
  }
  elementProps.onChange = (e) => {
    const nextValue = e.target.value;
    if (!isDirtyRef.current) {
      editBaseExternalRef.current = externalValue;
    }
    isDirtyRef.current = true;
    commitSeqRef.current += 1;
    setDraft(nextValue);
    setIsDirty(true);
    run(nextValue);
  };
  elementProps.onBlur = (e) => {
    flush();
    domProps.onBlur?.(e);
  };

  const Tag = as;
  return <Tag {...elementProps} />;
}
