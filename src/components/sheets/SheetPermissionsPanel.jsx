import { useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Z_LAYERS } from "../../constants/zLayers";

/**
 * Painel de permissões da ficha (Mestre): visibilidade, edição e transferência de posse.
 */
export default function SheetPermissionsPanel({
  character,
  playersMap = {},
  onShareCharacter = null,
  onTransferCharacter = null,
  onUpdateCharacter
}) {
  const [confirmTransfer, setConfirmTransfer] = useState(null);

  const visibleList = Array.isArray(character.visibleTo) ? character.visibleTo : [];
  const editableList = Array.isArray(character.editableBy) ? character.editableBy : [];
  const players = Object.values(playersMap || {}).filter((p) => p && p.uid);

  const applyAudienceUpdate = async (nextVisible, nextEditable) => {
    try {
      if (onShareCharacter) {
        await onShareCharacter(character.id, {
          visibleTo: nextVisible,
          editableBy: nextEditable
        });
      } else if (onUpdateCharacter) {
        await onUpdateCharacter(character.id, {
          visibleTo: nextVisible,
          editableBy: nextEditable
        });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const toggleUid = (field, uidOrAll) => {
    if (field === "visibleTo") {
      const exists = visibleList.includes(uidOrAll);
      const nextVisible = exists
        ? visibleList.filter((id) => id !== uidOrAll)
        : [...visibleList, uidOrAll];
      applyAudienceUpdate(nextVisible, editableList);
    } else {
      const exists = editableList.includes(uidOrAll);
      const nextEditable = exists
        ? editableList.filter((id) => id !== uidOrAll)
        : [...editableList, uidOrAll];
      const nextVisible =
        !exists && !visibleList.includes(uidOrAll)
          ? [...visibleList, uidOrAll]
          : visibleList;
      applyAudienceUpdate(nextVisible, nextEditable);
    }
  };

  return (
    <div
      className="epf-screen"
      style={{
        margin: "6px 14px",
        padding: "8px",
        fontSize: "11px",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
    >
      <label style={{ display: "flex", gap: "6px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={visibleList.includes("ALL")}
          onChange={() => toggleUid("visibleTo", "ALL")}
        />
        Visível a Todos
      </label>

      {players.map((p) => (
        <div
          key={p.uid}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>
            {p.displayName}
            {character.ownerId === p.uid ? " (Dono)" : ""}
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <label>
              <input
                type="checkbox"
                checked={visibleList.includes(p.uid)}
                onChange={() => toggleUid("visibleTo", p.uid)}
              />{" "}
              Ver
            </label>
            <label>
              <input
                type="checkbox"
                checked={editableList.includes(p.uid)}
                onChange={() => toggleUid("editableBy", p.uid)}
              />{" "}
              Editar
            </label>
            {onTransferCharacter && character.ownerId !== p.uid && (
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "1px 6px", fontSize: "10px" }}
                onClick={() =>
                  setConfirmTransfer({
                    uid: p.uid,
                    name: p.displayName || p.uid
                  })
                }
              >
                Transferir
              </button>
            )}
          </div>
        </div>
      ))}

      {confirmTransfer && (
        <ConfirmDialog
          title="Transferir posse da ficha?"
          question={`Passar a propriedade de "${character.name}" para ${confirmTransfer.name}?`}
          confirmLabel="Transferir"
          onConfirm={async () => {
            const targetUid = confirmTransfer.uid;
            setConfirmTransfer(null);
            try {
              await onTransferCharacter(character.id, targetUid);
            } catch {
              // Erro já notificado pelo hook
            }
          }}
          onCancel={() => setConfirmTransfer(null)}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </div>
  );
}
