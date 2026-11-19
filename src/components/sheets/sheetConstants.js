/**
 * Constantes e seletores puros compartilhados pelos componentes da Ficha.
 */
export const CARD_COLORS = Object.freeze([
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
]);

export const TABS = Object.freeze([
  { id: "inventory", label: "Inventário" },
  { id: "attributes", label: "Atributos" },
  { id: "skills", label: "Skills" },
  { id: "notes", label: "História & Notas" },
  { id: "rolls", label: "Rolagens & Ações" }
]);

export function resolveItemIcon(item) {
  if (!item) return "sword";
  if (typeof item === "string") return item.trim() || "sword";
  return typeof item.icon === "string" && item.icon.trim()
    ? item.icon.trim()
    : "sword";
}

export function toSortedEntries(collection, keyField = "id") {
  if (Array.isArray(collection)) {
    return collection.filter(Boolean);
  }
  if (!collection || typeof collection !== "object") {
    return [];
  }
  return Object.entries(collection)
    .map(([mapKey, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }
      return value[keyField] ? value : { [keyField]: mapKey, ...value };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const orderDiff = (Number(a.order) || 0) - (Number(b.order) || 0);
      if (orderDiff !== 0) return orderDiff;
      const aId = String(a[keyField] || a.name || a.label || "");
      const bId = String(b[keyField] || b.name || b.label || "");
      return aId.localeCompare(bId);
    });
}
