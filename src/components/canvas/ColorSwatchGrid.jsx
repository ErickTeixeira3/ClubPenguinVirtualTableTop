/**
 * Grade reutilizável de amostras de cor compartilhada entre `DrawFlyout` e `TokenModal`.
 */
export default function ColorSwatchGrid({
  colors = [],
  selectedColor,
  onSelect,
  shape = "circle",
  size = 26,
  columns = null,
  keyPrefix = "swatch",
  ariaLabelPrefix = "Cor"
}) {
  const isCircle = shape === "circle";
  const containerStyle = columns
    ? {
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "5px"
      }
    : {
        display: "flex",
        gap: "6px",
        flexWrap: "wrap"
      };

  return (
    <div style={containerStyle}>
      {colors.map((color) => {
        const active = selectedColor === color;
        return (
          <button
            key={`${keyPrefix}-${color}`}
            type="button"
            aria-label={`${ariaLabelPrefix} ${color}`}
            aria-pressed={active}
            onClick={() => onSelect?.(color)}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: isCircle ? "50%" : "4px",
              background: color,
              border: active ? "3px solid #ffffff" : "2px solid #001b3a",
              boxShadow: active && !columns ? "0 0 0 2px #001b3a" : "none",
              cursor: "pointer"
            }}
          />
        );
      })}
    </div>
  );
}
