import { useEffect, useRef } from "react";

export function isEditableEventTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(target.isContentEditable)
  );
}

/**
 * FUN-23: despachante único de teclado do tabuleiro com guarda uniforme de campos em foco.
 * Unifica os 4 listeners separados do `BoardViewport` anterior.
 */
export function useBoardHotkeys({
  toolMode,
  aoeDemarcateConfig,
  snowballAimActive,
  hasLockedMeasure = false,
  hasInlineTextEditor = false,
  hasSelection = false,
  onCancelAoe,
  onCancelSnowball,
  onClearMeasure,
  onCloseInlineText,
  onToggleTargetByHotkey,
  onDeleteSelected,
  onSelectMeasureLine,
  onSelectOrCycleCone,
  onSelectMeasureCircle
}) {
  const tKeyHeldRef = useRef(false);
  const handlersRef = useRef({});

  useEffect(() => {
    handlersRef.current = {
      toolMode,
      aoeDemarcateConfig,
      snowballAimActive,
      hasLockedMeasure,
      hasInlineTextEditor,
      hasSelection,
      onCancelAoe,
      onCancelSnowball,
      onClearMeasure,
      onCloseInlineText,
      onToggleTargetByHotkey,
      onDeleteSelected,
      onSelectMeasureLine,
      onSelectOrCycleCone,
      onSelectMeasureCircle
    };
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditableEventTarget(e.target)) {
        return;
      }

      const h = handlersRef.current;

      if (e.key === "Escape") {
        if (h.aoeDemarcateConfig) {
          h.onCancelAoe?.();
          return;
        }
        if (h.snowballAimActive) {
          h.onCancelSnowball?.();
          return;
        }
        if (h.hasInlineTextEditor) {
          h.onCloseInlineText?.();
          return;
        }
        if (h.hasLockedMeasure) {
          h.onClearMeasure?.();
          return;
        }
        return;
      }

      if (e.key === "t" || e.key === "T") {
        tKeyHeldRef.current = true;
        if (!e.repeat) {
          h.onToggleTargetByHotkey?.();
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && h.hasSelection) {
        h.onDeleteSelected?.();
        return;
      }

      if (h.toolMode === "measure") {
        if (e.key === "c" || e.key === "C" || e.key === "2") {
          h.onSelectOrCycleCone?.();
        } else if (e.key === "l" || e.key === "L" || e.key === "1") {
          h.onSelectMeasureLine?.();
        } else if (e.key === "o" || e.key === "O" || e.key === "3") {
          h.onSelectMeasureCircle?.();
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "t" || e.key === "T") {
        tKeyHeldRef.current = false;
      }
    };

    const handleContextMenu = (e) => {
      if (handlersRef.current.snowballAimActive) {
        e.preventDefault();
        handlersRef.current.onCancelSnowball?.();
      }
    };

    const handleWindowBlur = () => {
      tKeyHeldRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return { tKeyHeldRef };
}
