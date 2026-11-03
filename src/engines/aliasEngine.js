export const NOTE_TYPES = [
  { key: "quest", label: "Missões", singular: "Missão", color: "#fdd835" },
  { key: "location", label: "Lugares", singular: "Lugar", color: "#1e88e5" },
  { key: "character", label: "Personagens", singular: "Personagem", color: "#e53935" },
  { key: "lore", label: "Lore", singular: "Lore", color: "#00bcd4" },
  { key: "event", label: "Eventos", singular: "Evento", color: "#6a1b9a" }
];

export function getNoteTypeMeta(noteType) {
  return (
    NOTE_TYPES.find((t) => t.key === noteType) || {
      key: "lore",
      label: "Lore",
      singular: "Lore",
      color: "#3090f0"
    }
  );
}

export function normalizeAliasText(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNormalizedAliases(title, aliasesArray = []) {
  const rawList = [title, ...(Array.isArray(aliasesArray) ? aliasesArray : [])];
  const normalizedSet = new Set();

  rawList.forEach((item) => {
    const norm = normalizeAliasText(item);
    if (norm && norm.length >= 2) {
      normalizedSet.add(norm);
    }
  });

  return Array.from(normalizedSet);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detecta menções de aliases no texto apenas entre os cards aos quais o usuário tem acesso (Anti-Spoiler)
export function detectAliasMentionsInText(
  content,
  accessibleNotes = [],
  currentNoteId = null
) {
  const normalizedContent = normalizeAliasText(content);
  if (!normalizedContent) {
    return { mentionedNoteIds: [], matchedDetails: [] };
  }

  const mentionedNoteIds = [];
  const matchedDetails = [];

  for (const note of accessibleNotes) {
    if (!note || !note.id || note.id === currentNoteId) continue;

    const terms = Array.isArray(note.aliasesNormalized)
      ? note.aliasesNormalized
      : buildNormalizedAliases(note.title, note.aliases);

    // Ordena termos mais longos primeiro para priorizar nomes compostos (ex: "monstro do mau")
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);

    let matchedTerm = null;
    for (const term of sortedTerms) {
      if (!term || term.length < 2) continue;
      const pattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegex(term)}(?=$|[^a-z0-9])`,
        "i"
      );
      if (pattern.test(normalizedContent)) {
        matchedTerm = term;
        break;
      }
    }

    if (matchedTerm) {
      mentionedNoteIds.push(note.id);
      matchedDetails.push({
        noteId: note.id,
        title: note.title,
        noteType: note.noteType,
        matchedAlias: matchedTerm
      });
    }
  }

  return {
    mentionedNoteIds: Array.from(new Set(mentionedNoteIds)),
    matchedDetails
  };
}

// Constrói os nós e arestas para a Visão de Teia (Grafo Interativo)
export function buildGraphData(
  notes = [],
  enabledTypesMap = {
    quest: true,
    location: true,
    character: true,
    lore: true,
    event: true
  }
) {
  const visibleNotes = notes.filter(
    (n) => enabledTypesMap[n.noteType || "lore"] !== false
  );
  const visibleIdSet = new Set(visibleNotes.map((n) => n.id));

  // Posicionamento circular distribuído para nós que ainda não foram arrastados manualmente
  const total = Math.max(1, visibleNotes.length);
  const centerX = 600;
  const centerY = 380;
  const radius = Math.min(310, Math.max(140, total * 28));

  const nodes = visibleNotes.map((n, index) => {
    const angle = (2 * Math.PI * index) / total - Math.PI / 2;
    const defaultX = Math.round(centerX + radius * Math.cos(angle));
    const defaultY = Math.round(centerY + radius * Math.sin(angle));

    const hasSavedPos =
      typeof n.graphNode?.x === "number" && typeof n.graphNode?.y === "number";

    const meta = getNoteTypeMeta(n.noteType);

    return {
      id: n.id,
      title: n.title || "Sem Título",
      noteType: n.noteType || "lore",
      scope: n.scope || "party",
      color: meta.color,
      typeLabel: meta.singular,
      aliases: Array.isArray(n.aliases) ? n.aliases : [],
      x: hasSavedPos ? n.graphNode.x : defaultX,
      y: hasSavedPos ? n.graphNode.y : defaultY,
      rawNote: n
    };
  });

  // Constrói arestas combinando vínculos explícitos (relatedNoteIds) e aliases detectados no texto
  const edgesMap = new Map();

  for (const sourceNote of visibleNotes) {
    const explicitTargets = Array.isArray(sourceNote.relatedNoteIds)
      ? sourceNote.relatedNoteIds
      : [];

    const liveMentions = detectAliasMentionsInText(
      sourceNote.content,
      visibleNotes,
      sourceNote.id
    ).mentionedNoteIds;

    const savedMentions = Array.isArray(sourceNote.mentionedNoteIds)
      ? sourceNote.mentionedNoteIds
      : [];

    const allMentions = new Set([...liveMentions, ...savedMentions]);

    explicitTargets.forEach((targetId) => {
      if (!visibleIdSet.has(targetId) || targetId === sourceNote.id) return;
      const pairKey = [sourceNote.id, targetId].sort().join("__");
      edgesMap.set(pairKey, {
        id: pairKey,
        sourceId: sourceNote.id,
        targetId,
        kind: "explicit"
      });
    });

    allMentions.forEach((targetId) => {
      if (!visibleIdSet.has(targetId) || targetId === sourceNote.id) return;
      const pairKey = [sourceNote.id, targetId].sort().join("__");
      if (!edgesMap.has(pairKey)) {
        edgesMap.set(pairKey, {
          id: pairKey,
          sourceId: sourceNote.id,
          targetId,
          kind: "alias"
        });
      }
    });
  }

  return {
    nodes,
    edges: Array.from(edgesMap.values())
  };
}

