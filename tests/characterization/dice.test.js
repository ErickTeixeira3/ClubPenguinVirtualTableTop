// Caracterização (Fase 0): parser de dados atual (src/engines/diceEngine.js).
import { describe, expect, it, vi } from "vitest";
import { evaluateDiceToken, rollSingleDie } from "../../src/engines/diceEngine.js";
import { queueRolls } from "../support/dice.js";

describe("evaluateDiceToken", () => {
  it("rola NdX e soma todos os dados", () => {
    queueRolls([[3, 6], [4, 6]]);
    expect(evaluateDiceToken("2d6")).toEqual({
      notation: "2d6",
      count: 2,
      sides: 6,
      keepMode: null,
      keepCount: 2,
      rawRolls: [3, 4],
      keptRolls: [3, 4],
      subtotal: 7,
      isCrit: false,
      isFumble: false
    });
  });

  it("aceita contagem omitida (d20 = 1d20) e maiúsculas", () => {
    queueRolls([[11, 20]]);
    expect(evaluateDiceToken("d20")).toMatchObject({ count: 1, sides: 20, subtotal: 11 });
    queueRolls([[5, 8]]);
    expect(evaluateDiceToken("1D8")).toMatchObject({ count: 1, sides: 8, subtotal: 5 });
  });

  it("kh mantém os maiores e kl os menores", () => {
    queueRolls([[4, 20], [18, 20]]);
    expect(evaluateDiceToken("2d20kh1")).toMatchObject({
      keepMode: "kh",
      keepCount: 1,
      rawRolls: [4, 18],
      keptRolls: [18],
      subtotal: 18
    });
    queueRolls([[4, 20], [18, 20]]);
    expect(evaluateDiceToken("2d20kl1")).toMatchObject({ keepMode: "kl", keptRolls: [4], subtotal: 4 });
    queueRolls([[2, 6], [6, 6], [5, 6], [1, 6]]);
    expect(evaluateDiceToken("4d6kh3")).toMatchObject({ keptRolls: [6, 5, 2], subtotal: 13 });
  });

  it("crítico e falha só com um único d20 mantido", () => {
    queueRolls([[20, 20]]);
    expect(evaluateDiceToken("1d20")).toMatchObject({ isCrit: true, isFumble: false });
    queueRolls([[1, 20]]);
    expect(evaluateDiceToken("1d20")).toMatchObject({ isCrit: false, isFumble: true });
    queueRolls([[20, 20], [3, 20]]);
    expect(evaluateDiceToken("2d20kh1")).toMatchObject({ isCrit: true });
    queueRolls([[1, 20], [3, 20]]);
    expect(evaluateDiceToken("2d20kl1")).toMatchObject({ isFumble: true });
    queueRolls([[20, 20], [5, 20]]);
    expect(evaluateDiceToken("2d20")).toMatchObject({ subtotal: 25, isCrit: false, isFumble: false });
    queueRolls([[6, 6]]);
    expect(evaluateDiceToken("1d6")).toMatchObject({ isCrit: false });
  });

  it("limita contagem (1..100), lados (2..1000) e quantidade mantida", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    expect(evaluateDiceToken("0d6")).toMatchObject({ count: 1 });
    expect(evaluateDiceToken("500d2")).toMatchObject({ count: 100, subtotal: 100 });
    expect(evaluateDiceToken("1d1")).toMatchObject({ sides: 2 });
    expect(evaluateDiceToken("1d5000")).toMatchObject({ sides: 1000 });
    expect(evaluateDiceToken("2d6kh5")).toMatchObject({ keepCount: 2 });
    expect(evaluateDiceToken("3d6kh0")).toMatchObject({ keepCount: 1 });
    random.mockRestore();
  });

  it("devolve null para o que não é notação de dado", () => {
    expect(evaluateDiceToken("abc")).toBeNull();
    expect(evaluateDiceToken("d")).toBeNull();
    expect(evaluateDiceToken("2d")).toBeNull();
    expect(evaluateDiceToken("2d6+1")).toBeNull();
  });
});

describe("rollSingleDie", () => {
  it("devolve um valor entre 1 e o número de lados", () => {
    queueRolls([[1, 6], [6, 6]]);
    expect(rollSingleDie(6)).toBe(1);
    expect(rollSingleDie(6)).toBe(6);
  });

  it("usa no mínimo 2 lados e 6 quando o valor é inválido", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(rollSingleDie(1)).toBe(2);
    expect(rollSingleDie("x")).toBe(6);
    random.mockRestore();
  });
});
