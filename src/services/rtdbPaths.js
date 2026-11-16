/**
 * Fase 6.1 / 6.7: caminhos do Realtime Database para desenhos, pings e espelho do Mestre.
 *
 * RTDB_LAYOUT controla onde esses dados ficam:
 * - "legacy": desenhos e pings dentro de `fog/{sceneId}` (modo de compatibilidade pré-6.7).
 * - "split" (ATUAL — Fase 6.7): nós irmãos `drawings/{sceneId}` e `pings/{sceneId}`, mais `meta/gmId`,
 *   ativando a migração única `fog/{sceneId}/drawings -> drawings/{sceneId}` e tokens `controlledBy` -> mapa.
 */
export const RTDB_LAYOUT = "split";

export const IS_SPLIT_RTDB_LAYOUT = RTDB_LAYOUT === "split";

export function drawingsPath(campaignId, sceneId) {
  return IS_SPLIT_RTDB_LAYOUT
    ? `vtt_realtime/${campaignId}/drawings/${sceneId}`
    : `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`;
}

export function pingsPath(campaignId, sceneId) {
  return IS_SPLIT_RTDB_LAYOUT
    ? `vtt_realtime/${campaignId}/pings/${sceneId}`
    : `vtt_realtime/${campaignId}/fog/${sceneId}/pings`;
}

export function gmMetaPath(campaignId) {
  return `vtt_realtime/${campaignId}/meta/gmId`;
}
