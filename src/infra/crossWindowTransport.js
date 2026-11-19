import { ID_PREFIXES } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { systemClock } from "./clock.js";
import { createId } from "./ids.js";

export const CHANNEL_PREFIX = "cp_vtt_sync_v1_";
export const STORAGE_KEY_PREFIX = "cp_vtt_sync_v1_packet_";

export function assertValidCampaignChannel(campaignId) {
  if (typeof campaignId !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "Cross-window campaignId must be a non-empty string.",
      { campaignId }
    );
  }
  const trimmed = campaignId.trim();
  if (!trimmed || trimmed !== campaignId || trimmed.toLowerCase() === "default") {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      `Invalid cross-window campaignId "${campaignId}".`,
      { campaignId }
    );
  }
  return trimmed;
}

function getLocalStorageSafely(onError) {
  try {
    return typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : null;
  } catch (err) {
    onError?.(err, { action: "accessLocalStorage" });
    return null;
  }
}

/**
 * Abre o transporte entre janelas da mesma origem para uma campanha explícita:
 * 1. `BroadcastChannel`, quando disponível;
 * 2. fallback por `localStorage` + evento `storage` (A13).
 * Retorna `{ kind, channelName, post(packet), close() }` ou `null` quando indisponível.
 */
export function openCrossWindowTransport(
  campaignId,
  onPacket,
  {
    onError = null,
    clock = systemClock,
    random = Math.random
  } = {}
) {
  const validCampaignId = assertValidCampaignChannel(campaignId);
  if (typeof window === "undefined") {
    return null;
  }

  const channelName = `${CHANNEL_PREFIX}${validCampaignId}`;

  if (typeof window.BroadcastChannel === "function") {
    try {
      const channel = new window.BroadcastChannel(channelName);
      channel.onmessage = (event) => {
        onPacket?.(event?.data);
      };
      return {
        kind: "broadcast",
        channelName,
        post: (packet) => {
          channel.postMessage(packet);
        },
        close: () => {
          channel.close();
        }
      };
    } catch (err) {
      onError?.(err, { action: "openBroadcastChannel", channelName });
    }
  }

  const storage = getLocalStorageSafely(onError);
  if (!storage || typeof window.addEventListener !== "function") {
    return null;
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${channelName}`;
  const handleStorage = (event) => {
    if (event?.key !== storageKey || !event.newValue) return;
    try {
      onPacket?.(JSON.parse(event.newValue));
    } catch (err) {
      onError?.(err, { action: "parseStoragePacket", storageKey });
    }
  };
  window.addEventListener("storage", handleStorage);

  return {
    kind: "storage",
    channelName,
    storageKey,
    post: (packet) => {
      // `nonce` garante valor novo a cada envio (evento `storage` dispara apenas quando o valor muda)
      const nonce = createId(ID_PREFIXES.WINDOW, {
        now: () => clock.now(),
        random
      });
      storage.setItem(storageKey, JSON.stringify({ ...packet, nonce }));
    },
    close: () => {
      window.removeEventListener("storage", handleStorage);
    }
  };
}
