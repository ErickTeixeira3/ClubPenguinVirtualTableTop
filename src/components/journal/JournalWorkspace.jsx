import { useMemo, useRef, useState } from "react";
import { NOTE_TYPES, getNoteTypeMeta } from "../../engines/aliasEngine";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import JournalGraphWebView from "./JournalGraphWebView";
import NoteEditorModal from "./NoteEditorModal";

function getNoteTypeIcon(noteType) {
  switch (noteType) {
    case "lore":
      return "📜";
    case "character":
      return "🐧";
    case "location":
      return "📍";
    case "event":
      return "⚡";
    case "quest":
      return "🎯";
    default:
      return "📄";
  }
}

function normalizeFolderPath(rawPath) {
  return String(rawPath || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

function buildFolderTree(explicitFolders = [], notes = []) {
  const root = {
    childrenMap: new Map(), // segmentName -> folderNode
    notes: [] // notes directly in category root
  };

  const ensurePath = (fullPath, folderId = null) => {
    const clean = normalizeFolderPath(fullPath);
    if (!clean) return root;
    const segments = clean.split("/");
    let current = root;
    let accum = "";

    segments.forEach((seg, idx) => {
      accum = accum ? `${accum}/${seg}` : seg;
      if (!current.childrenMap.has(seg)) {
        current.childrenMap.set(seg, {
          name: seg,
          fullPath: accum,
          id: null,
          childrenMap: new Map(),
          notes: []
        });
      }
      const node = current.childrenMap.get(seg);
      if (idx === segments.length - 1 && folderId && !node.id) {
        node.id = folderId;
      }
      current = node;
    });

    return current;
  };

  explicitFolders.forEach((f) => {
    ensurePath(f.name, f.id);
  });

  notes.forEach((n) => {
    const clean = normalizeFolderPath(n.folder);
    if (!clean) {
      root.notes.push(n);
    } else {
      const targetNode = ensurePath(clean);
      targetNode.notes.push(n);
    }
  });

  const countTotalNotes = (node) => {
    let total = node.notes.length;
    node.childrenMap.forEach((child) => {
      total += countTotalNotes(child);
    });
    node.totalNotes = total;
    return total;
  };

  root.childrenMap.forEach((child) => countTotalNotes(child));

  return root;
}

function SidebarCardRow({
  note,
  campaignId,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd
}) {
  const { url: imageUrl } = useMediaUrl(note.imageMediaId, null, campaignId);
  const [imageError, setImageError] = useState(false);
  const meta = getNoteTypeMeta(note.noteType);

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            noteId: note.id,
            noteType: note.noteType,
            folder: note.folder || ""
          })
        );
        e.dataTransfer.effectAllowed = "move";
        if (onDragStart) onDragStart(note);
      }}
      onDragEnd={() => {
        if (onDragEnd) onDragEnd();
      }}
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
        background: isSelected
          ? "rgba(56, 152, 255, 0.25)"
          : "transparent",
        border: isSelected
          ? "1.5px solid #3898ff"
          : "1.5px solid transparent",
        transition: "background 0.12s ease, border-color 0.12s ease, opacity 0.12s ease",
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
      {/* Ícone / Miniatura do Card */}
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

      {/* Nome do Card */}
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

function FolderTreeNode({
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
  onStartNewCardInFolder,
  onDeleteFolder,
  draggedNoteId,
  dragOverTargetKey,
  onDragOverTarget,
  onDragLeaveTarget,
  onDropOnFolder,
  onDragStartNote,
  onDragEndNote
}) {
  const folderKey = `${typeKey}::${folderNode.fullPath}`;
  const isCollapsed = Boolean(collapsedFolders[folderKey]);
  const isDragOver = dragOverTargetKey === folderKey;
  const isCreatingSubfolderHere =
    newFolderTarget?.typeKey === typeKey &&
    newFolderTarget?.parentPath === folderNode.fullPath;

  const subFolders = Array.from(folderNode.childrenMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1px"
      }}
    >
      {/* Cabeçalho da Pasta (Drop Target) */}
      <div
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
          background: isDragOver
            ? "rgba(56, 152, 255, 0.4)"
            : "transparent",
          border: isDragOver
            ? "1.5px dashed #ffe066"
            : "1.5px solid transparent",
          boxShadow: isDragOver
            ? "0 0 10px rgba(56, 152, 255, 0.6)"
            : "none",
          transition: "background 0.12s ease, border-color 0.12s ease"
        }}
        onClick={() => onToggleFolder(folderKey)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          if (dragOverTargetKey !== folderKey) {
            onDragOverTarget(folderKey, folderNode.fullPath);
          }
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
          onDropOnFolder(e, folderNode.fullPath, typeKey);
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
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {folderNode.name}
          </span>
          <span style={{ fontSize: "10px", opacity: isDragOver ? 1 : 0.5 }}>
            {isDragOver ? "↳ mover para cá" : `(${folderNode.totalNotes ?? folderNode.notes.length})`}
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
          {/* Botão para criar subpasta dentro desta pasta */}
          <button
            type="button"
            title={`Nova subpasta dentro de "${folderNode.name}"`}
            onClick={(e) => {
              e.stopPropagation();
              onStartNewSubfolder(typeKey, folderNode.fullPath, folderKey);
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

          {/* Botão para criar card dentro desta pasta */}
          <button
            type="button"
            title={`Novo card em "${folderNode.name}"`}
            onClick={(e) => {
              e.stopPropagation();
              onStartNewCardInFolder(typeKey, folderNode.fullPath);
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

          {onDeleteFolder && (
            <button
              type="button"
              title={`Excluir pasta "${folderNode.name}"`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFolder(
                  folderNode.id,
                  folderNode.fullPath,
                  typeKey
                );
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

      {/* Input inline para criar subpasta */}
      {isCreatingSubfolderHere && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitNewFolder();
          }}
          style={{
            display: "flex",
            gap: "4px",
            padding: "4px 6px 4px 16px"
          }}
        >
          <input
            type="text"
            className="cp-input"
            placeholder={`Subpasta em ${folderNode.name}...`}
            value={newFolderNameInput}
            onChange={(e) => onChangeNewFolderName(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              padding: "2px 6px",
              fontSize: "11px",
              height: "24px",
              minWidth: 0
            }}
          />
          <button
            type="submit"
            className="cp-btn cp-btn-green"
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              height: "24px"
            }}
          >
            OK
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            onClick={onCancelNewFolder}
            style={{
              padding: "2px 6px",
              fontSize: "10px",
              height: "24px"
            }}
          >
            ✕
          </button>
        </form>
      )}

      {/* Conteúdo recursivo da Pasta (Subpastas + Cards) */}
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
            onDropOnFolder(e, folderNode.fullPath, typeKey);
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
              key={`${typeKey}::${sub.fullPath}`}
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
              onStartNewCardInFolder={onStartNewCardInFolder}
              onDeleteFolder={onDeleteFolder}
              draggedNoteId={draggedNoteId}
              dragOverTargetKey={dragOverTargetKey}
              onDragOverTarget={onDragOverTarget}
              onDragLeaveTarget={onDragLeaveTarget}
              onDropOnFolder={onDropOnFolder}
              onDragStartNote={onDragStartNote}
              onDragEndNote={onDragEndNote}
            />
          ))}

          {folderNode.notes.map((note) => (
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
  onUpdateNodePosition,
  onCloneNoteToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onDeleteNote,
  onCreateFolder,
  onDeleteFolder,
  onOpenCharacterSheet
}) {
  const [activeScopeTab, setActiveScopeTab] = useState(
    isGM ? "gm" : "player"
  ); // 'gm' | 'player' | 'party' | 'unified'
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(currentUserId);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [creatingNote, setCreatingNote] = useState(false);
  const [defaultTypeForNewNote, setDefaultTypeForNewNote] = useState(null);
  const [defaultFolderForNewNote, setDefaultFolderForNewNote] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  // Estado de recolhimento das categorias e das pastas internas
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedFolders, setCollapsedFolders] = useState({});
  // newFolderTarget: { typeKey: string, parentPath: string } | null
  const [newFolderTarget, setNewFolderTarget] = useState(null);
  const [newFolderNameInput, setNewFolderNameInput] = useState("");

  // Estado de Arrastar e Soltar (Drag & Drop Explorer)
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverTargetKey, setDragOverTargetKey] = useState(null);
  const autoExpandTimerRef = useRef(null);

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

  const handleDragOverTarget = (targetKey, folderFullPath) => {
    setDragOverTargetKey(targetKey);

    // Se for uma pasta recolhida, expande automaticamente após 500ms
    if (targetKey && targetKey.includes("::") && folderFullPath) {
      if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = setTimeout(() => {
        setCollapsedFolders((prev) => ({
          ...prev,
          [targetKey]: false
        }));
      }, 550);
    }
  };

  const handleDragLeaveTarget = (targetKey) => {
    if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current);
    if (dragOverTargetKey === targetKey) {
      setDragOverTargetKey(null);
    }
  };

  const handleMoveNoteToFolder = async (noteId, targetFolder, targetTypeKey) => {
    if (!noteId) return;
    const note = accessibleNotes.find((n) => n.id === noteId);
    if (!note) return;

    const cleanTargetFolder = normalizeFolderPath(targetFolder);
    const currentFolder = normalizeFolderPath(note.folder);

    if (
      currentFolder === cleanTargetFolder &&
      (!targetTypeKey || note.noteType === targetTypeKey)
    ) {
      return;
    }

    const updates = {
      folder: cleanTargetFolder
    };
    if (targetTypeKey && targetTypeKey !== note.noteType) {
      updates.noteType = targetTypeKey;
    }

    await onUpdateNote(noteId, updates);
  };

  const handleDropOnFolder = (e, targetFolder, targetTypeKey) => {
    e.preventDefault();
    e.stopPropagation();
    if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current);
    setDragOverTargetKey(null);

    let noteId = draggedNoteId;
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.noteId) {
          noteId = parsed.noteId;
        }
      }
    } catch {
      // fallback to draggedNoteId
    }

    if (noteId) {
      handleMoveNoteToFolder(noteId, targetFolder, targetTypeKey);
    }
    setDraggedNoteId(null);
  };

  const handleDragEndNote = () => {
    if (autoExpandTimerRef.current) clearTimeout(autoExpandTimerRef.current);
    setDraggedNoteId(null);
    setDragOverTargetKey(null);
  };

  const handleStartNewSubfolder = (typeKey, parentPath, folderKeyToExpand) => {
    setNewFolderTarget({ typeKey, parentPath: parentPath || "" });
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
    const trimmed = newFolderNameInput
      .trim()
      .replace(/^\/+|\/+$/g, "");
    if (!trimmed) {
      setNewFolderTarget(null);
      return;
    }

    const fullFolderName = newFolderTarget.parentPath
      ? `${newFolderTarget.parentPath}/${trimmed}`
      : trimmed;

    const targetScope =
      activeScopeTab === "unified"
        ? "party"
        : activeScopeTab === "gm" && isGM
        ? "gm"
        : activeScopeTab;

    const targetOwnerId =
      targetScope === "player"
        ? isGM
          ? selectedPlayerUid
          : currentUserId
        : currentUserId;

    if (onCreateFolder) {
      await onCreateFolder({
        name: fullFolderName,
        noteType: newFolderTarget.typeKey,
        scope: targetScope,
        ownerId: targetOwnerId
      });
    }
    setNewFolderNameInput("");
    setNewFolderTarget(null);
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

  const scopedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return accessibleNotes.filter((n) => {
      if (activeScopeTab === "gm" && n.scope !== "gm") return false;
      if (activeScopeTab === "party" && n.scope !== "party") return false;
      if (activeScopeTab === "player") {
        const targetOwner = isGM ? selectedPlayerUid : currentUserId;
        if (n.scope !== "player" || n.ownerId !== targetOwner) return false;
      }

      if (!q) return true;
      const inTitle = (n.title || "").toLowerCase().includes(q);
      const inContent = (n.content || "").toLowerCase().includes(q);
      const inAliases = (n.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return inTitle || inContent || inAliases;
    });
  }, [
    accessibleNotes,
    activeScopeTab,
    isGM,
    selectedPlayerUid,
    currentUserId,
    searchQuery
  ]);

  const handleSaveNote = async (formData) => {
    const normalizedFolder = normalizeFolderPath(formData.folder);
    if (formData.id) {
      await onUpdateNote(
        formData.id,
        {
          title: formData.title,
          noteType: formData.noteType,
          folder: normalizedFolder,
          linkedCharacterSheetId: formData.linkedCharacterSheetId,
          aliases: formData.aliases,
          ignoredAliases: formData.ignoredAliases,
          content: formData.content,
          sections: formData.sections,
          relatedNoteIds: formData.relatedNoteIds
        },
        formData.file
      );
    } else {
      const targetScope =
        activeScopeTab === "unified"
          ? "party"
          : activeScopeTab === "gm" && isGM
          ? "gm"
          : activeScopeTab;

      const targetOwnerId =
        targetScope === "player"
          ? isGM
            ? selectedPlayerUid
            : currentUserId
          : currentUserId;

      await onCreateNote({
        scope: targetScope,
        ownerId: targetOwnerId,
        noteType: formData.noteType,
        folder: normalizedFolder,
        title: formData.title,
        aliases: formData.aliases,
        ignoredAliases: formData.ignoredAliases,
        content: formData.content,
        sections: formData.sections,
        relatedNoteIds: formData.relatedNoteIds,
        linkedCharacterSheetId: formData.linkedCharacterSheetId,
        file: formData.file
      });
    }
  };

  const currentModalNote = useMemo(() => {
    if (!editingNote?.id) return editingNote;
    return accessibleNotes.find((n) => n.id === editingNote.id) || editingNote;
  }, [editingNote, accessibleNotes]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        zIndex: 12
      }}
    >
      {/* Menu Esquerdo de Documentos e Pastas (Estilo vvd.world) */}
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
        {/* Topo do Menu: Busca + Ações Rápidas */}
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
              onClick={() => {
                setDefaultTypeForNewNote(null);
                setDefaultFolderForNewNote("");
                setCreatingNote(true);
              }}
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
              onClick={() => setLeftPanelCollapsed(true)}
            >
              ◀
            </button>
          </div>

          {/* Seletor de Diário (Mestre / Player / Grupo / Todos) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isGM ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: "4px"
            }}
          >
            {isGM && (
              <button
                type="button"
                className={`cp-btn ${activeScopeTab === "gm" ? "cp-btn-gold" : ""}`}
                style={{ padding: "3px 6px", fontSize: "10px" }}
                onClick={() => setActiveScopeTab("gm")}
              >
                Mestre
              </button>
            )}

            <button
              type="button"
              className={`cp-btn ${activeScopeTab === "player" ? "cp-btn-gold" : ""}`}
              style={{ padding: "3px 6px", fontSize: "10px" }}
              onClick={() => setActiveScopeTab("player")}
            >
              {isGM ? "Player" : "Meu Diário"}
            </button>

            <button
              type="button"
              className={`cp-btn ${activeScopeTab === "party" ? "cp-btn-gold" : ""}`}
              style={{ padding: "3px 6px", fontSize: "10px" }}
              onClick={() => setActiveScopeTab("party")}
            >
              Grupo
            </button>

            <button
              type="button"
              className={`cp-btn ${activeScopeTab === "unified" ? "cp-btn-gold" : ""}`}
              style={{ padding: "3px 6px", fontSize: "10px" }}
              onClick={() => setActiveScopeTab("unified")}
            >
              Todos ({accessibleNotes.length})
            </button>
          </div>

          {isGM && activeScopeTab === "player" && (
            <select
              className="cp-input"
              style={{ width: "100%", padding: "3px 8px", fontSize: "11px", height: "26px" }}
              value={selectedPlayerUid}
              onChange={(e) => setSelectedPlayerUid(e.target.value)}
            >
              {playersList.map((p) => (
                <option key={p.uid} value={p.uid}>
                  Diário de: {p.displayName}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Árvore de Categorias -> Pastas / Subpastas -> Cards (Ícone + Nome) */}
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
          {NOTE_TYPES.map((typeMeta) => {
            const colNotes = scopedNotes.filter(
              (n) => (n.noteType || "lore") === typeMeta.key
            );

            const explicitFoldersForType = (accessibleFolders || []).filter(
              (f) => {
                if (f.noteType !== typeMeta.key) return false;
                if (activeScopeTab === "gm" && f.scope !== "gm") return false;
                if (activeScopeTab === "party" && f.scope !== "party") return false;
                if (activeScopeTab === "player") {
                  const targetOwner = isGM ? selectedPlayerUid : currentUserId;
                  if (f.scope !== "player" || f.ownerId !== targetOwner) return false;
                }
                return true;
              }
            );

            const treeRoot = buildFolderTree(explicitFoldersForType, colNotes);
            const topLevelFolders = Array.from(
              treeRoot.childrenMap.values()
            ).sort((a, b) => a.name.localeCompare(b.name));

            const isCatCollapsed = Boolean(collapsedCategories[typeMeta.key]);
            const isCreatingRootFolderHere =
              newFolderTarget?.typeKey === typeMeta.key &&
              !newFolderTarget?.parentPath;

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
                {/* Linha da Categoria Principal (Drop Target para Raiz da Categoria) */}
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
                  onClick={() => toggleCategory(typeMeta.key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverTargetKey !== catTargetKey) {
                      handleDragOverTarget(catTargetKey, "");
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      handleDragLeaveTarget(catTargetKey);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDropOnFolder(e, "", typeMeta.key);
                  }}
                  onMouseEnter={(e) => {
                    if (!isCatDragOver) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
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
                      {isCatDragOver ? "↳ mover para raiz" : `(${colNotes.length})`}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      title={`Criar pasta em ${typeMeta.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartNewSubfolder(typeMeta.key, "", null);
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
                        setDefaultTypeForNewNote(typeMeta.key);
                        setDefaultFolderForNewNote("");
                        setCreatingNote(true);
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

                {/* Formulário inline para criar pasta raiz na categoria */}
                {isCreatingRootFolderHere && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitNewFolder();
                    }}
                    style={{
                      display: "flex",
                      gap: "4px",
                      padding: "4px 8px 4px 18px"
                    }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Nome da pasta..."
                      value={newFolderNameInput}
                      onChange={(e) => setNewFolderNameInput(e.target.value)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: "2px 6px",
                        fontSize: "11px",
                        height: "24px",
                        minWidth: 0
                      }}
                    />
                    <button
                      type="submit"
                      className="cp-btn cp-btn-green"
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        height: "24px"
                      }}
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      className="cp-btn cp-btn-orange"
                      onClick={() => setNewFolderTarget(null)}
                      style={{
                        padding: "2px 6px",
                        fontSize: "10px",
                        height: "24px"
                      }}
                    >
                      ✕
                    </button>
                  </form>
                )}

                {/* Itens dentro da Categoria */}
                {!isCatCollapsed && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      paddingLeft: "12px"
                    }}
                  >
                    {/* Árvore Recursiva de Pastas e Subpastas */}
                    {topLevelFolders.map((folderNode) => (
                      <FolderTreeNode
                        key={`${typeMeta.key}::${folderNode.fullPath}`}
                        folderNode={folderNode}
                        typeKey={typeMeta.key}
                        campaignId={campaignId}
                        collapsedFolders={collapsedFolders}
                        onToggleFolder={toggleFolder}
                        editingNoteId={editingNote?.id}
                        onSelectNote={(n) => setEditingNote(n)}
                        onStartNewSubfolder={handleStartNewSubfolder}
                        newFolderTarget={newFolderTarget}
                        newFolderNameInput={newFolderNameInput}
                        onChangeNewFolderName={setNewFolderNameInput}
                        onSubmitNewFolder={handleSubmitNewFolder}
                        onCancelNewFolder={() => setNewFolderTarget(null)}
                        onStartNewCardInFolder={(tKey, fullPath) => {
                          setDefaultTypeForNewNote(tKey);
                          setDefaultFolderForNewNote(fullPath);
                          setCreatingNote(true);
                        }}
                        onDeleteFolder={onDeleteFolder}
                        draggedNoteId={draggedNoteId}
                        dragOverTargetKey={dragOverTargetKey}
                        onDragOverTarget={handleDragOverTarget}
                        onDragLeaveTarget={handleDragLeaveTarget}
                        onDropOnFolder={handleDropOnFolder}
                        onDragStartNote={(n) => setDraggedNoteId(n.id)}
                        onDragEndNote={handleDragEndNote}
                      />
                    ))}

                    {/* Cards soltos direto na categoria */}
                    {treeRoot.notes.map((note) => (
                      <SidebarCardRow
                        key={note.id}
                        note={note}
                        campaignId={campaignId}
                        isSelected={editingNote?.id === note.id}
                        isDragging={draggedNoteId === note.id}
                        onClick={(n) => setEditingNote(n)}
                        onDragStart={(n) => setDraggedNoteId(n.id)}
                        onDragEnd={handleDragEndNote}
                      />
                    ))}

                    {/* Zona explícita para soltar na raiz da categoria durante o arraste */}
                    {draggedNoteId && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverTargetKey !== rootTargetKey) {
                            handleDragOverTarget(rootTargetKey, "");
                          }
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) {
                            handleDragLeaveTarget(rootTargetKey);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDropOnFolder(e, "", typeMeta.key);
                        }}
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

      {/* Botão para reabrir o menu esquerdo quando recolhido */}
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

      {/* Área Principal Direita/Centro: Visão de Teia */}
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
          onSelectNoteToEdit={(n) => setEditingNote(n)}
          onOpenCharacterSheet={onOpenCharacterSheet}
          onUpdateNodePosition={onUpdateNodePosition}
        />
      </div>

      {/* Modal do Card com todas as opções (Clonar, Acesso, Vínculos, Edição) */}
      {(creatingNote || editingNote) && (
        <NoteEditorModal
          key={editingNote?.id || "new_note"}
          note={
            currentModalNote ||
            (defaultTypeForNewNote || defaultFolderForNewNote
              ? {
                  noteType: defaultTypeForNewNote || "lore",
                  folder: defaultFolderForNewNote || ""
                }
              : null)
          }
          defaultScope={
            activeScopeTab === "unified"
              ? "party"
              : activeScopeTab === "gm" && isGM
              ? "gm"
              : activeScopeTab
          }
          defaultOwnerId={
            activeScopeTab === "player" && isGM
              ? selectedPlayerUid
              : currentUserId
          }
          isGM={isGM}
          currentUserId={currentUserId}
          playersList={playersList}
          accessibleNotes={accessibleNotes}
          accessibleFolders={accessibleFolders}
          characters={characters}
          onSave={handleSaveNote}
          onDelete={onDeleteNote}
          onOpenNote={(targetNote) => {
            setCreatingNote(false);
            setEditingNote(targetNote);
          }}
          onUpdateTargetNote={(targetId, updates) =>
            onUpdateNote(targetId, updates)
          }
          onCloneToTarget={onCloneNoteToTarget}
          onShareNoteWithTarget={onShareNoteWithTarget}
          onRevokeNoteAccess={onRevokeNoteAccess}
          onOpenCharacterSheet={onOpenCharacterSheet}
          onClose={() => {
            setCreatingNote(false);
            setEditingNote(null);
            setDefaultTypeForNewNote(null);
            setDefaultFolderForNewNote("");
          }}
        />
      )}
    </div>
  );
}
