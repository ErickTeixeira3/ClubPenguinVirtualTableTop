import { useEffect, useRef } from "react";

export default function FogOfWarCanvas({
  widthPx,
  heightPx,
  fogEnabled,
  fogAreas,
  isGM,
  draftRect
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, widthPx, heightPx);

    if (!fogEnabled) return;

    // 1. Preenche toda a cena com a camada escura da Névoa de Guerra
    ctx.fillStyle = "#040d1a";
    ctx.fillRect(0, 0, widthPx, heightPx);

    // 2. Aplica cada operação de revelar ou ocultar em ordem cronológica
    for (const area of fogAreas || []) {
      if (area.op === "reveal") {
        ctx.clearRect(area.x, area.y, area.w, area.h);
      } else if (area.op === "hide") {
        ctx.fillStyle = "#040d1a";
        ctx.fillRect(area.x, area.y, area.w, area.h);
      }
    }
  }, [widthPx, heightPx, fogEnabled, fogAreas]);

  if (!fogEnabled && !draftRect) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        width={widthPx}
        height={heightPx}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: isGM ? 0.54 : 1,
          zIndex: 12,
          transition: "opacity 0.2s ease"
        }}
      />

      {draftRect && (
        <div
          style={{
            position: "absolute",
            left: `${draftRect.x}px`,
            top: `${draftRect.y}px`,
            width: `${draftRect.w}px`,
            height: `${draftRect.h}px`,
            border:
              draftRect.op === "reveal"
                ? "2.5px dashed var(--epf-cyan-glow)"
                : "2.5px dashed var(--epf-red-classified)",
            background:
              draftRect.op === "reveal"
                ? "rgba(0, 240, 255, 0.16)"
                : "rgba(255, 42, 85, 0.22)",
            pointerEvents: "none",
            zIndex: 15
          }}
        />
      )}
    </>
  );
}

