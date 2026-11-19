import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Z_LAYERS } from "../../constants/zLayers";
import { useOptionalRuntimeConfig } from "../../contexts/RuntimeConfigContext.js";
import { NOTE_SCOPES, NOTE_TYPES } from "../../domain/constants.js";
import {
  canDeleteResource,
  canEditResource,
  canManageResourceAccess
} from "../../domain/permissions.js";
import { getFolderDisplayPath } from "../../engines/folders/index.js";
import { useNotifications } from "../../hooks/useNotifications";
import ConfirmDialog from "../ui/ConfirmDialog";
import LinkCardDialog from "./LinkCardDialog";
import NoteCloneSelect from "./NoteCloneSelect";
import NoteInteractiveView from "./NoteInteractiveView";
import NoteMetaFields from "./NoteMetaFields";
import NoteSectionsEditor from "./NoteSectionsEditor";
import NoteSharePanel from "./NoteSharePanel";
import { applyPendingAliasesToNotes, useNoteDraft } from "./useNoteDraft";

function NoteEditorModalContent({
  note = null,
  defaultScope = NOTE_SCOPES.PARTY,
  defaultOwnerId = null,
  isGM = false,
  currentUserId = null,
  playersList = [],
  accessibleNotes = [],
  accessibleFolders = [],
  characters = [],
  canDeleteNote = null,
  onSave,
  onDelete,
  onOpenNote,
  onCloneToTarget,
  onShareNoteWithTarget,
  onRevokeNoteAccess,
  onOpenCharacterSheet,
  onClose
}) {
  const { notifyError } = useNotifications();
  const runtimeConfig = useOptionalRuntimeConfig();
  const registerUnsavedGuard = runtimeConfig?.registerUnsavedGuard;

  const isEditing = Boolean(note?.id);
  const canEdit =
    !isEditing || canEditResource(note, { uid: currentUserId, isGM });
  const canDelete =
    isEditing &&
    Boolean(onDelete) &&
    (typeof canDeleteNote === "function"
      ? Boolean(canDeleteNote(note))
      : canDeleteResource(note, {
          uid: currentUserId,
          isGM,
          entityType: "note"
        }));
  const canManageAccess =
    isEditing &&
    canManageResourceAccess(note, {
      uid: currentUserId,
      isGM,
      entityType: "note"
    });

  const {
    draft,
    hasInitialContent,
    buildPayload,
    setTitle,
    setNoteType,
    setFolderId,
    setLinkedCharacterId,
    setAliasesText,
    setFile,
    addSection,
    deleteSection,
    updateSectionTitle,
    updateSectionContent,
    moveSection,
    stageCardLink,
    negateLink,
    markSaved,
    resetDraft
  } = useNoteDraft({
    note,
    defaultScope,
    defaultOwnerId,
    accessibleFolders
  });

  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = draft.isDirty;
  }, [draft.isDirty]);

  useEffect(() => {
    if (typeof registerUnsavedGuard !== "function") return undefined;
    return registerUnsavedGuard({
      hasUnsavedChanges: () => isDirtyRef.current
    });
  }, [registerUnsavedGuard]);

  const [showSharePanel, setShowSharePanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editorMode, setEditorMode] = useState(
    !canEdit || hasInitialContent ? "interactive" : "edit"
  );
  const [selectedText, setSelectedText] = useState("");
  const [linkingModalOpen, setLinkingModalOpen] = useState(false);
  const [termToLink, setTermToLink] = useState("");
  const [linkFilterText, setLinkFilterText] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingNavigationNote, setPendingNavigationNote] = useState(null);

  const isSharedWithParty =
    note?.scope === NOTE_SCOPES.PARTY ||
    (Array.isArray(note?.visibleTo) && note.visibleTo.includes("ALL"));

  const visibleUids = useMemo(() => {
    const list = note?.visibleTo;
    return (Array.isArray(list) ? list : []).filter((id) => id !== "ALL");
  }, [note]);

  const sharedPlayers = useMemo(
    () =>
      (playersList || []).filter(
        (p) => visibleUids.includes(p.uid) && p.uid !== note?.ownerId
      ),
    [playersList, visibleUids, note?.ownerId]
  );

  const availablePlayersToShare = useMemo(
    () =>
      (playersList || []).filter(
        (p) => !visibleUids.includes(p.uid) && p.uid !== note?.ownerId
      ),
    [playersList, visibleUids, note?.ownerId]
  );

  const sharedCount = (isSharedWithParty ? 1 : 0) + sharedPlayers.length;

  const effectiveScope = note?.scope || defaultScope;
  const effectiveOwnerId = note?.ownerId || defaultOwnerId;

  const availableFoldersForType = useMemo(() => {
    const compatible = (accessibleFolders || []).filter((f) => {
      if ((f.noteType || NOTE_TYPES.LORE) !== draft.noteType) return false;
      if (effectiveScope && f.scope && f.scope !== effectiveScope) return false;
      if (effectiveScope === NOTE_SCOPES.PLAYER && effectiveOwnerId) {
        return (f.ownerId || null) === effectiveOwnerId;
      }
      return true;
    });
    const byId = new Map(compatible.map((f) => [f.id, f]));
    return compatible
      .map((f) => ({
        id: f.id,
        label: getFolderDisplayPath(f.id, byId) || f.name || f.id
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [accessibleFolders, draft.noteType, effectiveScope, effectiveOwnerId]);

  const effectiveAccessibleNotes = useMemo(
    () =>
      applyPendingAliasesToNotes(
        accessibleNotes,
        draft.pendingTargetAliases
      ),
    [accessibleNotes, draft.pendingTargetAliases]
  );

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

  const handleConfirmLink = ({ targetCard, term, requiresAliasAddition }) => {
    stageCardLink({
      targetCardId: targetCard.id,
      term,
      requiresAliasAddition
    });
    setLinkingModalOpen(false);
    setSelectedText("");
  };

  const handleNegateLink = (_matchedNote, term) => {
    negateLink(term);
  };

  const handleSubmitInternal = async () => {
    if (saving) return false;
    if (isEditing && !canEdit) {
      setSaveError("Você não tem permissão para editar este card.");
      return false;
    }
    if (!draft.title.trim()) {
      setSaveError("O título do card é obrigatório.");
      return false;
    }

    setSaveError("");
    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await onSave(payload);
      if (res && res.ok === false) {
        setSaveError(res.error || "Não foi possível salvar este card.");
        return false;
      }
      markSaved();
      return true;
    } catch (err) {
      setSaveError(err?.message || "Erro ao salvar este card.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await handleSubmitInternal();
    if (ok) {
      onClose?.();
    }
  };

  const handleNavigateToCard = (targetNote) => {
    if (!targetNote || targetNote.id === note?.id) return;
    if (!canEdit || !draft.isDirty) {
      onOpenNote?.(targetNote);
      return;
    }
    setPendingNavigationNote(targetNote);
  };

  const handleConfirmSaveAndNavigate = async () => {
    const target = pendingNavigationNote;
    if (!target) return;
    const ok = await handleSubmitInternal();
    setPendingNavigationNote(null);
    if (ok) {
      onOpenNote?.(target);
    }
  };

  const handleConfirmDiscardAndNavigate = () => {
    const target = pendingNavigationNote;
    setPendingNavigationNote(null);
    resetDraft(note);
    if (target) {
      onOpenNote?.(target);
    }
  };

  const linkedCharacterId =
    note?.linkedCharacterId ?? note?.linkedCharacterSheetId ?? null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 15, 35, 0.76)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: Z_LAYERS.modalNoteEditor,
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
            {isEditing
              ? canEdit
                ? "EDITAR CARD DO DIÁRIO"
                : "CARD DO DIÁRIO"
              : "NOVO CARD DO DIÁRIO"}
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
          <NoteMetaFields
            title={draft.title}
            noteType={draft.noteType}
            folderId={draft.folderId}
            linkedCharacterId={draft.linkedCharacterId}
            aliasesText={draft.aliasesText}
            file={draft.file}
            canEdit={canEdit}
            availableFoldersForType={availableFoldersForType}
            characters={characters}
            onChangeTitle={setTitle}
            onChangeNoteType={setNoteType}
            onChangeFolderId={setFolderId}
            onChangeLinkedCharacterId={setLinkedCharacterId}
            onChangeAliasesText={setAliasesText}
            onChangeFile={setFile}
          />

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
              {canEdit && Boolean(selectedText && selectedText.trim().length >= 2) && (
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
                  📎 Vincular card (&quot;{selectedText.slice(0, 16)}...&quot;)
                </button>
              )}

              {isEditing && linkedCharacterId && onOpenCharacterSheet && (
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
                  onClick={() => onOpenCharacterSheet(linkedCharacterId)}
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

                  <NoteCloneSelect
                    note={note}
                    isGM={isGM}
                    currentUserId={currentUserId}
                    playersList={playersList}
                    onCloneToTarget={onCloneToTarget}
                  />
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
              {canEdit && (
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
              )}
            </div>
          </div>

          {isEditing && showSharePanel && (
            <NoteSharePanel
              note={note}
              isSharedWithParty={isSharedWithParty}
              sharedPlayers={sharedPlayers}
              availablePlayersToShare={availablePlayersToShare}
              canManageAccess={canManageAccess}
              onShareNoteWithTarget={onShareNoteWithTarget}
              onRevokeNoteAccess={onRevokeNoteAccess}
              onClose={() => setShowSharePanel(false)}
            />
          )}

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
              <NoteInteractiveView
                sections={draft.sectionsOrder}
                accessibleNotes={effectiveAccessibleNotes}
                currentNoteId={note?.id || null}
                ignoredAliases={draft.ignoredAliases}
                canEdit={canEdit}
                portalZIndex={Z_LAYERS.portalTooltip}
                onCaptureSelection={handleCaptureSelection}
                onOpenCard={handleNavigateToCard}
                onNegateLink={canEdit ? handleNegateLink : undefined}
              />
            ) : (
              <NoteSectionsEditor
                sections={draft.sectionsOrder}
                canEdit={canEdit}
                onUpdateTitle={updateSectionTitle}
                onUpdateContent={updateSectionContent}
                onMoveSection={moveSection}
                onDeleteSection={deleteSection}
                onAddSection={addSection}
                onCaptureSelection={handleCaptureSelection}
              />
            )}
          </div>

          {saveError && (
            <div
              role="alert"
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                background: "#fee2e2",
                border: "1.5px solid #ef4444",
                color: "#991b1b",
                fontSize: "12px",
                fontWeight: 700
              }}
            >
              {saveError}
            </div>
          )}

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
            {canDelete ? (
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
                onClick={() => setConfirmDeleteOpen(true)}
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
                {canEdit ? "Cancelar" : "Fechar"}
              </button>
              {canEdit && (
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
              )}
            </div>
          </div>
        </form>

        {linkingModalOpen && (
          <LinkCardDialog
            termToLink={termToLink}
            linkFilterText={linkFilterText}
            accessibleNotes={effectiveAccessibleNotes}
            currentNoteId={note?.id || null}
            canEditTargetNote={(cand) =>
              canEditResource(cand, { uid: currentUserId, isGM })
            }
            modalZIndex={Z_LAYERS.portalTooltip}
            onChangeTerm={setTermToLink}
            onChangeFilter={setLinkFilterText}
            onConfirmLink={handleConfirmLink}
            onError={notifyError}
            onClose={() => setLinkingModalOpen(false)}
          />
        )}

        {confirmDeleteOpen && (
          <ConfirmDialog
            title="Excluir Card?"
            question={`Deseja excluir o card "${note?.title || "Sem Título"}"?`}
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            confirmVariant="orange"
            zIndex={Z_LAYERS.portalTooltip}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={async () => {
              setConfirmDeleteOpen(false);
              await onDelete?.(note.id);
              onClose?.();
            }}
          />
        )}

        {pendingNavigationNote && (
          <ConfirmDialog
            title="Alterações não salvas"
            actions={[
              {
                key: "save",
                label: "Salvar",
                variant: "gold",
                onClick: handleConfirmSaveAndNavigate
              },
              {
                key: "discard",
                label: "Descartar",
                variant: "orange",
                onClick: handleConfirmDiscardAndNavigate
              }
            ]}
            cancelLabel="Cancelar"
            disabled={saving}
            zIndex={Z_LAYERS.portalTooltip}
            onCancel={() => setPendingNavigationNote(null)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

export default function NoteEditorModal(props) {
  const modalKey =
    props.note?.id ||
    `new_${props.note?.noteType || "lore"}_${props.note?.folderId || ""}`;
  return <NoteEditorModalContent key={modalKey} {...props} />;
}
