import { FOLDER_DOMAINS, NOTE_SCOPES } from "../../domain/constants.js";
import {
  AppError,
  ERROR_CODES,
  validationFail,
  validationOk
} from "../../domain/errors.js";

const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

const VALID_DOMAINS = new Set(Object.values(FOLDER_DOMAINS));

function trimId(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed || UNSAFE_KEYS.has(trimmed)) {
    return "";
  }
  return trimmed;
}

function toFoldersMap(folders) {
  const map = new Map();
  if (!folders) {
    return map;
  }

  const addEntry = (rawKey, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    if (entry.isDeleted === true) {
      return;
    }
    const id = trimId(entry.id) || trimId(rawKey);
    if (!id) {
      return;
    }
    const normalized = entry.id === id ? entry : { ...entry, id };
    map.set(id, normalized);
  };

  if (folders instanceof Map) {
    for (const [key, entry] of folders.entries()) {
      addEntry(key, entry);
    }
    return map;
  }

  if (Array.isArray(folders)) {
    for (const entry of folders) {
      addEntry(null, entry);
    }
    return map;
  }

  if (typeof folders === "object") {
    for (const [key, entry] of Object.entries(folders)) {
      if (!UNSAFE_KEYS.has(key)) {
        addEntry(key, entry);
      }
    }
  }

  return map;
}

function toItemsList(items) {
  const list = [];
  if (!items) {
    return list;
  }

  const pushEntry = (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    if (entry.isDeleted === true) {
      return;
    }
    list.push(entry);
  };

  if (items instanceof Map) {
    for (const entry of items.values()) {
      pushEntry(entry);
    }
    return list;
  }

  if (Array.isArray(items)) {
    for (const entry of items) {
      pushEntry(entry);
    }
    return list;
  }

  if (typeof items === "object") {
    for (const [key, entry] of Object.entries(items)) {
      if (!UNSAFE_KEYS.has(key)) {
        pushEntry(entry);
      }
    }
  }

  return list;
}

function compareByOrderThenName(a, b) {
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

  const labelA = String(a.name ?? a.title ?? "").trim();
  const labelB = String(b.name ?? b.title ?? "").trim();
  const labelCmp = labelA.localeCompare(labelB);
  if (labelCmp !== 0) {
    return labelCmp;
  }

  return String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

export function validateFolderName(name) {
  if (typeof name !== "string") {
    return validationFail(
      new AppError(ERROR_CODES.INVALID_TYPE, "Folder name must be a string", {
        field: "name"
      })
    );
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_FOLDER_NAME,
        "Folder name cannot be empty",
        { field: "name" }
      )
    );
  }
  if (trimmed.includes("/")) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_FOLDER_NAME,
        'Folder name cannot contain "/"',
        { field: "name", name: trimmed }
      )
    );
  }
  return validationOk();
}

export function collectDescendantFolderIds(folderId, folders, options = {}) {
  const rootId = trimId(folderId);
  if (!rootId) {
    return [];
  }

  const { includeSelf = false } =
    options && typeof options === "object" ? options : {};

  const byId = toFoldersMap(folders);
  const childrenByParent = new Map();
  for (const folder of byId.values()) {
    const parentId = trimId(folder.parentId);
    if (!parentId) {
      continue;
    }
    let bucket = childrenByParent.get(parentId);
    if (!bucket) {
      bucket = [];
      childrenByParent.set(parentId, bucket);
    }
    bucket.push(folder);
  }

  for (const bucket of childrenByParent.values()) {
    bucket.sort(compareByOrderThenName);
  }

  if (!byId.has(rootId) && !childrenByParent.has(rootId)) {
    return [];
  }

  const visited = new Set([rootId]);
  const result = includeSelf ? [rootId] : [];
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = childrenByParent.get(currentId) || [];
    for (const child of children) {
      if (!visited.has(child.id)) {
        visited.add(child.id);
        result.push(child.id);
        queue.push(child.id);
      }
    }
  }

  return result;
}

export function getFolderDisplayPath(folderId, foldersById, options = {}) {
  const startId = trimId(folderId);
  if (!startId) {
    return "";
  }

  const { separator = " / " } =
    options && typeof options === "object" ? options : {};

  const byId = toFoldersMap(foldersById);
  if (!byId.has(startId)) {
    return "";
  }

  const visited = new Set();
  const segments = [];
  let currentId = startId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = byId.get(currentId);
    if (!folder) {
      break;
    }
    const label =
      typeof folder.name === "string" && folder.name.trim()
        ? folder.name.trim()
        : typeof folder.title === "string" && folder.title.trim()
          ? folder.title.trim()
          : currentId;
    segments.unshift(label);
    currentId = trimId(folder.parentId);
  }

  return segments.join(separator);
}

export function buildFolderTree(folders, items = []) {
  const foldersById = toFoldersMap(folders);
  const itemsList = toItemsList(items);

  const nodesById = new Map();
  for (const [id, folder] of foldersById.entries()) {
    nodesById.set(id, {
      id,
      folder,
      children: [],
      items: [],
      totalItemCount: 0
    });
  }

  const rootItems = [];
  const orphanItemIds = [];
  for (const item of itemsList) {
    const rawFolderId =
      typeof item.folderId === "string" ? item.folderId.trim() : "";
    if (rawFolderId && nodesById.has(rawFolderId)) {
      nodesById.get(rawFolderId).items.push(item);
    } else {
      rootItems.push(item);
      if (rawFolderId && typeof item.id === "string" && item.id.trim()) {
        orphanItemIds.push(item.id.trim());
      }
    }
  }

  const childrenMap = new Map();
  const rootCandidates = [];
  const orphanFolderIds = [];
  const cycleSet = new Set();

  for (const [id, folder] of foldersById.entries()) {
    const node = nodesById.get(id);
    const rawParentId =
      typeof folder.parentId === "string" ? folder.parentId.trim() : "";

    if (!rawParentId) {
      rootCandidates.push(node);
    } else if (!nodesById.has(rawParentId)) {
      rootCandidates.push(node);
      orphanFolderIds.push(id);
    } else if (rawParentId === id) {
      cycleSet.add(id);
    } else {
      let bucket = childrenMap.get(rawParentId);
      if (!bucket) {
        bucket = [];
        childrenMap.set(rawParentId, bucket);
      }
      bucket.push(node);
    }
  }

  for (const bucket of childrenMap.values()) {
    bucket.sort((a, b) => compareByOrderThenName(a.folder, b.folder));
  }
  rootCandidates.sort((a, b) => compareByOrderThenName(a.folder, b.folder));

  const placed = new Set();
  const roots = [];

  const attachSubtree = (node) => {
    placed.add(node.id);
    const children = childrenMap.get(node.id) || [];
    for (const child of children) {
      if (!placed.has(child.id)) {
        node.children.push(child);
        attachSubtree(child);
      }
    }
  };

  for (const rootNode of rootCandidates) {
    if (!placed.has(rootNode.id)) {
      roots.push(rootNode);
      attachSubtree(rootNode);
    }
  }

  const remaining = Array.from(nodesById.values())
    .filter((node) => !placed.has(node.id))
    .sort((a, b) => compareByOrderThenName(a.folder, b.folder));

  for (const startNode of remaining) {
    if (placed.has(startNode.id)) {
      continue;
    }
    const chain = [];
    const chainSet = new Set();
    let curr = startNode;

    while (curr && !placed.has(curr.id) && !chainSet.has(curr.id)) {
      chainSet.add(curr.id);
      chain.push(curr);
      const pId = trimId(curr.folder.parentId);
      curr = pId ? nodesById.get(pId) : null;
    }

    if (curr && chainSet.has(curr.id)) {
      const cycleStartIdx = chain.indexOf(curr);
      for (let i = cycleStartIdx; i < chain.length; i += 1) {
        cycleSet.add(chain[i].id);
      }
      roots.push(curr);
      attachSubtree(curr);
    }
  }

  const finalizeNode = (node) => {
    node.items.sort(compareByOrderThenName);
    node.children.sort((a, b) => compareByOrderThenName(a.folder, b.folder));
    let total = node.items.length;
    for (const child of node.children) {
      total += finalizeNode(child);
    }
    node.totalItemCount = total;
    return total;
  };

  rootItems.sort(compareByOrderThenName);
  roots.sort((a, b) => compareByOrderThenName(a.folder, b.folder));
  for (const rootNode of roots) {
    finalizeNode(rootNode);
  }

  return {
    roots,
    rootItems,
    nodesById,
    orphanFolderIds,
    orphanItemIds,
    cycleFolderIds: Array.from(cycleSet)
  };
}

export function validateFolderMove(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const { folder, targetParentId = null, foldersById } = opts;

  if (!folder || typeof folder !== "object" || Array.isArray(folder)) {
    return validationFail(
      new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "Folder is required", {
        field: "folder"
      })
    );
  }

  const folderId = trimId(folder.id);
  if (!folderId) {
    return validationFail(
      new AppError(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        "Folder id is required",
        { field: "folder.id" }
      )
    );
  }

  if (!VALID_DOMAINS.has(folder.domain)) {
    return validationFail(
      new AppError(ERROR_CODES.INVALID_ENUM_VALUE, "Invalid folder domain", {
        domain: folder.domain
      })
    );
  }

  if (targetParentId === null || targetParentId === undefined) {
    return validationOk();
  }

  if (typeof targetParentId !== "string") {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "targetParentId must be a string or null",
        { targetParentId }
      )
    );
  }

  const targetId = trimId(targetParentId);
  if (!targetId) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Target parent folder ID cannot be empty",
        { targetParentId }
      )
    );
  }

  if (targetId === folderId) {
    return validationFail(
      new AppError(
        ERROR_CODES.CYCLE_DETECTED,
        "A folder cannot be moved into itself",
        { folderId, targetParentId: targetId }
      )
    );
  }

  const byId = toFoldersMap(foldersById);
  const targetParent = byId.get(targetId);
  if (!targetParent) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Target parent folder not found",
        { targetParentId: targetId }
      )
    );
  }

  const errors = [];

  let isCycle = false;
  const visitedAncestors = new Set();
  let currId = targetId;
  while (currId && !visitedAncestors.has(currId)) {
    visitedAncestors.add(currId);
    const currFolder = byId.get(currId);
    if (!currFolder) {
      break;
    }
    const nextParentId = trimId(currFolder.parentId);
    if (nextParentId === folderId) {
      isCycle = true;
      break;
    }
    currId = nextParentId;
  }

  if (isCycle) {
    errors.push(
      new AppError(
        ERROR_CODES.CYCLE_DETECTED,
        "Cannot move a folder into one of its descendants",
        { folderId, targetParentId: targetId }
      )
    );
  }

  if (targetParent.domain !== folder.domain) {
    errors.push(
      new AppError(
        ERROR_CODES.INCOMPATIBLE_FOLDER,
        "Target parent folder belongs to a different domain",
        {
          folderDomain: folder.domain,
          targetDomain: targetParent.domain
        }
      )
    );
  } else if (folder.domain === FOLDER_DOMAINS.CHARACTER) {
    if ((folder.ownerId || null) !== (targetParent.ownerId || null)) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Character folders in the same subtree must share the same ownerId",
          {
            folderOwnerId: folder.ownerId || null,
            targetOwnerId: targetParent.ownerId || null
          }
        )
      );
    }
  } else if (folder.domain === FOLDER_DOMAINS.JOURNAL) {
    if (targetParent.scope !== folder.scope) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Journal folders must share the same scope as their parent",
          {
            folderScope: folder.scope,
            targetScope: targetParent.scope
          }
        )
      );
    }
    if (targetParent.noteType !== folder.noteType) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Journal folders must share the same noteType as their parent",
          {
            folderNoteType: folder.noteType,
            targetNoteType: targetParent.noteType
          }
        )
      );
    }
    if (
      folder.scope === NOTE_SCOPES.PLAYER &&
      (folder.ownerId || null) !== (targetParent.ownerId || null)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Player-scoped journal folders must share the same ownerId",
          {
            folderOwnerId: folder.ownerId || null,
            targetOwnerId: targetParent.ownerId || null
          }
        )
      );
    }
  }

  return errors.length > 0 ? validationFail(errors) : validationOk();
}

export function validateItemFolderPlacement(params = {}) {
  const opts = params && typeof params === "object" ? params : {};
  const { item, targetFolder = null, domain } = opts;

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return validationFail(
      new AppError(ERROR_CODES.MISSING_REQUIRED_FIELD, "Item is required", {
        field: "item"
      })
    );
  }

  const effectiveDomain = domain ?? targetFolder?.domain;
  if (!VALID_DOMAINS.has(effectiveDomain)) {
    return validationFail(
      new AppError(ERROR_CODES.INVALID_ENUM_VALUE, "Invalid folder domain", {
        domain: effectiveDomain
      })
    );
  }

  if (targetFolder === null || targetFolder === undefined) {
    return validationOk();
  }

  if (typeof targetFolder !== "object" || Array.isArray(targetFolder)) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "targetFolder must be an object or null",
        { targetFolder }
      )
    );
  }

  if (targetFolder.isDeleted === true) {
    return validationFail(
      new AppError(
        ERROR_CODES.INVALID_REFERENCE,
        "Target folder is deleted",
        { folderId: targetFolder.id ?? null }
      )
    );
  }

  const errors = [];

  if (targetFolder.domain !== effectiveDomain) {
    errors.push(
      new AppError(
        ERROR_CODES.INCOMPATIBLE_FOLDER,
        "Target folder belongs to a different domain",
        {
          itemDomain: effectiveDomain,
          folderDomain: targetFolder.domain
        }
      )
    );
  } else if (effectiveDomain === FOLDER_DOMAINS.CHARACTER) {
    if ((item.ownerId || null) !== (targetFolder.ownerId || null)) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Character must share ownerId with target folder",
          {
            itemOwnerId: item.ownerId || null,
            folderOwnerId: targetFolder.ownerId || null
          }
        )
      );
    }
  } else if (effectiveDomain === FOLDER_DOMAINS.JOURNAL) {
    if (item.scope !== targetFolder.scope) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Note must share scope with target folder",
          {
            itemScope: item.scope,
            folderScope: targetFolder.scope
          }
        )
      );
    }
    if (item.noteType !== targetFolder.noteType) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Note must share noteType with target folder",
          {
            itemNoteType: item.noteType,
            folderNoteType: targetFolder.noteType
          }
        )
      );
    }
    if (
      targetFolder.scope === NOTE_SCOPES.PLAYER &&
      (item.ownerId || null) !== (targetFolder.ownerId || null)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Player-scoped note must share ownerId with target folder",
          {
            itemOwnerId: item.ownerId || null,
            folderOwnerId: targetFolder.ownerId || null
          }
        )
      );
    }
  }

  return errors.length > 0 ? validationFail(errors) : validationOk();
}
