import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getNoteTypeMeta } from "./noteTypesUi";

export default function LinkedCardSpan({
  tokenText,
  matchedNote,
  term,
  portalZIndex,
  onOpenCard,
  onNegateLink
}) {
  const [popoverPos, setPopoverPos] = useState(null);
  const spanRef = useRef(null);
  const timeoutRef = useRef(null);
  const meta = getNoteTypeMeta(matchedNote?.noteType);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();

    const showAbove = rect.bottom + 65 > window.innerHeight;
    const topPos = showAbove ? rect.top - 6 : rect.bottom + 6;

    setPopoverPos({
      top: topPos,
      left: Math.max(
        140,
        Math.min(window.innerWidth - 140, rect.left + rect.width / 2)
      ),
      placement: showAbove ? "top" : "bottom"
    });
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setPopoverPos(null);
    }, 200);
  };

  return (
    <>
      <span
        ref={spanRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPopoverPos(null);
          onOpenCard?.(matchedNote);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={`${meta.singular}: ${matchedNote?.title}`}
        style={{
          background: `${meta.color}26`,
          borderBottom: `2.5px solid ${meta.color}`,
          color: "#001b3a",
          fontWeight: 800,
          padding: "1px 6px",
          borderRadius: "4px",
          cursor: "pointer",
          margin: "0 2px",
          display: "inline-block",
          transition: "all 0.15s ease",
          boxShadow: popoverPos ? `0 0 0 1.5px ${meta.color}` : "none"
        }}
      >
        {tokenText}
      </span>

      {popoverPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top:
                popoverPos.placement === "bottom"
                  ? `${popoverPos.top}px`
                  : undefined,
              bottom:
                popoverPos.placement === "top"
                  ? `${window.innerHeight - popoverPos.top}px`
                  : undefined,
              left: `${popoverPos.left}px`,
              transform: "translateX(-50%)",
              zIndex: portalZIndex,
              background: "#ffffff",
              border: "2px solid #001b3a",
              borderRadius: "8px",
              padding: "5px 8px",
              boxShadow: "0 6px 18px rgba(0, 27, 58, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              pointerEvents: "auto"
            }}
            onMouseEnter={() => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#001b3a",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <span
                style={{
                  background: meta.color,
                  color: meta.badgeTextColor,
                  padding: "1px 5px",
                  borderRadius: "4px",
                  fontSize: "10px"
                }}
              >
                {meta.singular}
              </span>
              {matchedNote?.title}
            </span>

            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{
                padding: "2px 7px",
                fontSize: "10px",
                fontWeight: 800
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPopoverPos(null);
                onOpenCard?.(matchedNote);
              }}
            >
              Abrir Card ↗
            </button>

            {onNegateLink && (
              <button
                type="button"
                title="Remover vínculo"
                style={{
                  background: "#ff5252",
                  border: "1.5px solid #001b3a",
                  borderRadius: "4px",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "10px",
                  padding: "2px 5px"
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPopoverPos(null);
                  onNegateLink(matchedNote, term);
                }}
              >
                ✕
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
