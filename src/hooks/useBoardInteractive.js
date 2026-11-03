import { useEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  onValue,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import { rtdb } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const PING_LIFETIME_MS = 2200;

export function sliceStrokeByEraser(stroke, px, py, eraserRadius) {
  const points = stroke.points || [];
  if (points.length === 0) return [];
  const threshold = eraserRadius + (Number(stroke.width) || 4) / 2;

  // 1. Densifica os pontos do traço se a distância for maior que 4px para um corte limpo
  const densified = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    if (i === 0) {
      densified.push(cur);
    } else {
      const prev = densified[densified.length - 1];
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (dist > 4) {
        const steps = Math.ceil(dist / 4);
        for (let s = 1; s <= steps; s++) {
          densified.push({
            x: Math.round(prev.x + (cur.x - prev.x) * (s / steps)),
            y: Math.round(prev.y + (cur.y - prev.y) * (s / steps))
          });
        }
      } else {
        densified.push(cur);
      }
    }
  }

  // 2. Separa os trechos contíguos que NÃO foram atingidos pela borracha
  const runs = [];
  let currentRun = [];
  for (const pt of densified) {
    const inRange = Math.hypot(pt.x - px, pt.y - py) <= threshold;
    if (!inRange) {
      currentRun.push(pt);
    } else {
      if (currentRun.length > 0) {
        runs.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    runs.push(currentRun);
  }

  // 3. Suaviza/filtra pontos colineares para não inchar o traço
  const cleanRuns = runs
    .map((run) => {
      if (run.length <= 2) return run;
      const simplified = [run[0]];
      for (let i = 1; i < run.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        if (Math.hypot(run[i].x - prev.x, run[i].y - prev.y) >= 3) {
          simplified.push(run[i]);
        }
      }
      simplified.push(run[run.length - 1]);
      return simplified;
    })
    .filter((run) => run.length >= 1);

  return cleanRuns;
}

export function useBoardInteractive(sceneId) {
  const { user } = useAuth();
  const { campaignId, isGM } = useCampaign();

  const [drawingsState, setDrawingsState] = useState({
    sceneKey: null,
    map: {}
  });
  const [pingsMap, setPingsMap] = useState({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Buffer de atualizações de borracha para sincronização fluida
  const pendingRtdbUpdatesRef = useRef({});
  const rtdbFlushTimerRef = useRef(null);

  // Subscreve aos desenhos e textos da cena ativa no RTDB
  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const currentSceneKey = `${campaignId}:${sceneId}`;
    const drawingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
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

  // Subscreve aos Pings em tempo real
  useEffect(() => {
    if (!user || !campaignId || !sceneId) return;

    const pingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/pings`
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

  const flushPendingUpdates = () => {
    if (!user || !campaignId || !sceneId) return;
    if (Object.keys(pendingRtdbUpdatesRef.current).length === 0) return;

    const payload = { ...pendingRtdbUpdatesRef.current };
    pendingRtdbUpdatesRef.current = {};

    const drawingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
    );
    rtdbUpdate(drawingsRef, payload).catch((err) => {
      console.error("Erro ao sincronizar borracha:", err);
    });
  };

  const scheduleFlushUpdates = () => {
    if (rtdbFlushTimerRef.current) return;
    rtdbFlushTimerRef.current = setTimeout(() => {
      rtdbFlushTimerRef.current = null;
      flushPendingUpdates();
    }, 70);
  };

  const triggerPing = async (x, y, color = "#00f0ff") => {
    if (!user || !campaignId || !sceneId) return;
    const pingId = `ping_${user.uid}_${Date.now()}`;
    const pingRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/pings/${pingId}`
    );

    const payload = {
      id: pingId,
      x: Math.round(x),
      y: Math.round(y),
      color,
      senderId: user.uid,
      senderName:
        user.displayName || user.email?.split("@")[0] || "Pinguim",
      timestamp: Date.now()
    };

    await rtdbSet(pingRef, payload);
    setTimeout(() => {
      rtdbUpdate(
        ref(rtdb, `vtt_realtime/${campaignId}/fog/${sceneId}/pings`),
        { [pingId]: null }
      ).catch(() => {});
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
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings/${strokeId}`
    );

    const cleanPoints = points.map((pt) => ({
      x: Math.round(pt.x),
      y: Math.round(pt.y)
    }));

    const newStroke = {
      id: strokeId,
      type: "stroke",
      layer: finalLayer,
      color,
      width: Number(width) || 4,
      points: cleanPoints,
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
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings/${shapeId}`
    );

    const newShape = {
      id: shapeId,
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
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings/${textId}`
    );

    const newTextItem = {
      id: textId,
      type: "text",
      layer: finalLayer,
      text: text.trim(),
      fontSize: Number(fontSize) || 24,
      fontFamily: "Comic Sans MS, Comic Sans, cursive, sans-serif",
      color,
      x: Math.round(x),
      y: Math.round(y),
      rotation: Math.round(rotation) || 0,
      createdBy: user.uid,
      createdAt: Date.now()
    };

    await rtdbSet(textRef, newTextItem);
    return textId;
  };

  const updateTextItem = async (textId, updates = {}) => {
    if (!user || !campaignId || !sceneId || !textId) return;
    const textRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings/${textId}`
    );
    await rtdbUpdate(textRef, {
      ...updates,
      updatedAt: Date.now()
    });
  };

  const deleteDrawingItems = async (itemIds = []) => {
    if (!user || !campaignId || !sceneId || itemIds.length === 0) return;
    const updates = {};
    itemIds.forEach((id) => {
      updates[id] = null;
    });
    const drawingsRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
    );
    await rtdbUpdate(drawingsRef, updates);
  };

  // Apaga parcialmente os traços atingidos pelo mouse (ou deleta caixas de texto atingidas)
  const erasePortionAt = (px, py, radius = 18, layer = "tokens") => {
    if (!user || !campaignId || !sceneId) return;

    const localUpdates = {};
    let hasChanges = false;

    // 1. Processa traços da camada ativa
    strokes
      .filter((s) => (s.layer || "tokens") === layer)
      .forEach((s) => {
        const threshold = radius + (Number(s.width) || 4) / 2;
        const pts = s.points || [];
        const isNear = pts.some(
          (p) => Math.hypot(p.x - px, p.y - py) <= threshold + 10
        );
        if (!isNear) return;

        const cleanRuns = sliceStrokeByEraser(s, px, py, radius);
        if (cleanRuns.length === 0) {
          // Traço completamente apagado
          localUpdates[s.id] = null;
          pendingRtdbUpdatesRef.current[s.id] = null;
          hasChanges = true;
        } else if (cleanRuns.length === 1) {
          // Traço modificado (encurtado ou furado na ponta)
          if (cleanRuns[0].length !== s.points.length) {
            const updatedStroke = { ...s, points: cleanRuns[0] };
            localUpdates[s.id] = updatedStroke;
            pendingRtdbUpdatesRef.current[`${s.id}/points`] = cleanRuns[0];
            hasChanges = true;
          }
        } else {
          // Traço dividido em múltiplos sub-traços
          const firstStroke = { ...s, points: cleanRuns[0] };
          localUpdates[s.id] = firstStroke;
          pendingRtdbUpdatesRef.current[`${s.id}/points`] = cleanRuns[0];

          for (let k = 1; k < cleanRuns.length; k++) {
            const subId = `drw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const subStroke = {
              ...s,
              id: subId,
              points: cleanRuns[k],
              createdAt: Date.now()
            };
            localUpdates[subId] = subStroke;
            pendingRtdbUpdatesRef.current[subId] = subStroke;
          }
          hasChanges = true;
        }
      });

    // 2. Apaga caixas de texto e formas atingidas diretamente pelo cursor da borracha
    allDrawings
      .filter(
        (t) =>
          (t.layer || "tokens") === layer &&
          (t.type === "text" ||
            t.type === "circle" ||
            t.type === "rect" ||
            t.shapeType === "circle" ||
            t.shapeType === "rect")
      )
      .forEach((t) => {
        const isShape =
          t.type === "circle" ||
          t.type === "rect" ||
          t.shapeType === "circle" ||
          t.shapeType === "rect";
        const cx = isShape ? t.x + (t.w || 0) / 2 : t.x;
        const cy = isShape ? t.y + (t.h || 0) / 2 : t.y;
        const sizeRadius = Math.max(16, Math.min(60, ((t.w || 40) + (t.h || 40)) / 4));
        const isTouch = Math.hypot(cx - px, cy - py) <= radius + sizeRadius;
        if (isTouch) {
          localUpdates[t.id] = null;
          pendingRtdbUpdatesRef.current[t.id] = null;
          hasChanges = true;
        }
      });

    if (hasChanges) {
      // Atualiza estado local imediatamente para fluidez visual a 60fps
      setDrawingsState((prev) => {
        const nextMap = { ...(prev.map || {}) };
        Object.entries(localUpdates).forEach(([id, val]) => {
          if (val === null) {
            delete nextMap[id];
          } else {
            nextMap[id] = val;
          }
        });
        return { ...prev, map: nextMap };
      });
      scheduleFlushUpdates();
    }
  };

  // Move traços e caixas de texto selecionados juntos
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

    const updates = {};
    itemIds.forEach((id) => {
      const existing = drawingsState.map?.[id];
      if (!existing) return;

      if (
        existing.type === "text" ||
        typeof existing.text === "string" ||
        existing.type === "circle" ||
        existing.type === "rect"
      ) {
        updates[`${id}/x`] = Math.round((existing.x || 0) + dx);
        updates[`${id}/y`] = Math.round((existing.y || 0) + dy);
      } else if (Array.isArray(existing.points)) {
        updates[`${id}/points`] = existing.points.map((pt) => ({
          x: Math.round(pt.x + dx),
          y: Math.round(pt.y + dy)
        }));
      }
    });

    if (Object.keys(updates).length > 0) {
      const drawingsRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
      );
      await rtdbUpdate(drawingsRef, updates);
    }
  };

  // Rotaciona traços e caixas de texto selecionados juntos ao redor do centro (cx, cy)
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

    const updates = {};
    itemIds.forEach((id) => {
      const existing = drawingsState.map?.[id];
      if (!existing) return;

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

        updates[`${id}/x`] = Math.round(rx - itemCenterOffsetX);
        updates[`${id}/y`] = Math.round(ry - itemCenterOffsetY);
        updates[`${id}/rotation`] = Math.round(
          ((existing.rotation || 0) + deltaDeg) % 360
        );
      } else if (Array.isArray(existing.points)) {
        updates[`${id}/points`] = existing.points.map((pt) => {
          const ox = pt.x - cx;
          const oy = pt.y - cy;
          return {
            x: Math.round(cx + ox * cos - oy * sin),
            y: Math.round(cy + ox * sin + oy * cos)
          };
        });
      }
    });

    if (Object.keys(updates).length > 0) {
      const drawingsRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/fog/${sceneId}/drawings`
      );
      await rtdbUpdate(drawingsRef, updates);
    }
  };

  return {
    strokes,
    shapes,
    textItems,
    allItems: allDrawings,
    activePings,
    triggerPing,
    addStroke,
    addShape,
    addTextItem,
    updateTextItem,
    deleteDrawingItems,
    deleteStrokes: deleteDrawingItems,
    erasePortionAt,
    flushPendingUpdates,
    moveDrawingItems,
    moveStrokes: moveDrawingItems,
    rotateDrawingItems
  };
}
