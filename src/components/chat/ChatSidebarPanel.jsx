import { useEffect, useRef, useState } from "react";

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

export default function ChatSidebarPanel({
  messages,
  activeCharacter,
  rollVisibility,
  onChangeRollVisibility,
  onSendText,
  onExecuteRoll,
  onDeleteMessage,
  isGM
}) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

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
        character: activeCharacter,
        visibility: rollVisibility
      });
      return;
    }

    await onSendText({
      content: raw,
      senderName: activeCharacter?.name,
      characterId: activeCharacter?.id || null,
      visibility: rollVisibility
    });
  };

  const handleQuickDie = async (sides) => {
    await onExecuteRoll({
      title: `1d${sides}`,
      categoryColor: "#02529c",
      primaryFormula: `1d${sides}`,
      primaryLabel: `d${sides}`,
      character: activeCharacter,
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
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingRight: "4px"
        }}
      >
        {(messages || []).map((msg) => {
          const isSecret = msg.visibility && msg.visibility !== "public";

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
                    {msg.senderPhotoURL ? (
                      <img
                        src={msg.senderPhotoURL}
                        alt=""
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          objectFit: "cover"
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "12px" }}>🐧</span>
                    )}
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
                    marginBottom: "6px"
                  }}
                >
                  {msg.rollData.title}
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
                  {msg.senderPhotoURL ? (
                    <img
                      src={msg.senderPhotoURL}
                      alt=""
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        objectFit: "cover"
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "12px" }}>🐧</span>
                  )}
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

      {/* Input de Mensagem / Comando /r */}
      <form onSubmit={handleSend} style={{ display: "flex", gap: "6px" }}>
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
      </form>
    </div>
  );
}

