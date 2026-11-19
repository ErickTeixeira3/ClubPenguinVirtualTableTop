import { vi } from "vitest";

/**
 * Torna as rolagens determinísticas. Em Node não existe `window`, então o `diceEngine` atual
 * usa `Math.random`: `Math.floor(Math.random() * lados) + 1`.
 * Cada par `[valor, lados]` vira o `Math.random` que produz exatamente esse valor.
 * Rolar além da fila falha o teste (rolagem inesperada).
 */
export function queueRolls(pairs) {
  const queue = pairs.map(([value, sides]) => (value - 0.5) / sides);
  return vi.spyOn(Math, "random").mockImplementation(() => {
    if (queue.length === 0) throw new Error("Rolagem inesperada: a fila de dados acabou.");
    return queue.shift();
  });
}
