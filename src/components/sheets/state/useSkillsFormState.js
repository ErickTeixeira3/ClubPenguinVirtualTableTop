import { useState } from "react";

/**
 * Fase 5: estados dos formulários da aba Skills (nova perícia e nova/editar habilidade).
 * Chamado pela Ficha (CharacterSheetModal) na mesma posição dos useState originais, para que o
 * formulário não seja perdido ao trocar de aba.
 */
export function useSkillsFormState() {
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillAttr, setNewSkillAttr] = useState("forca");
  const [newSkillBonus, setNewSkillBonus] = useState(2);

  const [newAbilityOpen, setNewAbilityOpen] = useState(false);
  const [editingAbilityId, setEditingAbilityId] = useState(null);
  const [abName, setAbName] = useState("");
  const [abColor, setAbColor] = useState("#e53935");
  const [abCostRes, setAbCostRes] = useState("mp");
  const [abCostAmt, setAbCostAmt] = useState(0);
  const [abHit, setAbHit] = useState("1d20 + @forca");
  const [abEffect, setAbEffect] = useState("1d8 + @forca");
  const [abTrigger, setAbTrigger] = useState("active");
  const [abEffectType, setAbEffectType] = useState("damage");
  const [abRangeType, setAbRangeType] = useState("ranged"); // 'self' | 'touch' | 'ranged'
  const [abRangeDist, setAbRangeDist] = useState(9); // metros
  const [abAoeType, setAbAoeType] = useState("single"); // 'single' | 'circle' | 'cone'
  const [abAoeRadius, setAbAoeRadius] = useState(6); // raio em metros (ou comprimento do cone)
  const [abAoeConeAngle, setAbAoeConeAngle] = useState(45); // 45 ou 60 graus
  const [abSaveEnabled, setAbSaveEnabled] = useState(false);
  const [abSaveDc, setAbSaveDc] = useState("12");
  const [abSaveAttr, setAbSaveAttr] = useState("resistencia");
  const [abSaveDesc, setAbSaveDesc] = useState("");
  const [abDesc, setAbDesc] = useState("");

  // Fase 5: reinicia o formulário de habilidade (movido de CharacterSheetModal, conteúdo inalterado)
  const resetAbilityForm = () => {
    setEditingAbilityId(null);
    setAbName("");
    setAbColor("#e53935");
    setAbCostRes("mp");
    setAbCostAmt(0);
    setAbHit("1d20 + @forca");
    setAbEffect("1d8 + @forca");
    setAbTrigger("active");
    setAbEffectType("damage");
    setAbRangeType("ranged");
    setAbRangeDist(9);
    setAbAoeType("single");
    setAbAoeRadius(6);
    setAbAoeConeAngle(45);
    setAbSaveEnabled(false);
    setAbSaveDc("12");
    setAbSaveAttr("resistencia");
    setAbSaveDesc("");
    setAbDesc("");
  };

  return {
    resetAbilityForm,
    newSkillName,
    setNewSkillName,
    newSkillAttr,
    setNewSkillAttr,
    newSkillBonus,
    setNewSkillBonus,
    newAbilityOpen,
    setNewAbilityOpen,
    editingAbilityId,
    setEditingAbilityId,
    abName,
    setAbName,
    abColor,
    setAbColor,
    abCostRes,
    setAbCostRes,
    abCostAmt,
    setAbCostAmt,
    abHit,
    setAbHit,
    abEffect,
    setAbEffect,
    abTrigger,
    setAbTrigger,
    abEffectType,
    setAbEffectType,
    abRangeType,
    setAbRangeType,
    abRangeDist,
    setAbRangeDist,
    abAoeType,
    setAbAoeType,
    abAoeRadius,
    setAbAoeRadius,
    abAoeConeAngle,
    setAbAoeConeAngle,
    abSaveEnabled,
    setAbSaveEnabled,
    abSaveDc,
    setAbSaveDc,
    abSaveAttr,
    setAbSaveAttr,
    abSaveDesc,
    setAbSaveDesc,
    abDesc,
    setAbDesc
  };
}
