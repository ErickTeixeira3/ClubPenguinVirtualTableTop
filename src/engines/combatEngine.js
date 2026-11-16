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

export const ROLL_KINDS = {
  ATTACK: "attack",
  DAMAGE: "damage",
  HEAL: "heal",
  MP_DAMAGE: "mp_damage",
  MP_HEAL: "mp_heal",
  SAVING_THROW: "saving_throw",
  CHECK: "check",
  UTILITY: "utility",
};

export const METERS_PER_CELL = 1.5;
export const DEFAULT_MOVEMENT_BUDGET_METERS = 9;

export const DEFAULT_COMBAT_STATE = {
  active: false,
  round: 1,
  activeTurnIndex: 0,
  lockMovementOutsideTurn: true,
  lockActionsOutsideTurn: true,
  turnOrder: [],
};

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
 * Normaliza `controlledBy` aceitando o formato atual de mapa (`{ [uid]: true }` / `{ ALL: true }`)
 * e o formato legado de array (`["ALL"]` / `["uid1", ...]`), incluindo objetos esparsos numericos do RTDB.
 */
export function normalizeControlledByList(controlledBy) {
  if (Array.isArray(controlledBy)) {
    return Array.from(
      new Set(
        controlledBy
          .filter((id) => typeof id === "string" && id.trim())
          .map((id) => id.trim())
      )
    );
  }
  if (controlledBy && typeof controlledBy === "object") {
    const ids = [];
    for (const [key, val] of Object.entries(controlledBy)) {
      if (val === true && key.trim()) {
        ids.push(key.trim());
      } else if (/^\d+$/.test(key) && typeof val === "string" && val.trim()) {
        ids.push(val.trim());
      }
    }
    return Array.from(new Set(ids));
  }
  return [];
}

/**
 * Converte uma lista ou mapa de controladores em mapa `{ [uid]: true }` para o RTDB (A33).
 */
export function toControlledByMap(controlledBy) {
  const map = {};
  for (const id of normalizeControlledByList(controlledBy)) {
    map[id] = true;
  }
  return map;
}

/**
 * Verifica se o usuario (`uid`) ou `"ALL"` possui controle no campo `controlledBy` (mapa ou array).
 */
export function hasControlledByAccess(controlledBy, uid) {
  if (!controlledBy) return false;
  if (!Array.isArray(controlledBy) && typeof controlledBy === "object") {
    if (controlledBy.ALL === true) return true;
    if (uid && controlledBy[uid] === true) return true;
  }
  const list = normalizeControlledByList(controlledBy);
  return list.includes("ALL") || Boolean(uid && list.includes(uid));
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

  const isNpcOrGmInstance =
    Boolean(targetedToken.isGmToken) ||
    linkedChar?.type === "npc" ||
    targetedToken.characterType === "npc";
  const hasTokenDefense =
    targetedToken.defense !== undefined &&
    targetedToken.defense !== null &&
    targetedToken.defense !== "";

  // Fase 6.7 (A22): instâncias de NPC/Mestre têm a Defesa do token como fonte autoritativa em cena;
  // PCs mantêm prioridade da ficha (sincronizada com o token quando visível).
  const defense = isNpcOrGmInstance
    ? hasTokenDefense
      ? Number(targetedToken.defense) || 0
      : Number(linkedChar?.defense ?? 10) || 0
    : linkedChar?.defense !== undefined && linkedChar?.defense !== null
    ? Number(linkedChar.defense) || 0
    : hasTokenDefense
    ? Number(targetedToken.defense) || 0
    : 10;

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
    controlledBy: normalizeControlledByList(targetedToken.controlledBy),
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
  const hasAttackComparison =
    Boolean(isAttackRoll) && resolvedTargets.some((t) => t.isHit !== null);
  const anyHit = resolvedTargets.some((t) => t.isHit === true);
  const allHit = hasAttackComparison && resolvedTargets.every((t) => t.isHit === true);
  const anyMiss = resolvedTargets.some((t) => t.isHit === false);

  return {
    ...primary,
    targets: resolvedTargets,
    targetCount: resolvedTargets.length,
    isAttackRoll: Boolean(isAttackRoll),
    isHit: !hasAttackComparison ? null : resolvedTargets.length > 1 ? anyHit : primary.isHit,
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
    hasControlledByAccess(targetInfo.controlledBy, uid)
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

// ============================================================================
// BASE ESTRUTURAL DO MODO DE TURNO (combatState) - SELETORES E TRANSIÇÕES PURAS
// ============================================================================

export function normalizeCombatant(entry = {}, fallbackIndex = 0) {
  const movementBudgetMeters = Number(entry.movementBudgetMeters ?? DEFAULT_MOVEMENT_BUDGET_METERS);
  const movementUsedMeters = Math.max(0, Number(entry.movementUsedMeters ?? 0) || 0);
  const actionsMax = Math.max(0, Number(entry.actionsMax ?? 1) || 1);
  const actionsRemaining = Math.max(
    0,
    Number(entry.actionsRemaining !== undefined ? entry.actionsRemaining : actionsMax) || 0
  );
  const reactionsMax = Math.max(0, Number(entry.reactionsMax ?? 1) || 1);
  const reactionsRemaining = Math.max(
    0,
    Number(entry.reactionsRemaining !== undefined ? entry.reactionsRemaining : reactionsMax) || 0
  );

  return {
    combatantId: entry.combatantId || entry.tokenId || entry.characterId || `comb_${fallbackIndex}`,
    tokenId: entry.tokenId || null,
    characterId: entry.characterId || null,
    ownerId: entry.ownerId || null,
    name: entry.name || "Combatente",
    initiative: Number(entry.initiative) || 0,
    movementBudgetMeters: Number.isFinite(movementBudgetMeters)
      ? Math.max(0, movementBudgetMeters)
      : DEFAULT_MOVEMENT_BUDGET_METERS,
    movementUsedMeters,
    actionsMax,
    actionsRemaining,
    reactionsMax,
    reactionsRemaining,
  };
}

export function normalizeCombatState(rawCombatState = null) {
  const src = rawCombatState && typeof rawCombatState === "object" ? rawCombatState : {};
  const turnOrder = Array.isArray(src.turnOrder)
    ? src.turnOrder.map((c, idx) => normalizeCombatant(c, idx))
    : [];
  const rawIdx = Number(src.activeTurnIndex) || 0;
  const activeTurnIndex =
    turnOrder.length > 0 ? Math.max(0, Math.min(turnOrder.length - 1, rawIdx)) : 0;

  return {
    active: Boolean(src.active),
    round: Math.max(1, Number(src.round) || 1),
    activeTurnIndex,
    lockMovementOutsideTurn: src.lockMovementOutsideTurn !== false,
    lockActionsOutsideTurn: src.lockActionsOutsideTurn !== false,
    turnOrder,
  };
}

export function getActiveCombatant(combatState) {
  const state = normalizeCombatState(combatState);
  if (!state.active || state.turnOrder.length === 0) return null;
  return state.turnOrder[state.activeTurnIndex] || null;
}

function matchesCombatant(combatant, actorRef) {
  if (!combatant || !actorRef) return false;
  if (typeof actorRef === "string") {
    return (
      combatant.combatantId === actorRef ||
      combatant.tokenId === actorRef ||
      combatant.characterId === actorRef
    );
  }
  const refTokenId = actorRef.tokenId || (actorRef.sceneId ? actorRef.id : null);
  const refCharId = actorRef.characterId || (!actorRef.sceneId && actorRef.attributes ? actorRef.id : null);
  if (actorRef.combatantId && combatant.combatantId === actorRef.combatantId) return true;
  if (refTokenId && combatant.tokenId === refTokenId) return true;
  if (refCharId && combatant.characterId === refCharId) return true;
  if (actorRef.id && (combatant.combatantId === actorRef.id || combatant.tokenId === actorRef.id || combatant.characterId === actorRef.id)) {
    return true;
  }
  return false;
}

export function findCombatantByActor(combatState, actorRef) {
  const state = normalizeCombatState(combatState);
  return state.turnOrder.find((c) => matchesCombatant(c, actorRef)) || null;
}

export function isActorTurn(combatState, actorRef) {
  const state = normalizeCombatState(combatState);
  if (!state.active) return true;
  const active = getActiveCombatant(state);
  return Boolean(active && matchesCombatant(active, actorRef));
}

export function computeMoveDistanceMeters({
  fromX = 0,
  fromY = 0,
  toX = 0,
  toY = 0,
  cellSizePx = 64,
  metersPerCell = METERS_PER_CELL,
}) {
  const safeCellPx = Math.max(8, Number(cellSizePx) || 64);
  const distPx = Math.hypot((Number(toX) || 0) - (Number(fromX) || 0), (Number(toY) || 0) - (Number(fromY) || 0));
  return Number(((distPx / safeCellPx) * metersPerCell).toFixed(2));
}

export function evaluateActorMove(combatState, actorIdOrRef, distanceMeters = 0, options = {}) {
  const state = normalizeCombatState(combatState);
  const isGM = Boolean(options.isGM);
  const combatant = findCombatantByActor(state, actorIdOrRef);
  const dist = Math.max(0, Number(distanceMeters) || 0);

  if (!state.active || isGM) {
    return {
      allowed: true,
      reason: null,
      remainingMeters: combatant
        ? Math.max(0, combatant.movementBudgetMeters - combatant.movementUsedMeters)
        : DEFAULT_MOVEMENT_BUDGET_METERS,
      nextMovementUsedMeters: combatant ? combatant.movementUsedMeters + dist : dist,
      combatant,
    };
  }

  const onTurn = isActorTurn(state, actorIdOrRef);
  if (!onTurn && state.lockMovementOutsideTurn) {
    return {
      allowed: false,
      reason: "Aguarde seu turno para mover este token.",
      remainingMeters: 0,
      nextMovementUsedMeters: combatant ? combatant.movementUsedMeters : 0,
      combatant,
    };
  }

  if (!combatant) {
    return {
      allowed: !state.lockMovementOutsideTurn,
      reason: state.lockMovementOutsideTurn ? "Token fora da ordem de iniciativa." : null,
      remainingMeters: 0,
      nextMovementUsedMeters: 0,
      combatant: null,
    };
  }

  const remaining = Math.max(0, Number((combatant.movementBudgetMeters - combatant.movementUsedMeters).toFixed(2)));
  if (dist > remaining + 0.05) {
    return {
      allowed: false,
      reason: `Deslocamento insuficiente (${remaining.toFixed(1).replace(".", ",")}m restantes).`,
      remainingMeters: remaining,
      nextMovementUsedMeters: combatant.movementUsedMeters,
      combatant,
    };
  }

  return {
    allowed: true,
    reason: null,
    remainingMeters: Number(Math.max(0, remaining - dist).toFixed(2)),
    nextMovementUsedMeters: Number((combatant.movementUsedMeters + dist).toFixed(2)),
    combatant,
  };
}

export function canActorMove(combatState, actorIdOrRef, distanceMeters = 0, options = {}) {
  return evaluateActorMove(combatState, actorIdOrRef, distanceMeters, options).allowed;
}

export function evaluateActorAct(combatState, actorIdOrRef, actionKind = "active", options = {}) {
  const state = normalizeCombatState(combatState);
  const isGM = Boolean(options.isGM);
  const isFollowUp = Boolean(options.isFollowUp);
  const combatant = findCombatantByActor(state, actorIdOrRef);

  if (!state.active || isGM || isFollowUp || actionKind === "passive") {
    return {
      allowed: true,
      reason: null,
      budgetField: null,
      remaining: Infinity,
      combatant,
    };
  }

  const kind = String(actionKind || "active").toLowerCase();
  const isReaction = kind === "reaction" || kind === "on_save" || kind === "on_being_hit" || kind === "saving_throw";

  if (isReaction) {
    if (!combatant) {
      return { allowed: true, reason: null, budgetField: "reactionsRemaining", remaining: 1, combatant: null };
    }
    const rem = combatant.reactionsRemaining;
    return {
      allowed: rem > 0,
      reason: rem > 0 ? null : "Sem reações disponíveis nesta rodada.",
      budgetField: "reactionsRemaining",
      remaining: rem,
      combatant,
    };
  }

  if (kind === "check") {
    return { allowed: true, reason: null, budgetField: null, remaining: Infinity, combatant };
  }

  const onTurn = isActorTurn(state, actorIdOrRef);
  if (!onTurn && state.lockActionsOutsideTurn) {
    return {
      allowed: false,
      reason: "Aguarde seu turno para realizar ações ativas.",
      budgetField: "actionsRemaining",
      remaining: 0,
      combatant,
    };
  }

  if (!combatant) {
    return {
      allowed: !state.lockActionsOutsideTurn,
      reason: state.lockActionsOutsideTurn ? "Personagem fora da ordem de iniciativa." : null,
      budgetField: "actionsRemaining",
      remaining: 0,
      combatant: null,
    };
  }

  const rem = combatant.actionsRemaining;
  return {
    allowed: rem > 0,
    reason: rem > 0 ? null : "Você já utilizou sua ação neste turno.",
    budgetField: "actionsRemaining",
    remaining: rem,
    combatant,
  };
}

export function canActorAct(combatState, actorIdOrRef, actionKind = "active", options = {}) {
  return evaluateActorAct(combatState, actorIdOrRef, actionKind, options).allowed;
}

export function createCombatantEntry({ token = null, character = null, initiative = 0 }) {
  const budget = Number(character?.movementBudgetMeters ?? token?.movementBudgetMeters ?? DEFAULT_MOVEMENT_BUDGET_METERS);
  return normalizeCombatant({
    combatantId: token?.id || character?.id || `comb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    tokenId: token?.id || null,
    characterId: token?.characterId || character?.id || null,
    ownerId: token?.ownerId || character?.ownerId || null,
    name: token?.name || character?.name || "Combatente",
    initiative: Number(initiative) || 0,
    movementBudgetMeters: Number.isFinite(budget) ? budget : DEFAULT_MOVEMENT_BUDGET_METERS,
    movementUsedMeters: 0,
    actionsMax: 1,
    actionsRemaining: 1,
    reactionsMax: 1,
    reactionsRemaining: 1,
  });
}

export function sortTurnOrder(turnOrder = []) {
  return [...(Array.isArray(turnOrder) ? turnOrder : [])]
    .map((c, idx) => normalizeCombatant(c, idx))
    .sort((a, b) => {
      const diff = (Number(b.initiative) || 0) - (Number(a.initiative) || 0);
      if (diff !== 0) return diff;
      return (a.name || "").localeCompare(b.name || "");
    });
}

function resetCombatantTurnBudgets(combatant) {
  return {
    ...combatant,
    movementUsedMeters: 0,
    actionsRemaining: combatant.actionsMax ?? 1,
    reactionsRemaining: combatant.reactionsMax ?? 1,
  };
}

export function advanceTurnInState(combatState) {
  const state = normalizeCombatState(combatState);
  if (state.turnOrder.length === 0) return state;

  const isWrapping = state.activeTurnIndex + 1 >= state.turnOrder.length;
  const nextIndex = isWrapping ? 0 : state.activeTurnIndex + 1;
  const nextRound = isWrapping ? state.round + 1 : state.round;
  const nextTurnOrder = state.turnOrder.map((c, idx) =>
    idx === nextIndex ? resetCombatantTurnBudgets(c) : c
  );

  return {
    ...state,
    active: true,
    round: nextRound,
    activeTurnIndex: nextIndex,
    turnOrder: nextTurnOrder,
  };
}

export function regressTurnInState(combatState) {
  const state = normalizeCombatState(combatState);
  if (state.turnOrder.length === 0) return state;

  const isAtStart = state.activeTurnIndex === 0;
  if (isAtStart && state.round <= 1) {
    return state;
  }

  const nextIndex = isAtStart ? state.turnOrder.length - 1 : state.activeTurnIndex - 1;
  const nextRound = isAtStart ? Math.max(1, state.round - 1) : state.round;

  return {
    ...state,
    active: true,
    round: nextRound,
    activeTurnIndex: nextIndex,
  };
}

export function consumeMovementInState(combatState, actorIdOrRef, distanceMeters = 0) {
  const state = normalizeCombatState(combatState);
  if (!state.active) return state;
  const dist = Math.max(0, Number(distanceMeters) || 0);
  if (dist <= 0) return state;

  return {
    ...state,
    turnOrder: state.turnOrder.map((c) => {
      if (!matchesCombatant(c, actorIdOrRef)) return c;
      const nextUsed = Math.min(
        c.movementBudgetMeters,
        Number((c.movementUsedMeters + dist).toFixed(2))
      );
      return {
        ...c,
        movementUsedMeters: nextUsed,
      };
    }),
  };
}

export function consumeActionInState(combatState, actorIdOrRef, actionKind = "active") {
  const state = normalizeCombatState(combatState);
  if (!state.active) return state;
  const kind = String(actionKind || "active").toLowerCase();
  if (kind === "passive" || kind === "check") return state;

  const isReaction = kind === "reaction" || kind === "on_save" || kind === "on_being_hit" || kind === "saving_throw";

  return {
    ...state,
    turnOrder: state.turnOrder.map((c) => {
      if (!matchesCombatant(c, actorIdOrRef)) return c;
      if (isReaction) {
        return {
          ...c,
          reactionsRemaining: Math.max(0, c.reactionsRemaining - 1),
        };
      }
      return {
        ...c,
        actionsRemaining: Math.max(0, c.actionsRemaining - 1),
      };
    }),
  };
}

