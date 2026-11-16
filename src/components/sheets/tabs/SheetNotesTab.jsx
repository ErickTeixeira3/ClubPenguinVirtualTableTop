import DebouncedField from "../../ui/DebouncedField";

/**
 * Fase 5: aba "História & Notas" da Ficha, extraída de CharacterSheetModal.jsx (JSX inalterado).
 */
export default function SheetNotesTab({
  canEdit,
  character,
  onUpdateCharacter
}) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
    >
      <div>
        <strong style={{ fontSize: "12px", color: "#003264" }}>História & Origem</strong>
        <DebouncedField
          as="textarea"
          className="cp-input"
          rows={6}
          disabled={!canEdit}
          placeholder="Biografia do pinguim, histórico, amigos, conexões..."
          value={character.biography || ""}
          onCommit={(value) =>
            onUpdateCharacter(character.id, { biography: value })
          }
          style={{ width: "100%", marginTop: "3px", fontSize: "12px" }}
        />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <strong style={{ fontSize: "12px", color: "#003264" }}>Anotações da Ficha</strong>
        <DebouncedField
          as="textarea"
          className="cp-input"
          rows={6}
          disabled={!canEdit}
          placeholder="Lembretes, pistas, missões em andamento..."
          value={character.notes || ""}
          onCommit={(value) =>
            onUpdateCharacter(character.id, { notes: value })
          }
          style={{ width: "100%", marginTop: "3px", fontSize: "12px", flex: 1 }}
        />
      </div>
    </div>
  );
}
