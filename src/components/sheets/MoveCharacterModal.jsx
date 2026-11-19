import { useMemo, useState } from "react";
import { getFolderDisplayPath } from "../../engines/folders/index.js";
import CPButton from "../ui/CPButton";
import WindowModal from "../ui/WindowModal";

export default function MoveCharacterModal({
  character,
  folders = [],
  onConfirm,
  onClose
}) {
  const [targetFolderId, setTargetFolderId] = useState(character?.folderId || "");

  const compatibleFolders = useMemo(() => {
    const ownerFolders = folders.filter(
      (f) => (f.ownerId || null) === (character?.ownerId || null)
    );
    const byId = new Map(ownerFolders.map((f) => [f.id, f]));
    return ownerFolders
      .map((f) => ({
        id: f.id,
        label: getFolderDisplayPath(f.id, byId) || f.name || f.id
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [folders, character?.ownerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!character) return;
    await onConfirm(character.id, targetFolderId || null, character.ownerId || null);
  };

  return (
    <WindowModal onClose={onClose} maxWidth="320px">
      <div style={{ fontSize: "14px", fontWeight: 800, color: "#003264" }}>
        Mover &quot;{character?.name}&quot;
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <select
          className="cp-input"
          value={targetFolderId}
          onChange={(e) => setTargetFolderId(e.target.value)}
          style={{ fontSize: "12px", padding: "6px" }}
        >
          <option value="">Raiz / Fora de qualquer pasta</option>
          {compatibleFolders.map((f) => (
            <option key={f.id} value={f.id}>
              📁 {f.label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
          <CPButton
            variant="orange"
            style={{ padding: "4px 10px", fontSize: "11px" }}
            onClick={onClose}
          >
            Cancelar
          </CPButton>
          <CPButton
            type="submit"
            variant="green"
            style={{ padding: "4px 14px", fontSize: "11px" }}
          >
            Salvar
          </CPButton>
        </div>
      </form>
    </WindowModal>
  );
}
