export const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

export function stripAccents(str) {
  if (str === null || str === undefined) {
    return "";
  }
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFormulaKey(str) {
  return stripAccents(str)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}
