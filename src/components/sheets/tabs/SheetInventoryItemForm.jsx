import { DEFAULT_COLORS } from "../../../domain/defaults.js";
import { EFFECT_TYPES, TRIGGER_TYPES } from "../../../engines/combatEngine";
import { inferAbilityRollKind } from "../../../engines/rolls";
import SavingThrowFields from "../../ui/SavingThrowFields";
import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";

/**
 * Formulário inline de novo item do Inventário da Ficha (schema v2).
 */
export default function SheetInventoryItemForm({
  canEdit,
  onUpdateCharacter,
  onAddCharacterEntry = null,
  character,
  inventoryState,
  dispatchInventory
}) {
  const {
    itemIcon,
    itemName,
    itemQty,
    itemFormula,
    showIconPicker,
    itemTrigger,
    itemEffectType,
    itemConsumeOnUse,
    itemSaveEnabled,
    itemSaveDc,
    itemSaveAttr,
    itemSaveDesc,
    itemDesc,
    formError
  } = inventoryState;

  const setField = (field, value) =>
    dispatchInventory({ type: "SET_FIELD", field, value });

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!canEdit || !itemName.trim()) return;

    const cleanFormula = itemFormula.trim();
    const effType = itemEffectType || "heal";
    const payload = {
      ...(onAddCharacterEntry ? {} : { id: `inv_${Date.now()}` }),
      name: itemName.trim(),
      qty: Math.max(1, Number(itemQty) || 1),
      elementColor: DEFAULT_COLORS.itemElement,
      icon: itemIcon || "sword",
      rollFormula: cleanFormula,
      trigger: itemTrigger || "active",
      effectType: effType,
      rollKind: cleanFormula
        ? inferAbilityRollKind({
            hitFormula: "",
            effectFormula: cleanFormula,
            effectType: effType
          })
        : null,
      consumeOnUse: Boolean(itemConsumeOnUse),
      savingThrow: {
        enabled: Boolean(itemSaveEnabled),
        dcFormula: itemSaveDc.trim() || "12",
        attributeKey: itemSaveAttr || "resistencia",
        effectDescription: itemSaveDesc.trim()
      },
      description: itemDesc.trim()
    };

    try {
      if (onAddCharacterEntry) {
        await onAddCharacterEntry(character.id, "inventory", payload);
      } else if (Array.isArray(character.inventory)) {
        await onUpdateCharacter(character.id, {
          inventory: [...character.inventory, payload]
        });
      } else {
        const legacyKey = payload.id || `inv_${Date.now()}`;
        await onUpdateCharacter(character.id, {
          [`inventory.${legacyKey}`]: { ...payload, id: legacyKey }
        });
      }
      dispatchInventory({ type: "RESET_ITEM_FORM" });
    } catch (err) {
      dispatchInventory({
        type: "SET_ERROR",
        error: err?.message || "Erro ao adicionar item."
      });
    }
  };

  return (
    <form
      onSubmit={handleAddItem}
      style={{
        background: "#f0f6fc",
        border: "1.5px solid #008be3",
        borderRadius: "10px",
        margin: "6px 14px",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        position: "relative"
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 70px 1fr", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setField("showIconPicker", !showIconPicker)}
          title="Escolher Ícone"
          style={{
            width: "38px",
            height: "32px",
            background: "#ffffff",
            border: "1.5px solid #7a8c9e",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0
          }}
        >
          {renderCpFlashIcon(itemIcon, 26)}
        </button>
        <input
          type="text"
          className="cp-input"
          placeholder="Nome do Item..."
          value={itemName}
          onChange={(e) => setField("itemName", e.target.value)}
          required
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
        <input
          type="number"
          className="cp-input"
          min={1}
          placeholder="Qtd"
          value={itemQty}
          onChange={(e) => setField("itemQty", e.target.value)}
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
        <input
          type="text"
          className="cp-input"
          placeholder="Fórmula (ex: 2d4 + 2)"
          value={itemFormula}
          onChange={(e) => setField("itemFormula", e.target.value)}
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
      </div>

      {showIconPicker && (
        <CpIconPicker
          selectedIconId={itemIcon}
          onSelectIcon={(ic) => {
            setField("itemIcon", ic);
            setField("showIconPicker", false);
          }}
          onClose={() => setField("showIconPicker", false)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "6px", alignItems: "center" }}>
        <select
          className="cp-input"
          value={itemTrigger}
          onChange={(e) => setField("itemTrigger", e.target.value)}
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
          value={itemEffectType}
          onChange={(e) => setField("itemEffectType", e.target.value)}
          style={{ fontSize: "11px", padding: "3px 6px" }}
        >
          {EFFECT_TYPES.map((et) => (
            <option key={et.id} value={et.id}>
              {et.label}
            </option>
          ))}
        </select>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700, color: "#1e293b", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={itemConsumeOnUse}
            onChange={(e) => setField("itemConsumeOnUse", e.target.checked)}
          />
          Consumível
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <SavingThrowFields
          enabled={itemSaveEnabled}
          onEnabledChange={(val) => setField("itemSaveEnabled", val)}
          dcFormula={itemSaveDc}
          onDcFormulaChange={(val) => setField("itemSaveDc", val)}
          attributeKey={itemSaveAttr}
          onAttributeKeyChange={(val) => setField("itemSaveAttr", val)}
          effectDescription={itemSaveDesc}
          onEffectDescriptionChange={(val) => setField("itemSaveDesc", val)}
          toggleLabel="Exige Resistência"
          dcPlaceholder="CD (ex: 12)"
          effectPlaceholder="Efeito na falha..."
          dcWidth="80px"
          effectMinWidth="110px"
        />
      </div>

      <input
        type="text"
        className="cp-input"
        placeholder="Descrição / Efeito..."
        value={itemDesc}
        onChange={(e) => setField("itemDesc", e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      />

      {formError && (
        <div role="alert" style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
          {formError}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="cp-btn cp-btn-orange"
          style={{ padding: "3px 8px", fontSize: "11px" }}
          onClick={() => dispatchInventory({ type: "SET_FIELD", field: "newItemOpen", value: false })}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="cp-btn cp-btn-green"
          style={{ padding: "3px 10px", fontSize: "11px" }}
        >
          Adicionar Item
        </button>
      </div>
    </form>
  );
}
