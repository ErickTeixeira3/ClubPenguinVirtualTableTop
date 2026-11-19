import { FolderTreeNode, SidebarCardRow } from "./FolderTree";
import InlineFolderForm from "./InlineFolderForm";
import ScopeTabs from "./ScopeTabs";
import { buildCategoryTree, matchesJournalScopeFilter } from "./journalHelpers";
import { JOURNAL_NOTE_TYPES } from "./noteTypesUi";

export default function JournalSidebar({
  leftPanelCollapsed,
  searchQuery,
  onChangeSearchQuery,
  onStartNewCard,
  onCollapsePanel,
  isGM,
  activeScopeTab,
  totalNotesCount,
  selectedPlayerUid,
  playersList,
  onChangeScopeTab,
  onChangeSelectedPlayerUid,
  scopedNotes,
  accessibleFolders,
  scopeFilterContext,
  campaignId,
  collapsedCategories,
  onToggleCategory,
  collapsedFolders,
  onToggleFolder,
  editingNoteId,
  onSelectNote,
  newFolderTarget,
  newFolderNameInput,
  onChangeNewFolderName,
  onSubmitNewFolder,
  onCancelNewFolder,
  onStartNewSubfolder,
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
  draggedFolderId,
  dragOverTargetKey,
  onDragEnterFolder,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropOnFolder,
  onDragStartNote,
  onDragStartFolder,
  onDragEndAll
}) {
  return (
    <aside
      style={{
        width: leftPanelCollapsed ? "0px" : "290px",
        minWidth: leftPanelCollapsed ? "0px" : "290px",
        height: "100%",
        background: "linear-gradient(180deg, #0b1d33 0%, #071322 100%)",
        borderRight: leftPanelCollapsed
          ? "none"
          : "3px solid var(--cp-blue-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.2s ease, min-width 0.2s ease",
        zIndex: 15,
        paddingBottom: "74px"
      }}
    >
      <div
        style={{
          padding: "10px 10px 8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          borderBottom: "2px solid rgba(56, 152, 255, 0.2)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1.5px solid rgba(56, 152, 255, 0.35)",
              borderRadius: "8px",
              padding: "4px 8px"
            }}
          >
            <span style={{ fontSize: "12px", opacity: 0.7 }}>🔍</span>
            <input
              type="text"
              placeholder="Pesquisar cards..."
              value={searchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                minWidth: 0
              }}
            />
          </div>

          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center"
            }}
            title="Criar Novo Card"
            onClick={onStartNewCard}
          >
            + Card
          </button>

          <button
            type="button"
            className="cp-btn"
            style={{
              padding: "4px 7px",
              fontSize: "11px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center"
            }}
            title="Recolher menu"
            onClick={onCollapsePanel}
          >
            ◀
          </button>
        </div>

        <ScopeTabs
          isGM={isGM}
          activeScopeTab={activeScopeTab}
          totalNotesCount={totalNotesCount}
          selectedPlayerUid={selectedPlayerUid}
          playersList={playersList}
          onChangeScopeTab={onChangeScopeTab}
          onChangeSelectedPlayerUid={onChangeSelectedPlayerUid}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "8px 6px",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}
      >
        {JOURNAL_NOTE_TYPES.map((typeMeta) => {
          const colNotes = scopedNotes.filter(
            (n) => (n.noteType || "lore") === typeMeta.key
          );

          const explicitFoldersForType = (accessibleFolders || []).filter(
            (f) =>
              (f.noteType || "lore") === typeMeta.key &&
              matchesJournalScopeFilter(f, scopeFilterContext)
          );

          const tree = buildCategoryTree(explicitFoldersForType, colNotes);
          const isCatCollapsed = Boolean(collapsedCategories[typeMeta.key]);
          const isCreatingRootFolderHere =
            newFolderTarget?.typeKey === typeMeta.key &&
            !newFolderTarget?.parentId;

          const catTargetKey = `cat::${typeMeta.key}`;
          const isCatDragOver = dragOverTargetKey === catTargetKey;
          const rootTargetKey = `root::${typeMeta.key}`;
          const isRootDragOver = dragOverTargetKey === rootTargetKey;

          return (
            <div
              key={typeMeta.key}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  userSelect: "none",
                  color: isCatDragOver ? "#ffe066" : "#a9d4ff",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  background: isCatDragOver
                    ? "rgba(255, 224, 102, 0.25)"
                    : "transparent",
                  border: isCatDragOver
                    ? "1.5px dashed #ffe066"
                    : "1.5px solid transparent",
                  transition: "background 0.12s ease, border-color 0.12s ease"
                }}
                onClick={() => onToggleCategory(typeMeta.key)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverTargetKey !== catTargetKey) {
                    onDragOverTarget(catTargetKey, null);
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    onDragLeaveTarget(catTargetKey);
                  }
                }}
                onDrop={(e) => onDropOnFolder(e, null, typeMeta.key)}
                onMouseEnter={(e) => {
                  if (!isCatDragOver) {
                    e.currentTarget.style.background =
                      "rgba(255, 255, 255, 0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCatDragOver) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "3px",
                      background: typeMeta.color,
                      display: "inline-block"
                    }}
                  />
                  <span>{typeMeta.label}</span>
                  <span style={{ fontSize: "10px", opacity: isCatDragOver ? 1 : 0.6 }}>
                    {isCatDragOver
                      ? "↳ mover para raiz"
                      : `(${colNotes.length})`}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    title={`Criar pasta em ${typeMeta.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartNewSubfolder(typeMeta.key, null, null);
                    }}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "5px",
                      color: "#e2f1ff",
                      cursor: "pointer",
                      fontSize: "10px",
                      padding: "1px 5px",
                      fontWeight: 800
                    }}
                  >
                    📁+
                  </button>

                  <button
                    type="button"
                    title={`Novo card em ${typeMeta.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartNewCardInFolder(typeMeta.key, "");
                    }}
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "5px",
                      color: "#ffe066",
                      cursor: "pointer",
                      fontSize: "10px",
                      padding: "1px 5px",
                      fontWeight: 900
                    }}
                  >
                    +
                  </button>

                  <span style={{ fontSize: "10px", opacity: 0.7 }}>
                    {isCatCollapsed ? "▸" : "▾"}
                  </span>
                </div>
              </div>

              {isCreatingRootFolderHere && (
                <InlineFolderForm
                  value={newFolderNameInput}
                  onChange={onChangeNewFolderName}
                  onSubmit={onSubmitNewFolder}
                  onCancel={onCancelNewFolder}
                  placeholder="Nome da pasta..."
                  paddingLeft="18px"
                />
              )}

              {!isCatCollapsed && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    paddingLeft: "12px"
                  }}
                >
                  {tree.roots.map((folderNode) => (
                    <FolderTreeNode
                      key={`${typeMeta.key}::${folderNode.id}`}
                      folderNode={folderNode}
                      typeKey={typeMeta.key}
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
                      onDragEndNote={onDragEndAll}
                      onDragStartFolder={onDragStartFolder}
                      onDragEndFolder={onDragEndAll}
                    />
                  ))}

                  {tree.rootItems.map((note) => (
                    <SidebarCardRow
                      key={note.id}
                      note={note}
                      campaignId={campaignId}
                      isSelected={editingNoteId === note.id}
                      isDragging={draggedNoteId === note.id}
                      onClick={onSelectNote}
                      onDragStart={onDragStartNote}
                      onDragEnd={onDragEndAll}
                    />
                  ))}

                  {(draggedNoteId || draggedFolderId) && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverTargetKey !== rootTargetKey) {
                          onDragOverTarget(rootTargetKey, null);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          onDragLeaveTarget(rootTargetKey);
                        }
                      }}
                      onDrop={(e) => onDropOnFolder(e, null, typeMeta.key)}
                      style={{
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: isRootDragOver
                          ? "2px dashed #ffe066"
                          : "1.5px dashed rgba(255, 255, 255, 0.2)",
                        background: isRootDragOver
                          ? "rgba(255, 224, 102, 0.25)"
                          : "rgba(255, 255, 255, 0.04)",
                        color: isRootDragOver ? "#ffe066" : "#94a3b8",
                        fontSize: "11px",
                        fontWeight: 700,
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        marginTop: "3px",
                        userSelect: "none"
                      }}
                    >
                      {isRootDragOver
                        ? `↳ Soltar na raiz de ${typeMeta.label}`
                        : `Mover para raiz de ${typeMeta.label}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
