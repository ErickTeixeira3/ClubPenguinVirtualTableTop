import { useState } from "react";

/**
 * Fase 5: estados da aba Rolagens & Ações (novo grupo, rolagem personalizada, importação da ficha,
 * modal da Hotbar e modal de ícone). Chamado pela Ficha na mesma posição dos useState originais.
 */
export function useRollsFormState() {
  const [newGroupName, setNewGroupName] = useState("");
  const [newCustomRollOpen, setNewCustomRollOpen] = useState(false);
  const [crName, setCrName] = useState("");
  const [crIcon, setCrIcon] = useState("sword");
  const [showRollIconPicker, setShowRollIconPicker] = useState(false);
  const [crColor, setCrColor] = useState("#3090f0");
  const [crHit, setCrHit] = useState("1d20 + @forca");
  const [crEffect, setCrEffect] = useState("");
  const [crEffectType, setCrEffectType] = useState("damage");
  // Fase 6.3 (A15): tipo explícito da rolagem personalizada só de acerto ("attack" | "check")
  const [crRollKind, setCrRollKind] = useState("attack");
  const [crSaveEnabled, setCrSaveEnabled] = useState(false);
  const [crSaveDc, setCrSaveDc] = useState("12");
  const [crSaveAttr, setCrSaveAttr] = useState("resistencia");
  const [crSaveDesc, setCrSaveDesc] = useState("");
  const [crCostRes, setCrCostRes] = useState("mp");
  const [crCostAmt, setCrCostAmt] = useState(0);
  const [hotbarModalRoll, setHotbarModalRoll] = useState(null);
  const [importFromSheetOpen, setImportFromSheetOpen] = useState(false);
  const [editingRollIconTarget, setEditingRollIconTarget] = useState(null);

  return {
    newGroupName,
    setNewGroupName,
    newCustomRollOpen,
    setNewCustomRollOpen,
    crName,
    setCrName,
    crIcon,
    setCrIcon,
    showRollIconPicker,
    setShowRollIconPicker,
    crColor,
    setCrColor,
    crHit,
    setCrHit,
    crEffect,
    setCrEffect,
    crEffectType,
    setCrEffectType,
    crRollKind,
    setCrRollKind,
    crSaveEnabled,
    setCrSaveEnabled,
    crSaveDc,
    setCrSaveDc,
    crSaveAttr,
    setCrSaveAttr,
    crSaveDesc,
    setCrSaveDesc,
    crCostRes,
    setCrCostRes,
    crCostAmt,
    setCrCostAmt,
    hotbarModalRoll,
    setHotbarModalRoll,
    importFromSheetOpen,
    setImportFromSheetOpen,
    editingRollIconTarget,
    setEditingRollIconTarget
  };
}
