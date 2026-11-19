import { useEffect, useMemo, useRef, useState } from "react";
import { PING_KINDS, PING_LIFETIME_MS } from "../../domain/constants.js";
import { isPingExpired } from "../../domain/models/index.js";

/**
 * PERF-06 + INT-16:
 * - O tick de 250ms vive EXCLUSIVAMENTE aqui (re-renderizando apenas a camada de pings,
 *   nunca o `BoardViewport` inteiro).
 * - Filtra e limpa pings expirados usando `.info/serverTimeOffset` (`serverTimeOffsetMs`)
 *   e `PING_LIFETIME_MS`, garantindo expiração mesmo se a aba emissora tiver fechado.
 */
export default function BoardPingsLayer({
  pings = [],
  snapshotReceivedAtMs = 0,
  serverTimeOffsetMs = 0,
  onCleanupExpired = null
}) {
  const [tickNowMs, setTickNowMs] = useState(() => Date.now());
  const hasPings = Array.isArray(pings) && pings.length > 0;

  const pingsRef = useRef(pings);
  const onCleanupExpiredRef = useRef(onCleanupExpired);

  useEffect(() => {
    pingsRef.current = pings;
    onCleanupExpiredRef.current = onCleanupExpired;
  }, [pings, onCleanupExpired]);

  useEffect(() => {
    if (!hasPings) return undefined;
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const serverNow = nowMs + serverTimeOffsetMs;
      setTickNowMs(nowMs);
      onCleanupExpiredRef.current?.(pingsRef.current, serverNow);
    }, 250);
    return () => clearInterval(interval);
  }, [hasPings, serverTimeOffsetMs]);

  const activePings = useMemo(() => {
    if (!hasPings) return [];
    const effectiveNowMs = Math.max(tickNowMs, snapshotReceivedAtMs || 0);
    const serverNow = effectiveNowMs + serverTimeOffsetMs;
    return pings.filter((ping) => !isPingExpired(ping, serverNow, PING_LIFETIME_MS));
  }, [hasPings, pings, tickNowMs, snapshotReceivedAtMs, serverTimeOffsetMs]);

  return (
    <>
      {activePings.map((ping) => {
        const hasSnowball =
          ping.kind === PING_KINDS.SNOWBALL &&
          ping.from &&
          typeof ping.from.x === "number" &&
          typeof ping.from.y === "number";
        const dx = hasSnowball ? ping.x - ping.from.x : 0;
        const dy = hasSnowball ? ping.y - ping.from.y : 0;

        return (
          <div key={ping.id}>
            {hasSnowball && (
              <div
                className="cp-snowball-projectile"
                style={{
                  left: `${ping.from.x}px`,
                  top: `${ping.from.y}px`,
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
