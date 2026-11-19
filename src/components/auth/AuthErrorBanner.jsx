export default function AuthErrorBanner({ message, style }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        background: "#ffebee",
        border: "2px solid #c62828",
        color: "#b71c1c",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px",
        fontWeight: 700,
        textAlign: "center",
        ...style
      }}
    >
      {message}
    </div>
  );
}
