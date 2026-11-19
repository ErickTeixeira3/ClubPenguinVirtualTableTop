import { TRIGGER_TYPES } from "../../engines/combatEngine";
import { buildShortcutRollParams } from "../../engines/rolls/shortcutResolver.js";
import { adaptMessageForLegacyChat } from "../../engines/chat/messageSelector.js";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import MessageAvatar from "./MessageAvatar";

/**
 * Fase 5: card de habilidade/perícia pingada no chat, extraído de ChatSidebarPanel.jsx (JSX inalterado).
 */
export default function SkillPingCard({
  msg: rawMessage,
  campaignId,
  allCharacters,
  canEditCharacter,
  onExecuteRoll
}) {
  const msg = adaptMessageForLegacyChat(rawMessage);
  const sk = msg.skillData;
  if (!sk) return null;
  const isSecret = msg.visibility && msg.visibility !== "public";
  const trigMeta = TRIGGER_TYPES.find((t) => t.id === (sk.trigger || "active"));
  const borderColor = sk.elementColor || "#02529c";
  const sourceCharacter = msg.sender?.characterId
    ? allCharacters.find((character) => character.id === msg.sender.characterId) || null
    : null;
  const canRollAsSource = Boolean(
    sourceCharacter &&
      (typeof canEditCharacter !== "function" || canEditCharacter(sourceCharacter))
  );

  return (
    <div
      key={msg.id}
      style={{
        background: isSecret ? "#0b192c" : "#ffffff",
        color: isSecret ? "#e2f1ff" : "var(--cp-text-dark)",
        border: `2.5px solid ${borderColor}`,
        borderRadius: "14px",
        padding: "8px 10px",
        boxShadow: `0 2px 0 ${borderColor}55, 0 3px 8px rgba(0,27,58,0.12)`,
        userSelect: "text"
      }}
    >
      {/* Topo: Emissor & Badge Skill */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          fontWeight: 800,
          color: isSecret ? "var(--epf-cyan-glow)" : "#02529c",
          marginBottom: "6px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MessageAvatar msg={msg} campaignId={campaignId} />
          <span>{msg.senderName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 900,
              padding: "1px 6px",
              borderRadius: "6px",
              background: `${borderColor}22`,
              color: borderColor,
              border: `1px solid ${borderColor}55`,
              textTransform: "uppercase"
            }}
          >
            Skill
          </span>
          {isSecret && <span style={{ color: "#f59e0b" }}>SECRETO</span>}
        </div>
      </div>

      {/* Título & Badges */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "15px",
          color: borderColor,
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          {sk.icon && (
            <div
              style={{
                width: "22px",
                height: "22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {renderCpFlashIcon(sk.icon, 20)}
            </div>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sk.name}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", flexShrink: 0 }}>
          {sk.range?.type && (
            <span
              style={{
                background: "#e0f2fe",
                color: "#0369a1",
                border: "1px solid #7dd3fc",
                fontSize: "9px",
                fontWeight: 800,
                padding: "0px 5px",
                borderRadius: "6px"
              }}
            >
              {sk.range.type === "self"
                ? "🎯 Próprio"
                : sk.range.type === "touch"
                ? "🎯 Toque"
                : `🎯 ${sk.range.distanceMeters || 9}m`}
            </span>
          )}
          {sk.aoe?.type && sk.aoe.type !== "single" && (
            <span
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                border: "1px solid #fca5a5",
                fontSize: "9px",
                fontWeight: 800,
                padding: "0px 5px",
                borderRadius: "6px"
              }}
            >
              {sk.aoe.type === "circle"
                ? `⭕ Raio ${sk.aoe.radiusMeters || 6}m`
                : `▲ Cone ${sk.aoe.radiusMeters || 9}m (${sk.aoe.coneAngleDeg || 45}°)`}
            </span>
          )}
          {sk.cost?.amount > 0 && (
            <span
              style={{
                background: "#02529c",
                color: "#ffffff",
                fontSize: "9px",
                fontWeight: 800,
                padding: "1px 5px",
                borderRadius: "8px"
              }}
            >
              {sk.cost.amount} {(sk.cost.resource || "mp").toUpperCase()}
            </span>
          )}
          {sk.trigger && sk.trigger !== "active" && (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #f59e0b",
                fontSize: "9px",
                fontWeight: 800,
                padding: "0px 5px",
                borderRadius: "6px"
              }}
            >
              {trigMeta?.label || sk.trigger}
            </span>
          )}
        </div>
      </div>

      {/* Macros / Fórmulas */}
      {(sk.hitFormula || sk.effectFormula || sk.savingThrow?.enabled) && (
        <div
          style={{
            background: isSecret ? "rgba(0,0,0,0.35)" : "#f8fafc",
            border: "1.5px solid #cbd5e1",
            borderRadius: "8px",
            padding: "6px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "11px",
            marginBottom: "6px"
          }}
        >
          {sk.hitFormula && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <strong style={{ color: "#013567" }}>Acerto:</strong>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{sk.hitFormula}</span>
            </div>
          )}
          {sk.effectFormula && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <strong style={{ color: "#b71c1c" }}>Dano / Efeito:</strong>
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{sk.effectFormula}</span>
            </div>
          )}
          {sk.savingThrow?.enabled && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <strong style={{ color: "#7e22ce" }}>Resistência:</strong>
              <span style={{ fontWeight: 700, color: "#6b21a8" }}>
                CD {sk.savingThrow.dcFormula || 12} ({sk.savingThrow.attribute || "Resistência"})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Descrição */}
      {sk.description && (
        <div
          style={{
            fontSize: "12px",
            lineHeight: "1.4",
            color: isSecret ? "#e2f1ff" : "#334155",
            marginBottom: "6px",
            whiteSpace: "pre-wrap"
          }}
        >
          {sk.description}
        </div>
      )}

      {/* Botão Rolar */}
      {(sk.hitFormula || sk.effectFormula) && (
        <button
          type="button"
          disabled={!canRollAsSource}
          onClick={() => {
            if (!canRollAsSource) return;
            const rollParams = buildShortcutRollParams(
              {
                ...sk,
                color: sk.elementColor,
                rollKind: sk.rollKind || null
              },
              sourceCharacter
            );
            onExecuteRoll?.({
              ...rollParams,
              // FUN-05: trigger é metadado explícito e não pode se perder no card.
              trigger: sk.trigger || "active",
              visibility: msg.visibility || "public"
            });
          }}
          style={{
            width: "100%",
            height: "28px",
            borderRadius: "8px",
            border: "1.5px solid #002b55",
            background: "linear-gradient(180deg, #ffc83b 0%, #e69500 100%)",
            color: "#001b3a",
            fontWeight: 900,
            fontSize: "11px",
            cursor: canRollAsSource ? "pointer" : "not-allowed",
            opacity: canRollAsSource ? 1 : 0.55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            boxShadow: "0 2px 0 #995c00"
          }}
        >
          🎲 Rolar
        </button>
      )}
    </div>
  );
}
