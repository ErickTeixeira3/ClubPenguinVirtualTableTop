import { useEffect, useState } from "react";
import { getCachedMediaSync, getMediaDataUrl } from "../services/mediaService";
import { DEFAULT_CAMPAIGN_ID } from "../infra/firebase.js";

export function useMediaUrl(
  mediaId,
  externalUrl = null,
  campaignId = DEFAULT_CAMPAIGN_ID
) {
  const cacheKey = mediaId ? `${campaignId}:${mediaId}` : null;
  const [resolvedState, setResolvedState] = useState({
    key: null,
    url: null
  });

  const syncCached = mediaId ? getCachedMediaSync(mediaId, campaignId) : null;

  useEffect(() => {
    if (!mediaId) return;
    if (getCachedMediaSync(mediaId, campaignId)) return;

    let cancelled = false;
    getMediaDataUrl(mediaId, campaignId)
      .then((dataUrl) => {
        if (!cancelled) {
          setResolvedState({ key: `${campaignId}:${mediaId}`, url: dataUrl });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedState({ key: `${campaignId}:${mediaId}`, url: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, campaignId]);

  if (externalUrl) {
    return { url: externalUrl, loading: false };
  }

  if (!mediaId) {
    return { url: null, loading: false };
  }

  if (syncCached) {
    return { url: syncCached, loading: false };
  }

  if (resolvedState.key === cacheKey) {
    return { url: resolvedState.url, loading: false };
  }

  return { url: null, loading: true };
}

