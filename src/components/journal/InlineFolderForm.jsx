export default function InlineFolderForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "Nome da pasta...",
  paddingLeft = "18px"
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "flex",
        gap: "4px",
        padding: `4px 8px 4px ${paddingLeft}`
      }}
    >
      <input
        type="text"
        className="cp-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
        autoFocus
        style={{
          flex: 1,
          padding: "2px 6px",
          fontSize: "11px",
          height: "24px",
          minWidth: 0
        }}
      />
      <button
        type="submit"
        className="cp-btn cp-btn-green"
        style={{
          padding: "2px 6px",
          fontSize: "10px",
          height: "24px"
        }}
      >
        OK
      </button>
      <button
        type="button"
        className="cp-btn cp-btn-orange"
        onClick={onCancel}
        style={{
          padding: "2px 6px",
          fontSize: "10px",
          height: "24px"
        }}
      >
        ✕
      </button>
    </form>
  );
}
