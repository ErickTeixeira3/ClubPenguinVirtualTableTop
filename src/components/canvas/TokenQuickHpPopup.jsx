import { useState } from "react";
import CPButton from "../ui/CPButton.jsx";

export default function TokenQuickHpPopup({ token, onAdjustHp }) {
  const [deltaInput, setDeltaInput] = useState("");
  const [openCustom, setOpenCustom] = useState(false);

  const handleApplyCustom = (sign) => {
    const amount = Math.abs(Math.round(Number(deltaInput) || 0));
    if (amount > 0) {
      onAdjustHp?.(token, sign * amount);
    }
    setDeltaInput("");
    setOpenCustom(false);
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", position: "relative" }}>
      <CPButton
        variant="orange"
        style={{ padding: "2px 7px", fontSize: "11px" }}
        onClick={() => onAdjustHp?.(token, -1)}
      >
        -1 HP
      </CPButton>
      <CPButton
        variant="green"
        style={{ padding: "2px 7px", fontSize: "11px" }}
        onClick={() => onAdjustHp?.(token, 1)}
      >
        +1 HP
      </CPButton>
      <CPButton
        style={{ padding: "2px 6px", fontSize: "11px" }}
        onClick={() => setOpenCustom((prev) => !prev)}
        title="Ajuste rápido de HP"
      >
        ±
      </CPButton>

      {openCustom && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "rgba(1, 21, 44, 0.96)",
            border: "2px solid var(--cp-blue-border)",
            borderRadius: "10px",
            padding: "4px 6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.55)"
          }}
        >
          <input
            type="number"
            min="1"
            className="cp-input"
            value={deltaInput}
            onChange={(e) => setDeltaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyCustom(-1);
              } else if (e.key === "Escape") {
                setOpenCustom(false);
              }
            }}
            placeholder="HP"
            style={{ width: "52px", padding: "2px 5px", fontSize: "11px" }}
            autoFocus
          />
          <CPButton
            variant="orange"
            style={{ padding: "2px 6px", fontSize: "11px" }}
            onClick={() => handleApplyCustom(-1)}
          >
            -
          </CPButton>
          <CPButton
            variant="green"
            style={{ padding: "2px 6px", fontSize: "11px" }}
            onClick={() => handleApplyCustom(1)}
          >
            +
          </CPButton>
        </div>
      )}
    </span>
  );
}
