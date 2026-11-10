import React, { useEffect, useMemo, useState } from "react";
import { SAVE_ATTRIBUTES, applyD20ModeToFormula } from "../../engines/combatEngine";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

export default function SavingThrowModal({
  open,
  onClose,
  savingThrowRequest,
  defenderCharacter,
  onExecuteSavingThrow,
}) {
  const [selectedAttrKey, setSelectedAttrKey] = useState("vigor");
  const [rollMode, setRollMode] = useState("normal"); // "normal" | "advantage" | "disadvantage"
  const [extraBonus, setExtraBonus] = useState("");
  const [selectedAssistIds, setSelectedAssistIds] = useState([]);
  const [assistDropdownId, setAssistDropdownId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (savingThrowRequest?.attribute) {
      const normalized = String(savingThrowRequest.attribute)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      setSelectedAttrKey(normalized || "vigor");
    } else {
      setSelectedAttrKey("vigor");
    }
    setRollMode("normal");
    setExtraBonus("");
    setSelectedAssistIds([]);
    setAssistDropdownId("");
  }, [savingThrowRequest?.id, savingThrowRequest?.attribute]);

  // Opções de Atributos + Perícias da ficha do defensor
  const attributeOptions = useMemo(() => {
    const map = new Map();
    SAVE_ATTRIBUTES.forEach((sa) => {
      map.set(sa.id, { id: sa.id, label: sa.label, formula: sa.formula });
    });

    if (defenderCharacter) {
      const skills = Array.isArray(defenderCharacter.skills)
        ? defenderCharacter.skills
        : [];
      skills.forEach((sk) => {
        if (!sk?.name) return;
        const key = String(sk.name)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");
        const attrKey = sk.attribute || sk.attr || "";
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            label: sk.name,
            formula: attrKey ? `@${attrKey} + @${key}` : `@${key}`,
          });
        }
      });
    }

    return Array.from(map.values());
  }, [defenderCharacter]);

  const currentAttrOption = useMemo(() => {
    return (
      attributeOptions.find((o) => o.id === selectedAttrKey) || {
        id: selectedAttrKey,
        label: savingThrowRequest?.attribute || "Resistência",
        formula: `@${selectedAttrKey}`,
      }
    );
  }, [attributeOptions, selectedAttrKey, savingThrowRequest?.attribute]);

  // Habilidades e itens que o defensor pode acionar no teste
  const availableAssists = useMemo(() => {
    if (!defenderCharacter) return [];
    const list = [];

    const abilities = Array.isArray(defenderCharacter.abilities)
      ? defenderCharacter.abilities
      : [];
    abilities.forEach((ab) => {
      const costRes = ab.cost?.resource || "mp";
      const costAmt = Number(ab.cost?.amount ?? ab.costMp ?? 0);
      list.push({
        uid: `ab_${ab.id}`,
        sourceType: "ability",
        id: ab.id,
        name: ab.name || "Habilidade",
        icon: ab.icon || "shield",
        formula: String(
          ab.effectFormula || ab.hitFormula || ab.secondaryFormula || ab.formula || ""
        ).trim(),
        costResource: costRes,
        costAmount: costAmt,
        costMp: costRes === "mp" ? costAmt : Number(ab.costMp || 0),
        costHp: costRes === "hp" ? costAmt : Number(ab.costHp || 0),
        raw: ab,
      });
    });

    const inventory = Array.isArray(defenderCharacter.inventory)
      ? defenderCharacter.inventory
      : [];
    inventory.forEach((it) => {
      list.push({
        uid: `it_${it.id}`,
        sourceType: "item",
        id: it.id,
        name: it.name || "Item",
        icon: it.icon || "potion_red",
        formula: String(
          it.rollFormula || it.effectFormula || it.secondaryFormula || it.formula || ""
        ).trim(),
        quantity: Number(it.qty ?? it.quantity ?? 1),
        consumeOnUse: Boolean(it.consumeOnUse),
        raw: it,
      });
    });

    return list;
  }, [defenderCharacter]);

  const selectedAssists = useMemo(() => {
    return selectedAssistIds
      .map((uid) => availableAssists.find((a) => a.uid === uid))
      .filter(Boolean);
  }, [selectedAssistIds, availableAssists]);

  const previewFormula = useMemo(() => {
    const base = `1d20 + ${currentAttrOption.formula}`;
    const assistFormulas = selectedAssists
      .map((a) => a.formula)
      .filter((f) => f && !/\b\d*d20\b/i.test(f));
    const combinedExtra = [extraBonus.trim(), ...assistFormulas]
      .filter(Boolean)
      .join(" + ");
    return applyD20ModeToFormula(base, rollMode, combinedExtra);
  }, [currentAttrOption, rollMode, extraBonus, selectedAssists]);

  if (!open || !savingThrowRequest) return null;

  const dc = Number(savingThrowRequest.dc) || 10;

  const handleAddAssist = (uid) => {
    if (!uid) return;
    if (!selectedAssistIds.includes(uid)) {
      setSelectedAssistIds((prev) => [...prev, uid]);
    }
    setAssistDropdownId("");
  };

  const handleRemoveAssist = (uid) => {
    setSelectedAssistIds((prev) => prev.filter((id) => id !== uid));
  };

  const handleRoll = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onExecuteSavingThrow?.({
        savingThrowRequest,
        attributeLabel: currentAttrOption.label,
        formula: previewFormula,
        rollMode,
        extraBonus: extraBonus.trim(),
        selectedAssists,
        defenderCharacter,
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
      style={{ zIndex: 1450 }}
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
              {renderCpFlashIcon("shield", 22)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2 className="cp-title" style={{ fontSize: "18px" }}>
                  TESTE DE RESISTÊNCIA
                </h2>
                <span
                  style={{
                    background: "#ffcc00",
                    color: "#001b3a",
                    fontWeight: 900,
                    fontSize: "11px",
                    padding: "1px 8px",
                    borderRadius: "999px",
                    border: "1.5px solid #001b3a"
                  }}
                >
                  CD {dc}
                </span>
              </div>
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#e0f2fe" }}>
                {savingThrowRequest.targetName || defenderCharacter?.name || "Defensor"} •{" "}
                {savingThrowRequest.sourceRollName || "Habilidade"}
              </div>
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
            gap: "10px"
          }}
        >
          {savingThrowRequest.effectDescription && (
            <div
              style={{
                padding: "6px 10px",
                borderRadius: "10px",
                background: "#f3e8ff",
                border: "1.5px solid #9333ea",
                color: "#581c87",
                fontSize: "12px",
                fontWeight: 800
              }}
            >
              ⚡ {savingThrowRequest.effectDescription}
            </div>
          )}

          {/* Atributo / Perícia */}
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
              Atributo / Perícia
            </div>
            <select
              className="cp-input"
              value={selectedAttrKey}
              onChange={(e) => setSelectedAttrKey(e.target.value)}
              style={{ fontSize: "12px" }}
            >
              {attributeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.formula})
                </option>
              ))}
            </select>
          </div>

          {/* Desvantagem / Normal / Vantagem */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            <button
              type="button"
              className={`cp-btn ${rollMode === "disadvantage" ? "cp-btn-orange" : ""}`}
              style={{ padding: "6px", fontSize: "11px" }}
              onClick={() => setRollMode("disadvantage")}
            >
              Desvantagem
            </button>
            <button
              type="button"
              className={`cp-btn ${rollMode === "normal" ? "cp-btn-gold" : ""}`}
              style={{ padding: "6px", fontSize: "11px" }}
              onClick={() => setRollMode("normal")}
            >
              Normal
            </button>
            <button
              type="button"
              className={`cp-btn ${rollMode === "advantage" ? "cp-btn-green" : ""}`}
              style={{ padding: "6px", fontSize: "11px" }}
              onClick={() => setRollMode("advantage")}
            >
              Vantagem
            </button>
          </div>

          {/* Dado / Bônus Extra */}
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
              Dado / Bônus Extra
            </div>
            <input
              type="text"
              className="cp-input"
              value={extraBonus}
              onChange={(e) => setExtraBonus(e.target.value)}
              placeholder="Ex: 1d4 + 2"
              style={{ fontFamily: "var(--font-epf)", fontSize: "13px" }}
            />
          </div>

          {/* Habilidade / Item para Auxiliar */}
          {availableAssists.length > 0 && (
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
                Usar Habilidade / Item
              </div>
              <select
                className="cp-input"
                value={assistDropdownId}
                onChange={(e) => handleAddAssist(e.target.value)}
                style={{ fontSize: "12px" }}
              >
                <option value="">Selecionar habilidade ou item...</option>
                {availableAssists.map((a) => {
                  const costLabel =
                    a.sourceType === "ability"
                      ? [
                          a.costMp > 0 ? `${a.costMp} MP` : "",
                          a.costHp > 0 ? `${a.costHp} HP` : "",
                        ]
                          .filter(Boolean)
                          .join("/")
                      : a.consumeOnUse
                      ? `1 un. (${a.quantity})`
                      : "";
                  return (
                    <option key={a.uid} value={a.uid}>
                      {a.name}
                      {a.formula ? ` [${a.formula}]` : ""}
                      {costLabel ? ` (${costLabel})` : ""}
                    </option>
                  );
                })}
              </select>

              {selectedAssists.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginTop: "8px"
                  }}
                >
                  {selectedAssists.map((a) => (
                    <div
                      key={a.uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "10px",
                        background: "#ffffff",
                        border: "2px solid #9333ea"
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
                        {renderCpFlashIcon(a.icon, 18)}
                        <strong
                          style={{
                            fontSize: "12px",
                            color: "#001b3a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {a.name}
                        </strong>
                        {a.formula && (
                          <span
                            style={{
                              fontFamily: "var(--font-epf)",
                              fontSize: "11px",
                              fontWeight: 800,
                              color: "#6b21a8",
                              background: "#f3e8ff",
                              border: "1px solid #a855f7",
                              borderRadius: "6px",
                              padding: "1px 5px"
                            }}
                          >
                            {a.formula}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssist(a.uid)}
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
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botão Rolar */}
          <button
            type="button"
            disabled={submitting}
            onClick={handleRoll}
            className="cp-btn cp-btn-gold"
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "13px",
              marginTop: "4px"
            }}
          >
            🎲 Rolar {currentAttrOption.label} ({previewFormula})
          </button>
        </div>
      </div>
    </div>
  );
}
