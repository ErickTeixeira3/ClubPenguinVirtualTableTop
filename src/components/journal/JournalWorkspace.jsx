import { useMemo, useState } from "react";
import { Z_LAYERS } from "../../constants/zLayers";
import { FOLDER_DOMAINS, NOTE_SCOPES } from "../../domain/constants.js";
import { canDeleteResource, canEditResource } from "../../domain/permissions.js";
import { validateFolderName } from "../../engines/folders/index.js";
import { extractNoteText } from "../../engines/journal/index.js";
import { useNotifications } from "../../hooks/useNotifications";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";
import JournalGraphWebView from "./JournalGraphWebView";
import JournalSidebar from "./JournalSidebar";
import NoteEditorModal from "./NoteEditorModal";
import {
  matchesJournalScopeFilter,
  resolveActiveJournalTarget
} from "./journalHelpers";
import { useJournalDragDrop } from "./useJournalDragDrop";

export default function JournalWorkspace({
  campaignId,
  currentUserId,
  isGM,
  playersMap = {},
  characters = [],
  accessibleNotes = [],
  accessibleFolders = [],
  onCreateNote,
  onUpdateNote,
  onSaveNoteDraft = null,
  onUpdateNodePosition,
  onCloneNoteToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onDeleteNote,
  onCreateFolder,
  onRenameFolder = null,
  onMoveFolder = null,
  onMoveNoteToFolder = null,
  onDeleteFolder,
  canEditNote = null,
  canDeleteNote = null,
  canEditFolder = null,
  canDeleteFolder = null,
  onOpenCharacterSheet
}) {
  const { notifyError } = useNotifications();
  const [activeScopeTab, setActiveScopeTab] = useState(
    isGM ? NOTE_SCOPES.GM : NOTE_SCOPES.PLAYER
  );
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(currentUserId);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const [defaultTypeForNewNote, setDefaultTypeForNewNote] = useState(null);
  const [defaultFolderIdForNewNote, setDefaultFolderIdForNewNote] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedFolders, setCollapsedFolders] = useState({});
  const [newFolderTarget, setNewFolderTarget] = useState(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameFolderInput, setRenameFolderInput] = useState("");
  const [folderToDelete, setFolderToDelete] = useState(null);

  const foldersById = useMemo(
    () =>
      new Map(
        (accessibleFolders || []).map((f) => [
          f.id,
          { ...f, domain: f.domain || FOLDER_DOMAINS.JOURNAL }
        ])
      ),
    [accessibleFolders]
  );

  const canEditFolderNode = (folder) => {
    if (!folder?.id) return false;
    if (typeof canEditFolder === "function") return Boolean(canEditFolder(folder));
    return canEditResource(folder, { uid: currentUserId, isGM });
  };

  const canDeleteFolderNode = (folder) => {
    if (!folder?.id) return Boolean(isGM);
    if (typeof canDeleteFolder === "function") return Boolean(canDeleteFolder(folder));
    return canDeleteResource(folder, { uid: currentUserId, isGM });
  };

  const canMoveFolderNode = (folder) =>
    Boolean(isGM || (currentUserId && folder?.ownerId === currentUserId));

  const {
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
  } = useJournalDragDrop({
    accessibleNotes,
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
  });

  const handleRequestDeleteFolder = (folder, typeKey) => {
    if (!folder) return;
    setFolderToDelete({
      id: folder.id,
      typeKey,
      name: folder.name || "Pasta"
    });
  };

  const toggleCategory = (typeKey) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [typeKey]: !prev[typeKey]
    }));
  };

  const toggleFolder = (folderKey) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey]
    }));
  };

  const handleStartNewSubfolder = (
    typeKey,
    parentId = null,
    folderKeyToExpand = null
  ) => {
    setNewFolderTarget({ typeKey, parentId: parentId || null });
    setNewFolderNameInput("");
    setCollapsedCategories((prev) => ({
      ...prev,
      [typeKey]: false
    }));
    if (folderKeyToExpand) {
      setCollapsedFolders((prev) => ({
        ...prev,
        [folderKeyToExpand]: false
      }));
    }
  };

  const handleSubmitNewFolder = async () => {
    if (!newFolderTarget) return;
    const rawName = newFolderNameInput.trim();
    const validation = validateFolderName(rawName);
    if (!validation.ok) {
      notifyError(validation.errors[0]);
      return;
    }

    const { scope, ownerId } = resolveActiveJournalTarget({
      activeScopeTab,
      isGM,
      selectedPlayerUid,
      currentUserId
    });

    const parentFolder = newFolderTarget.parentId
      ? foldersById.get(newFolderTarget.parentId) || null
      : null;

    const targetScope = parentFolder?.scope || scope;
    const targetOwnerId = parentFolder?.ownerId || ownerId;

    if (onCreateFolder) {
      const createdId = await onCreateFolder({
        name: rawName,
        noteType: newFolderTarget.typeKey,
        scope: targetScope,
        ownerId: targetOwnerId,
        parentId: newFolderTarget.parentId || null
      });
      if (!createdId) {
        return;
      }
    }
    setNewFolderNameInput("");
    setNewFolderTarget(null);
  };

  const handleStartRenameFolder = (folder) => {
    setRenamingFolderId(folder.id);
    setRenameFolderInput(folder.name || "");
  };

  const handleSubmitRenameFolder = async () => {
    if (!renamingFolderId) return;
    const folder = foldersById.get(renamingFolderId);
    const trimmed = renameFolderInput.trim();
    if (folder && trimmed === (folder.name || "").trim()) {
      setRenamingFolderId(null);
      setRenameFolderInput("");
      return;
    }
    const validation = validateFolderName(trimmed);
    if (!validation.ok) {
      notifyError(validation.errors[0]);
      return;
    }
    const ok = await onRenameFolder?.(renamingFolderId, trimmed);
    if (ok !== false) {
      setRenamingFolderId(null);
      setRenameFolderInput("");
    }
  };

  const playersList = useMemo(() => {
    const entries = Object.entries(playersMap || {}).map(([uid, data]) => ({
      uid,
      displayName: data?.displayName || uid.slice(0, 6)
    }));
    if (
      currentUserId &&
      !entries.some((item) => item.uid === currentUserId)
    ) {
      entries.unshift({ uid: currentUserId, displayName: "Meu Usuário" });
    }
    return entries;
  }, [playersMap, currentUserId]);

  const scopeFilterContext = useMemo(
    () => ({ activeScopeTab, isGM, selectedPlayerUid, currentUserId }),
    [activeScopeTab, isGM, selectedPlayerUid, currentUserId]
  );

  const scopedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return accessibleNotes.filter((n) => {
      if (!matchesJournalScopeFilter(n, scopeFilterContext)) return false;

      if (!q) return true;
      const inTitle = (n.title || "").toLowerCase().includes(q);
      const inSections = extractNoteText(n).toLowerCase().includes(q);
      const inAliases = (n.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return inTitle || inSections || inAliases;
    });
  }, [accessibleNotes, scopeFilterContext, searchQuery]);

  const handleSaveNote = async (formData) => {
    const target = resolveActiveJournalTarget({
      activeScopeTab,
      isGM,
      selectedPlayerUid,
      currentUserId
    });

    if (onSaveNoteDraft) {
      return await onSaveNoteDraft(
        {
          ...formData,
          scope: formData.id ? formData.scope : target.scope,
          ownerId: formData.id ? formData.ownerId : target.ownerId
        },
        formData.file
      );
    }

    if (formData.id) {
      return await onUpdateNote(
        formData.id,
        {
          title: formData.title,
          noteType: formData.noteType,
          folderId: formData.folderId || null,
          linkedCharacterId: formData.linkedCharacterId ?? null,
          aliases: formData.aliases,
          ignoredAliases: formData.ignoredAliases,
          sections: formData.sections,
          relatedNoteIds: formData.relatedNoteIds,
          targetAliasAdditions: formData.targetAliasAdditions
        },
        formData.file
      );
    }

    return await onCreateNote({
      scope: target.scope,
      ownerId: target.ownerId,
      noteType: formData.noteType,
      folderId: formData.folderId || null,
      title: formData.title,
      aliases: formData.aliases,
      ignoredAliases: formData.ignoredAliases,
      sections: formData.sections,
      relatedNoteIds: formData.relatedNoteIds,
      linkedCharacterId: formData.linkedCharacterId ?? null,
      targetAliasAdditions: formData.targetAliasAdditions,
      file: formData.file
    });
  };

  const currentModalNote = useMemo(() => {
    if (!editingNote?.id) return editingNote;
    return accessibleNotes.find((n) => n.id === editingNote.id) || editingNote;
  }, [editingNote, accessibleNotes]);

  const modalDefaultTarget = resolveActiveJournalTarget({
    activeScopeTab,
    isGM,
    selectedPlayerUid,
    currentUserId
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        zIndex: Z_LAYERS.workspaceJournal
      }}
    >
      <JournalSidebar
        leftPanelCollapsed={leftPanelCollapsed}
        searchQuery={searchQuery}
        onChangeSearchQuery={setSearchQuery}
        onStartNewCard={() => {
          setDefaultTypeForNewNote(null);
          setDefaultFolderIdForNewNote("");
          setCreatingNote(true);
        }}
        onCollapsePanel={() => setLeftPanelCollapsed(true)}
        isGM={isGM}
        activeScopeTab={activeScopeTab}
        totalNotesCount={accessibleNotes.length}
        selectedPlayerUid={selectedPlayerUid}
        playersList={playersList}
        onChangeScopeTab={setActiveScopeTab}
        onChangeSelectedPlayerUid={setSelectedPlayerUid}
        scopedNotes={scopedNotes}
        accessibleFolders={accessibleFolders}
        scopeFilterContext={scopeFilterContext}
        campaignId={campaignId}
        collapsedCategories={collapsedCategories}
        onToggleCategory={toggleCategory}
        collapsedFolders={collapsedFolders}
        onToggleFolder={toggleFolder}
        editingNoteId={editingNote?.id}
        onSelectNote={(n) => setEditingNote(n)}
        newFolderTarget={newFolderTarget}
        newFolderNameInput={newFolderNameInput}
        onChangeNewFolderName={setNewFolderNameInput}
        onSubmitNewFolder={handleSubmitNewFolder}
        onCancelNewFolder={() => setNewFolderTarget(null)}
        onStartNewSubfolder={handleStartNewSubfolder}
        renamingFolderId={renamingFolderId}
        renameFolderInput={renameFolderInput}
        onStartRenameFolder={handleStartRenameFolder}
        onChangeRenameFolder={setRenameFolderInput}
        onSubmitRenameFolder={handleSubmitRenameFolder}
        onCancelRenameFolder={() => {
          setRenamingFolderId(null);
          setRenameFolderInput("");
        }}
        onStartNewCardInFolder={(tKey, folderId) => {
          setDefaultTypeForNewNote(tKey);
          setDefaultFolderIdForNewNote(folderId || "");
          setCreatingNote(true);
        }}
        onDeleteFolder={handleRequestDeleteFolder}
        canEditFolderNode={canEditFolderNode}
        canDeleteFolderNode={canDeleteFolderNode}
        canMoveFolderNode={canMoveFolderNode}
        draggedNoteId={draggedNoteId}
        draggedFolderId={draggedFolderId}
        dragOverTargetKey={dragOverTargetKey}
        onDragEnterFolder={handleDragEnterFolder}
        onDragOverTarget={handleDragOverTarget}
        onDragLeaveTarget={handleDragLeaveTarget}
        onDropOnFolder={handleDropOnFolder}
        onDragStartNote={(n) => setDraggedNoteId(n.id)}
        onDragStartFolder={(f) => setDraggedFolderId(f.id)}
        onDragEndAll={handleDragEndAll}
      />

      {leftPanelCollapsed && (
        <button
          type="button"
          className="cp-btn cp-btn-gold"
          onClick={() => setLeftPanelCollapsed(false)}
          style={{
            position: "absolute",
            left: "10px",
            top: "12px",
            zIndex: 20,
            padding: "6px 10px",
            fontSize: "12px"
          }}
          title="Abrir menu de cards"
        >
          ▶ Cards ({scopedNotes.length})
        </button>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          padding: "10px 14px 80px 14px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <JournalGraphWebView
          notes={scopedNotes}
          currentUserId={currentUserId}
          isGM={isGM}
          canEditNote={canEditNote}
          onSelectNoteToEdit={(n) => setEditingNote(n)}
          onOpenCharacterSheet={onOpenCharacterSheet}
          onUpdateNodePosition={onUpdateNodePosition}
        />
      </div>

      {(creatingNote || editingNote) && (
        <NoteEditorModal
          key={editingNote?.id || "new_note"}
          note={
            currentModalNote ||
            (defaultTypeForNewNote || defaultFolderIdForNewNote
              ? {
                  noteType: defaultTypeForNewNote || "lore",
                  folderId: defaultFolderIdForNewNote || null
                }
              : null)
          }
          defaultScope={modalDefaultTarget.scope}
          defaultOwnerId={modalDefaultTarget.ownerId}
          isGM={isGM}
          currentUserId={currentUserId}
          playersList={playersList}
          accessibleNotes={accessibleNotes}
          accessibleFolders={accessibleFolders}
          characters={characters}
          canDeleteNote={canDeleteNote}
          onSave={handleSaveNote}
          onDelete={onDeleteNote}
          onOpenNote={(targetNote) => {
            setCreatingNote(false);
            setEditingNote(targetNote);
          }}
          onCloneToTarget={onCloneNoteToTarget}
          onShareNoteWithTarget={onShareNoteWithTarget}
          onRevokeNoteAccess={onRevokeNoteAccess}
          onOpenCharacterSheet={onOpenCharacterSheet}
          onClose={() => {
            setCreatingNote(false);
            setEditingNote(null);
            setDefaultTypeForNewNote(null);
            setDefaultFolderIdForNewNote("");
          }}
        />
      )}

      {folderToDelete && (
        <ConfirmDeleteModal
          title={`Excluir Pasta "${folderToDelete.name}"`}
          question="Deseja excluir também os cards desta pasta?"
          moveLabel="Não, mover cards para a pasta pai"
          deleteLabel="Sim, excluir pasta e cards"
          zIndex={Z_LAYERS.modalNested}
          maxWidth="360px"
          overlayBackground="rgba(0, 27, 58, 0.55)"
          panelShadow="0 10px 30px rgba(0,0,0,0.4)"
          onCancel={() => setFolderToDelete(null)}
          onMove={async () => {
            const target = folderToDelete;
            setFolderToDelete(null);
            await onDeleteFolder?.(target.id, {
              mode: "moveToParent",
              deleteContents: false
            });
          }}
          onDelete={async () => {
            const target = folderToDelete;
            setFolderToDelete(null);
            await onDeleteFolder?.(target.id, {
              mode: "deleteAll",
              deleteContents: true
            });
          }}
        />
      )}
    </div>
  );
}
