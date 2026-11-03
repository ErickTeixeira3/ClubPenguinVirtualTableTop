import { useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";

function CharacterListItem({
  character,
  campaignId,
  isGM,
  onOpenSheet,
  onSpawnToken,
  onDeleteCharacter
}) {
  const { url: avatarUrl } = useMediaUrl(
    character.avatarMediaId || character.defaultToken?.mediaId,
    character.avatarExternalUrl || character.defaultToken?.externalUrl,
    campaignId
  );

  const hp = character.resources?.hp || { current: 20, max: 20 };
  const mp = character.resources?.mp || { current: 10, max: 10 };

  const handleOpenNewWindow = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?sheetId=${encodeURIComponent(character.id)}`;
    window.open(
      url,
      `cpvtt_sheet_${character.id}`,
      "width=1080,height=760,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  return (
    <div
      onClick={() => onOpenSheet(character.id)}
      style={{
        background: "#ffffff",
        border: `3px solid ${character.cardColor || "#02529c"}`,
        borderRadius: "14px",
        padding: "8px 10px",
        boxShadow: "0 3px 0 rgba(0,27,58,0.18)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: 0
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: `2.5px solid ${character.cardColor || "#02529c"}`,
            background: "#02386e",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={character.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span className="cp-title" style={{ fontSize: "14px" }}>
              {(character.name || "P").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "14px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {character.name}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              fontSize: "11px",
              fontWeight: 800
            }}
          >
            <span style={{ color: "#c62828" }}>
              HP {hp.current}/{hp.max}
            </span>
            <span style={{ color: "#02529c" }}>
              MP {mp.current}/{mp.max}
            </span>
            <span>DEF {character.defense ?? 10}</span>
          </div>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: "4px", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {onSpawnToken && (
          <button
            type="button"
            className="cp-btn cp-btn-green"
            style={{ padding: "4px 7px", fontSize: "11px" }}
            onClick={() => onSpawnToken(character)}
            title="Colocar Token no Mapa"
          >
            +Mapa
          </button>
        )}

        <button
          type="button"
          className="cp-btn cp-btn-gold"
          style={{ padding: "4px 7px", fontSize: "11px" }}
          onClick={handleOpenNewWindow}
          title="Abrir em Nova Janela"
        >
          ↗
        </button>

        {isGM && (
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 7px", fontSize: "11px" }}
            onClick={() => onDeleteCharacter(character.id)}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export default function CharactersSidebarList({
  characters,
  campaignId,
  isGM,
  onCreateCharacter,
  onOpenSheet,
  onSpawnToken,
  onDeleteCharacter,
  onOpenCompendium
}) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("pc");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setErrorMsg("");
    try {
      const createdId = await onCreateCharacter({
        name: newName.trim(),
        type: newType,
        visibleToAll: newType === "pc"
      });
      setNewName("");
      if (createdId) {
        onOpenSheet(createdId);
      }
    } catch (err) {
      console.error("Falha ao criar personagem:", err);
      setErrorMsg("Erro ao criar personagem.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}
      >
        <input
          type="text"
          className="cp-input"
          style={{ flex: 1, padding: "6px 10px", fontSize: "13px" }}
          placeholder="Nome do Personagem..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        {isGM && (
          <select
            className="cp-input"
            style={{ width: "82px", padding: "6px", fontSize: "12px" }}
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            <option value="pc">PC</option>
            <option value="npc">NPC</option>
          </select>
        )}
        <button
          type="submit"
          disabled={creating}
          className="cp-btn cp-btn-green"
          style={{ padding: "6px 10px", fontSize: "12px" }}
        >
          {creating ? "..." : "+ Criar"}
        </button>
      </form>

      {errorMsg && (
        <div
          style={{
            background: "#ffebee",
            border: "1.5px solid #c62828",
            color: "#b71c1c",
            borderRadius: "8px",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 800,
            flexShrink: 0
          }}
        >
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        className="cp-btn cp-btn-gold"
        style={{ width: "100%", padding: "7px", fontSize: "13px", flexShrink: 0 }}
        onClick={onOpenCompendium}
      >
        Livro do Mestre & Compêndio
      </button>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingRight: "2px"
        }}
      >
        {(characters || []).length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "24px 8px",
              fontSize: "13px",
              color: "var(--cp-text-muted)",
              fontWeight: 700
            }}
          >
            Nenhum personagem cadastrado. Digite o nome acima e clique em "+ Criar".
          </div>
        )}
        {(characters || []).map((char) => (
          <CharacterListItem
            key={char.id}
            character={char}
            campaignId={campaignId}
            isGM={isGM}
            onOpenSheet={onOpenSheet}
            onSpawnToken={onSpawnToken}
            onDeleteCharacter={onDeleteCharacter}
          />
        ))}
      </div>
    </div>
  );
}

