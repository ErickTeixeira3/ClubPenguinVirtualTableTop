import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import { isReleasedToPlayers, subscribeVisibleCollection } from "../services/visibilityService";
import { db } from "../infra/firebase.js";
import { grantMediaAudience, uploadCompressedMedia } from "../services/mediaService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export const DEFAULT_GRID_CONFIG = {
  enabled: true,
  snapToGrid: true,
  cellSizePx: 64,
  offsetX: 0,
  offsetY: 0,
  color: "#ffffff",
  opacity: 0.28
};

export function useScenes() {
  const { user } = useAuth();
  const {
    campaignId,
    campaign,
    isRealGM,
    isGM,
    setActiveScene
  } = useCampaign();

  const [rawScenes, setRawScenes] = useState([]);
  const [scenesError, setScenesError] = useState("");

  // Fase 3.1 (V-13): listeners dependem só de uid/campaignId/prontidão da campanha/papel,
  // não do objeto `campaign` (recriado a cada snapshot da campanha ou resolução de avatar).
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;

    const scenesCol = collection(db, "campaigns", campaignId, "scenes");
    const unsubscribe = subscribeVisibleCollection({
      colRef: scenesCol,
      isRealGM,
      uid: listenerUid,
      onNext: (snapshot) => {
        setScenesError("");
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((s) => !s.isDeleted);
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawScenes(list);
      },
      onError: (err) => {
        setScenesError(err?.message || "Erro ao carregar mapas.");
      }
    });

    return () => unsubscribe();
  }, [listenerUid, campaignId, campaignReady, isRealGM]);

  // Se o Mestre ativou "Visão: Player", filtra no cliente como um player veria.
  // Fase 6.2 (A6/A10): visibleToPlayers é a fonte da verdade quando existe; na "Visão Player" do
  // Mestre real o UID dele (presente em todo visibleTo de cena oculta) não conta como liberação.
  const currentUid = user?.uid;
  const scenes = useMemo(() => {
    if (isGM) return rawScenes;
    const viewerUid = isRealGM ? null : currentUid;
    return rawScenes.filter((s) => isReleasedToPlayers(s, viewerUid));
  }, [rawScenes, isGM, isRealGM, currentUid]);

  const activeSceneId = campaign?.activeSceneId || null;

  const activeScene = useMemo(() => {
    if (!activeSceneId) return null;
    return scenes.find((s) => s.id === activeSceneId) || null;
  }, [scenes, activeSceneId]);

  const createScene = async ({
    name,
    file,
    externalUrl = "",
    widthPx = 1920,
    heightPx = 1080,
    isPublic = true,
    visibleTo = null,
    grid = DEFAULT_GRID_CONFIG
  }) => {
    if (!isRealGM || !user) return null;

    const gmUid = campaign?.gmId || user.uid;
    const canonicalVisibleTo = Array.isArray(visibleTo)
      ? computeAudience({
          visibleTo: visibleTo.includes("ALL") ? ["ALL"] : [gmUid, ...visibleTo]
        }).visibleTo
      : isPublic
      ? ["ALL"]
      : [gmUid];

    let mediaInfo = {
      mediaId: null,
      externalUrl: externalUrl?.trim() || null,
      widthPx: Number(widthPx) || 1920,
      heightPx: Number(heightPx) || 1080,
      byteLength: 0
    };

    if (file) {
      const uploaded = await uploadCompressedMedia({
        file,
        category: "scene",
        campaignId,
        uploadedBy: user.uid,
        visibleTo: canonicalVisibleTo
      });
      mediaInfo = {
        mediaId: uploaded.mediaId,
        externalUrl: null,
        widthPx: uploaded.widthPx,
        heightPx: uploaded.heightPx,
        byteLength: uploaded.byteLength
      };
    }

    const sceneId = `scene_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);

    const newScene = {
      id: sceneId,
      campaignId,
      name: name?.trim() || "Novo Mapa",
      visibleTo: canonicalVisibleTo,
      isDeleted: false,
      mapImage: mediaInfo,
      grid: {
        ...DEFAULT_GRID_CONFIG,
        ...grid,
        cellSizePx: Math.max(16, Number(grid?.cellSizePx) || 64),
        offsetX: Number(grid?.offsetX) || 0,
        offsetY: Number(grid?.offsetY) || 0,
        opacity: Number(grid?.opacity ?? 0.28)
      },
      fogOfWar: {
        enabled: false,
        defaultOpaque: false
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(sceneRef, newScene);
    return sceneId;
  };

  const updateScene = async (
    sceneId,
    updates = {},
    newImageFile = null
  ) => {
    if (!isRealGM || !user || !sceneId) return;

    const existing = rawScenes.find((s) => s.id === sceneId);
    if (!existing) return;

    const gmUid = campaign?.gmId || user.uid;
    const {
      isPublic: nextIsPublic,
      visibleToPlayers: _legacyVisibleFlag,
      ...cleanUpdates
    } = updates;

    const nextPayload = {
      ...cleanUpdates,
      campaignId,
      updatedAt: serverTimestamp()
    };

    if (nextIsPublic !== undefined) {
      nextPayload.visibleTo = nextIsPublic ? ["ALL"] : [gmUid];
    } else if (Array.isArray(cleanUpdates.visibleTo)) {
      nextPayload.visibleTo = cleanUpdates.visibleTo.includes("ALL")
        ? ["ALL"]
        : computeAudience({ visibleTo: [gmUid, ...cleanUpdates.visibleTo] }).visibleTo;
    }

    const effectiveVisibleTo =
      nextPayload.visibleTo !== undefined
        ? nextPayload.visibleTo
        : Array.isArray(existing.visibleTo)
        ? existing.visibleTo
        : [gmUid];

    if (newImageFile) {
      const uploaded = await uploadCompressedMedia({
        file: newImageFile,
        category: "scene",
        campaignId,
        uploadedBy: user.uid,
        visibleTo: effectiveVisibleTo
      });

      nextPayload.mapImage = {
        mediaId: uploaded.mediaId,
        externalUrl: null,
        widthPx: uploaded.widthPx,
        heightPx: uploaded.heightPx,
        byteLength: uploaded.byteLength
      };
    } else if (
      cleanUpdates.externalUrl !== undefined &&
      cleanUpdates.externalUrl?.trim()
    ) {
      nextPayload.mapImage = {
        mediaId: null,
        externalUrl: cleanUpdates.externalUrl.trim(),
        widthPx: existing.mapImage?.widthPx || 1920,
        heightPx: existing.mapImage?.heightPx || 1080,
        byteLength: 0
      };
      delete nextPayload.externalUrl;
    } else {
      const nextMapMediaId =
        nextPayload.mapImage !== undefined
          ? nextPayload.mapImage?.mediaId
          : existing.mapImage?.mediaId;
      const mapMediaChanged =
        nextPayload.mapImage !== undefined &&
        Boolean(nextMapMediaId) &&
        nextMapMediaId !== existing.mapImage?.mediaId;
      if (nextMapMediaId && (nextPayload.visibleTo !== undefined || mapMediaChanged)) {
        await grantMediaAudience({
          campaignId,
          mediaId: nextMapMediaId,
          visibleTo: effectiveVisibleTo
        });
      }

      const nextAudioMediaId =
        nextPayload.ambientAudio !== undefined
          ? nextPayload.ambientAudio?.mediaId
          : existing.ambientAudio?.mediaId;
      const audioMediaChanged =
        nextPayload.ambientAudio !== undefined &&
        Boolean(nextAudioMediaId) &&
        nextAudioMediaId !== existing.ambientAudio?.mediaId;
      if (nextAudioMediaId && (nextPayload.visibleTo !== undefined || audioMediaChanged)) {
        await grantMediaAudience({
          campaignId,
          mediaId: nextAudioMediaId,
          visibleTo: effectiveVisibleTo
        });
      }
    }

    const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
    await updateDoc(sceneRef, nextPayload);
  };

  const deleteScene = async (sceneId) => {
    if (!isRealGM || !user || !sceneId) return;

    if (campaign?.activeSceneId === sceneId) {
      await setActiveScene(null);
    }

    const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
    await updateDoc(sceneRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: user.uid
    });
  };

  const activateSceneForTable = async (sceneId) => {
    if (!isRealGM) return;

    if (sceneId) {
      const target = rawScenes.find((s) => s.id === sceneId);
      if (target && !isReleasedToPlayers(target)) {
        if (target.mapImage?.mediaId) {
          await grantMediaAudience({
            campaignId,
            mediaId: target.mapImage.mediaId,
            visibleTo: ["ALL"]
          });
        }
        if (target.ambientAudio?.mediaId) {
          await grantMediaAudience({
            campaignId,
            mediaId: target.ambientAudio.mediaId,
            visibleTo: ["ALL"]
          });
        }
        const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
        await updateDoc(sceneRef, {
          visibleTo: ["ALL"],
          updatedAt: serverTimestamp()
        });
      }
    }

    await setActiveScene(sceneId || null);
  };

  return {
    scenes,
    rawScenes,
    activeScene,
    scenesError,
    createScene,
    updateScene,
    deleteScene,
    activateSceneForTable
  };
}
