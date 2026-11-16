import { useEffect, useMemo, useState } from "react";
import {
  collection
} from "firebase/firestore";
import { subscribeVisibleCollection } from "../services/visibilityService";
import { db } from "../services/firebase";
import {
  canUserEditJournalNote,
  cloneJournalNoteToTarget,
  createJournalFolder,
  createJournalNote,
  filterAccessibleJournalItems,
  revokeJournalNoteAccess,
  shareJournalNoteWithTarget,
  softDeleteJournalFolder,
  softDeleteJournalNote,
  updateJournalNodePosition,
  updateJournalNote
} from "../services/journalService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useFolders } from "./useFolders";

export function useJournalNotes() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);
  // Fase 5: pastas dedicadas via useFolders (listener unificado da subcoleção folders)
  const { folders: dedicatedFolders, setFolders: setDedicatedFolders } = useFolders("journal");

  // Fase 3.1 (V-13): listeners dependem só de uid/campaignId/prontidão da campanha/papel,
  // não do objeto `campaign` (recriado a cada snapshot da campanha ou resolução de avatar).
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;

    const notesCol = collection(db, "campaigns", campaignId, "notes");
    // Fase 6.2 (A5/A9: o dono sempre recebe os próprios cards).
    const unsubscribeNotes = subscribeVisibleCollection({
      colRef: notesCol,
      isRealGM,
      uid: listenerUid,
      includeOwned: true,
      onNext: (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((item) => !item.isDeleted && !item.migratedToFoldersCollection);
        list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        setRawItems(list);
      },
      onError: (err) => {
        console.error("Erro ao carregar diários:", err);
      }
    });

    return () => unsubscribeNotes();
  }, [listenerUid, campaignId, campaignReady, isRealGM]);

  const rawNotes = useMemo(
    () => rawItems.filter((item) => !item.isFolder && !item.isDeleted),
    [rawItems]
  );

  const rawFolders = useMemo(() => {
    const map = new Map();
    rawItems
      .filter((item) => Boolean(item.isFolder) && !item.isDeleted && !item.migratedToFoldersCollection)
      .forEach((f) => map.set(f.id, f));
    dedicatedFolders
      .filter((f) => !f.isDeleted)
      .forEach((f) => map.set(f.id, f));
    const folders = Array.from(map.values());
    folders.sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""));
    return folders;
  }, [rawItems, dedicatedFolders]);

  const accessibleNotes = useMemo(
    () => filterAccessibleJournalItems(rawNotes, { user, isGM }),
    [rawNotes, isGM, user]
  );

  const accessibleFolders = useMemo(
    () => filterAccessibleJournalItems(rawFolders, { user, isGM }),
    [rawFolders, isGM, user]
  );

  const canEditNote = (note) => canUserEditJournalNote(note, { user, isGM });

  const createNote = async (params) => {
    const res = await createJournalNote({
      campaignId,
      campaign,
      user,
      isGM,
      accessibleNotes,
      ...params
    });
    if (!res) return null;
    setRawItems((prev) =>
      prev.some((n) => n.id === res.noteId) ? prev : [res.newNote, ...prev]
    );
    return res.noteId;
  };

  const updateNote = async (noteId, updates = {}, newFile = null) =>
    updateJournalNote({
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

  const updateNodePosition = async (noteId, x, y) =>
    updateJournalNodePosition({
      campaignId,
      user,
      isGM,
      existingNote: rawNotes.find((n) => n.id === noteId),
      noteId,
      x,
      y
    });

  const cloneNoteToTarget = async (sourceNote, options = {}) => {
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
  };

  const shareNoteWithTarget = async (noteId, target) =>
    shareJournalNoteWithTarget({
      campaignId,
      user,
      isGM,
      note: rawNotes.find((n) => n.id === noteId),
      noteId,
      target
    });

  const revokeNoteAccess = async (noteId, target) =>
    revokeJournalNoteAccess({
      campaignId,
      campaign,
      user,
      isGM,
      isRealGM,
      note: rawNotes.find((n) => n.id === noteId),
      noteId,
      target
    });

  const deleteNote = async (noteId) =>
    softDeleteJournalNote({
      campaignId,
      user,
      isGM,
      note: rawNotes.find((n) => n.id === noteId),
      noteId
    });

  const createFolder = async (params) => {
    const res = await createJournalFolder({
      campaignId,
      campaign,
      user,
      isGM,
      ...params
    });
    if (!res) return null;
    setDedicatedFolders((prev) =>
      prev.some((item) => item.id === res.folderId)
        ? prev
        : [res.newFolder, ...prev]
    );
    return res.folderId;
  };

  const deleteFolder = async (
    folderId,
    folderPath,
    noteType,
    options = { deleteContents: false }
  ) =>
    softDeleteJournalFolder({
      campaignId,
      user,
      isGM,
      folderId,
      folderPath,
      noteType,
      rawFolders,
      dedicatedFolders,
      rawLegacyItems: rawItems,
      rawNotes,
      options
    });

  return {
    accessibleNotes,
    accessibleFolders,
    canEditNote,
    createNote,
    updateNote,
    updateNodePosition,
    cloneNoteToTarget,
    shareNoteWithTarget,
    revokeNoteAccess,
    deleteNote,
    createFolder,
    deleteFolder
  };
}
