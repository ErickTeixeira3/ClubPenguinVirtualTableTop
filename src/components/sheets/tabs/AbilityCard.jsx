import { TRIGGER_TYPES } from "../../../engines/combatEngine";
import { inferAbilityRollKind } from "../../../engines/rolls";

/**
 * Cartão individual de habilidade na aba Skills.
 */
export default function AbilityCard({
  ab,
  canEdit,
  isExpanded,
  onToggleExpand,
  onDemarcateArea,
  onPing,
  onTriggerRoll,
  onStartEdit,
  onPinToRollGroup,
  onRequestDelete
}) {
  const trigMeta = TRIGGER_TYPES.find((t) => t.id === (ab.trigger || "active"));
  const effType = ab.effectType || (ab.effectFormula ? "damage" : null);
  const abRollKind = inferAbilityRollKind({
    hitFormula: ab.hitFormula || "",
    effectFormula: ab.effectFormula || "",
    effectType: effType
  });

  return (
    <div
      style={{
        background: "#ffffff",
        border: `2.5px solid ${ab.elementColor || "#e53935"}`,
        borderRadius: "12px",
        padding: "8px 10px",
        boxShadow: "0 2px 5px rgba(0,27,58,0.06)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "5px"
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <button
              type="button"
              onClick={() => onToggleExpand(ab.id)}
              style={{
                background: isExpanded ? "#002244" : "rgba(0, 34, 68, 0.08)",
                color: isExpanded ? "#ffffff" : "#002447",
                border: "1.5px solid rgba(0, 34, 68, 0.25)",
                borderRadius: "6px",
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 900,
                padding: 0,
                flexShrink: 0
              }}
              title={isExpanded ? "Recolher" : "Expandir"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
            <strong
              onClick={() => onToggleExpand(ab.id)}
              style={{
                fontSize: "13px",
                color: "#1e293b",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
              }}
            >
              {ab.name}
            </strong>
          </div>

          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {ab.range?.type && (
              <span
                style={{
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #7dd3fc",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "0px 4px",
                  borderRadius: "6px"
                }}
              >
                {ab.range.type === "self"
                  ? "🎯 Próprio"
                  : ab.range.type === "touch"
                    ? "🎯 Toque"
                    : `🎯 ${ab.range.distanceMeters || 9}m`}
              </span>
            )}
            {ab.aoe?.type && ab.aoe.type !== "single" && (
              <span
                style={{
                  background: "#fef2f2",
                  color: "#b91c1c",
                  border: "1px solid #fca5a5",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "0px 4px",
                  borderRadius: "6px"
                }}
              >
                {ab.aoe.type === "circle"
                  ? `⭕ Raio ${ab.aoe.radiusMeters || 6}m`
                  : `▲ Cone ${ab.aoe.radiusMeters || 9}m (${ab.aoe.coneAngleDeg || 45}°)`}
              </span>
            )}
            {ab.cost?.amount > 0 && (
              <span
                style={{
                  background: "#02529c",
                  color: "#ffffff",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "1px 5px",
                  borderRadius: "8px"
                }}
              >
                {ab.cost.amount} {(ab.cost.resource || "mp").toUpperCase()}
              </span>
            )}
            {ab.trigger && ab.trigger !== "active" && (
              <span
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  border: "1px solid #f59e0b",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "0px 4px",
                  borderRadius: "6px"
                }}
              >
                {trigMeta?.label || ab.trigger}
              </span>
            )}
            {ab.savingThrow?.enabled && (
              <span
                style={{
                  background: "#f3e8ff",
                  color: "#6b21a8",
                  border: "1px solid #a855f7",
                  fontSize: "9px",
                  fontWeight: 800,
                  padding: "0px 4px",
                  borderRadius: "6px"
                }}
              >
                CD {ab.savingThrow.dcFormula || 12}
              </span>
            )}
          </div>
        </div>

        {!isExpanded && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", margin: "3px 0 1px 0" }}>
            {(ab.hitFormula || ab.effectFormula) && (
              <div style={{ display: "flex", gap: "8px", fontSize: "10px", flexWrap: "wrap" }}>
                {ab.hitFormula && (
                  <span style={{ color: "#013567", fontWeight: 700 }}>
                    Acerto: {ab.hitFormula}
                  </span>
                )}
                {ab.effectFormula && (
                  <span style={{ color: "#b71c1c", fontWeight: 700 }}>
                    Efeito: {ab.effectFormula}
                  </span>
                )}
              </div>
            )}
            {ab.description && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {ab.description}
              </div>
            )}
          </div>
        )}

        {isExpanded && (
          <div
            style={{
              marginTop: "6px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            {ab.description && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  color: "#1e293b",
                  whiteSpace: "pre-wrap"
                }}
              >
                {ab.description}
              </div>
            )}

            <div
              style={{
                background: "#f1f5f9",
                border: "1.5px solid #cbd5e1",
                borderRadius: "8px",
                padding: "6px 8px",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                fontSize: "11px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <strong style={{ color: "#013567" }}>Acerto (Macro):</strong>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {ab.hitFormula || "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <strong style={{ color: "#b71c1c" }}>Dano / Efeito (Macro):</strong>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {ab.effectFormula || "—"} {ab.effectType ? `(${ab.effectType})` : ""}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <strong style={{ color: "#002447" }}>Gatilho:</strong>
                <span style={{ fontWeight: 700 }}>
                  {trigMeta?.label || ab.trigger || "Ação Ativa"}
                </span>
              </div>
              {ab.range?.type && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                  <strong style={{ color: "#0369a1" }}>Alcance:</strong>
                  <span style={{ fontWeight: 700, color: "#0284c7" }}>
                    {ab.range.type === "self"
                      ? "Próprio"
                      : ab.range.type === "touch"
                        ? "Toque"
                        : `${ab.range.distanceMeters || 9} metros`}
                  </span>
                </div>
              )}
              {ab.aoe?.type && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                  <strong style={{ color: "#b91c1c" }}>Área de Efeito:</strong>
                  <span style={{ fontWeight: 700, color: "#dc2626" }}>
                    {ab.aoe.type === "single"
                      ? "Alvo Único"
                      : ab.aoe.type === "circle"
                        ? `Circular (Raio ${ab.aoe.radiusMeters || 6}m)`
                        : `Cônica (Cone ${ab.aoe.radiusMeters || 9}m / ${ab.aoe.coneAngleDeg || 45}°)`}
                  </span>
                </div>
              )}
              {ab.savingThrow?.enabled && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                  <strong style={{ color: "#7e22ce" }}>Resistência:</strong>
                  <span style={{ fontWeight: 700, color: "#6b21a8" }}>
                    CD {ab.savingThrow.dcFormula || 12} (
                    {ab.savingThrow.attributeKey ||
                      ab.savingThrow.attribute ||
                      "Resistência"}
                    )
                    {ab.savingThrow.effectDescription
                      ? ` — ${ab.savingThrow.effectDescription}`
                      : ""}
                  </span>
                </div>
              )}
              {ab.cost?.amount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                  <strong style={{ color: "#02529c" }}>Custo:</strong>
                  <span style={{ fontWeight: 700 }}>
                    {ab.cost.amount} {(ab.cost.resource || "mp").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "4px", marginTop: "4px", alignItems: "center", flexWrap: "wrap" }}>
        {ab.aoe?.type && ab.aoe.type !== "single" && (
          <button
            type="button"
            className="cp-btn cp-btn-green"
            style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
            onClick={() => onDemarcateArea(ab)}
            title="Demarcar Área no Tabuleiro"
          >
            🎯 Demarcar Área
          </button>
        )}
        <button
          type="button"
          className="cp-btn cp-btn-epf"
          style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
          onClick={() => onPing(ab)}
          title="Pingar no Chat"
        >
          💬 Pingar
        </button>
        <button
          type="button"
          className="cp-btn cp-btn-gold"
          style={{ flex: 1, padding: "3px 6px", fontSize: "10px", height: "24px" }}
          onClick={() =>
            onTriggerRoll({
              title: ab.name,
              categoryColor: ab.elementColor || "#e53935",
              description: ab.description || "",
              primaryFormula: ab.hitFormula || "",
              primaryLabel: ab.hitFormula ? "Acerto" : "Efeito",
              rollKind: abRollKind,
              trigger: ab.trigger || "active",
              secondaryFormula: ab.effectFormula || "",
              secondaryLabel: "Dano / Efeito",
              cost: ab.cost,
              effectType: effType,
              savingThrow: ab.savingThrow || null,
              range: ab.range,
              aoe: ab.aoe,
              icon: ab.icon || "sword"
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
              onClick={() => onStartEdit(ab)}
              title="Editar Habilidade"
            >
              ✎
            </button>
            <button
              type="button"
              className="cp-btn"
              style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
              onClick={() =>
                onPinToRollGroup({
                  sourceType: "ability",
                  sourceId: ab.id,
                  name: ab.name,
                  color: ab.elementColor || "#e53935",
                  icon: ab.icon || "sword",
                  hitFormula: ab.hitFormula || "",
                  effectFormula: ab.effectFormula || "",
                  effectType: ab.effectType || "damage",
                  rollKind: inferAbilityRollKind({
                    hitFormula: ab.hitFormula || "",
                    effectFormula: ab.effectFormula || "",
                    effectType: ab.effectType || "damage"
                  }),
                  range: ab.range || null,
                  aoe: ab.aoe || null,
                  trigger: ab.trigger || "active",
                  savingThrow: ab.savingThrow || null,
                  costResource: ab.cost?.resource || "mp",
                  costAmount: ab.cost?.amount || 0
                })
              }
              title="Fixar na Aba Rolagens"
            >
              ★
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-orange"
              style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
              onClick={() => onRequestDelete(ab)}
              title="Excluir"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
