import { useEffect, useState } from "react";
import {
  SPEECH_BUBBLE_DISPLAY_MS,
  SPEECH_BUBBLE_FADE_MS
} from "../../domain/constants.js";
import CpSpeechBubble from "../ui/CpSpeechBubble";

const TOTAL_BUBBLE_MS = SPEECH_BUBBLE_DISPLAY_MS + SPEECH_BUBBLE_FADE_MS;

/**
 * FUN-22: mensagens históricas já expiradas nunca renderizam nem por 1 frame no carregamento.
 * Usa `mountNow` inicializado via lazy initializer e timers assíncronos em `useEffect`.
 */
export default function TokenSpeechBubble({ speechBubble, bottomOffset = 12 }) {
  const [mountNow] = useState(() => Date.now());
  const [fadingBubbleId, setFadingBubbleId] = useState(null);
  const [closedBubbleId, setClosedBubbleId] = useState(null);

  const bubbleId = speechBubble?.id || null;
  const text = speechBubble?.text || null;
  const icon = speechBubble?.icon || null;
  const timestampMs =
    typeof speechBubble?.timestampMs === "number" && Number.isFinite(speechBubble.timestampMs)
      ? speechBubble.timestampMs
      : 0;

  const isExpiredAtMount = !timestampMs || timestampMs + TOTAL_BUBBLE_MS <= mountNow;
  const isFadingAtMount =
    Boolean(timestampMs) &&
    !isExpiredAtMount &&
    timestampMs + SPEECH_BUBBLE_DISPLAY_MS <= mountNow;

  useEffect(() => {
    if (!bubbleId || (!text && !icon) || !timestampMs) {
      return undefined;
    }

    const elapsed = Math.max(0, Date.now() - timestampMs);
    if (elapsed >= TOTAL_BUBBLE_MS) {
      const expiredTimer = setTimeout(() => {
        setClosedBubbleId(bubbleId);
      }, 0);
      return () => clearTimeout(expiredTimer);
    }

    const timeUntilFade = Math.max(0, SPEECH_BUBBLE_DISPLAY_MS - elapsed);
    const timeUntilClose = Math.max(0, TOTAL_BUBBLE_MS - elapsed);

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

  if (
    !speechBubble ||
    (!text && !icon) ||
    isExpiredAtMount ||
    closedBubbleId === bubbleId
  ) {
    return null;
  }

  const isFadingOut = isFadingAtMount || fadingBubbleId === bubbleId;

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
