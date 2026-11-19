import { useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import InlineFolderForm from "./InlineFolderForm";
import { getNoteTypeIcon, getNoteTypeMeta } from "./noteTypesUi";

export function SidebarCardRow({
  note,
  campaignId,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd
}) {
  const mediaId = note?.image?.mediaId ?? note?.imageMediaId ?? null;
  const externalUrl = note?.image?.url ?? null;
  const { url: imageUrl } = useMediaUrl(mediaId, externalUrl, campaignId);
  const [imageError, setImageError] = useState(false);
  const meta = getNoteTypeMeta(note.noteType);

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/journal-note-id", note.id);
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            noteId: note.id,
            noteType: note.noteType,
            folderId: note.folderId || null
          })
        );
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(note);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onClick(note)}
      title={note.title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "5px 8px",
        borderRadius: "8px",
        cursor: isDragging ? "grabbing" : "grab",
        opacity: isDragging ? 0.4 : 1,
        background: isSelected ? "rgba(56, 152, 255, 0.25)" : "transparent",
        border: isSelected ? "1.5px solid #3898ff" : "1.5px solid transparent",
        transition:
          "background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
        userSelect: "none"
      }}
      onMouseEnter={(e) => {
        if (!isSelected && !isDragging) {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !isDragging) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt=""
          onError={() => setImageError(true)}
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "5px",
            objectFit: "cover",
            border: `1.5px solid ${meta.color}`,
            flexShrink: 0,
            pointerEvents: "none"
          }}
        />
      ) : (
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "5px",
            background: "rgba(0, 15, 32, 0.75)",
            border: `1.5px solid ${meta.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            flexShrink: 0,
            pointerEvents: "none"
          }}
        >
          {getNoteTypeIcon(note.noteType)}
        </div>
      )}

      <span
        style={{
          fontSize: "12.5px",
          fontWeight: 700,
          color: "#e2f1ff",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
          minWidth: 0,
          pointerEvents: "none"
        }}
      >
        {note.title}
      </span>
    </div>
  );
}

export function FolderTreeNode({
  folderNode,
  typeKey,
  campaignId,
  collapsedFolders,
  onToggleFolder,
  editingNoteId,
  onSelectNote,
  onStartNewSubfolder,
  newFolderTarget,
  newFolderNameInput,
  onChangeNewFolderName,
  onSubmitNewFolder,
  onCancelNewFolder,
  renamingFolderId,
  renameFolderInput,
  onStartRenameFolder,
  onChangeRenameFolder,
  onSubmitRenameFolder,
  onCancelRenameFolder,
  onStartNewCardInFolder,
  onDeleteFolder,
  canEditFolderNode,
  canDeleteFolderNode,
  canMoveFolderNode,
  draggedNoteId,
  dragOverTargetKey,
  onDragEnterFolder,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropOnFolder,
  onDragStartNote,
  onDragEndNote,
  onDragStartFolder,
  onDragEndFolder
}) {
  const folder = folderNode.folder;
  const folderKey = `${typeKey}::${folder.id}`;
  const isCollapsed = Boolean(collapsedFolders[folderKey]);
  const isDragOver = dragOverTargetKey === folderKey;
  const isCreatingSubfolderHere =
    newFolderTarget?.typeKey === typeKey &&
    newFolderTarget?.parentId === folder.id;
  const isRenamingHere = renamingFolderId === folder.id;
  const canEdit = canEditFolderNode?.(folder) !== false;
  const canDelete = canDeleteFolderNode?.(folder) !== false;
  const canMove = canMoveFolderNode?.(folder) !== false;

  const subFolders = folderNode.children || [];
  const folderNotes = folderNode.items || [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1px"
      }}
    >
      <div
        draggable={canMove}
        onDragStart={(e) => {
          if (!canMove) return;
          e.stopPropagation();
          e.dataTransfer.setData("text/journal-folder-id", folder.id);
          e.dataTransfer.effectAllowed = "move";
          onDragStartFolder?.(folder);
        }}
        onDragEnd={() => onDragEndFolder?.()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderRadius: "6px",
          cursor: "pointer",
          userSelect: "none",
          color: isDragOver ? "#ffe066" : "#cbd5e1",
          fontSize: "12px",
          fontWeight: 700,
          background: isDragOver ? "rgba(56, 152, 255, 0.4)" : "transparent",
          border: isDragOver
            ? "1.5px dashed #ffe066"
            : "1.5px solid transparent",
          boxShadow: isDragOver ? "0 0 10px rgba(56, 152, 255, 0.6)" : "none",
          transition: "background 0.12s ease, border-color 0.12s ease"
        }}
        onClick={() => onToggleFolder(folderKey)}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragEnterFolder(folderKey, folder.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          onDragOverTarget(folderKey, folder.id);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (dragOverTargetKey === folderKey) {
              onDragLeaveTarget(folderKey);
            }
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropOnFolder(e, folder, typeKey);
        }}
        onMouseEnter={(e) => {
          if (!isDragOver) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragOver) {
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
            flex: 1
          }}
        >
          <span style={{ fontSize: "12px", opacity: 0.85 }}>
            {isCollapsed ? "📁" : "📂"}
          </span>
          {isRenamingHere ? (
            <InlineFolderForm
              value={renameFolderInput}
              onChange={onChangeRenameFolder}
              onSubmit={onSubmitRenameFolder}
              onCancel={onCancelRenameFolder}
              placeholder="Novo nome..."
              paddingLeft="0px"
            />
          ) : (
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {folder.name}
            </span>
          )}
          <span style={{ fontSize: "10px", opacity: isDragOver ? 1 : 0.5 }}>
            {isDragOver
              ? "↳ mover para cá"
              : `(${folderNode.totalItemCount ?? folderNotes.length})`}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            flexShrink: 0
          }}
        >
          <button
            type="button"
            title={`Nova subpasta dentro de "${folder.name}"`}
            onClick={(e) => {
              e.stopPropagation();
              onStartNewSubfolder(typeKey, folder.id, folderKey);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#a9d4ff",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: 800,
              padding: "0 3px"
            }}
          >
            📁+
          </button>

          <button
            type="button"
            title={`Novo card em "${folder.name}"`}
            onClick={(e) => {
              e.stopPropagation();
              onStartNewCardInFolder(typeKey, folder.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffe066",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 900,
              padding: "0 3px"
            }}
          >
            +
          </button>

          {canEdit && (
            <button
              type="button"
              title={`Renomear pasta "${folder.name}"`}
              onClick={(e) => {
                e.stopPropagation();
                onStartRenameFolder(folder);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#a9d4ff",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 800,
                padding: "0 2px"
              }}
            >
              ✏️
            </button>
          )}

          {onDeleteFolder && canDelete && (
            <button
              type="button"
              title={`Excluir pasta "${folder.name}"`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(folder, typeKey);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#ff8a80",
                cursor: "pointer",
                fontSize: "10px",
                fontWeight: 900,
                padding: "0 2px"
              }}
            >
              ✕
            </button>
          )}

          <span style={{ fontSize: "10px", opacity: 0.6 }}>
            {isCollapsed ? "▸" : "▾"}
          </span>
        </div>
      </div>

      {isCreatingSubfolderHere && (
        <InlineFolderForm
          value={newFolderNameInput}
          onChange={onChangeNewFolderName}
          onSubmit={onSubmitNewFolder}
          onCancel={onCancelNewFolder}
          placeholder={`Subpasta em ${folder.name}...`}
          paddingLeft="16px"
        />
      )}

      {!isCollapsed && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDropOnFolder(e, folder, typeKey);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1px",
            paddingLeft: "12px",
            borderLeft: "1px solid rgba(255, 255, 255, 0.12)",
            marginLeft: "10px"
          }}
        >
          {subFolders.map((sub) => (
            <FolderTreeNode
              key={`${typeKey}::${sub.id}`}
              folderNode={sub}
              typeKey={typeKey}
              campaignId={campaignId}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              editingNoteId={editingNoteId}
              onSelectNote={onSelectNote}
              onStartNewSubfolder={onStartNewSubfolder}
              newFolderTarget={newFolderTarget}
              newFolderNameInput={newFolderNameInput}
              onChangeNewFolderName={onChangeNewFolderName}
              onSubmitNewFolder={onSubmitNewFolder}
              onCancelNewFolder={onCancelNewFolder}
              renamingFolderId={renamingFolderId}
              renameFolderInput={renameFolderInput}
              onStartRenameFolder={onStartRenameFolder}
              onChangeRenameFolder={onChangeRenameFolder}
              onSubmitRenameFolder={onSubmitRenameFolder}
              onCancelRenameFolder={onCancelRenameFolder}
              onStartNewCardInFolder={onStartNewCardInFolder}
              onDeleteFolder={onDeleteFolder}
              canEditFolderNode={canEditFolderNode}
              canDeleteFolderNode={canDeleteFolderNode}
              canMoveFolderNode={canMoveFolderNode}
              draggedNoteId={draggedNoteId}
              dragOverTargetKey={dragOverTargetKey}
              onDragEnterFolder={onDragEnterFolder}
              onDragOverTarget={onDragOverTarget}
              onDragLeaveTarget={onDragLeaveTarget}
              onDropOnFolder={onDropOnFolder}
              onDragStartNote={onDragStartNote}
              onDragEndNote={onDragEndNote}
              onDragStartFolder={onDragStartFolder}
              onDragEndFolder={onDragEndFolder}
            />
          ))}

          {folderNotes.map((note) => (
            <SidebarCardRow
              key={note.id}
              note={note}
              campaignId={campaignId}
              isSelected={editingNoteId === note.id}
              isDragging={draggedNoteId === note.id}
              onClick={onSelectNote}
              onDragStart={onDragStartNote}
              onDragEnd={onDragEndNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
