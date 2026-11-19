import { useCallback, useMemo } from "react";
import { selectMessageView } from "../../engines/chat/messageSelector.js";

/**
 * Seletor da origem de fala sobre o adaptador T5. Identidade e horário vêm do contrato v2.
 * FUN-04: identifica falas exclusivamente por `tokenId` ou `characterId` (sem casar nomes).
 */
export function getSpeechSource(msg) {
  if (!msg || typeof msg !== "object") return null;
  const view = selectMessageView(msg);

  const icon = view.emote?.icon || view.roll?.icon || null;
  const isText = view.type === "text" && Boolean(view.content.trim());
  const isEmote = view.type === "emote" && Boolean(icon);
  const isAbilityWithIcon = view.type === "roll" && Boolean(icon);

  if (!isText && !isEmote && !isAbilityWithIcon) {
    return null;
  }

  return {
    tokenId: msg.tokenId || msg.sender?.tokenId || null,
    characterId: view.sender.characterId,
    speech: {
      id: view.id,
      text: isEmote || isAbilityWithIcon ? null : view.content,
      icon: isEmote || isAbilityWithIcon ? icon : null,
      timestampMs: view.createdAtMs
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
