import { Z_LAYERS } from "../../../constants/zLayers";
import { ROLL_KINDS } from "../../../domain/constants.js";
import { DEFAULT_COLORS } from "../../../domain/defaults.js";
import { EFFECT_TYPES } from "../../../engines/combatEngine";
import {
  buildShortcutRollParams,
  buildSkillFormula,
  inferAbilityRollKind,
  resolveDynamicRollEntry
} from "../../../engines/rolls";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";
import { toSortedEntries } from "../sheetConstants";

function findHotbarSlotIndexForRoll(hotbar, rollId) {
  if (!hotbar || !rollId) return -1;
  if (Array.isArray(hotbar)) {
    return hotbar.findIndex((s) => s?.rollId === rollId);
  }
  for (let i = 1; i <= 9; i += 1) {
    if (hotbar[String(i)]?.rollId === rollId) {
      return i - 1;
    }
  }
  return -1;
}

/**
 * Aba "Rolagens & Ações" da Ficha (grupos de rolagens, importação da ficha e vínculo com a Hotbar).
 */
export default function SheetRollsTab({
  canEdit,
  selectedGroupId,
  setSelectedGroupId,
  rollGroups,
  skills,
  pinToRollGroup,
  abilities,
  character,
  triggerRoll,
  handleDemarcateArea,
  onUpdateCharacter,
  onAddCharacterEntry = null,
  onRemoveCharacterEntry = null,
  onReorderCharacterEntries = null,
  rollsState = null,
  dispatchRolls = null,
  // Suporte de compatibilidade para testes unitários isolados (A15)
  rollsForm = null
}) {
  const form = rollsForm
    ? {
        newGroupName: rollsForm.newGroupName,
        newCustomRollOpen: rollsForm.newCustomRollOpen,
        importFromSheetOpen: rollsForm.importFromSheetOpen,
        crName: rollsForm.crName,
        crIcon: rollsForm.crIcon,
        showRollIconPicker: rollsForm.showRollIconPicker,
        crColor: rollsForm.crColor,
        crHit: rollsForm.crHit,
        crEffect: rollsForm.crEffect,
        crCostRes: rollsForm.crCostRes,
        crCostAmt: rollsForm.crCostAmt,
        crEffectType: rollsForm.crEffectType,
        crRollKind: rollsForm.crRollKind,
        confirmDelete: null,
        formError: null
      }
    : rollsState;

  const setField = (field, value) => {
    if (dispatchRolls) {
      dispatchRolls({ type: "SET_FIELD", field, value });
      return;
    }
    if (!rollsForm) return;
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    rollsForm[setterName]?.(value);
  };

  const handleCreateRollGroup = async (e) => {
    e.preventDefault();
    const cleanName = form.newGroupName.trim();
    if (!canEdit || !cleanName) return;
    const newId = `grp_${Date.now()}`;
    try {
      if (onAddCharacterEntry) {
        const res = await onAddCharacterEntry(character.id, "rollGroups", {
          id: newId,
          name: cleanName
        });
        setSelectedGroupId(res?.key || res?.entryKey || newId);
      } else if (Array.isArray(character.rollGroups)) {
        const newGrp = { id: newId, name: cleanName, rolls: [] };
        await onUpdateCharacter(character.id, {
          rollGroups: [...rollGroups, newGrp]
        });
        setSelectedGroupId(newId);
      } else {
        await onUpdateCharacter(character.id, {
          [`rollGroups.${newId}`]: {
            id: newId,
            name: cleanName,
            order: rollGroups.length,
            rolls: {}
          }
        });
        setSelectedGroupId(newId);
      }
      setField("newGroupName", "");
    } catch (err) {
      dispatchRolls?.({
        type: "SET_ERROR",
        error: err?.message || "Erro ao criar grupo."
      });
    }
  };

  const handleAddCustomRollToGroup = async (e) => {
    e.preventDefault();
    if (!canEdit || !form.crName.trim()) return;
    const hasEffect = Boolean(form.crEffect.trim());
    const explicitRollKind = hasEffect
      ? inferAbilityRollKind({
          hitFormula: form.crHit.trim(),
          effectFormula: form.crEffect.trim(),
          effectType: form.crEffectType || "damage"
        })
      : form.crRollKind === ROLL_KINDS.CHECK
        ? ROLL_KINDS.CHECK
        : ROLL_KINDS.ATTACK;

    try {
      await pinToRollGroup(
        {
          name: form.crName.trim(),
          color: form.crColor || DEFAULT_COLORS.customRoll,
          icon: form.crIcon || "sword",
          hitFormula: form.crHit.trim(),
          effectFormula: form.crEffect.trim(),
          effectType: hasEffect ? form.crEffectType || "damage" : null,
          rollKind: explicitRollKind,
          costResource: form.crCostRes,
          costAmount: Number(form.crCostAmt) || 0
        },
        selectedGroupId
      );

      if (dispatchRolls) {
        dispatchRolls({ type: "RESET_CUSTOM_FORM" });
      } else if (rollsForm) {
        rollsForm.setCrName("");
        rollsForm.setCrEffect("");
        rollsForm.setCrEffectType("damage");
        rollsForm.setCrRollKind(ROLL_KINDS.ATTACK);
        rollsForm.setCrIcon("sword");
        rollsForm.setShowRollIconPicker(false);
        rollsForm.setNewCustomRollOpen(false);
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleConfirmDelete = async () => {
    const target = form.confirmDelete;
    if (!canEdit || !target) return;
    dispatchRolls?.({ type: "CLOSE_DELETE_CONFIRM" });

    try {
      if (target.kind === "group") {
        if (onRemoveCharacterEntry) {
          await onRemoveCharacterEntry(character.id, "rollGroups", target.groupId);
        } else if (Array.isArray(character.rollGroups)) {
          const next = rollGroups.filter((g) => g.id !== target.groupId);
          const removedRollIds = new Set(
            toSortedEntries(
              (rollGroups.find((g) => g.id === target.groupId) || {}).rolls
            ).map((r) => r.id)
          );
          const nextHotbar = (Array.isArray(character.hotbar) ? character.hotbar : []).map(
            (slot) => (slot?.rollId && removedRollIds.has(slot.rollId) ? null : slot)
          );
          await onUpdateCharacter(character.id, { rollGroups: next, hotbar: nextHotbar });
        }
        if (selectedGroupId === target.groupId) {
          const remaining = rollGroups.filter((g) => g.id !== target.groupId);
          setSelectedGroupId(remaining[0]?.id || "");
        }
        return;
      }

      if (onRemoveCharacterEntry) {
        await onRemoveCharacterEntry(character.id, "rolls", target.rollId, {
          rollGroupId: target.groupId
        });
      } else if (Array.isArray(character.rollGroups)) {
        const next = rollGroups.map((g) =>
          g.id === target.groupId
            ? {
                ...g,
                rolls: toSortedEntries(g.rolls).filter((r) => r.id !== target.rollId)
              }
            : g
        );
        const nextHotbar = (Array.isArray(character.hotbar) ? character.hotbar : []).map(
          (s) => (s?.rollId === target.rollId ? null : s)
        );
        await onUpdateCharacter(character.id, { rollGroups: next, hotbar: nextHotbar });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleMoveRollOrder = async (groupId, index, direction) => {
    if (!canEdit) return;
    const grp = rollGroups.find((g) => g.id === groupId);
    if (!grp) return;
    const list = toSortedEntries(grp.rolls);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const reordered = [...list];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    try {
      if (onReorderCharacterEntries) {
        await onReorderCharacterEntries(
          character.id,
          "rolls",
          reordered.map((r) => r.id),
          { rollGroupId: groupId }
        );
        return;
      }

      if (Array.isArray(character.rollGroups)) {
        const next = rollGroups.map((g) =>
          g.id === groupId ? { ...g, rolls: reordered } : g
        );
        await onUpdateCharacter(character.id, { rollGroups: next });
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
        gap: "10px"
      }}
    >
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
          <form onSubmit={handleCreateRollGroup} style={{ display: "flex", gap: "4px" }}>
            <input
              type="text"
              className="cp-input"
              style={{ width: "140px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              placeholder="Novo grupo..."
              value={form.newGroupName}
              onChange={(e) => setField("newGroupName", e.target.value)}
            />
            <button
              type="submit"
              className="cp-btn"
              style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            >
              + Grupo
            </button>
          </form>

          <button
            type="button"
            className="cp-btn cp-btn-green"
            style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            onClick={() => {
              if (dispatchRolls) {
                dispatchRolls({ type: "TOGGLE_CUSTOM_ROLL" });
              } else if (rollsForm) {
                rollsForm.setNewCustomRollOpen((p) => !p);
                if (form.importFromSheetOpen) rollsForm.setImportFromSheetOpen(false);
              }
            }}
          >
            + Nova Rolagem
          </button>

          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            onClick={() => {
              if (dispatchRolls) {
                dispatchRolls({ type: "TOGGLE_IMPORT_SHEET" });
              } else if (rollsForm) {
                rollsForm.setImportFromSheetOpen((p) => !p);
                if (form.newCustomRollOpen) rollsForm.setNewCustomRollOpen(false);
              }
            }}
            title="Criar rolagem a partir de uma perícia ou habilidade da ficha"
          >
            + Da Ficha (Perícias/Magias)
          </button>
        </div>
      )}

      {form.importFromSheetOpen && canEdit && (
        <div
          style={{
            background: "#f0f6fc",
            border: "2px solid #eab308",
            borderRadius: "10px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <strong style={{ fontSize: "12px", color: "#003264" }}>
                Criar Rolagem a partir da Ficha
              </strong>
              <span style={{ fontSize: "11px", color: "#475569" }}>no Grupo:</span>
              <select
                className="cp-input"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                style={{ fontSize: "11px", padding: "2px 6px" }}
              >
                {rollGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="cp-btn cp-btn-orange"
              style={{ padding: "1px 6px", fontSize: "10px" }}
              onClick={() => setField("importFromSheetOpen", false)}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "#ffffff", padding: "6px", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#02529c", marginBottom: "4px" }}>
                Perícias ({skills.length})
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                {skills.length === 0 ? (
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Nenhuma perícia na ficha</div>
                ) : (
                  skills.map((sk) => {
                    const skKey = sk.key || sk.id;
                    const formula = sk.formula || buildSkillFormula(sk);
                    return (
                      <div
                        key={skKey}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "3px 6px",
                          background: "#f8fafc",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0"
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: "4px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {sk.name}
                          </div>
                          <div style={{ fontSize: "9px", color: "#64748b" }}>{formula}</div>
                        </div>
                        <button
                          type="button"
                          className="cp-btn cp-btn-green"
                          style={{ padding: "2px 6px", fontSize: "9px" }}
                          onClick={() =>
                            pinToRollGroup(
                              {
                                sourceType: "skill",
                                sourceId: skKey,
                                name: sk.name,
                                color: "#3090f0",
                                icon: sk.icon || "clover",
                                hitFormula: formula,
                                effectFormula: "",
                                rollKind: ROLL_KINDS.CHECK,
                                costResource: "mp",
                                costAmount: 0
                              },
                              selectedGroupId
                            )
                          }
                        >
                          + Rolagem
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ background: "#ffffff", padding: "6px", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#e53935", marginBottom: "4px" }}>
                Habilidades & Magias ({abilities.length})
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                {abilities.length === 0 ? (
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Nenhuma habilidade na ficha</div>
                ) : (
                  abilities.map((ab) => (
                    <div
                      key={ab.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "3px 6px",
                        background: "#f8fafc",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0"
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: "4px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {ab.name}
                        </div>
                        <div style={{ fontSize: "9px", color: "#64748b" }}>
                          {ab.hitFormula || "1d20"} {ab.effectFormula ? `| ${ab.effectFormula}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cp-btn cp-btn-green"
                        style={{ padding: "2px 6px", fontSize: "9px" }}
                        onClick={() => {
                          const effType = ab.effectType || "damage";
                          const abRollKind = inferAbilityRollKind({
                            hitFormula: ab.hitFormula || "",
                            effectFormula: ab.effectFormula || "",
                            effectType: effType
                          });
                          pinToRollGroup(
                            {
                              sourceType: "ability",
                              sourceId: ab.id,
                              name: ab.name,
                              color: ab.elementColor || "#e53935",
                              icon: ab.icon || "sword",
                              hitFormula: ab.hitFormula ?? "",
                              effectFormula: ab.effectFormula || "",
                              effectType: effType,
                              rollKind: abRollKind,
                              range: ab.range || null,
                              aoe: ab.aoe || null,
                              trigger: ab.trigger || "active",
                              savingThrow: ab.savingThrow || null,
                              costResource: ab.cost?.resource || "mp",
                              costAmount: Number(ab.cost?.amount) || 0
                            },
                            selectedGroupId
                          );
                        }}
                      >
                        + Rolagem
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {form.newCustomRollOpen && canEdit && (
        <form
          onSubmit={handleAddCustomRollToGroup}
          style={{
            background: "#f0f6fc",
            border: "2px solid #008be3",
            borderRadius: "10px",
            padding: "8px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px"
          }}
        >
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input
              type="text"
              className="cp-input"
              placeholder="Título da Rolagem"
              value={form.crName}
              onChange={(e) => setField("crName", e.target.value)}
              required
              style={{ fontSize: "11px", padding: "3px 6px", flex: 1 }}
            />
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setField("showRollIconPicker", !form.showRollIconPicker)}
                title="Escolher Ícone da Rolagem"
              >
                {renderCpFlashIcon(form.crIcon, 18)}
              </button>
              {form.showRollIconPicker && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    zIndex: 150,
                    width: "320px"
                  }}
                >
                  <CpIconPicker
                    selectedIconId={form.crIcon}
                    onSelectIcon={(ic) => {
                      setField("crIcon", ic);
                      setField("showRollIconPicker", false);
                    }}
                    onClose={() => setField("showRollIconPicker", false)}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "4px" }}>
            <select
              className="cp-input"
              value={selectedGroupId || ""}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              style={{ fontSize: "11px", padding: "2px" }}
            >
              {rollGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input
              type="color"
              className="cp-input"
              style={{ width: "36px", padding: "1px", height: "24px" }}
              value={form.crColor}
              onChange={(e) => setField("crColor", e.target.value)}
            />
          </div>

          <input
            type="text"
            className="cp-input"
            placeholder="Fórmula 1 (ex: 1d20 + @forca)"
            value={form.crHit}
            onChange={(e) => setField("crHit", e.target.value)}
            required
            style={{ fontSize: "11px", padding: "3px 6px" }}
          />
          <input
            type="text"
            className="cp-input"
            placeholder="Fórmula 2 (ex: 2d6 + @forca)"
            value={form.crEffect}
            onChange={(e) => setField("crEffect", e.target.value)}
            style={{ fontSize: "11px", padding: "3px 6px" }}
          />

          {!form.crEffect.trim() && (
            <select
              className="cp-input"
              value={
                form.crRollKind === ROLL_KINDS.CHECK
                  ? ROLL_KINDS.CHECK
                  : ROLL_KINDS.ATTACK
              }
              onChange={(e) => setField("crRollKind", e.target.value)}
              style={{ fontSize: "11px", padding: "2px" }}
            >
              <option value={ROLL_KINDS.ATTACK}>Ataque</option>
              <option value={ROLL_KINDS.CHECK}>Teste</option>
            </select>
          )}

          <div style={{ display: "flex", gap: "4px" }}>
            <select
              className="cp-input"
              value={form.crCostRes}
              onChange={(e) => setField("crCostRes", e.target.value)}
              style={{ fontSize: "11px", padding: "2px" }}
            >
              <option value="mp">Custo MP</option>
              <option value="hp">Custo HP</option>
            </select>
            <input
              type="number"
              className="cp-input"
              placeholder="Qtd"
              min={0}
              value={form.crCostAmt}
              onChange={(e) => setField("crCostAmt", Number(e.target.value) || 0)}
              style={{ fontSize: "11px", padding: "2px 4px", width: "50px" }}
            />
            <select
              className="cp-input"
              value={form.crEffectType}
              onChange={(e) => setField("crEffectType", e.target.value)}
              style={{ fontSize: "11px", padding: "2px", flex: 1 }}
            >
              {EFFECT_TYPES.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="cp-btn cp-btn-green"
            style={{ padding: "3px", fontSize: "11px" }}
          >
            Salvar no Grupo
          </button>
        </form>
      )}

      {form.formError && (
        <div role="alert" style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
          {form.formError}
        </div>
      )}

      {rollGroups.map((grp) => {
        const groupRolls = toSortedEntries(grp.rolls);
        return (
          <div
            key={grp.id}
            style={{
              background: "#ffffff",
              border: "2px solid #cbd5e1",
              borderRadius: "10px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "13px", color: "#003264" }}>{grp.name}</strong>
              {canEdit && (
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{ padding: "1px 6px", fontSize: "10px" }}
                  onClick={() =>
                    dispatchRolls?.({
                      type: "OPEN_DELETE_CONFIRM",
                      payload: { kind: "group", groupId: grp.id, label: grp.name }
                    })
                  }
                >
                  Excluir Grupo
                </button>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: "6px"
              }}
            >
              {groupRolls.map((r, idx) => {
                const resolvedRoll = resolveDynamicRollEntry(r, character) || r;
                const resolvedWithGroup = { ...resolvedRoll, rollGroupId: grp.id };
                const slotIdx = findHotbarSlotIndexForRoll(character.hotbar, r.id);
                const hasAoe = Boolean(
                  resolvedRoll.aoe?.type && resolvedRoll.aoe.type !== "single"
                );
                const sourceSkillId =
                  resolvedRoll.source?.id || resolvedRoll.sourceId || resolvedRoll.id;

                return (
                  <div
                    key={r.id}
                    style={{
                      border: `2.5px solid ${resolvedRoll.color || "#3090f0"}`,
                      borderRadius: "8px",
                      padding: "6px",
                      background: "#f8fafc",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "4px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{
                          width: "26px",
                          height: "26px",
                          padding: "1px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          background: "#ffffff",
                          border: `1.5px solid ${resolvedRoll.color || "#008be3"}`,
                          borderRadius: "8px",
                          cursor: canEdit ? "pointer" : "default"
                        }}
                        onClick={() => {
                          if (canEdit) {
                            setField("editingRollIconTarget", {
                              roll: resolvedRoll,
                              groupId: grp.id
                            });
                          }
                        }}
                        title={
                          canEdit
                            ? "Clique para alterar o ícone desta rolagem"
                            : resolvedRoll.name
                        }
                      >
                        {renderCpFlashIcon(resolvedRoll.icon || "sword", 20)}
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong
                          style={{
                            fontSize: "12px",
                            color: "#1e293b",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {resolvedRoll.isLinkedMissing && (
                            <span
                              title="Origem removida da ficha"
                              style={{ marginRight: "3px" }}
                            >
                              ⚠️
                            </span>
                          )}
                          {resolvedRoll.name}
                        </strong>
                        <div
                          style={{
                            fontFamily: "var(--font-epf)",
                            fontSize: "10px",
                            color: "#475569"
                          }}
                        >
                          {resolvedRoll.hitFormula || resolvedRoll.effectFormula || "1d20"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="cp-btn cp-btn-gold"
                        style={{ flex: 1, padding: "3px", fontSize: "10px", height: "24px" }}
                        onClick={() =>
                          triggerRoll(buildShortcutRollParams(resolvedRoll, character) || {})
                        }
                      >
                        🎲 Rolar
                      </button>
                      {hasAoe && (
                        <button
                          type="button"
                          className="cp-btn"
                          style={{ padding: "3px 5px", fontSize: "10px", height: "24px" }}
                          onClick={() =>
                            handleDemarcateArea({
                              ...resolvedRoll,
                              id: sourceSkillId
                            })
                          }
                          title="Demarcar Área no Mapa"
                        >
                          🎯
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            className={`cp-btn ${slotIdx !== -1 ? "cp-btn-green" : ""}`}
                            style={{ padding: "3px 5px", fontSize: "10px", height: "24px" }}
                            onClick={() => setField("hotbarModalRoll", resolvedWithGroup)}
                            title={
                              slotIdx !== -1
                                ? `Atalho no Slot ${slotIdx + 1} da Hotbar (Bola de Neve)`
                                : "Configurar atalho na Hotbar (Bola de Neve)"
                            }
                          >
                            ❄️{slotIdx !== -1 ? `${slotIdx + 1}` : ""}
                          </button>
                          <button
                            type="button"
                            className="cp-btn"
                            style={{ padding: "2px 4px", fontSize: "9px" }}
                            disabled={idx === 0}
                            onClick={() => handleMoveRollOrder(grp.id, idx, -1)}
                            title="Mover para cima"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="cp-btn"
                            style={{ padding: "2px 4px", fontSize: "9px" }}
                            disabled={idx === groupRolls.length - 1}
                            onClick={() => handleMoveRollOrder(grp.id, idx, 1)}
                            title="Mover para baixo"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="cp-btn cp-btn-orange"
                            style={{ padding: "2px 4px", fontSize: "9px" }}
                            onClick={() =>
                              dispatchRolls?.({
                                type: "OPEN_DELETE_CONFIRM",
                                payload: {
                                  kind: "roll",
                                  groupId: grp.id,
                                  rollId: r.id,
                                  label: resolvedRoll.name
                                }
                              })
                            }
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
        );
      })}

      {form.confirmDelete && (
        <ConfirmDialog
          title={
            form.confirmDelete.kind === "group"
              ? "Excluir grupo de rolagens?"
              : "Excluir atalho?"
          }
          question={`Remover "${form.confirmDelete.label}"?`}
          confirmLabel="Excluir"
          onConfirm={handleConfirmDelete}
          onCancel={() => dispatchRolls?.({ type: "CLOSE_DELETE_CONFIRM" })}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </div>
  );
}
