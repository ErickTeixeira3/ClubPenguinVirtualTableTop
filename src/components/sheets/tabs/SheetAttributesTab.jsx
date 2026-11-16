import { ROLL_KINDS } from "../../../engines/combatEngine";
import { normalizeCompactKey } from "../../../utils/stringUtils";
import DebouncedField from "../../ui/DebouncedField";

/**
 * Fase 5: aba "Atributos" da Ficha (Barras de HP/MP, Defesa, Nível, Token e Atributos),
 * extraída de CharacterSheetModal.jsx com JSX e handlers inalterados.
 */
export default function SheetAttributesTab({
  canEdit,
  hp,
  mp,
  character,
  onUpdateCharacter,
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
  const hpPercent =
    hp.max > 0 ? Math.min(100, Math.max(0, (hp.current / hp.max) * 100)) : 0;

  const mpPercent =
    mp.max > 0 ? Math.min(100, Math.max(0, (mp.current / mp.max) * 100)) : 0;

  const handleUpdateResource = (resKey, field, val) => {
    if (!canEdit) return Promise.resolve();
    const cleanVal = Math.max(0, Number(val) || 0);
    // Fase 6.6 (A30): atualiza apenas o subcampo alterado para não sobrescrever dano/gasto em sibling fields
    if (!character.resources?.[resKey]) {
      return onUpdateCharacter(character.id, {
        [`resources.${resKey}`]: {
          label: resKey === "mp" ? "Energia" : resKey === "hp" ? "Vida" : resKey.toUpperCase(),
          current: field === "current" ? cleanVal : 10,
          max: field === "max" ? cleanVal : 10
        }
      });
    }
    return onUpdateCharacter(character.id, {
      [`resources.${resKey}.${field}`]: cleanVal
    });
  };

  const handleUpdateAttrValue = (key, value) => {
    if (!canEdit) return Promise.resolve();
    const val = Number(value) || 0;
    const nextAttrs = attributes.map((a) =>
      a.key === key ? { ...a, value: val } : a
    );
    return onUpdateCharacter(character.id, { attributes: nextAttrs });
  };

  const handleAddAttribute = (e) => {
    e.preventDefault();
    if (!canEdit || !newAttrLabel.trim()) return;
    const cleanKey = normalizeCompactKey(newAttrLabel);
    if (!cleanKey || attributes.some((a) => a.key === cleanKey)) return;
    onUpdateCharacter(character.id, {
      attributes: [
        ...attributes,
        { key: cleanKey, label: newAttrLabel.trim(), value: 2 }
      ]
    });
    setNewAttrLabel("");
  };

  const handleRemoveAttribute = (key) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      attributes: attributes.filter((a) => a.key !== key)
    });
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
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadCharacterImage(character.id, f, "token");
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
                  checked={character.defaultToken?.showName !== false}
                  onChange={(e) => {
                    onUpdateCharacter(character.id, {
                      defaultToken: {
                        ...(character.defaultToken || {}),
                        showName: e.target.checked
                      }
                    });
                  }}
                />
                Nome
              </label>
            )}

            {/* Fase 6.2 (A11): só quem pode editar a ficha coloca o token no mapa (mesma regra do serviço) */}
            {onSpawnTokenOnMap && canEdit && (
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "3px 8px", fontSize: "10px" }}
                onClick={() =>
                  onSpawnTokenOnMap(character, {
                    showName: character.defaultToken?.showName !== false
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
          {attributes.map((attr) => (
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
                    onClick={() => handleRemoveAttribute(attr.key)}
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
                onCommit={(value) =>
                  handleUpdateAttrValue(attr.key, value)
                }
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
            style={{ display: "flex", gap: "6px", marginTop: "6px" }}
          >
            <input
              type="text"
              className="cp-input"
              style={{ maxWidth: "160px", padding: "3px 8px", fontSize: "11px", height: "26px" }}
              placeholder="Novo Atributo..."
              value={newAttrLabel}
              onChange={(e) => setNewAttrLabel(e.target.value)}
            />
            <button
              type="submit"
              className="cp-btn"
              style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
            >
              + Atributo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
