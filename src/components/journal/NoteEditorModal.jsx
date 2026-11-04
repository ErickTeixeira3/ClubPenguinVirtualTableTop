import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  NOTE_TYPES,
  getNoteTypeMeta,
  normalizeAliasText,
  parseTextWithAliases
} from "../../engines/aliasEngine";

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

function parseContentToSections(content, savedSections) {
  if (Array.isArray(savedSections) && savedSections.length > 0) {
    return savedSections;
  }
  if (!content) {
    return [{ id: "sec_1", title: "", content: "" }];
  }

  const regex = /(?:^|\n)##\s+([^\n]+)\n/g;
  const matches = [...content.matchAll(regex)];
  if (matches.length > 0) {
    const list = [];
    const firstMatchPos =
      matches[0].index + (content[matches[0].index] === "\n" ? 1 : 0);
    if (firstMatchPos > 0) {
      const intro = content.substring(0, firstMatchPos).trim();
      if (intro) {
        list.push({ id: "sec_0", title: "", content: intro });
      }
    }
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headerTitle = match[1].trim();
      const startIndex = match.index + match[0].length;
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index : content.length;
      const blockContent = content.substring(startIndex, endIndex).trim();
      list.push({
        id: `sec_${i + 1}`,
        title: headerTitle,
        content: blockContent
      });
    }
    if (list.length > 0) return list;
  }

  return [{ id: "sec_1", title: "", content: content || "" }];
}

function LinkedCardSpan({
  tokenText,
  matchedNote,
  term,
  onOpenCard,
  onNegateLink
}) {
  const [popoverPos, setPopoverPos] = useState(null);
  const spanRef = useRef(null);
  const timeoutRef = useRef(null);
  const meta = getNoteTypeMeta(matchedNote?.noteType);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();

    const showAbove = rect.bottom + 65 > window.innerHeight;
    const topPos = showAbove ? rect.top - 6 : rect.bottom + 6;

    setPopoverPos({
      top: topPos,
      left: Math.max(
        140,
        Math.min(window.innerWidth - 140, rect.left + rect.width / 2)
      ),
      placement: showAbove ? "top" : "bottom"
    });
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setPopoverPos(null);
    }, 200);
  };

  return (
    <>
      <span
        ref={spanRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPopoverPos(null);
          onOpenCard?.(matchedNote);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={`${meta.singular}: ${matchedNote?.title}`}
        style={{
          background: `${meta.color}26`,
          borderBottom: `2.5px solid ${meta.color}`,
          color: "#001b3a",
          fontWeight: 800,
          padding: "1px 6px",
          borderRadius: "4px",
          cursor: "pointer",
          margin: "0 2px",
          display: "inline-block",
          transition: "all 0.15s ease",
          boxShadow: popoverPos ? `0 0 0 1.5px ${meta.color}` : "none"
        }}
      >
        {tokenText}
      </span>

      {popoverPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top:
                popoverPos.placement === "bottom"
                  ? `${popoverPos.top}px`
                  : undefined,
              bottom:
                popoverPos.placement === "top"
                  ? `${window.innerHeight - popoverPos.top}px`
                  : undefined,
              left: `${popoverPos.left}px`,
              transform: "translateX(-50%)",
              zIndex: 999999,
              background: "#ffffff",
              border: "2px solid #001b3a",
              borderRadius: "8px",
              padding: "5px 8px",
              boxShadow: "0 6px 18px rgba(0, 27, 58, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              pointerEvents: "auto"
            }}
            onMouseEnter={() => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#001b3a",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <span
                style={{
                  background: meta.color,
                  color:
                    matchedNote?.noteType === "quest" ? "#001b3a" : "#ffffff",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  fontSize: "10px"
                }}
              >
                {meta.singular}
              </span>
              {matchedNote?.title}
            </span>

            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{
                padding: "2px 7px",
                fontSize: "10px",
                fontWeight: 800
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPopoverPos(null);
                onOpenCard?.(matchedNote);
              }}
            >
              Abrir Card ↗
            </button>

            <button
              type="button"
              title="Remover vínculo"
              style={{
                background: "#ff5252",
                border: "1.5px solid #001b3a",
                borderRadius: "4px",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: "10px",
                padding: "2px 5px"
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPopoverPos(null);
                onNegateLink?.(matchedNote, term);
              }}
            >
              ✕
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

export default function NoteEditorModal({
  note = null,
  defaultScope = "party",
  defaultOwnerId = null,
  isGM = false,
  currentUserId = null,
  playersList = [],
  accessibleNotes = [],
  accessibleFolders = [],
  characters = [],
  onSave,
  onDelete,
  onOpenNote,
  onUpdateTargetNote,
  onCloneToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onOpenCharacterSheet,
  onClose
}) {
  const isEditing = Boolean(note?.id);
  const [cloneTarget, setCloneTarget] = useState("");
  const [justCloned, setJustCloned] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);

  // Verificação de permissões e acessos concedidos
  const isSharedWithParty =
    note?.scope === "party" ||
    (Array.isArray(note?.visibleTo) && note.visibleTo.includes("ALL"));

  const visibleUids = useMemo(() => {
    const list = note?.visibleTo;
    return (Array.isArray(list) ? list : []).filter(
      (id) => id !== "ALL"
    );
  }, [note]);

  const sharedPlayers = useMemo(() => {
    return (playersList || []).filter(
      (p) => visibleUids.includes(p.uid) && p.uid !== note?.ownerId
    );
  }, [playersList, visibleUids, note?.ownerId]);

  const availablePlayersToShare = useMemo(() => {
    return (playersList || []).filter(
      (p) => !visibleUids.includes(p.uid) && p.uid !== note?.ownerId
    );
  }, [playersList, visibleUids, note?.ownerId]);

  const sharedCount = (isSharedWithParty ? 1 : 0) + sharedPlayers.length;

  const handleCloneAction = async (targetValue) => {
    if (!targetValue || !onCloneToTarget || !note?.id) return;

    if (targetValue === "party") {
      await onCloneToTarget(note, {
        targetScope: "party",
        targetOwnerId: currentUserId
      });
    } else if (targetValue === "gm") {
      await onCloneToTarget(note, {
        targetScope: "gm",
        targetOwnerId: currentUserId
      });
    } else if (targetValue === "my_diary") {
      await onCloneToTarget(note, {
        targetScope: "player",
        targetOwnerId: currentUserId
      });
    } else if (targetValue.startsWith("player:")) {
      const targetUid = targetValue.replace("player:", "");
      await onCloneToTarget(note, {
        targetScope: "player",
        targetOwnerId: targetUid
      });
    }

    setCloneTarget("");
    setJustCloned(true);
    setTimeout(() => setJustCloned(false), 1400);
  };

  const [title, setTitle] = useState(note?.title || "");
  const [noteType, setNoteType] = useState(note?.noteType || "lore");
  const [folder, setFolder] = useState(note?.folder || "");

  // Lista de pastas (e subpastas) existentes para a categoria selecionada
  const availableFoldersForType = useMemo(() => {
    const set = new Set();
    const registerPathAndPrefixes = (rawPath) => {
      const clean = String(rawPath || "")
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      let accum = "";
      clean.forEach((seg) => {
        accum = accum ? `${accum}/${seg}` : seg;
        set.add(accum);
      });
    };

    (accessibleFolders || []).forEach((f) => {
      if (f.noteType === noteType && f.name?.trim()) {
        registerPathAndPrefixes(f.name);
      }
    });
    (accessibleNotes || []).forEach((n) => {
      if (n.noteType === noteType && n.folder?.trim()) {
        registerPathAndPrefixes(n.folder);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [accessibleFolders, accessibleNotes, noteType]);
  const [linkedCharacterSheetId, setLinkedCharacterSheetId] = useState(
    note?.linkedCharacterSheetId || ""
  );
  const [aliasesText, setAliasesText] = useState(
    Array.isArray(note?.aliases) ? note.aliases.join(", ") : ""
  );
  const [sections, setSections] = useState(() =>
    parseContentToSections(note?.content, note?.sections)
  );
  const [relatedNoteIds, setRelatedNoteIds] = useState(
    Array.isArray(note?.relatedNoteIds) ? note.relatedNoteIds : []
  );
  const [ignoredAliases, setIgnoredAliases] = useState(
    Array.isArray(note?.ignoredAliases) ? note.ignoredAliases : []
  );
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Modo de exibição: 'interactive' ou 'edit'
  const hasInitialContent =
    sections.some((s) => s.content?.trim() || s.title?.trim());
  const [editorMode, setEditorMode] = useState(
    hasInitialContent ? "interactive" : "edit"
  );
  const [selectedText, setSelectedText] = useState("");

  // Modal / Popover para vincular termo a outro card
  const [linkingModalOpen, setLinkingModalOpen] = useState(false);
  const [termToLink, setTermToLink] = useState("");
  const [linkFilterText, setLinkFilterText] = useState("");

  const handleCaptureSelection = (e) => {
    let sel = "";
    if (e.target && typeof e.target.selectionStart === "number") {
      sel = e.target.value
        .substring(e.target.selectionStart, e.target.selectionEnd)
        .trim();
    } else {
      const windowSel = window.getSelection();
      sel = windowSel ? windowSel.toString().trim() : "";
    }
    if (sel && sel.length >= 2) {
      setSelectedText(sel);
    } else {
      setSelectedText("");
    }
  };

  const handleOpenLinkingModal = () => {
    setTermToLink(selectedText || "");
    setLinkFilterText("");
    setLinkingModalOpen(true);
  };

  const handleLinkToCard = async (targetCard) => {
    const finalTerm = termToLink.trim();
    if (!finalTerm || !targetCard?.id) return;

    const currentTargetAliases = Array.isArray(targetCard.aliases)
      ? targetCard.aliases
      : [];
    const norm = normalizeAliasText(finalTerm);

    if (!currentTargetAliases.some((a) => normalizeAliasText(a) === norm)) {
      await onUpdateTargetNote?.(targetCard.id, {
        aliases: [...currentTargetAliases, finalTerm]
      });
    }

    setRelatedNoteIds((prev) =>
      prev.includes(targetCard.id) ? prev : [...prev, targetCard.id]
    );

    setIgnoredAliases((prev) =>
      prev.filter((a) => normalizeAliasText(a) !== norm)
    );

    setLinkingModalOpen(false);
    setSelectedText("");
  };

  const handleNegateLink = async (matchedNote, term) => {
    const norm = normalizeAliasText(term);
    setIgnoredAliases((prev) => (prev.includes(term) ? prev : [...prev, term]));

    if (matchedNote?.id && Array.isArray(matchedNote.aliases)) {
      const filtered = matchedNote.aliases.filter(
        (a) => normalizeAliasText(a) !== norm
      );
      if (filtered.length !== matchedNote.aliases.length) {
        await onUpdateTargetNote?.(matchedNote.id, {
          aliases: filtered
        });
      }
    }
  };

  // Gerenciamento de blocos de texto
  const handleAddSection = () => {
    const newId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setSections((prev) => [...prev, { id: newId, title: "", content: "" }]);
  };

  const handleDeleteSection = (secId) => {
    if (sections.length <= 1) {
      setSections([{ id: "sec_1", title: "", content: "" }]);
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== secId));
  };

  const handleUpdateSectionTitle = (secId, newTitle) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, title: newTitle } : s))
    );
  };

  const handleUpdateSectionContent = (secId, newContent) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, content: newContent } : s))
    );
  };

  const handleMoveSection = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handleSubmitInternal = async () => {
    if (!title.trim() || saving) return;

    setSaving(true);
    try {
      const parsedAliases = aliasesText
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const combinedContent = sections
        .map((s) =>
          s.title?.trim()
            ? `## ${s.title.trim()}\n${s.content || ""}`
            : s.content || ""
        )
        .join("\n\n")
        .trim();

      await onSave({
        id: note?.id || null,
        scope: note?.scope || defaultScope,
        ownerId: note?.ownerId || defaultOwnerId,
        title: title.trim(),
        noteType,
        folder: folder.trim(),
        linkedCharacterSheetId:
          noteType === "character" && linkedCharacterSheetId
            ? linkedCharacterSheetId
            : null,
        aliases: parsedAliases,
        ignoredAliases,
        content: combinedContent,
        sections,
        relatedNoteIds,
        file
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await handleSubmitInternal();
    onClose();
  };

  const handleNavigateToCard = async (targetNote) => {
    if (!targetNote || targetNote.id === note?.id) return;
    if (title.trim()) {
      await handleSubmitInternal();
    }
    onOpenNote?.(targetNote);
  };

  const candidateCardsToLink = useMemo(() => {
    const q = linkFilterText.trim().toLowerCase();
    return accessibleNotes.filter((n) => {
      if (n.id === note?.id) return false;
      if (!q) return true;
      const matchTitle = (n.title || "").toLowerCase().includes(q);
      const matchAlias = (n.aliases || []).some((a) =>
        a.toLowerCase().includes(q)
      );
      return matchTitle || matchAlias;
    });
  }, [accessibleNotes, note?.id, linkFilterText]);

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 35, 0.76)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5000,
        padding: "16px"
      }}
    >
      <div
        className="cp-window"
        style={{
          width: "min(1080px, 94vw)",
          maxWidth: "1080px",
          height: "calc(100vh - 80px)",
          maxHeight: "calc(100vh - 80px)",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
            padding: "0 6px"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "18px" }}>
            {isEditing ? "EDITAR CARD DO DIÁRIO" : "NOVO CARD DO DIÁRIO"}
          </h2>

          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{
              padding: "3px 10px",
              fontSize: "12px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center"
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="cp-window-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: 1,
            minHeight: 0,
            overflowY: "auto"
          }}
        >
          {/* Linha 1: Nome, Tipo e Pasta */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 160px",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Nome
              </span>
              <input
                type="text"
                className="cp-input"
                placeholder="Título do Card"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Tipo
              </span>
              <select
                className="cp-input"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
                style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
              >
                {NOTE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.singular}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Pasta
              </span>
              <input
                type="text"
                list="cp-note-folders-datalist"
                className="cp-input"
                placeholder="Ex: Geral, Ato 1..."
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
              />
              <datalist id="cp-note-folders-datalist">
                {availableFoldersForType.map((fName) => (
                  <option key={fName} value={fName} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Vínculo com Ficha (apenas se for Personagem) */}
          {noteType === "character" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Vínculo com Ficha
              </span>
              <select
                className="cp-input"
                value={linkedCharacterSheetId}
                onChange={(e) => setLinkedCharacterSheetId(e.target.value)}
                style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
              >
                <option value="">Sem vínculo direto com ficha</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    Ficha: {c.name} ({c.type === "npc" ? "NPC" : "Player"})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Linha 2: Aliases e Imagem */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px",
              gap: "8px",
              alignItems: "flex-end"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Aliases
              </span>
              <input
                type="text"
                className="cp-input"
                placeholder="Separados por vírgula (ex: Vilão, Carlos)"
                value={aliasesText}
                onChange={(e) => setAliasesText(e.target.value)}
                style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}
              >
                Imagem
              </span>
              <label
                className="cp-btn"
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  height: "30px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {file ? file.name.slice(0, 16) : "Imagem"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          {/* Barra de Ações do Documento (Vincular Card, Acesso, Clonar e Modo de Exibição) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "6px",
              background: "#02529c",
              padding: "5px 8px",
              borderRadius: "8px",
              marginTop: "2px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              {Boolean(selectedText && selectedText.trim().length >= 2) && (
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center",
                    fontWeight: 800
                  }}
                  onClick={handleOpenLinkingModal}
                >
                  📎 Vincular card ("{selectedText.slice(0, 16)}...")
                </button>
              )}

              {isEditing && note?.linkedCharacterSheetId && onOpenCharacterSheet && (
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center",
                    fontWeight: 800
                  }}
                  onClick={() => onOpenCharacterSheet(note.linkedCharacterSheetId)}
                >
                  🐧 Abrir Ficha
                </button>
              )}

              {isEditing && (
                <>
                  <button
                    type="button"
                    className={`cp-btn ${showSharePanel ? "cp-btn-gold" : "cp-btn-epf"}`}
                    style={{
                      padding: "3px 8px",
                      fontSize: "11px",
                      height: "26px",
                      display: "inline-flex",
                      alignItems: "center",
                      whiteSpace: "nowrap",
                      flexShrink: 0
                    }}
                    onClick={() => setShowSharePanel((prev) => !prev)}
                  >
                    👁️ Acesso{sharedCount > 0 ? ` (${sharedCount})` : ""}
                  </button>

                  {onCloneToTarget && (
                    <select
                      className="cp-input"
                      style={{
                        width: "auto",
                        height: "26px",
                        padding: "2px 8px",
                        fontSize: "11px",
                        fontWeight: 800
                      }}
                      value={cloneTarget}
                      onChange={(e) => handleCloneAction(e.target.value)}
                    >
                      <option value="">
                        {justCloned ? "✓ Clonado!" : "📑 Clonar Card..."}
                      </option>
                      {note?.scope !== "player" && (
                        <option value="my_diary">→ Para Meu Diário</option>
                      )}
                      {note?.scope !== "party" && (
                        <option value="party">→ Para Diário do Grupo</option>
                      )}
                      {isGM && note?.scope !== "gm" && (
                        <option value="gm">→ Para Diário do Mestre</option>
                      )}
                      {isGM &&
                        (playersList || []).map((p) => (
                          <option key={p.uid} value={`player:${p.uid}`}>
                            → Para Diário: {p.displayName}
                          </option>
                        ))}
                    </select>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                className={`cp-btn ${editorMode === "interactive" ? "cp-btn-gold" : ""}`}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  height: "26px",
                  display: "inline-flex",
                  alignItems: "center"
                }}
                onClick={() => setEditorMode("interactive")}
              >
                Visualizar
              </button>
              <button
                type="button"
                className={`cp-btn ${editorMode === "edit" ? "cp-btn-gold" : ""}`}
                style={{
                  padding: "3px 8px",
                  fontSize: "11px",
                  height: "26px",
                  display: "inline-flex",
                  alignItems: "center"
                }}
                onClick={() => setEditorMode("edit")}
              >
                Editar
              </button>
            </div>
          </div>

          {/* Painel Expansível de Gestão de Acessos (Disponibilizar) dentro do Card */}
          {isEditing && showSharePanel && (
            <div
              style={{
                background: "rgba(0, 27, 58, 0.06)",
                border: "1.5px solid var(--cp-blue-border)",
                borderRadius: "8px",
                padding: "6px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#001b3a"
                }}
              >
                <span>ACESSOS CONCEDIDOS</span>
                <button
                  type="button"
                  onClick={() => setShowSharePanel(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: "11px",
                    color: "#001b3a"
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {isSharedWithParty && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#02529c",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "6px"
                    }}
                  >
                    👥 Grupo
                    {isGM && (
                      <button
                        type="button"
                        title="Remover acesso do grupo"
                        onClick={() => onRevokeNoteAccess?.(note.id, "party")}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ff8a80",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: "11px",
                          padding: "0 2px"
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                )}

                {sharedPlayers.map((p) => (
                  <span
                    key={p.uid}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#2e7d32",
                      color: "#ffffff",
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "6px"
                    }}
                  >
                    👤 {p.displayName}
                    {isGM && (
                      <button
                        type="button"
                        title={`Remover acesso de ${p.displayName}`}
                        onClick={() => onRevokeNoteAccess?.(note.id, p.uid)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ff8a80",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: "11px",
                          padding: "0 2px"
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}

                {!isSharedWithParty && sharedPlayers.length === 0 && (
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    Apenas proprietário e mestre
                  </span>
                )}
              </div>

              <select
                className="cp-input"
                style={{
                  padding: "3px 6px",
                  fontSize: "10px",
                  fontWeight: 800,
                  height: "26px"
                }}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    onShareNoteWithTarget?.(note.id, e.target.value);
                  }
                }}
              >
                <option value="">+ Disponibilizar para...</option>
                {!isSharedWithParty && (
                  <option value="party">👥 Grupo (Todos)</option>
                )}
                {availablePlayersToShare.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    👤 {p.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Área de Conteúdo: Vários Blocos com Títulos Personalizáveis */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              flex: 1,
              minHeight: "180px"
            }}
          >
            {editorMode === "interactive" ? (
              <div
                onMouseUp={handleCaptureSelection}
                onKeyUp={handleCaptureSelection}
                style={{
                  flex: 1,
                  minHeight: "220px",
                  overflowY: "auto",
                  paddingRight: "4px",
                  userSelect: "text",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                {sections.map((sec, secIdx) => {
                  const secTokens = parseTextWithAliases(
                    sec.content || "",
                    accessibleNotes,
                    note?.id || null,
                    ignoredAliases
                  );

                  return (
                    <div
                      key={sec.id || secIdx}
                      style={{
                        background: "#ffffff",
                        border: "2px solid #001b3a",
                        borderRadius: "10px",
                        padding: "8px 12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: "0 2px 4px rgba(0, 27, 58, 0.08)"
                      }}
                    >
                      {sec.title?.trim() ? (
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 900,
                            color: "#001b3a",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            paddingBottom: "4px",
                            borderBottom: "1.5px solid #e2e8f0",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "2px",
                              background: "#02529c"
                            }}
                          />
                          {sec.title.trim()}
                        </div>
                      ) : null}

                      {/* Bloco de conteúdo: padrão de 5 linhas, expandindo até 10 linhas e scroll além disso */}
                      <div
                        style={{
                          fontSize: "13px",
                          lineHeight: "1.5",
                          minHeight: "7.5em", // 5 linhas padrão
                          maxHeight: "15em",  // até 10 linhas expansível
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          color: "#1e293b",
                          paddingRight: "4px"
                        }}
                      >
                        {sec.content?.trim() ? (
                          secTokens.map((token, tokenIdx) => {
                            if (token.type === "link") {
                              return (
                                <LinkedCardSpan
                                  key={`${token.note.id}_${secIdx}_${tokenIdx}`}
                                  tokenText={token.text}
                                  matchedNote={token.note}
                                  term={token.term}
                                  onOpenCard={handleNavigateToCard}
                                  onNegateLink={handleNegateLink}
                                />
                              );
                            }
                            return <span key={tokenIdx}>{token.text}</span>;
                          })
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>
                            (Bloco vazio)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  flex: 1,
                  overflowY: "auto",
                  paddingRight: "2px"
                }}
              >
                {sections.map((sec, index) => (
                  <div
                    key={sec.id || index}
                    style={{
                      background: "#f8fafc",
                      border: "1.5px solid #001b3a",
                      borderRadius: "8px",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "8px"
                      }}
                    >
                      <input
                        type="text"
                        className="cp-input"
                        placeholder="Título do Bloco (ex: RESUMO, ATO 1...)"
                        value={sec.title || ""}
                        onChange={(e) =>
                          handleUpdateSectionTitle(sec.id, e.target.value)
                        }
                        style={{
                          height: "28px",
                          padding: "2px 8px",
                          fontSize: "11px",
                          fontWeight: 800,
                          flex: 1
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <button
                          type="button"
                          className="cp-btn"
                          style={{
                            padding: "2px 6px",
                            fontSize: "10px",
                            height: "26px",
                            display: "inline-flex",
                            alignItems: "center",
                            opacity: index === 0 ? 0.4 : 1,
                            cursor: index === 0 ? "not-allowed" : "pointer"
                          }}
                          disabled={index === 0}
                          onClick={() => handleMoveSection(index, -1)}
                          title="Mover para cima"
                        >
                          ▲
                        </button>

                        <button
                          type="button"
                          className="cp-btn"
                          style={{
                            padding: "2px 6px",
                            fontSize: "10px",
                            height: "26px",
                            display: "inline-flex",
                            alignItems: "center",
                            opacity: index === sections.length - 1 ? 0.4 : 1,
                            cursor:
                              index === sections.length - 1
                                ? "not-allowed"
                                : "pointer"
                          }}
                          disabled={index === sections.length - 1}
                          onClick={() => handleMoveSection(index, 1)}
                          title="Mover para baixo"
                        >
                          ▼
                        </button>

                        {sections.length > 1 && (
                          <button
                            type="button"
                            className="cp-btn cp-btn-orange"
                            style={{
                              padding: "2px 6px",
                              fontSize: "10px",
                              height: "26px",
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                            onClick={() => handleDeleteSection(sec.id)}
                            title="Remover este bloco"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      className="cp-input"
                      style={{
                        minHeight: "100px",
                        resize: "vertical",
                        lineHeight: 1.5,
                        fontSize: "12px",
                        padding: "6px 8px"
                      }}
                      placeholder="Conteúdo deste bloco..."
                      value={sec.content || ""}
                      onSelect={handleCaptureSelection}
                      onChange={(e) =>
                        handleUpdateSectionContent(sec.id, e.target.value)
                      }
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="cp-btn cp-btn-epf"
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    height: "28px",
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    fontWeight: 800
                  }}
                  onClick={handleAddSection}
                >
                  + Adicionar Bloco
                </button>
              </div>
            )}
          </div>

          {/* Rodapé: Botões mais finos no padrão do de Imagem */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
              paddingTop: "6px",
              borderTop: "1.5px solid #cbd5e1"
            }}
          >
            {isEditing && onDelete ? (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{
                  padding: "4px 14px",
                  fontSize: "12px",
                  height: "30px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center"
                }}
                onClick={async () => {
                  await onDelete(note.id);
                  onClose();
                }}
              >
                Excluir
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="cp-btn"
                style={{
                  padding: "4px 14px",
                  fontSize: "12px",
                  height: "30px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center"
                }}
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="cp-btn cp-btn-gold"
                style={{
                  padding: "4px 14px",
                  fontSize: "12px",
                  height: "30px",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center"
                }}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar Card"}
              </button>
            </div>
          </div>
        </form>

        {/* Modal Popover para vincular seleção a um Card */}
        {linkingModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 15, 35, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 6000,
              padding: "16px"
            }}
            onClick={() => setLinkingModalOpen(false)}
          >
            <div
              className="cp-window"
              style={{
                width: "100%",
                maxWidth: "420px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span className="cp-title" style={{ fontSize: "16px" }}>
                  Vincular ao Card
                </span>
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{
                    padding: "2px 8px",
                    fontSize: "11px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center"
                  }}
                  onClick={() => setLinkingModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <input
                  type="text"
                  className="cp-input"
                  placeholder="Texto / Termo do vínculo..."
                  value={termToLink}
                  onChange={(e) => setTermToLink(e.target.value)}
                  style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
                />

                <input
                  type="text"
                  className="cp-input"
                  placeholder="Filtrar cards..."
                  value={linkFilterText}
                  onChange={(e) => setLinkFilterText(e.target.value)}
                  style={{ height: "30px", padding: "4px 8px", fontSize: "12px" }}
                  autoFocus
                />
              </div>

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px"
                }}
              >
                {candidateCardsToLink.map((cand) => {
                  const meta = getNoteTypeMeta(cand.noteType);
                  return (
                    <button
                      key={cand.id}
                      type="button"
                      onClick={() => handleLinkToCard(cand)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: "2px solid #001b3a",
                        background: "#ffffff",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span>{getNoteTypeIcon(cand.noteType)}</span>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "12px",
                            color: "#001b3a"
                          }}
                        >
                          {cand.title}
                        </span>
                      </div>
                      <span
                        style={{
                          background: meta.color,
                          color:
                            cand.noteType === "quest" ? "#001b3a" : "#ffffff",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: "4px"
                        }}
                      >
                        {meta.singular}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
