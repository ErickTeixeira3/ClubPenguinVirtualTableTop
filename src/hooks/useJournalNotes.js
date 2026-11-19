import { useCallback, useEffect, useMemo, useState } from "react";
import { FOLDER_DOMAINS } from "../domain/constants.js";
import { canDeleteResource, canEditResource } from "../domain/permissions.js";
import {
  createFolder as createFolderService,
  deleteFolder as deleteFolderService,
  moveFolder as moveFolderService,
  moveItemToFolder as moveItemToFolderService,
  renameFolder as renameFolderService
} from "../services/folderService.js";
import {
  canUserEditJournalNote,
  cloneJournalNoteToTarget,
  createJournalNote,
  filterAccessibleJournalItems,
  revokeJournalNoteAccess,
  saveNoteDraft as saveNoteDraftService,
  shareJournalNoteWithTarget,
  softDeleteJournalNote,
  subscribeNotes,
  updateJournalNodePosition,
  updateJournalNote
} from "../services/journalService.js";
import { notifyError } from "../services/notificationService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useFolders } from "./useFolders";

export function useJournalNotes() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);
  const { folders: dedicatedFolders, setFolders: setDedicatedFolders } = useFolders(
    FOLDER_DOMAINS.JOURNAL
  );

  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);
  const gmId = campaign?.gmId || null;

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return undefined;

    return subscribeNotes({
      campaignId,
      gmId,
      isRealGM,
      uid: listenerUid,
      onNext: (list) => {
        setRawItems(list);
      },
      onError: notifyError
    });
  }, [listenerUid, campaignId, campaignReady, gmId, isRealGM]);

  const rawNotes = useMemo(
    () => rawItems.filter((item) => !item.isDeleted),
    [rawItems]
  );

  const rawFolders = useMemo(
    () => dedicatedFolders.filter((f) => !f.isDeleted),
    [dedicatedFolders]
  );

  const accessibleNotes = useMemo(
    () => filterAccessibleJournalItems(rawNotes, { user, isGM }),
    [rawNotes, isGM, user]
  );

  const accessibleFolders = useMemo(
    () => filterAccessibleJournalItems(rawFolders, { user, isGM }),
    [rawFolders, isGM, user]
  );

  const canEditNote = useCallback(
    (note) => canUserEditJournalNote(note, { user, isGM }),
    [user, isGM]
  );

  const canDeleteNote = useCallback(
    (note) => canDeleteResource(note, { uid: user?.uid, isGM, entityType: "note" }),
    [user?.uid, isGM]
  );

  const canEditFolder = useCallback(
    (folder) => canEditResource(folder, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const canDeleteFolder = useCallback(
    (folder) => canDeleteResource(folder, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const createNote = async (params) => {
    try {
      const res = await createJournalNote({
        campaignId,
        campaign,
        user,
        isGM,
        accessibleNotes,
        ...params
      });
      if (!res) return null;
      if (res.ok === false) {
        notifyError(res.error || "Não foi possível criar o card.");
        return res;
      }
      setRawItems((prev) =>
        prev.some((n) => n.id === res.noteId) ? prev : [res.newNote, ...prev]
      );
      return res.noteId;
    } catch (err) {
      notifyError(err);
      return { ok: false, error: err?.message || "Erro ao criar card." };
    }
  };

  const updateNote = async (noteId, updates = {}, newFile = null) => {
    try {
      return await updateJournalNote({
        campaignId,
        campaign,
        user,
        isGM,
        existingNote: rawNotes.find((n) => n.id === noteId),
        accessibleNotes,
        noteId,
        updates,
        newFile
      });
    } catch (err) {
      notifyError(err);
      return { ok: false, error: err?.message || "Erro ao atualizar card." };
    }
  };

  const saveNoteDraft = async (draft = {}, file = null) => {
    try {
      const existingNote = draft?.id
        ? rawNotes.find((n) => n.id === draft.id) || null
        : null;
      const res = await saveNoteDraftService({
        campaignId,
        campaign,
        user,
        isGM,
        existingNote,
        accessibleNotes,
        draft,
        file
      });
      if (res?.ok && res?.newNote) {
        setRawItems((prev) =>
          prev.some((n) => n.id === res.noteId) ? prev : [res.newNote, ...prev]
        );
      }
      return res;
    } catch (err) {
      notifyError(err);
      return { ok: false, error: err?.message || "Erro ao salvar card." };
    }
  };

  const updateNodePosition = async (noteId, x, y) => {
    try {
      await updateJournalNodePosition({
        campaignId,
        user,
        isGM,
        existingNote: rawNotes.find((n) => n.id === noteId),
        noteId,
        x,
        y
      });
    } catch (err) {
      notifyError(err);
    }
  };

  const cloneNoteToTarget = async (sourceNote, options = {}) => {
    try {
      const res = await cloneJournalNoteToTarget({
        campaignId,
        campaign,
        user,
        isGM,
        sourceNote,
        ...options
      });
      if (!res) return null;
      setRawItems((prev) =>
        prev.some((n) => n.id === res.noteId) ? prev : [res.clonedNote, ...prev]
      );
      return res.noteId;
    } catch (err) {
      notifyError(err);
      return null;
    }
  };

  const shareNoteWithTarget = async (noteId, target) => {
    try {
      await shareJournalNoteWithTarget({
        campaignId,
        campaign,
        user,
        isGM,
        isRealGM,
        note: rawNotes.find((n) => n.id === noteId),
        noteId,
        target
      });
    } catch (err) {
      notifyError(err);
    }
  };

  const revokeNoteAccess = async (noteId, target) => {
    try {
      await revokeJournalNoteAccess({
        campaignId,
        campaign,
        user,
        isGM,
        isRealGM,
        note: rawNotes.find((n) => n.id === noteId),
        noteId,
        target
      });
    } catch (err) {
      notifyError(err);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await softDeleteJournalNote({
        campaignId,
        user,
        isGM,
        note: rawNotes.find((n) => n.id === noteId),
        noteId
      });
    } catch (err) {
      notifyError(err);
    }
  };

  const createFolder = useCallback(
    async ({ name, noteType, scope = "party", ownerId = null, parentId = null }) => {
      if (!user || !campaignId || !name?.trim() || !noteType) return null;
      try {
        const created = await createFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          domain: FOLDER_DOMAINS.JOURNAL,
          name,
          parentId: parentId || null,
          ownerId,
          scope,
          noteType,
          existingFolders: rawFolders
        });
        setDedicatedFolders((prev) =>
          prev.some((item) => item.id === created.id) ? prev : [created, ...prev]
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

  const moveFolder = useCallback(
    async (folderId, targetParentId = null) => {
      if (!user || !campaignId || !folderId) return false;
      try {
        await moveFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          folderId,
          targetParentId: targetParentId || null,
          folders: rawFolders
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawFolders]
  );

  const moveNoteToFolder = useCallback(
    async (noteId, targetFolderId = null, targetNoteType = null) => {
      if (!user || !campaignId || !noteId) return false;
      const note = rawNotes.find((n) => n.id === noteId);
      if (!note) return false;
      try {
        await moveItemToFolderService({
          campaignId,
          user,
          isGM,
          gmId,
          domain: FOLDER_DOMAINS.JOURNAL,
          itemId: noteId,
          item: note,
          targetFolderId: targetFolderId || null,
          targetNoteType: targetNoteType || note.noteType,
          folders: rawFolders
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, gmId, rawNotes, rawFolders]
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
          items: rawNotes
        });
        return true;
      } catch (err) {
        notifyError(err);
        return false;
      }
    },
    [user, campaignId, isGM, rawFolders, rawNotes]
  );

  return {
    accessibleNotes,
    accessibleFolders,
    canEditNote,
    canDeleteNote,
    canEditFolder,
    canDeleteFolder,
    createNote,
    updateNote,
    saveNoteDraft,
    updateNodePosition,
    cloneNoteToTarget,
    shareNoteWithTarget,
    revokeNoteAccess,
    deleteNote,
    createFolder,
    renameFolder,
    moveFolder,
    moveNoteToFolder,
    deleteFolder
  };
}
