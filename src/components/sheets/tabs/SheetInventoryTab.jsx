import { renderCpFlashIcon } from "../CpFlashIcons";
import { resolveItemIcon } from "../sheetConstants";
import { ROLL_KINDS } from "../../../engines/combatEngine";
import CpIconPicker from "../CpIconPicker";
import { useRef } from "react";

/**
 * Fase 5: aba "Inventário" da Ficha (grade estilo Club Penguin, rolagem vertical e inspetor do item),
 * extraída de CharacterSheetModal.jsx com JSX e handlers inalterados.
 */
export default function SheetInventoryTab({
  inventory,
  inspectedItem,
  setInspectedItem,
  canEdit,
  setInspectedIconPickerOpen,
  triggerRoll,
  pinToRollGroup,
  inspectedIconPickerOpen,
  onUpdateCharacter,
  character
}) {
  const inventoryScrollRef = useRef(null);
  const usingItemRef = useRef(false);

  const handleUpdateItemIcon = (itemId, newIcon) => {
    if (!canEdit) return;
    const nextInv = inventory.map((it) =>
      it.id === itemId ? { ...it, icon: newIcon } : it
    );
    onUpdateCharacter(character.id, { inventory: nextInv });
    if (inspectedItem?.id === itemId) {
      setInspectedItem((prev) => (prev ? { ...prev, icon: newIcon } : null));
    }
    setInspectedIconPickerOpen(false);
  };

  const handleAdjustItemQty = (itemId, delta) => {
    if (!canEdit) return;
    const nextInv = inventory
      .map((it) =>
        it.id === itemId
          ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) + delta) }
          : it
      )
      .filter((it) => it.qty > 0);
    onUpdateCharacter(character.id, { inventory: nextInv });
    if (inspectedItem?.id === itemId) {
      const updated = nextInv.find((it) => it.id === itemId);
      if (updated) {
        setInspectedItem(updated);
      } else {
        setInspectedItem(null);
      }
    }
  };

  const handleDeleteItem = (itemId) => {
    if (!canEdit) return;
    const nextInv = inventory.filter((it) => it.id !== itemId);
    onUpdateCharacter(character.id, { inventory: nextInv });
    if (inspectedItem?.id === itemId) {
      setInspectedItem(null);
    }
  };

  const scrollInventory = (delta) => {
    if (inventoryScrollRef.current) {
      inventoryScrollRef.current.scrollTop += delta;
    }
  };

  const emptySlotsCount = Math.max(0, 12 - inventory.length);

  return (
    <>
      <div className="cp-inv-grid-wrapper">
        <div className="cp-inv-grid" ref={inventoryScrollRef}>
          {inventory.map((item) => {
            const isSelected = inspectedItem?.id === item.id;
            return (
              <div
                key={item.id}
                className="cp-inv-slot"
                onClick={() =>
                  setInspectedItem((prev) =>
                    prev?.id === item.id ? null : item
                  )
                }
                style={{
                  borderColor: isSelected ? "#008be3" : "#b8c8d8",
                  background: isSelected ? "#f0f8ff" : "#ffffff",
                  boxShadow: isSelected
                    ? "0 0 0 2px #008be3, 0 4px 8px rgba(0,139,227,0.25)"
                    : undefined
                }}
                title={item.name}
              >
                {/* Ícone do Item (estilo vetorial Flash Club Penguin) */}
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    userSelect: "none",
                    filter: "drop-shadow(0 2px 3px rgba(0, 27, 58, 0.2))"
                  }}
                >
                  {renderCpFlashIcon(resolveItemIcon(item), 40)}
                </div>

                {/* Nome do Item */}
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#1a365d",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                    marginTop: "2px"
                  }}
                >
                  {item.name}
                </span>

                {/* Badge de Quantidade (estilo x2 no canto do item) */}
                {item.qty > 1 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "6px",
                      background: "#008be3",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 900,
                      padding: "1px 5px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                    }}
                  >
                    x{item.qty}
                  </span>
                )}
              </div>
            );
          })}

          {/* Slots Vazios adicionais para preencher a grade estilo Club Penguin */}
          {Array.from({ length: emptySlotsCount }).map((_, i) => (
            <div key={`empty_${i}`} className="cp-inv-slot empty" />
          ))}
        </div>

        {/* Controles de Rolagem Vertical Clássicos do Club Penguin */}
        <div className="cp-inv-scroll-controls">
          <button
            type="button"
            className="cp-inv-scroll-btn"
            onClick={() => scrollInventory(-102)}
            title="Subir"
          >
            ▲
          </button>
          <div className="cp-inv-scroll-track" />
          <button
            type="button"
            className="cp-inv-scroll-btn"
            onClick={() => scrollInventory(102)}
            title="Descer"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Painel Flutuante de Inspeção do Item Selecionado no Inventário */}
      {inspectedItem && (
        <div
          style={{
            margin: "0 14px 6px 14px",
            background: "#f0f6fc",
            border: "2px solid #008be3",
            borderRadius: "12px",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            boxShadow: "0 3px 8px rgba(0,27,58,0.15)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
              {/* Ícone clicável para trocar no inspetor se canEdit */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && setInspectedIconPickerOpen((p) => !p)}
                title={canEdit ? "Trocar ícone do item" : ""}
                style={{
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffffff",
                  border: canEdit ? "1.5px dashed #008be3" : "1.5px solid #d4dde8",
                  borderRadius: "10px",
                  cursor: canEdit ? "pointer" : "default",
                  flexShrink: 0,
                  padding: 0
                }}
              >
                {renderCpFlashIcon(resolveItemIcon(inspectedItem), 36)}
              </button>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "13px", color: "#003264" }}>
                    {inspectedItem.name}
                  </strong>
                  {inspectedItem.rollFormula && (
                    <span
                      style={{
                        fontFamily: "var(--font-epf)",
                        fontSize: "11px",
                        color: "#1f8a4c",
                        fontWeight: 700
                      }}
                    >
                      [{inspectedItem.rollFormula}]
                    </span>
                  )}
                </div>
                {inspectedItem.description && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {inspectedItem.description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {canEdit && (
                <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "1px 6px", fontSize: "11px" }}
                    onClick={() => handleAdjustItemQty(inspectedItem.id, -1)}
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 800, fontSize: "12px", padding: "0 4px" }}>
                    x{inspectedItem.qty}
                  </span>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "1px 6px", fontSize: "11px" }}
                    onClick={() => handleAdjustItemQty(inspectedItem.id, 1)}
                  >
                    +
                  </button>
                </div>
              )}

              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={async () => {
                  if (usingItemRef.current) return;
                  usingItemRef.current = true;
                  try {
                    const effType = inspectedItem.effectType || "heal";
                    const itemRollKind =
                      effType === "heal" || effType === "mp_heal"
                        ? ROLL_KINDS.HEAL
                        : effType === "damage" || effType === "mp_damage"
                          ? ROLL_KINDS.DAMAGE
                          : effType === "utility"
                            ? ROLL_KINDS.UTILITY
                            : ROLL_KINDS.CHECK;
                    const rollAccepted = await triggerRoll({
                      title: `Item: ${inspectedItem.name}`,
                      categoryColor: "#38c172",
                      description: inspectedItem.description || "",
                      primaryFormula: inspectedItem.rollFormula || "1d20",
                      primaryLabel: "Uso / Efeito",
                      rollKind: itemRollKind,
                      trigger: inspectedItem.trigger || "active",
                      effectType: effType,
                      savingThrow: inspectedItem.savingThrow || null,
                      deferSecondaryDamage: false,
                      icon: resolveItemIcon(inspectedItem)
                    });
                    // Fase 6.4 (A23): só consome item se a rolagem não foi bloqueada (ex.: Modo de Turno)
                    if (rollAccepted !== false && inspectedItem.consumeOnUse) {
                      handleAdjustItemQty(inspectedItem.id, -1);
                    }
                  } finally {
                    usingItemRef.current = false;
                  }
                }}
              >
                🎲 Usar
              </button>

              {canEdit && (
                <>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    title="Fixar na aba Rolagens"
                    onClick={() => {
                      const effType = inspectedItem.effectType || "heal";
                      const itemRollKind =
                        effType === "heal" || effType === "mp_heal"
                          ? ROLL_KINDS.HEAL
                          : effType === "damage" || effType === "mp_damage"
                            ? ROLL_KINDS.DAMAGE
                            : effType === "utility"
                              ? ROLL_KINDS.UTILITY
                              : ROLL_KINDS.CHECK;
                      pinToRollGroup({
                        sourceType: "item",
                        sourceId: inspectedItem.id,
                        name: inspectedItem.name,
                        color: "#38c172",
                        hitFormula: inspectedItem.rollFormula || "1d20",
                        effectType: effType,
                        rollKind: itemRollKind,
                        trigger: inspectedItem.trigger || "active",
                        savingThrow: inspectedItem.savingThrow || null,
                        icon: resolveItemIcon(inspectedItem)
                      });
                    }}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="cp-btn cp-btn-orange"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    title="Excluir Item"
                    onClick={() => handleDeleteItem(inspectedItem.id)}
                  >
                    ✕
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setInspectedItem(null);
                  setInspectedIconPickerOpen(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "0 4px"
                }}
                title="Fechar detalhes"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Seletor aberto para trocar ícone do item inspecionado */}
          {inspectedIconPickerOpen && canEdit && (
            <CpIconPicker
              selectedIconId={resolveItemIcon(inspectedItem)}
              onSelectIcon={(ic) => handleUpdateItemIcon(inspectedItem.id, ic)}
              onClose={() => setInspectedIconPickerOpen(false)}
            />
          )}
        </div>
      )}
    </>
  );
}
