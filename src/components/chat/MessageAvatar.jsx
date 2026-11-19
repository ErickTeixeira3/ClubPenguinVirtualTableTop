import { useMediaUrl } from "../../hooks/useMediaUrl";
import { selectMessageView } from "../../engines/chat/messageSelector.js";

/**
 * Fase 5: avatar do remetente no chat, extraído de ChatSidebarPanel.jsx (conteúdo inalterado).
 */
export default function MessageAvatar({ msg, campaignId }) {
  const view = selectMessageView(msg);
  const { url } = useMediaUrl(
    view.sender.image?.mediaId || null,
    view.sender.image?.url || null,
    campaignId
  );
  const resolvedUrl = view.sender.image?.url || url || null;

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

  const initial = (view.sender.displayName || "P").trim().slice(0, 1).toUpperCase();
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
