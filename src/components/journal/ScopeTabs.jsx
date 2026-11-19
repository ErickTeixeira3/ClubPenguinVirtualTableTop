import { NOTE_SCOPES } from "../../domain/constants.js";

export default function ScopeTabs({
  isGM,
  activeScopeTab,
  totalNotesCount,
  selectedPlayerUid,
  playersList = [],
  onChangeScopeTab,
  onChangeSelectedPlayerUid
}) {
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isGM ? "1fr 1fr" : "1fr 1fr 1fr",
          gap: "4px"
        }}
      >
        {isGM && (
          <button
            type="button"
            className={`cp-btn ${activeScopeTab === NOTE_SCOPES.GM ? "cp-btn-gold" : ""}`}
            style={{ padding: "3px 6px", fontSize: "10px" }}
            onClick={() => onChangeScopeTab(NOTE_SCOPES.GM)}
          >
            Mestre
          </button>
        )}

        <button
          type="button"
          className={`cp-btn ${activeScopeTab === NOTE_SCOPES.PLAYER ? "cp-btn-gold" : ""}`}
          style={{ padding: "3px 6px", fontSize: "10px" }}
          onClick={() => onChangeScopeTab(NOTE_SCOPES.PLAYER)}
        >
          {isGM ? "Player" : "Meu Diário"}
        </button>

        <button
          type="button"
          className={`cp-btn ${activeScopeTab === NOTE_SCOPES.PARTY ? "cp-btn-gold" : ""}`}
          style={{ padding: "3px 6px", fontSize: "10px" }}
          onClick={() => onChangeScopeTab(NOTE_SCOPES.PARTY)}
        >
          Grupo
        </button>

        <button
          type="button"
          className={`cp-btn ${activeScopeTab === "unified" ? "cp-btn-gold" : ""}`}
          style={{ padding: "3px 6px", fontSize: "10px" }}
          onClick={() => onChangeScopeTab("unified")}
        >
          Todos ({totalNotesCount})
        </button>
      </div>

      {isGM && activeScopeTab === NOTE_SCOPES.PLAYER && (
        <select
          className="cp-input"
          style={{
            width: "100%",
            padding: "3px 8px",
            fontSize: "11px",
            height: "26px"
          }}
          value={selectedPlayerUid}
          onChange={(e) => onChangeSelectedPlayerUid(e.target.value)}
        >
          {playersList.map((p) => (
            <option key={p.uid} value={p.uid}>
              Diário de: {p.displayName}
            </option>
          ))}
        </select>
      )}
    </>
  );
}
