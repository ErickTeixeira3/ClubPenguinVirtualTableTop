import { tokenizeTextWithAliases } from "../../engines/journal/index.js";
import LinkedCardSpan from "./LinkedCardSpan";

export default function NoteInteractiveView({
  sections = [],
  accessibleNotes = [],
  currentNoteId = null,
  ignoredAliases = [],
  canEdit = false,
  portalZIndex,
  onCaptureSelection,
  onOpenCard,
  onNegateLink
}) {
  return (
    <div
      onMouseUp={onCaptureSelection}
      onKeyUp={onCaptureSelection}
      style={{
        flex: 1,
        minHeight: "220px",
        overflowY: "auto",
        paddingRight: "4px",
        userSelect: "text",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}
    >
      {sections.map((sec, secIdx) => {
        const secTokens = tokenizeTextWithAliases(
          sec.content || "",
          accessibleNotes,
          currentNoteId,
          ignoredAliases
        );

        return (
          <div
            key={sec.id || secIdx}
            style={{
              background: "#ffffff",
              border: "2px solid #001b3a",
              borderRadius: "10px",
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 2px 4px rgba(0, 27, 58, 0.08)"
            }}
          >
            {sec.title?.trim() ? (
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  paddingBottom: "4px",
                  borderBottom: "1.5px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "2px",
                    background: "#02529c"
                  }}
                />
                {sec.title.trim()}
              </div>
            ) : null}

            <div
              style={{
                fontSize: "13px",
                lineHeight: "1.5",
                minHeight: "7.5em",
                maxHeight: "15em",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "#1e293b",
                paddingRight: "4px"
              }}
            >
              {sec.content?.trim() ? (
                secTokens.map((token, tokenIdx) => {
                  if (token.type === "link") {
                    return (
                      <LinkedCardSpan
                        key={`${token.note.id}_${secIdx}_${tokenIdx}`}
                        tokenText={token.text}
                        matchedNote={token.note}
                        term={token.term}
                        portalZIndex={portalZIndex}
                        onOpenCard={onOpenCard}
                        onNegateLink={canEdit ? onNegateLink : undefined}
                      />
                    );
                  }
                  return <span key={tokenIdx}>{token.text}</span>;
                })
              ) : (
                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                  (Bloco vazio)
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
