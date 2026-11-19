import { useState } from "react";
import { Z_LAYERS } from "../../../constants/zLayers";
import { RESERVED_FORMULA_KEYS, ROLL_KINDS } from "../../../domain/constants.js";
import { normalizeFormulaKey } from "../../../engines/formula";
import ConfirmDialog from "../../ui/ConfirmDialog";
import DebouncedField from "../../ui/DebouncedField";

const RESERVED_FORMULA_KEY_SET = new Set(RESERVED_FORMULA_KEYS);

/**
 * Aba "Atributos" da Ficha (Barras de HP/MP, Defesa, Nível, Token e Atributos).
 */
export default function SheetAttributesTab({
  canEdit,
  hp,
  mp,
  character,
  onUpdateCharacter,
  onUpdateCharacterResource = null,
  onAddCharacterEntry = null,
  onUpdateCharacterEntry = null,
  onRemoveCharacterEntry = null,
  cardBgColor,
  tokenUrl,
  onUploadCharacterImage,
  onSpawnTokenOnMap,
  attributes,
  triggerRoll,
  pinToRollGroup,
  newAttrLabel,
  setNewAttrLabel
}) {
  const [attrError, setAttrError] = useState(null);
  const [confirmDeleteAttr, setConfirmDeleteAttr] = useState(null);

  const attrList = Array.isArray(attributes)
    ? attributes
    : attributes && typeof attributes === "object"
      ? Object.values(attributes).sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
      : [];

  const hpPercent =
    hp.max > 0 ? Math.min(100, Math.max(0, (hp.current / hp.max) * 100)) : 0;

  const mpPercent =
    mp.max > 0 ? Math.min(100, Math.max(0, (mp.current / mp.max) * 100)) : 0;

  const tokenShowName =
    (character.token?.showName ?? character.defaultToken?.showName) !== false;

  const handleUpdateResource = (resKey, field, val) => {
    if (!canEdit) return Promise.resolve();
    const cleanVal = Math.max(0, Number(val) || 0);
    if (!character.resources?.[resKey]) {
      return onUpdateCharacter(character.id, {
        [`resources.${resKey}`]: {
          current: field === "current" ? cleanVal : 10,
          max: field === "max" ? cleanVal : 10
        }
      });
    }
    if (field === "current" && onUpdateCharacterResource) {
      return onUpdateCharacterResource(character.id, resKey, cleanVal);
    }
    return onUpdateCharacter(character.id, {
      [`resources.${resKey}.${field}`]: cleanVal
    });
  };

  const handleUpdateAttrValue = (key, value) => {
    if (!canEdit) return Promise.resolve();
    const val = Number(value) || 0;
    if (onUpdateCharacterEntry) {
      return onUpdateCharacterEntry(character.id, "attributes", key, { value: val });
    }
    if (Array.isArray(character.attributes)) {
      const nextAttrs = attrList.map((a) =>
        a.key === key ? { ...a, value: val } : a
      );
      return onUpdateCharacter(character.id, { attributes: nextAttrs });
    }
    return onUpdateCharacter(character.id, { [`attributes.${key}.value`]: val });
  };

  const handleAddAttribute = async (e) => {
    e.preventDefault();
    setAttrError(null);
    const label = newAttrLabel.trim();
    if (!canEdit || !label) return;
    const cleanKey = normalizeFormulaKey(label);
    if (!cleanKey) {
      setAttrError("Informe um nome válido para o atributo.");
      return;
    }
    if (RESERVED_FORMULA_KEY_SET.has(cleanKey)) {
      setAttrError(`A chave "@${cleanKey}" é reservada e não pode ser usada.`);
      return;
    }
    const skillKeys = Array.isArray(character.skills)
      ? character.skills.map((s) => s.key || normalizeFormulaKey(s.name))
      : Object.keys(character.skills || {});
    if (
      attrList.some((a) => a.key === cleanKey) ||
      skillKeys.includes(cleanKey)
    ) {
      setAttrError(`A chave "@${cleanKey}" já existe na ficha.`);
      return;
    }

    try {
      if (onAddCharacterEntry) {
        await onAddCharacterEntry(character.id, "attributes", {
          key: cleanKey,
          label,
          value: 2
        });
      } else if (Array.isArray(character.attributes)) {
        await onUpdateCharacter(character.id, {
          attributes: [...attrList, { key: cleanKey, label, value: 2 }]
        });
      } else {
        await onUpdateCharacter(character.id, {
          [`attributes.${cleanKey}`]: {
            key: cleanKey,
            label,
            value: 2,
            order: attrList.length
          }
        });
      }
      setNewAttrLabel("");
    } catch (err) {
      setAttrError(err?.message || "Erro ao adicionar atributo.");
    }
  };

  const handleConfirmRemoveAttribute = async () => {
    if (!canEdit || !confirmDeleteAttr) return;
    const key = confirmDeleteAttr.key;
    setConfirmDeleteAttr(null);
    try {
      if (onRemoveCharacterEntry) {
        await onRemoveCharacterEntry(character.id, "attributes", key);
        return;
      }
      if (Array.isArray(character.attributes)) {
        await onUpdateCharacter(character.id, {
          attributes: attrList.filter((a) => a.key !== key)
        });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      {/* Barra de Recursos: HP, MP, Defesa e Token */}
      <div
        style={{
          background: "#f0f6fc",
          border: "2px solid #cbd5e1",
          borderRadius: "12px",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Vida */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 800,
                marginBottom: "3px"
              }}
            >
              <span style={{ color: "#c62828" }}>VIDA (HP)</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <DebouncedField
                  type="number"
                  disabled={!canEdit}
                  value={hp.current}
                  onCommit={(value) =>
                    handleUpdateResource("hp", "current", value)
                  }
                  style={{
                    width: "42px",
                    textAlign: "center",
                    fontWeight: 800,
                    borderRadius: "5px",
                    border: "1.5px solid #001b3a",
                    padding: "1px 2px"
                  }}
                />
                <span>/</span>
                <DebouncedField
                  type="number"
                  disabled={!canEdit}
                  value={hp.max}
                  onCommit={(value) =>
                    handleUpdateResource("hp", "max", value)
                  }
                  style={{
                    width: "42px",
                    textAlign: "center",
                    fontWeight: 800,
                    borderRadius: "5px",
                    border: "1.5px solid #001b3a",
                    padding: "1px 2px"
                  }}
                />
              </div>
            </div>
            <div
              style={{
                height: "9px",
                background: "#1a202c",
                borderRadius: "999px",
                overflow: "hidden",
                border: "1.5px solid #001b3a"
              }}
            >
              <div
                style={{
                  width: `${hpPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #ff5252, #c62828)"
                }}
              />
            </div>
          </div>

          {/* Energia */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "11px",
                fontWeight: 800,
                marginBottom: "3px"
              }}
            >
              <span style={{ color: "#02529c" }}>ENERGIA (MP)</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <DebouncedField
                  type="number"
                  disabled={!canEdit}
                  value={mp.current}
                  onCommit={(value) =>
                    handleUpdateResource("mp", "current", value)
                  }
                  style={{
                    width: "42px",
                    textAlign: "center",
                    fontWeight: 800,
                    borderRadius: "5px",
                    border: "1.5px solid #001b3a",
                    padding: "1px 2px"
                  }}
                />
                <span>/</span>
                <DebouncedField
                  type="number"
                  disabled={!canEdit}
                  value={mp.max}
                  onCommit={(value) =>
                    handleUpdateResource("mp", "max", value)
                  }
                  style={{
                    width: "42px",
                    textAlign: "center",
                    fontWeight: 800,
                    borderRadius: "5px",
                    border: "1.5px solid #001b3a",
                    padding: "1px 2px"
                  }}
                />
              </div>
            </div>
            <div
              style={{
                height: "9px",
                background: "#1a202c",
                borderRadius: "999px",
                overflow: "hidden",
                border: "1.5px solid #001b3a"
              }}
            >
              <div
                style={{
                  width: `${mpPercent}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #42a5f5, #02529c)"
                }}
              />
            </div>
          </div>
        </div>

        {/* Defesa, Nível e Token */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginTop: "2px",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <div
              style={{
                background: "#ffffff",
                border: "1.5px solid #94a3b8",
                borderRadius: "8px",
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <strong style={{ fontSize: "11px", color: "#334155" }}>DEFESA</strong>
              <DebouncedField
                type="number"
                disabled={!canEdit}
                value={character.defense ?? 10}
                onCommit={(value) =>
                  onUpdateCharacter(character.id, {
                    defense: Number(value) || 0
                  })
                }
                style={{
                  width: "36px",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                  textAlign: "right",
                  background: "transparent"
                }}
              />
            </div>

            <div
              style={{
                background: "#ffffff",
                border: "1.5px solid #94a3b8",
                borderRadius: "8px",
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <strong style={{ fontSize: "11px", color: "#334155" }}>NÍVEL</strong>
              <DebouncedField
                type="number"
                disabled={!canEdit}
                value={character.level ?? 1}
                onCommit={(value) =>
                  onUpdateCharacter(character.id, {
                    level: Number(value) || 1
                  })
                }
                style={{
                  width: "36px",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "14px",
                  textAlign: "right",
                  background: "transparent"
                }}
              />
            </div>
          </div>

          {/* Token */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                border: `2px solid ${cardBgColor}`,
                background: "#022c57",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              {tokenUrl ? (
                <img
                  src={tokenUrl}
                  alt="Token"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span className="cp-title" style={{ fontSize: "10px" }}>TK</span>
              )}
            </div>

            {canEdit && (
              <label className="cp-btn" style={{ padding: "3px 8px", fontSize: "10px" }}>
                Token
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      await onUploadCharacterImage(character.id, f, "token");
                    } catch {
                      // Erro já notificado pelo hook
                    }
                  }}
                />
              </label>
            )}

            {canEdit && (
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#334155",
                  cursor: "pointer"
                }}
                title="Exibir nome do token no mapa"
              >
                <input
                  type="checkbox"
                  checked={tokenShowName}
                  onChange={async (e) => {
                    try {
                      await onUpdateCharacter(character.id, {
                        "token.showName": e.target.checked
                      });
                    } catch {
                      // Erro já notificado pelo hook
                    }
                  }}
                />
                Nome
              </label>
            )}

            {onSpawnTokenOnMap && canEdit && (
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "3px 8px", fontSize: "10px" }}
                onClick={() =>
                  onSpawnTokenOnMap(character, {
                    showName: tokenShowName
                  })
                }
              >
                + No Mapa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Seção Atributos */}
      <div>
        <strong style={{ fontSize: "12px", color: "#003264", textTransform: "uppercase" }}>
          Atributos Principais
        </strong>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
            gap: "6px",
            marginTop: "4px"
          }}
        >
          {attrList.map((attr) => (
            <div
              key={attr.key}
              style={{
                background: "#ffffff",
                border: "2px solid #cbd5e1",
                borderRadius: "10px",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                boxShadow: "0 2px 4px rgba(0,27,58,0.06)"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center"
                }}
              >
                <strong style={{ fontSize: "11px", color: "#1e293b" }}>{attr.label}</strong>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDeleteAttr({ key: attr.key, label: attr.label })
                    }
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef5350",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: "11px",
                      padding: 0
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              <DebouncedField
                type="number"
                className="cp-input"
                disabled={!canEdit}
                value={attr.value}
                onCommit={(value) => handleUpdateAttrValue(attr.key, value)}
                style={{
                  textAlign: "center",
                  fontSize: "16px",
                  fontWeight: 900,
                  padding: "2px",
                  height: "26px"
                }}
              />

              <div style={{ display: "flex", gap: "3px", width: "100%" }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{
                    flex: 1,
                    padding: "3px 4px",
                    fontSize: "10px",
                    height: "24px"
                  }}
                  onClick={() =>
                    triggerRoll({
                      title: `Teste de ${attr.label}`,
                      categoryColor: "#02529c",
                      primaryFormula: `1d20 + @${attr.key}`,
                      primaryLabel: attr.label,
                      rollKind: ROLL_KINDS.CHECK
                    })
                  }
                >
                  🎲 Rolar
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                    onClick={() =>
                      pinToRollGroup({
                        sourceType: "attribute",
                        sourceId: attr.key,
                        name: `Teste ${attr.label}`,
                        color: "#02529c",
                        hitFormula: `1d20 + @${attr.key}`,
                        rollKind: ROLL_KINDS.CHECK
                      })
                    }
                    title="Fixar na Aba Rolagens"
                  >
                    ★
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <form
            onSubmit={handleAddAttribute}
            style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                className="cp-input"
                style={{ maxWidth: "160px", padding: "3px 8px", fontSize: "11px", height: "26px" }}
                placeholder="Novo Atributo..."
                value={newAttrLabel}
                onChange={(e) => {
                  setAttrError(null);
                  setNewAttrLabel(e.target.value);
                }}
              />
              <button
                type="submit"
                className="cp-btn"
                style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
              >
                + Atributo
              </button>
            </div>
            {attrError && (
              <div role="alert" style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
                {attrError}
              </div>
            )}
          </form>
        )}
      </div>

      {confirmDeleteAttr && (
        <ConfirmDialog
          title="Excluir atributo?"
          question={`Remover "${confirmDeleteAttr.label}" (@${confirmDeleteAttr.key}) da ficha?`}
          confirmLabel="Excluir"
          onConfirm={handleConfirmRemoveAttribute}
          onCancel={() => setConfirmDeleteAttr(null)}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </div>
  );
}
