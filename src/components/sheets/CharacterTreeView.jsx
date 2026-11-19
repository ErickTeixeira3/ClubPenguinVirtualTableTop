import CharacterRow from "./CharacterRow";
import FolderNode from "./FolderNode";

export default function CharacterTreeView({
  section,
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
  onOpenCreateCharacter,
  onOpenCreateFolder,
  onStartCreateInFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropCharacterOnFolder,
  onDropFolderOnFolder,
  onDropCharacterOnSectionRoot,
  onDropFolderOnSectionRoot,
  onInvalidFolderName = null
}) {
  const isCollapsed = section.collapsible ? Boolean(collapsedMap[section.id]) : false;
  const { roots = [], rootItems = [] } = section.tree || {};

  const handleSectionDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const charId = e.dataTransfer.getData("text/character-id");
    if (charId) {
      onDropCharacterOnSectionRoot?.(charId, section);
      return;
    }

    const folderId = e.dataTransfer.getData("text/folder-id");
    if (folderId && section.allowRootFolderDrop !== false) {
      onDropFolderOnSectionRoot?.(folderId, section);
    }
  };

  return (
    <div
      style={
        section.kind === "gm"
          ? { marginBottom: "8px" }
          : {
              borderTop: "1.5px solid #e2e8f0",
              marginTop: "4px"
            }
      }
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleSectionDrop}
    >
      {section.title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 10px",
            background: "#f8fafc",
            cursor: section.collapsible ? "pointer" : "default",
            userSelect: "none"
          }}
        >
          <div
            onClick={() => section.collapsible && onToggleCollapse(section.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
              flex: 1
            }}
          >
            {section.collapsible && (
              <span style={{ fontSize: "14px", fontWeight: 900, color: "#334155" }}>
                {isCollapsed ? "+" : "-"}
              </span>
            )}
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: section.kind === "shared" ? "#0369a1" : "#1e293b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {section.title}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
              ({section.totalCount})
            </span>
          </div>

          {section.allowCreate && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "1px 6px", fontSize: "10px" }}
                onClick={() => onOpenCreateCharacter?.(null, section.ownerId)}
                title={
                  section.kind === "gm"
                    ? "Criar personagem do Mestre"
                    : "Criar personagem para este jogador"
                }
              >
                +👤
              </button>
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "1px 6px", fontSize: "10px" }}
                onClick={() => onOpenCreateFolder?.(null, section.ownerId)}
                title={
                  section.kind === "gm"
                    ? "Criar pasta do Mestre"
                    : "Criar pasta para este jogador"
                }
              >
                +📁
              </button>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div style={section.kind === "player" ? { paddingLeft: "10px" } : undefined}>
          {rootItems.map((char) => (
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

          {roots.map((rootNode) => (
            <FolderNode
              key={rootNode.id}
              node={rootNode}
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

          {rootItems.length === 0 && roots.length === 0 && section.emptyText && (
            <div
              style={{
                padding: "8px 12px",
                fontSize: "11px",
                color: "#94a3b8",
                fontStyle: "italic"
              }}
            >
              {section.emptyText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
