import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { uploadCompressedMedia, deleteMedia } from "../services/mediaService";
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

  useEffect(() => {
    if (!user || !campaignId || !campaign) return;

    const scenesCol = collection(db, "campaigns", campaignId, "scenes");
    // Se não for o Mestre real no banco, consulta apenas cenas liberadas para players (exigido pelo firestore.rules)
    const scenesQuery = isRealGM
      ? query(scenesCol)
      : query(scenesCol, where("visibleToPlayers", "==", true));

    const unsubscribe = onSnapshot(
      scenesQuery,
      (snapshot) => {
        setScenesError("");
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawScenes(list);
      },
      (err) => {
        setScenesError(err?.message || "Erro ao carregar mapas.");
      }
    );

    return () => unsubscribe();
  }, [user, campaignId, campaign, isRealGM]);

  // Se o Mestre ativou "Visão: Player", filtra no cliente como um player veria
  const scenes = useMemo(() => {
    if (isGM) return rawScenes;
    return rawScenes.filter((s) => s.visibleToPlayers === true);
  }, [rawScenes, isGM]);

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

    const newScene = {
      id: sceneId,
      name: name?.trim() || "Novo Mapa",
      visibleToPlayers: Boolean(visibleToPlayers),
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
      updatedAt: serverTimestamp()
    };

    if (newImageFile) {
      const uploaded = await uploadCompressedMedia({
        file: newImageFile,
        category: "scene",
        campaignId,
        uploadedBy: user.uid
      });

      const oldMediaId = existing.mapImage?.mediaId;
      if (oldMediaId) {
        await deleteMedia(oldMediaId, campaignId);
      }

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
      const oldMediaId = existing.mapImage?.mediaId;
      if (oldMediaId) {
        await deleteMedia(oldMediaId, campaignId);
      }
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
    if (!isRealGM || !sceneId) return;

    const existing = rawScenes.find((s) => s.id === sceneId);
    if (existing?.mapImage?.mediaId) {
      await deleteMedia(existing.mapImage.mediaId, campaignId);
    }

    if (campaign?.activeSceneId === sceneId) {
      await setActiveScene(null);
    }

    const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
    await deleteDoc(sceneRef);
  };

  const activateSceneForTable = async (sceneId) => {
    if (!isRealGM) return;

    if (sceneId) {
      const target = rawScenes.find((s) => s.id === sceneId);
      if (target && !target.visibleToPlayers) {
        const sceneRef = doc(db, "campaigns", campaignId, "scenes", sceneId);
        await updateDoc(sceneRef, {
          visibleToPlayers: true,
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
