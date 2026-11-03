import { useMemo, useState } from "react";
import {
  NOTE_TYPES,
  detectAliasMentionsInText,
  getNoteTypeMeta
} from "../../engines/aliasEngine";

export default function NoteEditorModal({
  note = null,
  defaultScope = "party",
  defaultOwnerId = null,
  accessibleNotes = [],
  characters = [],
  onSave,
  onDelete,
  onClose
}) {
  const isEditing = Boolean(note?.id);

  const [title, setTitle] = useState(note?.title || "");
  const [noteType, setNoteType] = useState(note?.noteType || "lore");
  const [linkedCharacterSheetId, setLinkedCharacterSheetId] = useState(
    note?.linkedCharacterSheetId || ""
  );
  const [aliasesText, setAliasesText] = useState(
    Array.isArray(note?.aliases) ? note.aliases.join(", ") : ""
  );
  const [content, setContent] = useState(note?.content || "");
  const [relatedNoteIds, setRelatedNoteIds] = useState(
    Array.isArray(note?.relatedNoteIds) ? note.relatedNoteIds : []
  );
  const [file, setFile] = useState(null);
  const [relationFilter, setRelationFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const detectedAliases = useMemo(() => {
    return detectAliasMentionsInText(
      content,
      accessibleNotes,
      note?.id || null
    );
  }, [content, accessibleNotes, note?.id]);

  const candidateNotes = useMemo(() => {
    const q = relationFilter.trim().toLowerCase();
    return accessibleNotes.filter((n) => {
      if (n.id === note?.id) return false;
      if (!q) return true;
      const matchTitle = (n.title || "").toLowerCase().includes(q);
      const matchAlias = (n.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return matchTitle || matchAlias;
    });
  }, [accessibleNotes, note?.id, relationFilter]);

  const toggleRelatedId = (targetId) => {
    setRelatedNoteIds((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    try {
      const parsedAliases = aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      await onSave({
        id: note?.id || null,
        scope: note?.scope || defaultScope,
        ownerId: note?.ownerId || defaultOwnerId,
        title: title.trim(),
        noteType,
        linkedCharacterSheetId:
          noteType === "character" && linkedCharacterSheetId
            ? linkedCharacterSheetId
            : null,
        aliases: parsedAliases,
        content,
        relatedNoteIds,
        file
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 35, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 130,
        padding: "16px"
      }}
    >
      <div
        className="cp-window"
        style={{
          width: "100%",
          maxWidth: "720px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
            padding: "0 6px"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "20px" }}>
            {isEditing ? "EDITAR CARD DO DIÁRIO" : "NOVO CARD DO DIÁRIO"}
          </h2>

          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 12px" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="cp-window-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            overflowY: "auto"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px",
              gap: "8px"
            }}
          >
            <input
              type="text"
              className="cp-input"
              placeholder="Título do Card"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <select
              className="cp-input"
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.singular}
                </option>
              ))}
            </select>
          </div>

          {noteType === "character" && (
            <select
              className="cp-input"
              value={linkedCharacterSheetId}
              onChange={(e) => setLinkedCharacterSheetId(e.target.value)}
            >
              <option value="">Sem vínculo direto com ficha</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  Ficha: {c.name} ({c.type === "npc" ? "NPC" : "Player"})
                </option>
              ))}
            </select>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px",
              gap: "8px",
              alignItems: "center"
            }}
          >
            <input
              type="text"
              className="cp-input"
              placeholder="Aliases separados por vírgula (ex: Vilão, Monstro do Mal, Carlos)"
              value={aliasesText}
              onChange={(e) => setAliasesText(e.target.value)}
            />

            <label
              className="cp-btn"
              style={{
                padding: "8px 10px",
                fontSize: "12px",
                textAlign: "center",
                cursor: "pointer"
              }}
            >
              {file ? file.name.slice(0, 18) : "Imagem (WebP)"}
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <textarea
            className="cp-input"
            style={{ minHeight: "140px", resize: "vertical" }}
            placeholder="Anotações, história, pistas e acontecimentos..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {detectedAliases.matchedDetails.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                padding: "8px",
                background: "#e6f4ff",
                borderRadius: "10px",
                border: "2px solid var(--cp-blue-border)"
              }}
            >
              {detectedAliases.matchedDetails.map((m) => {
                const meta = getNoteTypeMeta(m.noteType);
                return (
                  <span
                    key={m.noteId}
                    style={{
                      background: meta.color,
                      color: m.noteType === "quest" ? "#001b3a" : "#ffffff",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 800,
                      border: "1.5px solid #001b3a"
                    }}
                  >
                    @{m.matchedAlias} → {m.title}
                  </span>
                );
              })}
            </div>
          )}

          {/* Seletor de vínculos explícitos (Lugares, Personagens, Lore, Missões, Eventos) */}
          <div
            style={{
              background: "#ffffff",
              border: "2px solid var(--cp-blue-border)",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px"
              }}
            >
              <span style={{ fontWeight: 800, fontSize: "12px" }}>
                VÍNCULOS DIRETOS ({relatedNoteIds.length})
              </span>
              <input
                type="text"
                className="cp-input"
                style={{ maxWidth: "240px", padding: "4px 8px", fontSize: "12px" }}
                placeholder="Filtrar cards..."
                value={relationFilter}
                onChange={(e) => setRelationFilter(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                maxHeight: "120px",
                overflowY: "auto"
              }}
            >
              {candidateNotes.map((cand) => {
                const selected = relatedNoteIds.includes(cand.id);
                const meta = getNoteTypeMeta(cand.noteType);
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => toggleRelatedId(cand.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "4px 9px",
                      borderRadius: "999px",
                      border: "2px solid #001b3a",
                      background: selected ? meta.color : "#f0f7ff",
                      color:
                        selected && cand.noteType !== "quest"
                          ? "#ffffff"
                          : "#001b3a",
                      fontWeight: 800,
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    <span>{selected ? "✓" : "+"}</span>
                    <span>
                      [{meta.singular}] {cand.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px"
            }}
          >
            {isEditing && onDelete ? (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                onClick={async () => {
                  await onDelete(note.id);
                  onClose();
                }}
              >
                Excluir
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className="cp-btn" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="cp-btn cp-btn-gold"
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar Card"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

