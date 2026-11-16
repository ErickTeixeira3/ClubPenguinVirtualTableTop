/**
 * Fase 5: constantes e helpers da Ficha extraídos de CharacterSheetModal.jsx (conteúdo inalterado).
 */
export const CARD_COLORS = [
  "#008be3", // CP Blue Classic
  "#02529c", // CP Navy Deep
  "#c62828", // Vermelho
  "#2e7d32", // Verde
  "#f59f00", // Laranja
  "#d84315", // Marrom
  "#6a1b9a", // Roxo
  "#ad1457", // Rosa
  "#00838f", // Turquesa
  "#1a202c"  // Preto
];

export const TABS = [
  { id: "inventory", label: "Inventário" },
  { id: "attributes", label: "Atributos" },
  { id: "skills", label: "Skills" },
  { id: "notes", label: "História & Notas" },
  { id: "rolls", label: "Rolagens & Ações" }
];

export const resolveItemIcon = (item) => {
  if (!item) return "sword";
  if (typeof item === "string") return item;
  return item.icon || item.name || "sword";
};
