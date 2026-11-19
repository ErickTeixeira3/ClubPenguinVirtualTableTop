import { useMemo } from "react";
import { canEditResource, isReleasedToPlayers } from "../../domain/permissions.js";
import { buildFolderTree } from "../../engines/folders/index.js";

function hasExplicitUserAccess(resource, uid) {
  if (!uid || !resource) return false;
  const visibleTo = Array.isArray(resource.visibleTo) ? resource.visibleTo : [];
  const editableBy = Array.isArray(resource.editableBy) ? resource.editableBy : [];
  return visibleTo.includes(uid) || editableBy.includes(uid);
}

function resolveOwnerLabel(ownerId, gmId, playersMap = {}) {
  if (!ownerId) return "Sem Dono";
  if (gmId && ownerId === gmId) return "Mestre";
  const player = playersMap[ownerId];
  return (
    player?.displayName ||
    player?.name ||
    player?.email?.split("@")[0] ||
    ownerId
  );
}

export function buildPlayerList(playersMap = {}, gmId = null) {
  return Object.entries(playersMap || {})
    .filter(([uid]) => uid !== gmId)
    .map(([uid, p]) => ({
      uid,
      displayName:
        p?.displayName || p?.name || p?.email?.split("@")[0] || "Jogador",
      photoURL: p?.photoURL || null
    }));
}

/**
 * Monta as seções e árvores hierárquicas da barra lateral de Fichas:
 * - Visão do Mestre: "Mestre (Você)", "Personagens Sem Dono" (se houver) e uma seção por jogador;
 * - Visão do Jogador: "Suas Fichas" + seções D-DER-5 agrupadas por dono ("Compartilhado — <Dono>"),
 *   aplicando A11 (exclui fichas de terceiros apenas com `["ALL"]`, salvo dentro de pasta com acesso explícito).
 */
export function buildCharacterTreeSections({
  characters = [],
  folders = [],
  currentUserUid = null,
  isGM = false,
  gmId = null,
  playersMap = {},
  canEditFolder = null
}) {
  const safeChars = Array.isArray(characters) ? characters : [];
  const safeFolders = Array.isArray(folders) ? folders : [];
  const playerList = buildPlayerList(playersMap, gmId);
  const playerUidSet = new Set(playerList.map((p) => p.uid));
  const sections = [];

  if (isGM) {
    const resolvedGmOwner = gmId || currentUserUid || null;
    const gmChars = safeChars.filter(
      (c) => Boolean(c?.ownerId) && !playerUidSet.has(c.ownerId)
    );
    const gmFolders = safeFolders.filter(
      (f) => Boolean(f?.ownerId) && !playerUidSet.has(f.ownerId)
    );
    sections.push({
      id: "gm",
      kind: "gm",
      title: "Mestre (Você)",
      ownerId: resolvedGmOwner,
      collapsible: true,
      allowCreate: true,
      allowRootFolderDrop: true,
      tree: buildFolderTree(gmFolders, gmChars),
      totalCount: gmChars.length + gmFolders.length
    });

    const unownedChars = safeChars.filter((c) => !c?.ownerId);
    const unownedFolders = safeFolders.filter((f) => !f?.ownerId);
    if (unownedChars.length > 0 || unownedFolders.length > 0) {
      sections.push({
        id: "unowned",
        kind: "unowned",
        title: "Personagens Sem Dono",
        ownerId: resolvedGmOwner,
        collapsible: true,
        allowCreate: false,
        allowRootFolderDrop: true,
        tree: buildFolderTree(unownedFolders, unownedChars),
        totalCount: unownedChars.length + unownedFolders.length
      });
    }

    for (const player of playerList) {
      const playerChars = safeChars.filter((c) => c?.ownerId === player.uid);
      const playerFolders = safeFolders.filter((f) => f?.ownerId === player.uid);
      sections.push({
        id: `player_${player.uid}`,
        kind: "player",
        title: player.displayName,
        ownerId: player.uid,
        collapsible: true,
        allowCreate: true,
        allowRootFolderDrop: true,
        tree: buildFolderTree(playerFolders, playerChars),
        totalCount: playerChars.length + playerFolders.length,
        emptyText: "(Nenhum personagem ou pasta para este jogador)"
      });
    }

    return { playerList, sections };
  }

  const ownChars = currentUserUid
    ? safeChars.filter((c) => c?.ownerId === currentUserUid)
    : [];
  const ownFolders = currentUserUid
    ? safeFolders.filter((f) => f?.ownerId === currentUserUid)
    : [];

  sections.push({
    id: "own",
    kind: "own",
    title: "Suas Fichas",
    ownerId: currentUserUid,
    collapsible: true,
    allowCreate: false,
    allowRootFolderDrop: true,
    tree: buildFolderTree(ownFolders, ownChars),
    totalCount: ownChars.length + ownFolders.length
  });

  if (!currentUserUid) {
    return { playerList, sections };
  }

  const folderById = new Map(safeFolders.map((f) => [f.id, f]));

  const explicitlySharedFolderIds = new Set();
  for (const folder of safeFolders) {
    if (!folder?.ownerId || folder.ownerId === currentUserUid) continue;
    if (!isReleasedToPlayers(folder, currentUserUid)) continue;
    const hasExplicit = hasExplicitUserAccess(folder, currentUserUid);
    const editableViaFn =
      typeof canEditFolder === "function"
        ? canEditFolder(folder) && hasExplicit
        : canEditResource(folder, { uid: currentUserUid, isGM: false }) && hasExplicit;
    if (hasExplicit || editableViaFn) {
      explicitlySharedFolderIds.add(folder.id);
    }
  }

  // Expande acesso específico para subpastas descendentes de pastas compartilhadas do mesmo dono
  const allSharedFolderScopeIds = new Set(explicitlySharedFolderIds);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const folder of safeFolders) {
      if (
        folder?.parentId &&
        !allSharedFolderScopeIds.has(folder.id) &&
        allSharedFolderScopeIds.has(folder.parentId) &&
        isReleasedToPlayers(folder, currentUserUid)
      ) {
        const parent = folderById.get(folder.parentId);
        if (parent && parent.ownerId === folder.ownerId) {
          allSharedFolderScopeIds.add(folder.id);
          expanded = true;
        }
      }
    }
  }

  const sharedChars = safeChars.filter((c) => {
    if (!c || c.ownerId === currentUserUid) return false;
    if (hasExplicitUserAccess(c, currentUserUid)) return true;
    return Boolean(
      c.folderId &&
        allSharedFolderScopeIds.has(c.folderId) &&
        isReleasedToPlayers(c, currentUserUid)
    );
  });

  const includedSharedFolderIds = new Set(explicitlySharedFolderIds);
  const includeAncestorsForOwner = (startFolderId, expectedOwnerId) => {
    const visited = new Set();
    let currId = startFolderId;
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const fld = folderById.get(currId);
      if (!fld || fld.ownerId !== expectedOwnerId) break;
      if (!isReleasedToPlayers(fld, currentUserUid)) break;
      includedSharedFolderIds.add(fld.id);
      currId = fld.parentId || null;
    }
  };

  for (const char of sharedChars) {
    if (char.folderId) {
      includeAncestorsForOwner(char.folderId, char.ownerId);
    }
  }
  for (const folderId of Array.from(allSharedFolderScopeIds)) {
    const fld = folderById.get(folderId);
    if (fld) {
      includeAncestorsForOwner(fld.id, fld.ownerId);
    }
  }

  const ownerOrder = [];
  const ownerSet = new Set();
  const pushOwner = (ownerId) => {
    const key = ownerId || "__unowned__";
    if (!ownerSet.has(key)) {
      ownerSet.add(key);
      ownerOrder.push(key);
    }
  };

  for (const char of sharedChars) pushOwner(char.ownerId);
  for (const fid of includedSharedFolderIds) {
    const fld = folderById.get(fid);
    if (fld) pushOwner(fld.ownerId);
  }

  ownerOrder.sort((a, b) => {
    if (a === gmId && b !== gmId) return -1;
    if (b === gmId && a !== gmId) return 1;
    return resolveOwnerLabel(a === "__unowned__" ? null : a, gmId, playersMap).localeCompare(
      resolveOwnerLabel(b === "__unowned__" ? null : b, gmId, playersMap)
    );
  });

  for (const ownerKey of ownerOrder) {
    const realOwnerId = ownerKey === "__unowned__" ? null : ownerKey;
    const ownerChars = sharedChars.filter((c) => (c.ownerId || null) === realOwnerId);
    const ownerFolders = safeFolders.filter(
      (f) => includedSharedFolderIds.has(f.id) && (f.ownerId || null) === realOwnerId
    );
    sections.push({
      id: `shared_${ownerKey}`,
      kind: "shared",
      title: `Compartilhado — ${resolveOwnerLabel(realOwnerId, gmId, playersMap)}`,
      ownerId: realOwnerId,
      collapsible: true,
      allowCreate: false,
      allowRootFolderDrop: false,
      tree: buildFolderTree(ownerFolders, ownerChars),
      totalCount: ownerChars.length + ownerFolders.length
    });
  }

  return { playerList, sections };
}

export function useCharacterTree({
  characters = [],
  folders = [],
  currentUserUid = null,
  isGM = false,
  gmId = null,
  playersMap = {},
  canEditFolder = null
}) {
  return useMemo(
    () =>
      buildCharacterTreeSections({
        characters,
        folders,
        currentUserUid,
        isGM,
        gmId,
        playersMap,
        canEditFolder
      }),
    [characters, folders, currentUserUid, isGM, gmId, playersMap, canEditFolder]
  );
}
