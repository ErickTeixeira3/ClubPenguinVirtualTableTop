import { EFFECT_TYPES, EFFECT_TYPE_META } from "../../domain/constants.js";

function toEntryList(collection) {
  if (Array.isArray(collection)) {
    return collection;
  }
  if (collection && typeof collection === "object") {
    return Object.entries(collection)
      .map(([key, val]) => {
        if (!val || typeof val !== "object" || Array.isArray(val)) {
          return null;
        }
        return val.id ? val : { id: key, ...val };
      })
      .filter(Boolean);
  }
  return [];
}

export function collectEntityCombatModifiers(
  entity,
  phase = "incoming",
  effectType = EFFECT_TYPES.DAMAGE
) {
  if (!entity || typeof entity !== "object") {
    return [];
  }

  const collected = [];
  const scanList = (items, sourceTag) => {
    for (const entry of toEntryList(items)) {
      if (!entry || entry.enabled === false) {
        continue;
      }
      for (const mod of toEntryList(entry.combatModifiers)) {
        if (!mod || mod.enabled === false) {
          continue;
        }
        if (mod.phase && mod.phase !== phase) {
          continue;
        }
        if (
          Array.isArray(mod.effectTypes) &&
          mod.effectTypes.length > 0 &&
          !mod.effectTypes.includes(effectType)
        ) {
          continue;
        }
        collected.push({
          id: mod.id || entry.id || `${sourceTag}_${collected.length}`,
          label: mod.label || entry.name || "Modificador",
          phase,
          flatDelta: Number(mod.flatDelta) || 0,
          multiplier:
            mod.multiplier !== undefined && mod.multiplier !== null
              ? Number(mod.multiplier)
              : 1
        });
      }
    }
  };

  if (entity.combatModifiers) {
    scanList([{ combatModifiers: entity.combatModifiers }], "direct");
  }
  scanList(entity.abilities, "ability");
  scanList(entity.inventory, "item");
  scanList(entity.conditions, "condition");

  return collected;
}

export function computeModifiedEffectValue(options = {}) {
  const src = options && typeof options === "object" ? options : {};
  const baseValue = src.baseValue ?? 0;
  const scaleMode = src.scaleMode ?? "full";
  const customValue = src.customValue ?? null;
  const effectType = src.effectType ?? EFFECT_TYPES.DAMAGE;
  const sourceCharacter = src.sourceCharacter ?? null;
  const targetCharacter = src.targetCharacter ?? null;
  const targetToken = src.targetToken ?? null;
  const manualModifiers = Array.isArray(src.manualModifiers)
    ? src.manualModifiers
    : [];
  const modifierHooks = Array.isArray(src.modifierHooks)
    ? src.modifierHooks
    : [];

  const effectMeta =
    EFFECT_TYPE_META[effectType] || EFFECT_TYPE_META[EFFECT_TYPES.DAMAGE];

  const hasCustom =
    scaleMode === "custom" &&
    customValue !== null &&
    customValue !== undefined &&
    customValue !== "";
  const initialBase = Math.max(
    0,
    Number(hasCustom ? customValue : baseValue) || 0
  );

  let current = initialBase;
  const appliedModifiers = [];

  const applyModList = (mods) => {
    for (const mod of mods) {
      const flat = Number(mod.flatDelta) || 0;
      const mult =
        mod.multiplier !== undefined && mod.multiplier !== null
          ? Number(mod.multiplier)
          : 1;
      if (flat !== 0) {
        current = Math.max(0, current + flat);
      }
      if (Number.isFinite(mult) && mult !== 1) {
        current = Math.max(0, current * mult);
      }
      if (flat !== 0 || (Number.isFinite(mult) && mult !== 1)) {
        appliedModifiers.push({
          id: mod.id,
          label: mod.label,
          flatDelta: flat,
          multiplier: mult
        });
      }
    }
  };

  if (scaleMode !== "custom") {
    const outgoingMods = [
      ...collectEntityCombatModifiers(
        sourceCharacter,
        "outgoing",
        effectMeta.id
      ),
      ...manualModifiers.filter(
        (m) => m && m.phase === "outgoing" && m.enabled !== false
      )
    ];
    applyModList(outgoingMods);

    const incomingMods = [
      ...collectEntityCombatModifiers(
        targetCharacter,
        "incoming",
        effectMeta.id
      ),
      ...collectEntityCombatModifiers(targetToken, "incoming", effectMeta.id),
      ...manualModifiers.filter(
        (m) => m && m.phase !== "outgoing" && m.enabled !== false
      )
    ];
    applyModList(incomingMods);

    for (const hookFn of modifierHooks) {
      if (typeof hookFn !== "function") {
        continue;
      }
      const res = hookFn({
        baseValue: initialBase,
        currentValue: current,
        effectType: effectMeta.id,
        sourceCharacter,
        targetCharacter,
        targetToken
      });
      if (res && typeof res === "object") {
        applyModList([
          {
            id: res.id || "hook",
            label: res.label || "Efeito Passivo",
            flatDelta: res.flatDelta,
            multiplier: res.multiplier
          }
        ]);
      }
    }
  } else {
    applyModList(manualModifiers.filter((m) => m && m.enabled !== false));
  }

  let finalValue =
    scaleMode === "half" ? Math.floor(current / 2) : Math.round(current);
  finalValue = Math.max(0, finalValue);

  const resourceDelta =
    finalValue === 0 || effectMeta.deltaSign === 0
      ? 0
      : finalValue * effectMeta.deltaSign;

  return {
    baseValue: initialBase,
    finalValue,
    scaleMode,
    effectType: effectMeta.id,
    resourceKey: effectMeta.resourceKey,
    resourceDelta,
    appliedModifiers
  };
}
