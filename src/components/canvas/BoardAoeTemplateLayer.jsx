/**
 * Fase 5: template visual de demarcação de área (AoE: alcance, círculo e cone) sobre o tabuleiro,
 * extraído de BoardViewport.jsx com JSX inalterado.
 */
export default function BoardAoeTemplateLayer({
  widthPx,
  heightPx,
  aoePreview
}) {
  return (
    <svg
      width={widthPx}
      height={heightPx}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 18
      }}
    >
      {aoePreview.type === "cone" ? (
        <g>
          {aoePreview.radiusPx > 2 && (
            <>
              <path
                d={`M ${aoePreview.origin.x} ${aoePreview.origin.y} L ${aoePreview.x1} ${aoePreview.y1} A ${aoePreview.radiusPx} ${aoePreview.radiusPx} 0 0 1 ${aoePreview.x2} ${aoePreview.y2} Z`}
                fill="rgba(239, 68, 68, 0.28)"
                stroke="#ef4444"
                strokeWidth="2.5"
              />
              <circle
                cx={aoePreview.origin.x}
                cy={aoePreview.origin.y}
                r={5}
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </>
          )}
        </g>
      ) : (
        <g>
          {aoePreview.maxRangePx > 0 && (
            <circle
              cx={aoePreview.origin.x}
              cy={aoePreview.origin.y}
              r={aoePreview.maxRangePx}
              fill="none"
              stroke="rgba(56, 189, 248, 0.55)"
              strokeWidth="1.5"
              strokeDasharray="6 6"
            />
          )}
          <line
            x1={aoePreview.origin.x}
            y1={aoePreview.origin.y}
            x2={aoePreview.circleCenter.x}
            y2={aoePreview.circleCenter.y}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
          <circle
            cx={aoePreview.circleCenter.x}
            cy={aoePreview.circleCenter.y}
            r={aoePreview.radiusPx}
            fill="rgba(239, 68, 68, 0.28)"
            stroke="#ef4444"
            strokeWidth="2.5"
          />
          <circle
            cx={aoePreview.circleCenter.x}
            cy={aoePreview.circleCenter.y}
            r={5}
            fill="#ef4444"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle
            cx={aoePreview.origin.x}
            cy={aoePreview.origin.y}
            r={4}
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}
