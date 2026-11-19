// Caracterização (Fase 0): motor de fórmulas atual (src/engines/formulaEngine.js).
// Só casos VÁLIDOS: os comportamentos defeituosos de INT-11 (variável desconhecida vale 0, "2x3" vira 2,
// erro vira 0, colisão atributo×perícia) mudam na Fase 1 e não são fixados aqui.
import { describe, expect, it } from "vitest";
import { buildCharacterVariableMap, evaluateFormula } from "../../src/engines/formulaEngine.js";
import { queueRolls } from "../support/dice.js";

const hero = {
  level: 3,
  defense: 12,
  resources: { hp: { current: 20, max: 25 }, mp: { current: 7, max: 10 } },
  attributes: [
    { key: "forca", label: "Força", value: 3 },
    { key: "agilidade", label: "Agilidade", value: -2 }
  ],
  skills: [{ id: "sk1", name: "Luta", bonus: 5 }]
};

describe("buildCharacterVariableMap", () => {
  it("expõe atributos em lista por chave e por rótulo normalizados", () => {
    const vars = buildCharacterVariableMap(hero);
    expect(vars.forca).toBe(3);
    expect(vars.agilidade).toBe(-2);
  });

  it("aceita atributos em mapa (objeto com value/label ou número)", () => {
    const vars = buildCharacterVariableMap({
      attributes: { Presença: { value: 4, label: "Carisma" }, vigor: 2 }
    });
    expect(vars.presenca).toBe(4);
    expect(vars.carisma).toBe(4);
    expect(vars.vigor).toBe(2);
  });

  it("expõe perícias em lista (pelo nome) e em mapa (pela chave e pelo rótulo)", () => {
    expect(buildCharacterVariableMap(hero).luta).toBe(5);
    const vars = buildCharacterVariableMap({ skills: { furtividade: { bonus: 2, label: "Furtividade Urbana" } } });
    expect(vars.furtividade).toBe(2);
    expect(vars.furtividadeurbana).toBe(2);
  });

  it("expõe Defesa, vida, energia e nível com seus aliases", () => {
    const vars = buildCharacterVariableMap(hero);
    expect(vars).toMatchObject({ defesa: 12, defense: 12, hp: 20, vida: 20, mp: 7, energia: 7, nivel: 3 });
    expect(buildCharacterVariableMap({}).nivel).toBe(1);
    expect(buildCharacterVariableMap(null)).toEqual({});
  });
});

describe("evaluateFormula", () => {
  it("resolve variáveis, rola os dados e soma", () => {
    queueRolls([[15, 20]]);
    const result = evaluateFormula("1d20 + @forca", hero);
    expect(result).toMatchObject({
      formulaOriginal: "1d20 + @forca",
      formulaResolved: "1d20 + 3",
      expressionFinal: "15 + 3",
      total: 18,
      isCrit: false,
      isFumble: false
    });
    expect(result.diceBreakdown).toHaveLength(1);
    expect(result.diceBreakdown[0]).toMatchObject({ notation: "1d20", subtotal: 15 });
  });

  it("resolve variáveis com acento e maiúsculas pela chave normalizada", () => {
    queueRolls([[10, 20]]);
    expect(evaluateFormula("1d20 + @Força", hero)).toMatchObject({ formulaResolved: "1d20 + 3", total: 13 });
  });

  it("envolve valores negativos em parênteses", () => {
    queueRolls([[10, 20]]);
    expect(evaluateFormula("1d20 + @agilidade", hero)).toMatchObject({
      formulaResolved: "1d20 + (-2)",
      total: 8
    });
  });

  it("usa perícias, Defesa e nível como variáveis", () => {
    queueRolls([[2, 20]]);
    expect(evaluateFormula("1d20 + @luta + @nivel", hero).total).toBe(10);
    expect(evaluateFormula("@defesa + 2", hero).total).toBe(14);
  });

  it("respeita precedência, parênteses, sinais unários, divisão e arredonda em 2 casas", () => {
    expect(evaluateFormula("2 + 3 * 4").total).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4").total).toBe(20);
    expect(evaluateFormula("-3 + 5").total).toBe(2);
    expect(evaluateFormula("7 / 2").total).toBe(3.5);
    expect(evaluateFormula("10 / 3").total).toBe(3.33);
    expect(evaluateFormula("2 * (3 + (4 - 1))").total).toBe(12);
  });

  it("soma várias expressões de dados e mantém kh/kl", () => {
    queueRolls([[3, 6], [5, 6], [2, 4]]);
    const sum = evaluateFormula("2d6 + 1d4 + 1");
    expect(sum).toMatchObject({ expressionFinal: "8 + 2 + 1", total: 11 });
    expect(sum.diceBreakdown).toHaveLength(2);

    queueRolls([[5, 20], [17, 20]]);
    expect(evaluateFormula("2d20kh1 + 2")).toMatchObject({ expressionFinal: "17 + 2", total: 19 });
  });

  it("sinaliza crítico e falha do d20", () => {
    queueRolls([[20, 20]]);
    expect(evaluateFormula("1d20 + 1")).toMatchObject({ total: 21, isCrit: true, isFumble: false });
    queueRolls([[1, 20]]);
    expect(evaluateFormula("1d20 + 1")).toMatchObject({ total: 2, isCrit: false, isFumble: true });
  });

  it("fórmula vazia vira 1d20", () => {
    queueRolls([[9, 20]]);
    expect(evaluateFormula("   ")).toMatchObject({ formulaOriginal: "1d20", total: 9 });
    queueRolls([[4, 20]]);
    expect(evaluateFormula(null)).toMatchObject({ formulaOriginal: "1d20", total: 4 });
  });
});
