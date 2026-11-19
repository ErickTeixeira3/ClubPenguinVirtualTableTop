import { EFFECT_TYPES, ROLL_KINDS, canUserSeeTargetDefense, canUserSeeTargetOutcome, computeModifiedEffectValue } from "../../engines/combatEngine";
import { isUserResponsibleForSavingThrow } from "../../domain/permissions.js";
import { isAttackRollMessage } from "../../engines/rolls/rollClassifier.js";
import { adaptMessageForLegacyChat } from "../../engines/chat/messageSelector.js";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import MessageAvatar from "./MessageAvatar";

/**
 * Fase 5: card de rolagem do chat (ataque, dano, cura, teste de resistência) e calculadora de
 * aplicação de efeito do Mestre, extraído de ChatSidebarPanel.jsx (JSX e lógica inalterados).
 */
export default function RollMessageCard({
  msg: rawMessage,
  targetedToken,
  allCharacters,
  user,
  isGM,
  characters,
  isSecret,
  messages,
  effectMenuMsgId,
  effectFlatMod,
  effectMenuType,
  toggleEffectMenu,
  campaignId,
  onDeleteMessage,
  onOpenDamageModal,
  onOpenSavingThrowModal,
  setEffectMenuType,
  onApplyEffect,
  setEffectMenuMsgId,
  effectCustomVal,
  setEffectCustomVal,
  setEffectFlatMod
}) {
  const msg = adaptMessageForLegacyChat(rawMessage);
  if (!msg.rollData) return null;
  const isDamageRollMessage =
    msg.rollData.rollKind === ROLL_KINDS.DAMAGE ||
    Boolean(
      msg.rollData.parentMessageId && !msg.rollData.savingThrowOutcome
    );

  const isAttackMessage = isAttackRollMessage({ roll: msg.roll });

  // FUN-06/SEG-08: o card nunca consulta o alvo selecionado por quem está vendo.
  // Alvo e avaliação são fatos imutáveis da mensagem v2.
  const targetInfo = msg.rollData.targetInfo || null;

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
    targetInfo?.characterId || null;
  const targetChar = targetCharId
    ? allCharacters.find((c) => c.id === targetCharId) || null
    : null;
  const messageTargetToken = targetInfo
    ? targetedToken?.id === (targetInfo.tokenId || targetInfo.id)
      ? targetedToken
      : {
          id: targetInfo.tokenId || targetInfo.id || null,
          characterId: targetInfo.characterId || null,
          label: targetInfo.name || targetInfo.label || "Alvo"
        }
    : null;
  const canRespondToSave = saveReq
    ? isUserResponsibleForSavingThrow({
        uid: user?.uid,
        isGM,
        savingThrowRequest: saveReq,
        targetCharacter: saveReq.targetCharacterId
          ? allCharacters.find((character) => character.id === saveReq.targetCharacterId) || null
          : null
      })
    : false;

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
        targetToken: messageTargetToken,
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
        targetToken: messageTargetToken,
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
        {isAttackMessage && !targetInfo && (
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              fontWeight: 800,
              background: "rgba(100, 116, 139, 0.14)",
              color: isSecret ? "#cbd5e1" : "#475569",
              border: "1px solid rgba(100, 116, 139, 0.35)",
              borderRadius: "999px",
              padding: "1px 7px",
              flexShrink: 0
            }}
          >
            SEM AVALIAÇÃO
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
            disabled={Boolean(saveResponseMsg) || !canRespondToSave}
            onClick={() => {
              if (!saveResponseMsg && canRespondToSave) {
                onOpenSavingThrowModal?.({ ...saveReq, parentMessageId: msg.id });
              }
            }}
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
              cursor: saveResponseMsg || !canRespondToSave ? "default" : "pointer",
              opacity: canRespondToSave ? 1 : 0.65,
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
                : canRespondToSave
                  ? "ROLAR"
                  : "AGUARDANDO"}
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
                "Sem alvo da mensagem"}
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
