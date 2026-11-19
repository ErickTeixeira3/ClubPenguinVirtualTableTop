import { useCallback, useEffect, useMemo, useState } from "react";
import { FOLDER_DOMAINS } from "../domain/constants.js";
import {
  canDeleteResource,
  canEditResource,
  isReleasedToPlayers
} from "../domain/permissions.js";
import { subscribeCharacters } from "../services/characterService.js";
import {
  createFolder as createFolderService,
  deleteFolder as deleteFolderService,
  moveFolder as moveFolderService,
  moveItemToFolder as moveItemToFolderService,
  renameFolder as renameFolderService,
  transferFolderOwnership as transferFolderOwnershipService,
  updateFolder as updateFolderService
} from "../services/folderService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useCharacterActions } from "./useCharacterActions.js";
import { useFolders } from "./useFolders";

export function useCharacters() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);
  const { folders: dedicatedFolders, setFolders: setDedicatedFolders } = useFolders(
    FOLDER_DOMAINS.CHARACTER
  );

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;
    return subscribeCharacters({
      campaignId,
      gmId,
      isRealGM,
      uid: listenerUid,
      onData: setRawItems,
      onError: notifyError
    });
  }, [listenerUid, campaignId, campaignReady, isRealGM, gmId]);

  const rawCharacters = useMemo(
    () => rawItems.filter((i) => !i.isFolder && !i.isDeleted),
    [rawItems]
  );

  const rawFolders = useMemo(
    () => dedicatedFolders.filter((f) => !f.isDeleted),
    [dedicatedFolders]
  );

  const characters = useMemo(() => {
    if (isGM) return rawCharacters;
    const viewerUid = isRealGM ? null : user?.uid;
    return rawCharacters.filter((c) => isReleasedToPlayers(c, viewerUid));
  }, [rawCharacters, isGM, isRealGM, user?.uid]);

  const folders = useMemo(() => {
    if (isGM) return rawFolders;
    const viewerUid = isRealGM ? null : user?.uid;
    return rawFolders.filter((f) => isReleasedToPlayers(f, viewerUid));
  }, [rawFolders, isGM, isRealGM, user?.uid]);

  const canEditCharacter = useCallback(
    (character) => canEditResource(character, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const canEditFolder = useCallback(
    (folder) => canEditResource(folder, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const canDeleteCharacter = useCallback(
    (character) => canDeleteResource(character, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const canDeleteFolder = useCallback(
    (folder) => canDeleteResource(folder, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const handleOptimisticInsert = useCallback((created) => {
    if (!created?.id) return;
    setRawItems((prev) => {
      if (prev.some((c) => c.id === created.id)) return prev;
      return [...prev, created];
    });
  }, []);

  const actions = useCharacterActions({
    rawCharacters,
    rawFolders,
    onOptimisticInsert: handleOptimisticInsert
  });

  const createFolder = useCallback(
    async ({ name, parentId = null, ownerId = null }) => {
      if (!user || !campaignId || !name?.trim()) return null;
      try {
        const created = await createFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          domain: FOLDER_DOMAINS.CHARACTER,
          name,
          parentId: parentId || null,
          ownerId,
          existingFolders: rawFolders
        });
        setDedicatedFolders((prev) =>
          prev.some((item) => item.id === created.id) ? prev : [...prev, created]
        );
        return created.id;
      } catch (err) {
        notifyError(err);
        return null;
      }
    },
    [user, campaignId, isGM, gmId, rawFolders, setDedicatedFolders]
  );

  const renameFolder = useCallback(
    async (folderId, name) => {
      if (!user || !campaignId || !folderId) return false;
      try {
        await renameFolderService({
          campaignId,
          user,
          isGM,
          folderId,
          name,
          existingFolders: rawFolders
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, rawFolders]
  );

  const updateFolder = useCallback(
    async (folderId, updates = {}) => {
      if (!user || !campaignId || !folderId || !updates) return false;
      try {
        const { parentId, ownerId, ...restUpdates } = updates;
        if (parentId !== undefined || ownerId !== undefined) {
          await moveFolderService({
            campaignId,
            user,
            isGM,
            gmId,
            folderId,
            targetParentId: parentId !== undefined ? parentId : null,
            targetOwnerId: ownerId !== undefined ? ownerId : null,
            folders: rawFolders,
            characters: rawCharacters
          });
        }
        if (Object.keys(restUpdates).length > 0) {
          await updateFolderService({
            campaignId,
            user,
            isGM,
            gmId,
            folderId,
            updates: restUpdates,
            existingFolders: rawFolders
          });
        }
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawFolders, rawCharacters]
  );

  const transferFolderOwnership = useCallback(
    async (folderId, newOwnerId, targetParentId = undefined) => {
      if (!user || !campaignId || !folderId || !newOwnerId) return false;
      try {
        await transferFolderOwnershipService({
          campaignId,
          user,
          isGM,
          gmId,
          folderId,
          newOwnerId,
          targetParentId,
          folders: rawFolders,
          characters: rawCharacters
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawFolders, rawCharacters]
  );

  const deleteFolder = useCallback(
    async (folderId, options = { mode: "moveToParent" }) => {
      if (!user || !campaignId || !folderId) return false;
      const mode =
        options?.mode || (options?.deleteContents ? "deleteAll" : "moveToParent");
      try {
        await deleteFolderService({
          campaignId,
          user,
          isGM,
          folderId,
          mode,
          folders: rawFolders,
          items: rawCharacters
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, rawFolders, rawCharacters]
  );

  const moveCharacterToFolder = useCallback(
    async (charId, targetFolderId = null, targetOwnerId = null) => {
      if (!user || !campaignId || !charId) return false;
      const char = rawCharacters.find((c) => c.id === charId);
      if (!char) return false;
      try {
        await moveItemToFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          domain: FOLDER_DOMAINS.CHARACTER,
          itemId: charId,
          item: char,
          targetFolderId: targetFolderId || null,
          targetOwnerId: targetOwnerId || null,
          folders: rawFolders
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawCharacters, rawFolders]
  );

  const moveFolder = useCallback(
    async (folderId, targetParentId = null, targetOwnerId = null) => {
      if (!user || !campaignId || !folderId) return false;
      try {
        await moveFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          folderId,
          targetParentId: targetParentId || null,
          targetOwnerId: targetOwnerId || null,
          folders: rawFolders,
          characters: rawCharacters
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawFolders, rawCharacters]
  );

  return {
    characters,
    allCharacters: rawCharacters,
    folders,
    canEditCharacter,
    canEditFolder,
    canDeleteCharacter,
    canDeleteFolder,
    ...actions,
    createFolder,
    renameFolder,
    updateFolder,
    transferFolderOwnership,
    deleteFolder,
    moveCharacterToFolder,
    moveFolder
  };
}
