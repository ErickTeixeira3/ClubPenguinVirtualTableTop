import CPButton from "../../ui/CPButton.jsx";

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onResetCamera }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        paddingTop: "6px",
        borderTop: "2px solid rgba(255,255,255,0.2)"
      }}
    >
      <CPButton
        style={{ width: "38px", padding: "3px 0", fontSize: "13px" }}
        onClick={onZoomIn}
      >
        +
      </CPButton>
      <CPButton
        variant="epf"
        style={{ width: "42px", padding: "3px 0", fontSize: "10px" }}
        onClick={onResetCamera}
      >
        {Math.round(zoom * 100)}%
      </CPButton>
      <CPButton
        style={{ width: "38px", padding: "3px 0", fontSize: "13px" }}
        onClick={onZoomOut}
      >
        -
      </CPButton>
    </div>
  );
}
