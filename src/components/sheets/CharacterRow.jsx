import { useState } from "react";
import { canDeleteResource, canEditResource } from "../../domain/permissions.js";
import { useMediaUrl } from "../../hooks/useMediaUrl";

export default function CharacterRow({
  character,
  campaignId,
  isGM,
  canEditCharacter = null,
  canDeleteCharacter = null,
  currentUserId = null,
  onlineUsers = {},
  onOpenSheet,
  onOpenSpawnModal,
  onDeleteCharacter,
  onOpenMoveModal
}) {
  const canEdit =
    typeof canEditCharacter === "function"
      ? Boolean(canEditCharacter(character))
      : canEditResource(character, { uid: currentUserId, isGM });

  const canDelete =
    typeof canDeleteCharacter === "function"
      ? Boolean(canDeleteCharacter(character))
      : canDeleteResource(character, { uid: currentUserId, isGM });

  // Excluir, mover e arrastar a ficha pertencem ao dono ou ao Mestre (V-16 / D-3).
  const canManage = Boolean(
    isGM || (currentUserId && character?.ownerId === currentUserId)
  );

  const resolvedCampaignId = campaignId || character?.campaignId || "";
  const { url: avatarUrl } = useMediaUrl(
    character.avatar?.mediaId ??
      character.token?.image?.mediaId ??
      character.avatarMediaId ??
      character.defaultToken?.mediaId,
    character.avatar?.url ??
      character.token?.image?.url ??
      character.avatarExternalUrl ??
      character.defaultToken?.externalUrl,
    resolvedCampaignId || undefined
  );

  const [isHovered, setIsHovered] = useState(false);

  const handleOpenNewWindow = (e) => {
    e.stopPropagation();
    if (!resolvedCampaignId) return;
    const url = `${window.location.origin}${window.location.pathname}?campaignId=${encodeURIComponent(resolvedCampaignId)}&sheetId=${encodeURIComponent(character.id)}`;
    window.open(
      url,
      `cpvtt_sheet_${character.id}`,
      "width=1080,height=760,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  const isOnline = Boolean(character.ownerId && onlineUsers[character.ownerId]);

  return (
    <div
      draggable={canManage}
      onDragStart={(e) => {
        if (!canManage) return;
        e.dataTransfer.setData("text/character-id", character.id);
      }}
      onClick={() => onOpenSheet(character.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 8px",
        borderBottom: "1px solid #edf2f7",
        background: isHovered ? "#f7fafc" : "#ffffff",
        cursor: "pointer",
        transition: "background 0.15s ease",
        gap: "8px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#1a202c",
            border: `2px solid ${character.cardColor || "#2b6cb0"}`,
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={character.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#ffffff", fontSize: "12px", fontWeight: 800 }}>
              {(character.name || "P").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#1e293b",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {character.name}
          </div>
          {character.resources?.hp && (
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>
              HP {character.resources.hp.current}/{character.resources.hp.max}
            </div>
          )}
        </div>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {isHovered && (
          <>
            {onOpenSpawnModal && (isGM || canEdit) && (
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={() => onOpenSpawnModal(character)}
                title="Colocar Token no Mapa"
              >
                +Mapa
              </button>
            )}

            {resolvedCampaignId && (
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={handleOpenNewWindow}
                title="Abrir em Nova Janela"
              >
                ↗
              </button>
            )}

            {onOpenMoveModal && canManage && (
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={() => onOpenMoveModal(character)}
                title="Mover para pasta..."
              >
                📁
              </button>
            )}

            {(canManage || canDelete) && (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "2px 5px", fontSize: "10px" }}
                onClick={() => onDeleteCharacter(character.id)}
                title="Excluir Personagem"
              >
                ✕
              </button>
            )}
          </>
        )}

        <div
          title={isOnline ? "Online" : "Personagem Ativo"}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isOnline ? "#22c55e" : "#f59e0b",
            boxShadow: "0 0 4px rgba(245, 158, 11, 0.5)",
            flexShrink: 0
          }}
        />
      </div>
    </div>
  );
}
