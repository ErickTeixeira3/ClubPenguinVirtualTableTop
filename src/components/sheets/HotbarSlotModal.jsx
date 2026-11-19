import { useState } from "react";
import { Z_LAYERS } from "../../constants/zLayers";
import { resolveHotbarSlot } from "../../engines/rolls";
import { renderCpFlashIcon } from "./CpFlashIcons";
import ConfirmDialog from "../ui/ConfirmDialog";
import WindowModal from "../ui/WindowModal";

/**
 * Modal de vínculo de uma rolagem com um dos 9 slots da Hotbar (Bola de Neve).
 */
export default function HotbarSlotModal({
  character,
  hotbarModalRoll,
  onAssignRoll,
  onRemoveSlot,
  onClose
}) {
  const [confirmRemoveSlotIdx, setConfirmRemoveSlotIdx] = useState(null);

  if (!hotbarModalRoll || !character) return null;

  const isLegacyArrayHotbar = Array.isArray(character.hotbar);

  return (
    <WindowModal
      variant="cp"
      onClose={onClose}
      zIndex={Z_LAYERS.modalNested}
      panelStyle={{ width: "300px", display: "flex", flexDirection: "column", gap: "10px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cp-title" style={{ fontSize: "14px" }}>
          Hotbar (Bola de Neve)
        </span>
        <button
          type="button"
          className="cp-btn cp-btn-orange"
          style={{ padding: "2px 6px", fontSize: "11px" }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          fontSize: "12px",
          fontWeight: 800,
          color: "#001b3a",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {renderCpFlashIcon(hotbarModalRoll.icon || "sword", 22)}
        </div>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hotbarModalRoll.name}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "6px",
          background: "#ffffff",
          padding: "8px",
          borderRadius: "12px",
          border: "2px solid #cbd5e1"
        }}
      >
        {Array.from({ length: 9 }).map((_, slotIdx) => {
          const slotKey = String(slotIdx + 1);
          const rawSlot = isLegacyArrayHotbar
            ? character.hotbar[slotIdx]
            : character.hotbar?.[slotKey] ?? null;
          const currentSlot = resolveHotbarSlot(rawSlot, character);
          const isThisRoll =
            Boolean(rawSlot?.rollId) && rawSlot.rollId === hotbarModalRoll.id;

          return (
            <button
              key={slotKey}
              type="button"
              className={`cp-btn ${isThisRoll ? "cp-btn-green" : currentSlot ? "cp-btn-gold" : ""}`}
              style={{
                height: "56px",
                padding: "2px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                fontSize: "10px"
              }}
              onClick={() => {
                if (isThisRoll) {
                  setConfirmRemoveSlotIdx(slotIdx);
                } else {
                  onAssignRoll(hotbarModalRoll, slotIdx);
                }
              }}
              title={
                isThisRoll
                  ? "Remover deste slot"
                  : currentSlot
                    ? `Substituir ${currentSlot.name}`
                    : `Fixar no Slot ${slotIdx + 1}`
              }
            >
              <span style={{ fontWeight: 900, fontSize: "11px" }}>#{slotIdx + 1}</span>
              <span
                style={{
                  fontSize: "9px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "70px"
                }}
              >
                {isThisRoll ? "Remover" : currentSlot ? currentSlot.name : "Vazio"}
              </span>
            </button>
          );
        })}
      </div>

      {confirmRemoveSlotIdx !== null && (
        <ConfirmDialog
          title="Remover atalho da Hotbar?"
          question={`Limpar o slot #${confirmRemoveSlotIdx + 1}?`}
          confirmLabel="Remover"
          onConfirm={() => {
            onRemoveSlot(confirmRemoveSlotIdx);
            setConfirmRemoveSlotIdx(null);
          }}
          onCancel={() => setConfirmRemoveSlotIdx(null)}
          zIndex={Z_LAYERS.modalCombat}
        />
      )}
    </WindowModal>
  );
}
