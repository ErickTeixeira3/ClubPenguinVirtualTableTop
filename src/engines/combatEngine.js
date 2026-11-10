import { evaluateFormula } from "./formulaEngine";

export const TRIGGER_TYPES = [
  { id: "active", label: "Ativa (Uso Direto)" },
  { id: "on_hit", label: "Ao Acertar (Gatilho)" },
  { id: "on_crit", label: "Ao Critar (Gatilho)" },
  { id: "on_being_hit", label: "Ao Receber Golpe (Reação)" },
  { id: "on_save", label: "Em Teste de Resistência" },
  { id: "passive", label: "Passiva" },
];

export const EFFECT_TYPES = [
  { id: "damage", label: "Dano (PV)", resourceKey: "hp", deltaSign: -1 },
  { id: "heal", label: "Cura (PV)", resourceKey: "hp", deltaSign: 1 },
  { id: "mp_damage", label: "Dreno de Energia (PE)", resourceKey: "mp", deltaSign: -1 },
  { id: "mp_heal", label: "Recuperar Energia (PE)", resourceKey: "mp", deltaSign: 1 },
  { id: "utility", label: "Utilidade / Condição", resourceKey: null, deltaSign: 0 },
];

export const SAVE_ATTRIBUTES = [
  { id: "forca", label: "Força", formula: "@forca" },
  { id: "agilidade", label: "Agilidade", formula: "@agilidade" },
  { id: "intelecto", label: "Intelecto", formula: "@intelecto" },
  { id: "presenca", label: "Presença", formula: "@presenca" },
  { id: "vigor", label: "Vigor", formula: "@vigor" },
  { id: "fortitude", label: "Fortitude", formula: "@vigor + @fortitude" },
  { id: "reflexos", label: "Reflexos", formula: "@agilidade + @reflexos" },
  { id: "vontade", label: "Vontade", formula: "@presenca + @vontade" },
  { id: "resistencia", label: "Resistência", formula: "@vigor + @resistencia" },
];

export const SKILL_RANGE_TYPES = [
  { id: "self", label: "Próprio" },
  { id: "touch", label: "Toque" },
  { id: "ranged", label: "Distância" },
];

export const SKILL_AOE_TYPES = [
  { id: "single", label: "Alvo Único" },
  { id: "circle", label: "Circular" },
  { id: "cone", label: "Cônica" },
];

/**
 * Dobra a quantidade de dados de todas as expressões NdX na fórmula (ex: 1d8 + @forca -> 2d8 + @forca)
 */
export function doubleDiceInFormula(formulaStr) {
  const raw = String(formulaStr || "").trim();
  if (!raw) return "";
  return raw.replace(/\b(\d*)d(\d+)((?:kh|kl)\d+)?\b/gi, (_, countStr, faces, keepSuffix) => {
    const count = countStr ? Math.max(1, parseInt(countStr, 10)) : 1;
    const doubled = count * 2;
    return `${doubled}d${faces}${keepSuffix || ""}`;
  });
}

/**
 * Aplica vantagem/desvantagem ao d20 principal e concatena dados/bônus extras
 */
export function applyD20ModeToFormula(formulaStr, mode = "normal", extraBonus = "") {
  let result = String(formulaStr || "1d20").trim() || "1d20";

  if (mode === "advantage" || mode === "disadvantage") {
    const replacement = mode === "advantage" ? "2d20kh1" : "2d20kl1";
    if (/\b1?d20\b/i.test(result)) {
      result = result.replace(/\b1?d20\b/i, replacement);
    } else {
      result = `${replacement} + (${result})`;
    }
  }

  const trimmedExtra = String(extraBonus || "").trim();
  if (trimmedExtra) {
    if (/^[+-]/.test(trimmedExtra)) {
      result = `${result} ${trimmedExtra}`;
    } else {
      result = `${result} + (${trimmedExtra})`;
    }
  }

  return result;
}

/**
 * Calcula a CD (Classe de Dificuldade) de um teste de resistência usando a ficha do atacante
 */
export function evaluateDcFormula(dcFormula, sourceCharacter = null) {
  const raw = String(dcFormula ?? "").trim();
  if (!raw) return 10;
  const asNum = Number(raw);
  if (Number.isFinite(asNum)) return Math.round(asNum);
  const evaluated = evaluateFormula(raw, sourceCharacter);
  return Math.max(1, Math.round(Number(evaluated.total) || 10));
}

/**
 * Persiste e lê os tokens alvos ativos no localStorage para sincronizar entre a janela principal e fichas pop-out (?sheetId=...)
 */
export function getTargetStorageKey(campaignId) {
  return `cp_vtt_targeted_tokens_${campaignId || "default"}`;
}

export function saveStoredTargetedTokens(campaignId, tokens) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = getTargetStorageKey(campaignId);
  try {
    const arr = Array.isArray(tokens) ? tokens : tokens ? [tokens] : [];
    if (arr.length === 0) {
      window.localStorage.removeItem(key);
      window.localStorage.removeItem(`cp_vtt_targeted_token_${campaignId || "default"}`);
    } else {
      window.localStorage.setItem(key, JSON.stringify(arr));
      window.localStorage.setItem(`cp_vtt_targeted_token_${campaignId || "default"}`, JSON.stringify(arr[0]));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadStoredTargetedTokens(campaignId) {
  if (typeof window === "undefined" || !window.localStorage) return [];
  const key = getTargetStorageKey(campaignId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      const legacyRaw = window.localStorage.getItem(`cp_vtt_targeted_token_${campaignId || "default"}`);
      if (!legacyRaw) return [];
      const parsed = JSON.parse(legacyRaw);
      return parsed && parsed.id ? [parsed] : [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t) => t && t.id);
    if (parsed && parsed.id) return [parsed];
    return [];
  } catch {
    return [];
  }
}

export function saveStoredTargetedToken(campaignId, token) {
  saveStoredTargetedTokens(campaignId, token ? [token] : []);
}

export function loadStoredTargetedToken(campaignId) {
  const list = loadStoredTargetedTokens(campaignId);
  return list[0] || null;
}

/**
 * Validação geométrica: verifica se um token está dentro de uma área circular
 */
export function isTokenInsideCircle({ token, cellSizePx = 64, circleCenter, radiusPx }) {
  if (!token || !circleCenter || radiusPx <= 0) return false;
  const sizePx = (Number(token.sizeInCells) || 1) * cellSizePx;
  const cx = Number(token.x) + sizePx / 2;
  const cy = Number(token.y) + sizePx / 2;
  const r = sizePx / 2;
  const dist = Math.hypot(cx - circleCenter.x, cy - circleCenter.y);
  return dist <= radiusPx + r;
}

/**
 * Validação geométrica: verifica se um token está dentro de uma área cônica
 */
export function isTokenInsideCone({
  token,
  cellSizePx = 64,
  coneOrigin,
  radiusPx,
  centerAngleRad,
  coneAngleDeg = 45,
}) {
  if (!token || !coneOrigin || radiusPx <= 0) return false;
  const sizePx = (Number(token.sizeInCells) || 1) * cellSizePx;
  const cx = Number(token.x) + sizePx / 2;
  const cy = Number(token.y) + sizePx / 2;
  const r = sizePx / 2;

  const dx = cx - coneOrigin.x;
  const dy = cy - coneOrigin.y;
  const dist = Math.hypot(dx, dy);

  // Fora do alcance máximo do cone
  if (dist > radiusPx + r) return false;

  // Próximo à origem (vértice do cone)
  if (dist <= r) return true;

  const tokenAngle = Math.atan2(dy, dx);
  let diff = Math.abs(tokenAngle - centerAngleRad);
  while (diff > Math.PI) {
    diff = Math.abs(diff - 2 * Math.PI);
  }

  const halfAngleRad = ((Number(coneAngleDeg) || 45) * Math.PI) / 360;
  const angularRadius = Math.asin(Math.min(1, r / Math.max(1, dist)));
  return diff <= halfAngleRad + angularRadius;
}

/**
 * Resolve dados consolidados de um token alvo (incluindo vínculo com ficha de personagem)
 */
export function resolveTokenTargetData({ targetedToken, allCharacters = [] }) {
  if (!targetedToken) return null;

  const linkedChar = targetedToken.characterId
    ? allCharacters.find((c) => c.id === targetedToken.characterId) || null
    : targetedToken.name
    ? allCharacters.find(
        (c) => c.name?.trim().toLowerCase() === targetedToken.name?.trim().toLowerCase()
      ) || null
    : null;

  const defense =
    linkedChar?.defense !== undefined && linkedChar?.defense !== null
      ? Number(linkedChar.defense) || 0
      : Number(targetedToken.defense ?? 10) || 10;

  return {
    tokenId: targetedToken.id || targetedToken.tokenId,
    sceneId: targetedToken.sceneId || null,
    characterId: linkedChar?.id || targetedToken.characterId || null,
    name: linkedChar?.name || targetedToken.name || "Alvo",
    imageUrl: linkedChar?.avatarUrl || targetedToken.imageUrl || "",
    defense,
    ownerId: linkedChar?.ownerId || targetedToken.ownerId || null,
    visibleTo: Array.isArray(linkedChar?.visibleTo)
      ? linkedChar.visibleTo
      : Array.isArray(targetedToken.visibleTo)
      ? targetedToken.visibleTo
      : [],
    editableBy: Array.isArray(linkedChar?.editableBy)
      ? linkedChar.editableBy
      : Array.isArray(targetedToken.editableBy)
      ? targetedToken.editableBy
      : [],
    controlledBy: Array.isArray(targetedToken.controlledBy)
      ? targetedToken.controlledBy
      : [],
    characterType: linkedChar?.type || targetedToken.characterType || "npc",
  };
}

/**
 * Constrói o payload de alvos anexado às mensagens de chat (suporta múltiplos alvos e alvo único)
 */
export function buildTargetInfo({
  targetedToken,
  targetedTokens = [],
  allCharacters = [],
  attackTotal = null,
  isAttackRoll = false,
}) {
  const tokenList =
    Array.isArray(targetedTokens) && targetedTokens.length > 0
      ? targetedTokens
      : targetedToken
      ? [targetedToken]
      : [];

  if (tokenList.length === 0) return null;

  const resolvedTargets = tokenList.map((tok) => {
    const resolved = resolveTokenTargetData({ targetedToken: tok, allCharacters });
    const hasAttackComparison = isAttackRoll && attackTotal !== null && attackTotal !== undefined;
    const isHit = hasAttackComparison ? Number(attackTotal) >= Number(resolved.defense) : null;
    return {
      ...resolved,
      isAttackRoll: Boolean(isAttackRoll),
      isHit,
    };
  });

  const primary = resolvedTargets[0];
  const anyHit = resolvedTargets.some((t) => t.isHit === true);
  const allHit = resolvedTargets.every((t) => t.isHit === true);
  const anyMiss = resolvedTargets.some((t) => t.isHit === false);

  return {
    ...primary,
    targets: resolvedTargets,
    targetCount: resolvedTargets.length,
    isAttackRoll: Boolean(isAttackRoll),
    isHit: resolvedTargets.length > 1 ? anyHit : primary.isHit,
    anyHit,
    allHit,
    anyMiss,
  };
}

/**
 * Verifica se o usuário atual pode ver a Defesa numérica do alvo (quando tem acesso à ficha/token):
 * - Mestre (GM) sempre vê.
 * - Jogador vê quando tem acesso à ficha vinculada (ownerId, editableBy, visibleTo ou lista characters) ou controle do token.
 */
export function canUserSeeTargetDefense({ user, isGM, targetInfo, accessibleCharacters = [] }) {
  if (!user || !targetInfo) return false;
  if (isGM) return true;

  const uid = user.uid;
  if (!uid) return false;

  if (targetInfo.ownerId && targetInfo.ownerId === uid) {
    return true;
  }
  if (
    Array.isArray(targetInfo.editableBy) &&
    (targetInfo.editableBy.includes(uid) || targetInfo.editableBy.includes("ALL"))
  ) {
    return true;
  }
  if (
    Array.isArray(targetInfo.visibleTo) &&
    (targetInfo.visibleTo.includes(uid) || targetInfo.visibleTo.includes("ALL"))
  ) {
    return true;
  }
  if (
    Array.isArray(accessibleCharacters) &&
    accessibleCharacters.some(
      (c) =>
        (targetInfo.characterId && c.id === targetInfo.characterId) ||
        (targetInfo.name && c.name?.trim().toLowerCase() === targetInfo.name?.trim().toLowerCase())
    )
  ) {
    return true;
  }
  if (
    !targetInfo.characterId &&
    Array.isArray(targetInfo.controlledBy) &&
    (targetInfo.controlledBy.includes(uid) || targetInfo.controlledBy.includes("ALL"))
  ) {
    return true;
  }

  return false;
}

/**
 * Verifica se o usuário atual pode ver o desfecho de Acerto/Erro do ataque contra o alvo:
 * - O Mestre (GM) sempre vê.
 * - Quem tem acesso à ficha/token alvo vê.
 * - O atacante (emissor da rolagem) também vê se acertou ou errou.
 */
export function canUserSeeTargetOutcome({
  user,
  isGM,
  targetInfo,
  senderId = null,
  accessibleCharacters = [],
}) {
  if (!user || !targetInfo) return false;
  if (isGM) return true;
  if (senderId && user.uid && senderId === user.uid) return true;
  return canUserSeeTargetDefense({ user, isGM, targetInfo, accessibleCharacters });
}

/**
 * Determina se o usuário atual é o controlador responsável por receber o pop-up automático de Teste de Resistência
 */
export function isUserResponsibleForSavingThrow({ user, isGM, savingThrowRequest, campaignGMId }) {
  if (!user || !savingThrowRequest) return false;
  const uid = user.uid;

  const ownerId = savingThrowRequest.targetOwnerId;
  const editableBy = Array.isArray(savingThrowRequest.targetEditableBy)
    ? savingThrowRequest.targetEditableBy
    : [];
  const characterType = savingThrowRequest.targetCharacterType || "npc";

  // Verifica se existe um jogador dono (diferente do GM)
  const nonGmEditors = editableBy.filter((id) => id && id !== "ALL" && id !== campaignGMId);
  const hasPlayerOwner =
    characterType === "pc" ||
    (ownerId && ownerId !== campaignGMId) ||
    nonGmEditors.length > 0;

  if (hasPlayerOwner) {
    if (ownerId === uid || editableBy.includes(uid)) {
      return true;
    }
    return false;
  }

  // Se for NPC ou sem jogador dono, o Mestre responde
  return Boolean(isGM);
}

// ============================================================================
// PIPELINE EXTENSÍVEL DE MODIFICADORES DE EFEITO (DANO, CURA, REDUÇÕES, PASSIVAS)
// ============================================================================

const registeredModifierHooks = [];

/**
 * Permite que futuros módulos (itens, passivas, condições, buffs) registrem funções
 * para interceptar e modificar efeitos antes da aplicação final.
 * Assinatura do hook: (context) => ({ flatDelta?: number, multiplier?: number, label?: string })
 */
export function registerCombatModifierHook(hookFn) {
  if (typeof hookFn === "function" && !registeredModifierHooks.includes(hookFn)) {
    registeredModifierHooks.push(hookFn);
  }
  return () => {
    const idx = registeredModifierHooks.indexOf(hookFn);
    if (idx !== -1) registeredModifierHooks.splice(idx, 1);
  };
}

/**
 * Extrai modificadores declarativos presentes na ficha/token (habilidades passivas, itens equipados, condições)
 * Estrutura esperada em futuras expansões:
 * item/skill/condition.combatModifiers = [{ id, label, phase: 'outgoing'|'incoming', effectTypes: ['damage'], flatDelta: -2, multiplier: 1, enabled: true }]
 */
export function collectEntityCombatModifiers(entity, phase = "incoming", effectType = "damage") {
  if (!entity) return [];
  const collected = [];

  const scanList = (items, sourceTag) => {
    if (!Array.isArray(items)) return;
    items.forEach((entry) => {
      if (!entry || entry.enabled === false) return;
      const mods = Array.isArray(entry.combatModifiers) ? entry.combatModifiers : [];
      mods.forEach((mod) => {
        if (!mod || mod.enabled === false) return;
        if (mod.phase && mod.phase !== phase) return;
        if (
          Array.isArray(mod.effectTypes) &&
          mod.effectTypes.length > 0 &&
          !mod.effectTypes.includes(effectType)
        ) {
          return;
        }
        collected.push({
          id: mod.id || entry.id || `${sourceTag}_${collected.length}`,
          label: mod.label || entry.name || "Modificador",
          phase,
          flatDelta: Number(mod.flatDelta) || 0,
          multiplier: mod.multiplier !== undefined ? Number(mod.multiplier) : 1,
        });
      });
    });
  };

  scanList(entity.combatModifiers ? [{ combatModifiers: entity.combatModifiers }] : [], "direct");
  scanList(entity.abilities, "ability");
  scanList(entity.inventory, "item");
  scanList(entity.conditions, "condition");

  return collected;
}

/**
 * Calcula o valor final de um efeito (Dano, Cura, PE) passando pelo pipeline extensível:
 * 1. Valor Base (ou Valor Personalizado)
 * 2. Modificadores de Saída (Atacante/Origem: bônus passivos, buffs)
 * 3. Modificadores de Entrada (Alvo: reduções de dano, armaduras, resistências, vulnerabilidades)
 * 4. Hooks registrados dinamicamente
 * 5. Escala de Aplicação do Mestre: Completo (100%), Metade (50%) ou Personalizado
 */
export function computeModifiedEffectValue({
  baseValue = 0,
  scaleMode = "full", // "full" | "half" | "custom"
  customValue = null,
  effectType = "damage",
  sourceCharacter = null,
  targetCharacter = null,
  targetToken = null,
  manualModifiers = [],
}) {
  const effectMeta =
    EFFECT_TYPES.find((e) => e.id === effectType) || EFFECT_TYPES[0];

  const initialBase =
    scaleMode === "custom" && customValue !== null && customValue !== ""
      ? Math.max(0, Number(customValue) || 0)
      : Math.max(0, Number(baseValue) || 0);

  let current = initialBase;
  const appliedModifiers = [];

  // Se o mestre escolheu um valor personalizado exato, ainda assim registramos os modificadores se passados manualmente,
  // ou aplicamos o pipeline padrão nos modos "full" e "half".
  const outgoingMods = [
    ...collectEntityCombatModifiers(sourceCharacter, "outgoing", effectType),
    ...manualModifiers.filter((m) => m && m.phase === "outgoing" && m.enabled !== false),
  ];

  const incomingMods = [
    ...collectEntityCombatModifiers(targetCharacter, "incoming", effectType),
    ...collectEntityCombatModifiers(targetToken, "incoming", effectType),
    ...manualModifiers.filter((m) => m && m.phase !== "outgoing" && m.enabled !== false),
  ];

  const applyModList = (mods) => {
    mods.forEach((mod) => {
      const flat = Number(mod.flatDelta) || 0;
      const mult = mod.multiplier !== undefined ? Number(mod.multiplier) : 1;
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
          multiplier: mult,
        });
      }
    });
  };

  if (scaleMode !== "custom") {
    applyModList(outgoingMods);
    applyModList(incomingMods);

    registeredModifierHooks.forEach((hookFn) => {
      try {
        const res = hookFn({
          baseValue: initialBase,
          currentValue: current,
          effectType,
          sourceCharacter,
          targetCharacter,
          targetToken,
        });
        if (res) {
          const flat = Number(res.flatDelta) || 0;
          const mult = res.multiplier !== undefined ? Number(res.multiplier) : 1;
          if (flat !== 0) current = Math.max(0, current + flat);
          if (Number.isFinite(mult) && mult !== 1) current = Math.max(0, current * mult);
          if (flat !== 0 || mult !== 1) {
            appliedModifiers.push({
              id: res.id || "hook",
              label: res.label || "Efeito Passivo",
              flatDelta: flat,
              multiplier: mult,
            });
          }
        }
      } catch (err) {
        console.error("Erro em hook de modificador de combate:", err);
      }
    });
  } else {
    // Em modo custom, aplica apenas modificadores manuais explicitamente marcados na janela
    applyModList(manualModifiers.filter((m) => m && m.enabled !== false));
  }

  let finalValue = Math.round(current);
  if (scaleMode === "half") {
    finalValue = Math.floor(current / 2);
  }
  finalValue = Math.max(0, finalValue);

  const resourceDelta = finalValue * (effectMeta.deltaSign || 0);

  return {
    baseValue: initialBase,
    finalValue,
    scaleMode,
    effectType: effectMeta.id,
    resourceKey: effectMeta.resourceKey,
    resourceDelta,
    appliedModifiers,
  };
}

