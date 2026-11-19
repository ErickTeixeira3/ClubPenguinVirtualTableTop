// Caracterização (Fase 0): pipeline de efeitos (computeModifiedEffectValue em src/engines/combatEngine.js).
// O registro global de hooks (registerCombatModifierHook) sai na Fase 1 e não tem uso no app; não é fixado.
import { describe, expect, it } from "vitest";
import { computeModifiedEffectValue } from "../../src/engines/combatEngine.js";

const shieldBearer = {
  abilities: [
    { id: "ab_shield", name: "Escudo", combatModifiers: [{ phase: "incoming", flatDelta: -3, effectTypes: ["damage"] }] },
    { id: "ab_off", name: "Desligada", enabled: false, combatModifiers: [{ phase: "incoming", flatDelta: -100 }] }
  ],
  inventory: [
    { id: "it_amulet", name: "Amuleto", combatModifiers: [{ phase: "incoming", multiplier: 0.5, effectTypes: ["heal"] }] }
  ]
};

describe("computeModifiedEffectValue", () => {
  it.each([
    ["damage", "hp", -10],
    ["heal", "hp", 10],
    ["mp_damage", "mp", -10],
    ["mp_heal", "mp", 10],
    ["utility", null, 0]
  ])("%s altera %s com o sinal do tipo", (effectType, resourceKey, resourceDelta) => {
    expect(computeModifiedEffectValue({ baseValue: 10, effectType })).toEqual({
      baseValue: 10,
      finalValue: 10,
      scaleMode: "full",
      effectType,
      resourceKey,
      resourceDelta,
      appliedModifiers: []
    });
  });

  it("tipo desconhecido é tratado como dano", () => {
    expect(computeModifiedEffectValue({ baseValue: 4, effectType: "xyz" })).toMatchObject({
      effectType: "damage",
      resourceKey: "hp",
      resourceDelta: -4
    });
  });

  it("metade arredonda para baixo; base negativa vira 0", () => {
    expect(computeModifiedEffectValue({ baseValue: 11, scaleMode: "half" }).finalValue).toBe(5);
    expect(computeModifiedEffectValue({ baseValue: -5 }).finalValue).toBe(0);
  });

  it("aplica modificadores de entrada do alvo filtrados por tipo de efeito e ignora os desligados", () => {
    const damage = computeModifiedEffectValue({ baseValue: 10, effectType: "damage", targetCharacter: shieldBearer });
    expect(damage.finalValue).toBe(7);
    expect(damage.appliedModifiers).toEqual([{ id: "ab_shield", label: "Escudo", flatDelta: -3, multiplier: 1 }]);

    const heal = computeModifiedEffectValue({ baseValue: 10, effectType: "heal", targetCharacter: shieldBearer });
    expect(heal.finalValue).toBe(5);
    expect(heal.appliedModifiers).toEqual([{ id: "it_amulet", label: "Amuleto", flatDelta: 0, multiplier: 0.5 }]);
  });

  it("aplica primeiro os modificadores de saída (origem) e depois os de entrada (alvo e token)", () => {
    const result = computeModifiedEffectValue({
      baseValue: 10,
      sourceCharacter: { combatModifiers: [{ id: "fury", label: "Fúria", phase: "outgoing", flatDelta: 2 }] },
      targetToken: { combatModifiers: [{ id: "armor", label: "Armadura", phase: "incoming", multiplier: 0.5 }] }
    });
    expect(result.finalValue).toBe(6);
    expect(result.appliedModifiers.map((m) => m.id)).toEqual(["fury", "armor"]);
  });

  it("modificadores manuais: sem fase contam como entrada; desligados são ignorados", () => {
    const result = computeModifiedEffectValue({
      baseValue: 10,
      manualModifiers: [
        { id: "m1", label: "Bênção", phase: "outgoing", flatDelta: 1 },
        { id: "m2", label: "Resistência", multiplier: 0.5 },
        { id: "m3", label: "Desligado", flatDelta: 50, enabled: false }
      ]
    });
    expect(result.finalValue).toBe(6);
    expect(result.appliedModifiers.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("arredonda o resultado e nunca fica abaixo de zero", () => {
    const halfMult = { manualModifiers: [{ id: "x", multiplier: 0.5 }] };
    expect(computeModifiedEffectValue({ baseValue: 7, ...halfMult }).finalValue).toBe(4);
    expect(computeModifiedEffectValue({ baseValue: 7, scaleMode: "half", ...halfMult }).finalValue).toBe(1);
    expect(
      computeModifiedEffectValue({ baseValue: 5, manualModifiers: [{ id: "big", flatDelta: -20 }] }).finalValue
    ).toBe(0);
  });

  it("valor personalizado ignora os modificadores das entidades e aplica só os manuais", () => {
    const custom = computeModifiedEffectValue({
      baseValue: 10,
      scaleMode: "custom",
      customValue: "7",
      targetCharacter: shieldBearer,
      manualModifiers: [{ id: "m", label: "Ajuste", phase: "outgoing", flatDelta: 1 }]
    });
    expect(custom).toMatchObject({ baseValue: 7, finalValue: 8, scaleMode: "custom", resourceDelta: -8 });
    expect(custom.appliedModifiers.map((m) => m.id)).toEqual(["m"]);

    expect(computeModifiedEffectValue({ baseValue: 9, scaleMode: "custom", customValue: "" }).finalValue).toBe(9);
  });
});
