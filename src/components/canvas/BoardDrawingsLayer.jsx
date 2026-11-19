import { DRAWING_TYPES } from "../../domain/constants.js";
import { pointsToSvgPath, rotatePoint } from "../../engines/geometry/index.js";

/**
 * Renderiza formas, traços livres e textos de uma camada específica (`map` | `objects` | `tokens`).
 * FUN-02: `editable` e `pointerEvents` exigem estritamente `layerKey === effectiveLayer`,
 * impedindo que desenhos de outras camadas capturem cliques ou bloqueiem a camada ativa.
 */
export default function BoardDrawingsLayer({
  layerKey,
  effectiveLayer,
  zIndex,
  widthPx,
  heightPx,
  drawings = [],
  toolMode = "move",
  isAimingMode = false,
  selectedDrawingIds = [],
  selectedBounds = null,
  draggingDelta = null,
  rotatingAngle = 0,
  draftShape = null,
  draftStrokePoints = [],
  drawColor = "#ffcc00",
  drawWidth = 4,
  shapeHasFill = false,
  shapeFillColor = "#00f0ff",
  canEditDrawing,
  onSelectDrawing,
  onEditText
}) {
  const isActiveLayer = layerKey === effectiveLayer;
  const isInteractiveMode =
    !isAimingMode && (toolMode === "move" || toolMode === "draw_select");
  const selectedSet = new Set(selectedDrawingIds);

  const cx = selectedBounds ? selectedBounds.x + selectedBounds.w / 2 : 0;
  const cy = selectedBounds ? selectedBounds.y + selectedBounds.h / 2 : 0;

  const shapes = drawings.filter(
    (d) => d.type === DRAWING_TYPES.RECT || d.type === DRAWING_TYPES.CIRCLE
  );
  const strokes = drawings.filter((d) => d.type === DRAWING_TYPES.STROKE);
  const texts = drawings.filter((d) => d.type === DRAWING_TYPES.TEXT);

  return (
    <>
      <svg
        width={widthPx}
        height={heightPx}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex
        }}
      >
        {shapes.map((s) => {
          const isSelected = isActiveLayer && selectedSet.has(s.id);
          const offsetX = isSelected && draggingDelta ? draggingDelta.dx : 0;
          const offsetY = isSelected && draggingDelta ? draggingDelta.dy : 0;
          const baseRot = Number(s.rotation) || 0;
          const w = Number(s.w) || 20;
          const h = Number(s.h) || 20;

          let shapeCenterX = (Number(s.x) || 0) + w / 2 + offsetX;
          let shapeCenterY = (Number(s.y) || 0) + h / 2 + offsetY;
          let totalRotDeg = baseRot;

          if (isSelected && rotatingAngle && selectedBounds) {
            const rp = rotatePoint(shapeCenterX, shapeCenterY, cx, cy, rotatingAngle);
            shapeCenterX = rp.x;
            shapeCenterY = rp.y;
            totalRotDeg += (rotatingAngle * 180) / Math.PI;
          }

          const drawX = shapeCenterX - w / 2;
          const drawY = shapeCenterY - h / 2;
          const strokeCol = s.strokeColor || "#ffcc00";
          const strokeW = Number(s.strokeWidth) || 4;
          const fillCol = s.hasFill ? s.fillColor || "#00f0ff" : "none";
          const transform = totalRotDeg
            ? `rotate(${totalRotDeg} ${shapeCenterX} ${shapeCenterY})`
            : undefined;
          const isCircle = s.type === DRAWING_TYPES.CIRCLE;
          const editable = isActiveLayer && isInteractiveMode && canEditDrawing(s);

          return (
            <g
              key={s.id}
              data-drawing-id={s.id}
              data-drawing-layer={layerKey}
              transform={transform}
              style={{ cursor: editable ? "pointer" : "default" }}
              onMouseDown={(e) => {
                if (editable && e.button === 0) {
                  e.stopPropagation();
                  onSelectDrawing?.(e, s.id);
                }
              }}
            >
              {isCircle ? (
                <ellipse
                  cx={shapeCenterX}
                  cy={shapeCenterY}
                  rx={w / 2}
                  ry={h / 2}
                  fill="rgba(0,0,0,0.001)"
                  stroke="transparent"
                  strokeWidth={strokeW + 14}
                  style={{ pointerEvents: editable ? "all" : "none" }}
                />
              ) : (
                <rect
                  x={drawX}
                  y={drawY}
                  width={w}
                  height={h}
                  fill="rgba(0,0,0,0.001)"
                  stroke="transparent"
                  strokeWidth={strokeW + 14}
                  style={{ pointerEvents: editable ? "all" : "none" }}
                />
              )}

              {isSelected &&
                (isCircle ? (
                  <ellipse
                    cx={shapeCenterX}
                    cy={shapeCenterY}
                    rx={w / 2}
                    ry={h / 2}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth={strokeW + 6}
                    strokeOpacity={0.55}
                    style={{ pointerEvents: "none" }}
                  />
                ) : (
                  <rect
                    x={drawX}
                    y={drawY}
                    width={w}
                    height={h}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth={strokeW + 6}
                    strokeOpacity={0.55}
                    style={{ pointerEvents: "none" }}
                  />
                ))}

              {isCircle ? (
                <ellipse
                  cx={shapeCenterX}
                  cy={shapeCenterY}
                  rx={w / 2}
                  ry={h / 2}
                  fill={fillCol}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                  style={{ pointerEvents: editable ? "all" : "none" }}
                />
              ) : (
                <rect
                  x={drawX}
                  y={drawY}
                  width={w}
                  height={h}
                  fill={fillCol}
                  stroke={strokeCol}
                  strokeWidth={strokeW}
                  style={{ pointerEvents: editable ? "all" : "none" }}
                />
              )}
            </g>
          );
        })}

        {isActiveLayer &&
          draftShape &&
          (draftShape.type === DRAWING_TYPES.CIRCLE ? (
            <ellipse
              cx={draftShape.x + draftShape.w / 2}
              cy={draftShape.y + draftShape.h / 2}
              rx={draftShape.w / 2}
              ry={draftShape.h / 2}
              fill={shapeHasFill ? shapeFillColor : "none"}
              stroke={drawColor}
              strokeWidth={drawWidth}
            />
          ) : (
            <rect
              x={draftShape.x}
              y={draftShape.y}
              width={draftShape.w}
              height={draftShape.h}
              fill={shapeHasFill ? shapeFillColor : "none"}
              stroke={drawColor}
              strokeWidth={drawWidth}
            />
          ))}

        {strokes.map((s) => {
          const isSelected = isActiveLayer && selectedSet.has(s.id);
          const offsetX = isSelected && draggingDelta ? draggingDelta.dx : 0;
          const offsetY = isSelected && draggingDelta ? draggingDelta.dy : 0;
          const rotAngle = isSelected ? rotatingAngle : 0;
          const editable = isActiveLayer && isInteractiveMode && canEditDrawing(s);
          const pathD = pointsToSvgPath(s.points, offsetX, offsetY, cx, cy, rotAngle);

          return (
            <g
              key={s.id}
              data-drawing-id={s.id}
              data-drawing-layer={layerKey}
              style={{ cursor: editable ? "pointer" : "default" }}
              onMouseDown={(e) => {
                if (editable && e.button === 0) {
                  e.stopPropagation();
                  onSelectDrawing?.(e, s.id);
                }
              }}
            >
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, (Number(s.width) || 4) + 14)}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: editable ? "stroke" : "none" }}
              />
              {isSelected && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth={(Number(s.width) || 4) + 6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.55}
                  style={{ pointerEvents: "none" }}
                />
              )}
              <path
                d={pathD}
                fill="none"
                stroke={s.color || "#ffcc00"}
                strokeWidth={Number(s.width) || 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: editable ? "stroke" : "none" }}
              />
            </g>
          );
        })}

        {isActiveLayer && draftStrokePoints.length > 0 && (
          <path
            d={pointsToSvgPath(draftStrokePoints)}
            fill="none"
            stroke={drawColor}
            strokeWidth={drawWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex
        }}
      >
        {texts.map((item) => {
          const isSelected = isActiveLayer && selectedSet.has(item.id);
          const offsetX = isSelected && draggingDelta ? draggingDelta.dx : 0;
          const offsetY = isSelected && draggingDelta ? draggingDelta.dy : 0;

          let posX = (Number(item.x) || 0) + offsetX;
          let posY = (Number(item.y) || 0) + offsetY;
          let rotDeg = Number(item.rotation) || 0;

          if (isSelected && rotatingAngle && selectedBounds) {
            const rp = rotatePoint(posX, posY, cx, cy, rotatingAngle);
            posX = rp.x;
            posY = rp.y;
            rotDeg += (rotatingAngle * 180) / Math.PI;
          }

          const canEditItem = isActiveLayer && !isAimingMode && canEditDrawing(item);
          const editablePointer =
            canEditItem && (isInteractiveMode || toolMode === "draw_text");

          return (
            <div
              key={item.id}
              data-drawing-id={item.id}
              data-drawing-layer={layerKey}
              onMouseDown={(e) => {
                if (isInteractiveMode && canEditItem && e.button === 0) {
                  e.stopPropagation();
                  onSelectDrawing?.(e, item.id);
                }
              }}
              onDoubleClick={(e) => {
                if (!canEditItem) return;
                e.stopPropagation();
                onEditText?.(item);
              }}
              style={{
                position: "absolute",
                left: `${posX}px`,
                top: `${posY}px`,
                fontFamily:
                  item.fontFamily || '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
                fontSize: `${item.fontSize || 24}px`,
                fontWeight: 700,
                color: item.color || "#ffcc00",
                textShadow:
                  "0 2px 4px rgba(0,0,0,0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                transform: `rotate(${rotDeg}deg)`,
                transformOrigin: "left top",
                whiteSpace: "pre-wrap",
                pointerEvents: editablePointer ? "auto" : "none",
                cursor: isInteractiveMode && canEditItem ? "pointer" : "default",
                outline: isSelected ? "2px dashed #00f0ff" : "none",
                outlineOffset: "4px",
                padding: "2px",
                userSelect: "none"
              }}
            >
              {item.text}
            </div>
          );
        })}
      </div>
    </>
  );
}
