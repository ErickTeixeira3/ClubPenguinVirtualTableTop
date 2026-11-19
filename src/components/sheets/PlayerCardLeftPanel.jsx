import { useReducer } from "react";
import { CpCoinIcon, CpMemberBadge, CpStampIcon } from "./CpSheetBadges";
import {
  createInitialPlayerCardEditState,
  playerCardEditReducer
} from "./reducers/sheetFormReducers";
import { CARD_COLORS } from "./sheetConstants";
import DebouncedField from "../ui/DebouncedField";

function StatInlineEditor({
  icon,
  label,
  value,
  isEditing,
  draftValue,
  canEdit,
  editTitle,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel
}) {
  if (isEditing) {
    return (
      <form
        className="cp-playercard-stat-row"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(Math.max(0, Number(draftValue) || 0));
        }}
      >
        {icon}
        <span className="cp-stat-label">{label}</span>
        <input
          type="number"
          className="cp-stat-input"
          min={0}
          value={draftValue}
          autoFocus
          onChange={(e) => onChangeDraft(e.target.value)}
        />
        <button type="submit" className="cp-stat-save-btn">
          ✓
        </button>
        <button type="button" className="cp-stat-cancel-btn" onClick={onCancel}>
          ✕
        </button>
      </form>
    );
  }

  return (
    <div className="cp-playercard-stat-row">
      {icon}
      <span className="cp-stat-label">{label}</span>
      <span className="cp-stat-value">{value}</span>
      {canEdit && (
        <button
          type="button"
          className="cp-stat-edit-btn"
          onClick={onStartEdit}
          title={editTitle}
        >
          ✏️
        </button>
      )}
    </div>
  );
}

/**
 * Player Card clássico (lado esquerdo da Ficha): nível, nome, foto, moedas, XP e cor do cartão.
 */
export default function PlayerCardLeftPanel({
  cardBgColor,
  character,
  canEdit,
  onUpdateCharacter,
  onRenameCharacter = null,
  isStandaloneWindow,
  onClose,
  avatarUrl,
  onUploadCharacterImage,
  campaignId
}) {
  const [editState, dispatch] = useReducer(
    playerCardEditReducer,
    undefined,
    createInitialPlayerCardEditState
  );
  const coins = character.coins ?? 0;
  const safeCall = async (fn) => {
    try {
      return await fn();
    } catch {
      // Erro já notificado pelo hook
      return null;
    }
  };
  const xp = character.xp ?? 0;

  const handlePopoutWindow = () => {
    const cid = campaignId || character?.campaignId || "main-table";
    const url = `${window.location.origin}${window.location.pathname}?campaignId=${encodeURIComponent(cid)}&sheetId=${encodeURIComponent(character.id)}`;
    window.open(
      url,
      `cpvtt_sheet_${character.id}`,
      "width=1280,height=860,resizable=yes,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  return (
    <div
      className="cp-playercard-left"
      style={{
        background: `linear-gradient(180deg, ${cardBgColor} 0%, #004c82 85%, #002b4d 100%)`
      }}
    >
      {/* Notch superior do Club Penguin */}
      <div className="cp-playercard-notch">
        <div className="cp-playercard-notch-ridge" />
        <div className="cp-playercard-notch-ridge" />
        <div className="cp-playercard-notch-ridge" />
      </div>

      {/* Topo: Selo/Assinante, Nome do Pinguim e Botão Fechar */}
      <div className="cp-playercard-header">
        <CpMemberBadge level={character.level ?? 1} />

        <DebouncedField
          type="text"
          value={character.name || ""}
          disabled={!canEdit}
          onCommit={(value) =>
            safeCall(() =>
              onRenameCharacter
                ? onRenameCharacter(character.id, value)
                : onUpdateCharacter(character.id, { name: value })
            )
          }
          title={character.name || "Nome do Pinguim"}
          style={{
            background: "rgba(0, 27, 58, 0.35)",
            border: "1.5px solid rgba(255, 255, 255, 0.4)",
            borderRadius: "8px",
            color: "#ffffff",
            fontFamily: "var(--font-display)",
            fontSize: "16px",
            fontWeight: 800,
            padding: "2px 6px",
            flex: 1,
            minWidth: 0,
            textAlign: "center",
            outline: "none"
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {!isStandaloneWindow && (
            <button
              type="button"
              className="cp-btn cp-btn-gold"
              style={{
                width: "26px",
                height: "26px",
                padding: 0,
                fontSize: "11px",
                borderRadius: "50%"
              }}
              onClick={handlePopoutWindow}
              title="Abrir em Nova Janela"
            >
              ↗
            </button>
          )}

          {!isStandaloneWindow && onClose && (
            <button
              type="button"
              className="cp-playercard-close-btn"
              onClick={onClose}
              title="Fechar Ficha"
            >
              <div className="cp-playercard-close-inner">✕</div>
            </button>
          )}
        </div>
      </div>

      {/* Moldura da Foto / Avatar do Pinguim */}
      <div className="cp-playercard-photo-frame">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={character.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none"
            }}
          />
        ) : (
          <span className="cp-title" style={{ fontSize: "56px", opacity: 0.55 }}>
            {(character.name || "P").slice(0, 2).toUpperCase()}
          </span>
        )}

        {canEdit && (
          <label
            className="cp-btn"
            style={{
              position: "absolute",
              bottom: "8px",
              right: "8px",
              padding: "3px 8px",
              fontSize: "10px",
              background: "rgba(0, 27, 58, 0.75)",
              border: "1.5px solid #ffffff",
              boxShadow: "0 2px 5px rgba(0,0,0,0.4)"
            }}
            title="Trocar Foto"
          >
            📷 Foto
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) safeCall(() => onUploadCharacterImage(character.id, f, "avatar"));
              }}
            />
          </label>
        )}
      </div>

      {/* Rodapé: Moedas e XP */}
      <div className="cp-playercard-footer">
        <StatInlineEditor
          icon={<CpCoinIcon size={22} />}
          label="Total de Moedas:"
          value={coins}
          isEditing={editState.editingField === "coins"}
          draftValue={editState.draftValue}
          canEdit={canEdit}
          editTitle="Editar moedas"
          onStartEdit={() =>
            dispatch({ type: "START_EDIT", field: "coins", value: coins })
          }
          onChangeDraft={(value) => dispatch({ type: "SET_DRAFT", value })}
          onSave={(cleanVal) => {
            safeCall(() => onUpdateCharacter(character.id, { coins: cleanVal }));
            dispatch({ type: "CANCEL_EDIT" });
          }}
          onCancel={() => dispatch({ type: "CANCEL_EDIT" })}
        />

        <StatInlineEditor
          icon={<CpStampIcon size={22} />}
          label="Total de Experiência:"
          value={xp}
          isEditing={editState.editingField === "xp"}
          draftValue={editState.draftValue}
          canEdit={canEdit}
          editTitle="Editar XP"
          onStartEdit={() =>
            dispatch({ type: "START_EDIT", field: "xp", value: xp })
          }
          onChangeDraft={(value) => dispatch({ type: "SET_DRAFT", value })}
          onSave={(cleanVal) => {
            safeCall(() => onUpdateCharacter(character.id, { xp: cleanVal }));
            dispatch({ type: "CANCEL_EDIT" });
          }}
          onCancel={() => dispatch({ type: "CANCEL_EDIT" })}
        />

        {canEdit && (
          <div
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "4px"
            }}
          >
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => safeCall(() => onUpdateCharacter(character.id, { cardColor: c }))}
                style={{
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: c,
                  border:
                    cardBgColor === c ? "2px solid #ffffff" : "1px solid #001b3a",
                  cursor: "pointer",
                  padding: 0
                }}
                title={c}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
