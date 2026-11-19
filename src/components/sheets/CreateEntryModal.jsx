import { useMemo, useState } from "react";
import { getFolderDisplayPath, validateFolderName } from "../../engines/folders/index.js";
import CPButton from "../ui/CPButton";
import WindowModal from "../ui/WindowModal";

export default function CreateEntryModal({
  initialConfig,
  folders = [],
  isGM = false,
  gmId = null,
  currentUserId = null,
  playerList = [],
  onConfirm,
  onClose,
  onValidationError = null
}) {
  const defaultOwnerId =
    initialConfig?.ownerId || (isGM ? gmId || currentUserId || "" : currentUserId || "");

  const [name, setName] = useState("");
  const [charType, setCharType] = useState(isGM ? "npc" : "pc");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [folderId, setFolderId] = useState(initialConfig?.folderId || "");

  const ownerFolders = useMemo(
    () =>
      folders.filter((f) =>
        ownerId ? f.ownerId === ownerId : f.ownerId === currentUserId
      ),
    [folders, ownerId, currentUserId]
  );

  const folderOptions = useMemo(() => {
    const byId = new Map(ownerFolders.map((f) => [f.id, f]));
    return ownerFolders
      .map((f) => ({
        id: f.id,
        label: getFolderDisplayPath(f.id, byId) || f.name || f.id
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [ownerFolders]);

  const handleOwnerChange = (nextOwner) => {
    setOwnerId(nextOwner);
    const validForNext = folders.some(
      (f) => f.id === folderId && f.ownerId === nextOwner
    );
    if (!validForNext) {
      setFolderId("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (initialConfig.type === "folder") {
      const check = validateFolderName(trimmed);
      if (!check.ok) {
        onValidationError?.(check.errors[0]);
        return;
      }
    }

    await onConfirm({
      type: initialConfig.type,
      name: trimmed,
      charType,
      folderId: folderId || null,
      ownerId: ownerId || currentUserId
    });
  };

  return (
    <WindowModal onClose={onClose} maxWidth="340px">
      <div style={{ fontSize: "15px", fontWeight: 800, color: "#003264" }}>
        {initialConfig.type === "character" ? "Novo Personagem" : "Nova Pasta"}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input
          type="text"
          className="cp-input"
          placeholder={
            initialConfig.type === "character" ? "Nome do Personagem..." : "Nome da Pasta..."
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
          style={{ fontSize: "13px", padding: "6px 10px" }}
        />

        {initialConfig.type === "character" && isGM && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
              Tipo
            </label>
            <select
              className="cp-input"
              value={charType}
              onChange={(e) => setCharType(e.target.value)}
              style={{ fontSize: "12px", padding: "5px" }}
            >
              <option value="pc">Personagem de Jogador (PC)</option>
              <option value="npc">Personagem do Mestre (NPC)</option>
            </select>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
            {initialConfig.type === "character"
              ? "Pasta de Destino"
              : "Pasta Mãe (Opcional)"}
          </label>
          <select
            className="cp-input"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            style={{ fontSize: "12px", padding: "5px" }}
          >
            <option value="">Raiz / Fora de qualquer pasta</option>
            {folderOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                📁 {opt.label}
              </option>
            ))}
          </select>
        </div>

        {isGM && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
              Dono / Seção
            </label>
            <select
              className="cp-input"
              value={ownerId}
              onChange={(e) => handleOwnerChange(e.target.value)}
              style={{ fontSize: "12px", padding: "5px" }}
            >
              <option value={gmId || currentUserId || ""}>Mestre (Minhas Fichas)</option>
              {playerList.map((p) => (
                <option key={p.uid} value={p.uid}>
                  👤 {p.displayName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
          <CPButton
            variant="orange"
            style={{ padding: "5px 12px", fontSize: "12px" }}
            onClick={onClose}
          >
            Cancelar
          </CPButton>
          <CPButton
            type="submit"
            variant="green"
            style={{ padding: "5px 16px", fontSize: "12px" }}
          >
            Criar
          </CPButton>
        </div>
      </form>
    </WindowModal>
  );
}
