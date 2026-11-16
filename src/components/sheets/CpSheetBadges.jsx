import { getAssetUrl } from "../../utils/stringUtils";

/**
 * Fase 5: ícones/insígnias do Player Card extraídos de CharacterSheetModal.jsx (conteúdo inalterado).
 */
export function CpCoinIcon({ size = 20 }) {
  return (
    <img
      src={getAssetUrl("emotes/coin.webp")}
      alt="Moeda"
      width={size}
      height={size}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        transform: "rotate(-90deg)",
        filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.35))",
        pointerEvents: "none",
        userSelect: "none"
      }}
    />
  );
}

export function CpStampIcon({ size = 20 }) {
  return (
    <img
      src={getAssetUrl("emotes/stamp_book.png")}
      alt="Livro de Selos"
      width={size}
      height={size}
      draggable={false}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
        display: "block",
        flexShrink: 0,
        filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.35))",
        pointerEvents: "none",
        userSelect: "none"
      }}
    />
  );
}

export function CpMemberBadge({ level = 1 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "linear-gradient(180deg, #ffe57f 0%, #ffb300 100%)",
        border: "2px solid #5d3b00",
        borderRadius: "8px",
        padding: "2px 7px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.7)",
        color: "#3d2400",
        fontFamily: "var(--font-display)",
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.5px",
        flexShrink: 0,
        userSelect: "none"
      }}
      title={`Nível ${level}`}
    >
      <span style={{ fontSize: "11px", color: "#5d3b00" }}>⭐</span>
      <span>NÍVEL {level}</span>
    </div>
  );
}
