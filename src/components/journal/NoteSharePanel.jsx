export default function NoteSharePanel({
  note,
  isSharedWithParty,
  sharedPlayers = [],
  availablePlayersToShare = [],
  canManageAccess,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onClose
}) {
  return (
    <div
      style={{
        background: "rgba(0, 27, 58, 0.06)",
        border: "1.5px solid var(--cp-blue-border)",
        borderRadius: "8px",
        padding: "6px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          fontWeight: 800,
          color: "#001b3a"
        }}
      >
        <span>ACESSOS CONCEDIDOS</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 900,
            fontSize: "11px",
            color: "#001b3a"
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
        {isSharedWithParty && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "#02529c",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "6px"
            }}
          >
            👥 Grupo
            {canManageAccess && (
              <button
                type="button"
                title="Remover acesso do grupo"
                onClick={() => onRevokeNoteAccess?.(note.id, "party")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff8a80",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "11px",
                  padding: "0 2px"
                }}
              >
                ✕
              </button>
            )}
          </span>
        )}

        {sharedPlayers.map((p) => (
          <span
            key={p.uid}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "#2e7d32",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "6px"
            }}
          >
            👤 {p.displayName}
            {canManageAccess && (
              <button
                type="button"
                title={`Remover acesso de ${p.displayName}`}
                onClick={() => onRevokeNoteAccess?.(note.id, p.uid)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ff8a80",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: "11px",
                  padding: "0 2px"
                }}
              >
                ✕
              </button>
            )}
          </span>
        ))}

        {!isSharedWithParty && sharedPlayers.length === 0 && (
          <span style={{ fontSize: "10px", color: "#64748b" }}>
            Apenas proprietário e mestre
          </span>
        )}
      </div>

      {canManageAccess && (
        <select
          className="cp-input"
          style={{
            padding: "3px 6px",
            fontSize: "10px",
            fontWeight: 800,
            height: "26px"
          }}
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onShareNoteWithTarget?.(note.id, e.target.value);
            }
          }}
        >
          <option value="">+ Disponibilizar para...</option>
          {!isSharedWithParty && (
            <option value="party">👥 Grupo (Todos)</option>
          )}
          {availablePlayersToShare.map((p) => (
            <option key={p.uid} value={p.uid}>
              👤 {p.displayName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
