import { useEffect, useMemo, useRef, useState } from "react";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import {
  buildHotbarSlotFromRoll,
  buildShortcutRollParams,
  resolveDynamicRollEntry,
  resolveHotbarSlot
} from "../../services/rollService";

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

  // Lista consolidada e resolvida dinamicamente de todas as rolagens disponíveis na ficha
  const allRolls = useMemo(() => {
    const rollGroups = Array.isArray(character?.rollGroups) ? character.rollGroups : [];
    const list = [];
    for (const grp of rollGroups) {
      for (const r of grp.rolls || []) {
        const resolved = resolveDynamicRollEntry(r, character) || r;
        list.push({ ...resolved, groupName: grp.name });
      }
    }
    return list;
  }, [character]);

  // Garante array de 9 posições já resolvidas dinamicamente contra a ficha atual
  const hotbarSlots = useMemo(() => {
    const raw = Array.isArray(character?.hotbar) ? character.hotbar : [];
    const slots = [];
    for (let i = 0; i < 9; i++) {
      slots.push(resolveHotbarSlot(raw[i], character));
    }
    return slots;
  }, [character]);

  const handleRollSlot = (slotData) => {
    if (!slotData) return;
    const latest = resolveHotbarSlot(slotData, character) || slotData;
    // Fase 3.1 (V-03 / V-09b): mesma montagem da aba Rolagens (ROLL_KINDS.SAVE inexistente removido)
    const params = buildShortcutRollParams(latest, character);
    onExecuteRoll({
      ...params,
      icon: latest.icon || slotData.icon || latest.name
    });
    onClose?.();
  };

  const handleRollSlotRef = useRef(handleRollSlot);
  useEffect(() => {
    handleRollSlotRef.current = handleRollSlot;
  });

  // Atalhos numéricos 1–9 e Escape enquanto a barra rápida está aberta.
  // Fase 3.1 (V-10): o listener roda na fase de CAPTURA do window e, quando consome a tecla,
  // interrompe a propagação — os listeners de bolha do tabuleiro (régua 1/2/3, Esc da mira)
  // não recebem a mesma tecla. Barra aberta tem prioridade sobre 1–9 e Esc.
  useEffect(() => {
    if (!character) return;
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (pickingSlotIndex !== null) {
          setPickingSlotIndex(null);
        } else {
          onClose?.();
        }
        return;
      }
      if (pickingSlotIndex === null && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const slot = hotbarSlots[idx];
        if (slot) {
          e.preventDefault();
          e.stopPropagation();
          handleRollSlotRef.current(slot);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [character, hotbarSlots, pickingSlotIndex, onClose]);

  const handleAssignRoll = (roll, slotIdx) => {
    if (!character || !onUpdateCharacter) return;
    const resolvedRoll = resolveDynamicRollEntry(roll, character) || roll;
    const next = Array.isArray(character?.hotbar) ? [...character.hotbar] : [];
    while (next.length < 9) next.push(null);
    // Fase 3.1 (V-09b): montagem única do slot (mesma da ficha)
    next[slotIdx] = buildHotbarSlotFromRoll(resolvedRoll);
    onUpdateCharacter(character.id, { hotbar: next });
    setPickingSlotIndex(null);
  };

  const handleClearSlot = (slotIdx, e) => {
    e.stopPropagation();
    if (!character || !onUpdateCharacter) return;
    const next = Array.isArray(character?.hotbar) ? [...character.hotbar] : [];
    while (next.length < 9) next.push(null);
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
                  title={`Slot ${idx + 1} (Tecla ${idx + 1})`}
                  style={{ position: "relative" }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: "5px",
                      fontSize: "9px",
                      fontWeight: 900,
                      color: "#94a3b8",
                      lineHeight: 1,
                      pointerEvents: "none"
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: "16px", color: "#94a3b8", fontWeight: 900 }}>+</span>
                </button>
              );
            }

            const latest = slot;
            const tooltip = `[${idx + 1}] ${latest.isLinkedMissing ? "⚠️ " : ""}${latest.name}\n${latest.hitFormula || "1d20"}${latest.effectFormula ? ` | ${latest.effectFormula}` : ""}`;

            return (
              <div
                key={idx}
                className="cp-hotbar-slot occupied"
                onClick={() => handleRollSlot(latest)}
                title={tooltip}
                style={{
                  position: "relative",
                  borderColor: latest.color || "#008be3"
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: "4px",
                    fontSize: "9px",
                    fontWeight: 900,
                    color: "#64748b",
                    lineHeight: 1,
                    pointerEvents: "none"
                  }}
                >
                  {idx + 1}
                </span>

                <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  {renderCpFlashIcon(latest.icon || latest.name, 30)}
                </div>

                {/* Fase 3.1 (V-09c): origem do atalho removida da ficha */}
                {latest.isLinkedMissing && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: "1px",
                      left: "3px",
                      fontSize: "10px",
                      lineHeight: 1,
                      pointerEvents: "none"
                    }}
                  >
                    ⚠️
                  </span>
                )}

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
