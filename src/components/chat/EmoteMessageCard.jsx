import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import MessageAvatar from "./MessageAvatar";

/**
 * Fase 5: card de emote do chat, extraído de ChatSidebarPanel.jsx (JSX inalterado).
 */
export default function EmoteMessageCard({
  msg,
  isSecret,
  campaignId
}) {
  return (
    <div
      key={msg.id}
      style={{
        background: isSecret ? "#0b192c" : "#ffffff",
        color: isSecret ? "#e2f1ff" : "var(--cp-text-dark)",
        border: "2.5px solid var(--cp-blue-border)",
        borderRadius: "14px",
        padding: "8px 10px",
        boxShadow: "0 2px 0 rgba(0,27,58,0.2)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          fontWeight: 800,
          color: isSecret ? "var(--epf-cyan-glow)" : "#02529c",
          marginBottom: "4px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MessageAvatar msg={msg} campaignId={campaignId} />
          <span>{msg.senderName}</span>
        </div>
        {isSecret && <span>SECRETO</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "4px 0" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {renderCpFlashIcon(msg.icon, 34)}
        </div>
      </div>
    </div>
  );
}
