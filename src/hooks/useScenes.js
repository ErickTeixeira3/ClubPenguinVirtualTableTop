import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { isReleasedToPlayers, subscribeVisibleCollection } from "../services/visibilityService";
import { db } from "../services/firebase";
import { uploadCompressedMedia } from "../services/mediaService";
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
    // Se não for o Mestre real no banco, consulta apenas cenas liberadas (visibleTo ou visibleToPlayers; exigido pelo firestore.rules)
    // Fase 6.2 (A5/A6: cenas liberadas por visibleToPlayers chegam mesmo com visibleTo defasado).
    const unsubscribe = subscribeVisibleCollection({
      colRef: scenesCol,
      isRealGM,
      uid: listenerUid,
      includePublicFlag: true,
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
    visibleToPlayers = true,
    grid = DEFAULT_GRID_CONFIG
  }) => {
    if (!isRealGM || !user) return null;

    let mediaInfo = {
      mediaId: null,
      externalUrl: externalUrl?.trim() || null,
      widthPx: Number(widthPx) || 1920,
      heightPx: Number(heightPx) || 1080,
      sizeBytes: 0
    };

    if (file) {
      const uploaded = await uploadCompressedMedia({
        file,
        category: "scene",
        campaignId,
        uploadedBy: user.uid
      });
      mediaInfo = {
        mediaId: uploaded.mediaId,
        externalUrl: null,
        widthPx: uploaded.widthPx,
        heightPx: uploaded.heightPx,
        sizeBytes: uploaded.sizeBytes
      };
    }

    const sceneId = `scene_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);

    const gmUid = campaign?.gmId || user.uid;
    const isVisible = Boolean(visibleToPlayers);
    const newScene = {
      id: sceneId,
      campaignId,
      name: name?.trim() || "Novo Mapa",
      visibleToPlayers: isVisible,
      visibleTo: isVisible ? ["ALL"] : [gmUid],
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

    const nextPayload = {
      ...updates,
      campaignId,
      updatedAt: serverTimestamp()
    };

    if (updates.visibleToPlayers !== undefined) {
      const gmUid = campaign?.gmId || user.uid;
      nextPayload.visibleTo = updates.visibleToPlayers ? ["ALL"] : [gmUid];
    }

    if (newImageFile) {
      const uploaded = await uploadCompressedMedia({
        file: newImageFile,
        category: "scene",
        campaignId,
        uploadedBy: user.uid
      });

      nextPayload.mapImage = {
        mediaId: uploaded.mediaId,
        externalUrl: null,
        widthPx: uploaded.widthPx,
        heightPx: uploaded.heightPx,
        sizeBytes: uploaded.sizeBytes
      };
    } else if (
      updates.externalUrl !== undefined &&
      updates.externalUrl?.trim()
    ) {
      nextPayload.mapImage = {
        mediaId: null,
        externalUrl: updates.externalUrl.trim(),
        widthPx: existing.mapImage?.widthPx || 1920,
        heightPx: existing.mapImage?.heightPx || 1080,
        sizeBytes: 0
      };
      delete nextPayload.externalUrl;
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
      if (target && !target.visibleToPlayers) {
        const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
        await updateDoc(sceneRef, {
          visibleToPlayers: true,
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
