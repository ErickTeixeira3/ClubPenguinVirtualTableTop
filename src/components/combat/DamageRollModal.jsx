import React, { useMemo, useState } from "react";
import { doubleDiceInFormula, evaluateDcFormula } from "../../engines/combatEngine";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

export default function DamageRollModal({
  open,
  onClose,
  attackMessage,
  character,
  onExecuteDamageRoll,
}) {
  const [extraDamage, setExtraDamage] = useState("");
  const [selectedTriggerIds, setSelectedTriggerIds] = useState([]);
  const [selectedDropdownId, setSelectedDropdownId] = useState("");
  const [showAllAbilities, setShowAllAbilities] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredMode, setHoveredMode] = useState(null); // "normal" | "crit" | null

  const rollData = attackMessage?.rollData || {};
  const damageConfig = rollData.damageConfig || {};
  const baseFormula = String(
    damageConfig.formula ||
      rollData.secondary?.formulaOriginal ||
      rollData.rolls?.[1]?.formulaOriginal ||
      "1d6"
  ).trim();
  const critFormula = useMemo(() => doubleDiceInFormula(baseFormula), [baseFormula]);

  const isCritSuggested = Boolean(
    rollData.primary?.isCrit ||
      rollData.rolls?.[0]?.isCrit ||
      damageConfig.isCritSuggested
  );

  // Coleta habilidades e itens elegíveis como gatilho de acerto
  const availableTriggers = useMemo(() => {
    if (!character) return [];
    const list = [];

    const abilities = Array.isArray(character.abilities) ? character.abilities : [];
    abilities.forEach((ab) => {
      const trig = ab.trigger || "active";
      const isHitTrigger = trig === "on_hit" || trig === "on_crit";
      if (!showAllAbilities && !isHitTrigger) return;
      const formula = String(
        ab.effectFormula || ab.secondaryFormula || ab.formula || ""
      ).trim();
      const costRes = ab.cost?.resource || "mp";
      const costAmt = Number(ab.cost?.amount ?? ab.costMp ?? 0);
      list.push({
        uid: `ab_${ab.id}`,
        sourceType: "ability",
        id: ab.id,
        name: ab.name || "Habilidade",
        icon: ab.icon || "sword",
        trigger: trig,
        formula,
        costResource: costRes,
        costAmount: costAmt,
        costMp: costRes === "mp" ? costAmt : Number(ab.costMp || 0),
        costHp: costRes === "hp" ? costAmt : Number(ab.costHp || 0),
        effectType: ab.effectType || "damage",
        savingThrow: ab.savingThrow || null,
        raw: ab,
      });
    });

    const inventory = Array.isArray(character.inventory) ? character.inventory : [];
    inventory.forEach((it) => {
      const trig = it.trigger || "active";
      const isHitTrigger = trig === "on_hit" || trig === "on_crit";
      if (!showAllAbilities && !isHitTrigger) return;
      const formula = String(
        it.rollFormula || it.effectFormula || it.secondaryFormula || it.formula || ""
      ).trim();
      if (!formula && !it.savingThrow?.enabled && !isHitTrigger) return;
      list.push({
        uid: `it_${it.id}`,
        sourceType: "item",
        id: it.id,
        name: it.name || "Item",
        icon: it.icon || "potion_red",
        trigger: trig,
        formula,
        quantity: Number(it.qty ?? it.quantity ?? 1),
        consumeOnUse: Boolean(it.consumeOnUse),
        effectType: it.effectType || "damage",
        savingThrow: it.savingThrow || null,
        raw: it,
      });
    });

    return list;
  }, [character, showAllAbilities]);

  const selectedTriggers = useMemo(() => {
    return selectedTriggerIds
      .map((uid) => availableTriggers.find((t) => t.uid === uid))
      .filter(Boolean);
  }, [selectedTriggerIds, availableTriggers]);

  const normalFormulaPreview = useMemo(() => {
    const parts = [
      baseFormula,
      extraDamage.trim(),
      ...selectedTriggers.map((t) => t.formula).filter(Boolean)
    ].filter(Boolean);
    return parts.join(" + ") || baseFormula;
  }, [baseFormula, extraDamage, selectedTriggers]);

  const critFormulaPreview = useMemo(() => {
    const parts = [
      critFormula,
      extraDamage.trim() ? doubleDiceInFormula(extraDamage.trim()) : "",
      ...selectedTriggers.map((t) => (t.formula ? doubleDiceInFormula(t.formula) : "")).filter(Boolean)
    ].filter(Boolean);
    return parts.join(" + ") || critFormula;
  }, [critFormula, extraDamage, selectedTriggers]);

  if (!open || !attackMessage) return null;

  const handleAddTrigger = (uid) => {
    if (!uid) return;
    if (!selectedTriggerIds.includes(uid)) {
      setSelectedTriggerIds((prev) => [...prev, uid]);
    }
    setSelectedDropdownId("");
  };

  const handleRemoveTrigger = (uid) => {
    setSelectedTriggerIds((prev) => prev.filter((id) => id !== uid));
  };

  const handleRoll = async (isCritMode) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onExecuteDamageRoll?.({
        isCrit: isCritMode,
        baseFormula,
        critFormula,
        extraDamage: extraDamage.trim(),
        selectedTriggers,
        attackMessage,
        character,
      });
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="cp-modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1400 }}
    >
      <div
        className="cp-window"
        style={{ width: "100%", maxWidth: "440px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: "rgba(0, 27, 58, 0.35)",
                border: "1.5px solid rgba(255,255,255,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {renderCpFlashIcon(
                rollData.icon || attackMessage.icon || rollData.rollIcon || "sword",
                22
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                className="cp-title"
                style={{
                  fontSize: "18px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {rollData.title || rollData.rollName || "ROLAR DANO"}
              </h2>
              {rollData.targetInfo?.name && (
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 800,
                    color: "#fecdd3"
                  }}
                >
                  🎯 {rollData.targetInfo.name}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          className="cp-window-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          {/* Campo de Dano Extra */}
          <div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "#003264",
                textTransform: "uppercase",
                marginBottom: "4px"
              }}
            >
              Dano Extra
            </div>
            <input
              type="text"
              className="cp-input"
              value={extraDamage}
              onChange={(e) => setExtraDamage(e.target.value)}
              placeholder="Ex: 1d6 + 2"
              style={{ fontFamily: "var(--font-epf)", fontSize: "13px" }}
            />
          </div>

          {/* Seletor de Gatilho de Acerto */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#003264",
                  textTransform: "uppercase"
                }}
              >
                Habilidade / Item (Gatilho)
              </span>
              <button
                type="button"
                onClick={() => setShowAllAbilities((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#02529c",
                  fontSize: "11px",
                  fontWeight: 800,
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                {showAllAbilities ? "Apenas Gatilhos" : "Mostrar Todas"}
              </button>
            </div>

            <select
              className="cp-input"
              value={selectedDropdownId}
              onChange={(e) => handleAddTrigger(e.target.value)}
              style={{ fontSize: "12px" }}
            >
              <option value="">Selecionar habilidade ou item...</option>
              {availableTriggers.map((trig) => {
                const costLabel =
                  trig.sourceType === "ability"
                    ? [
                        trig.costMp > 0 ? `${trig.costMp} MP` : "",
                        trig.costHp > 0 ? `${trig.costHp} HP` : "",
                      ]
                        .filter(Boolean)
                        .join("/")
                    : trig.consumeOnUse
                    ? `1 un. (${trig.quantity})`
                    : "";
                return (
                  <option key={trig.uid} value={trig.uid}>
                    {trig.name}
                    {trig.formula ? ` [${trig.formula}]` : ""}
                    {costLabel ? ` (${costLabel})` : ""}
                  </option>
                );
              })}
            </select>

            {selectedTriggers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: "8px"
                }}
              >
                {selectedTriggers.map((trig) => {
                  const dcVal = trig.savingThrow?.enabled
                    ? evaluateDcFormula(trig.savingThrow.dcFormula, character)
                    : null;
                  return (
                    <div
                      key={trig.uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        background: "#ffffff",
                        border: "2px solid #008be3"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          minWidth: 0
                        }}
                      >
                        {renderCpFlashIcon(trig.icon, 18)}
                        <strong
                          style={{
                            fontSize: "12px",
                            color: "#001b3a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {trig.name}
                        </strong>
                        {trig.formula && (
                          <span
                            style={{
                              fontFamily: "var(--font-epf)",
                              fontSize: "11px",
                              fontWeight: 800,
                              color: "#b45309",
                              background: "#fef3c7",
                              border: "1px solid #f59e0b",
                              borderRadius: "6px",
                              padding: "1px 5px"
                            }}
                          >
                            +{trig.formula}
                          </span>
                        )}
                        {dcVal !== null && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 800,
                              color: "#6b21a8",
                              background: "#f3e8ff",
                              border: "1px solid #a855f7",
                              borderRadius: "6px",
                              padding: "1px 5px"
                            }}
                          >
                            CD {dcVal}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTrigger(trig.uid)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#dc2626",
                          fontWeight: 900,
                          fontSize: "13px",
                          cursor: "pointer"
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botões de Rolagem: Normal vs Crítico */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
              marginTop: "4px"
            }}
          >
            <button
              type="button"
              disabled={submitting}
              onMouseEnter={() => setHoveredMode("normal")}
              onMouseLeave={() => setHoveredMode(null)}
              onClick={() => handleRoll(false)}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 8px",
                borderRadius: "12px",
                cursor: "pointer",
                border: !isCritSuggested
                  ? "3px solid #16a34a"
                  : hoveredMode === "normal"
                  ? "3px solid #0284c7"
                  : "2.5px solid #64748b",
                background: !isCritSuggested
                  ? "linear-gradient(180deg, #dcfce7 0%, #86efac 100%)"
                  : "#ffffff",
                boxShadow: !isCritSuggested
                  ? "0 0 14px rgba(22, 163, 74, 0.45), 0 3px 0 #14532d"
                  : "0 3px 0 #334155",
                transition: "transform 0.1s ease, box-shadow 0.15s ease"
              }}
            >
              {!isCritSuggested && (
                <span
                  style={{
                    position: "absolute",
                    top: "-9px",
                    right: "8px",
                    background: "#16a34a",
                    color: "#ffffff",
                    fontSize: "9px",
                    fontWeight: 900,
                    padding: "1px 7px",
                    borderRadius: "999px",
                    border: "1.5px solid #ffffff"
                  }}
                >
                  GOLPE NORMAL
                </span>
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 900,
                  color: "#001b3a",
                  textTransform: "uppercase"
                }}
              >
                Dano Normal
              </span>
              <span
                style={{
                  marginTop: "3px",
                  fontFamily: "var(--font-epf)",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#15803d"
                }}
              >
                {normalFormulaPreview}
              </span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onMouseEnter={() => setHoveredMode("crit")}
              onMouseLeave={() => setHoveredMode(null)}
              onClick={() => handleRoll(true)}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 8px",
                borderRadius: "12px",
                cursor: "pointer",
                border: isCritSuggested
                  ? "3px solid #d97706"
                  : hoveredMode === "crit"
                  ? "3px solid #f59e0b"
                  : "2.5px solid #64748b",
                background: isCritSuggested
                  ? "linear-gradient(180deg, #fef08a 0%, #fbbf24 100%)"
                  : "#ffffff",
                boxShadow: isCritSuggested
                  ? "0 0 18px rgba(245, 158, 11, 0.65), 0 3px 0 #78350f"
                  : "0 3px 0 #334155",
                transition: "transform 0.1s ease, box-shadow 0.15s ease"
              }}
            >
              {isCritSuggested && (
                <span
                  style={{
                    position: "absolute",
                    top: "-9px",
                    right: "8px",
                    background: "#d97706",
                    color: "#ffffff",
                    fontSize: "9px",
                    fontWeight: 900,
                    padding: "1px 7px",
                    borderRadius: "999px",
                    border: "1.5px solid #ffffff"
                  }}
                >
                  CRÍTICO!
                </span>
              )}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 900,
                  color: "#78350f",
                  textTransform: "uppercase"
                }}
              >
                Dano Crítico (2x)
              </span>
              <span
                style={{
                  marginTop: "3px",
                  fontFamily: "var(--font-epf)",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#b45309"
                }}
              >
                {critFormulaPreview}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
