import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const collapseWhitespace = (text) => text.replace(/\s+/g, " ").trim();

export function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/**
 * "Source pin" de caracterização: parte do comportamento atual ainda vive dentro de componentes
 * (ex.: o desconto de turno no VTTLayout, a régua no BoardViewport) e só será extraída nas fases
 * que os reescrevem. O teste replica a expressão e fixa que ela continua idêntica no código
 * (espaços ignorados). Se o código mudar, o pin falha e o teste precisa migrar para a função
 * extraída — a caracterização nunca fica silenciosamente desatualizada.
 */
export function sourceContains(relativePath, snippet) {
  return collapseWhitespace(readRepoFile(relativePath)).includes(collapseWhitespace(snippet));
}
