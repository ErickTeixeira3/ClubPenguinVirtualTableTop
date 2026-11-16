/**
 * Botão base Club Penguin / EPF.
 * Variantes mapeadas 1:1 para as classes globais existentes em src/index.css:
 * - "default" | "primary" -> .cp-btn
 * - "gold" | "green" | "orange" | "epf" -> .cp-btn .cp-btn-{variant}
 * Estilos inline passados por `style` continuam prevalecendo (fonte da verdade visual).
 */
const VARIANT_CLASS = {
  default: "",
  primary: "",
  gold: "cp-btn-gold",
  green: "cp-btn-green",
  orange: "cp-btn-orange",
  epf: "cp-btn-epf",
};

export default function CPButton({
  variant = "default",
  className = "",
  type = "button",
  children,
  ...rest
}) {
  const classes = ["cp-btn", VARIANT_CLASS[variant] ?? "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
