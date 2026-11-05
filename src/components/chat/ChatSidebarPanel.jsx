import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

function MessageAvatar({ msg, campaignId }) {
  const { url } = useMediaUrl(msg.characterMediaId, null, campaignId);
  const resolvedUrl = msg.senderPhotoURL || url;

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

export default function ChatSidebarPanel({
  messages,
  campaignId,
  activeCharacter,
  characters = [],
  canEditCharacter,
  rollVisibility,
  onChangeRollVisibility,
  onSendText,
  onExecuteRoll,
  onDeleteMessage,
  isGM
}) {
  const { user } = useAuth();
  const { myPlayerProfile } = useCampaign();
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  // Fichas acessíveis para este jogador falar no chat
  const accessibleCharacters = useMemo(() => {
    if (!characters) return [];
    if (isGM) return characters;
    return characters.filter((c) => {
      if (typeof canEditCharacter === "function") {
        return canEditCharacter(c);
      }
      return c.ownerId === user?.uid;
    });
  }, [characters, isGM, canEditCharacter, user?.uid]);

  // Seletor de emissor: 'player' ou characterId
  const [selectedSpeakerId, setSelectedSpeakerId] = useState(
    () => (activeCharacter?.id ? activeCharacter.id : "player")
  );

  // Garante que se o personagem selecionado não existir mais, fala como player
  const speakAs = useMemo(() => {
    if (selectedSpeakerId === "player") return "player";
    const exists = accessibleCharacters.some((c) => c.id === selectedSpeakerId);
    return exists ? selectedSpeakerId : "player";
  }, [selectedSpeakerId, accessibleCharacters]);

  const currentCharacter = useMemo(() => {
    if (speakAs === "player") return null;
    return accessibleCharacters.find((c) => c.id === speakAs) || null;
  }, [speakAs, accessibleCharacters]);

  const { url: selectedCharAvatarUrl } = useMediaUrl(
    currentCharacter?.avatarMediaId || currentCharacter?.defaultToken?.mediaId,
    currentCharacter?.avatarExternalUrl || currentCharacter?.defaultToken?.externalUrl,
    campaignId
  );

  // Resolve os dados da identidade selecionada (nome e foto)
  const currentIdentity = useMemo(() => {
    if (speakAs === "player" || !currentCharacter) {
      return {
        type: "player",
        name:
          myPlayerProfile?.displayName ||
          user?.displayName ||
          user?.email?.split("@")[0] ||
          "Pinguim",
        photoURL: myPlayerProfile?.photoURL || user?.photoURL || null,
        character: null,
        characterId: null
      };
    }
    return {
      type: "character",
      name: currentCharacter.name,
      photoURL:
        selectedCharAvatarUrl ||
        currentCharacter.avatarExternalUrl ||
        currentCharacter.defaultToken?.externalUrl ||
        currentCharacter.tokenImage ||
        currentCharacter.avatarImage ||
        null,
      character: currentCharacter,
      characterId: currentCharacter.id
    };
  }, [speakAs, currentCharacter, selectedCharAvatarUrl, myPlayerProfile, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const raw = text.trim();
    setText("");

    // Atalho de rolagem direta no chat via /r ou /roll (ex: /r 2d6 + 3)
    if (raw.startsWith("/r ") || raw.startsWith("/roll ")) {
      const expr = raw.replace(/^\/r(oll)?\s+/i, "");
      await onExecuteRoll({
        title: `Rolagem (${expr})`,
        primaryFormula: expr,
        primaryLabel: "Resultado",
        character: currentIdentity.character || activeCharacter,
        senderName: currentIdentity.name,
        senderPhotoURL: currentIdentity.photoURL,
        visibility: rollVisibility
      });
      return;
    }

    await onSendText({
      content: raw,
      senderName: currentIdentity.name,
      senderPhotoURL: currentIdentity.photoURL,
      characterId: currentIdentity.characterId,
      characterMediaId: currentCharacter
        ? currentCharacter.avatarMediaId || currentCharacter.defaultToken?.mediaId || null
        : null,
      visibility: rollVisibility
    });
  };

  const handleQuickDie = async (sides) => {
    await onExecuteRoll({
      title: `1d${sides}`,
      categoryColor: "#02529c",
      primaryFormula: `1d${sides}`,
      primaryLabel: `d${sides}`,
      character: currentIdentity.character || activeCharacter,
      senderName: currentIdentity.name,
      senderPhotoURL: currentIdentity.photoURL,
      visibility: rollVisibility
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        gap: "8px"
      }}
    >
      {/* Seletor de Visibilidade da Rolagem + Dados Rápidos */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          background: "#ffffff",
          border: "2px solid var(--cp-blue-border)",
          borderRadius: "10px",
          padding: "6px",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className={`cp-btn ${
              rollVisibility === "public" ? "cp-btn-gold" : ""
            }`}
            style={{ flex: 1, padding: "4px 6px", fontSize: "11px" }}
            onClick={() => onChangeRollVisibility("public")}
          >
            Pública
          </button>
          <button
            type="button"
            className={`cp-btn cp-btn-epf ${
              rollVisibility === "gm_only" ? "active" : ""
            }`}
            style={{ flex: 1, padding: "4px 6px", fontSize: "11px" }}
            onClick={() => onChangeRollVisibility("gm_only")}
          >
            Secreta (GM)
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "4px",
            justifyContent: "space-between"
          }}
        >
          {QUICK_DICE.map((sides) => (
            <button
              key={sides}
              type="button"
              className="cp-btn"
              style={{
                flex: 1,
                padding: "4px 2px",
                fontSize: "11px",
                borderRadius: "8px"
              }}
              onClick={() => handleQuickDie(sides)}
            >
              d{sides}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Mensagens e Cards de Rolagem com Scrollbar Independente */}
      <div
        className="cp-chat-scrollable"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingRight: "4px",
          userSelect: "text",
          WebkitUserSelect: "text"
        }}
      >
        {(messages || []).map((msg) => {
          const isSecret = msg.visibility && msg.visibility !== "public";

          if (msg.type === "emote" && msg.icon) {
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

          if (msg.type === "ability_roll" && msg.rollData) {
            const borderColor = msg.rollData.categoryColor || "#02529c";
            return (
              <div
                key={msg.id}
                style={{
                  background: isSecret ? "#0b192c" : "#ffffff",
                  color: isSecret ? "#e2f1ff" : "var(--cp-text-dark)",
                  border: `3.5px solid ${borderColor}`,
                  borderRadius: "14px",
                  padding: "8px 10px",
                  boxShadow: "0 3px 0 #001b3a",
                  position: "relative"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    fontWeight: 800,
                    marginBottom: "4px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageAvatar msg={msg} campaignId={campaignId} />
                    <span>{msg.senderName}</span>
                  </div>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    {isSecret && (
                      <span
                        className="cp-badge cp-badge-gm"
                        style={{ fontSize: "9px", padding: "1px 6px" }}
                      >
                        SECRETO
                      </span>
                    )}
                    {msg.rollData.costPaid && (
                      <span
                        style={{
                          background: "#02529c",
                          color: "#ffffff",
                          borderRadius: "999px",
                          padding: "1px 6px",
                          fontSize: "10px"
                        }}
                      >
                        -{msg.rollData.costPaid.amount}{" "}
                        {msg.rollData.costPaid.resource}
                      </span>
                    )}
                    {isGM && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ef5350",
                          cursor: "pointer",
                          fontWeight: 800,
                          fontSize: "11px"
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "15px",
                    color: borderColor,
                    marginBottom: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {(msg.icon || msg.rollData.icon) && (
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
                      {renderCpFlashIcon(msg.icon || msg.rollData.icon, 20)}
                    </div>
                  )}
                  <span>{msg.rollData.title}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  {(msg.rollData.rolls || []).map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: isSecret
                          ? "rgba(0, 240, 255, 0.08)"
                          : "var(--cp-ice-bg)",
                        border: "2px solid var(--cp-blue-border)",
                        borderRadius: "10px",
                        padding: "6px 8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 800 }}>
                          {r.label}
                        </div>
                        <div
                          style={{
                            fontFamily: "var(--font-epf)",
                            fontSize: "11px",
                            opacity: 0.85
                          }}
                        >
                          {r.formulaOriginal} → {r.formulaResolved}
                        </div>
                        {Array.isArray(r.diceBreakdown) &&
                          r.diceBreakdown.length > 0 && (
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: isSecret ? "#90caf9" : "#02529c"
                              }}
                            >
                              Dados:{" "}
                              {r.diceBreakdown
                                .map(
                                  (d) =>
                                    `[${(d.rawRolls || []).join(", ")}]`
                                )
                                .join(" ")}
                            </div>
                          )}
                      </div>

                      <div
                        className="cp-title"
                        style={{
                          fontSize: "22px",
                          color: r.isCrit
                            ? "#38c172"
                            : r.isFumble
                              ? "#ff5252"
                              : "#ffcc00",
                          paddingLeft: "8px"
                        }}
                      >
                        {r.total}
                      </div>
                    </div>
                  ))}
                </div>

                {msg.content && (
                  <div
                    style={{
                      fontSize: "11px",
                      marginTop: "6px",
                      opacity: 0.9
                    }}
                  >
                    {msg.content}
                  </div>
                )}
              </div>
            );
          }

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
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input de Mensagem / Comando /r com seletor de identidade */}
      <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Seletor de Emissor: Player ou Personagens (com scroll se mais de ~5) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#ffffff",
            border: "2px solid var(--cp-blue-border)",
            borderRadius: "10px",
            padding: "4px 8px"
          }}
        >
          {/* Avatar da identidade ativa selecionada */}
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "1.5px solid #001b3a",
              background: "#e2f1ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            {currentIdentity.photoURL ? (
              <img
                src={currentIdentity.photoURL}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : currentIdentity.type === "character" ? (
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                {(currentIdentity.name || "P").slice(0, 1).toUpperCase()}
              </span>
            ) : (
              <span style={{ fontSize: "14px" }}>👤</span>
            )}
          </div>

          <select
            value={speakAs}
            onChange={(e) => setSelectedSpeakerId(e.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontWeight: 800,
              fontSize: "12px",
              color: "#001b3a",
              cursor: "pointer",
              padding: "2px 0",
              maxHeight: "160px"
            }}
          >
            <option value="player">
              {myPlayerProfile?.displayName || user?.displayName || "Você"}
            </option>
            {accessibleCharacters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            className="cp-input"
            style={{ padding: "8px 10px", fontSize: "13px" }}
            placeholder="Mensagem ou /r 1d20+4..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            className="cp-btn cp-btn-green"
            style={{ padding: "8px 12px", fontSize: "13px" }}
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

