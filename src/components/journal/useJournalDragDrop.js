import { useRef, useState } from "react";
import { FOLDER_DOMAINS } from "../../domain/constants.js";
import { AppError, ERROR_CODES } from "../../domain/errors.js";
import { canEditResource } from "../../domain/permissions.js";
import {
  validateFolderMove,
  validateItemFolderPlacement
} from "../../engines/folders/index.js";

const HOVER_EXPAND_DELAY_MS = 420;

export function useJournalDragDrop({
  accessibleNotes = [],
  foldersById,
  currentUserId,
  isGM,
  canMoveFolderNode,
  collapsedFolders,
  setCollapsedFolders,
  onMoveNoteToFolder,
  onUpdateNote,
  onMoveFolder,
  notifyError
}) {
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [draggedFolderId, setDraggedFolderId] = useState(null);
  const [dragOverTargetKey, setDragOverTargetKey] = useState(null);
  const dragHoverIntentRef = useRef(null);

  const handleDragEnterFolder = (targetKey, folderId) => {
    setDragOverTargetKey(targetKey);
    if (folderId) {
      dragHoverIntentRef.current = {
        folderKey: targetKey,
        folderId,
        enteredAt: Date.now()
      };
    }
  };

  const handleDragOverTarget = (targetKey, folderId = null) => {
    if (dragOverTargetKey !== targetKey) {
      setDragOverTargetKey(targetKey);
    }
    if (!folderId || !collapsedFolders[targetKey]) {
      return;
    }
    const intent = dragHoverIntentRef.current;
    if (
      !intent ||
      intent.folderKey !== targetKey ||
      intent.folderId !== folderId
    ) {
      dragHoverIntentRef.current = {
        folderKey: targetKey,
        folderId,
        enteredAt: Date.now()
      };
      return;
    }
    if (Date.now() - intent.enteredAt >= HOVER_EXPAND_DELAY_MS) {
      dragHoverIntentRef.current = null;
      setCollapsedFolders((prev) =>
        prev[targetKey] === false ? prev : { ...prev, [targetKey]: false }
      );
    }
  };

  const handleDragLeaveTarget = (targetKey) => {
    if (dragHoverIntentRef.current?.folderKey === targetKey) {
      dragHoverIntentRef.current = null;
    }
    if (dragOverTargetKey === targetKey) {
      setDragOverTargetKey(null);
    }
  };

  const handleMoveNote = async (noteId, targetFolder, targetTypeKey) => {
    if (!noteId) return;
    const note = accessibleNotes.find((n) => n.id === noteId);
    if (!note) return;

    if (!canEditResource(note, { uid: currentUserId, isGM })) {
      notifyError(
        new AppError(
          ERROR_CODES.PERMISSION_DENIED,
          "Você não tem permissão para mover este card."
        )
      );
      return;
    }

    const nextFolderId = targetFolder?.id || null;
    const nextNoteType =
      targetTypeKey || targetFolder?.noteType || note.noteType;

    if (
      (note.folderId || null) === nextFolderId &&
      note.noteType === nextNoteType
    ) {
      return;
    }

    if (targetFolder) {
      const check = validateItemFolderPlacement({
        item: { ...note, noteType: nextNoteType },
        targetFolder: { ...targetFolder, domain: FOLDER_DOMAINS.JOURNAL },
        domain: FOLDER_DOMAINS.JOURNAL
      });
      if (!check.ok) {
        notifyError(check.errors[0]);
        return;
      }
    }

    if (onMoveNoteToFolder) {
      await onMoveNoteToFolder(note.id, nextFolderId, nextNoteType);
      return;
    }

    const updates = { folderId: nextFolderId };
    if (nextNoteType && nextNoteType !== note.noteType) {
      updates.noteType = nextNoteType;
    }
    await onUpdateNote?.(note.id, updates);
  };

  const handleMoveDraggedFolder = async (
    folderId,
    targetFolder,
    targetTypeKey
  ) => {
    const folder = foldersById.get(folderId);
    if (!folder) return;

    if (!canMoveFolderNode(folder)) {
      notifyError(
        new AppError(
          ERROR_CODES.PERMISSION_DENIED,
          "Você não tem permissão para mover esta pasta."
        )
      );
      return;
    }

    if (!targetFolder && targetTypeKey && targetTypeKey !== folder.noteType) {
      notifyError(
        new AppError(
          ERROR_CODES.INCOMPATIBLE_FOLDER,
          "Pastas do Diário não podem mudar de categoria."
        )
      );
      return;
    }

    const cleanTargetParentId = targetFolder?.id || null;
    const check = validateFolderMove({
      folder,
      targetParentId: cleanTargetParentId,
      foldersById
    });
    if (!check.ok) {
      notifyError(check.errors[0]);
      return;
    }

    if ((folder.parentId || null) === cleanTargetParentId) {
      return;
    }

    await onMoveFolder?.(folder.id, cleanTargetParentId);
  };

  const handleDropOnFolder = async (e, targetFolder, targetTypeKey) => {
    e.preventDefault();
    e.stopPropagation();
    dragHoverIntentRef.current = null;
    setDragOverTargetKey(null);

    const droppedFolderId =
      e.dataTransfer.getData("text/journal-folder-id") || draggedFolderId;
    if (droppedFolderId) {
      setDraggedFolderId(null);
      await handleMoveDraggedFolder(
        droppedFolderId,
        targetFolder,
        targetTypeKey
      );
      return;
    }

    let noteId = e.dataTransfer.getData("text/journal-note-id") || draggedNoteId;
    if (!noteId) {
      try {
        const raw = e.dataTransfer.getData("application/json");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.noteId) {
            noteId = parsed.noteId;
          }
        }
      } catch {
        // Ignora payload malformado de dataTransfer externo
      }
    }

    setDraggedNoteId(null);
    if (noteId) {
      await handleMoveNote(noteId, targetFolder, targetTypeKey);
    }
  };

  const handleDragEndAll = () => {
    dragHoverIntentRef.current = null;
    setDraggedNoteId(null);
    setDraggedFolderId(null);
    setDragOverTargetKey(null);
  };

  return {
    draggedNoteId,
    draggedFolderId,
    dragOverTargetKey,
    setDraggedNoteId,
    setDraggedFolderId,
    handleDragEnterFolder,
    handleDragOverTarget,
    handleDragLeaveTarget,
    handleDropOnFolder,
    handleDragEndAll
  };
}
