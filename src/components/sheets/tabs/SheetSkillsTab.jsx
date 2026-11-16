import { EFFECT_TYPES, ROLL_KINDS, SKILL_AOE_TYPES, SKILL_RANGE_TYPES, TRIGGER_TYPES } from "../../../engines/combatEngine";
import SavingThrowFields from "../../ui/SavingThrowFields";
import { normalizeCompactKey } from "../../../utils/stringUtils";

/**
 * Fase 5: aba "Skills" da Ficha (Habilidades & Magias com Alcance/AoE/CD e Perícias),
 * extraída de CharacterSheetModal.jsx com JSX e handlers inalterados.
 */
export default function SheetSkillsTab({
  canEdit,
  abilities,
  expandedSkillIds,
  handleDemarcateArea,
  triggerRoll,
  pinToRollGroup,
  skills,
  attributes,
  setExpandedSkillIds,
  onPingSkill,
  character,
  rollVisibility,
  onExecuteRoll,
  onUpdateCharacter,
  skillsForm
}) {
  const { resetAbilityForm, newAbilityOpen, setNewAbilityOpen, abName, setAbName, abColor, setAbColor, abCostRes, setAbCostRes, abCostAmt, setAbCostAmt, abHit, setAbHit, abEffect, setAbEffect, abTrigger, setAbTrigger, abEffectType, setAbEffectType, abSaveEnabled, setAbSaveEnabled, abSaveDc, setAbSaveDc, abSaveAttr, setAbSaveAttr, abSaveDesc, setAbSaveDesc, abRangeType, setAbRangeType, abRangeDist, setAbRangeDist, abAoeType, setAbAoeType, abAoeRadius, setAbAoeRadius, abAoeConeAngle, setAbAoeConeAngle, abDesc, setAbDesc, editingAbilityId, newSkillName, setNewSkillName, newSkillAttr, setNewSkillAttr, newSkillBonus, setNewSkillBonus, setEditingAbilityId } = skillsForm;
  const toggleExpandSkill = (skillId) => {
    setExpandedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const handlePing = (skillOrAbility) => {
    if (onPingSkill) {
      onPingSkill({
        character,
        skill: skillOrAbility,
        visibility: rollVisibility
      });
    } else if (onExecuteRoll) {
      onExecuteRoll({
        isPingOnly: true,
        character,
        skill: skillOrAbility,
        visibility: rollVisibility
      });
    }
  };

  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!canEdit || !newSkillName.trim()) return;
    const cleanName = normalizeCompactKey(newSkillName);
    const newSkill = {
      id: `sk_${Date.now()}`,
      name: newSkillName.trim(),
      attribute: newSkillAttr,
      bonus: Number(newSkillBonus) || 0,
      formula: `1d20 + @${newSkillAttr} + @${cleanName}`
    };
    onUpdateCharacter(character.id, {
      skills: [...skills, newSkill]
    });
    setNewSkillName("");
  };

  const handleDeleteSkill = (skillId) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      skills: skills.filter((s) => s.id !== skillId)
    });
  };

  const handleStartEditAbility = (ab) => {
    if (!canEdit || !ab) return;
    setEditingAbilityId(ab.id);
    setAbName(ab.name || "");
    setAbColor(ab.elementColor || "#e53935");
    setAbCostRes(ab.cost?.resource || "mp");
    setAbCostAmt(ab.cost?.amount ?? 0);
    setAbHit(ab.hitFormula ?? "");
    setAbEffect(ab.effectFormula ?? "");
    setAbTrigger(ab.trigger || "active");
    setAbEffectType(ab.effectType || "damage");
    setAbRangeType(ab.range?.type || ab.rangeType || "ranged");
    setAbRangeDist(ab.range?.distanceMeters ?? ab.rangeMeters ?? 9);
    setAbAoeType(ab.aoe?.type || ab.aoeType || "single");
    setAbAoeRadius(ab.aoe?.radiusMeters ?? ab.aoeRadiusMeters ?? 6);
    setAbAoeConeAngle(ab.aoe?.coneAngleDeg ?? ab.aoeConeAngleDeg ?? 45);
    setAbSaveEnabled(Boolean(ab.savingThrow?.enabled));
    setAbSaveDc(ab.savingThrow?.dcFormula || "12");
    setAbSaveAttr(ab.savingThrow?.attribute || "resistencia");
    setAbSaveDesc(ab.savingThrow?.effectDescription || "");
    setAbDesc(ab.description || "");
    setNewAbilityOpen(true);
  };

  const handleAddAbility = (e) => {
    e.preventDefault();
    if (!canEdit || !abName.trim()) return;
    const payload = {
      id: editingAbilityId || `ab_${Date.now()}`,
      name: abName.trim(),
      elementColor: abColor,
      cost: { resource: abCostRes, amount: Number(abCostAmt) || 0 },
      hitFormula: abHit.trim(),
      effectFormula: abEffect.trim(),
      trigger: abTrigger || "active",
      effectType: abEffectType || "damage",
      range: {
        type: abRangeType || "ranged",
        distanceMeters: abRangeType === "ranged" ? Math.max(0, Number(abRangeDist) || 0) : 0
      },
      aoe: {
        type: abAoeType || "single",
        radiusMeters: abAoeType !== "single" ? Math.max(1, Number(abAoeRadius) || 1) : 0,
        coneAngleDeg: abAoeType === "cone" ? (Number(abAoeConeAngle) === 60 ? 60 : 45) : 45
      },
      savingThrow: {
        enabled: Boolean(abSaveEnabled),
        dcFormula: abSaveDc.trim() || "12",
        attribute: abSaveAttr || "resistencia",
        effectDescription: abSaveDesc.trim()
      },
      description: abDesc.trim()
    };
    const nextAbilities = editingAbilityId
      ? abilities.map((a) => (a.id === editingAbilityId ? { ...a, ...payload } : a))
      : [...abilities, payload];
    onUpdateCharacter(character.id, {
      abilities: nextAbilities
    });
    resetAbilityForm();
    setNewAbilityOpen(false);
  };

  const handleDeleteAbility = (abId) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      abilities: abilities.filter((a) => a.id !== abId)
    });
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      {/* Seção Habilidades & Magias */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6px"
          }}
        >
          <strong style={{ fontSize: "12px", color: "#003264", textTransform: "uppercase" }}>
            Habilidades & Magias
          </strong>

          {canEdit && (
            <button
              type="button"
              className="cp-btn cp-btn-green"
              style={{ padding: "2px 8px", fontSize: "10px", height: "24px" }}
              onClick={() => {
                if (newAbilityOpen) {
                  setNewAbilityOpen(false);
                  resetAbilityForm();
                } else {
                  resetAbilityForm();
                  setNewAbilityOpen(true);
                }
              }}
            >
              + Habilidade
            </button>
          )}
        </div>

        {newAbilityOpen && canEdit && (
          <form
            onSubmit={handleAddAbility}
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
            <input
              type="text"
              className="cp-input"
              placeholder="Nome da Habilidade/Magia"
              value={abName}
              onChange={(e) => setAbName(e.target.value)}
              required
              style={{ fontSize: "11px", padding: "3px 6px" }}
            />
            <div style={{ display: "flex", gap: "4px" }}>
              <input
                type="color"
                className="cp-input"
                style={{ width: "38px", padding: "1px", height: "24px" }}
                value={abColor}
                onChange={(e) => setAbColor(e.target.value)}
              />
              <select
                className="cp-input"
                style={{ fontSize: "11px", padding: "2px" }}
                value={abCostRes}
                onChange={(e) => setAbCostRes(e.target.value)}
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
                onChange={(e) => setAbCostAmt(e.target.value)}
              />
            </div>
            <input
              type="text"
              className="cp-input"
              placeholder="Acerto (ex: 1d20 + @forca)"
              value={abHit}
              onChange={(e) => setAbHit(e.target.value)}
              style={{ fontSize: "11px", padding: "3px 6px" }}
            />
            <input
              type="text"
              className="cp-input"
              placeholder="Efeito (ex: 2d6 + @forca)"
              value={abEffect}
              onChange={(e) => setAbEffect(e.target.value)}
              style={{ fontSize: "11px", padding: "3px 6px" }}
            />
            <select
              className="cp-input"
              value={abTrigger}
              onChange={(e) => setAbTrigger(e.target.value)}
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
              onChange={(e) => setAbEffectType(e.target.value)}
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
              {/* Fase 4: SavingThrowFields (layout "inline") */}
              <SavingThrowFields
                enabled={abSaveEnabled}
                onEnabledChange={setAbSaveEnabled}
                dcFormula={abSaveDc}
                onDcFormulaChange={setAbSaveDc}
                attribute={abSaveAttr}
                onAttributeChange={setAbSaveAttr}
                effectDescription={abSaveDesc}
                onEffectDescriptionChange={setAbSaveDesc}
                toggleLabel="Resistência (CD)"
                dcPlaceholder="CD (ex: 14 ou 10+@forca)"
                effectPlaceholder="Efeito na falha (ex: Derrubado)"
                dcWidth="110px"
                effectMinWidth="120px"
              />
            </div>

            {/* Linha de Alcance e Área de Efeito */}
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
                onChange={(e) => setAbRangeType(e.target.value)}
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
                    onChange={(e) => setAbRangeDist(e.target.value)}
                  />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>m</span>
                </div>
              )}

              <span style={{ fontSize: "11px", fontWeight: 800, color: "#166534", marginLeft: "6px" }}>
                Área:
              </span>
              <select
                className="cp-input"
                value={abAoeType}
                onChange={(e) => setAbAoeType(e.target.value)}
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
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>Raio:</span>
                  <input
                    type="number"
                    className="cp-input"
                    style={{ width: "50px", fontSize: "11px", padding: "2px 4px" }}
                    min={1}
                    value={abAoeRadius}
                    onChange={(e) => setAbAoeRadius(e.target.value)}
                  />
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>m</span>
                </div>
              )}

              {abAoeType === "cone" && (
                <>
                  <select
                    className="cp-input"
                    value={abAoeConeAngle}
                    onChange={(e) => setAbAoeConeAngle(Number(e.target.value))}
                    style={{ fontSize: "11px", padding: "2px 4px" }}
                  >
                    <option value={45}>Cone 45°</option>
                    <option value={60}>Cone 60°</option>
                  </select>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>Tam:</span>
                    <input
                      type="number"
                      className="cp-input"
                      style={{ width: "50px", fontSize: "11px", padding: "2px 4px" }}
                      min={1}
                      value={abAoeRadius}
                      onChange={(e) => setAbAoeRadius(e.target.value)}
                    />
                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534" }}>m</span>
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
              onChange={(e) => setAbDesc(e.target.value)}
            />
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "6px" }}>
              {editingAbilityId && (
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{ padding: "3px 10px", fontSize: "11px" }}
                  onClick={() => {
                    resetAbilityForm();
                    setNewAbilityOpen(false);
                  }}
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
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "8px"
          }}
        >
          {abilities.map((ab) => {
            const trigMeta = TRIGGER_TYPES.find((t) => t.id === (ab.trigger || "active"));
            const isExpanded = expandedSkillIds.has(ab.id);

            return (
              <div
                key={ab.id}
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
                  {/* Cabeçalho da Skill com Setinha e Badges */}
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
                        onClick={() => toggleExpandSkill(ab.id)}
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
                        onClick={() => toggleExpandSkill(ab.id)}
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

                  {/* Visualização Recolhida: Resumo Rápido */}
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

                  {/* Visualização Expandida: Descrição Completa e Macros Detalhados */}
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
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{ab.hitFormula || "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                          <strong style={{ color: "#b71c1c" }}>Dano / Efeito (Macro):</strong>
                          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                            {ab.effectFormula || "—"} {ab.effectType ? `(${ab.effectType})` : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                          <strong style={{ color: "#002447" }}>Gatilho:</strong>
                          <span style={{ fontWeight: 700 }}>{trigMeta?.label || ab.trigger || "Ação Ativa"}</span>
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
                              CD {ab.savingThrow.dcFormula || 12} ({ab.savingThrow.attribute || "Resistência"})
                              {ab.savingThrow.effectDescription ? ` — ${ab.savingThrow.effectDescription}` : ""}
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

                {/* Botões de Ação da Habilidade */}
                <div style={{ display: "flex", gap: "4px", marginTop: "4px", alignItems: "center", flexWrap: "wrap" }}>
                  {ab.aoe?.type && ab.aoe.type !== "single" && (
                    <button
                      type="button"
                      className="cp-btn cp-btn-green"
                      style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
                      onClick={() => handleDemarcateArea(ab)}
                      title="Demarcar Área no Tabuleiro"
                    >
                      🎯 Demarcar Área
                    </button>
                  )}
                  <button
                    type="button"
                    className="cp-btn cp-btn-epf"
                    style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
                    onClick={() => handlePing(ab)}
                    title="Pingar no Chat"
                  >
                    💬 Pingar
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-gold"
                    style={{ flex: 1, padding: "3px 6px", fontSize: "10px", height: "24px" }}
                    onClick={() => {
                      const effType = ab.effectType || (ab.effectFormula ? "damage" : null);
                      const abRollKind = ab.hitFormula
                        ? ROLL_KINDS.ATTACK
                        : ab.effectFormula
                          ? effType === "heal" || effType === "mp_heal"
                            ? ROLL_KINDS.HEAL
                            : effType === "utility"
                              ? ROLL_KINDS.UTILITY
                              : ROLL_KINDS.DAMAGE
                          : ROLL_KINDS.CHECK;
                      triggerRoll({
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
                        icon: ab.icon || ab.name
                      });
                    }}
                  >
                    🎲 Rolar
                  </button>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                        onClick={() => handleStartEditAbility(ab)}
                        title="Editar Habilidade"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                        onClick={() => {
                          const effType = ab.effectType || "damage";
                          const abRollKind = ab.hitFormula
                            ? ROLL_KINDS.ATTACK
                            : ab.effectFormula
                              ? effType === "heal" || effType === "mp_heal"
                                ? ROLL_KINDS.HEAL
                                : effType === "utility"
                                  ? ROLL_KINDS.UTILITY
                                  : ROLL_KINDS.DAMAGE
                              : ROLL_KINDS.CHECK;
                          pinToRollGroup({
                            sourceType: "ability",
                            sourceId: ab.id,
                            name: ab.name,
                            color: ab.elementColor || "#e53935",
                            icon: ab.icon || "sword",
                            hitFormula: ab.hitFormula || "",
                            effectFormula: ab.effectFormula || "",
                            effectType: effType,
                            rollKind: abRollKind,
                            range: ab.range || null,
                            aoe: ab.aoe || null,
                            trigger: ab.trigger || "active",
                            savingThrow: ab.savingThrow || null,
                            costResource: ab.cost?.resource || "mp",
                            costAmount: ab.cost?.amount || 0
                          });
                        }}
                        title="Fixar na Aba Rolagens"
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                        onClick={() => handleDeleteAbility(ab.id)}
                        title="Excluir"
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
      </div>

      {/* Seção Perícias */}
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
          {skills.map((sk) => (
            <div
              key={sk.id}
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
                <span style={{ fontSize: "10px", color: "#64748b" }}>
                  ({sk.attribute})
                </span>
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
                    handlePing({
                      name: sk.name,
                      hitFormula: sk.formula || `1d20 + @${sk.attribute} + ${sk.bonus}`,
                      attribute: sk.attribute,
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
                    triggerRoll({
                      title: `Perícia: ${sk.name}`,
                      categoryColor: "#02529c",
                      primaryFormula: sk.formula || `1d20 + @${sk.attribute} + ${sk.bonus}`,
                      primaryLabel: sk.name,
                      rollKind: ROLL_KINDS.CHECK,
                      icon: sk.icon || sk.name
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
                        pinToRollGroup({
                          sourceType: "skill",
                          sourceId: sk.id,
                          name: `Perícia ${sk.name}`,
                          customName: true,
                          color: "#02529c",
                          hitFormula: sk.formula || `1d20 + @${sk.attribute} + ${sk.bonus}`,
                          rollKind: ROLL_KINDS.CHECK
                        })
                      }
                      title="Fixar na Aba Rolagens"
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSkill(sk.id)}
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
          ))}
        </div>

        {canEdit && (
          <form
            onSubmit={handleAddSkill}
            style={{
              display: "flex",
              gap: "4px",
              marginTop: "6px",
              flexWrap: "wrap"
            }}
          >
            <input
              type="text"
              className="cp-input"
              style={{ width: "130px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              placeholder="Nova Perícia..."
              value={newSkillName}
              onChange={(e) => setNewSkillName(e.target.value)}
            />
            <select
              className="cp-input"
              style={{ width: "100px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              value={newSkillAttr}
              onChange={(e) => setNewSkillAttr(e.target.value)}
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
              value={newSkillBonus}
              onChange={(e) => setNewSkillBonus(e.target.value)}
            />
            <button
              type="submit"
              className="cp-btn"
              style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            >
              + Perícia
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
