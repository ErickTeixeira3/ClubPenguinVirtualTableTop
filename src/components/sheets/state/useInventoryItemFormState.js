import { useState } from "react";

/**
 * Fase 5: estados do formulário de novo item do Inventário.
 * Chamado pela Ficha (CharacterSheetModal) na mesma posição dos useState originais.
 */
export function useInventoryItemFormState() {
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemFormula, setItemFormula] = useState("");
  const [itemTrigger, setItemTrigger] = useState("active");
  const [itemEffectType, setItemEffectType] = useState("heal");
  const [itemConsumeOnUse, setItemConsumeOnUse] = useState(true);
  const [itemSaveEnabled, setItemSaveEnabled] = useState(false);
  const [itemSaveDc, setItemSaveDc] = useState("12");
  const [itemSaveAttr, setItemSaveAttr] = useState("resistencia");
  const [itemSaveDesc, setItemSaveDesc] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemIcon, setItemIcon] = useState("sword");
  const [showIconPicker, setShowIconPicker] = useState(false);

  return {
    newItemOpen,
    setNewItemOpen,
    itemName,
    setItemName,
    itemQty,
    setItemQty,
    itemFormula,
    setItemFormula,
    itemTrigger,
    setItemTrigger,
    itemEffectType,
    setItemEffectType,
    itemConsumeOnUse,
    setItemConsumeOnUse,
    itemSaveEnabled,
    setItemSaveEnabled,
    itemSaveDc,
    setItemSaveDc,
    itemSaveAttr,
    setItemSaveAttr,
    itemSaveDesc,
    setItemSaveDesc,
    itemDesc,
    setItemDesc,
    itemIcon,
    setItemIcon,
    showIconPicker,
    setShowIconPicker
  };
}
