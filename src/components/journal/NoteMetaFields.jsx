import { NOTE_TYPES } from "../../domain/constants.js";
import { JOURNAL_NOTE_TYPES } from "./noteTypesUi";

const LABEL_STYLE = {
  fontSize: "10px",
  fontWeight: 900,
  color: "#001b3a",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

export default function NoteMetaFields({
  title,
  noteType,
  folderId,
  linkedCharacterId,
  aliasesText,
  file,
  canEdit,
  availableFoldersForType = [],
  characters = [],
  onChangeTitle,
  onChangeNoteType,
  onChangeFolderId,
  onChangeLinkedCharacterId,
  onChangeAliasesText,
  onChangeFile
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 140px 160px",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Nome</span>
          <input
            type="text"
            className="cp-input"
            placeholder="Título do Card"
            value={title}
            onChange={(e) => onChangeTitle(e.target.value)}
            disabled={!canEdit}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
            required
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Tipo</span>
          <select
            className="cp-input"
            value={noteType}
            onChange={(e) => onChangeNoteType(e.target.value)}
            disabled={!canEdit}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
          >
            {JOURNAL_NOTE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.singular}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Pasta</span>
          <select
            className="cp-input"
            aria-label="Pasta"
            value={folderId}
            onChange={(e) => onChangeFolderId(e.target.value)}
            disabled={!canEdit}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
          >
            <option value="">Sem pasta (Raiz)</option>
            {availableFoldersForType.map((fOpt) => (
              <option key={fOpt.id} value={fOpt.id}>
                {fOpt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {noteType === NOTE_TYPES.CHARACTER && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Vínculo com Ficha</span>
          <select
            className="cp-input"
            value={linkedCharacterId}
            onChange={(e) => onChangeLinkedCharacterId(e.target.value)}
            disabled={!canEdit}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
          >
            <option value="">Sem vínculo direto com ficha</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                Ficha: {c.name} ({c.type === "npc" ? "NPC" : "Player"})
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 180px",
          gap: "8px",
          alignItems: "flex-end"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Aliases</span>
          <input
            type="text"
            className="cp-input"
            placeholder="Separados por vírgula (ex: Vilão, Carlos)"
            value={aliasesText}
            onChange={(e) => onChangeAliasesText(e.target.value)}
            disabled={!canEdit}
            style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={LABEL_STYLE}>Imagem</span>
          <label
            className="cp-btn"
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              height: "30px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canEdit ? "pointer" : "not-allowed",
              opacity: canEdit ? 1 : 0.6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {file ? file.name.slice(0, 16) : "Imagem"}
            <input
              type="file"
              accept="image/*"
              disabled={!canEdit}
              style={{ display: "none" }}
              onChange={(e) => onChangeFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>
      </div>
    </>
  );
}
