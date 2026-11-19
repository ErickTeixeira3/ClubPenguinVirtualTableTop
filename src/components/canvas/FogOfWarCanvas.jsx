import { useEffect, useMemo, useRef } from "react";
import { getOrderedFogAreas } from "../../domain/models/fog.js";
import { BOARD_Z_LAYERS } from "./boardConstants.js";

export default function FogOfWarCanvas({
  widthPx,
  heightPx,
  fog = null,
  isGM = false,
  draftRect = null
}) {
  const canvasRef = useRef(null);
  const fogEnabled = Boolean(fog?.enabled);
  const orderedAreas = useMemo(() => getOrderedFogAreas(fog), [fog]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, widthPx, heightPx);

    if (!fogEnabled) return;

    ctx.fillStyle = "#040d1a";
    ctx.fillRect(0, 0, widthPx, heightPx);

    for (const area of orderedAreas) {
      if (area.op === "reveal") {
        ctx.clearRect(area.x, area.y, area.w, area.h);
      } else if (area.op === "hide") {
        ctx.fillStyle = "#040d1a";
        ctx.fillRect(area.x, area.y, area.w, area.h);
      }
    }
  }, [widthPx, heightPx, fogEnabled, orderedAreas]);

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
          zIndex: BOARD_Z_LAYERS.fog,
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
            zIndex: BOARD_Z_LAYERS.fogDraft
          }}
        />
      )}
    </>
  );
}
