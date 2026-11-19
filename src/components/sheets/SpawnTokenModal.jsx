import { useState } from "react";
import CPButton from "../ui/CPButton";
import WindowModal from "../ui/WindowModal";

export default function SpawnTokenModal({
  character,
  isGM = false,
  onConfirm,
  onClose
}) {
  const [showName, setShowName] = useState(
    (character?.token?.showName ?? character?.defaultToken?.showName) !== false
  );
  const [visibleToPlayers, setVisibleToPlayers] = useState(
    character?.type !== "npc" || isGM
  );

  return (
    <WindowModal onClose={onClose} maxWidth="320px">
      <div style={{ fontSize: "14px", fontWeight: 800, color: "#003264" }}>
        Colocar Token no Mapa
      </div>

      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
        {character?.name}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          fontWeight: 700,
          color: "#1e293b",
          cursor: "pointer"
        }}
      >
        <input
          type="checkbox"
          checked={showName}
          onChange={(e) => setShowName(e.target.checked)}
        />
        Exibir nome no token
      </label>

      {isGM && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: 700,
            color: "#1e293b",
            cursor: "pointer"
          }}
        >
          <input
            type="checkbox"
            checked={visibleToPlayers}
            onChange={(e) => setVisibleToPlayers(e.target.checked)}
          />
          Visível para jogadores
        </label>
      )}

      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
        <CPButton
          variant="orange"
          style={{ padding: "4px 10px", fontSize: "11px" }}
          onClick={onClose}
        >
          Cancelar
        </CPButton>
        <CPButton
          variant="green"
          style={{ padding: "4px 14px", fontSize: "11px" }}
          onClick={() => {
            onConfirm(character, {
              showName,
              hidden: isGM ? !visibleToPlayers : false
            });
            onClose();
          }}
        >
          + No Mapa
        </CPButton>
      </div>
    </WindowModal>
  );
}
