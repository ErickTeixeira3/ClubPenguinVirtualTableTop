import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import {
  EFFECT_TYPES,
  TRIGGER_TYPES,
  buildTargetInfo,
  canUserSeeTargetOutcome,
  canUserSeeTargetDefense,
  computeModifiedEffectValue
} from "../../engines/combatEngine";

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];

function MessageAvatar({ msg, campaignId }) {
  const { url } = useMediaUrl(msg.characterMediaId, null, campaignId);
  const resolvedUrl = (msg.characterId || msg.characterMediaId)
    ? (msg.senderPhotoURL || url)
    : (msg.senderPhotoURL || null);

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
  const { myPlayerProfile } = useCampaign();
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

          if (msg.type === "skill_ping" && msg.skillData) {
            const sk = msg.skillData;
            const isSecret = msg.visibility && msg.visibility !== "public";
            const trigMeta = TRIGGER_TYPES.find((t) => t.id === (sk.trigger || "active"));
            const borderColor = sk.elementColor || "#02529c";

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
                    onClick={() => {
                      const char = allCharacters.find((c) => c.id === msg.characterId) || activeCharacter;
                      onExecuteRoll?.({
                        title: sk.name,
                        categoryColor: sk.elementColor || "#02529c",
                        description: sk.description || "",
                        character: char,
                        primaryFormula: sk.hitFormula || "",
                        primaryLabel: sk.hitFormula ? "Acerto" : "Efeito",
                        rollKind: sk.hitFormula ? "attack" : (sk.effectFormula ? "damage" : "check"),
                        secondaryFormula: sk.effectFormula || "",
                        secondaryLabel: "Dano / Efeito",
                        cost: sk.cost,
                        effectType: sk.effectType || (sk.effectFormula ? "damage" : null),
                        savingThrow: sk.savingThrow || null,
                        icon: sk.icon || sk.name,
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
                      cursor: "pointer",
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

          if (msg.type === "ability_roll" && msg.rollData) {
            const primaryRoll =
              msg.rollData.primary || msg.rollData.rolls?.[0] || null;
            const primaryTotal =
              primaryRoll?.total !== undefined && primaryRoll?.total !== null
                ? Number(primaryRoll.total)
                : null;

            const isDamageRollMessage =
              msg.rollData.rollKind === "damage" ||
              Boolean(
                msg.rollData.parentMessageId && !msg.rollData.savingThrowOutcome
              );

            const isAttackMessage =
              !isDamageRollMessage &&
              (msg.rollData.rollKind === "attack" ||
                Boolean(msg.rollData.damageConfig) ||
                Boolean(msg.rollData.targetInfo?.isAttackRoll) ||
                /^(acerto|ataque|tiro|golpe)/i.test(primaryRoll?.label || "") ||
                /^(ataque|tiro|golpe)/i.test(msg.rollData.title || ""));

            let targetInfo = msg.rollData.targetInfo || null;
            if (isAttackMessage) {
              if (targetInfo) {
                const rebuilt = buildTargetInfo({
                  targetedToken: {
                    ...targetInfo,
                    id: targetInfo.tokenId || targetInfo.id
                  },
                  allCharacters,
                  attackTotal: primaryTotal,
                  isAttackRoll: true
                });
                if (rebuilt) {
                  targetInfo = {
                    ...rebuilt,
                    ...targetInfo,
                    defense: targetInfo.defense ?? rebuilt.defense,
                    isHit:
                      targetInfo.isHit !== null &&
                      targetInfo.isHit !== undefined
                        ? targetInfo.isHit
                        : rebuilt.isHit,
                    isAttackRoll: true
                  };
                }
              } else if (targetedToken) {
                targetInfo = buildTargetInfo({
                  targetedToken,
                  allCharacters,
                  attackTotal: primaryTotal,
                  isAttackRoll: true
                });
              }
            }

            const showTargetOutcome = Boolean(
              targetInfo &&
                canUserSeeTargetOutcome({
                  user,
                  isGM,
                  targetInfo,
                  senderId: msg.senderId,
                  accessibleCharacters: characters
                })
            );

            const showTargetDefense = Boolean(
              isAttackMessage &&
                !isDamageRollMessage &&
                targetInfo &&
                canUserSeeTargetDefense({
                  user,
                  isGM,
                  targetInfo,
                  accessibleCharacters: characters
                })
            );

            const hasHitOutcome =
              isAttackMessage &&
              !isDamageRollMessage &&
              showTargetOutcome &&
              targetInfo.isHit !== null &&
              targetInfo.isHit !== undefined;

            const saveOutcome = msg.rollData.savingThrowOutcome || null;

            let cardBg = isSecret ? "#0b192c" : "#ffffff";
            let borderColor = msg.rollData.categoryColor || "#02529c";
            let cardBoxShadow = "0 3px 0 #001b3a";

            if (hasHitOutcome) {
              if (targetInfo.isHit) {
                cardBg = isSecret ? "#064e3b" : "#dcfce7";
                borderColor = "#16a34a";
                cardBoxShadow = "0 0 12px rgba(22, 163, 74, 0.55), 0 3px 0 #14532d";
              } else {
                cardBg = isSecret ? "#7f1d1d" : "#fee2e2";
                borderColor = "#dc2626";
                cardBoxShadow = "0 0 12px rgba(220, 38, 38, 0.55), 0 3px 0 #7f1d1d";
              }
            } else if (saveOutcome) {
              if (saveOutcome.passed) {
                cardBg = isSecret ? "#064e3b" : "#dcfce7";
                borderColor = "#16a34a";
                cardBoxShadow = "0 0 12px rgba(22, 163, 74, 0.55), 0 3px 0 #14532d";
              } else {
                cardBg = isSecret ? "#7f1d1d" : "#fee2e2";
                borderColor = "#dc2626";
                cardBoxShadow = "0 0 12px rgba(220, 38, 38, 0.55), 0 3px 0 #7f1d1d";
              }
            }

            const damageConfig = msg.rollData.damageConfig || null;
            const isCritSuggested = Boolean(
              damageConfig?.isCritSuggested ||
                msg.rollData.primary?.isCrit ||
                msg.rollData.rolls?.[0]?.isCrit
            );

            const saveReq = msg.rollData.savingThrowRequest || null;
            const saveResponseMsg = saveReq
              ? (messages || []).find(
                  (m) => m.rollData?.respondedToSaveId === saveReq.id
                )
              : null;

            const rollsList = msg.rollData.rolls || [];
            const baseEffectVal =
              msg.rollData.effectValue ??
              (rollsList.length > 0
                ? Number(rollsList[rollsList.length - 1]?.total) || 0
                : 0);
            const isEffectMenuOpen = isGM && effectMenuMsgId === msg.id;

            const sourceChar = msg.characterId
              ? allCharacters.find((c) => c.id === msg.characterId) || null
              : null;
            const targetCharId =
              targetInfo?.characterId || targetedToken?.characterId || null;
            const targetChar = targetCharId
              ? allCharacters.find((c) => c.id === targetCharId) || null
              : null;

            const manualMods =
              effectFlatMod !== "" && Number(effectFlatMod) !== 0
                ? [
                    {
                      id: "gm_manual",
                      label: "Ajuste",
                      phase: "incoming",
                      flatDelta: Number(effectFlatMod) || 0,
                      multiplier: 1
                    }
                  ]
                : [];

            const fullPreview = isEffectMenuOpen
              ? computeModifiedEffectValue({
                  baseValue: baseEffectVal,
                  scaleMode: "full",
                  effectType: effectMenuType,
                  sourceCharacter: sourceChar,
                  targetCharacter: targetChar,
                  targetToken: targetedToken,
                  manualModifiers: manualMods
                })
              : null;

            const halfPreview = isEffectMenuOpen
              ? computeModifiedEffectValue({
                  baseValue: baseEffectVal,
                  scaleMode: "half",
                  effectType: effectMenuType,
                  sourceCharacter: sourceChar,
                  targetCharacter: targetChar,
                  targetToken: targetedToken,
                  manualModifiers: manualMods
                })
              : null;

            return (
              <div
                key={msg.id}
                onContextMenu={(e) => {
                  if (!isGM) return;
                  e.preventDefault();
                  e.stopPropagation();
                  toggleEffectMenu(msg);
                }}
                style={{
                  background: cardBg,
                  color: isSecret ? "#e2f1ff" : "var(--cp-text-dark)",
                  border: `3.5px solid ${borderColor}`,
                  borderRadius: "14px",
                  padding: "8px 10px",
                  boxShadow: cardBoxShadow,
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
                    marginBottom: "4px",
                    gap: "4px",
                    flexWrap: "wrap"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageAvatar msg={msg} campaignId={campaignId} />
                    <span>{msg.senderName}</span>
                  </div>
                  <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
                    {showTargetDefense && (
                      targetInfo.targets?.length > 1 ? (
                        targetInfo.targets.map((tgt, tIdx) => (
                          <span
                            key={tIdx}
                            style={{
                              background: tgt.isHit ? "#14532d" : "#7f1d1d",
                              color: "#ffffff",
                              border: `1px solid ${tgt.isHit ? "#22c55e" : "#ef4444"}`,
                              borderRadius: "999px",
                              padding: "1px 6px",
                              fontSize: "10px",
                              fontWeight: 900
                            }}
                          >
                            🛡️ {tgt.name}: DEF {tgt.defense} ({tgt.isHit ? "ACERTOU" : "ERROU"})
                          </span>
                        ))
                      ) : targetInfo?.defense !== undefined ? (
                        <>
                          <span
                            style={{
                              background: "#0f172a",
                              color: "#38bdf8",
                              border: "1px solid #38bdf8",
                              borderRadius: "999px",
                              padding: "1px 6px",
                              fontSize: "10px",
                              fontWeight: 900
                            }}
                          >
                            🛡️ DEF {targetInfo.defense}
                          </span>
                          {hasHitOutcome && (
                            <span
                              style={{
                                background: targetInfo.isHit ? "#15803d" : "#b91c1c",
                                color: "#ffffff",
                                borderRadius: "999px",
                                padding: "1px 6px",
                                fontSize: "10px",
                                fontWeight: 900
                              }}
                            >
                              {targetInfo.isHit ? "ACERTOU" : "ERROU"}
                            </span>
                          )}
                        </>
                      ) : null
                    )}
                    {saveOutcome && (
                      <span
                        style={{
                          background: saveOutcome.passed ? "#15803d" : "#b91c1c",
                          color: "#ffffff",
                          borderRadius: "999px",
                          padding: "1px 6px",
                          fontSize: "10px",
                          fontWeight: 900
                        }}
                      >
                        CD {saveOutcome.dc} • {saveOutcome.passed ? "SUCESSO" : "FALHA"}
                      </span>
                    )}
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
                        onClick={() => toggleEffectMenu(msg)}
                        title="Aplicar Efeito"
                        style={{
                          background: isEffectMenuOpen ? "#02529c" : "rgba(2, 82, 156, 0.14)",
                          border: "1px solid #02529c",
                          color: isEffectMenuOpen ? "#ffffff" : (isSecret ? "#90caf9" : "#02529c"),
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: "10px",
                          padding: "0px 5px",
                          lineHeight: "16px"
                        }}
                      >
                        ▾
                      </button>
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
                    marginBottom: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
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
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {msg.rollData.title}
                    </span>
                  </div>
                  {isAttackMessage && (targetInfo?.name || targetInfo?.targets?.length > 0) && (
                    <span
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "10px",
                        fontWeight: 800,
                        background: "rgba(225, 29, 72, 0.14)",
                        color: isSecret ? "#fda4af" : "#be123c",
                        border: "1px solid rgba(225, 29, 72, 0.35)",
                        borderRadius: "999px",
                        padding: "1px 7px",
                        flexShrink: 0
                      }}
                    >
                      🎯 {targetInfo.targets?.length > 1
                        ? `${targetInfo.targets.length} Alvos (${targetInfo.targets.map((t) => t.name).join(", ")})`
                        : targetInfo.name}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  {rollsList.map((r, idx) => {
                    const hasResolvedDiff =
                      r.formulaResolved &&
                      String(r.formulaResolved).trim() !== String(r.formulaOriginal || "").trim();
                    const hasDice =
                      Array.isArray(r.diceBreakdown) && r.diceBreakdown.length > 0;

                    return (
                      <div
                        key={idx}
                        style={{
                          background: isSecret
                            ? "rgba(0, 240, 255, 0.08)"
                            : hasHitOutcome
                            ? "rgba(255, 255, 255, 0.92)"
                            : "rgba(240, 248, 255, 0.85)",
                          border:
                            hasHitOutcome && idx === 0
                              ? `2px solid ${borderColor}`
                              : "2px solid var(--cp-blue-border)",
                          borderRadius: "10px",
                          padding: "6px 8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between"
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px"
                          }}
                        >
                          <div style={{ fontSize: "11px", fontWeight: 800 }}>
                            {r.label}
                          </div>
                          {r.formulaOriginal && (
                            <div
                              style={{
                                fontFamily: "var(--font-epf)",
                                fontSize: "11px",
                                color: isSecret ? "#cbd5e1" : "#1e293b",
                                opacity: 0.9
                              }}
                            >
                              {r.formulaOriginal}
                            </div>
                          )}
                          {hasResolvedDiff && (
                            <div
                              style={{
                                fontFamily: "var(--font-epf)",
                                fontSize: "11px",
                                color: isSecret ? "#94a3b8" : "#475569",
                                opacity: 0.85
                              }}
                            >
                              {r.formulaResolved}
                            </div>
                          )}
                          {hasDice && (
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: isSecret ? "#38bdf8" : "#02529c",
                                marginTop: "1px"
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
                    );
                  })}
                </div>

                {/* Botão para Rolar Dano (abre DamageRollModal) */}
                {damageConfig && (
                  <button
                    type="button"
                    onClick={() => onOpenDamageModal?.(msg)}
                    style={{
                      marginTop: "6px",
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "10px",
                      border: isCritSuggested
                        ? "2px solid #f59e0b"
                        : "2px solid #02529c",
                      background: isCritSuggested
                        ? "linear-gradient(180deg, #fef08a 0%, #f59e0b 100%)"
                        : "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)",
                      color: isCritSuggested ? "#1e293b" : "#ffffff",
                      fontWeight: 900,
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isCritSuggested
                        ? "0 0 12px rgba(245, 158, 11, 0.55), 0 2px 0 #78350f"
                        : "0 2px 0 #001b3a"
                    }}
                  >
                    Rolar dano
                  </button>
                )}

                {/* Pedido de Teste de Resistência no Card */}
                {saveReq && (
                  <div style={{ marginTop: "6px" }}>
                    <button
                      type="button"
                      onClick={() => onOpenSavingThrowModal?.(saveReq)}
                      style={{
                        width: "100%",
                        padding: "5px 10px",
                        borderRadius: "10px",
                        border: "2px solid #7e22ce",
                        background: saveResponseMsg
                          ? saveResponseMsg.rollData?.savingThrowOutcome?.passed
                            ? "#15803d"
                            : "#b91c1c"
                          : "linear-gradient(180deg, #a855f7 0%, #6b21a8 100%)",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "11px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: "0 2px 0 #3b0764"
                      }}
                    >
                      <span>
                        🛡️ Resistência ({saveReq.attribute}) — CD {saveReq.dc}
                      </span>
                      <span style={{ fontSize: "10px" }}>
                        {saveResponseMsg
                          ? `${
                              saveResponseMsg.rollData?.savingThrowOutcome?.passed
                                ? "PASSOU"
                                : "FALHOU"
                            } (${saveResponseMsg.rollData?.rolls?.[0]?.total ?? ""})`
                          : "ROLAR"}
                      </span>
                    </button>
                  </div>
                )}

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

                {/* Histórico de Efeitos Aplicados pelo Mestre */}
                {Array.isArray(msg.rollData.appliedEffects) &&
                  msg.rollData.appliedEffects.length > 0 && (
                    <div
                      style={{
                        marginTop: "6px",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "4px"
                      }}
                    >
                      {msg.rollData.appliedEffects.map((eff, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            background: "rgba(15, 23, 42, 0.85)",
                            color: "#f8fafc",
                            borderRadius: "6px",
                            padding: "2px 6px"
                          }}
                        >
                          ✓ {eff.label}: {eff.finalValue} em {eff.targetName}
                        </span>
                      ))}
                    </div>
                  )}

                {/* Menu do Mestre para Aplicar Efeito (Completo, Metade, Personalizado) */}
                {isEffectMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: "8px",
                      padding: "8px",
                      borderRadius: "10px",
                      background: "#0f172a",
                      border: "2px solid #38bdf8",
                      color: "#f8fafc",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "10px",
                        fontWeight: 900,
                        color: "#38bdf8"
                      }}
                    >
                      <span>
                        🎯{" "}
                        {targetInfo?.name ||
                          targetedToken?.name ||
                          "Selecionar Alvo (T)"}
                      </span>
                      <select
                        value={effectMenuType}
                        onChange={(e) => setEffectMenuType(e.target.value)}
                        style={{
                          background: "#1e293b",
                          color: "#ffffff",
                          border: "1px solid #475569",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "1px 4px"
                        }}
                      >
                        {EFFECT_TYPES.filter((et) => et.resourceKey).map((et) => (
                          <option key={et.id} value={et.id}>
                            {et.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                      <button
                        type="button"
                        onClick={async () => {
                          await onApplyEffect?.({
                            msg,
                            baseValue: baseEffectVal,
                            scaleMode: "full",
                            effectType: effectMenuType,
                            manualModifiers: manualMods
                          });
                          setEffectMenuMsgId(null);
                        }}
                        style={{
                          padding: "5px 6px",
                          borderRadius: "8px",
                          border: "1.5px solid #22c55e",
                          background: "#14532d",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: 900,
                          cursor: "pointer"
                        }}
                      >
                        Completo ({fullPreview?.finalValue ?? baseEffectVal})
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await onApplyEffect?.({
                            msg,
                            baseValue: baseEffectVal,
                            scaleMode: "half",
                            effectType: effectMenuType,
                            manualModifiers: manualMods
                          });
                          setEffectMenuMsgId(null);
                        }}
                        style={{
                          padding: "5px 6px",
                          borderRadius: "8px",
                          border: "1.5px solid #eab308",
                          background: "#713f12",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: 900,
                          cursor: "pointer"
                        }}
                      >
                        Metade ({halfPreview?.finalValue ?? Math.floor(baseEffectVal / 2)})
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <input
                        type="number"
                        value={effectCustomVal}
                        onChange={(e) => setEffectCustomVal(e.target.value)}
                        placeholder="Valor"
                        style={{
                          width: "64px",
                          background: "#020617",
                          border: "1px solid #475569",
                          borderRadius: "6px",
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 800,
                          padding: "3px 6px"
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await onApplyEffect?.({
                            msg,
                            baseValue: baseEffectVal,
                            scaleMode: "custom",
                            customValue: Number(effectCustomVal) || 0,
                            effectType: effectMenuType,
                            manualModifiers: []
                          });
                          setEffectMenuMsgId(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "4px 6px",
                          borderRadius: "6px",
                          border: "1.5px solid #38bdf8",
                          background: "#0369a1",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: 900,
                          cursor: "pointer"
                        }}
                      >
                        Personalizado
                      </button>
                      <input
                        type="number"
                        value={effectFlatMod}
                        onChange={(e) => setEffectFlatMod(e.target.value)}
                        placeholder="Mod ±"
                        title="Modificador de Redução/Aumento (ex: -2 ou +4)"
                        style={{
                          width: "54px",
                          background: "#020617",
                          border: "1px solid #475569",
                          borderRadius: "6px",
                          color: "#fbbf24",
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "3px 5px"
                        }}
                      />
                    </div>
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

