import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { uploadCompressedMedia } from "./mediaService";
import { withRequiredAudience } from "./visibilityService";
import {
  buildNormalizedAliases,
  detectAliasMentionsInText,
} from "../engines/aliasEngine";

/**
 * Constrói os vetores de permissão (`ownerId`, `visibleTo`, `editableBy`) conforme o escopo do Diário.
 */
export function buildJournalPermissions({
  scope = "party",
  targetOwnerId = null,
  campaignGmId = null,
  currentUserId = null,
}) {
  const gmUid = campaignGmId || currentUserId;
  const owner = targetOwnerId || currentUserId;

  if (scope === "gm") {
    return {
      ownerId: gmUid,
      visibleTo: [gmUid].filter(Boolean),
      editableBy: [gmUid].filter(Boolean),
    };
  }

  if (scope === "party") {
    return {
      ownerId: owner,
      visibleTo: ["ALL"],
      editableBy: ["ALL"],
    };
  }

  const allowed = Array.from(new Set([gmUid, owner].filter(Boolean)));
  return {
    ownerId: owner,
    visibleTo: allowed,
    editableBy: allowed,
  };
}

export function canUserEditJournalNote(note, { user, isGM }) {
  if (!user || !note) return false;
  if (isGM) return true;
  if (note.scope === "gm") return false;
  if (note.scope === "party") return true;
  if (note.ownerId === user.uid) return true;
  const editList = Array.isArray(note.editableBy) ? note.editableBy : [];
  return editList.includes("ALL") || editList.includes(user.uid);
}

export function canUserEditJournalFolder(folder, { user, isGM }) {
  if (!user || !folder) return false;
  if (isGM) return true;
  if (folder.scope === "gm") return false;
  if (folder.ownerId === user.uid) return true;
  const editList = Array.isArray(folder.editableBy) ? folder.editableBy : [];
  return editList.includes("ALL") || editList.includes(user.uid);
}

/**
 * Fase 3.1 (D-3 / V-22): excluir (Soft Delete) é exclusivo do dono ou do Mestre.
 * `editableBy` (inclusive `["ALL"]` das pastas do Grupo) concede edição, nunca exclusão.
 */
export function canUserDeleteJournalNote(note, { user, isGM }) {
  if (!user || !note) return false;
  if (isGM) return true;
  return note.scope !== "gm" && note.ownerId === user.uid;
}

export function canUserDeleteJournalFolder(folder, { user, isGM }) {
  if (!user || !folder) return false;
  if (isGM) return true;
  return folder.scope !== "gm" && folder.ownerId === user.uid;
}

export function filterAccessibleJournalItems(items = [], { user, isGM }) {
  if (!user) return [];
  if (isGM) return items;
  const uid = user.uid;
  return items.filter((item) => {
    if (item.scope === "party") return true;
    if (item.scope === "player" && item.ownerId === uid) return true;
    const vis = Array.isArray(item.visibleTo) ? item.visibleTo : [];
    return vis.includes("ALL") || vis.includes(uid);
  });
}

export async function createJournalNote({
  campaignId,
  campaign,
  user,
  isGM,
  accessibleNotes = [],
  scope = "party",
  ownerId = null,
  noteType = "lore",
  folder = "",
  title,
  aliases = [],
  content = "",
  sections = [],
  relatedNoteIds = [],
  ignoredAliases = [],
  linkedCharacterSheetId = null,
  file = null,
}) {
  if (!user || !campaignId || !title?.trim()) return null;

  const safeScope = !isGM && scope === "gm" ? "player" : scope;
  const safeOwnerId = isGM ? ownerId || user.uid : user.uid;

  let imageMediaId = null;
  if (file) {
    const uploaded = await uploadCompressedMedia({
      file,
      category: "avatar",
      campaignId,
      uploadedBy: user.uid,
    });
    imageMediaId = uploaded.mediaId;
  }

  const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);

  const cleanAliases = Array.isArray(aliases)
    ? aliases.map((a) => a.trim()).filter(Boolean)
    : [];
  const cleanIgnoredAliases = Array.isArray(ignoredAliases)
    ? ignoredAliases.map((a) => a.trim()).filter(Boolean)
    : [];
  const aliasesNormalized = buildNormalizedAliases(title.trim(), cleanAliases);

  const { mentionedNoteIds } = detectAliasMentionsInText(
    content,
    accessibleNotes,
    noteId,
    cleanIgnoredAliases
  );

  const perms = buildJournalPermissions({
    scope: safeScope,
    targetOwnerId: safeOwnerId,
    campaignGmId: campaign?.gmId,
    currentUserId: user.uid,
  });

  const newNote = {
    id: noteId,
    campaignId,
    scope: safeScope,
    ...perms,
    isDeleted: false,
    clonedFromNoteId: null,
    noteType,
    folder: (folder || "").trim(),
    linkedCharacterSheetId: linkedCharacterSheetId || null,
    title: title.trim(),
    aliases: cleanAliases,
    aliasesNormalized,
    ignoredAliases: cleanIgnoredAliases,
    imageMediaId,
    content: content || "",
    sections: Array.isArray(sections) ? sections : [],
    relatedNoteIds: Array.isArray(relatedNoteIds) ? relatedNoteIds : [],
    mentionedNoteIds,
    graphNode: {
      x: null,
      y: null,
      pinned: false,
    },
    updatedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(noteRef, newNote);
  return { noteId, newNote };
}

export async function updateJournalNote({
  campaignId,
  campaign = null,
  user,
  isGM,
  existingNote,
  accessibleNotes = [],
  noteId,
  updates = {},
  newFile = null,
}) {
  if (!user || !campaignId || !noteId || !existingNote) {
    return {
      ok: false,
      reason: "invalid-input",
      error: "Card não encontrado ou sessão inválida.",
    };
  }
  if (!canUserEditJournalNote(existingNote, { user, isGM })) {
    return {
      ok: false,
      reason: "permission-denied",
      error: "Você não tem permissão para editar este card.",
    };
  }

  const sanitizedUpdates = { ...updates };
  if (!isGM) {
    delete sanitizedUpdates.ownerId;
    delete sanitizedUpdates.editableBy;
    delete sanitizedUpdates.visibleTo;
    delete sanitizedUpdates.isDeleted;
    delete sanitizedUpdates.clonedFromNoteId;
    if (sanitizedUpdates.scope === "gm") {
      delete sanitizedUpdates.scope;
    }
    // Fase 3.1 (V-18): só o dono do card pode trocar o escopo (party <-> player).
    if (
      sanitizedUpdates.scope !== undefined &&
      sanitizedUpdates.scope !== existingNote.scope &&
      existingNote.ownerId !== user.uid
    ) {
      delete sanitizedUpdates.scope;
    }
  }

  // Fase 3.1 (V-18): ao trocar o escopo, visibleTo/editableBy são recalculados juntos,
  // mantendo escopo e audiência sempre coerentes (inclusive compartilhamentos individuais).
  if (
    sanitizedUpdates.scope !== undefined &&
    sanitizedUpdates.scope !== existingNote.scope &&
    sanitizedUpdates.visibleTo === undefined
  ) {
    const perms = buildJournalPermissions({
      scope: sanitizedUpdates.scope,
      targetOwnerId: existingNote.ownerId || user.uid,
      campaignGmId: campaign?.gmId,
      currentUserId: user.uid,
    });
    if (sanitizedUpdates.scope === "player") {
      const sharedIndividually = (Array.isArray(existingNote.visibleTo) ? existingNote.visibleTo : [])
        .filter((v) => v && v !== "ALL");
      perms.visibleTo = Array.from(new Set([...perms.visibleTo, ...sharedIndividually]));
    }
    sanitizedUpdates.visibleTo = perms.visibleTo;
    sanitizedUpdates.editableBy = perms.editableBy;
  }

  const nextTitle =
    sanitizedUpdates.title !== undefined ? sanitizedUpdates.title : existingNote.title;
  const nextAliases =
    sanitizedUpdates.aliases !== undefined
      ? sanitizedUpdates.aliases
      : existingNote.aliases || [];
  const nextIgnoredAliases =
    sanitizedUpdates.ignoredAliases !== undefined
      ? sanitizedUpdates.ignoredAliases
      : existingNote.ignoredAliases || [];
  const nextContent =
    sanitizedUpdates.content !== undefined
      ? sanitizedUpdates.content
      : existingNote.content || "";

  const aliasesNormalized = buildNormalizedAliases(nextTitle, nextAliases);
  const { mentionedNoteIds } = detectAliasMentionsInText(
    nextContent,
    accessibleNotes,
    noteId,
    nextIgnoredAliases
  );

  const payload = {
    ...sanitizedUpdates,
    campaignId,
    aliasesNormalized,
    mentionedNoteIds,
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (newFile) {
    const uploaded = await uploadCompressedMedia({
      file: newFile,
      category: "avatar",
      campaignId,
      uploadedBy: user.uid,
    });
    payload.imageMediaId = uploaded.mediaId;
  }

  await updateDoc(doc(db, "campaigns", campaignId, "notes", noteId), payload);
  return { ok: true, noteId };
}

export async function updateJournalNodePosition({
  campaignId,
  user,
  isGM,
  existingNote,
  noteId,
  x,
  y,
}) {
  if (!user || !campaignId || !noteId || !existingNote) return;
  if (!canUserEditJournalNote(existingNote, { user, isGM })) return;

  await updateDoc(doc(db, "campaigns", campaignId, "notes", noteId), {
    graphNode: {
      x: Math.round(x),
      y: Math.round(y),
      pinned: true,
    },
  });
}

export async function cloneJournalNoteToTarget({
  campaignId,
  campaign,
  user,
  isGM,
  sourceNote,
  targetScope = "party",
  targetOwnerId = null,
}) {
  if (!user || !campaignId || !sourceNote) return null;

  const safeTargetScope = !isGM && targetScope === "gm" ? "player" : targetScope;
  const safeTargetOwnerId = isGM ? targetOwnerId || user.uid : user.uid;

  const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
  const perms = buildJournalPermissions({
    scope: safeTargetScope,
    targetOwnerId: safeTargetOwnerId,
    campaignGmId: campaign?.gmId,
    currentUserId: user.uid,
  });

  const clonedNote = {
    ...sourceNote,
    id: noteId,
    campaignId,
    scope: safeTargetScope,
    ...perms,
    isDeleted: false,
    clonedFromNoteId: sourceNote.id,
    graphNode: {
      x: null,
      y: null,
      pinned: false,
    },
    updatedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(noteRef, clonedNote);
  return { noteId, clonedNote };
}

export async function shareJournalNoteWithTarget({
  campaignId,
  user,
  isGM,
  note,
  noteId,
  target,
}) {
  if (!user || !campaignId || !noteId || !target || !note) return;
  if (!isGM && note.ownerId !== user.uid && !canUserEditJournalNote(note, { user, isGM })) {
    return;
  }

  const currentVis = Array.isArray(note.visibleTo) ? [...note.visibleTo] : [];
  const updates = {
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  };

  const token = target === "party" || target === "ALL" ? "ALL" : target;
  if (!currentVis.includes(token)) {
    currentVis.push(token);
  }
  updates.visibleTo = currentVis;

  await updateDoc(doc(db, "campaigns", campaignId, "notes", noteId), updates);
}

export async function revokeJournalNoteAccess({
  campaignId,
  campaign = null,
  user,
  isGM,
  isRealGM,
  note,
  noteId,
  target,
}) {
  if (!user || !campaignId || !noteId || !target || !note) return;
  if (!isGM && !isRealGM && note.ownerId !== user.uid) return;

  let currentVis = Array.isArray(note.visibleTo) ? [...note.visibleTo] : [];
  const updates = {
    updatedAtMs: Date.now(),
    updatedAt: serverTimestamp(),
  };

  if (target === "party" || target === "ALL") {
    currentVis = currentVis.filter((v) => v !== "ALL");
    updates.visibleTo = currentVis;
    if (note.scope === "party") {
      updates.scope = "player";
    }
  } else {
    currentVis = currentVis.filter((v) => v !== target);
    updates.visibleTo = currentVis;
  }

  // Fase 6.2 (A9): a revogação nunca deixa o card sem audiência. Fora do escopo "gm", Mestre e
  // dono permanecem em visibleTo (antes, revogar o Grupo de um card ["ALL"] gravava []).
  if (note.scope !== "gm") {
    updates.visibleTo = withRequiredAudience(updates.visibleTo, {
      gmUid: campaign?.gmId || null,
      ownerId: note.ownerId || null,
    });
  }

  await updateDoc(doc(db, "campaigns", campaignId, "notes", noteId), updates);
}

export async function softDeleteJournalNote({
  campaignId,
  user,
  isGM,
  note,
  noteId,
}) {
  if (!user || !campaignId || !noteId || !note) return;
  if (!canUserDeleteJournalNote(note, { user, isGM })) return;

  await updateDoc(doc(db, "campaigns", campaignId, "notes", noteId), {
    campaignId,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
  });
}

export async function createJournalFolder({
  campaignId,
  campaign,
  user,
  isGM,
  name,
  noteType,
  scope = "party",
  ownerId = null,
}) {
  if (!user || !campaignId || !name?.trim() || !noteType) return null;
  const safeScope = !isGM && scope === "gm" ? "player" : scope;
  const safeOwnerId = isGM ? ownerId || user.uid : user.uid;

  const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const folderRef = doc(db, "campaigns", campaignId, "folders", folderId);
  const perms = buildJournalPermissions({
    scope: safeScope,
    targetOwnerId: safeOwnerId,
    campaignGmId: campaign?.gmId,
    currentUserId: user.uid,
  });

  const newFolder = {
    id: folderId,
    campaignId,
    folderType: "journal",
    isFolder: true,
    name: name.trim(),
    title: name.trim(),
    noteType,
    scope: safeScope,
    ...perms,
    isDeleted: false,
    updatedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(folderRef, newFolder);
  return { folderId, newFolder };
}

export async function softDeleteJournalFolder({
  campaignId,
  user,
  isGM,
  folderId,
  folderPath,
  noteType,
  rawFolders = [],
  dedicatedFolders = [],
  rawLegacyItems = [],
  rawNotes = [],
  options = { deleteContents: false },
}) {
  if (!user || !campaignId) return;
  const deleteContents = Boolean(options?.deleteContents);

  const normalizeFolderSegs = (path) =>
    (path || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/");

  const cleanTargetPath = normalizeFolderSegs(folderPath);

  const foldersToDelete = rawFolders.filter((f) => {
    if (folderId && f.id === folderId) return true;
    if (f.noteType !== noteType || !cleanTargetPath) return false;
    const fPath = normalizeFolderSegs(f.name);
    return fPath === cleanTargetPath || fPath.startsWith(`${cleanTargetPath}/`);
  });

  // Fase 3.1 (V-22 / D-3): a pasta-alvo (documento explícito) só pode ser excluída pelo dono
  // ou pelo Mestre. Sem permissão, nada é alterado (nem pastas, nem cards).
  // Pastas implícitas (derivadas apenas do caminho dos cards, sem documento) não têm dono e
  // seguem para a etapa de cards, cuja permissão é checada card a card.
  const targetFolderDoc =
    (folderId && rawFolders.find((f) => f.id === folderId)) ||
    rawFolders.find(
      (f) => f.noteType === noteType && normalizeFolderSegs(f.name) === cleanTargetPath
    ) ||
    null;
  if (targetFolderDoc && !canUserDeleteJournalFolder(targetFolderDoc, { user, isGM })) {
    return;
  }

  for (const f of foldersToDelete) {
    // Subpastas de outros donos não são ocultadas por quem não é dono (D-3).
    if (!canUserDeleteJournalFolder(f, { user, isGM })) continue;
    const inDedicated = dedicatedFolders.some((df) => df.id === f.id);
    const inLegacy = rawLegacyItems.some((ri) => ri.id === f.id && ri.isFolder);

    if (inDedicated) {
      await updateDoc(doc(db, "campaigns", campaignId, "folders", f.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
      }).catch(() => {});
    }
    if (inLegacy) {
      await updateDoc(doc(db, "campaigns", campaignId, "notes", f.id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
      }).catch(() => {});
    }
  }

  if (cleanTargetPath && noteType) {
    const parentPath = cleanTargetPath.includes("/")
      ? cleanTargetPath.substring(0, cleanTargetPath.lastIndexOf("/"))
      : "";

    const notesInFolder = rawNotes.filter((n) => {
      if (n.noteType !== noteType) return false;
      const nPath = normalizeFolderSegs(n.folder);
      return nPath === cleanTargetPath || nPath.startsWith(`${cleanTargetPath}/`);
    });

    for (const n of notesInFolder) {
      if (!canUserEditJournalNote(n, { user, isGM })) continue;
      if (deleteContents) {
        if (!canUserDeleteJournalNote(n, { user, isGM })) continue;
        await updateDoc(doc(db, "campaigns", campaignId, "notes", n.id), {
          campaignId,
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid,
        });
      } else {
        await updateDoc(doc(db, "campaigns", campaignId, "notes", n.id), {
          folder: parentPath,
          updatedAtMs: Date.now(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }
}

