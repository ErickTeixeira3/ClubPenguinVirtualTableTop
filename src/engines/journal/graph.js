import { NOTE_SCOPES, NOTE_TYPES } from "../../domain/constants.js";
import { DEFAULT_NAMES } from "../../domain/defaults.js";
import { canReadResource } from "../../domain/permissions.js";
import { detectAliasMentions } from "./aliasMatcher.js";
import { extractNoteText } from "./sections.js";

export function buildGraphForReader(options = {}) {
  const params = options && typeof options === "object" ? options : {};
  const safeViewer =
    params.viewer && typeof params.viewer === "object" ? params.viewer : {};
  const safeNotes = Array.isArray(params.notes) ? params.notes : [];
  const typesMap =
    params.enabledTypes && typeof params.enabledTypes === "object"
      ? params.enabledTypes
      : null;

  const accessibleNotes = safeNotes.filter(
    (note) =>
      note &&
      typeof note === "object" &&
      !Array.isArray(note) &&
      typeof note.id === "string" &&
      note.id.trim().length > 0 &&
      note.isDeleted !== true &&
      canReadResource(note, safeViewer)
  );

  const visibleNotes = accessibleNotes.filter((note) => {
    const noteType = note.noteType || NOTE_TYPES.LORE;
    return typesMap ? typesMap[noteType] !== false : true;
  });

  const visibleIdSet = new Set(visibleNotes.map((note) => note.id));

  const total = Math.max(1, visibleNotes.length);
  const centerX = 600;
  const centerY = 380;
  const radius = Math.min(310, Math.max(140, total * 28));

  const nodes = visibleNotes.map((note, idx) => {
    const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
    const defaultX = Math.round(centerX + radius * Math.cos(angle));
    const defaultY = Math.round(centerY + radius * Math.sin(angle));

    const pos = note.graphPosition;
    const hasSavedPos = Boolean(
      pos &&
        typeof pos === "object" &&
        typeof pos.x === "number" &&
        Number.isFinite(pos.x) &&
        typeof pos.y === "number" &&
        Number.isFinite(pos.y)
    );

    return {
      id: note.id,
      title:
        typeof note.title === "string" && note.title.trim()
          ? note.title.trim()
          : DEFAULT_NAMES.note,
      noteType: note.noteType || NOTE_TYPES.LORE,
      scope: note.scope || NOTE_SCOPES.PARTY,
      aliases: Array.isArray(note.aliases) ? note.aliases : [],
      linkedCharacterId: note.linkedCharacterId ?? null,
      x: hasSavedPos ? pos.x : defaultX,
      y: hasSavedPos ? pos.y : defaultY,
      pinned: Boolean(pos?.pinned),
      note
    };
  });

  const edgesMap = new Map();

  for (const sourceNote of visibleNotes) {
    const relatedIds = Array.isArray(sourceNote.relatedNoteIds)
      ? sourceNote.relatedNoteIds
      : [];
    for (const rawTargetId of relatedIds) {
      if (typeof rawTargetId !== "string") {
        continue;
      }
      const targetId = rawTargetId.trim();
      if (!targetId || targetId === sourceNote.id || !visibleIdSet.has(targetId)) {
        continue;
      }
      const pairKey = [sourceNote.id, targetId].sort().join("__");
      if (!edgesMap.has(pairKey)) {
        edgesMap.set(pairKey, {
          id: pairKey,
          sourceId: sourceNote.id,
          targetId,
          kind: "explicit"
        });
      }
    }
  }

  for (const sourceNote of visibleNotes) {
    const noteText = extractNoteText(sourceNote);
    const { mentionedNoteIds } = detectAliasMentions(
      noteText,
      visibleNotes,
      sourceNote.id,
      sourceNote.ignoredAliases
    );
    for (const targetId of mentionedNoteIds) {
      if (targetId === sourceNote.id || !visibleIdSet.has(targetId)) {
        continue;
      }
      const pairKey = [sourceNote.id, targetId].sort().join("__");
      if (!edgesMap.has(pairKey)) {
        edgesMap.set(pairKey, {
          id: pairKey,
          sourceId: sourceNote.id,
          targetId,
          kind: "alias"
        });
      }
    }
  }

  return {
    nodes,
    edges: Array.from(edgesMap.values())
  };
}
