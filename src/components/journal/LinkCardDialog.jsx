import { useMemo, useState } from "react";
import { normalizeAliasText } from "../../engines/journal/index.js";
import { getNoteTypeIcon, getNoteTypeMeta } from "./noteTypesUi";

export default function LinkCardDialog({
  termToLink,
  linkFilterText,
  accessibleNotes = [],
  currentNoteId = null,
  canEditTargetNote,
  modalZIndex,
  onChangeTerm,
  onChangeFilter,
  onConfirmLink,
  onError,
  onClose
}) {
  const [linkError, setLinkError] = useState("");

  const candidateCardsToLink = useMemo(() => {
    const q = linkFilterText.trim().toLowerCase();
    return accessibleNotes.filter((n) => {
      if (!n?.id || n.id === currentNoteId) return false;
      if (!q) return true;
      const matchTitle = (n.title || "").toLowerCase().includes(q);
      const matchAlias = (n.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return matchTitle || matchAlias;
    });
  }, [accessibleNotes, currentNoteId, linkFilterText]);

  const handleSelectCandidate = (cand) => {
    const finalTerm = termToLink.trim();
    if (!finalTerm || !cand?.id) return;
    if (normalizeAliasText(finalTerm).length < 2) {
      const msg = "Informe um termo com pelo menos 2 caracteres.";
      setLinkError(msg);
      onError?.(msg);
      return;
    }

    const norm = normalizeAliasText(finalTerm);
    const targetTerms = [
      cand.title,
      ...(Array.isArray(cand.aliases) ? cand.aliases : [])
    ];
    const alreadyHasTerm = targetTerms.some(
      (entry) => normalizeAliasText(entry) === norm
    );
    const requiresAliasAddition = !alreadyHasTerm;

    if (requiresAliasAddition && canEditTargetNote && !canEditTargetNote(cand)) {
      const msg = `Você não tem permissão para vincular alias ao card "${cand.title}".`;
      setLinkError(msg);
      onError?.(msg);
      return;
    }

    setLinkError("");
    onConfirmLink?.({
      targetCard: cand,
      term: finalTerm,
      requiresAliasAddition
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 35, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: modalZIndex,
        padding: "16px"
      }}
      onClick={onClose}
    >
      <div
        className="cp-window"
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span className="cp-title" style={{ fontSize: "16px" }}>
            Vincular ao Card
          </span>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{
              padding: "2px 8px",
              fontSize: "11px",
              height: "26px",
              display: "inline-flex",
              alignItems: "center"
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}
        >
          <input
            type="text"
            className="cp-input"
            placeholder="Texto / Termo do vínculo..."
            value={termToLink}
            onChange={(e) => {
              setLinkError("");
              onChangeTerm(e.target.value);
            }}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
          />

          <input
            type="text"
            className="cp-input"
            placeholder="Filtrar cards..."
            value={linkFilterText}
            onChange={(e) => onChangeFilter(e.target.value)}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
            autoFocus
          />
        </div>

        {linkError && (
          <div
            role="alert"
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              background: "#fee2e2",
              border: "1.5px solid #ef4444",
              color: "#991b1b",
              fontSize: "11px",
              fontWeight: 700
            }}
          >
            {linkError}
          </div>
        )}

        <div
          style={{
            maxHeight: "220px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "5px"
          }}
        >
          {candidateCardsToLink.map((cand) => {
            const meta = getNoteTypeMeta(cand.noteType);
            return (
              <button
                key={cand.id}
                type="button"
                onClick={() => handleSelectCandidate(cand)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: "2px solid #001b3a",
                  background: "#ffffff",
                  cursor: "pointer",
                  textAlign: "left"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <span>{getNoteTypeIcon(cand.noteType)}</span>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "12px",
                      color: "#001b3a"
                    }}
                  >
                    {cand.title}
                  </span>
                </div>
                <span
                  style={{
                    background: meta.color,
                    color: meta.badgeTextColor,
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: "4px"
                  }}
                >
                  {meta.singular}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
