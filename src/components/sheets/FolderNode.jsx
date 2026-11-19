import { useState } from "react";
import { canDeleteResource, canEditResource } from "../../domain/permissions.js";
import { validateFolderName } from "../../engines/folders/index.js";
import CharacterRow from "./CharacterRow";

export default function FolderNode({
  node,
  campaignId,
  isGM,
  canEditCharacter = null,
  canDeleteCharacter = null,
  canEditFolder = null,
  canDeleteFolder = null,
  currentUserId = null,
  onlineUsers = {},
  collapsedMap = {},
  onToggleCollapse,
  onOpenSheet,
  onOpenSpawnModal,
  onDeleteCharacter,
  onOpenMoveModal,
  onStartCreateInFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropCharacterOnFolder,
  onDropFolderOnFolder,
  onInvalidFolderName = null
}) {
  const folder = node.folder;
  const subfolders = node.children || [];
  const folderChars = node.items || [];

  const [isOver, setIsOver] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(folder.name || "");

  const isCollapsed = Boolean(collapsedMap[folder.id]);

  const canEdit =
    typeof canEditFolder === "function"
      ? Boolean(canEditFolder(folder))
      : canEditResource(folder, { uid: currentUserId, isGM });

  const canDelete =
    typeof canDeleteFolder === "function"
      ? Boolean(canDeleteFolder(folder))
      : canDeleteResource(folder, { uid: currentUserId, isGM });

  const canManageFolder = Boolean(
    isGM || (currentUserId && folder.ownerId === currentUserId)
  );

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const charId = e.dataTransfer.getData("text/character-id");
    if (charId) {
      onDropCharacterOnFolder?.(charId, folder);
      return;
    }

    const draggedFolderId = e.dataTransfer.getData("text/folder-id");
    if (draggedFolderId) {
      onDropFolderOnFolder?.(draggedFolderId, folder);
    }
  };

  const handleSaveRename = async (e) => {
    e.preventDefault();
    const trimmed = tempName.trim();
    if (!trimmed || trimmed === (folder.name || "").trim()) {
      setTempName(folder.name || "");
      setEditingName(false);
      return;
    }
    const nameCheck = validateFolderName(trimmed);
    if (!nameCheck.ok) {
      onInvalidFolderName?.(nameCheck.errors[0]);
      setTempName(folder.name || "");
      setEditingName(false);
      return;
    }
    const ok = await onRenameFolder?.(folder.id, trimmed);
    if (ok !== false) {
      setEditingName(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        draggable={canManageFolder}
        onDragStart={(e) => {
          if (!canManageFolder) return;
          e.dataTransfer.setData("text/folder-id", folder.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 6px",
          borderBottom: "1px solid #edf2f7",
          background: isOver ? "#e0f2fe" : "#ffffff",
          cursor: "pointer",
          fontWeight: 700,
          userSelect: "none"
        }}
      >
        <div
          onClick={() => onToggleCollapse(folder.id)}
          style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}
        >
          <span
            style={{
              width: "16px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 900,
              color: "#334155"
            }}
          >
            {isCollapsed ? "+" : "-"}
          </span>

          {editingName ? (
            <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                className="cp-input"
                value={tempName}
                autoFocus
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSaveRename}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setTempName(folder.name || "");
                    setEditingName(false);
                  }
                }}
                style={{ fontSize: "12px", padding: "2px 5px", width: "120px" }}
              />
            </form>
          ) : (
            <span
              style={{
                fontSize: "13px",
                color: folder.parentId ? "#0284c7" : "#1e293b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {folder.name}
            </span>
          )}

          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
            ({folderChars.length + subfolders.length})
          </span>
        </div>

        {(isGM || canEdit || canDelete) && (
          <div
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {canManageFolder && (
              <>
                <button
                  type="button"
                  className="cp-btn"
                  style={{ padding: "1px 5px", fontSize: "10px" }}
                  onClick={() => onStartCreateInFolder(folder, "character")}
                  title="Novo Personagem nesta Pasta"
                >
                  +👤
                </button>
                <button
                  type="button"
                  className="cp-btn"
                  style={{ padding: "1px 5px", fontSize: "10px" }}
                  onClick={() => onStartCreateInFolder(folder, "folder")}
                  title="Nova Subpasta nesta Pasta"
                >
                  +📁
                </button>
              </>
            )}
            {(isGM || canEdit) && (
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "1px 5px", fontSize: "10px" }}
                onClick={() => {
                  setTempName(folder.name || "");
                  setEditingName((prev) => !prev);
                }}
                title="Renomear Pasta"
              >
                ✏️
              </button>
            )}
            {(canManageFolder || canDelete) && (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "1px 5px", fontSize: "10px" }}
                onClick={() => onDeleteFolder(folder.id)}
                title="Excluir Pasta"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div
          style={{
            paddingLeft: "18px",
            borderLeft: "2px solid #e2e8f0",
            marginLeft: "8px"
          }}
        >
          {subfolders.map((subNode) => (
            <FolderNode
              key={subNode.id}
              node={subNode}
              campaignId={campaignId}
              isGM={isGM}
              canEditCharacter={canEditCharacter}
              canDeleteCharacter={canDeleteCharacter}
              canEditFolder={canEditFolder}
              canDeleteFolder={canDeleteFolder}
              currentUserId={currentUserId}
              onlineUsers={onlineUsers}
              collapsedMap={collapsedMap}
              onToggleCollapse={onToggleCollapse}
              onOpenSheet={onOpenSheet}
              onOpenSpawnModal={onOpenSpawnModal}
              onDeleteCharacter={onDeleteCharacter}
              onOpenMoveModal={onOpenMoveModal}
              onStartCreateInFolder={onStartCreateInFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDropCharacterOnFolder={onDropCharacterOnFolder}
              onDropFolderOnFolder={onDropFolderOnFolder}
              onInvalidFolderName={onInvalidFolderName}
            />
          ))}

          {folderChars.map((char) => (
            <CharacterRow
              key={char.id}
              character={char}
              campaignId={campaignId}
              isGM={isGM}
              canEditCharacter={canEditCharacter}
              canDeleteCharacter={canDeleteCharacter}
              currentUserId={currentUserId}
              onlineUsers={onlineUsers}
              onOpenSheet={onOpenSheet}
              onOpenSpawnModal={onOpenSpawnModal}
              onDeleteCharacter={onDeleteCharacter}
              onOpenMoveModal={onOpenMoveModal}
            />
          ))}

          {subfolders.length === 0 && folderChars.length === 0 && (
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                padding: "6px 8px",
                fontStyle: "italic"
              }}
            >
              (Pasta vazia - arraste itens para cá)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
