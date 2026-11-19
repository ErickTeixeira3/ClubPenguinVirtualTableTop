import { useRef } from "react";
import { Z_LAYERS } from "../../../constants/zLayers";
import { inferAbilityRollKind } from "../../../engines/rolls";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";
import { resolveItemIcon } from "../sheetConstants";

/**
 * Aba "Inventário" da Ficha (grade estilo Club Penguin, inspetor por ID e confirmação U6).
 */
export default function SheetInventoryTab({
  inventory,
  inspectedItemId,
  inspectedIconPickerOpen,
  confirmDeleteItem,
  dispatchInventory,
  canEdit,
  triggerRoll,
  pinToRollGroup,
  onUpdateCharacter,
  onUpdateCharacterEntry = null,
  onRemoveCharacterEntry = null,
  onConsumeCharacterItem = null,
  character
}) {
  const inventoryScrollRef = useRef(null);
  const usingItemRef = useRef(false);

  const inspectedItem =
    inventory.find((it) => it.id === inspectedItemId) || null;

  const handleUpdateItemIcon = async (itemId, newIcon) => {
    if (!canEdit) return;
    try {
      if (onUpdateCharacterEntry) {
        await onUpdateCharacterEntry(character.id, "inventory", itemId, { icon: newIcon });
      } else if (Array.isArray(character.inventory)) {
        await onUpdateCharacter(character.id, {
          inventory: inventory.map((it) =>
            it.id === itemId ? { ...it, icon: newIcon } : it
          )
        });
      } else {
        await onUpdateCharacter(character.id, { [`inventory.${itemId}.icon`]: newIcon });
      }
      dispatchInventory({
        type: "SET_FIELD",
        field: "inspectedIconPickerOpen",
        value: false
      });
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleAdjustItemQty = async (itemId, delta) => {
    if (!canEdit) return;
    const target = inventory.find((it) => it.id === itemId);
    if (!target) return;

    try {
      if (delta < 0 && onConsumeCharacterItem && (Number(target.qty) || 0) >= Math.abs(delta)) {
        await onConsumeCharacterItem(character.id, itemId, Math.abs(delta));
        if ((Number(target.qty) || 0) - Math.abs(delta) <= 0) {
          dispatchInventory({ type: "CLEAR_INSPECTED" });
        }
        return;
      }

      const nextQty = Math.max(0, (Number(target.qty) || 0) + delta);
      if (nextQty <= 0) {
        if (onRemoveCharacterEntry) {
          await onRemoveCharacterEntry(character.id, "inventory", itemId);
        } else if (Array.isArray(character.inventory)) {
          await onUpdateCharacter(character.id, {
            inventory: inventory.filter((it) => it.id !== itemId)
          });
        }
        dispatchInventory({ type: "CLEAR_INSPECTED" });
        return;
      }

      if (onUpdateCharacterEntry) {
        await onUpdateCharacterEntry(character.id, "inventory", itemId, { qty: nextQty });
      } else if (Array.isArray(character.inventory)) {
        await onUpdateCharacter(character.id, {
          inventory: inventory.map((it) =>
            it.id === itemId ? { ...it, qty: nextQty } : it
          )
        });
      } else {
        await onUpdateCharacter(character.id, { [`inventory.${itemId}.qty`]: nextQty });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleConfirmDeleteItem = async () => {
    if (!canEdit || !confirmDeleteItem) return;
    const itemId = confirmDeleteItem.id;
    dispatchInventory({ type: "CLOSE_DELETE_CONFIRM" });
    try {
      if (onRemoveCharacterEntry) {
        await onRemoveCharacterEntry(character.id, "inventory", itemId);
      } else if (Array.isArray(character.inventory)) {
        await onUpdateCharacter(character.id, {
          inventory: inventory.filter((it) => it.id !== itemId)
        });
      }
      if (inspectedItemId === itemId) {
        dispatchInventory({ type: "CLEAR_INSPECTED" });
      }
    } catch {
      // Erro já notificado pelo hook
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
            const isSelected = inspectedItemId === item.id;
            return (
              <div
                key={item.id}
                className="cp-inv-slot"
                onClick={() =>
                  dispatchInventory({ type: "TOGGLE_INSPECT_ITEM", itemId: item.id })
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

          {Array.from({ length: emptySlotsCount }).map((_, i) => (
            <div key={`empty_${i}`} className="cp-inv-slot empty" />
          ))}
        </div>

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
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  canEdit &&
                  dispatchInventory({
                    type: "SET_FIELD",
                    field: "inspectedIconPickerOpen",
                    value: !inspectedIconPickerOpen
                  })
                }
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
                      inspectedItem.rollKind ||
                      inferAbilityRollKind({
                        hitFormula: "",
                        effectFormula: inspectedItem.rollFormula || "1d20",
                        effectType: effType
                      });
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
                        inspectedItem.rollKind ||
                        inferAbilityRollKind({
                          hitFormula: "",
                          effectFormula: inspectedItem.rollFormula || "1d20",
                          effectType: effType
                        });
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
                    onClick={() =>
                      dispatchInventory({
                        type: "OPEN_DELETE_CONFIRM",
                        payload: { id: inspectedItem.id, label: inspectedItem.name }
                      })
                    }
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>

          {inspectedIconPickerOpen && canEdit && (
            <div style={{ marginTop: "4px" }}>
              <CpIconPicker
                selectedIconId={resolveItemIcon(inspectedItem)}
                onSelectIcon={(newIconId) =>
                  handleUpdateItemIcon(inspectedItem.id, newIconId)
                }
                onClose={() =>
                  dispatchInventory({
                    type: "SET_FIELD",
                    field: "inspectedIconPickerOpen",
                    value: false
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {confirmDeleteItem && (
        <ConfirmDialog
          title="Excluir item do inventário?"
          question={`Remover "${confirmDeleteItem.label}"?`}
          confirmLabel="Excluir"
          onConfirm={handleConfirmDeleteItem}
          onCancel={() => dispatchInventory({ type: "CLOSE_DELETE_CONFIRM" })}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </>
  );
}
