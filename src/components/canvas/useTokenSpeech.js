import { useCallback, useMemo } from "react";

/**
 * Fase 8: origem da fala/emote de uma mensagem do chat (extraído do BoardViewport).
 * FUN-04: identifica falas exclusivamente por `tokenId` ou `characterId` (sem casar nomes).
 */
export function getSpeechSource(msg) {
  if (!msg || typeof msg !== "object") return null;

  const icon = msg.icon || msg.rollData?.icon || null;
  const isText = msg.type === "text" && Boolean(msg.content && msg.content.trim());
  const isEmote = msg.type === "emote" && Boolean(icon);
  const isAbilityWithIcon = msg.type === "ability_roll" && Boolean(icon);

  if (!isText && !isEmote && !isAbilityWithIcon) {
    return null;
  }

  return {
    tokenId: msg.tokenId || null,
    characterId: msg.characterId || null,
    speech: {
      id: msg.id,
      text: isEmote || isAbilityWithIcon ? null : msg.content,
      icon: isEmote || isAbilityWithIcon ? icon : null,
      timestampMs: msg.timestampMs || 0
    }
  };
}

export function useTokenSpeech(messages = []) {
  const latestSpeeches = useMemo(() => {
    const byTokenId = {};
    const byCharId = {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return { byTokenId, byCharId };
    }

    for (const msg of messages) {
      const parsed = getSpeechSource(msg);
      if (!parsed) continue;
      if (parsed.tokenId) {
        byTokenId[parsed.tokenId] = parsed.speech;
      }
      if (parsed.characterId) {
        byCharId[parsed.characterId] = parsed.speech;
      }
    }

    return { byTokenId, byCharId };
  }, [messages]);

  const getTokenSpeech = useCallback(
    (token) => {
      if (!token) return null;
      if (token.id && latestSpeeches.byTokenId[token.id]) {
        return latestSpeeches.byTokenId[token.id];
      }
      if (token.characterId && latestSpeeches.byCharId[token.characterId]) {
        return latestSpeeches.byCharId[token.characterId];
      }
      return null;
    },
    [latestSpeeches]
  );

  return { getTokenSpeech };
}
