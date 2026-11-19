import CPButton from "../../ui/CPButton.jsx";

export default function FlyoutButton({
  active = false,
  variant = undefined,
  style = undefined,
  onClick,
  children
}) {
  const resolvedVariant = variant ?? (active ? "gold" : "default");
  return (
    <CPButton
      variant={resolvedVariant}
      className={variant === "epf" && active ? "active" : ""}
      style={{
        width: "100%",
        justifyContent: "flex-start",
        padding: "6px 10px",
        fontSize: "12px",
        ...style
      }}
      onClick={onClick}
    >
      {children}
    </CPButton>
  );
}
