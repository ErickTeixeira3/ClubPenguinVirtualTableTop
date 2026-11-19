import CPButton from "../ui/CPButton.jsx";
import { BOARD_Z_LAYERS, DRAW_COLORS } from "./boardConstants.js";
import ColorSwatchGrid from "./ColorSwatchGrid.jsx";

/**
 * FUN-01: editor inline de texto preserva e edita exclusivamente `editor.fontSize`
 * e `editor.color` da instância em edição, sem sobrescrever com o estado global da toolbar.
 */
export default function BoardTextEditor({
  editor,
  onChange,
  onSave,
  onCancel
}) {
  if (!editor) return null;

  const fontSize = editor.fontSize || 24;
  const color = editor.color || "#ffcc00";

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: `${editor.x}px`,
        top: `${editor.y}px`,
        zIndex: BOARD_Z_LAYERS.inlineTextEditor,
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          background: "rgba(1, 27, 58, 0.95)",
          border: "2px solid #ffcc00",
          borderRadius: "999px",
          padding: "3px 8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
        }}
      >
        <CPButton
          style={{ padding: "2px 7px", fontSize: "11px" }}
          onClick={() =>
            onChange({
              ...editor,
              fontSize: Math.max(12, fontSize - 4)
            })
          }
        >
          -
        </CPButton>
        <span
          style={{
            fontFamily: '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700
          }}
        >
          {fontSize}px
        </span>
        <CPButton
          style={{ padding: "2px 7px", fontSize: "11px" }}
          onClick={() =>
            onChange({
              ...editor,
              fontSize: Math.min(72, fontSize + 4)
            })
          }
        >
          +
        </CPButton>
        <CPButton
          variant="green"
          style={{ padding: "2px 9px", fontSize: "11px" }}
          onClick={onSave}
        >
          Salvar
        </CPButton>
        <CPButton
          variant="orange"
          style={{ padding: "2px 8px", fontSize: "11px" }}
          onClick={onCancel}
        >
          ✕
        </CPButton>
      </div>

      <div
        style={{
          background: "rgba(1, 27, 58, 0.92)",
          border: "1.5px solid rgba(255, 204, 0, 0.65)",
          borderRadius: "10px",
          padding: "4px 6px"
        }}
      >
        <ColorSwatchGrid
          colors={DRAW_COLORS}
          selectedColor={color}
          onSelect={(nextColor) => onChange({ ...editor, color: nextColor })}
          shape="circle"
          size={18}
          keyPrefix="inline-text-color"
          ariaLabelPrefix="Cor do texto"
        />
      </div>

      <textarea
        autoFocus
        value={editor.text}
        onChange={(e) => onChange({ ...editor, text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSave();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
        placeholder="Digite seu texto..."
        style={{
          fontFamily:
            editor.fontFamily || '"Comic Sans MS", "Comic Sans", cursive, sans-serif',
          fontSize: `${fontSize}px`,
          color,
          background: "rgba(1, 27, 58, 0.85)",
          border: "2px dashed #ffcc00",
          borderRadius: "8px",
          padding: "8px",
          minWidth: "190px",
          minHeight: "52px",
          outline: "none",
          textShadow:
            "0 2px 4px rgba(0,0,0,0.85), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
          resize: "both"
        }}
      />
    </div>
  );
}
