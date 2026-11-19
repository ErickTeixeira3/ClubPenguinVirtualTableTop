export default function TokenHpBar({ current, max }) {
  const safeMax = Number(max);
  if (!Number.isFinite(safeMax) || safeMax <= 0) {
    return null;
  }
  const safeCurrent = Math.max(0, Number(current) || 0);
  const hpPercent = Math.max(0, Math.min(100, Math.round((safeCurrent / safeMax) * 100)));

  return (
    <div
      style={{
        position: "absolute",
        top: "-12px",
        left: "4%",
        width: "92%",
        height: "9px",
        background: "#1a202c",
        border: "1.5px solid #000000",
        borderRadius: "999px",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          width: `${hpPercent}%`,
          height: "100%",
          background:
            hpPercent > 50 ? "#38c172" : hpPercent > 25 ? "#ffcc00" : "#e53935",
          transition: "width 0.15s ease"
        }}
      />
    </div>
  );
}
