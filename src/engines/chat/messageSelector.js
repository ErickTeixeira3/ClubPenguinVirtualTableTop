// TRANSITION(T5): remover na Fase 10 quando o chat for reescrito para consumir o schema v2.
// Este é o único adaptador permitido entre mensagens v2 e os cards/chat ainda v1.

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function getMessageCreatedAtMs(message) {
  const createdAt = message?.createdAt;
  if (typeof createdAt?.toMillis === "function") {
    return createdAt.toMillis();
  }
  if (createdAt instanceof Date) {
    return createdAt.getTime();
  }
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt;
  }
  // Compatibilidade exclusivamente para a janela entre carregamento v1 e aplicação da M008.
  return typeof message?.timestampMs === "number" && Number.isFinite(message.timestampMs)
    ? message.timestampMs
    : 0;
}

export function selectMessageView(message) {
  const src = asRecord(message) || {};
  const senderV2 = asRecord(src.sender);
  const sender = senderV2
    ? {
        uid: asString(senderV2.uid),
        characterId: asString(senderV2.characterId) || null,
        displayName: asString(senderV2.displayName, "Pinguim"),
        image: asRecord(senderV2.image) || { mediaId: null, url: null }
      }
    : {
        uid: asString(src.senderId),
        characterId: asString(src.characterId) || null,
        displayName: asString(src.senderName, "Pinguim"),
        image: {
          mediaId:
            asString(src.characterMediaId) ||
            asString(src.senderAvatarMediaId) ||
            null,
          url: asString(src.senderPhotoURL) || null
        }
      };

  const seqNumber = Number(src.seq);
  return {
    id: asString(src.id) || null,
    type: src.type === "ability_roll" ? "roll" : asString(src.type, "text"),
    seq: Number.isInteger(seqNumber) ? seqNumber : null,
    visibility: asString(src.visibility, "public"),
    visibleTo: Array.isArray(src.visibleTo) ? src.visibleTo : [],
    sender,
    status: asString(src.status, "committed"),
    opId: asString(src.opId) || null,
    content: asString(src.content),
    emote: asRecord(src.emote) || (src.type === "emote" && src.icon ? { icon: src.icon } : null),
    skillPing: asRecord(src.skillPing) || asRecord(src.skillData),
    roll: asRecord(src.roll) || asRecord(src.rollData),
    createdAt: src.createdAt ?? null,
    createdAtMs: getMessageCreatedAtMs(src),
    raw: src
  };
}

function buildLegacyTargetInfo(roll) {
  if (asRecord(roll?.targetInfo)) {
    return roll.targetInfo;
  }
  const targets = Array.isArray(roll?.targets) ? roll.targets : [];
  if (targets.length === 0) return null;

  const results = Array.isArray(roll?.hitEvaluation?.results)
    ? roll.hitEvaluation.results
    : [];
  const mapTarget = (target) => {
    const outcome = results.find((entry) => entry?.tokenId === target?.tokenId) || null;
    return {
      tokenId: target?.tokenId || null,
      sceneId: target?.sceneId || null,
      characterId: target?.characterId || null,
      name: target?.label || "Alvo",
      label: target?.label || "Alvo",
      isAttackRoll: roll?.kind === "attack",
      isHit: typeof outcome?.hit === "boolean" ? outcome.hit : null,
      isCrit: Boolean(outcome?.crit),
      isFumble: Boolean(outcome?.fumble)
    };
  };

  const mapped = targets.map(mapTarget);
  return mapped.length === 1
    ? mapped[0]
    : {
        targets: mapped,
        isAttackRoll: roll?.kind === "attack",
        name: `${mapped.length} alvos`
      };
}

function buildLegacyAppliedEffects(appliedEffects) {
  if (Array.isArray(appliedEffects)) return appliedEffects;
  const map = asRecord(appliedEffects);
  if (!map) return [];
  return Object.entries(map).map(([opId, effect]) => ({
    opId,
    ...(asRecord(effect) || {}),
    label: effect?.effectType || "efeito",
    targetName: effect?.targetLabel || "Alvo"
  }));
}

function buildLegacyRollData(roll) {
  if (!roll) return null;
  const targetInfo = buildLegacyTargetInfo(roll);
  const savingThrowRequest = roll.savingThrowRequest
    ? {
        ...roll.savingThrowRequest,
        attribute:
          roll.savingThrowRequest.attributeKey ?? roll.savingThrowRequest.attribute,
        sourceRollName:
          roll.savingThrowRequest.sourceName ?? roll.savingThrowRequest.sourceRollName
      }
    : null;
  return {
    ...roll,
    rollKind: roll.kind ?? roll.rollKind ?? null,
    categoryColor: roll.color ?? roll.categoryColor ?? "#02529c",
    targetInfo,
    savingThrowRequest,
    respondedToSaveId: roll.respondsTo?.saveId ?? roll.respondedToSaveId ?? null,
    parentMessageId: roll.respondsTo?.messageId ?? roll.parentMessageId ?? null,
    appliedEffects: buildLegacyAppliedEffects(roll.appliedEffects)
  };
}

export function adaptMessageForLegacyChat(message) {
  const view = selectMessageView(message);
  const image = view.sender.image || {};
  const rollData = buildLegacyRollData(view.roll);
  const icon = view.emote?.icon || view.roll?.icon || view.raw.icon || null;
  return {
    ...view.raw,
    id: view.id,
    type: view.type,
    seq: view.seq,
    visibility: view.visibility,
    visibleTo: view.visibleTo,
    sender: view.sender,
    senderId: view.sender.uid,
    senderName: view.sender.displayName,
    senderPhotoURL: image.url || null,
    senderAvatarMediaId: view.sender.characterId ? null : image.mediaId || null,
    characterId: view.sender.characterId,
    characterMediaId: view.sender.characterId ? image.mediaId || null : null,
    emote: view.emote,
    icon,
    skillPing: view.skillPing,
    skillData: view.skillPing,
    roll: view.roll,
    rollData,
    content: view.content,
    status: view.status,
    opId: view.opId,
    createdAt: view.createdAt,
    timestampMs: view.createdAtMs
  };
}

export function compareMessagesBySeq(left, right) {
  const a = selectMessageView(left);
  const b = selectMessageView(right);
  if (a.seq !== null && b.seq !== null && a.seq !== b.seq) {
    return a.seq - b.seq;
  }
  if (a.seq !== null && b.seq === null) return 1;
  if (a.seq === null && b.seq !== null) return -1;
  const byTime = a.createdAtMs - b.createdAtMs;
  if (byTime !== 0) return byTime;
  return String(a.id || "").localeCompare(String(b.id || ""));
}
