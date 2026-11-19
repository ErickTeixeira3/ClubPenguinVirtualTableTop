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
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  LEGACY_FOLDER_KEYS,
  fromFolderDoc,
  normalizeFolder,
  toFolderDoc,
  validateFolder
} from "../domain/models/folder.js";
import {
  canDeleteResource,
  canEditResource,
  canManageResourceAccess
} from "../domain/permissions.js";
import {
  collectDescendantFolderIds,
  validateFolderMove,
  validateFolderName,
  validateItemFolderPlacement
} from "../engines/folders/index.js";
import { db } from "../infra/firebase.js";
import {
  characterDocPath,
  folderDocPath,
  foldersCollectionPath,
  noteDocPath
} from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import { grantMediaAudience } from "./mediaService.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";
import { subscribeVisibleCollection } from "./visibilityService.js";

export const MAX_BATCH_WRITES = 450;

const VALID_DOMAINS = new Set(Object.values(FOLDER_DOMAINS));
const VALID_NOTE_SCOPES = new Set(Object.values(NOTE_SCOPES));
const VALID_NOTE_TYPES = new Set(Object.values(NOTE_TYPES));
const LEGACY_KEY_SET = new Set(LEGACY_FOLDER_KEYS);

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireCampaignAndUser(campaignId, user) {
  if (!trimString(campaignId)) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "campaignId é obrigatório."
    );
  }
  if (!trimString(user?.uid)) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Usuário autenticado é obrigatório."
    );
  }
}

function compareFolders(a, b) {
  const orderA =
    typeof a.order === "number" && Number.isFinite(a.order)
      ? a.order
      : Number.POSITIVE_INFINITY;
  const orderB =
    typeof b.order === "number" && Number.isFinite(b.order)
      ? b.order
      : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) {
    return orderA - orderB;
  }
  const nameCmp = String(a.name || "").localeCompare(String(b.name || ""));
  if (nameCmp !== 0) {
    return nameCmp;
  }
  return String(a.id || "").localeCompare(String(b.id || ""));
}

async function resolveFolderRecord({
  firestoreDb,
  campaignId,
  folderId,
  providedFolder = null,
  folders = []
}) {
  const cleanId = trimString(folderId);
  if (!cleanId) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "folderId é obrigatório."
    );
  }
  const candidate =
    providedFolder ||
    (Array.isArray(folders) ? folders.find((f) => f && f.id === cleanId) : null);
  if (candidate) {
    if (candidate.isDeleted === true) {
      throw new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "A pasta informada foi excluída."
      );
    }
    return fromFolderDoc(candidate, cleanId, { campaignId });
  }

  const snap = await getDoc(doc(firestoreDb, folderDocPath(campaignId, cleanId)));
  if (!snap.exists()) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "Pasta não encontrada."
    );
  }
  const parsed = fromFolderDoc(snap.data(), cleanId, { campaignId });
  if (parsed.isDeleted === true) {
    throw new AppError(
      ERROR_CODES.INVALID_REFERENCE,
      "A pasta informada foi excluída."
    );
  }
  return parsed;
}

async function resolveOptionalParentFolder({
  firestoreDb,
  campaignId,
  parentId,
  folders = []
}) {
  const cleanParentId = trimString(parentId);
  if (!cleanParentId) return null;
  return resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId: cleanParentId,
    folders
  });
}

async function commitSingleWriteBatch(firestoreDb, ops) {
  if (ops.length > MAX_BATCH_WRITES) {
    throw new AppError(
      ERROR_CODES.OUT_OF_RANGE,
      `A operação excede o limite de ${MAX_BATCH_WRITES} escritas por lote (${ops.length}).`
    );
  }
  if (ops.length === 0) {
    return { committed: 0 };
  }
  const batch = writeBatch(firestoreDb);
  for (const op of ops) {
    const ref = doc(firestoreDb, op.path);
    if (op.kind === "set") {
      batch.set(ref, op.data);
    } else if (op.kind === "update") {
      batch.update(ref, op.data);
    } else if (op.kind === "delete") {
      batch.delete(ref);
    }
  }
  await batch.commit();
  return { committed: ops.length };
}

async function grantCharacterMediaAudienceIfNeeded({
  campaignId,
  targetChar,
  visibleTo,
  firestoreDb
}) {
  const mediaIds = Array.from(
    new Set(
      [targetChar?.avatar?.mediaId, targetChar?.token?.image?.mediaId].filter(
        (id) => typeof id === "string" && id.trim().length > 0
      )
    )
  );
  if (mediaIds.length === 0) return;
  await Promise.all(
    mediaIds.map((mediaId) =>
      grantMediaAudience({
        campaignId,
        mediaId,
        visibleTo,
        ...(firestoreDb !== db ? { firestoreDb } : {})
      })
    )
  );
}

/**
 * Assina em tempo real as pastas ativas da campanha filtradas por domínio ("character" | "journal").
 */
export function subscribeFolders({
  campaignId,
  domain,
  gmId = null,
  isRealGM = false,
  uid,
  firestoreDb = db,
  onData,
  onError
}) {
  if (!trimString(campaignId) || !trimString(uid) || !VALID_DOMAINS.has(domain)) {
    return () => {};
  }
  const foldersCol = collection(firestoreDb, foldersCollectionPath(campaignId));
  return subscribeVisibleCollection({
    colRef: foldersCol,
    isRealGM,
    uid,
    onNext: (snapshot) => {
      const list = [];
      for (const snapDoc of snapshot.docs) {
        const folder = fromFolderDoc(snapDoc.data() || {}, snapDoc.id, {
          campaignId,
          gmId: trimString(gmId) || undefined
        });
        if (!folder.isDeleted && folder.domain === domain) {
          list.push(folder);
        }
      }
      list.sort(compareFolders);
      onData?.(list);
    },
    onError: (err) => {
      onError?.(err);
    }
  });
}

/**
 * Cria uma nova pasta unificada (domínio "character" ou "journal") com validação de nome,
 * hierarquia e audiência canônica.
 */
export async function createFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  domain,
  name,
  parentId = null,
  ownerId = null,
  scope = null,
  noteType = null,
  visibleTo,
  editableBy,
  order = 0,
  existingFolders = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);
  if (!VALID_DOMAINS.has(domain)) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Domínio de pasta inválido: "${String(domain)}".`
    );
  }

  const nameValidation = validateFolderName(name);
  if (!nameValidation.ok) {
    throw nameValidation.errors[0];
  }
  const cleanName = name.trim();
  const cleanParentId = trimString(parentId) || null;
  const resolvedGmId = trimString(gmId) || (isGM ? user.uid : "");

  let safeScope = null;
  let safeNoteType = null;
  let effectiveOwnerId;

  if (domain === FOLDER_DOMAINS.JOURNAL) {
    safeScope =
      !isGM && scope === NOTE_SCOPES.GM
        ? NOTE_SCOPES.PLAYER
        : trimString(scope) || NOTE_SCOPES.PARTY;
    if (!VALID_NOTE_SCOPES.has(safeScope)) {
      throw new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Escopo de pasta inválido: "${safeScope}".`
      );
    }
    safeNoteType = trimString(noteType) || NOTE_TYPES.LORE;
    if (!VALID_NOTE_TYPES.has(safeNoteType)) {
      throw new AppError(
        ERROR_CODES.INVALID_ENUM_VALUE,
        `Categoria do diário inválida: "${safeNoteType}".`
      );
    }
    effectiveOwnerId =
      safeScope === NOTE_SCOPES.GM
        ? resolvedGmId || user.uid
        : isGM && trimString(ownerId)
          ? trimString(ownerId)
          : user.uid;
  } else {
    effectiveOwnerId =
      isGM && trimString(ownerId) ? trimString(ownerId) : user.uid;
  }

  const parentFolder = cleanParentId
    ? await resolveOptionalParentFolder({
        firestoreDb,
        campaignId,
        parentId: cleanParentId,
        folders: existingFolders
      })
    : null;

  const audience = computeAudience({
    ownerId: effectiveOwnerId,
    scope: domain === FOLDER_DOMAINS.JOURNAL ? safeScope : undefined,
    gmId: resolvedGmId || undefined,
    visibleTo:
      visibleTo !== undefined
        ? visibleTo
        : domain === FOLDER_DOMAINS.CHARACTER
          ? ["ALL"]
          : undefined,
    editableBy:
      editableBy !== undefined
        ? editableBy
        : domain === FOLDER_DOMAINS.CHARACTER
          ? [effectiveOwnerId]
          : undefined
  });

  const folderId = createId(ID_PREFIXES.FOLDER);
  const entity = normalizeFolder(
    {
      id: folderId,
      campaignId,
      domain,
      name: cleanName,
      parentId: cleanParentId,
      ownerId: effectiveOwnerId,
      scope: safeScope,
      noteType: safeNoteType,
      visibleTo: audience.visibleTo,
      editableBy: audience.editableBy,
      order: typeof order === "number" && Number.isFinite(order) ? order : 0,
      isDeleted: false
    },
    { campaignId, gmId: resolvedGmId || undefined }
  );

  const validation = validateFolder(entity, { parentFolder });
  if (!validation.ok) {
    throw validation.errors[0];
  }

  const payload = {
    ...toFolderDoc(entity),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(firestoreDb, folderDocPath(campaignId, folderId)), payload);

  return { ...entity };
}

/**
 * Renomeia uma pasta respeitando A4 (`editableBy` e dono/Mestre podem renomear) e proibindo "/".
 */
export async function renameFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  folderId,
  name,
  folder = null,
  existingFolders = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);

  const nameValidation = validateFolderName(name);
  if (!nameValidation.ok) {
    throw nameValidation.errors[0];
  }
  const targetFolder = await resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId,
    providedFolder: folder,
    folders: existingFolders
  });

  if (!canEditResource(targetFolder, { uid: user.uid, isGM })) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Você não tem permissão para renomear esta pasta."
    );
  }

  const cleanName = name.trim();
  await updateDoc(doc(firestoreDb, folderDocPath(campaignId, targetFolder.id)), {
    name: cleanName,
    updatedAt: serverTimestamp()
  });
  return { id: targetFolder.id, name: cleanName };
}

/**
 * Atualiza campos permitidos da pasta (nome, ordem ou audiência quando dono/Mestre).
 */
export async function updateFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  folderId,
  updates = {},
  folder = null,
  existingFolders = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Atualização de pasta inválida."
    );
  }

  const targetFolder = await resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId,
    providedFolder: folder,
    folders: existingFolders
  });

  if (!canEditResource(targetFolder, { uid: user.uid, isGM })) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Você não tem permissão para editar esta pasta."
    );
  }

  const payload = {};
  for (const [key, val] of Object.entries(updates)) {
    if (val === undefined) continue;
    if (LEGACY_KEY_SET.has(key)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Campo legado não permitido em pastas v2: "${key}".`
      );
    }
    if (key === "parentId") {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Use moveFolder para alterar a hierarquia da pasta."
      );
    }
    if (key === "domain" || key === "noteType" || key === "campaignId") {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `O campo "${key}" da pasta é imutável.`
      );
    }
    if (key === "isDeleted" || key === "deletedAt" || key === "deletedBy") {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Use deleteFolder para excluir pastas."
      );
    }
    if (key === "name") {
      const nameRes = validateFolderName(val);
      if (!nameRes.ok) throw nameRes.errors[0];
      payload.name = val.trim();
      continue;
    }
    payload[key] = val;
  }

  const touchesAccess =
    payload.visibleTo !== undefined ||
    payload.editableBy !== undefined ||
    payload.scope !== undefined;
  if (touchesAccess) {
    const canManageAccess =
      isGM ||
      canManageResourceAccess(targetFolder, {
        uid: user.uid,
        isGM,
        entityType: "folder"
      });
    if (!canManageAccess) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Apenas o dono da pasta ou o Mestre pode alterar o acesso."
      );
    }
  }
  if (payload.ownerId !== undefined && !isGM && payload.ownerId !== targetFolder.ownerId) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode transferir a posse da pasta."
    );
  }

  if (touchesAccess || payload.ownerId !== undefined) {
    const nextOwnerId =
      payload.ownerId !== undefined ? payload.ownerId : targetFolder.ownerId;
    const nextScope =
      targetFolder.domain === FOLDER_DOMAINS.JOURNAL
        ? payload.scope !== undefined
          ? payload.scope
          : targetFolder.scope
        : undefined;
    const audience = computeAudience({
      ownerId: nextOwnerId,
      scope: nextScope,
      gmId: trimString(gmId) || undefined,
      visibleTo:
        payload.visibleTo !== undefined
          ? payload.visibleTo
          : targetFolder.visibleTo,
      editableBy:
        payload.editableBy !== undefined
          ? payload.editableBy
          : targetFolder.editableBy
    });
    payload.visibleTo = audience.visibleTo;
    payload.editableBy = audience.editableBy;
  }

  if (Object.keys(payload).length === 0) return {};

  payload.updatedAt = serverTimestamp();
  await updateDoc(doc(firestoreDb, folderDocPath(campaignId, targetFolder.id)), payload);
  return payload;
}

/**
 * Transfere a posse de uma subárvore inteira de pastas de personagem (e das fichas nela contidas)
 * para `newOwnerId` num único `writeBatch` (exclusivo do Mestre).
 */
export async function transferFolderOwnership({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  folderId,
  newOwnerId,
  targetParentId = undefined,
  folders = [],
  characters = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);
  if (!isGM) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o Mestre pode transferir a posse de pastas."
    );
  }

  const cleanOwnerId = trimString(newOwnerId);
  if (!cleanOwnerId) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "newOwnerId é obrigatório."
    );
  }

  const targetFolder = await resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId,
    folders
  });
  if (targetFolder.domain !== FOLDER_DOMAINS.CHARACTER) {
    throw new AppError(
      ERROR_CODES.INCOMPATIBLE_FOLDER,
      "Transferência em cascata aplica-se apenas a pastas de personagens."
    );
  }

  const activeFolders = (Array.isArray(folders) ? folders : []).filter(
    (f) => f && !f.isDeleted && f.domain === FOLDER_DOMAINS.CHARACTER
  );
  const folderMap = new Map(activeFolders.map((f) => [f.id, f]));
  if (!folderMap.has(targetFolder.id)) {
    folderMap.set(targetFolder.id, targetFolder);
  }

  const normalizedParentId =
    targetParentId !== undefined
      ? trimString(targetParentId) || null
      : targetFolder.parentId || null;

  const moveCheck = validateFolderMove({
    folder: { ...targetFolder, ownerId: cleanOwnerId },
    targetParentId: normalizedParentId,
    foldersById: folderMap
  });
  if (!moveCheck.ok) {
    throw moveCheck.errors[0];
  }

  const subtreeIds = collectDescendantFolderIds(
    targetFolder.id,
    Array.from(folderMap.values()),
    { includeSelf: true }
  );
  if (subtreeIds.length === 0) {
    subtreeIds.push(targetFolder.id);
  }
  const subtreeSet = new Set(subtreeIds);
  const resolvedGmId = trimString(gmId) || user.uid;

  const affectedChars = (Array.isArray(characters) ? characters : []).filter(
    (c) => c && !c.isDeleted && c.folderId && subtreeSet.has(c.folderId)
  );

  const ops = [];
  for (const fid of subtreeIds) {
    const fDoc = folderMap.get(fid);
    const audience = computeAudience({
      ownerId: cleanOwnerId,
      gmId: resolvedGmId,
      visibleTo: fDoc?.visibleTo,
      editableBy: fDoc?.editableBy
    });
    const updatePayload = {
      ownerId: cleanOwnerId,
      visibleTo: audience.visibleTo,
      editableBy: audience.editableBy,
      updatedAt: serverTimestamp()
    };
    if (fid === targetFolder.id && targetParentId !== undefined) {
      updatePayload.parentId = normalizedParentId;
    }
    ops.push({
      kind: "update",
      path: folderDocPath(campaignId, fid),
      data: updatePayload
    });
  }

  for (const ch of affectedChars) {
    const audience = computeAudience({
      ownerId: cleanOwnerId,
      gmId: resolvedGmId,
      visibleTo: ch.visibleTo,
      editableBy: ch.editableBy
    });
    await grantCharacterMediaAudienceIfNeeded({
      campaignId,
      targetChar: ch,
      visibleTo: audience.visibleTo,
      firestoreDb
    });
    ops.push({
      kind: "update",
      path: characterDocPath(campaignId, ch.id),
      data: {
        ownerId: cleanOwnerId,
        visibleTo: audience.visibleTo,
        editableBy: audience.editableBy,
        rev: increment(1),
        updatedAt: serverTimestamp()
      }
    });
  }

  await commitSingleWriteBatch(firestoreDb, ops);
  return {
    folderIds: subtreeIds,
    characterIds: affectedChars.map((c) => c.id)
  };
}

/**
 * Move uma pasta para outra pasta pai (ou raiz com `targetParentId: null`), bloqueando
 * ciclos e incompatibilidades de domínio/escopo/dono.
 */
export async function moveFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  folderId,
  targetParentId = null,
  targetOwnerId = null,
  folders = [],
  characters = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);

  const targetFolder = await resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId,
    folders
  });

  if (!isGM && targetFolder.ownerId !== user.uid) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o dono da pasta ou o Mestre pode movê-la."
    );
  }

  const cleanTargetParentId = trimString(targetParentId) || null;
  const activeFolders = (Array.isArray(folders) ? folders : []).filter(
    (f) => f && !f.isDeleted
  );
  const folderMap = new Map(activeFolders.map((f) => [f.id, f]));
  if (!folderMap.has(targetFolder.id)) {
    folderMap.set(targetFolder.id, targetFolder);
  }
  if (cleanTargetParentId && !folderMap.has(cleanTargetParentId)) {
    const fetchedParent = await resolveOptionalParentFolder({
      firestoreDb,
      campaignId,
      parentId: cleanTargetParentId
    });
    if (fetchedParent) {
      folderMap.set(fetchedParent.id, fetchedParent);
    }
  }

  const parentFolder = cleanTargetParentId
    ? folderMap.get(cleanTargetParentId) || null
    : null;
  const resolvedTargetOwnerId =
    trimString(targetOwnerId) ||
    (parentFolder && targetFolder.domain === FOLDER_DOMAINS.CHARACTER
      ? parentFolder.ownerId
      : targetFolder.ownerId);

  if (
    targetFolder.domain === FOLDER_DOMAINS.CHARACTER &&
    resolvedTargetOwnerId &&
    resolvedTargetOwnerId !== targetFolder.ownerId
  ) {
    if (!isGM) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Apenas o Mestre pode mover pastas para outro dono."
      );
    }
    const descendants = collectDescendantFolderIds(
      targetFolder.id,
      Array.from(folderMap.values()),
      { includeSelf: true }
    );
    if (cleanTargetParentId && descendants.includes(cleanTargetParentId)) {
      throw new AppError(
        ERROR_CODES.CYCLE_DETECTED,
        "Não é possível mover uma pasta para dentro de suas próprias subpastas."
      );
    }
    return transferFolderOwnership({
      firestoreDb,
      campaignId,
      user,
      isGM,
      gmId,
      folderId: targetFolder.id,
      newOwnerId: resolvedTargetOwnerId,
      targetParentId: cleanTargetParentId,
      folders: Array.from(folderMap.values()),
      characters
    });
  }

  const moveValidation = validateFolderMove({
    folder: targetFolder,
    targetParentId: cleanTargetParentId,
    foldersById: folderMap
  });
  if (!moveValidation.ok) {
    throw moveValidation.errors[0];
  }

  await updateDoc(doc(firestoreDb, folderDocPath(campaignId, targetFolder.id)), {
    parentId: cleanTargetParentId,
    updatedAt: serverTimestamp()
  });

  return { id: targetFolder.id, parentId: cleanTargetParentId };
}

/**
 * Move uma ficha ou nota para uma pasta compatível (ou para a raiz quando `targetFolderId: null`).
 */
export async function moveItemToFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  gmId = null,
  domain,
  itemId,
  item,
  targetFolderId = null,
  targetOwnerId = null,
  targetNoteType = null,
  folders = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);
  if (!VALID_DOMAINS.has(domain)) {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Domínio inválido: "${String(domain)}".`
    );
  }
  const cleanItemId = trimString(itemId || item?.id);
  if (!cleanItemId || !item || typeof item !== "object") {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Item obrigatório para movimentação."
    );
  }

  const cleanFolderId = trimString(targetFolderId) || null;
  const targetFolder = cleanFolderId
    ? await resolveOptionalParentFolder({
        firestoreDb,
        campaignId,
        parentId: cleanFolderId,
        folders
      })
    : null;

  if (domain === FOLDER_DOMAINS.CHARACTER) {
    if (!isGM && item.ownerId !== user.uid) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Apenas o dono da ficha ou o Mestre pode movê-la."
      );
    }
    const nextOwnerId =
      isGM && trimString(targetOwnerId)
        ? trimString(targetOwnerId)
        : targetFolder && isGM
          ? targetFolder.ownerId
          : item.ownerId;
    if (!isGM && nextOwnerId !== item.ownerId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Apenas o Mestre pode transferir a posse da ficha."
      );
    }

    const placementCheck = validateItemFolderPlacement({
      item: { ...item, ownerId: nextOwnerId },
      targetFolder,
      domain
    });
    if (!placementCheck.ok) {
      throw placementCheck.errors[0];
    }

    const updatePayload = {
      folderId: cleanFolderId,
      rev: increment(1),
      updatedAt: serverTimestamp()
    };

    if (nextOwnerId && nextOwnerId !== item.ownerId) {
      const audience = computeAudience({
        ownerId: nextOwnerId,
        gmId: trimString(gmId) || user.uid,
        visibleTo: item.visibleTo,
        editableBy: item.editableBy
      });
      await grantCharacterMediaAudienceIfNeeded({
        campaignId,
        targetChar: item,
        visibleTo: audience.visibleTo,
        firestoreDb
      });
      updatePayload.ownerId = nextOwnerId;
      updatePayload.visibleTo = audience.visibleTo;
      updatePayload.editableBy = audience.editableBy;
    }

    await updateDoc(doc(firestoreDb, characterDocPath(campaignId, cleanItemId)), updatePayload);
    return { itemId: cleanItemId, folderId: cleanFolderId, ownerId: nextOwnerId };
  }

  if (!canEditResource(item, { uid: user.uid, isGM })) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Você não tem permissão para mover este card."
    );
  }
  const nextNoteType = trimString(targetNoteType) || targetFolder?.noteType || item.noteType;
  const placementCheck = validateItemFolderPlacement({
    item: { ...item, noteType: nextNoteType },
    targetFolder,
    domain
  });
  if (!placementCheck.ok) {
    throw placementCheck.errors[0];
  }

  const noteUpdate = {
    folderId: cleanFolderId,
    updatedAt: serverTimestamp()
  };
  if (nextNoteType && nextNoteType !== item.noteType) {
    noteUpdate.noteType = nextNoteType;
  }
  await updateDoc(doc(firestoreDb, noteDocPath(campaignId, cleanItemId)), noteUpdate);
  return { itemId: cleanItemId, folderId: cleanFolderId, noteType: nextNoteType };
}

/**
 * Exclui (Soft Delete) uma pasta e trata seu conteúdo de forma atômica em um único `writeBatch`:
 * - `moveToParent` (D-2): subpastas filhas diretas e itens diretos vão para a pasta pai, preservando subárvores.
 * - `deleteAll` (D-3): oculta a subárvore excluível pelo usuário e move itens/subpastas não excluíveis para o ancestral sobrevivente.
 */
export async function deleteFolder({
  firestoreDb = db,
  campaignId,
  user,
  isGM = false,
  folderId,
  mode = "moveToParent",
  deleteContents = undefined,
  folders = [],
  items = []
}) {
  assertClientUpToDate();
  requireCampaignAndUser(campaignId, user);

  const targetFolder = await resolveFolderRecord({
    firestoreDb,
    campaignId,
    folderId,
    folders
  });

  if (!canDeleteResource(targetFolder, { uid: user.uid, isGM, entityType: "folder" })) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas o dono da pasta ou o Mestre pode excluí-la."
    );
  }

  const resolvedMode =
    typeof deleteContents === "boolean"
      ? deleteContents
        ? "deleteAll"
        : "moveToParent"
      : mode;

  const domain = targetFolder.domain;
  const parentDestination = targetFolder.parentId || null;
  const activeFolders = (Array.isArray(folders) ? folders : []).filter(
    (f) => f && !f.isDeleted && (f.domain ? f.domain === domain : true)
  );
  const folderMap = new Map(activeFolders.map((f) => [f.id, f]));
  if (!folderMap.has(targetFolder.id)) {
    folderMap.set(targetFolder.id, targetFolder);
  }
  const activeItems = (Array.isArray(items) ? items : []).filter(
    (it) => it && !it.isDeleted
  );

  const ops = [];

  if (resolvedMode === "moveToParent") {
    ops.push({
      kind: "update",
      path: folderDocPath(campaignId, targetFolder.id),
      data: {
        campaignId,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: serverTimestamp()
      }
    });

    for (const childFolder of folderMap.values()) {
      if (childFolder.id !== targetFolder.id && childFolder.parentId === targetFolder.id) {
        ops.push({
          kind: "update",
          path: folderDocPath(campaignId, childFolder.id),
          data: {
            parentId: parentDestination,
            updatedAt: serverTimestamp()
          }
        });
      }
    }

    for (const item of activeItems) {
      if (item.folderId !== targetFolder.id) continue;
      if (domain === FOLDER_DOMAINS.CHARACTER) {
        if (isGM || item.ownerId === user.uid) {
          ops.push({
            kind: "update",
            path: characterDocPath(campaignId, item.id),
            data: {
              folderId: parentDestination,
              rev: increment(1),
              updatedAt: serverTimestamp()
            }
          });
        }
      } else if (canEditResource(item, { uid: user.uid, isGM })) {
        ops.push({
          kind: "update",
          path: noteDocPath(campaignId, item.id),
          data: {
            folderId: parentDestination,
            updatedAt: serverTimestamp()
          }
        });
      }
    }

    return commitSingleWriteBatch(firestoreDb, ops);
  }

  if (resolvedMode !== "deleteAll") {
    throw new AppError(
      ERROR_CODES.INVALID_ENUM_VALUE,
      `Modo de exclusão inválido: "${String(resolvedMode)}".`
    );
  }

  const subtreeIds = collectDescendantFolderIds(
    targetFolder.id,
    Array.from(folderMap.values()),
    { includeSelf: true }
  );
  if (subtreeIds.length === 0) {
    subtreeIds.push(targetFolder.id);
  }

  const deletableFolderIds = new Set();
  const survivingFolderIds = [];
  for (const fid of subtreeIds) {
    const fObj = folderMap.get(fid);
    if (
      fid === targetFolder.id ||
      (fObj && canDeleteResource(fObj, { uid: user.uid, isGM, entityType: "folder" }))
    ) {
      deletableFolderIds.add(fid);
    } else if (fObj) {
      survivingFolderIds.push(fid);
    }
  }

  const resolveSurvivingDestination = (startFolderId) => {
    const visited = new Set();
    let currId = startFolderId;
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      if (!deletableFolderIds.has(currId)) {
        return currId;
      }
      const node = folderMap.get(currId);
      currId = node ? node.parentId || null : null;
    }
    return parentDestination;
  };

  for (const fid of deletableFolderIds) {
    ops.push({
      kind: "update",
      path: folderDocPath(campaignId, fid),
      data: {
        campaignId,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: serverTimestamp()
      }
    });
  }

  for (const fid of survivingFolderIds) {
    const fObj = folderMap.get(fid);
    if (fObj && deletableFolderIds.has(fObj.parentId)) {
      ops.push({
        kind: "update",
        path: folderDocPath(campaignId, fid),
        data: {
          parentId: resolveSurvivingDestination(fObj.parentId),
          updatedAt: serverTimestamp()
        }
      });
    }
  }

  for (const item of activeItems) {
    if (!item.folderId || !deletableFolderIds.has(item.folderId)) continue;
    const itemPath =
      domain === FOLDER_DOMAINS.CHARACTER
        ? characterDocPath(campaignId, item.id)
        : noteDocPath(campaignId, item.id);

    if (canDeleteResource(item, { uid: user.uid, isGM })) {
      const payload = {
        campaignId,
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: serverTimestamp()
      };
      if (domain === FOLDER_DOMAINS.CHARACTER) {
        payload.rev = increment(1);
      }
      ops.push({ kind: "update", path: itemPath, data: payload });
    } else if (
      domain === FOLDER_DOMAINS.JOURNAL &&
      canEditResource(item, { uid: user.uid, isGM })
    ) {
      const payload = {
        folderId: resolveSurvivingDestination(item.folderId),
        updatedAt: serverTimestamp()
      };
      if (domain === FOLDER_DOMAINS.CHARACTER) {
        payload.rev = increment(1);
      }
      ops.push({ kind: "update", path: itemPath, data: payload });
    }
  }

  return commitSingleWriteBatch(firestoreDb, ops);
}
