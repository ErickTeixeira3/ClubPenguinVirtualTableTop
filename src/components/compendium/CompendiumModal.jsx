import { useState, useMemo } from "react";

const ELEMENT_COLORS = [
  { color: "#e53935", label: "Fogo" },
  { color: "#1e88e5", label: "Água" },
  { color: "#00bcd4", label: "Neve" },
  { color: "#fdd835", label: "Ouro" },
  { color: "#6a1b9a", label: "Sombra" },
  { color: "#38c172", label: "Natureza" }
];

const createUniqueId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

export default function CompendiumModal({
  entries,
  isGM,
  characters = [],
  activeCharacter = null,
  canEditCharacter,
  onUpdateCharacter,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onClose
}) {
  const [filterType, setFilterType] = useState("ALL"); // 'ALL' | 'ability' | 'spell' | 'skill' | 'item'
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);

  const userCharacters = useMemo(() => {
    if (!characters) return [];
    if (isGM) return characters;
    return characters.filter((c) => (canEditCharacter ? canEditCharacter(c) : true));
  }, [characters, isGM, canEditCharacter]);

  const [selectedTargetCharId, setSelectedTargetCharId] = useState(
    () => activeCharacter?.id || userCharacters[0]?.id || ""
  );

  const [addedFeedback, setAddedFeedback] = useState({});

  const handleAddToCharacter = (entry) => {
    const targetChar =
      userCharacters.find((c) => c.id === selectedTargetCharId) ||
      activeCharacter ||
      userCharacters[0];
    if (!targetChar || !onUpdateCharacter) return;

    if (entry.type === "item") {
      const currentInv = Array.isArray(targetChar.inventory) ? targetChar.inventory : [];
      onUpdateCharacter(targetChar.id, {
        inventory: [
          ...currentInv,
          {
            id: createUniqueId("inv"),
            name: entry.name,
            qty: 1,
            elementColor: entry.elementColor || "#38c172",
            rollFormula: entry.effectFormula || entry.hitFormula || "",
            description: entry.description || ""
          }
        ]
      });
    } else if (entry.type === "skill") {
      const currentSkills = Array.isArray(targetChar.skills) ? targetChar.skills : [];
      onUpdateCharacter(targetChar.id, {
        skills: [
          ...currentSkills,
          {
            id: createUniqueId("sk"),
            name: entry.name,
            attribute: entry.attribute || "forca",
            bonus: Number(entry.bonus) || 2,
            formula: entry.hitFormula || `1d20 + @${entry.attribute || "forca"}`
          }
        ]
      });
    } else {
      // ability / spell
      const currentAbilities = Array.isArray(targetChar.abilities) ? targetChar.abilities : [];
      onUpdateCharacter(targetChar.id, {
        abilities: [
          ...currentAbilities,
          {
            id: createUniqueId("ab"),
            name: entry.name,
            elementColor: entry.elementColor || "#e53935",
            cost: entry.cost || {
              resource: entry.costResource || "mp",
              amount: Number(entry.costAmount) || 0
            },
            hitFormula: entry.hitFormula || "",
            effectFormula: entry.effectFormula || "",
            description: entry.description || ""
          }
        ]
      });
    }

    setAddedFeedback((prev) => ({ ...prev, [entry.id]: true }));
    setTimeout(() => {
      setAddedFeedback((prev) => ({ ...prev, [entry.id]: false }));
    }, 2000);
  };

  const [name, setName] = useState("");
  const [type, setType] = useState("ability");
  const [elementColor, setElementColor] = useState("#e53935");
  const [costResource, setCostResource] = useState("mp");
  const [costAmount, setCostAmount] = useState(0);
  const [hitFormula, setHitFormula] = useState("1d20 + @forca");
  const [effectFormula, setEffectFormula] = useState("1d8 + @forca");
  const [description, setDescription] = useState("");
  const [visibleToPlayers, setVisibleToPlayers] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setType("ability");
    setElementColor("#e53935");
    setCostResource("mp");
    setCostAmount(0);
    setHitFormula("1d20 + @forca");
    setEffectFormula("1d8 + @forca");
    setDescription("");
    setVisibleToPlayers(true);
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setName(entry.name || "");
    setType(entry.type || "ability");
    setElementColor(entry.elementColor || "#e53935");
    setCostResource(entry.cost?.resource || "mp");
    setCostAmount(entry.cost?.amount ?? 0);
    setHitFormula(entry.hitFormula || "");
    setEffectFormula(entry.effectFormula || "");
    setDescription(entry.description || "");
    setVisibleToPlayers(entry.visibleToPlayers !== false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !isGM) return;

    if (editingId) {
      await onUpdateEntry(editingId, {
        name: name.trim(),
        type,
        elementColor,
        cost: {
          resource: costResource,
          amount: Math.max(0, Number(costAmount) || 0)
        },
        hitFormula: hitFormula.trim(),
        effectFormula: effectFormula.trim(),
        description: description.trim(),
        visibleToPlayers
      });
    } else {
      await onCreateEntry({
        name: name.trim(),
        type,
        elementColor,
        costResource,
        costAmount,
        hitFormula: hitFormula.trim(),
        effectFormula: effectFormula.trim(),
        description: description.trim(),
        visibleToPlayers
      });
    }
    resetForm();
  };

  const filteredEntries = (entries || []).filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (
      search.trim() &&
      !(e.name || "").toLowerCase().includes(search.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const typeLabel = (t) => {
    switch (t) {
      case "ability":
        return "HABILIDADE";
      case "spell":
        return "MAGIA";
      case "skill":
        return "PERÍCIA";
      case "item":
        return "ITEM";
      default:
        return "CARD";
    }
  };

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="cp-window"
        style={{
          width: "100%",
          maxWidth: isGM ? "920px" : "680px",
          maxHeight: "90vh",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "22px" }}>
            LIVRO DO MESTRE & COMPÊNDIO CARD-JITSU
          </h2>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 12px", fontSize: "13px" }}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isGM ? "320px 1fr" : "1fr",
            gap: "12px",
            overflow: "hidden",
            flex: 1
          }}
        >
          {/* Formulário Exclusivo do Mestre */}
          {isGM && (
            <form
              onSubmit={handleSubmit}
              className="cp-window-inner"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                overflowY: "auto"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <strong style={{ fontSize: "14px" }}>
                  {editingId ? "Editar Card" : "Novo Card do Sistema"}
                </strong>
                {editingId && (
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={resetForm}
                  >
                    Novo
                  </button>
                )}
              </div>

              <input
                type="text"
                className="cp-input"
                placeholder="Nome (ex: Bola de Fogo, Espada)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <select
                className="cp-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="ability">Habilidade</option>
                <option value="spell">Magia / Técnica</option>
                <option value="skill">Perícia</option>
                <option value="item">Item / Equipamento</option>
              </select>

              <div style={{ display: "flex", gap: "6px" }}>
                {ELEMENT_COLORS.map((el) => (
                  <button
                    key={el.color}
                    type="button"
                    onClick={() => setElementColor(el.color)}
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "6px",
                      background: el.color,
                      border:
                        elementColor === el.color
                          ? "3px solid #001b3a"
                          : "1.5px solid #ffffff",
                      cursor: "pointer"
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "6px"
                }}
              >
                <select
                  className="cp-input"
                  value={costResource}
                  onChange={(e) => setCostResource(e.target.value)}
                >
                  <option value="mp">Custo MP</option>
                  <option value="hp">Custo HP</option>
                </select>
                <input
                  type="number"
                  className="cp-input"
                  min={0}
                  placeholder="Valor Custo"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                />
              </div>

              <input
                type="text"
                className="cp-input"
                placeholder="Fórmula Principal (ex: 1d20 + @forca)"
                value={hitFormula}
                onChange={(e) => setHitFormula(e.target.value)}
              />

              <input
                type="text"
                className="cp-input"
                placeholder="Fórmula Dano/Efeito (ex: 2d6 + @forca)"
                value={effectFormula}
                onChange={(e) => setEffectFormula(e.target.value)}
              />

              <textarea
                className="cp-input"
                rows={3}
                placeholder="Descrição / Regras"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleToPlayers}
                  onChange={(e) => setVisibleToPlayers(e.target.checked)}
                />
                Liberado para os Players
              </label>

              <button
                type="submit"
                className="cp-btn cp-btn-green"
                style={{ width: "100%" }}
              >
                {editingId ? "Salvar Card" : "Adicionar ao Compêndio"}
              </button>
            </form>
          )}

          {/* Catálogo de Cards Estilo Card-Jitsu */}
          <div
            className="cp-window-inner"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {["ALL", "ability", "spell", "skill", "item"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`cp-btn ${
                    filterType === cat ? "cp-btn-gold" : ""
                  }`}
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                  onClick={() => setFilterType(cat)}
                >
                  {cat === "ALL" ? "Todos" : typeLabel(cat)}
                </button>
              ))}

              <input
                type="text"
                className="cp-input"
                style={{ flex: 1, minWidth: "140px", padding: "5px 10px" }}
                placeholder="Buscar no compêndio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {userCharacters.length > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#001b3a",
                  marginBottom: "8px",
                  background: "#f8fafc",
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1"
                }}
              >
                <span>Ficha de Destino:</span>
                <select
                  className="cp-input"
                  style={{ padding: "2px 6px", fontSize: "11px" }}
                  value={selectedTargetCharId}
                  onChange={(e) => setSelectedTargetCharId(e.target.value)}
                >
                  {userCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "10px"
              }}
            >
              {filteredEntries.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#ffffff",
                    border: `4px solid ${item.elementColor || "#3090f0"}`,
                    borderRadius: "14px",
                    padding: "10px",
                    boxShadow: "0 4px 0 #001b3a",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "6px"
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <span
                        style={{
                          background: item.elementColor || "#3090f0",
                          color: "#ffffff",
                          fontFamily: "var(--font-display)",
                          fontSize: "10px",
                          padding: "2px 7px",
                          borderRadius: "999px"
                        }}
                      >
                        {typeLabel(item.type)}
                      </span>

                      {item.cost?.amount > 0 && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "#02529c"
                          }}
                        >
                          {item.cost.amount}{" "}
                          {(item.cost.resource || "mp").toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "15px",
                        marginTop: "4px"
                      }}
                    >
                      {item.name}
                    </div>

                    {item.hitFormula && (
                      <div
                        style={{
                          fontFamily: "var(--font-epf)",
                          fontSize: "12px",
                          color: "#013567"
                        }}
                      >
                        Rolagem: {item.hitFormula}
                      </div>
                    )}

                    {item.effectFormula && (
                      <div
                        style={{
                          fontFamily: "var(--font-epf)",
                          fontSize: "12px",
                          color: "#b71c1c"
                        }}
                      >
                        Efeito: {item.effectFormula}
                      </div>
                    )}

                    {item.description && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--cp-text-muted)",
                          marginTop: "4px"
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      marginTop: "6px",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    {userCharacters.length > 0 && (
                      <button
                        type="button"
                        className={`cp-btn ${addedFeedback[item.id] ? "cp-btn-green" : "cp-btn-gold"}`}
                        style={{ padding: "3px 8px", fontSize: "10px" }}
                        onClick={() => handleAddToCharacter(item)}
                        title="Adicionar habilidade à sua ficha"
                      >
                        {addedFeedback[item.id] ? "✓ Adicionado!" : "+ Na Ficha"}
                      </button>
                    )}

                    {isGM && (
                      <div
                        style={{
                          display: "flex",
                          gap: "4px",
                          marginLeft: "auto"
                        }}
                      >
                        <button
                          type="button"
                          className="cp-btn cp-btn-epf"
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                          onClick={() =>
                            onUpdateEntry(item.id, {
                              visibleToPlayers: !item.visibleToPlayers
                            })
                          }
                        >
                          {item.visibleToPlayers ? "Visível" : "Oculto"}
                        </button>
                        <button
                          type="button"
                          className="cp-btn"
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                          onClick={() => handleEdit(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="cp-btn cp-btn-orange"
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                          onClick={() => onDeleteEntry(item.id)}
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

