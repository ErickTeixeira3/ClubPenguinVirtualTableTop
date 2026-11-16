import { useEffect, useState } from "react";
import CpSpeechBubble from "../ui/CpSpeechBubble";

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

  // Fase 4: apresentação extraída para ui/CpSpeechBubble (este componente mantém só o tempo de
  // exibição/fade). A `key` por bolha remonta o balão a cada nova fala, reiniciando a animação.
  return (
    <CpSpeechBubble
      key={bubbleId}
      text={text}
      icon={icon}
      isFadingOut={isFadingOut}
      bottomOffset={bottomOffset}
    />
  );
}
