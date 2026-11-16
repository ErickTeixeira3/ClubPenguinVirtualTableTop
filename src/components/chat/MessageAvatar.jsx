import { useMediaUrl } from "../../hooks/useMediaUrl";

/**
 * Fase 5: avatar do remetente no chat, extraído de ChatSidebarPanel.jsx (conteúdo inalterado).
 */
export default function MessageAvatar({ msg, campaignId }) {
  // Fase 3.1 (V-08): mensagens de jogador referenciam a foto por senderAvatarMediaId (sem Base64)
  const isCharacterMessage = Boolean(msg.characterId || msg.characterMediaId);
  const { url } = useMediaUrl(
    isCharacterMessage ? msg.characterMediaId : msg.senderAvatarMediaId || null,
    msg.senderPhotoURL || null,
    campaignId
  );
  const resolvedUrl = msg.senderPhotoURL || url || null;

  if (resolvedUrl) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          objectFit: "cover"
        }}
      />
    );
  }

  const initial = (msg.senderName || "P").trim().slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "#02529c",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 800
      }}
    >
      {initial}
    </div>
  );
}
