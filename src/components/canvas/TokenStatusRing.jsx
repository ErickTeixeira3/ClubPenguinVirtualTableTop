import { BOARD_Z_LAYERS } from "./boardConstants.js";

const RING_VARIANTS = Object.freeze({
  target: Object.freeze({
    border: "3px dashed #ff2a55",
    boxShadow:
      "0 0 16px rgba(255, 42, 85, 0.75), inset 0 0 10px rgba(255, 42, 85, 0.35)",
    zIndex: BOARD_Z_LAYERS.tokenTargetReticle,
    badgeBg: "#e11d48",
    badgeBorder: "1.5px solid #fecdd3",
    label: "🎯 ALVO"
  }),
  aoe: Object.freeze({
    border: "3px solid #f97316",
    boxShadow:
      "0 0 16px rgba(249, 115, 22, 0.85), inset 0 0 10px rgba(249, 115, 22, 0.45)",
    zIndex: BOARD_Z_LAYERS.tokenAoeReticle,
    badgeBg: "#ea580c",
    badgeBorder: "1.5px solid #fed7aa",
    label: "NA ÁREA"
  })
});

export default function TokenStatusRing({ variant = "target" }) {
  const styleCfg = RING_VARIANTS[variant] || RING_VARIANTS.target;

  return (
    <div
      style={{
        position: "absolute",
        inset: "-8px",
        borderRadius: "50%",
        border: styleCfg.border,
        boxShadow: styleCfg.boxShadow,
        pointerEvents: "none",
        zIndex: styleCfg.zIndex
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-18px",
          left: "50%",
          transform: "translateX(-50%)",
          background: styleCfg.badgeBg,
          color: "#ffffff",
          border: styleCfg.badgeBorder,
          borderRadius: "999px",
          padding: "0px 6px",
          fontSize: "9px",
          fontWeight: 900,
          letterSpacing: "0.05em",
          whiteSpace: "nowrap",
          boxShadow: "0 2px 6px rgba(0,0,0,0.6)"
        }}
      >
        {styleCfg.label}
      </div>
    </div>
  );
}
