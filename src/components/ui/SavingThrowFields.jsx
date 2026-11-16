import { SAVE_ATTRIBUTES } from "../../engines/combatEngine";

/**
 * Campos de configuração de Teste de Resistência (habilita + CD + Atributo + Efeito na falha).
 * Extraído das cópias inline da Ficha (Novo Item, Nova/Editar Habilidade) e do Compêndio.
 *
 * Layouts (markup e estilos idênticos aos originais):
 * - "inline": rótulo inline-flex e campos lado a lado (a linha/contêiner flex fica com quem usa).
 * - "grid": rótulo em bloco e campos numa grade 2 colunas com fundo cinza (Compêndio).
 */
const INLINE_LABEL_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "11px",
  fontWeight: 800,
  color: "#003264",
  cursor: "pointer",
};

const GRID_LABEL_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const GRID_BOX_STYLE = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "6px",
  background: "#f8fafc",
  padding: "6px",
  borderRadius: "8px",
  border: "1.5px solid #cbd5e1",
};

function AttributeOptions() {
  return SAVE_ATTRIBUTES.map((sa) => (
    <option key={sa.id} value={sa.id}>
      {sa.label}
    </option>
  ));
}

export default function SavingThrowFields({
  layout = "inline",
  enabled,
  onEnabledChange,
  dcFormula,
  onDcFormulaChange,
  attribute,
  onAttributeChange,
  effectDescription,
  onEffectDescriptionChange,
  toggleLabel = "Exige Resistência",
  dcPlaceholder = "CD (ex: 12)",
  effectPlaceholder = "Efeito na falha...",
  dcWidth = "80px",
  effectMinWidth = "110px",
}) {
  const toggle = (
    <label style={layout === "grid" ? GRID_LABEL_STYLE : INLINE_LABEL_STYLE}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onEnabledChange(e.target.checked)}
      />
      {toggleLabel}
    </label>
  );

  if (layout === "grid") {
    return (
      <>
        {toggle}
        {enabled && (
          <div style={GRID_BOX_STYLE}>
            <input
              type="text"
              className="cp-input"
              placeholder={dcPlaceholder}
              value={dcFormula}
              onChange={(e) => onDcFormulaChange(e.target.value)}
              style={{ fontSize: "11px" }}
            />
            <select
              className="cp-input"
              value={attribute}
              onChange={(e) => onAttributeChange(e.target.value)}
              style={{ fontSize: "11px" }}
            >
              <AttributeOptions />
            </select>
            <input
              type="text"
              className="cp-input"
              placeholder={effectPlaceholder}
              value={effectDescription}
              onChange={(e) => onEffectDescriptionChange(e.target.value)}
              style={{ gridColumn: "1 / -1", fontSize: "11px" }}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {toggle}
      {enabled && (
        <>
          <input
            type="text"
            className="cp-input"
            placeholder={dcPlaceholder}
            value={dcFormula}
            onChange={(e) => onDcFormulaChange(e.target.value)}
            style={{ width: dcWidth, fontSize: "11px", padding: "2px 6px" }}
          />
          <select
            className="cp-input"
            value={attribute}
            onChange={(e) => onAttributeChange(e.target.value)}
            style={{ fontSize: "11px", padding: "2px 6px" }}
          >
            <AttributeOptions />
          </select>
          <input
            type="text"
            className="cp-input"
            placeholder={effectPlaceholder}
            value={effectDescription}
            onChange={(e) => onEffectDescriptionChange(e.target.value)}
            style={{ flex: 1, minWidth: effectMinWidth, fontSize: "11px", padding: "2px 6px" }}
          />
        </>
      )}
    </>
  );
}
