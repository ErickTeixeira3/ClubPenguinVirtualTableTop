import CPButton from "../../ui/CPButton.jsx";
import { useBoardToolsContext } from "../BoardToolsContext.js";
import FlyoutButton from "./FlyoutButton.jsx";

export default function MeasureFlyout() {
  const { measureShape, coneAngle, setMeasureShape, setConeAngle } =
    useBoardToolsContext();

  return (
    <div
      className="vtt-tool-flyout"
      style={{ minWidth: "185px" }}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <FlyoutButton
        active={measureShape === "line"}
        onClick={() =>
          setMeasureShape("line", { activateMeasure: true, closeFlyout: true })
        }
      >
        📏 Linha Reta
      </FlyoutButton>

      <FlyoutButton
        active={measureShape === "cone"}
        onClick={() => setMeasureShape("cone", { activateMeasure: true })}
      >
        📐 Cone ({coneAngle}°)
      </FlyoutButton>

      {measureShape === "cone" && (
        <div style={{ display: "flex", gap: "4px", padding: "2px 4px" }}>
          {[45, 60].map((angle) => (
            <CPButton
              key={angle}
              variant={coneAngle === angle ? "gold" : "default"}
              style={{ flex: 1, padding: "4px 8px", fontSize: "11px" }}
              onClick={() => setConeAngle(angle)}
            >
              {angle}°
            </CPButton>
          ))}
        </div>
      )}

      <FlyoutButton
        active={measureShape === "circle"}
        onClick={() =>
          setMeasureShape("circle", { activateMeasure: true, closeFlyout: true })
        }
      >
        ⭕ Círculo (Raio)
      </FlyoutButton>
    </div>
  );
}
