import { FOLDER_DOMAINS, NOTE_SCOPES } from "../../domain/constants.js";
import { buildFolderTree as buildUnifiedFolderTree } from "../../engines/folders/index.js";

export function resolveActiveJournalTarget({
  activeScopeTab,
  isGM,
  selectedPlayerUid,
  currentUserId
}) {
  const scope =
    activeScopeTab === "unified"
      ? NOTE_SCOPES.PARTY
      : activeScopeTab === NOTE_SCOPES.GM && isGM
        ? NOTE_SCOPES.GM
        : activeScopeTab;

  const ownerId =
    scope === NOTE_SCOPES.PLAYER
      ? isGM
        ? selectedPlayerUid || currentUserId
        : currentUserId
      : currentUserId;

  return { scope, ownerId };
}

export function matchesJournalScopeFilter(
  item,
  { activeScopeTab, isGM, selectedPlayerUid, currentUserId }
) {
  if (!item) return false;
  if (activeScopeTab === NOTE_SCOPES.GM) return item.scope === NOTE_SCOPES.GM;
  if (activeScopeTab === NOTE_SCOPES.PARTY) return item.scope === NOTE_SCOPES.PARTY;
  if (activeScopeTab === NOTE_SCOPES.PLAYER) {
    const targetOwner = isGM ? selectedPlayerUid || currentUserId : currentUserId;
    return item.scope === NOTE_SCOPES.PLAYER && item.ownerId === targetOwner;
  }
  return true;
}

function partitionKeyForJournalItem(item) {
  const scope = item?.scope || NOTE_SCOPES.PARTY;
  const noteType = item?.noteType || "lore";
  return scope === NOTE_SCOPES.PLAYER
    ? `${scope}::${item?.ownerId || ""}::${noteType}`
    : `${scope}::*::${noteType}`;
}

function compareTreeNodes(a, b) {
  const orderA =
    typeof a.folder?.order === "number" && Number.isFinite(a.folder.order)
      ? a.folder.order
      : Number.POSITIVE_INFINITY;
  const orderB =
    typeof b.folder?.order === "number" && Number.isFinite(b.folder.order)
      ? b.folder.order
      : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.folder?.name || "").localeCompare(String(b.folder?.name || ""));
}

function compareNotes(a, b) {
  const orderA =
    typeof a?.order === "number" && Number.isFinite(a.order)
      ? a.order
      : Number.POSITIVE_INFINITY;
  const orderB =
    typeof b?.order === "number" && Number.isFinite(b.order)
      ? b.order
      : Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  return String(a?.title || a?.name || "").localeCompare(
    String(b?.title || b?.name || "")
  );
}

export function buildCategoryTree(foldersForType = [], notesForType = []) {
  const buckets = new Map();
  const ensureBucket = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, { folders: [], notes: [] });
    }
    return buckets.get(key);
  };

  for (const folder of foldersForType) {
    ensureBucket(partitionKeyForJournalItem(folder)).folders.push({
      ...folder,
      domain: folder.domain || FOLDER_DOMAINS.JOURNAL
    });
  }
  for (const note of notesForType) {
    ensureBucket(partitionKeyForJournalItem(note)).notes.push(note);
  }

  const allRoots = [];
  const allRootItems = [];

  for (const bucket of buckets.values()) {
    const foldersById = new Map(bucket.folders.map((f) => [f.id, f]));
    const normalizedNotes = bucket.notes.map((n) =>
      n.folderId && foldersById.has(n.folderId) ? n : { ...n, folderId: null }
    );

    const tree = buildUnifiedFolderTree(bucket.folders, normalizedNotes);
    allRoots.push(...tree.roots);
    allRootItems.push(...tree.rootItems);
  }

  allRoots.sort(compareTreeNodes);
  allRootItems.sort(compareNotes);

  return { roots: allRoots, rootItems: allRootItems };
}
