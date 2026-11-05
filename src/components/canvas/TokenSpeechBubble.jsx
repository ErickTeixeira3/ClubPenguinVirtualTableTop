import { useEffect, useState } from "react";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

export default function TokenSpeechBubble({ speechBubble, bottomOffset = 12 }) {
  const [fadingBubbleId, setFadingBubbleId] = useState(null);
  const [closedBubbleId, setClosedBubbleId] = useState(null);

  const bubbleId = speechBubble?.id;
  const text = speechBubble?.text;
  const icon = speechBubble?.icon;
  const timestampMs = speechBubble?.timestampMs;

  useEffect(() => {
    if (!bubbleId || (!text && !icon) || !timestampMs) {
      return;
    }

    const elapsed = Math.max(0, Date.now() - timestampMs);
    const DISPLAY_DURATION_MS = 5000; // Visível pleno por 5 segundos
    const FADE_DURATION_MS = 600; // Fade out suave após os 5 segundos

    const timeUntilFade = Math.max(0, DISPLAY_DURATION_MS - elapsed);
    const timeUntilClose = Math.max(0, DISPLAY_DURATION_MS + FADE_DURATION_MS - elapsed);

    const fadeTimer = setTimeout(() => {
      setFadingBubbleId(bubbleId);
    }, timeUntilFade);

    const closeTimer = setTimeout(() => {
      setClosedBubbleId(bubbleId);
    }, timeUntilClose);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [bubbleId, text, icon, timestampMs]);

  if (!speechBubble || (!text && !icon) || closedBubbleId === bubbleId) {
    return null;
  }

  const isFadingOut = fadingBubbleId === bubbleId;

  return (
    <div
      key={bubbleId}
      className={`cp-speech-bubble-wrapper ${isFadingOut ? "cp-bubble-fade-out" : ""}`}
      style={{
        bottom: `calc(100% + ${bottomOffset}px)`
      }}
    >
      <div
        className={`cp-speech-bubble-body ${icon ? "cp-speech-bubble-icon-body" : ""}`}
      >
        {icon ? (
          <div className="cp-speech-bubble-icon-inner">
            {renderCpFlashIcon(icon, 34)}
          </div>
        ) : (
          text
        )}
      </div>
      <div className="cp-speech-bubble-tail">
        <svg
          width="18"
          height="12"
          viewBox="0 0 18 12"
          style={{
            display: "block",
            overflow: "visible",
            position: "relative",
            top: "-1.5px"
          }}
        >
          {/* Preenchimento branco para mesclar sem borda com a base do balão */}
          <polygon points="1,-2 17,-2 9,11" fill="#ffffff" />
          {/* Bordas cinzas laterais da ponta do balão */}
          <polyline
            points="1,0 9,11 17,0"
            fill="none"
            stroke="#545454"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
