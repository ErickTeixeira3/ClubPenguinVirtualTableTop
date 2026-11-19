import {
  EFFECT_TYPES,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../../engines/combatEngine";
import SavingThrowFields from "../../ui/SavingThrowFields";
import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";

/**
 * Formulário de criação/edição de habilidade na aba Skills.
 */
export default function AbilityForm({
  skillsState,
  dispatchSkills,
  onSubmit
}) {
  const {
    editingAbilityId,
    abName,
    abIcon,
    showAbIconPicker,
    abColor,
    abCostRes,
    abCostAmt,
    abHit,
    abEffect,
    abTrigger,
    abEffectType,
    abRangeType,
    abRangeDist,
    abAoeType,
    abAoeRadius,
    abAoeConeAngle,
    abSaveEnabled,
    abSaveDc,
    abSaveAttr,
    abSaveDesc,
    abDesc,
    formError
  } = skillsState;

  const setField = (field, value) =>
    dispatchSkills({ type: "SET_FIELD", field, value });

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: "#ffffff",
        border: "2px solid #008be3",
        borderRadius: "10px",
        padding: "8px",
        marginBottom: "8px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px"
      }}
    >
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setField("showAbIconPicker", !showAbIconPicker)}
          title="Escolher Ícone"
          style={{
            width: "32px",
            height: "28px",
            background: "#f8fafc",
            border: "1.5px solid #7a8c9e",
            borderRadius: "7px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            flexShrink: 0
          }}
        >
          {renderCpFlashIcon(abIcon, 22)}
        </button>
        <input
          type="text"
          className="cp-input"
          placeholder="Nome da Habilidade/Magia"
          value={abName}
          onChange={(e) => setField("abName", e.target.value)}
          required
          style={{ fontSize: "11px", padding: "3px 6px", flex: 1 }}
        />
      </div>

      <div style={{ display: "flex", gap: "4px" }}>
        <input
          type="color"
          className="cp-input"
          style={{ width: "38px", padding: "1px", height: "24px" }}
          value={abColor}
          onChange={(e) => setField("abColor", e.target.value)}
        />
        <select
          className="cp-input"
          style={{ fontSize: "11px", padding: "2px" }}
          value={abCostRes}
          onChange={(e) => setField("abCostRes", e.target.value)}
        >
          <option value="mp">MP</option>
          <option value="hp">HP</option>
        </select>
        <input
          type="number"
          className="cp-input"
          placeholder="Custo"
          style={{ fontSize: "11px", padding: "2px 4px", width: "50px" }}
          value={abCostAmt}
          onChange={(e) => setField("abCostAmt", e.target.value)}
        />
      </div>

      {showAbIconPicker && (
        <div style={{ gridColumn: "1 / -1" }}>
          <CpIconPicker
            selectedIconId={abIcon}
            onSelectIcon={(ic) => {
              setField("abIcon", ic);
              setField("showAbIconPicker", false);
            }}
            onClose={() => setField("showAbIconPicker", false)}
          />
        </div>
      )}

      <input
        type="text"
        className="cp-input"
        placeholder="Acerto (ex: 1d20 + @forca)"
        value={abHit}
        onChange={(e) => setField("abHit", e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      />
      <input
        type="text"
        className="cp-input"
        placeholder="Efeito (ex: 2d6 + @forca)"
        value={abEffect}
        onChange={(e) => setField("abEffect", e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      />
      <select
        className="cp-input"
        value={abTrigger}
        onChange={(e) => setField("abTrigger", e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      >
        {TRIGGER_TYPES.map((tr) => (
          <option key={tr.id} value={tr.id}>
            {tr.label}
          </option>
        ))}
      </select>
      <select
        className="cp-input"
        value={abEffectType}
        onChange={(e) => setField("abEffectType", e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      >
        {EFFECT_TYPES.map((et) => (
          <option key={et.id} value={et.id}>
            {et.label}
          </option>
        ))}
      </select>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          background: "#f8fafc",
          padding: "4px 6px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1"
        }}
      >
        <SavingThrowFields
          enabled={abSaveEnabled}
          onEnabledChange={(val) => setField("abSaveEnabled", val)}
          dcFormula={abSaveDc}
          onDcFormulaChange={(val) => setField("abSaveDc", val)}
          attributeKey={abSaveAttr}
          onAttributeKeyChange={(val) => setField("abSaveAttr", val)}
          effectDescription={abSaveDesc}
          onEffectDescriptionChange={(val) => setField("abSaveDesc", val)}
          toggleLabel="Resistência (CD)"
          dcPlaceholder="CD (ex: 14 ou 10+@forca)"
          effectPlaceholder="Efeito na falha (ex: Derrubado)"
          dcWidth="110px"
          effectMinWidth="120px"
        />
      </div>

      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
          background: "#f0fdf4",
          padding: "4px 6px",
          borderRadius: "8px",
          border: "1px solid #bbf7d0"
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534" }}>
          🎯 Alcance:
        </span>
        <select
          className="cp-input"
          value={abRangeType}
          onChange={(e) => setField("abRangeType", e.target.value)}
          style={{ fontSize: "11px", padding: "2px 6px" }}
        >
          {SKILL_RANGE_TYPES.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.label}
            </option>
          ))}
        </select>
        {abRangeType === "ranged" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
            <input
              type="number"
              className="cp-input"
              style={{ width: "50px", fontSize: "11px", padding: "2px 4px" }}
              min={0}
              value={abRangeDist}
              onChange={(e) => setField("abRangeDist", e.target.value)}
            />
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>
              m
            </span>
          </div>
        )}

        <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534", marginLeft: "6px" }}>
          Área:
        </span>
        <select
          className="cp-input"
          value={abAoeType}
          onChange={(e) => setField("abAoeType", e.target.value)}
          style={{ fontSize: "11px", padding: "2px 6px" }}
        >
          {SKILL_AOE_TYPES.map((at) => (
            <option key={at.id} value={at.id}>
              {at.label}
            </option>
          ))}
        </select>

        {abAoeType === "circle" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>
              Raio:
            </span>
            <input
              type="number"
              className="cp-input"
              style={{ width: "50px", fontSize: "11px", padding: "2px 4px" }}
              min={1}
              value={abAoeRadius}
              onChange={(e) => setField("abAoeRadius", e.target.value)}
            />
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>
              m
            </span>
          </div>
        )}

        {abAoeType === "cone" && (
          <>
            <select
              className="cp-input"
              value={abAoeConeAngle}
              onChange={(e) =>
                setField("abAoeConeAngle", Number(e.target.value))
              }
              style={{ fontSize: "11px", padding: "2px 4px" }}
            >
              <option value={45}>Cone 45°</option>
              <option value={60}>Cone 60°</option>
            </select>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>
                Tam:
              </span>
              <input
                type="number"
                className="cp-input"
                style={{ width: "50px", fontSize: "11px", padding: "2px 4px" }}
                min={1}
                value={abAoeRadius}
                onChange={(e) => setField("abAoeRadius", e.target.value)}
              />
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>
                m
              </span>
            </div>
          </>
        )}
      </div>

      <input
        type="text"
        className="cp-input"
        style={{ gridColumn: "1 / -1", fontSize: "11px", padding: "3px 6px" }}
        placeholder="Descrição..."
        value={abDesc}
        onChange={(e) => setField("abDesc", e.target.value)}
      />

      {formError && (
        <div role="alert" style={{ gridColumn: "1 / -1", fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
          {formError}
        </div>
      )}

      <div style={{ gridColumn: "1 / -1", display: "flex", gap: "6px" }}>
        {editingAbilityId && (
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "3px 10px", fontSize: "11px" }}
            onClick={() => dispatchSkills({ type: "RESET_ABILITY_FORM" })}
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="cp-btn cp-btn-green"
          style={{ flex: 1, padding: "3px", fontSize: "11px" }}
        >
          {editingAbilityId ? "Atualizar Habilidade" : "Salvar Habilidade"}
        </button>
      </div>
    </form>
  );
}
