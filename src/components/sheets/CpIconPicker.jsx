import { useState } from "react";
import { CP_FLASH_ICONS, CP_ICON_CATEGORIES } from "./CpFlashIcons";

/**
 * Seletor de ícones usando diretamente as categorias declarativas de CpFlashIcons.
 */
export default function CpIconPicker({ selectedIconId, onSelectIcon, onClose }) {
  const [activeCat, setActiveCat] = useState("all");

  const filtered =
    activeCat === "all"
      ? CP_FLASH_ICONS
      : CP_FLASH_ICONS.filter((i) => i.category === activeCat);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "2.5px solid #7a8c9e",
        borderRadius: "14px",
        padding: "10px",
        boxShadow: "0 8px 24px rgba(0, 27, 58, 0.3)",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
        {CP_ICON_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 700,
              borderRadius: "999px",
              border: activeCat === c.id ? "1.5px solid #008be3" : "1px solid #cbd5e1",
              background: activeCat === c.id ? "#eef6fd" : "#ffffff",
              color: activeCat === c.id ? "#0060a8" : "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "6px",
          maxHeight: "165px",
          overflowY: "auto",
          padding: "4px"
        }}
      >
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectIcon(item.id)}
            title={item.label}
            style={{
              width: "42px",
              height: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: selectedIconId === item.id ? "#e0f2fe" : "#f8fafc",
              border: selectedIconId === item.id ? "2px solid #008be3" : "1.5px solid #cbd5e1",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "2px",
              transition: "transform 0.1s ease, border-color 0.1s ease"
            }}
          >
            {item.render(32)}
          </button>
        ))}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "flex-end",
            padding: "3px 10px",
            fontSize: "11px",
            background: "#e2e8f0",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 700,
            color: "#334155"
          }}
        >
          Fechar
        </button>
      )}
    </div>
  );
}
