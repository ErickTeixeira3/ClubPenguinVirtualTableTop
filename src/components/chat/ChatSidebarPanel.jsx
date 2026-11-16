import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { ROLL_KINDS } from "../../engines/combatEngine";
import { resolveSpeakerIdentity } from "../../services/rollService";
import MessageAvatar from "./MessageAvatar";
import EmoteMessageCard from "./EmoteMessageCard";
import SkillPingCard from "./SkillPingCard";
import RollMessageCard from "./RollMessageCard";

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

export default function ChatSidebarPanel({
  messages,
  campaignId,
  activeCharacter,
  characters = [],
  allCharacters = [],
  targetedToken = null,
  canEditCharacter,
  rollVisibility,
  onChangeRollVisibility,
  onSendText,
  onExecuteRoll,
  onOpenDamageModal,
  onOpenSavingThrowModal,
  onApplyEffect,
  onDeleteMessage,
  isGM
}) {
  const { user } = useAuth();
  const { campaign, myPlayerProfile } = useCampaign();
  const [text, setText] = useState("");
  const [effectMenuMsgId, setEffectMenuMsgId] = useState(null);
  const [effectMenuType, setEffectMenuType] = useState("damage");
  const [effectCustomVal, setEffectCustomVal] = useState("");
  const [effectFlatMod, setEffectFlatMod] = useState("");
  const bottomRef = useRef(null);

  const toggleEffectMenu = (msg) => {
    if (!isGM || !msg) return;
    if (effectMenuMsgId === msg.id) {
      setEffectMenuMsgId(null);
      return;
    }
    const defaultType = msg.rollData?.effectType || "damage";
    const rolls = msg.rollData?.rolls || [];
    const baseVal =
      msg.rollData?.effectValue ??
      (rolls.length > 0 ? Number(rolls[rolls.length - 1]?.total) || 0 : 0);
    setEffectMenuMsgId(msg.id);
    setEffectMenuType(defaultType === "utility" ? "damage" : defaultType);
    setEffectCustomVal(String(baseVal));
    setEffectFlatMod("");
  };

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
  const [userChosenSpeakerId, setUserChosenSpeakerId] = useState(null);

  // Garante que se o personagem selecionado não existir mais, fala como player
  const speakAs = useMemo(() => {
    const candidateId = userChosenSpeakerId !== null ? userChosenSpeakerId : (activeCharacter?.id || "player");
    if (candidateId === "player") return "player";
    const exists = accessibleCharacters.some((c) => c.id === candidateId);
    return exists ? candidateId : "player";
  }, [userChosenSpeakerId, activeCharacter?.id, accessibleCharacters]);

  const currentCharacter = useMemo(() => {
    if (speakAs === "player") return null;
    return accessibleCharacters.find((c) => c.id === speakAs) || null;
  }, [speakAs, accessibleCharacters]);

  const { url: selectedCharAvatarUrl } = useMediaUrl(
    currentCharacter?.avatarMediaId || currentCharacter?.defaultToken?.mediaId,
    currentCharacter?.avatarExternalUrl || currentCharacter?.defaultToken?.externalUrl,
    campaignId
  );

  const playersMap = campaign?.players;

  // Resolve os dados da identidade selecionada via serviço único (nome, avatar e personagem)
  const currentIdentity = useMemo(
    () =>
      resolveSpeakerIdentity({
        character: currentCharacter,
        user,
        myPlayerProfile,
        playersMap,
        resolvedAvatarUrl: selectedCharAvatarUrl
      }),
    [currentCharacter, user, myPlayerProfile, playersMap, selectedCharAvatarUrl]
  );

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
        // Fase 3.1 (V-03): rolagem livre é teste (CHECK), nunca ataque contra a Defesa
        rollKind: ROLL_KINDS.CHECK,
        character:
          speakAs === "player"
            ? null
            : currentIdentity.character || activeCharacter,
        senderName: currentIdentity.name,
        senderPhotoURL: currentIdentity.senderPhotoURL,
        visibility: rollVisibility
      });
      return;
    }

    await onSendText({
      content: raw,
      senderName: currentIdentity.name,
      senderPhotoURL: currentIdentity.senderPhotoURL,
      characterId: currentIdentity.characterId,
      characterMediaId: currentIdentity.characterMediaId,
      visibility: rollVisibility
    });
  };

  const handleQuickDie = async (sides) => {
    await onExecuteRoll({
      title: `1d${sides}`,
      categoryColor: "#02529c",
      primaryFormula: `1d${sides}`,
      primaryLabel: `d${sides}`,
      // Fase 3.1 (V-03): dado rápido é teste (CHECK), nunca ataque contra a Defesa
      rollKind: ROLL_KINDS.CHECK,
      character:
        speakAs === "player"
          ? null
          : currentIdentity.character || activeCharacter,
      senderName: currentIdentity.name,
      senderPhotoURL: currentIdentity.senderPhotoURL,
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
              <EmoteMessageCard
                key={msg.id}
                msg={msg}
                isSecret={isSecret}
                campaignId={campaignId}
              />
            );
          }

          if (msg.type === "skill_ping" && msg.skillData) {
            return (
              <SkillPingCard
                key={msg.id}
                msg={msg}
                campaignId={campaignId}
                allCharacters={allCharacters}
                activeCharacter={activeCharacter}
                onExecuteRoll={onExecuteRoll}
              />
            );
          }

          if (msg.type === "ability_roll" && msg.rollData) {
            return (
              <RollMessageCard
                key={msg.id}
                msg={msg}
                targetedToken={targetedToken}
                allCharacters={allCharacters}
                user={user}
                isGM={isGM}
                characters={characters}
                isSecret={isSecret}
                messages={messages}
                effectMenuMsgId={effectMenuMsgId}
                effectFlatMod={effectFlatMod}
                effectMenuType={effectMenuType}
                toggleEffectMenu={toggleEffectMenu}
                campaignId={campaignId}
                onDeleteMessage={onDeleteMessage}
                onOpenDamageModal={onOpenDamageModal}
                onOpenSavingThrowModal={onOpenSavingThrowModal}
                setEffectMenuType={setEffectMenuType}
                onApplyEffect={onApplyEffect}
                setEffectMenuMsgId={setEffectMenuMsgId}
                effectCustomVal={effectCustomVal}
                setEffectCustomVal={setEffectCustomVal}
                setEffectFlatMod={setEffectFlatMod}
              />
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
            onChange={(e) => setUserChosenSpeakerId(e.target.value)}
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

