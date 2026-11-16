import { EFFECT_TYPES, ROLL_KINDS } from "../../../engines/combatEngine";
import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";
import { buildShortcutRollParams, resolveDynamicRollEntry } from "../../../services/rollService";

/**
 * Fase 5: aba "Rolagens & Ações" da Ficha (grupos de rolagens, importação da ficha e vínculo com a Hotbar),
 * extraída de CharacterSheetModal.jsx com JSX e handlers inalterados.
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
  rollsForm
}) {
  const { newGroupName, setNewGroupName, setNewCustomRollOpen, importFromSheetOpen, setImportFromSheetOpen, newCustomRollOpen, crName, setCrName, setShowRollIconPicker, crIcon, showRollIconPicker, setCrIcon, crColor, setCrColor, crHit, setCrHit, crEffect, setCrEffect, crCostRes, setCrCostRes, crCostAmt, setCrCostAmt, crEffectType, setCrEffectType, crRollKind, setCrRollKind, setEditingRollIconTarget, setHotbarModalRoll, crSaveEnabled, crSaveDc, crSaveAttr, crSaveDesc, setCrSaveEnabled, setCrSaveDc, setCrSaveAttr, setCrSaveDesc } = rollsForm;
  const handleCreateRollGroup = (e) => {
    e.preventDefault();
    if (!canEdit || !newGroupName.trim()) return;
    const newGrp = {
      id: `grp_${Date.now()}`,
      name: newGroupName.trim(),
      rolls: []
    };
    onUpdateCharacter(character.id, {
      rollGroups: [...rollGroups, newGrp]
    });
    setSelectedGroupId(newGrp.id);
    setNewGroupName("");
  };

  const handleDeleteRollGroup = (grpId) => {
    if (!canEdit) return;
    const next = rollGroups.filter((g) => g.id !== grpId);
    // Fase 3.1 (V-09a): limpa os slots da Hotbar que apontavam para rolagens deste grupo,
    // evitando slots órfãos que continuariam rolando a cópia antiga da fórmula.
    const removedRollIds = new Set(
      ((rollGroups.find((g) => g.id === grpId) || {}).rolls || []).map((r) => r.id)
    );
    const rawHotbar = Array.isArray(character.hotbar) ? [...character.hotbar] : [];
    const nextHotbar = rawHotbar.map((slot) =>
      slot?.rollId && removedRollIds.has(slot.rollId) ? null : slot
    );
    onUpdateCharacter(character.id, { rollGroups: next, hotbar: nextHotbar });
    if (selectedGroupId === grpId) {
      setSelectedGroupId(next[0]?.id || "");
    }
  };

  const handleAddCustomRollToGroup = (e) => {
    e.preventDefault();
    if (!canEdit || !crName.trim()) return;
    pinToRollGroup(
      {
        name: crName.trim(),
        color: crColor,
        icon: crIcon,
        hitFormula: crHit.trim(),
        effectFormula: crEffect.trim(),
        // Fase 3.1 (V-11): sem fórmula de efeito não há tipo de efeito (rolagem só de acerto = teste)
        effectType: crEffect.trim() ? crEffectType || "damage" : null,
        // Fase 6.3 (A15): só de acerto, o tipo é o escolhido (Ataque compara com a Defesa do alvo);
        // com efeito, o tipo continua inferido (acerto + efeito = ataque; só efeito = dano/cura).
        rollKind: crEffect.trim()
          ? null
          : crRollKind === ROLL_KINDS.CHECK
            ? ROLL_KINDS.CHECK
            : ROLL_KINDS.ATTACK,
        savingThrow: {
          enabled: Boolean(crSaveEnabled),
          dcFormula: crSaveDc.trim() || "12",
          attribute: crSaveAttr || "resistencia",
          effectDescription: crSaveDesc.trim()
        },
        costResource: crCostRes,
        costAmount: Number(crCostAmt) || 0
      },
      selectedGroupId
    );
    setCrName("");
    setCrEffect("");
    setCrEffectType("damage");
    setCrRollKind(ROLL_KINDS.ATTACK);
    setCrSaveEnabled(false);
    setCrSaveDc("12");
    setCrSaveAttr("resistencia");
    setCrSaveDesc("");
    setCrIcon("sword");
    setShowRollIconPicker(false);
    setNewCustomRollOpen(false);
  };

  const handleRemoveRollFromGroup = (groupId, rollId) => {
    if (!canEdit) return;
    const next = rollGroups.map((g) =>
      g.id === groupId
        ? { ...g, rolls: (g.rolls || []).filter((r) => r.id !== rollId) }
        : g
    );
    const rawHotbar = Array.isArray(character.hotbar) ? [...character.hotbar] : [];
    const nextHotbar = rawHotbar.map((s) => (s?.rollId === rollId ? null : s));
    onUpdateCharacter(character.id, { rollGroups: next, hotbar: nextHotbar });
  };

  const handleMoveRollOrder = (groupId, index, direction) => {
    if (!canEdit) return;
    const next = rollGroups.map((g) => {
      if (g.id !== groupId) return g;
      const list = [...(g.rolls || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return g;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...g, rolls: list };
    });
    onUpdateCharacter(character.id, { rollGroups: next });
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
          <form
            onSubmit={handleCreateRollGroup}
            style={{ display: "flex", gap: "4px" }}
          >
            <input
              type="text"
              className="cp-input"
              style={{ width: "140px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
              placeholder="Novo grupo..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
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
              setNewCustomRollOpen((p) => !p);
              if (importFromSheetOpen) setImportFromSheetOpen(false);
            }}
          >
            + Nova Rolagem
          </button>

          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            onClick={() => {
              setImportFromSheetOpen((p) => !p);
              if (newCustomRollOpen) setNewCustomRollOpen(false);
            }}
            title="Criar rolagem a partir de uma perícia ou habilidade da ficha"
          >
            + Da Ficha (Perícias/Magias)
          </button>
        </div>
      )}

      {/* Painel para criar rolagem a partir de Perícia, Habilidade ou Magia da Ficha */}
      {importFromSheetOpen && canEdit && (
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
              onClick={() => setImportFromSheetOpen(false)}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {/* Perícias */}
            <div style={{ background: "#ffffff", padding: "6px", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#02529c", marginBottom: "4px" }}>
                Perícias ({skills.length})
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                {skills.length === 0 ? (
                  <div style={{ fontSize: "10px", color: "#64748b" }}>Nenhuma perícia na ficha</div>
                ) : (
                  skills.map((sk) => (
                    <div
                      key={sk.id}
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
                        <div style={{ fontSize: "9px", color: "#64748b" }}>
                          {sk.formula || `1d20 + @${sk.attribute}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="cp-btn cp-btn-green"
                        style={{ padding: "2px 6px", fontSize: "9px" }}
                        onClick={() => {
                          pinToRollGroup(
                            {
                              sourceType: "skill",
                              sourceId: sk.id,
                              name: sk.name,
                              color: "#3090f0",
                              icon: sk.name.toLowerCase().includes("arco") ? "bow" : "clover",
                              hitFormula: sk.formula || `1d20 + @${sk.attribute || "forca"} + ${sk.bonus || 0}`,
                              effectFormula: "",
                              rollKind: ROLL_KINDS.CHECK,
                              costResource: "mp",
                              costAmount: 0
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

            {/* Habilidades & Magias */}
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
                          const abRollKind = ab.hitFormula
                            ? ROLL_KINDS.ATTACK
                            : ab.effectFormula
                              ? effType === "heal" || effType === "mp_heal"
                                ? ROLL_KINDS.HEAL
                                : effType === "utility"
                                  ? ROLL_KINDS.UTILITY
                                  : ROLL_KINDS.DAMAGE
                              : ROLL_KINDS.CHECK;
                          pinToRollGroup(
                            {
                              sourceType: "ability",
                              sourceId: ab.id,
                              name: ab.name,
                              color: ab.elementColor || "#e53935",
                              icon: ab.icon || ab.name,
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

      {newCustomRollOpen && canEdit && (
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
              value={crName}
              onChange={(e) => setCrName(e.target.value)}
              required
              style={{ fontSize: "11px", padding: "3px 6px", flex: 1 }}
            />
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={() => setShowRollIconPicker((prev) => !prev)}
                title="Escolher Ícone da Rolagem"
              >
                {renderCpFlashIcon(crIcon, 18)}
              </button>
              {showRollIconPicker && (
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
                    selectedIconId={crIcon}
                    onSelectIcon={(ic) => {
                      setCrIcon(ic);
                      setShowRollIconPicker(false);
                    }}
                    onClose={() => setShowRollIconPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <select
              className="cp-input"
              value={selectedGroupId}
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
              value={crColor}
              onChange={(e) => setCrColor(e.target.value)}
            />
          </div>
          <input
            type="text"
            className="cp-input"
            placeholder="Fórmula 1 (ex: 1d20 + @forca)"
            value={crHit}
            onChange={(e) => setCrHit(e.target.value)}
            required
            style={{ fontSize: "11px", padding: "3px 6px" }}
          />
          <input
            type="text"
            className="cp-input"
            placeholder="Fórmula 2 (ex: 2d6 + @forca)"
            value={crEffect}
            onChange={(e) => setCrEffect(e.target.value)}
            style={{ fontSize: "11px", padding: "3px 6px" }}
          />
          {!crEffect.trim() && (
            <select
              className="cp-input"
              value={crRollKind === ROLL_KINDS.CHECK ? ROLL_KINDS.CHECK : ROLL_KINDS.ATTACK}
              onChange={(e) => setCrRollKind(e.target.value)}
              style={{ fontSize: "11px", padding: "2px" }}
            >
              <option value={ROLL_KINDS.ATTACK}>Ataque</option>
              <option value={ROLL_KINDS.CHECK}>Teste</option>
            </select>
          )}
          <div style={{ display: "flex", gap: "4px" }}>
            <select
              className="cp-input"
              value={crCostRes}
              onChange={(e) => setCrCostRes(e.target.value)}
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
              value={crCostAmt}
              onChange={(e) => setCrCostAmt(Number(e.target.value) || 0)}
              style={{ fontSize: "11px", padding: "2px 4px", width: "50px" }}
            />
            <select
              className="cp-input"
              value={crEffectType}
              onChange={(e) => setCrEffectType(e.target.value)}
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

      {rollGroups.map((grp) => (
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
                onClick={() => handleDeleteRollGroup(grp.id)}
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
            {(grp.rolls || []).map((r, idx) => {
              const resolvedRoll = resolveDynamicRollEntry(r, character) || r;
              const hotbarList = Array.isArray(character.hotbar) ? character.hotbar : [];
              const slotIdx = hotbarList.findIndex((s) => s?.rollId === r.id);
              const hasAoe = Boolean(resolvedRoll.aoe?.type && resolvedRoll.aoe.type !== "single");

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
                        if (canEdit) setEditingRollIconTarget({ roll: resolvedRoll, groupId: grp.id });
                      }}
                      title={canEdit ? "Clique para alterar o ícone desta rolagem" : resolvedRoll.name}
                    >
                      {renderCpFlashIcon(resolvedRoll.icon || resolvedRoll.name, 20)}
                    </button>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: "12px", color: "#1e293b", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {resolvedRoll.isLinkedMissing && (
                          <span title="Origem removida da ficha" style={{ marginRight: "3px" }}>⚠️</span>
                        )}
                        {resolvedRoll.name}
                      </strong>
                      <div style={{ fontFamily: "var(--font-epf)", fontSize: "10px", color: "#475569" }}>
                        {resolvedRoll.hitFormula || resolvedRoll.effectFormula || "1d20"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                    <button
                      type="button"
                      className="cp-btn cp-btn-gold"
                      style={{ flex: 1, padding: "3px", fontSize: "10px", height: "24px" }}
                      onClick={() => {
                        // Fase 3.1 (V-03 / V-09b): montagem única (ROLL_KINDS.SAVE inexistente removido)
                        triggerRoll(buildShortcutRollParams(resolvedRoll, character) || {});
                      }}
                    >
                      🎲 Rolar
                    </button>
                    {hasAoe && (
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "3px 5px", fontSize: "10px", height: "24px" }}
                        onClick={() => handleDemarcateArea(resolvedRoll)}
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
                          onClick={() => setHotbarModalRoll(resolvedRoll)}
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
                          onClick={() => handleMoveRollOrder(grp.id, idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn-orange"
                          style={{ padding: "2px 4px", fontSize: "9px" }}
                          onClick={() => handleRemoveRollFromGroup(grp.id, r.id)}
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
      ))}
    </div>
  );
}
