import { useState } from "react";
import { RESERVED_FORMULA_KEYS, ROLL_KINDS } from "../../../domain/constants.js";
import { normalizeSkillKey } from "../../../engines/compendium";
import { buildSkillFormula } from "../../../engines/rolls";

const RESERVED_FORMULA_KEY_SET = new Set(RESERVED_FORMULA_KEYS);

/**
 * Seção de Perícias na aba Skills.
 * FUN-09: o seletor de atributo vincula estritamente aos atributos existentes na ficha.
 */
export default function SkillList({
  skills,
  attributes,
  canEdit,
  skillsState,
  dispatchSkills,
  onPing,
  onTriggerRoll,
  onPinToRollGroup,
  onAddSkill
}) {
  const [skillError, setSkillError] = useState(null);

  const selectedAttrKey = attributes.some((a) => a.key === skillsState.newSkillAttr)
    ? skillsState.newSkillAttr
    : attributes[0]?.key || "";

  const handleSubmitSkill = async (e) => {
    e.preventDefault();
    setSkillError(null);
    const name = skillsState.newSkillName.trim();
    if (!canEdit || !name) return;

    if (!selectedAttrKey) {
      setSkillError("Crie ao menos um atributo antes de adicionar uma perícia.");
      return;
    }

    const candidateKey = normalizeSkillKey(name);
    if (!candidateKey) {
      setSkillError("Informe um nome válido para a perícia.");
      return;
    }
    if (RESERVED_FORMULA_KEY_SET.has(candidateKey)) {
      setSkillError(`A chave "@${candidateKey}" é reservada.`);
      return;
    }
    if (
      attributes.some((a) => a.key === candidateKey) ||
      skills.some((s) => (s.key || s.id) === candidateKey)
    ) {
      setSkillError(`A chave "@${candidateKey}" já está em uso na ficha.`);
      return;
    }

    try {
      await onAddSkill({
        key: candidateKey,
        name,
        attributeKey: selectedAttrKey,
        bonus: Number(skillsState.newSkillBonus) || 0
      });
      dispatchSkills({ type: "SET_FIELD", field: "newSkillName", value: "" });
    } catch (err) {
      setSkillError(err?.message || "Erro ao adicionar perícia.");
    }
  };

  return (
    <div style={{ marginTop: "4px" }}>
      <strong style={{ fontSize: "12px", color: "#003264", textTransform: "uppercase" }}>
        Perícias
      </strong>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          marginTop: "4px"
        }}
      >
        {skills.map((sk) => {
          const skKey = sk.key || sk.id;
          const attrKey = sk.attributeKey || sk.attribute || "forca";
          const formula = sk.formula || buildSkillFormula(sk);
          return (
            <div
              key={skKey}
              style={{
                background: "#ffffff",
                border: "1.5px solid #cbd5e1",
                borderRadius: "8px",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "6px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  flex: 1,
                  minWidth: "120px"
                }}
              >
                <strong style={{ fontSize: "12px", color: "#1e293b" }}>{sk.name}</strong>
                <span style={{ fontSize: "10px", color: "#64748b" }}>({attrKey})</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#003264" }}>
                  +{sk.bonus}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-epf"
                  style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                  onClick={() =>
                    onPing({
                      name: sk.name,
                      hitFormula: formula,
                      attribute: attrKey,
                      bonus: sk.bonus,
                      description: `Perícia ${sk.name} (+${sk.bonus})`
                    })
                  }
                  title="Pingar no Chat"
                >
                  💬 Pingar
                </button>
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
                  onClick={() =>
                    onTriggerRoll({
                      title: `Perícia: ${sk.name}`,
                      categoryColor: "#02529c",
                      primaryFormula: formula,
                      primaryLabel: sk.name,
                      rollKind: ROLL_KINDS.CHECK,
                      icon: sk.icon || "clover"
                    })
                  }
                >
                  🎲 Rolar
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      className="cp-btn"
                      style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                      onClick={() =>
                        onPinToRollGroup({
                          sourceType: "skill",
                          sourceId: skKey,
                          name: `Perícia ${sk.name}`,
                          customName: true,
                          color: "#02529c",
                          icon: "clover",
                          hitFormula: formula,
                          rollKind: ROLL_KINDS.CHECK
                        })
                      }
                      title="Fixar na Aba Rolagens"
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dispatchSkills({
                          type: "OPEN_DELETE_CONFIRM",
                          payload: { kind: "skill", key: skKey, label: sk.name }
                        })
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef5350",
                        fontSize: "14px",
                        fontWeight: 900,
                        cursor: "pointer",
                        padding: "0 4px"
                      }}
                      title="Excluir Perícia"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <form
          onSubmit={handleSubmitSkill}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginTop: "6px"
          }}
        >
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <input
              type="text"
              className="cp-input"
              style={{ width: "130px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              placeholder="Nova Perícia..."
              value={skillsState.newSkillName}
              onChange={(e) => {
                setSkillError(null);
                dispatchSkills({
                  type: "SET_FIELD",
                  field: "newSkillName",
                  value: e.target.value
                });
              }}
            />
            <select
              className="cp-input"
              style={{ width: "100px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              value={selectedAttrKey}
              onChange={(e) => {
                setSkillError(null);
                dispatchSkills({
                  type: "SET_FIELD",
                  field: "newSkillAttr",
                  value: e.target.value
                });
              }}
            >
              {attributes.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="cp-input"
              style={{ width: "50px", padding: "3px 4px", fontSize: "11px", height: "26px" }}
              value={skillsState.newSkillBonus}
              onChange={(e) =>
                dispatchSkills({
                  type: "SET_FIELD",
                  field: "newSkillBonus",
                  value: e.target.value
                })
              }
            />
            <button
              type="submit"
              className="cp-btn"
              style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            >
              + Perícia
            </button>
          </div>
          {skillError && (
            <div role="alert" style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
              {skillError}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
