import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import {
  FOLDER_DOMAINS,
  ID_PREFIXES,
  NOTE_SCOPES,
  NOTE_TYPES
} from "../domain/constants.js";
import { DEFAULT_NAMES } from "../domain/defaults.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { normalizeImageRef, toImageRefDoc, validateImageRef } from "../domain/models/imageRef.js";
import {
  LEGACY_NOTE_KEYS,
  fromNoteDoc,
  normalizeNote,
  toNoteDoc
} from "../domain/models/note.js";
import {
  canDeleteResource,
  canEditResource,
  isReleasedToPlayers
} from "../domain/permissions.js";
import { normalizeAliasText } from "../engines/journal/index.js";
import { db } from "../infra/firebase.js";
import { noteDocPath, notesCollectionPath } from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import {
  createFolder as createUnifiedFolder,
  deleteFolder as deleteUnifiedFolder
} from "./folderService.js";
import { grantMediaAudience, uploadCompressedMedia } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { subscribeVisibleCollection } from "./visibilityService.js";

const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));
const LEGACY_NOTE_KEY_SET = new Set(["id", ...LEGACY_NOTE_KEYS]);

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item === "string") {
      const clean = item.trim();
      if (clean.length > 0) seen.add(clean);
    }
  }
  return Array.from(seen);
}

function toTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

function normalizeSectionsPayload(rawSections, fallbackContent = "") {
  const normalized = normalizeNote({ sections: rawSections }).sections;
  if (Object.keys(normalized).length > 0) {
    return normalized;
  }
  const cleanFallback = trimString(fallbackContent);
  if (cleanFallback) {
    return {
      sec_1: {
        id: "sec_1",
        title: "",
        content: cleanFallback,
        order: 0
      }
    };
  }
  return {};
}

function normalizeTargetAliasAdditions(rawAdditions, selfNoteId = null) {
  const byTargetId = new Map();
  const pushTerm = (targetId, term) => {
    const cleanTargetId = trimString(targetId);
    const cleanTerm = trimString(term);
    if (!cleanTargetId || cleanTargetId === selfNoteId || cleanTerm.length < 2) {
      return;
    }
    if (!byTargetId.has(cleanTargetId)) {
      byTargetId.set(cleanTargetId, []);
    }
    const list = byTargetId.get(cleanTargetId);
    const norm = normalizeAliasText(cleanTerm);
    if (norm.length >= 2 && !list.some((item) => normalizeAliasText(item) === norm)) {
      list.push(cleanTerm);
    }
  };

  if (Array.isArray(rawAdditions)) {
    for (const entry of rawAdditions) {
      if (entry && typeof entry === "object") {
        pushTerm(entry.targetNoteId ?? entry.noteId, entry.alias ?? entry.term);
      }
    }
  } else if (rawAdditions && typeof rawAdditions === "object") {
    for (const [targetId, terms] of Object.entries(rawAdditions)) {
      if (Array.isArray(terms)) {
        for (const term of terms) pushTerm(targetId, term);
      } else if (typeof terms === "string") {
        pushTerm(targetId, terms);
      }
    }
  }

  for (const [targetId, list] of Array.from(byTargetId.entries())) {
    if (list.length === 0) byTargetId.delete(targetId);
  }
  return byTargetId;
}

async function prepareTargetAliasOperations({
  firestoreDb,
  campaignId,
  user,
  isGM,
  rawAdditions,
  accessibleNotes = [],
  selfNoteId = null
}) {
  const additionsMap = normalizeTargetAliasAdditions(rawAdditions, selfNoteId);
  if (additionsMap.size === 0) {
    return { ok: true, ops: [] };
  }

  const ops = [];
  for (const [targetNoteId, newTerms] of additionsMap.entries()) {
    let targetNote =
      (Array.isArray(accessibleNotes)
        ? accessibleNotes.find((n) => n && n.id === targetNoteId)
        : null) || null;

    if (!targetNote && firestoreDb) {
      const snap = await getDoc(doc(firestoreDb, noteDocPath(campaignId, targetNoteId)));
      if (snap.exists()) {
        targetNote = fromNoteDoc(snap.data() || {}, snap.id, { campaignId });
      }
    }

    if (!targetNote || targetNote.isDeleted === true) {
      return {
        ok: false,
        reason: "not-found",
        error: "Card de destino não encontrado para vincular alias."
      };
    }

    if (!canUserEditJournalNote(targetNote, { user, isGM })) {
      return {
        ok: false,
        reason: "permission-denied",
        error: `Você não tem permissão para vincular alias ao card "${targetNote.title || targetNoteId}".`
      };
    }

    const existingAliases = cleanStringList(targetNote.aliases);
    const existingNorms = new Set(
      [targetNote.title, ...existingAliases]
        .map((item) => normalizeAliasText(item))
        .filter((norm) => norm.length >= 2)
    );

    const nextAliases = [...existingAliases];
    let changed = false;
    for (const term of newTerms) {
      const norm = normalizeAliasText(term);
      if (norm.length >= 2 && !existingNorms.has(norm)) {
        existingNorms.add(norm);
        nextAliases.push(term);
        changed = true;
      }
    }

    if (changed) {
      ops.push({
        path: noteDocPath(campaignId, targetNoteId),
        data: {
          aliases: nextAliases,
          rev: increment(1),
          updatedAt: serverTimestamp()
        }
      });
    }
  }

  return { ok: true, ops };
}

async function grantNoteMediaIfNeeded({
  firestoreDb,
  campaignId,
  mediaId,
  visibleTo
}) {
  const cleanMediaId = trimString(mediaId);
  if (!cleanMediaId) return;
  await grantMediaAudience({
    campaignId,
    mediaId: cleanMediaId,
    visibleTo,
    ...(firestoreDb !== db ? { firestoreDb } : {})
  });
}

function buildResolvedImagePayload({
  incomingImage = undefined,
  existingNote = null
}) {
  if (incomingImage === undefined) return undefined;
  const normalized = normalizeImageRef(incomingImage);
  const validation = validateImageRef(normalized, { fieldName: "image" });
  if (!validation.ok) {
    throw validation.errors[0];
  }
  const currentImg = normalizeImageRef(
    existingNote?.image ??
      (existingNote?.imageMediaId
        ? { mediaId: existingNote.imageMediaId, url: null }
        : null)
  );
  if (
    currentImg.mediaId === normalized.mediaId &&
    currentImg.url === normalized.url
  ) {
    return undefined;
  }
  return toImageRefDoc(normalized);
}

/**
 * Constrói os vetores canônicos de permissão (`ownerId`, `visibleTo`, `editableBy`) via `computeAudience`.
 */
export function buildJournalPermissions({
  scope = NOTE_SCOPES.PARTY,
  targetOwnerId = null,
  campaignGmId = null,
  currentUserId = null,
  visibleTo = undefined,
  editableBy = undefined
}) {
  const gmUid = campaignGmId || currentUserId;
  const owner = scope === NOTE_SCOPES.GM ? gmUid : targetOwnerId || currentUserId;
  const audience = computeAudience({
    ownerId: owner,
    scope,
    visibleTo,
    editableBy,
    gmId: gmUid
  });

  return {
    ownerId: owner,
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy
  };
}

export function canUserEditJournalNote(note, { user, isGM }) {
  return canEditResource(note, { uid: user?.uid, isGM: Boolean(isGM) });
}

export function canUserEditJournalFolder(folder, { user, isGM }) {
  return canEditResource(folder, { uid: user?.uid, isGM: Boolean(isGM) });
}

/**
 * Fase 3.1 (D-3 / V-22): excluir (Soft Delete) é exclusivo do dono ou do Mestre.
 * `editableBy` (inclusive `["ALL"]` das pastas do Grupo) concede edição, nunca exclusão.
 */
export function canUserDeleteJournalNote(note, { user, isGM }) {
  return canDeleteResource(note, {
    uid: user?.uid,
    isGM: Boolean(isGM),
    entityType: "note"
  });
}

export function canUserDeleteJournalFolder(folder, { user, isGM }) {
  return canDeleteResource(folder, {
    uid: user?.uid,
    isGM: Boolean(isGM),
    entityType: "folder"
  });
}

export function filterAccessibleJournalItems(items = [], { user, isGM }) {
  if (!user) return [];
  if (isGM) return items;
  return items.filter((item) => isReleasedToPlayers(item, user.uid));
}

export function subscribeNotes({
  firestoreDb = db,
  campaignId,
  gmId = null,
  isRealGM = false,
  uid,
  onNext,
  onError
}) {
  if (!trimString(campaignId) || !trimString(uid)) {
    return () => {};
  }
  const notesCol = collection(firestoreDb, notesCollectionPath(campaignId));
  return subscribeVisibleCollection({
    colRef: notesCol,
    isRealGM,
    uid,
    onNext: (snapshot) => {
      const list = [];
      for (const d of snapshot.docs) {
        const raw = d.data() || {};
        if (raw.isDeleted || raw.isFolder || raw.migratedToFoldersCollection) {
          continue;
        }
        list.push(
          fromNoteDoc(raw, d.id, {
            campaignId,
            gmId: trimString(gmId) || undefined
          })
        );
      }
      list.sort(
        (a, b) =>
          toTimestampMillis(b.updatedAt) - toTimestampMillis(a.updatedAt) ||
          String(a.title || "").localeCompare(String(b.title || ""))
      );
      onNext?.(list);
    },
    onError: (err) => {
      onError?.(err);
    }
  });
}

export async function createJournalNote({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  accessibleNotes = [],
  scope = NOTE_SCOPES.PARTY,
  ownerId = null,
  noteType = NOTE_TYPES.LORE,
  folderId = null,
  title,
  aliases = [],
  content = "",
  sections = {},
  relatedNoteIds = [],
  ignoredAliases = [],
  linkedCharacterId = null,
  linkedCharacterSheetId = null,
  image = null,
  file = null,
  targetAliasAdditions = null
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(title)) return null;

  const safeScope = !isGM && scope === NOTE_SCOPES.GM
    ? NOTE_SCOPES.PLAYER
    : VALID_NOTE_SCOPES.has(scope)
      ? scope
      : NOTE_SCOPES.PARTY;
  const safeNoteType = VALID_NOTE_TYPES.has(noteType) ? noteType : NOTE_TYPES.LORE;
  const safeOwnerId = isGM ? trimString(ownerId) || user.uid : user.uid;

  const perms = buildJournalPermissions({
    scope: safeScope,
    targetOwnerId: safeOwnerId,
    campaignGmId: campaign?.gmId,
    currentUserId: user.uid
  });

  const noteId = createId(ID_PREFIXES.NOTE);

  const aliasPrep = await prepareTargetAliasOperations({
    firestoreDb,
    campaignId,
    user,
    isGM,
    rawAdditions: targetAliasAdditions,
    accessibleNotes,
    selfNoteId: noteId
  });
  if (!aliasPrep.ok) {
    return {
      ok: false,
      reason: aliasPrep.reason,
      error: aliasPrep.error
    };
  }

  let resolvedImage = normalizeImageRef(image);
  if (file) {
    const uploaded = await uploadCompressedMedia({
      file,
      category: "avatar",
      campaignId,
      uploadedBy: user.uid,
      visibleTo: perms.visibleTo
    });
    resolvedImage = { mediaId: uploaded.mediaId, url: null };
  } else {
    const imgCheck = validateImageRef(resolvedImage, { fieldName: "image" });
    if (!imgCheck.ok) {
      throw imgCheck.errors[0];
    }
    if (resolvedImage.mediaId) {
      await grantNoteMediaIfNeeded({
        firestoreDb,
        campaignId,
        mediaId: resolvedImage.mediaId,
        visibleTo: perms.visibleTo
      });
    }
  }

  const normalized = normalizeNote(
    {
      id: noteId,
      campaignId,
      scope: safeScope,
      ownerId: perms.ownerId,
      visibleTo: perms.visibleTo,
      editableBy: perms.editableBy,
      noteType: safeNoteType,
      folderId: trimString(folderId) || null,
      title: trimString(title),
      aliases: cleanStringList(aliases),
      ignoredAliases: cleanStringList(ignoredAliases),
      sections: normalizeSectionsPayload(sections, content),
      relatedNoteIds: cleanStringList(relatedNoteIds).filter((id) => id !== noteId),
      linkedCharacterId: trimString(linkedCharacterId ?? linkedCharacterSheetId) || null,
      image: resolvedImage,
      graphPosition: { x: null, y: null, pinned: false },
      clonedFromNoteId: null,
      rev: 0,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { id: noteId, campaignId, gmId: campaign?.gmId }
  );

  const newNoteDoc = toNoteDoc(normalized);
  const noteRef = doc(firestoreDb, noteDocPath(campaignId, noteId));

  if (aliasPrep.ops.length > 0) {
    const batch = writeBatch(firestoreDb);
    batch.set(noteRef, newNoteDoc);
    for (const op of aliasPrep.ops) {
      batch.update(doc(firestoreDb, op.path), op.data);
    }
    await batch.commit();
  } else {
    await setDoc(noteRef, newNoteDoc);
  }

  return {
    ok: true,
    noteId,
    newNote: { id: noteId, ...newNoteDoc }
  };
}

export async function updateJournalNote({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  existingNote,
  accessibleNotes = [],
  noteId,
  updates = {},
  newFile = null,
  targetAliasAdditions = null
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(noteId) || !existingNote) {
    return {
      ok: false,
      reason: "invalid-input",
      error: "Card não encontrado ou sessão inválida."
    };
  }
  if (!canUserEditJournalNote(existingNote, { user, isGM })) {
    return {
      ok: false,
      reason: "permission-denied",
      error: "Você não tem permissão para editar este card."
    };
  }

  const sanitizedUpdates = {};
  for (const [key, val] of Object.entries(updates || {})) {
    if (val === undefined || LEGACY_NOTE_KEY_SET.has(key)) continue;
    sanitizedUpdates[key] = val;
  }

  if (
    updates?.linkedCharacterSheetId !== undefined &&
    sanitizedUpdates.linkedCharacterId === undefined
  ) {
    sanitizedUpdates.linkedCharacterId = updates.linkedCharacterSheetId;
  }
  if (sanitizedUpdates.linkedCharacterId !== undefined) {
    sanitizedUpdates.linkedCharacterId = trimString(sanitizedUpdates.linkedCharacterId) || null;
  }

  if (sanitizedUpdates.folderId !== undefined) {
    sanitizedUpdates.folderId = trimString(sanitizedUpdates.folderId) || null;
  }

  if (sanitizedUpdates.title !== undefined) {
    const cleanTitle = trimString(sanitizedUpdates.title);
    if (!cleanTitle) {
      return {
        ok: false,
        reason: "validation-failed",
        error: "O título do card não pode ficar vazio."
      };
    }
    sanitizedUpdates.title = cleanTitle;
  }

  if (sanitizedUpdates.noteType !== undefined && !VALID_NOTE_TYPES.has(sanitizedUpdates.noteType)) {
    return {
      ok: false,
      reason: "validation-failed",
      error: `Categoria do diário inválida: "${String(sanitizedUpdates.noteType)}".`
    };
  }

  if (sanitizedUpdates.aliases !== undefined) {
    sanitizedUpdates.aliases = cleanStringList(sanitizedUpdates.aliases);
  }
  if (sanitizedUpdates.ignoredAliases !== undefined) {
    sanitizedUpdates.ignoredAliases = cleanStringList(sanitizedUpdates.ignoredAliases);
  }
  if (sanitizedUpdates.relatedNoteIds !== undefined) {
    sanitizedUpdates.relatedNoteIds = cleanStringList(sanitizedUpdates.relatedNoteIds).filter(
      (id) => id !== noteId
    );
  }
  if (sanitizedUpdates.sections !== undefined) {
    sanitizedUpdates.sections = normalizeSectionsPayload(sanitizedUpdates.sections);
  }

  if (!isGM) {
    delete sanitizedUpdates.ownerId;
    delete sanitizedUpdates.editableBy;
    delete sanitizedUpdates.visibleTo;
    delete sanitizedUpdates.isDeleted;
    delete sanitizedUpdates.deletedAt;
    delete sanitizedUpdates.deletedBy;
    delete sanitizedUpdates.clonedFromNoteId;
    if (sanitizedUpdates.scope === NOTE_SCOPES.GM) {
      delete sanitizedUpdates.scope;
    }
    // Fase 3.1 (V-18): só o dono do card pode alterar scope/audiência (party <-> player).
    // Editores não-donos nunca devem reescrever scope/visibleTo/editableBy, senão o save falha nas rules.
    if (existingNote.ownerId !== user.uid) {
      delete sanitizedUpdates.scope;
    }
  }

  // Fase 4: ao trocar escopo ou audiência, recalcula via computeAudience mantendo invariantes 6.3.1.
  if (
    sanitizedUpdates.scope !== undefined ||
    sanitizedUpdates.visibleTo !== undefined ||
    sanitizedUpdates.editableBy !== undefined ||
    sanitizedUpdates.ownerId !== undefined
  ) {
    const nextScope =
      sanitizedUpdates.scope !== undefined ? sanitizedUpdates.scope : existingNote.scope;
    const nextOwnerId =
      sanitizedUpdates.ownerId !== undefined
        ? sanitizedUpdates.ownerId
        : existingNote.ownerId || user.uid;
    const prevVis =
      sanitizedUpdates.visibleTo !== undefined
        ? sanitizedUpdates.visibleTo
        : existingNote.visibleTo || [];
    const baseVis =
      nextScope === NOTE_SCOPES.PLAYER &&
      sanitizedUpdates.scope !== undefined &&
      sanitizedUpdates.visibleTo === undefined
        ? prevVis.filter((v) => v && v !== "ALL")
        : prevVis;
    const baseEdit =
      sanitizedUpdates.editableBy !== undefined
        ? sanitizedUpdates.editableBy
        : existingNote.editableBy || [];
    const perms = buildJournalPermissions({
      scope: nextScope,
      targetOwnerId: nextOwnerId,
      campaignGmId: campaign?.gmId,
      currentUserId: user.uid,
      visibleTo: baseVis,
      editableBy: baseEdit
    });
    sanitizedUpdates.ownerId = perms.ownerId;
    sanitizedUpdates.visibleTo = perms.visibleTo;
    sanitizedUpdates.editableBy = perms.editableBy;
  }

  const aliasPrep = await prepareTargetAliasOperations({
    firestoreDb,
    campaignId,
    user,
    isGM,
    rawAdditions: targetAliasAdditions ?? updates?.targetAliasAdditions,
    accessibleNotes,
    selfNoteId: noteId
  });
  if (!aliasPrep.ok) {
    return {
      ok: false,
      reason: aliasPrep.reason,
      error: aliasPrep.error
    };
  }

  const imagePayload = buildResolvedImagePayload({
    incomingImage: sanitizedUpdates.image,
    existingNote
  });
  delete sanitizedUpdates.image;
  if (imagePayload !== undefined) {
    sanitizedUpdates.image = imagePayload;
  }

  const targetVisibleTo =
    sanitizedUpdates.visibleTo !== undefined
      ? sanitizedUpdates.visibleTo
      : existingNote.visibleTo || [];

  if (newFile) {
    const uploaded = await uploadCompressedMedia({
      file: newFile,
      category: "avatar",
      campaignId,
      uploadedBy: user.uid,
      visibleTo: targetVisibleTo
    });
    sanitizedUpdates.image = { mediaId: uploaded.mediaId, url: null };
  } else {
    const refMediaId =
      sanitizedUpdates.image?.mediaId ??
      existingNote.image?.mediaId ??
      existingNote.imageMediaId ??
      null;
    if (
      refMediaId &&
      (sanitizedUpdates.visibleTo !== undefined || sanitizedUpdates.image !== undefined)
    ) {
      await grantNoteMediaIfNeeded({
        firestoreDb,
        campaignId,
        mediaId: refMediaId,
        visibleTo: targetVisibleTo
      });
    }
  }

  const nextRev =
    (typeof existingNote.rev === "number" && Number.isInteger(existingNote.rev)
      ? existingNote.rev
      : 0) + 1;

  const payload = {
    ...sanitizedUpdates,
    campaignId,
    rev: nextRev,
    updatedAt: serverTimestamp()
  };

  const noteRef = doc(firestoreDb, noteDocPath(campaignId, noteId));
  if (aliasPrep.ops.length > 0) {
    const batch = writeBatch(firestoreDb);
    batch.update(noteRef, payload);
    for (const op of aliasPrep.ops) {
      batch.update(doc(firestoreDb, op.path), op.data);
    }
    await batch.commit();
  } else {
    await updateDoc(noteRef, payload);
  }

  return { ok: true, noteId };
}

export async function saveNoteDraft({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  existingNote = null,
  accessibleNotes = [],
  draft = {},
  file = null
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId)) {
    return {
      ok: false,
      reason: "invalid-input",
      error: "Sessão ou campanha inválida."
    };
  }
  const cleanTitle = trimString(draft?.title);
  if (!cleanTitle) {
    return {
      ok: false,
      reason: "invalid-input",
      error: "O título do card é obrigatório."
    };
  }

  const targetId = trimString(draft?.id) || trimString(existingNote?.id);
  const resolvedFile = file ?? draft?.file ?? null;

  if (targetId) {
    const resolvedExisting =
      existingNote ||
      (Array.isArray(accessibleNotes)
        ? accessibleNotes.find((n) => n && n.id === targetId)
        : null) ||
      null;
    return updateJournalNote({
      firestoreDb,
      campaignId,
      campaign,
      user,
      isGM,
      existingNote: resolvedExisting,
      accessibleNotes,
      noteId: targetId,
      updates: {
        title: cleanTitle,
        noteType: draft.noteType,
        folderId: draft.folderId ?? null,
        linkedCharacterId: draft.linkedCharacterId ?? null,
        aliases: draft.aliases,
        ignoredAliases: draft.ignoredAliases,
        sections: draft.sections,
        relatedNoteIds: draft.relatedNoteIds
      },
      newFile: resolvedFile,
      targetAliasAdditions: draft.targetAliasAdditions
    });
  }

  const created = await createJournalNote({
    firestoreDb,
    campaignId,
    campaign,
    user,
    isGM,
    accessibleNotes,
    scope: draft.scope || NOTE_SCOPES.PARTY,
    ownerId: draft.ownerId || null,
    noteType: draft.noteType || NOTE_TYPES.LORE,
    folderId: draft.folderId ?? null,
    title: cleanTitle,
    aliases: draft.aliases,
    sections: draft.sections,
    relatedNoteIds: draft.relatedNoteIds,
    ignoredAliases: draft.ignoredAliases,
    linkedCharacterId: draft.linkedCharacterId ?? null,
    image: draft.image ?? null,
    file: resolvedFile,
    targetAliasAdditions: draft.targetAliasAdditions
  });

  if (!created) {
    return {
      ok: false,
      reason: "invalid-input",
      error: "Não foi possível criar o card."
    };
  }
  if (created.ok === false) {
    return created;
  }
  return {
    ok: true,
    noteId: created.noteId,
    newNote: created.newNote
  };
}

export async function updateJournalNodePosition({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  existingNote,
  noteId,
  x,
  y
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(noteId) || !existingNote) {
    return { ok: false, reason: "invalid-input" };
  }
  if (!canUserEditJournalNote(existingNote, { user, isGM })) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Você não tem permissão para mover este card na teia."
    );
  }
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
    throw new AppError(ERROR_CODES.INVALID_TYPE, "Posição inválida no grafo.");
  }

  const nextRev =
    (typeof existingNote.rev === "number" && Number.isInteger(existingNote.rev)
      ? existingNote.rev
      : 0) + 1;

  await updateDoc(doc(firestoreDb, noteDocPath(campaignId, noteId)), {
    campaignId,
    graphPosition: {
      x: Math.round(x),
      y: Math.round(y),
      pinned: true
    },
    rev: nextRev,
    updatedAt: serverTimestamp()
  });
  return { ok: true, noteId };
}

export async function cloneJournalNoteToTarget({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  sourceNote,
  targetScope = NOTE_SCOPES.PARTY,
  targetOwnerId = null
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !sourceNote) return null;

  const safeTargetScope = !isGM && targetScope === NOTE_SCOPES.GM
    ? NOTE_SCOPES.PLAYER
    : VALID_NOTE_SCOPES.has(targetScope)
      ? targetScope
      : NOTE_SCOPES.PARTY;
  const safeTargetOwnerId = isGM ? trimString(targetOwnerId) || user.uid : user.uid;

  const noteId = createId(ID_PREFIXES.NOTE);
  const noteRef = doc(firestoreDb, noteDocPath(campaignId, noteId));
  const perms = buildJournalPermissions({
    scope: safeTargetScope,
    targetOwnerId: safeTargetOwnerId,
    campaignGmId: campaign?.gmId,
    currentUserId: user.uid
  });

  const sourceImage = normalizeImageRef(
    sourceNote.image ??
      (sourceNote.imageMediaId ? { mediaId: sourceNote.imageMediaId, url: null } : null)
  );
  if (sourceImage.mediaId) {
    await grantNoteMediaIfNeeded({
      firestoreDb,
      campaignId,
      mediaId: sourceImage.mediaId,
      visibleTo: perms.visibleTo
    });
  }

  const keepSameFolder =
    safeTargetScope === (sourceNote.scope || NOTE_SCOPES.PARTY) &&
    perms.ownerId === sourceNote.ownerId;

  const normalized = normalizeNote(
    {
      id: noteId,
      campaignId,
      scope: safeTargetScope,
      ownerId: perms.ownerId,
      visibleTo: perms.visibleTo,
      editableBy: perms.editableBy,
      noteType: VALID_NOTE_TYPES.has(sourceNote.noteType)
        ? sourceNote.noteType
        : NOTE_TYPES.LORE,
      folderId: keepSameFolder ? trimString(sourceNote.folderId) || null : null,
      title: trimString(sourceNote.title) || DEFAULT_NAMES.note,
      aliases: cleanStringList(sourceNote.aliases),
      ignoredAliases: cleanStringList(sourceNote.ignoredAliases),
      sections: normalizeSectionsPayload(sourceNote.sections),
      relatedNoteIds: cleanStringList(sourceNote.relatedNoteIds).filter(
        (id) => id !== noteId
      ),
      linkedCharacterId:
        trimString(sourceNote.linkedCharacterId ?? sourceNote.linkedCharacterSheetId) ||
        null,
      image: sourceImage,
      graphPosition: {
        x: null,
        y: null,
        pinned: false
      },
      clonedFromNoteId: sourceNote.id || null,
      rev: 0,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { id: noteId, campaignId, gmId: campaign?.gmId }
  );

  const clonedDoc = toNoteDoc(normalized);
  await setDoc(noteRef, clonedDoc);
  return { noteId, clonedNote: { id: noteId, ...clonedDoc } };
}

export async function shareJournalNoteWithTarget({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  isRealGM = false,
  note,
  noteId,
  target
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(noteId) || !target || !note) return;
  if (!isGM && !isRealGM && note.ownerId !== user.uid) {
    return;
  }

  const isPartyTarget = target === "party" || target === "ALL";
  const nextScope = isPartyTarget
    ? NOTE_SCOPES.PARTY
    : note.scope === NOTE_SCOPES.GM
      ? NOTE_SCOPES.PLAYER
      : note.scope || NOTE_SCOPES.PLAYER;

  const currentVis = Array.isArray(note.visibleTo) ? [...note.visibleTo] : [];
  if (!isPartyTarget && !currentVis.includes(target)) {
    currentVis.push(target);
  }

  const owner = note.ownerId || user.uid;
  const audience = computeAudience({
    ownerId: owner,
    scope: nextScope,
    visibleTo: currentVis,
    editableBy: note.editableBy,
    gmId: campaign?.gmId || null
  });

  const sharedMediaId = note.image?.mediaId || note.imageMediaId || null;
  if (sharedMediaId) {
    await grantNoteMediaIfNeeded({
      firestoreDb,
      campaignId,
      mediaId: sharedMediaId,
      visibleTo: audience.visibleTo
    });
  }

  const nextRev =
    (typeof note.rev === "number" && Number.isInteger(note.rev) ? note.rev : 0) + 1;

  const updates = {
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    rev: nextRev,
    updatedAt: serverTimestamp()
  };
  if (nextScope !== note.scope) {
    updates.scope = nextScope;
  }

  await updateDoc(doc(firestoreDb, noteDocPath(campaignId, noteId)), updates);
}

export async function revokeJournalNoteAccess({
  firestoreDb = db,
  campaignId,
  campaign = null,
  user,
  isGM = false,
  isRealGM = false,
  note,
  noteId,
  target
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(noteId) || !target || !note) return;
  if (!isGM && !isRealGM && note.ownerId !== user.uid) return;

  const isPartyTarget = target === "party" || target === "ALL";
  const nextScope =
    isPartyTarget && note.scope === NOTE_SCOPES.PARTY
      ? NOTE_SCOPES.PLAYER
      : note.scope || NOTE_SCOPES.PLAYER;

  const rawVis = Array.isArray(note.visibleTo) ? note.visibleTo : [];
  const rawEdit = Array.isArray(note.editableBy) ? note.editableBy : [];
  const filteredVis = isPartyTarget
    ? rawVis.filter((v) => v !== "ALL")
    : rawVis.filter((v) => v !== target);
  const filteredEdit = isPartyTarget
    ? rawEdit.filter((v) => v !== "ALL")
    : rawEdit.filter((v) => v !== target);

  const owner = note.ownerId || user.uid;
  const audience = computeAudience({
    ownerId: owner,
    scope: nextScope,
    visibleTo: filteredVis,
    editableBy: filteredEdit,
    gmId: campaign?.gmId || null
  });

  const nextRev =
    (typeof note.rev === "number" && Number.isInteger(note.rev) ? note.rev : 0) + 1;

  const updates = {
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy,
    rev: nextRev,
    updatedAt: serverTimestamp()
  };
  if (nextScope !== note.scope) {
    updates.scope = nextScope;
  }

  await updateDoc(doc(firestoreDb, noteDocPath(campaignId, noteId)), updates);
}

export async function softDeleteJournalNote({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  note,
  noteId
}) {
  assertClientUpToDate();
  if (!user || !trimString(campaignId) || !trimString(noteId) || !note) return;
  if (!canUserDeleteJournalNote(note, { user, isGM })) return;

  const nextRev =
    (typeof note.rev === "number" && Number.isInteger(note.rev) ? note.rev : 0) + 1;

  await updateDoc(doc(firestoreDb, noteDocPath(campaignId, noteId)), {
    campaignId,
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    rev: nextRev,
    updatedAt: serverTimestamp()
  });
}

export async function createJournalFolder({
  campaignId,
  campaign = null,
  user,
  isGM = false,
  name,
  noteType,
  scope = NOTE_SCOPES.PARTY,
  ownerId = null,
  parentId = null,
  existingFolders = []
}) {
  if (!user || !campaignId || !name?.trim() || !noteType) return null;
  const created = await createUnifiedFolder({
    campaignId,
    user,
    isGM,
    gmId: campaign?.gmId || null,
    domain: FOLDER_DOMAINS.JOURNAL,
    name,
    parentId: parentId || null,
    ownerId,
    scope,
    noteType,
    existingFolders
  });
  return { folderId: created.id, newFolder: created };
}

export async function softDeleteJournalFolder({
  campaignId,
  user,
  isGM = false,
  folderId,
  rawFolders = [],
  rawNotes = [],
  options = { mode: "moveToParent" }
}) {
  if (!user || !campaignId || !folderId) return null;
  const mode =
    options?.mode || (options?.deleteContents ? "deleteAll" : "moveToParent");
  return deleteUnifiedFolder({
    campaignId,
    user,
    isGM,
    folderId,
    mode,
    folders: rawFolders,
    items: rawNotes
  });
}
