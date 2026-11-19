// Caracterização (Fase 0): classificação ESTRUTURAL de rolagens e resolução de atalhos vinculados por id.
// - rollService: effectRollKind, inferAbilityRollKind, classifyRollKind e isAttackRollMessage nos ramos
//   estruturais (os ramos por regex/rótulo em português são legado e saem nas Fases 1 e 9);
// - as 3 cópias inline da classificação de habilidade (SheetSkillsTab ×2, SheetRollsTab) equivalem a
//   inferAbilityRollKind sem perícia, fixadas por source pin (o engine `rollClassifier` as substitui na Fase 1);
// - atalhos: resolveDynamicRollEntry/resolveHotbarSlot por sourceType+sourceId e rollId.
// Inconsistência registrada (resolvida na Fase 1): effectRollKind("mp_damage") = DAMAGE e
// classifyRollKind({ effectType: "mp_damage" }) = MP_DAMAGE; "mp_heal" vira HEAL nos dois.
import { describe, expect, it, vi } from "vitest";
import { ROLL_KINDS } from "../../src/engines/combatEngine.js";
import { normalizeCharacter } from "../../src/domain/models/character.js";
import { sourceContains } from "../support/sourcePin.js";

vi.mock("../../src/infra/firebase.js", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({}));

const rollService = await import("../../src/engines/rolls/index.js");
const {
  buildHotbarSlotFromRoll,
  buildShortcutRollParams,
  classifyRollKind,
  effectRollKind,
  inferAbilityRollKind,
  isAttackRollMessage,
  resolveDynamicRollEntry,
  resolveHotbarSlot
} = rollService;

describe("classificação de rolagens", () => {
  it.each([
    ["damage", ROLL_KINDS.DAMAGE],
    ["mp_damage", ROLL_KINDS.MP_DAMAGE],
    ["heal", ROLL_KINDS.HEAL],
    ["mp_heal", ROLL_KINDS.MP_HEAL],
    ["utility", ROLL_KINDS.UTILITY],
    [null, ROLL_KINDS.DAMAGE]
  ])("effectRollKind(%s) = %s", (effectType, kind) => {
    expect(effectRollKind(effectType)).toBe(kind);
  });

  it.each([
    [{ hitFormula: "1d20+2", effectFormula: "1d6" }, ROLL_KINDS.ATTACK],
    [{ hitFormula: "1d20+2" }, ROLL_KINDS.ATTACK],
    [{ effectFormula: "1d6", effectType: "heal" }, ROLL_KINDS.HEAL],
    [{ effectFormula: "1d6", effectType: "utility" }, ROLL_KINDS.UTILITY],
    [{ effectFormula: "1d6", effectType: "damage" }, ROLL_KINDS.DAMAGE],
    [{}, ROLL_KINDS.CHECK],
    [{ hitFormula: "1d20", isSkill: true }, ROLL_KINDS.CHECK],
    [{ hitFormula: "1d20", effectFormula: "1d4", isSkill: true }, ROLL_KINDS.ATTACK]
  ])("inferAbilityRollKind(%o) = %s", (input, kind) => {
    expect(inferAbilityRollKind(input)).toBe(kind);
  });

  it("classifyRollKind: rollKind explícito e válido sempre vence", () => {
    expect(classifyRollKind({ rollKind: ROLL_KINDS.SAVING_THROW, primaryFormula: "1d20", secondaryFormula: "1d6" })).toBe(
      ROLL_KINDS.SAVING_THROW
    );
    expect(classifyRollKind({ rollKind: "inventado", effectType: "heal" })).toBe(ROLL_KINDS.HEAL);
  });

  it("classifyRollKind: acerto + efeito adiado é ataque; senão decide o effectType", () => {
    expect(classifyRollKind({ primaryFormula: "1d20", secondaryFormula: "1d6" })).toBe(ROLL_KINDS.ATTACK);
    expect(
      classifyRollKind({ primaryFormula: "1d20", secondaryFormula: "1d6", deferSecondaryDamage: false, effectType: "damage" })
    ).toBe(ROLL_KINDS.DAMAGE);
    expect(classifyRollKind({ effectType: "heal" })).toBe(ROLL_KINDS.HEAL);
    expect(classifyRollKind({ effectType: "mp_heal" })).toBe(ROLL_KINDS.MP_HEAL);
    expect(classifyRollKind({ effectType: "mp_damage" })).toBe(ROLL_KINDS.MP_DAMAGE);
    expect(classifyRollKind({ effectType: "utility" })).toBe(ROLL_KINDS.UTILITY);
    expect(classifyRollKind({ primaryFormula: "1d20 + 3" })).toBe(ROLL_KINDS.CHECK);
  });

  it("isAttackRollMessage: decide pelos metadados estruturais", () => {
    expect(isAttackRollMessage({ rollData: null })).toBe(false);
    expect(isAttackRollMessage({ rollData: { rollKind: ROLL_KINDS.ATTACK } })).toBe(true);
    expect(isAttackRollMessage({ rollData: { damageConfig: { formula: "1d6" } } })).toBe(true);
    expect(isAttackRollMessage({ rollData: { targetInfo: { isAttackRoll: true } } })).toBe(true);
    for (const kind of [ROLL_KINDS.DAMAGE, ROLL_KINDS.HEAL, ROLL_KINDS.MP_DAMAGE, ROLL_KINDS.MP_HEAL, ROLL_KINDS.SAVING_THROW]) {
      expect(isAttackRollMessage({ rollData: { rollKind: kind, damageConfig: {} } })).toBe(false);
    }
    expect(isAttackRollMessage({ rollData: { rollKind: ROLL_KINDS.CHECK } })).toBe(false);
    expect(isAttackRollMessage({ rollData: { parentMessageId: "m0", damageConfig: {} } })).toBe(false);
    expect(
      isAttackRollMessage({ rollData: { parentMessageId: "m0", savingThrowOutcome: { passed: true }, rollKind: ROLL_KINDS.ATTACK } })
    ).toBe(true);
  });

  it("abas da ficha usam inferAbilityRollKind do engine rollClassifier em vez de cópias inline", () => {
    expect(sourceContains("src/components/sheets/tabs/AbilityCard.jsx", "inferAbilityRollKind")).toBe(true);
    expect(sourceContains("src/components/sheets/tabs/SheetRollsTab.jsx", "inferAbilityRollKind")).toBe(true);
    expect(sourceContains("src/components/sheets/tabs/SheetSkillsTab.jsx", "inferAbilityRollKind")).toBe(true);
  });

  it.each([
    [{ hitFormula: "1d20", effectFormula: "2d6", effectType: "damage" }],
    [{ hitFormula: "", effectFormula: "2d6", effectType: "mp_heal" }],
    [{ hitFormula: "", effectFormula: "2d6", effectType: "utility" }],
    [{ hitFormula: "", effectFormula: "2d6", effectType: "mp_damage" }],
    [{ hitFormula: "", effectFormula: "2d6" }],
    [{ hitFormula: "", effectFormula: "" }]
  ])("a regra das cópias inline equivale a inferAbilityRollKind sem perícia (%o)", (ab) => {
    for (const effType of [ab.effectType || (ab.effectFormula ? "damage" : null), ab.effectType || "damage"]) {
      const inline = ab.hitFormula
        ? ROLL_KINDS.ATTACK
        : ab.effectFormula
          ? effType === "heal"
            ? ROLL_KINDS.HEAL
            : effType === "mp_heal"
              ? ROLL_KINDS.MP_HEAL
              : effType === "mp_damage"
                ? ROLL_KINDS.MP_DAMAGE
            : effType === "utility"
              ? ROLL_KINDS.UTILITY
              : ROLL_KINDS.DAMAGE
          : ROLL_KINDS.CHECK;
      expect(inline).toBe(inferAbilityRollKind({ ...ab, effectType: effType }));
    }
  });
});

describe("resolução de atalhos vinculados por id", () => {
  const character = normalizeCharacter({
    id: "c1",
    abilities: [
      {
        id: "ab_fire",
        name: "Bola de Fogo",
        icon: "fire",
        elementColor: "#ff5500",
        hitFormula: "1d20 + @intelecto",
        effectFormula: "2d6",
        effectType: "damage",
        trigger: "active",
        cost: { resource: "mp", amount: 3 },
        range: { type: "ranged", distanceMeters: 18 },
        aoe: { type: "circle", radiusMeters: 3 }
      },
      { id: "ab_heal", name: "Cura", effectFormula: "1d8", effectType: "heal" }
    ],
    skills: [{ id: "sk_luta", name: "Luta", attribute: "forca", bonus: 2 }],
    inventory: [{ id: "it_pot", name: "Poção", icon: "potion_red", rollFormula: "2d4", effectType: "heal", consumeOnUse: true, qty: 3 }],
    attributes: [{ key: "forca", label: "Força", value: 3 }],
    rollGroups: [
      {
        id: "g1",
        rolls: [
          { id: "r_fire", name: "Bola de Fogo", sourceType: "ability", sourceId: "ab_fire" },
          { id: "r_free", name: "Disparo", sourceType: "custom", hitFormula: "1d20 + 5", rollKind: ROLL_KINDS.ATTACK }
        ]
      }
    ]
  });
  const resolveEntry = (entry) => {
    const fixture = normalizeCharacter({
      id: "fixture",
      rollGroups: [{ id: "fixture_group", rolls: [entry] }]
    });
    const normalizedEntry = Object.values(
      fixture.rollGroups.fixture_group.rolls
    )[0];
    return resolveDynamicRollEntry(normalizedEntry, character);
  };

  it("habilidade: lê a fonte atual pelo sourceId", () => {
    const resolved = resolveEntry({ id: "r", name: "Bola de Fogo", sourceType: "ability", sourceId: "ab_fire" });
    expect(resolved).toMatchObject({
      name: "Bola de Fogo",
      color: "#ff5500",
      icon: "fire",
      hitFormula: "1d20 + @intelecto",
      effectFormula: "2d6",
      effectType: "damage",
      trigger: "active",
      cost: { resource: "mp", amount: 3 },
      range: { type: "ranged", distanceMeters: 18 },
      aoe: { type: "circle", radiusMeters: 3 },
      rollKind: ROLL_KINDS.ATTACK,
      isLinkedMissing: false
    });
    const heal = resolveEntry({ id: "r2", sourceType: "ability", sourceId: "ab_heal" });
    expect(heal).toMatchObject({ rollKind: ROLL_KINDS.HEAL, cost: { amount: 0, resource: "mp" } });
  });

  it("perícia: monta o teste a partir do atributo e do bônus", () => {
    expect(resolveDynamicRollEntry({ id: "r", source: { type: "skill", id: Object.keys(character.skills)[0] }, overrides: {} }, character)).toMatchObject({
      name: "Luta",
      hitFormula: "1d20 + @forca + 2",
      effectFormula: "",
      rollKind: ROLL_KINDS.CHECK,
      description: "Perícia (forca +2)"
    });
  });

  it("item: herda fórmula, consumo e quantidade; tipo pelo efeito do item", () => {
    expect(resolveEntry({ id: "r", sourceType: "item", sourceId: "it_pot" })).toMatchObject({
      name: "Poção",
      icon: "potion_red",
      hitFormula: "2d4",
      effectType: "heal",
      consumeOnUse: true,
      qty: 3,
      rollKind: ROLL_KINDS.HEAL
    });
  });

  it("atributo: teste de atributo com ícone padrão", () => {
    expect(resolveEntry({ id: "r", name: "Teste Força", sourceType: "attribute", sourceId: "forca", icon: "clover" })).toMatchObject({
      name: "Teste Força",
      hitFormula: "1d20 + @forca",
      icon: "clover",
      rollKind: ROLL_KINDS.CHECK
    });
  });

  it("ícone e nome personalizados no atalho prevalecem sobre a fonte", () => {
    const resolved = resolveDynamicRollEntry(
      { id: "r", source: { type: "ability", id: "ab_fire" }, overrides: { name: "Meu Fogo", icon: "star" } },
      character
    );
    expect(resolved).toMatchObject({ name: "Meu Fogo", icon: "star" });
    const renamedSource = resolveDynamicRollEntry({ id: "r", source: { type: "ability", id: "ab_fire" }, overrides: {} }, character);
    expect(renamedSource.name).toBe("Bola de Fogo");
  });

  it("fonte apagada: o atalho continua com seus dados e é marcado como vínculo perdido", () => {
    const resolved = resolveDynamicRollEntry(
      { id: "r", source: { type: "ability", id: "ab_gone" }, overrides: { name: "Sumida" }, custom: { hitFormula: "1d20", rollKind: ROLL_KINDS.ATTACK } },
      character
    );
    expect(resolved).toMatchObject({ name: "Sumida", rollKind: ROLL_KINDS.ATTACK, isLinkedMissing: true });
  });

  it("atalho personalizado: respeita o rollKind gravado", () => {
    const resolved = resolveDynamicRollEntry(character.rollGroups.g1.rolls.r_free, character);
    expect(resolved).toMatchObject({ rollKind: ROLL_KINDS.ATTACK, isLinkedMissing: false });
  });

  it("slot da hotbar resolve em duas camadas: rollId → atalho do grupo → fonte original", () => {
    const resolved = resolveHotbarSlot({ rollId: "r_fire", name: "cópia velha", hitFormula: "1d4" }, character);
    expect(resolved).toMatchObject({
      rollId: "r_fire",
      id: "r_fire",
      source: { type: "ability", id: "ab_fire" },
      hitFormula: "1d20 + @intelecto",
      cost: { resource: "mp", amount: 3 }
    });
    const orphan = resolveHotbarSlot({ rollId: "r_gone" }, character);
    expect(orphan).toMatchObject({ name: "Rolagem", hitFormula: "", isLinkedMissing: true });
    expect(resolveHotbarSlot(null, character)).toBeNull();
  });

  it("slot gravado guarda a referência (rollId, sourceType, sourceId)", () => {
    const resolved = resolveHotbarSlot({ rollId: "r_fire" }, character);
    expect(buildHotbarSlotFromRoll({ ...resolved, id: "r_fire" })).toMatchObject({
      rollId: "r_fire",
      rollGroupId: "g1"
    });
  });

  it("parâmetros de execução de um atalho resolvido", () => {
    const params = buildShortcutRollParams(resolveHotbarSlot({ rollId: "r_fire" }, character), character);
    expect(params).toMatchObject({
      title: "Bola de Fogo",
      primaryFormula: "1d20 + @intelecto",
      primaryLabel: "Acerto",
      rollKind: ROLL_KINDS.ATTACK,
      secondaryFormula: "2d6",
      cost: { resource: "mp", amount: 3 },
      effectType: "damage",
      character
    });
    expect(buildShortcutRollParams({ name: "Livre", hitFormula: "1d20", costAmount: 0 }).cost).toBeNull();
  });
});
