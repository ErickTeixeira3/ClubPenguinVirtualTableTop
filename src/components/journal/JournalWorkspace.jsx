import { useMemo, useState } from "react";
import {
  NOTE_TYPES,
  detectAliasMentionsInText,
  parseTextWithAliases,
  getNoteTypeMeta
} from "../../engines/aliasEngine";
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

function JournalCardItem({
  note,
  campaignId,
  accessibleNotesMap,
  accessibleNotes,
  isGM,
  currentUserId,
  playersList,
  onEdit,
  onCloneToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onOpenCharacterSheet
}) {
  const { url: imageUrl } = useMediaUrl(note.imageMediaId, null, campaignId);
  const [imageError, setImageError] = useState(false);
  const [cloneTarget, setCloneTarget] = useState("");
  const [justCloned, setJustCloned] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);

  const meta = getNoteTypeMeta(note.noteType);

  // Verificação de permissões e acessos concedidos
  const isSharedWithParty =
    note.scope === "party" ||
    (Array.isArray(note.visibleTo) && note.visibleTo.includes("ALL"));

  const visibleUids = useMemo(() => {
    return (Array.isArray(note.visibleTo) ? note.visibleTo : []).filter(
      (id) => id !== "ALL"
    );
  }, [note.visibleTo]);

  const sharedPlayers = useMemo(() => {
    return (playersList || []).filter(
      (p) => visibleUids.includes(p.uid) && p.uid !== note.ownerId
    );
  }, [playersList, visibleUids, note.ownerId]);

  const availablePlayersToShare = useMemo(() => {
    return (playersList || []).filter(
      (p) => !visibleUids.includes(p.uid) && p.uid !== note.ownerId
    );
  }, [playersList, visibleUids, note.ownerId]);

  const sharedCount = (isSharedWithParty ? 1 : 0) + sharedPlayers.length;

  const allLinkedNotes = useMemo(() => {
    const explicitIds = Array.isArray(note.relatedNoteIds)
      ? note.relatedNoteIds
      : [];
    const liveIds = detectAliasMentionsInText(
      note.content,
      accessibleNotes,
      note.id
    ).mentionedNoteIds;
    const savedIds = Array.isArray(note.mentionedNoteIds)
      ? note.mentionedNoteIds
      : [];

    const combined = Array.from(
      new Set([...explicitIds, ...liveIds, ...savedIds])
    );

    return combined
      .map((id) => accessibleNotesMap.get(id))
      .filter(Boolean);
  }, [
    note.relatedNoteIds,
    note.content,
    note.id,
    note.mentionedNoteIds,
    accessibleNotes,
    accessibleNotesMap
  ]);

  const previewTokens = useMemo(() => {
    return parseTextWithAliases(
      note.content,
      accessibleNotes,
      note.id,
      note.ignoredAliases
    );
  }, [note.content, accessibleNotes, note.id, note.ignoredAliases]);

  const handleCloneAction = async (targetValue) => {
    if (!targetValue || !onCloneToTarget) return;

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

  return (
    <div
      style={{
        background: "#ffffff",
        border: "2.5px solid #001b3a",
        borderTop: `6px solid ${meta.color}`,
        borderRadius: "14px",
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        boxShadow: "0 3px 0 rgba(0, 27, 58, 0.2)"
      }}
    >
      {/* Imagem do Card ou Banner Emblemático Padrão */}
      {imageUrl && !imageError ? (
        <img
          src={imageUrl}
          alt=""
          onError={() => setImageError(true)}
          style={{
            width: "100%",
            height: "110px",
            objectFit: "cover",
            borderRadius: "8px",
            border: "2px solid #001b3a"
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "80px",
            borderRadius: "8px",
            border: "2px solid #001b3a",
            background: `linear-gradient(135deg, #012b54 0%, ${meta.color}55 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.35)"
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "#ffffff",
              border: `2px solid ${meta.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.25)"
            }}
          >
            {getNoteTypeIcon(note.noteType)}
          </div>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              textShadow: "0 1px 2px #000000"
            }}
          >
            {meta.singular}
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "6px"
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "14px",
            color: "#001b3a",
            cursor: "pointer"
          }}
          onClick={() => onEdit(note)}
        >
          {note.title}
        </div>

        <span
          style={{
            fontSize: "9px",
            fontWeight: 800,
            padding: "2px 6px",
            borderRadius: "999px",
            background:
              note.scope === "gm"
                ? "#1a202c"
                : note.scope === "party"
                ? "#02529c"
                : "#38c172",
            color: "#ffffff",
            whiteSpace: "nowrap"
          }}
        >
          {note.scope === "gm"
            ? "MESTRE"
            : note.scope === "party"
            ? "GRUPO"
            : "PLAYER"}
        </span>
      </div>

      {Array.isArray(note.aliases) && note.aliases.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {note.aliases.map((al) => (
            <span
              key={al}
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: "999px",
                background: "#e6f4ff",
                color: "#013567",
                border: "1px solid #3090f0"
              }}
            >
              {al}
            </span>
          ))}
        </div>
      )}

      {note.content && (
        <div
          style={{
            fontSize: "12px",
            color: "#1e293b",
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-wrap",
            lineHeight: 1.35
          }}
        >
          {previewTokens.map((token, index) => {
            if (token.type === "link") {
              const linkMeta = getNoteTypeMeta(token.note?.noteType);
              return (
                <span
                  key={`${token.note.id}_${index}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(token.note);
                  }}
                  title={`Abrir card: ${token.note?.title}`}
                  style={{
                    background: `${linkMeta.color}26`,
                    borderBottom: `2px solid ${linkMeta.color}`,
                    color: "#001b3a",
                    fontWeight: 800,
                    padding: "0 4px",
                    borderRadius: "3px",
                    cursor: "pointer"
                  }}
                >
                  {token.text}
                </span>
              );
            }
            return <span key={index}>{token.text}</span>;
          })}
        </div>
      )}

      {allLinkedNotes.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px",
            paddingTop: "4px",
            borderTop: "1px dashed #cbd5e1"
          }}
        >
          {allLinkedNotes.map((linked) => {
            const linkedMeta = getNoteTypeMeta(linked.noteType);
            return (
              <button
                key={linked.id}
                type="button"
                onClick={() => onEdit(linked)}
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: "999px",
                  border: "1.5px solid #001b3a",
                  background: linkedMeta.color,
                  color: linked.noteType === "quest" ? "#001b3a" : "#ffffff",
                  cursor: "pointer"
                }}
              >
                🔗 {linked.title}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "4px",
          marginTop: "4px"
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className="cp-btn"
            style={{ padding: "3px 8px", fontSize: "11px" }}
            onClick={() => onEdit(note)}
          >
            Abrir
          </button>

          {note.linkedCharacterSheetId && onOpenCharacterSheet && (
            <button
              type="button"
              className="cp-btn cp-btn-gold"
              style={{ padding: "3px 8px", fontSize: "11px" }}
              onClick={() => onOpenCharacterSheet(note.linkedCharacterSheetId)}
            >
              Ficha
            </button>
          )}

          <button
            type="button"
            className={`cp-btn ${showSharePanel ? "cp-btn-gold" : "cp-btn-epf"}`}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              whiteSpace: "nowrap",
              flexShrink: 0
            }}
            onClick={() => setShowSharePanel((prev) => !prev)}
            title="Disponibilizar acesso para outros jogadores"
          >
            👁️ Acesso{sharedCount > 0 ? ` (${sharedCount})` : ""}
          </button>
        </div>

        {/* Seletor separado especificamente para CLONAR */}
        <select
          className="cp-input"
          style={{
            width: "auto",
            maxWidth: "135px",
            padding: "3px 6px",
            fontSize: "10px",
            fontWeight: 800
          }}
          value={cloneTarget}
          onChange={(e) => handleCloneAction(e.target.value)}
        >
          <option value="">
            {justCloned ? "✓ Clonado!" : "📑 Clonar Card..."}
          </option>
          {note.scope !== "player" && (
            <option value="my_diary">→ Para Meu Diário</option>
          )}
          {note.scope !== "party" && (
            <option value="party">→ Para Diário do Grupo</option>
          )}
          {isGM && note.scope !== "gm" && (
            <option value="gm">→ Para Diário do Mestre</option>
          )}
          {isGM &&
            (playersList || []).map((p) => (
              <option key={p.uid} value={`player:${p.uid}`}>
                → Para Diário: {p.displayName}
              </option>
            ))}
        </select>
      </div>

      {/* Painel Expansível de Gestão de Acessos (Disponibilizar) */}
      {showSharePanel && (
        <div
          style={{
            background: "rgba(0, 27, 58, 0.05)",
            border: "1.5px solid var(--cp-blue-border)",
            borderRadius: "8px",
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "2px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#001b3a" }}>
              Disponibilizado para:
            </span>
            <button
              type="button"
              onClick={() => setShowSharePanel(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: "11px",
                color: "#64748b"
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
              fontWeight: 800
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
  onCreateNote,
  onUpdateNote,
  onUpdateNodePosition,
  onCloneNoteToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onDeleteNote,
  onOpenCharacterSheet
}) {
  const [activeScopeTab, setActiveScopeTab] = useState(
    isGM ? "gm" : "player"
  ); // 'gm' | 'player' | 'party' | 'unified'
  const [selectedPlayerUid, setSelectedPlayerUid] = useState(currentUserId);
  const [viewMode, setViewMode] = useState("kanban"); // 'kanban' | 'web'
  const [searchQuery, setSearchQuery] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const [creatingNote, setCreatingNote] = useState(false);

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

  const accessibleNotesMap = useMemo(() => {
    const map = new Map();
    accessibleNotes.forEach((n) => map.set(n.id, n));
    return map;
  }, [accessibleNotes]);

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
    if (formData.id) {
      await onUpdateNote(
        formData.id,
        {
          title: formData.title,
          noteType: formData.noteType,
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
        padding: "12px 16px 82px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: 12
      }}
    >
      {/* Barra de Controle dos Diários */}
      <div
        className="cp-window"
        style={{
          padding: "8px 12px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          {isGM && (
            <button
              type="button"
              className={`cp-btn ${
                activeScopeTab === "gm" ? "cp-btn-gold" : ""
              }`}
              style={{ padding: "6px 12px", fontSize: "12px" }}
              onClick={() => setActiveScopeTab("gm")}
            >
              Diário do Mestre
            </button>
          )}

          <button
            type="button"
            className={`cp-btn ${
              activeScopeTab === "player" ? "cp-btn-gold" : ""
            }`}
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => setActiveScopeTab("player")}
          >
            {isGM ? "Diário de Player" : "Meu Diário"}
          </button>

          {isGM && activeScopeTab === "player" && (
            <select
              className="cp-input"
              style={{ width: "auto", padding: "5px 10px", fontSize: "12px" }}
              value={selectedPlayerUid}
              onChange={(e) => setSelectedPlayerUid(e.target.value)}
            >
              {playersList.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            className={`cp-btn ${
              activeScopeTab === "party" ? "cp-btn-gold" : ""
            }`}
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => setActiveScopeTab("party")}
          >
            Diário do Grupo
          </button>

          <button
            type="button"
            className={`cp-btn ${
              activeScopeTab === "unified" ? "cp-btn-gold" : ""
            }`}
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => setActiveScopeTab("unified")}
          >
            Todos Visíveis ({accessibleNotes.length})
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <input
            type="text"
            className="cp-input"
            style={{ width: "200px", padding: "6px 10px", fontSize: "12px" }}
            placeholder="Buscar título ou alias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <button
            type="button"
            className={`cp-btn ${viewMode === "kanban" ? "cp-btn-gold" : ""}`}
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => setViewMode("kanban")}
          >
            Kanban
          </button>

          <button
            type="button"
            className={`cp-btn cp-btn-epf ${
              viewMode === "web" ? "active" : ""
            }`}
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={() => setViewMode("web")}
          >
            Visão de Teia
          </button>

          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{ padding: "6px 14px", fontSize: "12px" }}
            onClick={() => setCreatingNote(true)}
          >
            + Novo Card
          </button>
        </div>
      </div>

      {/* Área Principal: Kanban ou Visão de Teia */}
      {viewMode === "kanban" ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(220px, 1fr))",
            gap: "10px",
            overflowX: "auto",
            overflowY: "hidden"
          }}
        >
          {NOTE_TYPES.map((typeMeta) => {
            const colNotes = scopedNotes.filter(
              (n) => (n.noteType || "lore") === typeMeta.key
            );

            return (
              <div
                key={typeMeta.key}
                className="cp-window"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  height: "100%",
                  padding: "8px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px",
                    marginBottom: "6px",
                    borderRadius: "10px",
                    background: typeMeta.color,
                    color: typeMeta.key === "quest" ? "#001b3a" : "#ffffff",
                    border: "2px solid #001b3a",
                    fontWeight: 800,
                    fontSize: "13px"
                  }}
                >
                  <span>{typeMeta.label.toUpperCase()}</span>
                  <span>{colNotes.length}</span>
                </div>

                <div
                  className="cp-window-inner"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "8px"
                  }}
                >
                  {colNotes.map((note) => (
                    <JournalCardItem
                      key={note.id}
                      note={note}
                      campaignId={campaignId}
                      accessibleNotesMap={accessibleNotesMap}
                      accessibleNotes={accessibleNotes}
                      isGM={isGM}
                      currentUserId={currentUserId}
                      playersList={playersList}
                      onEdit={(n) => setEditingNote(n)}
                      onCloneToTarget={onCloneNoteToTarget}
                      onShareNoteWithTarget={onShareNoteWithTarget}
                      onRevokeNoteAccess={onRevokeNoteAccess}
                      onOpenCharacterSheet={onOpenCharacterSheet}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <JournalGraphWebView
          notes={scopedNotes}
          onSelectNoteToEdit={(n) => setEditingNote(n)}
          onOpenCharacterSheet={onOpenCharacterSheet}
          onUpdateNodePosition={onUpdateNodePosition}
        />
      )}

      {(creatingNote || editingNote) && (
        <NoteEditorModal
          key={editingNote?.id || "new_note"}
          note={currentModalNote}
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
          accessibleNotes={accessibleNotes}
          characters={characters}
          onSave={handleSaveNote}
          onDelete={onDeleteNote}
          onOpenNote={(targetNote) => {
            setCreatingNote(false);
            setEditingNote(targetNote);
          }}
          onUpdateTargetNote={(targetId, updates) => onUpdateNote(targetId, updates)}
          onClose={() => {
            setCreatingNote(false);
            setEditingNote(null);
          }}
        />
      )}
    </div>
  );
}

