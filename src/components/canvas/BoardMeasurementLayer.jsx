function MeasurementGuideLine({
  startX,
  startY,
  endX,
  endY,
  primary = false
}) {
  return (
    <>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke="#001b3a"
        strokeWidth={primary ? "6" : "4"}
        strokeLinecap="round"
      />
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={primary ? "#ffcc00" : "#00f0ff"}
        strokeWidth={primary ? "3.5" : "2"}
        strokeDasharray={primary ? "10 6" : "8 5"}
        strokeLinecap="round"
      />
      <circle
        cx={startX}
        cy={startY}
        r="6"
        fill="#ffcc00"
        stroke="#001b3a"
        strokeWidth="2"
      />
      <circle
        cx={endX}
        cy={endY}
        r={primary ? "7" : "6"}
        fill="#00f0ff"
        stroke="#001b3a"
        strokeWidth="2"
      />
    </>
  );
}

/**
 * Régua tática (linha, cone 45°/60° e círculo; 1 célula = 1,5m).
 * Recebe `measureStats` calculado exclusivamente por `computeRulerStats` de `engines/geometry`.
 */
export default function BoardMeasurementLayer({
  measureShape,
  measureStats,
  measureLine
}) {
  if (!measureLine || !measureStats) return null;

  return (
    <g pointerEvents="none">
      {measureShape === "cone" ? (
        <>
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
          <MeasurementGuideLine
            startX={measureLine.startX}
            startY={measureLine.startY}
            endX={measureLine.endX}
            endY={measureLine.endY}
          />
        </>
      ) : measureShape === "circle" ? (
        <>
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
          <MeasurementGuideLine
            startX={measureLine.startX}
            startY={measureLine.startY}
            endX={measureLine.endX}
            endY={measureLine.endY}
          />
        </>
      ) : (
        <MeasurementGuideLine
          startX={measureLine.startX}
          startY={measureLine.startY}
          endX={measureLine.endX}
          endY={measureLine.endY}
          primary={true}
        />
      )}
    </g>
  );
}
