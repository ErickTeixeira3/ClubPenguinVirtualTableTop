import { useCallback, useMemo, useReducer } from "react";
import { NOTE_TYPES } from "../../domain/constants.js";
import { normalizeAliasText } from "../../engines/journal/index.js";

function normalizeSectionsForDraft(rawSections) {
  const list = [];
  if (Array.isArray(rawSections)) {
    rawSections.forEach((sec, idx) => {
      if (!sec || typeof sec !== "object") return;
      const id =
        typeof sec.id === "string" && sec.id.trim() ? sec.id.trim() : `sec_${idx + 1}`;
      list.push({
        id,
        title: typeof sec.title === "string" ? sec.title : "",
        content: typeof sec.content === "string" ? sec.content : "",
        order:
          typeof sec.order === "number" && Number.isFinite(sec.order) ? sec.order : idx
      });
    });
  } else if (rawSections && typeof rawSections === "object") {
    let idx = 0;
    for (const [key, sec] of Object.entries(rawSections)) {
      if (!sec || typeof sec !== "object" || Array.isArray(sec)) continue;
      const id =
        typeof sec.id === "string" && sec.id.trim() ? sec.id.trim() : key.trim();
      if (!id) continue;
      list.push({
        id,
        title: typeof sec.title === "string" ? sec.title : "",
        content: typeof sec.content === "string" ? sec.content : "",
        order:
          typeof sec.order === "number" && Number.isFinite(sec.order) ? sec.order : idx
      });
      idx += 1;
    }
  }

  if (list.length === 0) {
    return [{ id: "sec_1", title: "", content: "", order: 0 }];
  }

  list.sort((a, b) => a.order - b.order);
  return list.map((sec, idx) => ({ ...sec, order: idx }));
}

function nextSectionId(sectionsOrder) {
  const existing = new Set((sectionsOrder || []).map((s) => s.id));
  let n = 1;
  while (existing.has(`sec_${n}`)) {
    n += 1;
  }
  return `sec_${n}`;
}

export function createInitialNoteDraftState(note = null) {
  return {
    title: typeof note?.title === "string" ? note.title : "",
    noteType: note?.noteType || NOTE_TYPES.LORE,
    folderId: typeof note?.folderId === "string" ? note.folderId : "",
    linkedCharacterId:
      note?.linkedCharacterId ?? note?.linkedCharacterSheetId ?? "",
    aliasesText: Array.isArray(note?.aliases) ? note.aliases.join(", ") : "",
    sectionsOrder: normalizeSectionsForDraft(note?.sections),
    relatedNoteIds: Array.isArray(note?.relatedNoteIds)
      ? [...note.relatedNoteIds]
      : [],
    ignoredAliases: Array.isArray(note?.ignoredAliases)
      ? [...note.ignoredAliases]
      : [],
    pendingTargetAliases: {},
    file: null,
    isDirty: false
  };
}

export function noteDraftReducer(state, action) {
  switch (action.type) {
    case "RESET_DRAFT":
      return createInitialNoteDraftState(action.note || null);

    case "SET_TITLE":
      if (state.title === action.value) return state;
      return { ...state, title: action.value, isDirty: true };

    case "SET_NOTE_TYPE": {
      const nextType = action.value;
      const accessibleFolders = Array.isArray(action.accessibleFolders)
        ? action.accessibleFolders
        : [];
      const compatible =
        !state.folderId ||
        accessibleFolders.some(
          (f) => f.id === state.folderId && (f.noteType || NOTE_TYPES.LORE) === nextType
        );
      return {
        ...state,
        noteType: nextType,
        folderId: compatible ? state.folderId : "",
        isDirty: true
      };
    }

    case "SET_FOLDER_ID":
      if (state.folderId === action.value) return state;
      return { ...state, folderId: action.value, isDirty: true };

    case "SET_LINKED_CHARACTER_ID":
      if (state.linkedCharacterId === action.value) return state;
      return { ...state, linkedCharacterId: action.value, isDirty: true };

    case "SET_ALIASES_TEXT":
      if (state.aliasesText === action.value) return state;
      return { ...state, aliasesText: action.value, isDirty: true };

    case "SET_FILE":
      if (state.file === action.file) return state;
      return { ...state, file: action.file, isDirty: true };

    case "ADD_SECTION": {
      const id = nextSectionId(state.sectionsOrder);
      const nextList = [
        ...state.sectionsOrder,
        { id, title: "", content: "", order: state.sectionsOrder.length }
      ];
      return { ...state, sectionsOrder: nextList, isDirty: true };
    }

    case "DELETE_SECTION": {
      if (state.sectionsOrder.length <= 1) {
        return {
          ...state,
          sectionsOrder: [{ id: "sec_1", title: "", content: "", order: 0 }],
          isDirty: true
        };
      }
      const filtered = state.sectionsOrder
        .filter((s) => s.id !== action.secId)
        .map((s, idx) => ({ ...s, order: idx }));
      return { ...state, sectionsOrder: filtered, isDirty: true };
    }

    case "UPDATE_SECTION_TITLE":
      return {
        ...state,
        sectionsOrder: state.sectionsOrder.map((s) =>
          s.id === action.secId ? { ...s, title: action.value } : s
        ),
        isDirty: true
      };

    case "UPDATE_SECTION_CONTENT":
      return {
        ...state,
        sectionsOrder: state.sectionsOrder.map((s) =>
          s.id === action.secId ? { ...s, content: action.value } : s
        ),
        isDirty: true
      };

    case "MOVE_SECTION": {
      const targetIndex = action.index + action.direction;
      if (targetIndex < 0 || targetIndex >= state.sectionsOrder.length) {
        return state;
      }
      const next = [...state.sectionsOrder];
      const temp = next[action.index];
      next[action.index] = next[targetIndex];
      next[targetIndex] = temp;
      return {
        ...state,
        sectionsOrder: next.map((s, idx) => ({ ...s, order: idx })),
        isDirty: true
      };
    }

    case "STAGE_CARD_LINK": {
      const targetId = action.targetCardId;
      const term = typeof action.term === "string" ? action.term.trim() : "";
      const norm = normalizeAliasText(term);
      if (!targetId || norm.length < 2) return state;

      const nextRelated = state.relatedNoteIds.includes(targetId)
        ? state.relatedNoteIds
        : [...state.relatedNoteIds, targetId];
      const nextIgnored = state.ignoredAliases.filter(
        (item) => normalizeAliasText(item) !== norm
      );

      let nextPending = state.pendingTargetAliases;
      if (action.requiresAliasAddition) {
        const currentForTarget = Array.isArray(state.pendingTargetAliases[targetId])
          ? state.pendingTargetAliases[targetId]
          : [];
        if (!currentForTarget.some((item) => normalizeAliasText(item) === norm)) {
          nextPending = {
            ...state.pendingTargetAliases,
            [targetId]: [...currentForTarget, term]
          };
        }
      }

      return {
        ...state,
        relatedNoteIds: nextRelated,
        ignoredAliases: nextIgnored,
        pendingTargetAliases: nextPending,
        isDirty: true
      };
    }

    case "NEGATE_LINK": {
      const term = typeof action.term === "string" ? action.term.trim() : "";
      const norm = normalizeAliasText(term);
      if (!norm) return state;

      const alreadyIgnored = state.ignoredAliases.some(
        (item) => normalizeAliasText(item) === norm
      );
      const nextIgnored = alreadyIgnored
        ? state.ignoredAliases
        : [...state.ignoredAliases, term];

      let pendingChanged = false;
      const nextPending = {};
      for (const [targetId, list] of Object.entries(state.pendingTargetAliases)) {
        const filtered = (Array.isArray(list) ? list : []).filter(
          (item) => normalizeAliasText(item) !== norm
        );
        if (filtered.length !== (list?.length || 0)) {
          pendingChanged = true;
        }
        if (filtered.length > 0) {
          nextPending[targetId] = filtered;
        }
      }

      return {
        ...state,
        ignoredAliases: nextIgnored,
        pendingTargetAliases: pendingChanged ? nextPending : state.pendingTargetAliases,
        isDirty: true
      };
    }

    case "MARK_SAVED":
      return {
        ...state,
        pendingTargetAliases: {},
        file: null,
        isDirty: false
      };

    default:
      return state;
  }
}

export function applyPendingAliasesToNotes(
  accessibleNotes = [],
  pendingTargetAliases = {}
) {
  const pendingEntries = Object.entries(pendingTargetAliases || {});
  if (pendingEntries.length === 0) {
    return accessibleNotes;
  }
  return (accessibleNotes || []).map((note) => {
    const extra = note?.id ? pendingTargetAliases[note.id] : null;
    if (!Array.isArray(extra) || extra.length === 0) {
      return note;
    }
    return {
      ...note,
      aliases: [...(Array.isArray(note.aliases) ? note.aliases : []), ...extra]
    };
  });
}

export function buildNoteDraftPayload({
  draft,
  note = null,
  defaultScope = "party",
  defaultOwnerId = null
}) {
  const parsedAliases = String(draft.aliasesText || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const sectionsMap = {};
  (draft.sectionsOrder || []).forEach((sec, idx) => {
    const secId =
      typeof sec?.id === "string" && sec.id.trim() ? sec.id.trim() : `sec_${idx + 1}`;
    sectionsMap[secId] = {
      id: secId,
      title: typeof sec?.title === "string" ? sec.title : "",
      content: typeof sec?.content === "string" ? sec.content : "",
      order: idx
    };
  });

  return {
    id: note?.id || null,
    scope: note?.scope || defaultScope,
    ownerId: note?.ownerId || defaultOwnerId,
    title: String(draft.title || "").trim(),
    noteType: draft.noteType,
    folderId: draft.folderId || null,
    linkedCharacterId:
      draft.noteType === NOTE_TYPES.CHARACTER && draft.linkedCharacterId
        ? draft.linkedCharacterId
        : null,
    aliases: parsedAliases,
    ignoredAliases: draft.ignoredAliases,
    sections: sectionsMap,
    relatedNoteIds: draft.relatedNoteIds,
    targetAliasAdditions: draft.pendingTargetAliases,
    file: draft.file
  };
}

export function useNoteDraft({
  note = null,
  defaultScope = "party",
  defaultOwnerId = null,
  accessibleFolders = []
} = {}) {
  const [draft, dispatch] = useReducer(
    noteDraftReducer,
    note,
    createInitialNoteDraftState
  );

  const buildPayload = useCallback(
    () =>
      buildNoteDraftPayload({
        draft,
        note,
        defaultScope,
        defaultOwnerId
      }),
    [draft, note, defaultScope, defaultOwnerId]
  );

  const setTitle = useCallback(
    (value) => dispatch({ type: "SET_TITLE", value }),
    []
  );
  const setNoteType = useCallback(
    (value) =>
      dispatch({
        type: "SET_NOTE_TYPE",
        value,
        accessibleFolders
      }),
    [accessibleFolders]
  );
  const setFolderId = useCallback(
    (value) => dispatch({ type: "SET_FOLDER_ID", value }),
    []
  );
  const setLinkedCharacterId = useCallback(
    (value) => dispatch({ type: "SET_LINKED_CHARACTER_ID", value }),
    []
  );
  const setAliasesText = useCallback(
    (value) => dispatch({ type: "SET_ALIASES_TEXT", value }),
    []
  );
  const setFile = useCallback(
    (file) => dispatch({ type: "SET_FILE", file }),
    []
  );
  const addSection = useCallback(() => dispatch({ type: "ADD_SECTION" }), []);
  const deleteSection = useCallback(
    (secId) => dispatch({ type: "DELETE_SECTION", secId }),
    []
  );
  const updateSectionTitle = useCallback(
    (secId, value) => dispatch({ type: "UPDATE_SECTION_TITLE", secId, value }),
    []
  );
  const updateSectionContent = useCallback(
    (secId, value) => dispatch({ type: "UPDATE_SECTION_CONTENT", secId, value }),
    []
  );
  const moveSection = useCallback(
    (index, direction) => dispatch({ type: "MOVE_SECTION", index, direction }),
    []
  );
  const stageCardLink = useCallback(
    ({ targetCardId, term, requiresAliasAddition }) =>
      dispatch({
        type: "STAGE_CARD_LINK",
        targetCardId,
        term,
        requiresAliasAddition
      }),
    []
  );
  const negateLink = useCallback(
    (term) => dispatch({ type: "NEGATE_LINK", term }),
    []
  );
  const markSaved = useCallback(() => dispatch({ type: "MARK_SAVED" }), []);
  const resetDraft = useCallback(
    (nextNote = note) => dispatch({ type: "RESET_DRAFT", note: nextNote }),
    [note]
  );

  const hasInitialContent = useMemo(
    () =>
      draft.sectionsOrder.some((s) => s.content?.trim() || s.title?.trim()),
    [draft.sectionsOrder]
  );

  return {
    draft,
    hasInitialContent,
    buildPayload,
    setTitle,
    setNoteType,
    setFolderId,
    setLinkedCharacterId,
    setAliasesText,
    setFile,
    addSection,
    deleteSection,
    updateSectionTitle,
    updateSectionContent,
    moveSection,
    stageCardLink,
    negateLink,
    markSaved,
    resetDraft
  };
}
