import { useCallback, useEffect, useState } from "react";
import { canEditDrawing as canEditDrawingRule } from "../domain/permissions.js";
import {
  addShape as addShapeService,
  addStroke as addStrokeService,
  addTextItem as addTextItemService,
  clearAllSceneDrawings as clearAllSceneDrawingsService,
  deleteDrawings as deleteDrawingsService,
  moveDrawings as moveDrawingsService,
  rotateDrawings as rotateDrawingsService,
  subscribeDrawings,
  updateTextItem as updateTextItemService
} from "../services/drawingService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

const EMPTY_DRAWINGS = Object.freeze([]);

export function useDrawings(sceneId) {
  const { user } = useAuth();
  const { campaignId, campaign, isGM } = useCampaign();
  const [drawings, setDrawings] = useState(EMPTY_DRAWINGS);

  const active = Boolean(user?.uid && campaignId && sceneId && campaign);

  useEffect(() => {
    if (!active) return undefined;
    return subscribeDrawings({
      campaignId,
      sceneId,
      onData: setDrawings,
      onError: notifyError
    });
  }, [active, campaignId, sceneId]);

  const canEditDrawing = useCallback(
    (drawing) => canEditDrawingRule(drawing, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const addStroke = useCallback(
    async (points, color, width, layer) => {
      try {
        return await addStrokeService({
          campaignId,
          sceneId,
          points,
          color,
          width,
          layer,
          user,
          isGM
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, user, isGM]
  );

  const addShape = useCallback(
    async (shapeType, x, y, w, h, strokeColor, strokeWidth, hasFill, fillColor, layer) => {
      try {
        return await addShapeService({
          campaignId,
          sceneId,
          shapeType,
          x,
          y,
          w,
          h,
          strokeColor,
          strokeWidth,
          hasFill,
          fillColor,
          layer,
          user,
          isGM
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, user, isGM]
  );

  const addTextItem = useCallback(
    async (text, x, y, fontSize, color, layer, fontFamily = undefined) => {
      try {
        return await addTextItemService({
          campaignId,
          sceneId,
          text,
          x,
          y,
          fontSize,
          fontFamily,
          color,
          layer,
          user,
          isGM
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, user, isGM]
  );

  const updateTextItem = useCallback(
    async (drawingId, updates) => {
      try {
        return await updateTextItemService({
          campaignId,
          sceneId,
          drawingId,
          updates,
          user
        });
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [campaignId, sceneId, user]
  );

  const deleteDrawings = useCallback(
    async (drawingIds) => {
      try {
        const drawingsById = new Map(drawings.map((d) => [d.id, d]));
        const allowedIds = (Array.isArray(drawingIds) ? drawingIds : []).filter(
          (id) => {
            const target = drawingsById.get(id);
            return target ? canEditDrawing(target) : false;
          }
        );
        if (allowedIds.length === 0) return 0;
        return await deleteDrawingsService({
          campaignId,
          sceneId,
          drawingIds: allowedIds
        });
      } catch (err) {
        notifyError(err);
        return 0;
      }
    },
    [campaignId, sceneId, drawings, canEditDrawing]
  );

  const clearAllDrawings = useCallback(async () => {
    try {
      await clearAllSceneDrawingsService({
        campaignId,
        sceneId,
        isGM
      });
    } catch (err) {
      notifyError(err);
    }
  }, [campaignId, sceneId, isGM]);

  const moveDrawings = useCallback(
    async (items, dx, dy) => {
      try {
        const allowed = (Array.isArray(items) ? items : []).filter((item) =>
          canEditDrawing(item)
        );
        if (allowed.length === 0) return 0;
        return await moveDrawingsService({
          campaignId,
          sceneId,
          drawings: allowed,
          dx,
          dy,
          user
        });
      } catch (err) {
        notifyError(err);
        return 0;
      }
    },
    [campaignId, sceneId, user, canEditDrawing]
  );

  const rotateDrawings = useCallback(
    async (items, deltaAngleDeg, pivot) => {
      try {
        const allowed = (Array.isArray(items) ? items : []).filter((item) =>
          canEditDrawing(item)
        );
        if (allowed.length === 0) return 0;
        return await rotateDrawingsService({
          campaignId,
          sceneId,
          drawings: allowed,
          deltaAngleDeg,
          pivot,
          user
        });
      } catch (err) {
        notifyError(err);
        return 0;
      }
    },
    [campaignId, sceneId, user, canEditDrawing]
  );

  return {
    drawings: active ? drawings : EMPTY_DRAWINGS,
    canEditDrawing,
    addStroke,
    addShape,
    addTextItem,
    updateTextItem,
    deleteDrawings,
    clearAllDrawings,
    moveDrawings,
    rotateDrawings
  };
}
