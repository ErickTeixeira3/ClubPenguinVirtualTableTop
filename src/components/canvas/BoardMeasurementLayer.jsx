/**
 * Fase 5: régua tática (linha, cone 45°/60° e círculo; 1 célula = 1,5m) na camada SVG do tabuleiro,
 * extraída de BoardViewport.jsx com JSX inalterado.
 */
export default function BoardMeasurementLayer({
  measureShape,
  measureStats,
  measureLine
}) {
  return (
    <g pointerEvents="none">
      {measureShape === "cone" ? (
        <>
          {/* Setor do Cone */}
          {measureStats.distPx > 2 && (
            <>
              <path
                d={`M ${measureLine.startX} ${measureLine.startY} L ${measureStats.x1} ${measureStats.y1} A ${measureStats.distPx} ${measureStats.distPx} 0 0 1 ${measureStats.x2} ${measureStats.y2} Z`}
                fill="rgba(255, 204, 0, 0.22)"
                stroke="#001b3a"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d={`M ${measureLine.startX} ${measureLine.startY} L ${measureStats.x1} ${measureStats.y1} A ${measureStats.distPx} ${measureStats.distPx} 0 0 1 ${measureStats.x2} ${measureStats.y2} Z`}
                fill="none"
                stroke="#ffcc00"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </>
          )}
          {/* Linha guia central pontilhada */}
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#001b3a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#00f0ff"
            strokeWidth="2"
            strokeDasharray="8 5"
            strokeLinecap="round"
          />
          {/* Origem e Alvo */}
          <circle
            cx={measureLine.startX}
            cy={measureLine.startY}
            r="6"
            fill="#ffcc00"
            stroke="#001b3a"
            strokeWidth="2"
          />
          <circle
            cx={measureLine.endX}
            cy={measureLine.endY}
            r="6"
            fill="#00f0ff"
            stroke="#001b3a"
            strokeWidth="2"
          />
        </>
      ) : measureShape === "circle" ? (
        <>
          {/* Círculo */}
          {measureStats.radiusPx > 2 && (
            <>
              <circle
                cx={measureLine.startX}
                cy={measureLine.startY}
                r={measureStats.radiusPx}
                fill="rgba(255, 204, 0, 0.22)"
                stroke="#001b3a"
                strokeWidth="5"
              />
              <circle
                cx={measureLine.startX}
                cy={measureLine.startY}
                r={measureStats.radiusPx}
                fill="none"
                stroke="#ffcc00"
                strokeWidth="2.5"
              />
            </>
          )}
          {/* Linha do Raio */}
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#001b3a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#00f0ff"
            strokeWidth="2"
            strokeDasharray="8 5"
            strokeLinecap="round"
          />
          {/* Centro e Perímetro */}
          <circle
            cx={measureLine.startX}
            cy={measureLine.startY}
            r="6"
            fill="#ffcc00"
            stroke="#001b3a"
            strokeWidth="2"
          />
          <circle
            cx={measureLine.endX}
            cy={measureLine.endY}
            r="6"
            fill="#00f0ff"
            stroke="#001b3a"
            strokeWidth="2"
          />
        </>
      ) : (
        <>
          {/* Linha Reta Padrão */}
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#001b3a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <line
            x1={measureLine.startX}
            y1={measureLine.startY}
            x2={measureLine.endX}
            y2={measureLine.endY}
            stroke="#ffcc00"
            strokeWidth="3.5"
            strokeDasharray="10 6"
            strokeLinecap="round"
          />
          <circle
            cx={measureLine.startX}
            cy={measureLine.startY}
            r="6"
            fill="#ffcc00"
            stroke="#001b3a"
            strokeWidth="2"
          />
          <circle
            cx={measureLine.endX}
            cy={measureLine.endY}
            r="7"
            fill="#00f0ff"
            stroke="#001b3a"
            strokeWidth="2"
          />
        </>
      )}
    </g>
  );
}
