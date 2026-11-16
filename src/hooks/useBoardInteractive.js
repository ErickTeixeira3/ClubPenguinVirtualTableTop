import { useEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  onValue,
  get as rtdbGet,
  set as rtdbSet,
  update as rtdbUpdate,
  remove as rtdbRemove
} from "firebase/database";
import { rtdb } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { resolveSpeakerIdentity } from "../services/rollService";
import { IS_SPLIT_RTDB_LAYOUT, drawingsPath, pingsPath } from "../services/rtdbPaths";

const PING_LIFETIME_MS = 2200;

export function useBoardInteractive(sceneId) {
  const { user } = useAuth();
  const { campaignId, isGM, isRealGM, myPlayerProfile } = useCampaign();

  const [drawingsState, setDrawingsState] = useState({
    sceneKey: null,
    map: {}
  });
  const [pingsMap, setPingsMap] = useState({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Fase 3.1 (V-06): cenas cuja migração legada CONCLUIU com sucesso nesta sessão
  // e cenas com migração em andamento (evita execução concorrente).
  const migratedScenesRef = useRef(new Set());
  const migratingScenesRef = useRef(new Set());

  // Subscreve aos desenhos e textos da cena ativa no nó dedicado drawings/{sceneId}
  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const currentSceneKey = `${campaignId}:${sceneId}`;
    const drawingsRef = ref(
      rtdb,
      drawingsPath(campaignId, sceneId)
    );

    const unsubscribe = onValue(
      drawingsRef,
      (snapshot) => {
        setDrawingsState({
          sceneKey: currentSceneKey,
          map: snapshot.val() || {}
        });
      },
      () => {
        setDrawingsState({
          sceneKey: currentSceneKey,
          map: {}
        });
      }
    );

    return () => unsubscribe();
  }, [user, campaignId, sceneId]);

  // Migração automática única de desenhos legados de fog/{sceneId}/drawings -> drawings/{sceneId}
  // Fase 6.1: só roda no layout "split" (após o deploy das regras novas). No layout "legacy",
  // fog/{sceneId}/drawings É o local oficial dos desenhos e nada deve ser movido.
  useEffect(() => {
    if (!IS_SPLIT_RTDB_LAYOUT) return;
    if (!user || !isRealGM || !campaignId || !sceneId) return;

    const currentSceneKey = `${campaignId}:${sceneId}`;
    if (
      migratedScenesRef.current.has(currentSceneKey) ||
      migratingScenesRef.current.has(currentSceneKey)
    ) {
      return;
    }
    migratingScenesRef.current.add(currentSceneKey);

    const legacyDrawingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
    );
    const legacyPingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/pings`
    );
    const targetDrawingsRef = ref(
      rtdb,
      drawingsPath(campaignId, sceneId)
    );

    // A migração é idempotente e não altera estado React: roda até o fim mesmo que o efeito
    // seja desmontado (StrictMode em dev, troca rápida de cena ou de isRealGM). A cena só é
    // marcada como migrada após sucesso; em falha, poderá ser retentada numa próxima montagem.
    (async () => {
      try {
        const legacySnap = await rtdbGet(legacyDrawingsRef);

        if (legacySnap.exists()) {
          const legacyMap = legacySnap.val() || {};
          const targetSnap = await rtdbGet(targetDrawingsRef);

          const existingTargetMap = targetSnap.val() || {};
          const updates = {};

          Object.entries(legacyMap).forEach(([itemId, itemVal]) => {
            if (!itemVal || existingTargetMap[itemId]) return;
            updates[itemId] = {
              ...itemVal,
              id: itemVal.id || itemId,
              campaignId: itemVal.campaignId || campaignId,
              sceneId: itemVal.sceneId || sceneId,
              authorId: itemVal.authorId || itemVal.createdBy || user.uid
            };
          });

          if (Object.keys(updates).length > 0) {
            await rtdbUpdate(targetDrawingsRef, updates);
          }

          await rtdbRemove(legacyDrawingsRef);
        }

        const legacyPingsSnap = await rtdbGet(legacyPingsRef);
        if (legacyPingsSnap.exists()) {
          await rtdbRemove(legacyPingsRef);
        }
        migratedScenesRef.current.add(currentSceneKey);
      } catch (err) {
        console.warn("Aviso na migração legada de desenhos RTDB:", err);
      } finally {
        migratingScenesRef.current.delete(currentSceneKey);
      }
    })();
  }, [user, isRealGM, campaignId, sceneId]);

  // Subscreve aos Pings em tempo real no nó dedicado pings/{sceneId}
  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const pingsRef = ref(
      rtdb,
      pingsPath(campaignId, sceneId)
    );

    const unsubscribe = onValue(
      pingsRef,
      (snapshot) => {
        setPingsMap(snapshot.val() || {});
        setNowTick(Date.now());
      },
      () => {
        setPingsMap({});
      }
    );

    return () => unsubscribe();
  }, [user, campaignId, sceneId]);

  // Atualiza relógio local enquanto houver pings ativos
  useEffect(() => {
    const activeCount = Object.values(pingsMap).filter(
      (p) => p && Date.now() - (p.timestamp || 0) < PING_LIFETIME_MS
    ).length;
    if (activeCount === 0) return;

    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [pingsMap]);

  const currentSceneKey =
    user && campaignId && sceneId ? `${campaignId}:${sceneId}` : null;

  const allDrawings = useMemo(() => {
    if (!currentSceneKey || drawingsState.sceneKey !== currentSceneKey) {
      return [];
    }
    return Object.values(drawingsState.map || {}).filter(Boolean);
  }, [drawingsState, currentSceneKey]);

  // Separa traços (strokes) e caixas de texto
  const strokes = useMemo(() => {
    return allDrawings
      .filter(
        (item) =>
          item.type === "stroke" ||
          (!item.type && Array.isArray(item.points) && item.points.length >= 1)
      )
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [allDrawings]);

  const shapes = useMemo(() => {
    return allDrawings
      .filter(
        (item) =>
          item.type === "circle" ||
          item.type === "rect" ||
          item.shapeType === "circle" ||
          item.shapeType === "rect"
      )
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [allDrawings]);

  const textItems = useMemo(() => {
    return allDrawings
      .filter(
        (item) => item.type === "text" || typeof item.text === "string"
      )
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [allDrawings]);

  const activePings = useMemo(() => {
    return Object.values(pingsMap || {}).filter(
      (p) =>
        p &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        nowTick - (p.timestamp || 0) < PING_LIFETIME_MS
    );
  }, [pingsMap, nowTick]);

  const canEditDrawing = (item) => {
    if (!user || !item) return false;
    if (isGM) return true;
    const owner = item.authorId || item.createdBy;
    return owner === user.uid;
  };

  // Fase 3.1 (errata Fase 3 §4.2): autor resolvido pelo ponto único resolveSpeakerIdentity
  const getAuthorName = () =>
    resolveSpeakerIdentity({ user, myPlayerProfile }).senderName;

  const triggerPing = async (x, y, color = "#00f0ff", origin = null) => {
    if (!user || !campaignId || !sceneId) return;
    const pingId = `ping_${user.uid}_${Date.now()}`;
    const pingRef = ref(
      rtdb,
      `${pingsPath(campaignId, sceneId)}/${pingId}`
    );

    const authorName = getAuthorName();
    const now = Date.now();
    const payload = {
      id: pingId,
      campaignId,
      sceneId,
      x: Math.round(x),
      y: Math.round(y),
      color,
      authorId: user.uid,
      authorName,
      senderId: user.uid,
      senderName: authorName,
      createdAt: now,
      timestamp: now
    };

    if (origin && typeof origin.x === "number" && typeof origin.y === "number") {
      payload.startX = Math.round(origin.x);
      payload.startY = Math.round(origin.y);
    }

    await rtdbSet(pingRef, payload);
    setTimeout(() => {
      rtdbRemove(pingRef).catch(() => {});
    }, PING_LIFETIME_MS + 300);
  };

  const addStroke = async ({
    layer = "tokens",
    color = "#ffcc00",
    width = 4,
    points = []
  }) => {
    if (!user || !campaignId || !sceneId || points.length === 0) return null;

    const finalLayer = isGM ? layer : "tokens";
    const strokeId = `drw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const strokeRef = ref(
      rtdb,
      `${drawingsPath(campaignId, sceneId)}/${strokeId}`
    );

    const cleanPoints = points.map((pt) => ({
      x: Math.round(pt.x),
      y: Math.round(pt.y)
    }));

    const newStroke = {
      id: strokeId,
      campaignId,
      sceneId,
      type: "stroke",
      layer: finalLayer,
      color,
      width: Number(width) || 4,
      points: cleanPoints,
      authorId: user.uid,
      authorName: getAuthorName(),
      createdBy: user.uid,
      createdAt: Date.now()
    };

    await rtdbSet(strokeRef, newStroke);
    return strokeId;
  };

  const addShape = async ({
    shapeType = "circle", // 'circle' | 'rect'
    layer = "tokens",
    strokeColor = "#ffcc00",
    strokeWidth = 4,
    hasFill = false,
    fillColor = "#ffcc00",
    x = 100,
    y = 100,
    w = 100,
    h = 100,
    rotation = 0
  }) => {
    if (!user || !campaignId || !sceneId) return null;

    const finalLayer = isGM ? layer : "tokens";
    const shapeId = `shp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const shapeRef = ref(
      rtdb,
      `${drawingsPath(campaignId, sceneId)}/${shapeId}`
    );

    const newShape = {
      id: shapeId,
      campaignId,
      sceneId,
      type: shapeType, // 'circle' ou 'rect'
      shapeType, // compatibilidade com verificações diretas
      layer: finalLayer,
      strokeColor,
      strokeWidth: Number(strokeWidth) || 4,
      hasFill: Boolean(hasFill),
      fillColor: fillColor || strokeColor,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.abs(w)),
      h: Math.round(Math.abs(h)),
      rotation: Math.round(rotation) || 0,
      authorId: user.uid,
      authorName: getAuthorName(),
      createdBy: user.uid,
      createdAt: Date.now()
    };

    await rtdbSet(shapeRef, newShape);
    return shapeId;
  };

  const addTextItem = async ({
    layer = "tokens",
    text = "",
    fontSize = 24,
    color = "#ffcc00",
    x = 100,
    y = 100,
    rotation = 0
  }) => {
    if (!user || !campaignId || !sceneId || !text.trim()) return null;

    const finalLayer = isGM ? layer : "tokens";
    const textId = `txt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const textRef = ref(
      rtdb,
      `${drawingsPath(campaignId, sceneId)}/${textId}`
    );

    const newTextItem = {
      id: textId,
      campaignId,
      sceneId,
      type: "text",
      layer: finalLayer,
      text: text.trim(),
      fontSize: Number(fontSize) || 24,
      fontFamily: "Comic Sans MS, Comic Sans, cursive, sans-serif",
      color,
      x: Math.round(x),
      y: Math.round(y),
      rotation: Math.round(rotation) || 0,
      authorId: user.uid,
      authorName: getAuthorName(),
      createdBy: user.uid,
      createdAt: Date.now()
    };

    await rtdbSet(textRef, newTextItem);
    return textId;
  };

  const updateTextItem = async (textId, updates = {}) => {
    if (!user || !campaignId || !sceneId || !textId) return;
    const existing = drawingsState.map?.[textId];
    if (!existing || !canEditDrawing(existing)) return;

    const sanitizedUpdates = { ...updates };
    if (!isGM) {
      delete sanitizedUpdates.id;
      delete sanitizedUpdates.campaignId;
      delete sanitizedUpdates.sceneId;
      delete sanitizedUpdates.layer;
      delete sanitizedUpdates.authorId;
      delete sanitizedUpdates.authorName;
      delete sanitizedUpdates.createdBy;
      delete sanitizedUpdates.createdAt;
    }

    const textRef = ref(
      rtdb,
      `${drawingsPath(campaignId, sceneId)}/${textId}`
    );
    await rtdbUpdate(textRef, {
      ...sanitizedUpdates,
      updatedBy: user.uid,
      updatedAt: Date.now()
    });
  };

  const deleteDrawingItems = async (itemIds = []) => {
    if (!user || !campaignId || !sceneId || itemIds.length === 0) return;
    const allowedIds = itemIds.filter((id) =>
      canEditDrawing(drawingsState.map?.[id])
    );
    if (allowedIds.length === 0) return;

    await Promise.all(
      allowedIds.map((id) =>
        rtdbRemove(
          ref(rtdb, `${drawingsPath(campaignId, sceneId)}/${id}`)
        )
      )
    );
  };

  // Move traços, formas e caixas de texto selecionados juntos (granular por $drawingId)
  const moveDrawingItems = async (itemIds = [], dx = 0, dy = 0) => {
    if (
      !user ||
      !campaignId ||
      !sceneId ||
      itemIds.length === 0 ||
      (dx === 0 && dy === 0)
    ) {
      return;
    }

    const perItemUpdates = [];
    const now = Date.now();

    itemIds.forEach((id) => {
      const existing = drawingsState.map?.[id];
      if (!existing || !canEditDrawing(existing)) return;

      if (
        existing.type === "text" ||
        typeof existing.text === "string" ||
        existing.type === "circle" ||
        existing.type === "rect" ||
        existing.shapeType === "circle" ||
        existing.shapeType === "rect"
      ) {
        perItemUpdates.push({
          id,
          data: {
            x: Math.round((existing.x || 0) + dx),
            y: Math.round((existing.y || 0) + dy),
            updatedBy: user.uid,
            updatedAt: now
          }
        });
      } else if (Array.isArray(existing.points)) {
        perItemUpdates.push({
          id,
          data: {
            points: existing.points.map((pt) => ({
              x: Math.round(pt.x + dx),
              y: Math.round(pt.y + dy)
            })),
            updatedBy: user.uid,
            updatedAt: now
          }
        });
      }
    });

    if (perItemUpdates.length > 0) {
      await Promise.all(
        perItemUpdates.map(({ id, data }) =>
          rtdbUpdate(
            ref(rtdb, `${drawingsPath(campaignId, sceneId)}/${id}`),
            data
          )
        )
      );
    }
  };

  // Rotaciona traços, formas e caixas de texto selecionados juntos ao redor do centro (cx, cy)
  const rotateDrawingItems = async (itemIds = [], cx, cy, deltaAngleRad) => {
    if (
      !user ||
      !campaignId ||
      !sceneId ||
      itemIds.length === 0 ||
      !deltaAngleRad
    ) {
      return;
    }

    const cos = Math.cos(deltaAngleRad);
    const sin = Math.sin(deltaAngleRad);
    const deltaDeg = Math.round(deltaAngleRad * (180 / Math.PI));
    const now = Date.now();

    const perItemUpdates = [];

    itemIds.forEach((id) => {
      const existing = drawingsState.map?.[id];
      if (!existing || !canEditDrawing(existing)) return;

      const isShape =
        existing.type === "circle" ||
        existing.type === "rect" ||
        existing.shapeType === "circle" ||
        existing.shapeType === "rect";

      if (
        existing.type === "text" ||
        typeof existing.text === "string" ||
        isShape
      ) {
        const itemCenterOffsetX = isShape ? (existing.w || 0) / 2 : 0;
        const itemCenterOffsetY = isShape ? (existing.h || 0) / 2 : 0;

        const originalCenterX = (existing.x || 0) + itemCenterOffsetX;
        const originalCenterY = (existing.y || 0) + itemCenterOffsetY;

        const ox = originalCenterX - cx;
        const oy = originalCenterY - cy;
        const rx = cx + ox * cos - oy * sin;
        const ry = cy + ox * sin + oy * cos;

        perItemUpdates.push({
          id,
          data: {
            x: Math.round(rx - itemCenterOffsetX),
            y: Math.round(ry - itemCenterOffsetY),
            rotation: Math.round(((existing.rotation || 0) + deltaDeg) % 360),
            updatedBy: user.uid,
            updatedAt: now
          }
        });
      } else if (Array.isArray(existing.points)) {
        perItemUpdates.push({
          id,
          data: {
            points: existing.points.map((pt) => {
              const ox = pt.x - cx;
              const oy = pt.y - cy;
              return {
                x: Math.round(cx + ox * cos - oy * sin),
                y: Math.round(cy + ox * sin + oy * cos)
              };
            }),
            updatedBy: user.uid,
            updatedAt: now
          }
        });
      }
    });

    if (perItemUpdates.length > 0) {
      await Promise.all(
        perItemUpdates.map(({ id, data }) =>
          rtdbUpdate(
            ref(rtdb, `${drawingsPath(campaignId, sceneId)}/${id}`),
            data
          )
        )
      );
    }
  };

  return {
    strokes,
    shapes,
    textItems,
    allItems: allDrawings,
    activePings,
    canEditDrawing,
    triggerPing,
    addStroke,
    addShape,
    addTextItem,
    updateTextItem,
    deleteDrawingItems,
    deleteStrokes: deleteDrawingItems,
    moveDrawingItems,
    moveStrokes: moveDrawingItems,
    rotateDrawingItems
  };
}
