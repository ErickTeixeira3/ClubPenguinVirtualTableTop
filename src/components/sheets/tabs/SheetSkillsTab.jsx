import { Z_LAYERS } from "../../../constants/zLayers";
import { inferAbilityRollKind } from "../../../engines/rolls";
import ConfirmDialog from "../../ui/ConfirmDialog";
import AbilityCard from "./AbilityCard";
import AbilityForm from "./AbilityForm";
import SkillList from "./SkillList";

/**
 * Aba "Skills" da Ficha (Habilidades & Magias com Alcance/AoE/CD e Perícias).
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
  onAddCharacterEntry = null,
  onUpdateCharacterEntry = null,
  onRemoveCharacterEntry = null,
  skillsState,
  dispatchSkills
}) {
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

  const handleAddSkill = async (skillPayload) => {
    if (!canEdit) return;
    if (onAddCharacterEntry) {
      await onAddCharacterEntry(character.id, "skills", skillPayload);
    } else if (Array.isArray(character.skills)) {
      await onUpdateCharacter(character.id, {
        skills: [...skills, skillPayload]
      });
    } else {
      await onUpdateCharacter(character.id, {
        [`skills.${skillPayload.key}`]: { ...skillPayload, order: skills.length }
      });
    }
  };

  const handleSaveAbility = async (e) => {
    e.preventDefault();
    if (!canEdit || !skillsState.abName.trim()) return;
    const hitFormula = skillsState.abHit.trim();
    const effectFormula = skillsState.abEffect.trim();
    const effectType = skillsState.abEffectType || "damage";
    const rangeType = skillsState.abRangeType || "ranged";
    const aoeType = skillsState.abAoeType || "single";

    const payload = {
      ...(skillsState.editingAbilityId
        ? { id: skillsState.editingAbilityId }
        : onAddCharacterEntry
          ? {}
          : { id: `ab_${Date.now()}` }),
      name: skillsState.abName.trim(),
      icon: skillsState.abIcon || "sword",
      elementColor: skillsState.abColor,
      cost: {
        resource: skillsState.abCostRes,
        amount: Math.max(0, Number(skillsState.abCostAmt) || 0)
      },
      hitFormula,
      effectFormula,
      trigger: skillsState.abTrigger || "active",
      effectType,
      rollKind: inferAbilityRollKind({ hitFormula, effectFormula, effectType }),
      range: {
        type: rangeType,
        distanceMeters:
          rangeType === "ranged"
            ? Math.max(0, Number(skillsState.abRangeDist) || 0)
            : 0
      },
      aoe: {
        type: aoeType,
        radiusMeters:
          aoeType !== "single"
            ? Math.max(1, Number(skillsState.abAoeRadius) || 1)
            : 0,
        coneAngleDeg:
          aoeType === "cone"
            ? Number(skillsState.abAoeConeAngle) === 60
              ? 60
              : 45
            : 45
      },
      savingThrow: {
        enabled: Boolean(skillsState.abSaveEnabled),
        dcFormula: skillsState.abSaveDc.trim() || "12",
        attributeKey: skillsState.abSaveAttr || "resistencia",
        effectDescription: skillsState.abSaveDesc.trim()
      },
      description: skillsState.abDesc.trim()
    };

    try {
      if (skillsState.editingAbilityId) {
        if (onUpdateCharacterEntry) {
          await onUpdateCharacterEntry(
            character.id,
            "abilities",
            skillsState.editingAbilityId,
            payload
          );
        } else if (Array.isArray(character.abilities)) {
          await onUpdateCharacter(character.id, {
            abilities: abilities.map((a) =>
              a.id === skillsState.editingAbilityId ? { ...a, ...payload } : a
            )
          });
        } else {
          await onUpdateCharacter(character.id, {
            [`abilities.${skillsState.editingAbilityId}`]: payload
          });
        }
      } else if (onAddCharacterEntry) {
        await onAddCharacterEntry(character.id, "abilities", payload);
      } else if (Array.isArray(character.abilities)) {
        await onUpdateCharacter(character.id, {
          abilities: [...abilities, payload]
        });
      } else {
        const legacyId = payload.id || `ab_${Date.now()}`;
        await onUpdateCharacter(character.id, {
          [`abilities.${legacyId}`]: { ...payload, id: legacyId, order: abilities.length }
        });
      }
      dispatchSkills({ type: "RESET_ABILITY_FORM" });
    } catch (err) {
      dispatchSkills({
        type: "SET_ERROR",
        error: err?.message || "Erro ao salvar habilidade."
      });
    }
  };

  const handleConfirmDelete = async () => {
    const target = skillsState.confirmDelete;
    if (!canEdit || !target) return;
    dispatchSkills({ type: "CLOSE_DELETE_CONFIRM" });

    try {
      if (target.kind === "ability") {
        if (onRemoveCharacterEntry) {
          await onRemoveCharacterEntry(character.id, "abilities", target.key);
        } else if (Array.isArray(character.abilities)) {
          await onUpdateCharacter(character.id, {
            abilities: abilities.filter((a) => a.id !== target.key)
          });
        }
        return;
      }

      if (onRemoveCharacterEntry) {
        await onRemoveCharacterEntry(character.id, "skills", target.key);
      } else if (Array.isArray(character.skills)) {
        await onUpdateCharacter(character.id, {
          skills: skills.filter((s) => (s.key || s.id) !== target.key)
        });
      }
    } catch {
      // Erro já notificado pelo hook
    }
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
              onClick={() => dispatchSkills({ type: "TOGGLE_NEW_ABILITY" })}
            >
              + Habilidade
            </button>
          )}
        </div>

        {skillsState.newAbilityOpen && canEdit && (
          <AbilityForm
            skillsState={skillsState}
            dispatchSkills={dispatchSkills}
            onSubmit={handleSaveAbility}
          />
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "8px"
          }}
        >
          {abilities.map((ab) => (
            <AbilityCard
              key={ab.id}
              ab={ab}
              canEdit={canEdit}
              isExpanded={expandedSkillIds.has(ab.id)}
              onToggleExpand={toggleExpandSkill}
              onDemarcateArea={handleDemarcateArea}
              onPing={handlePing}
              onTriggerRoll={triggerRoll}
              onStartEdit={(item) =>
                dispatchSkills({ type: "START_EDIT_ABILITY", ability: item })
              }
              onPinToRollGroup={pinToRollGroup}
              onRequestDelete={(item) =>
                dispatchSkills({
                  type: "OPEN_DELETE_CONFIRM",
                  payload: { kind: "ability", key: item.id, label: item.name }
                })
              }
            />
          ))}
        </div>
      </div>

      <SkillList
        skills={skills}
        attributes={attributes}
        canEdit={canEdit}
        skillsState={skillsState}
        dispatchSkills={dispatchSkills}
        onPing={handlePing}
        onTriggerRoll={triggerRoll}
        onPinToRollGroup={pinToRollGroup}
        onAddSkill={handleAddSkill}
      />

      {skillsState.confirmDelete && (
        <ConfirmDialog
          title={
            skillsState.confirmDelete.kind === "ability"
              ? "Excluir habilidade?"
              : "Excluir perícia?"
          }
          question={`Remover "${skillsState.confirmDelete.label}" da ficha?`}
          confirmLabel="Excluir"
          onConfirm={handleConfirmDelete}
          onCancel={() => dispatchSkills({ type: "CLOSE_DELETE_CONFIRM" })}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </div>
  );
}
