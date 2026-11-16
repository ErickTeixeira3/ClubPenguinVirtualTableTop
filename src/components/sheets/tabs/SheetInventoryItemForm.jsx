import { renderCpFlashIcon } from "../CpFlashIcons";
import CpIconPicker from "../CpIconPicker";
import { EFFECT_TYPES, TRIGGER_TYPES } from "../../../engines/combatEngine";
import SavingThrowFields from "../../ui/SavingThrowFields";

/**
 * Fase 5: formulário inline de novo item do Inventário da Ficha,
 * extraído de CharacterSheetModal.jsx com JSX e handler inalterados.
 */
export default function SheetInventoryItemForm({
  canEdit,
  onUpdateCharacter,
  character,
  inventory,
  itemForm
}) {
  const { setShowIconPicker, itemIcon, itemName, setItemName, itemQty, setItemQty, itemFormula, setItemFormula, showIconPicker, setItemIcon, itemTrigger, setItemTrigger, itemEffectType, setItemEffectType, itemConsumeOnUse, setItemConsumeOnUse, itemSaveEnabled, setItemSaveEnabled, itemSaveDc, setItemSaveDc, itemSaveAttr, setItemSaveAttr, itemSaveDesc, setItemSaveDesc, itemDesc, setItemDesc, setNewItemOpen } = itemForm;
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!canEdit || !itemName.trim()) return;
    onUpdateCharacter(character.id, {
      inventory: [
        ...inventory,
        {
          id: `inv_${Date.now()}`,
          name: itemName.trim(),
          qty: Math.max(1, Number(itemQty) || 1),
          elementColor: "#38c172",
          icon: itemIcon || "sword",
          rollFormula: itemFormula.trim(),
          trigger: itemTrigger || "active",
          effectType: itemEffectType || "heal",
          consumeOnUse: Boolean(itemConsumeOnUse),
          savingThrow: {
            enabled: Boolean(itemSaveEnabled),
            dcFormula: itemSaveDc.trim() || "12",
            attribute: itemSaveAttr || "resistencia",
            effectDescription: itemSaveDesc.trim()
          },
          description: itemDesc.trim()
        }
      ]
    });
    setItemName("");
    setItemFormula("");
    setItemTrigger("active");
    setItemEffectType("heal");
    setItemConsumeOnUse(true);
    setItemSaveEnabled(false);
    setItemSaveDc("12");
    setItemSaveAttr("resistencia");
    setItemSaveDesc("");
    setItemDesc("");
    setItemIcon("sword");
    setShowIconPicker(false);
    setNewItemOpen(false);
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
          onClick={() => setShowIconPicker((p) => !p)}
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
          onChange={(e) => setItemName(e.target.value)}
          required
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
        <input
          type="number"
          className="cp-input"
          min={1}
          placeholder="Qtd"
          value={itemQty}
          onChange={(e) => setItemQty(e.target.value)}
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
        <input
          type="text"
          className="cp-input"
          placeholder="Fórmula (ex: 2d4 + 2)"
          value={itemFormula}
          onChange={(e) => setItemFormula(e.target.value)}
          style={{ fontSize: "11px", padding: "3px 6px" }}
        />
      </div>

      {/* Seletor de Ícones de RPG / Club Penguin */}
      {showIconPicker && (
        <CpIconPicker
          selectedIconId={itemIcon}
          onSelectIcon={(ic) => {
            setItemIcon(ic);
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "6px", alignItems: "center" }}>
        <select
          className="cp-input"
          value={itemTrigger}
          onChange={(e) => setItemTrigger(e.target.value)}
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
          onChange={(e) => setItemEffectType(e.target.value)}
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
            onChange={(e) => setItemConsumeOnUse(e.target.checked)}
          />
          Consumível
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        {/* Fase 4: SavingThrowFields (layout "inline") */}
        <SavingThrowFields
          enabled={itemSaveEnabled}
          onEnabledChange={setItemSaveEnabled}
          dcFormula={itemSaveDc}
          onDcFormulaChange={setItemSaveDc}
          attribute={itemSaveAttr}
          onAttributeChange={setItemSaveAttr}
          effectDescription={itemSaveDesc}
          onEffectDescriptionChange={setItemSaveDesc}
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
        onChange={(e) => setItemDesc(e.target.value)}
        style={{ fontSize: "11px", padding: "3px 6px" }}
      />
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="cp-btn cp-btn-orange"
          style={{ padding: "3px 8px", fontSize: "11px" }}
          onClick={() => {
            setShowIconPicker(false);
            setNewItemOpen(false);
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="cp-btn cp-btn-green"
          style={{ padding: "3px 12px", fontSize: "11px" }}
        >
          Salvar Item
        </button>
      </div>
    </form>
  );
}
