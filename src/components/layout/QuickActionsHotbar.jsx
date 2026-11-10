import { useEffect, useMemo, useRef, useState } from "react";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

export default function QuickActionsHotbar({
  character,
  onExecuteRoll,
  onUpdateCharacter,
  onOpenSheet,
  onClose
}) {
  const containerRef = useRef(null);
  const [pickingSlotIndex, setPickingSlotIndex] = useState(null);

  // Fecha ao clicar fora do componente
  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [onClose]);

  // Lista consolidada de todas as rolagens disponíveis na ficha
  const allRolls = useMemo(() => {
    const rollGroups = Array.isArray(character?.rollGroups) ? character.rollGroups : [];
    const list = [];
    for (const grp of rollGroups) {
      for (const r of grp.rolls || []) {
        list.push({ ...r, groupName: grp.name });
      }
    }
    return list;
  }, [character]);

  // Garante array de 9 posições
  const hotbarSlots = useMemo(() => {
    const raw = Array.isArray(character?.hotbar) ? character.hotbar : [];
    const slots = [];
    for (let i = 0; i < 9; i++) {
      slots.push(raw[i] || null);
    }
    return slots;
  }, [character]);

  const handleRollSlot = (slotData) => {
    if (!slotData) return;
    const latest = allRolls.find((r) => r.id === slotData.rollId) || slotData;
    const costAmt = Number(latest.costAmount) || 0;
    onExecuteRoll({
      title: latest.name,
      categoryColor: latest.color || "#02529c",
      primaryFormula: latest.hitFormula || "",
      primaryLabel: latest.effectFormula ? "Acerto" : "Rolagem",
      rollKind: "attack",
      secondaryFormula: latest.effectFormula || "",
      secondaryLabel: "Efeito / Dano",
      character,
      cost: costAmt > 0 ? { resource: latest.costResource || "mp", amount: costAmt } : null,
      costResource: latest.costResource,
      costAmount: latest.costAmount,
      effectType: latest.effectType || (latest.effectFormula ? "damage" : null),
      savingThrow: latest.savingThrow || null,
      icon: latest.icon || slotData.icon || latest.name
    });
    onClose?.();
  };

  const handleAssignRoll = (roll, slotIdx) => {
    if (!character || !onUpdateCharacter) return;
    const next = [...hotbarSlots];
    next[slotIdx] = {
      rollId: roll.id,
      name: roll.name,
      color: roll.color || "#02529c",
      icon: roll.icon || roll.name,
      hitFormula: roll.hitFormula || "1d20",
      effectFormula: roll.effectFormula || "",
      costResource: roll.costResource || "mp",
      costAmount: roll.costAmount || 0,
      effectType: roll.effectType || "damage",
      savingThrow: roll.savingThrow || null
    };
    onUpdateCharacter(character.id, { hotbar: next });
    setPickingSlotIndex(null);
  };

  const handleClearSlot = (slotIdx, e) => {
    e.stopPropagation();
    if (!character || !onUpdateCharacter) return;
    const next = [...hotbarSlots];
    next[slotIdx] = null;
    onUpdateCharacter(character.id, { hotbar: next });
  };

  if (!character) {
    return (
      <div ref={containerRef} className="cp-hotbar-popup" style={{ width: "200px" }}>
        <div style={{ textAlign: "center", padding: "8px 4px", fontSize: "12px", color: "#334155" }}>
          Nenhuma ficha ativa
        </div>
        {/* Seta indicadora voltada para a bola de neve */}
        <div className="cp-hotbar-arrow">
          <svg width="18" height="10" viewBox="0 0 18 10" style={{ display: "block" }}>
            <polygon points="1,-2 17,-2 9,10" fill="#ffffff" />
            <polyline
              points="1,0 9,10 17,0"
              fill="none"
              stroke="#001b3a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="cp-hotbar-popup" onClick={(e) => e.stopPropagation()}>
      {/* Seletor de rolagem quando um slot vazio é clicado */}
      {pickingSlotIndex !== null ? (
        <div style={{ width: "210px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: 800, color: "#001b3a" }}>
              Slot {pickingSlotIndex + 1}
            </span>
            <button
              type="button"
              className="cp-btn cp-btn-orange"
              style={{ padding: "1px 6px", fontSize: "10px" }}
              onClick={() => setPickingSlotIndex(null)}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              maxHeight: "180px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              paddingRight: "2px"
            }}
          >
            {allRolls.length === 0 ? (
              <div style={{ padding: "8px", textAlign: "center", fontSize: "11px", color: "#64748b" }}>
                Sem rolagens na ficha
                <button
                  type="button"
                  className="cp-btn cp-btn-green"
                  style={{ width: "100%", marginTop: "6px", fontSize: "11px" }}
                  onClick={() => {
                    onOpenSheet(character.id);
                    onClose();
                  }}
                >
                  Abrir Ficha
                </button>
              </div>
            ) : (
              allRolls.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleAssignRoll(r, pickingSlotIndex)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 6px",
                    background: "#f8fafc",
                    border: `1.5px solid ${r.color || "#cbd5e1"}`,
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#e0f2fe")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
                >
                  <div style={{ width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {renderCpFlashIcon(r.icon || r.name, 20)}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>
                      {r.hitFormula || "1d20"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Grade 3x3 de Ações Rápidas */
        <div className="cp-hotbar-grid">
          {hotbarSlots.map((slot, idx) => {
            if (!slot) {
              return (
                <button
                  key={idx}
                  type="button"
                  className="cp-hotbar-slot empty"
                  onClick={() => setPickingSlotIndex(idx)}
                  title={`Slot ${idx + 1} (Clique para configurar)`}
                >
                  <span style={{ fontSize: "16px", color: "#94a3b8", fontWeight: 900 }}>+</span>
                </button>
              );
            }

            const latest = allRolls.find((r) => r.id === slot.rollId) || slot;
            const tooltip = `${latest.name}\n${latest.hitFormula || "1d20"}${latest.effectFormula ? ` | ${latest.effectFormula}` : ""}`;

            return (
              <div
                key={idx}
                className="cp-hotbar-slot occupied"
                onClick={() => handleRollSlot(slot)}
                title={tooltip}
                style={{
                  borderColor: latest.color || "#008be3"
                }}
              >
                <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {renderCpFlashIcon(latest.icon || latest.name, 30)}
                </div>

                {/* Botão sutil de desvincular no topo */}
                <button
                  type="button"
                  className="cp-hotbar-slot-remove"
                  onClick={(e) => handleClearSlot(idx, e)}
                  title="Remover atalho"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Seta indicadora voltada para a bola de neve */}
      <div className="cp-hotbar-arrow">
        <svg width="18" height="10" viewBox="0 0 18 10" style={{ display: "block" }}>
          <polygon points="1,-2 17,-2 9,10" fill="#ffffff" />
          <polyline
            points="1,0 9,10 17,0"
            fill="none"
            stroke="#001b3a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
