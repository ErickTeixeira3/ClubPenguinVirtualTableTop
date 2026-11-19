import { Z_LAYERS } from "../../constants/zLayers";
import CpIconPicker from "./CpIconPicker";
import WindowModal from "../ui/WindowModal";

/**
 * Modal de seleção de ícone de uma rolagem personalizada/vinculada.
 */
export default function RollIconModal({
  target,
  onSelectIcon,
  onClose
}) {
  if (!target?.roll) return null;

  return (
    <WindowModal
      variant="cp"
      onClose={onClose}
      zIndex={Z_LAYERS.modalNested}
      panelStyle={{ width: "380px", display: "flex", flexDirection: "column", gap: "10px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="cp-title" style={{ fontSize: "14px" }}>
          Alterar Ícone
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

      <div style={{ fontSize: "12px", fontWeight: 800, color: "#001b3a" }}>
        {target.roll.name}
      </div>

      <CpIconPicker
        selectedIconId={target.roll.icon}
        onSelectIcon={(ic) => {
          onSelectIcon(target.groupId, target.roll.id, ic);
          onClose();
        }}
        onClose={onClose}
      />
    </WindowModal>
  );
}
