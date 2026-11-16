/**
 * Fase 5: pings e bolas de neve em voo sobre o tabuleiro, extraídos de BoardViewport.jsx com JSX inalterado.
 */
export default function BoardPingsLayer({
  activePings
}) {
  return (
    <>
      {activePings.map((ping) => {
        const hasSnowball =
          typeof ping.startX === "number" && typeof ping.startY === "number";
        const dx = hasSnowball ? ping.x - ping.startX : 0;
        const dy = hasSnowball ? ping.y - ping.startY : 0;

        return (
          <div key={ping.id}>
            {hasSnowball && (
              <div
                className="cp-snowball-projectile"
                style={{
                  left: `${ping.startX}px`,
                  top: `${ping.startY}px`,
                  "--snowball-dx": `${dx}px`,
                  "--snowball-dy": `${dy}px`
                }}
              >
                <div className="cp-snowball-projectile-ball" />
              </div>
            )}
            <div
              className={`cp-ping-container ${hasSnowball ? "cp-ping-with-snowball" : ""}`}
              style={{
                left: `${ping.x}px`,
                top: `${ping.y}px`,
                "--ping-color": ping.color || "#00f0ff"
              }}
            >
              <div className="cp-ping-ring" />
              <div className="cp-ping-ring delay-1" />
              <div className="cp-ping-ring delay-2" />
              <div className="cp-ping-center-drop" />
            </div>
          </div>
        );
      })}
    </>
  );
}
