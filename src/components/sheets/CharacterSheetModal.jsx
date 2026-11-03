import { useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";

const CARD_COLORS = [
  "#02529c",
  "#3090f0",
  "#c62828",
  "#2e7d32",
  "#f59f00",
  "#d84315",
  "#6a1b9a",
  "#ad1457",
  "#00838f",
  "#1a202c"
];

export default function CharacterSheetModal({
  character,
  campaignId,
  playersMap = {},
  compendiumEntries = [],
  canEdit,
  isGM,
  rollVisibility = "public",
  onChangeRollVisibility,
  onUpdateCharacter,
  onUploadCharacterImage,
  onExecuteRoll,
  onSpawnTokenOnMap,
  onClose,
  isStandaloneWindow = false
}) {
  // 'main' | 'inventory' | 'notes' | 'rolls'
  const [activeTab, setActiveTab] = useState("main");
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(
    character?.rollGroups?.[0]?.id || "grp_combate"
  );

  // Estados para adição rápida
  const [newAttrLabel, setNewAttrLabel] = useState("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillAttr, setNewSkillAttr] = useState("forca");
  const [newSkillBonus, setNewSkillBonus] = useState(2);

  const [newAbilityOpen, setNewAbilityOpen] = useState(false);
  const [abName, setAbName] = useState("");
  const [abColor, setAbColor] = useState("#e53935");
  const [abCostRes, setAbCostRes] = useState("mp");
  const [abCostAmt, setAbCostAmt] = useState(0);
  const [abHit, setAbHit] = useState("1d20 + @forca");
  const [abEffect, setAbEffect] = useState("1d8 + @forca");
  const [abDesc, setAbDesc] = useState("");

  const [newItemOpen, setNewItemOpen] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemFormula, setItemFormula] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [newCustomRollOpen, setNewCustomRollOpen] = useState(false);
  const [crName, setCrName] = useState("");
  const [crColor, setCrColor] = useState("#3090f0");
  const [crHit, setCrHit] = useState("1d20 + @forca");
  const [crEffect, setCrEffect] = useState("");
  const [crCostRes, setCrCostRes] = useState("mp");
  const [crCostAmt, setCrCostAmt] = useState(0);

  const { url: avatarUrl } = useMediaUrl(
    character?.avatarMediaId,
    character?.avatarExternalUrl,
    campaignId
  );

  const { url: tokenUrl } = useMediaUrl(
    character?.defaultToken?.mediaId || character?.avatarMediaId,
    character?.defaultToken?.externalUrl || character?.avatarExternalUrl,
    campaignId
  );

  if (!character) return null;

  const cardBgColor = character.cardColor || "#02529c";
  const attributes = Array.isArray(character.attributes)
    ? character.attributes
    : [];
  const skills = Array.isArray(character.skills) ? character.skills : [];
  const abilities = Array.isArray(character.abilities)
    ? character.abilities
    : [];
  const inventory = Array.isArray(character.inventory)
    ? character.inventory
    : [];
  const rollGroups = Array.isArray(character.rollGroups)
    ? character.rollGroups
    : [];

  const hp = character.resources?.hp || { label: "Vida", current: 20, max: 20 };
  const mp = character.resources?.mp || {
    label: "Energia",
    current: 10,
    max: 10
  };
  const hpPercent =
    hp.max > 0 ? Math.min(100, Math.max(0, (hp.current / hp.max) * 100)) : 0;
  const mpPercent =
    mp.max > 0 ? Math.min(100, Math.max(0, (mp.current / mp.max) * 100)) : 0;

  const handlePopoutWindow = () => {
    const url = `${window.location.origin}${window.location.pathname}?sheetId=${encodeURIComponent(character.id)}`;
    window.open(
      url,
      `cpvtt_sheet_${character.id}`,
      "width=1080,height=760,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  const handleUpdateResource = (resKey, field, val) => {
    if (!canEdit) return;
    const targetRes = character.resources?.[resKey] || {
      label: resKey.toUpperCase(),
      current: 10,
      max: 10
    };
    onUpdateCharacter(character.id, {
      [`resources.${resKey}`]: {
        ...targetRes,
        [field]: Math.max(0, Number(val) || 0)
      }
    });
  };

  // Disparo de rolagens direto da ficha
  const triggerRoll = (config) => {
    onExecuteRoll({
      ...config,
      character,
      visibility: rollVisibility
    });
  };

  // Fixar qualquer rolagem na Aba de Rolagens Personalizadas
  const pinToRollGroup = (rollEntry, targetGroupId = null) => {
    if (!canEdit) return;
    const groups =
      rollGroups.length > 0
        ? [...rollGroups]
        : [{ id: "grp_combate", name: "Ações Rápidas", rolls: [] }];

    const groupIdToUse = targetGroupId || selectedGroupId || groups[0].id;
    const nextGroups = groups.map((g) => {
      if (g.id !== groupIdToUse) return g;
      return {
        ...g,
        rolls: [
          ...(g.rolls || []),
          {
            id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            name: rollEntry.name,
            color: rollEntry.color || "#3090f0",
            hitFormula: rollEntry.hitFormula || "1d20",
            effectFormula: rollEntry.effectFormula || "",
            costResource: rollEntry.costResource || "mp",
            costAmount: Number(rollEntry.costAmount) || 0
          }
        ]
      };
    });

    onUpdateCharacter(character.id, { rollGroups: nextGroups });
    setActiveTab("rolls");
  };

  // CRUD de Atributos
  const handleUpdateAttrValue = (key, nextVal) => {
    if (!canEdit) return;
    const nextAttrs = attributes.map((a) =>
      a.key === key ? { ...a, value: Number(nextVal) || 0 } : a
    );
    onUpdateCharacter(character.id, { attributes: nextAttrs });
  };

  const handleAddAttribute = (e) => {
    e.preventDefault();
    if (!canEdit || !newAttrLabel.trim()) return;
    const cleanKey = newAttrLabel
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!cleanKey) return;
    onUpdateCharacter(character.id, {
      attributes: [
        ...attributes,
        { key: cleanKey, label: newAttrLabel.trim(), value: 1 }
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

  // CRUD de Skills
  const handleAddSkill = (e) => {
    e.preventDefault();
    if (!canEdit || !newSkillName.trim()) return;
    const cleanName = newSkillName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const newSkill = {
      id: `sk_${Date.now()}`,
      name: newSkillName.trim(),
      attribute: newSkillAttr,
      bonus: Number(newSkillBonus) || 0,
      formula: `1d20 + @${newSkillAttr} + @${cleanName}`
    };
    onUpdateCharacter(character.id, {
      skills: [...skills, newSkill]
    });
    setNewSkillName("");
  };

  const handleUpdateSkill = (skillId, field, value) => {
    if (!canEdit) return;
    const nextSkills = skills.map((s) =>
      s.id === skillId ? { ...s, [field]: value } : s
    );
    onUpdateCharacter(character.id, { skills: nextSkills });
  };

  const handleDeleteSkill = (skillId) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      skills: skills.filter((s) => s.id !== skillId)
    });
  };

  // CRUD de Habilidades & Magias
  const handleAddAbility = (e) => {
    e.preventDefault();
    if (!canEdit || !abName.trim()) return;
    const nextAb = {
      id: `ab_${Date.now()}`,
      name: abName.trim(),
      elementColor: abColor,
      cost: { resource: abCostRes, amount: Number(abCostAmt) || 0 },
      hitFormula: abHit.trim(),
      effectFormula: abEffect.trim(),
      description: abDesc.trim()
    };
    onUpdateCharacter(character.id, {
      abilities: [...abilities, nextAb]
    });
    setAbName("");
    setAbDesc("");
    setNewAbilityOpen(false);
  };

  const handlePullFromCompendium = (entry) => {
    if (!canEdit || !entry) return;
    if (entry.type === "item") {
      onUpdateCharacter(character.id, {
        inventory: [
          ...inventory,
          {
            id: `inv_${Date.now()}`,
            name: entry.name,
            qty: 1,
            elementColor: entry.elementColor || "#38c172",
            rollFormula: entry.effectFormula || entry.hitFormula || "",
            description: entry.description || ""
          }
        ]
      });
    } else if (entry.type === "skill") {
      onUpdateCharacter(character.id, {
        skills: [
          ...skills,
          {
            id: `sk_${Date.now()}`,
            name: entry.name,
            attribute: entry.attribute || "forca",
            bonus: Number(entry.bonus) || 2,
            formula: entry.hitFormula || `1d20 + @${entry.attribute || "forca"}`
          }
        ]
      });
    } else {
      onUpdateCharacter(character.id, {
        abilities: [
          ...abilities,
          {
            id: `ab_${Date.now()}`,
            name: entry.name,
            elementColor: entry.elementColor || "#e53935",
            cost: entry.cost || { resource: "mp", amount: 0 },
            hitFormula: entry.hitFormula || "",
            effectFormula: entry.effectFormula || "",
            description: entry.description || ""
          }
        ]
      });
    }
  };

  const handleDeleteAbility = (abId) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      abilities: abilities.filter((a) => a.id !== abId)
    });
  };

  // CRUD de Inventário
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!canEdit || !itemName.trim()) return;
    onUpdateCharacter(character.id, {
      inventory: [
        ...inventory,
        {
          id: `inv_${Date.now()}`,
          name: itemName.trim(),
          qty: Math.max(1, Number(itemQty) || 1),
          elementColor: "#38c172",
          rollFormula: itemFormula.trim(),
          description: itemDesc.trim()
        }
      ]
    });
    setItemName("");
    setItemFormula("");
    setItemDesc("");
    setNewItemOpen(false);
  };

  const handleAdjustItemQty = (itemId, delta) => {
    if (!canEdit) return;
    const nextInv = inventory
      .map((it) =>
        it.id === itemId
          ? { ...it, qty: Math.max(0, (Number(it.qty) || 0) + delta) }
          : it
      )
      .filter((it) => it.qty > 0);
    onUpdateCharacter(character.id, { inventory: nextInv });
  };

  // CRUD de Grupos de Rolagem Personalizáveis (Aba 4)
  const handleCreateRollGroup = (e) => {
    e.preventDefault();
    if (!canEdit || !newGroupName.trim()) return;
    const newGrp = {
      id: `grp_${Date.now()}`,
      name: newGroupName.trim(),
      rolls: []
    };
    onUpdateCharacter(character.id, {
      rollGroups: [...rollGroups, newGrp]
    });
    setSelectedGroupId(newGrp.id);
    setNewGroupName("");
  };

  const handleDeleteRollGroup = (grpId) => {
    if (!canEdit) return;
    const next = rollGroups.filter((g) => g.id !== grpId);
    onUpdateCharacter(character.id, { rollGroups: next });
    if (selectedGroupId === grpId) {
      setSelectedGroupId(next[0]?.id || "");
    }
  };

  const handleAddCustomRollToGroup = (e) => {
    e.preventDefault();
    if (!canEdit || !crName.trim()) return;
    pinToRollGroup(
      {
        name: crName.trim(),
        color: crColor,
        hitFormula: crHit.trim(),
        effectFormula: crEffect.trim(),
        costResource: crCostRes,
        costAmount: Number(crCostAmt) || 0
      },
      selectedGroupId
    );
    setCrName("");
    setCrEffect("");
    setNewCustomRollOpen(false);
  };

  const handleRemoveRollFromGroup = (groupId, rollId) => {
    if (!canEdit) return;
    const next = rollGroups.map((g) =>
      g.id === groupId
        ? { ...g, rolls: (g.rolls || []).filter((r) => r.id !== rollId) }
        : g
    );
    onUpdateCharacter(character.id, { rollGroups: next });
  };

  const handleMoveRollOrder = (groupId, index, direction) => {
    if (!canEdit) return;
    const next = rollGroups.map((g) => {
      if (g.id !== groupId) return g;
      const list = [...(g.rolls || [])];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return g;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...g, rolls: list };
    });
    onUpdateCharacter(character.id, { rollGroups: next });
  };

  const togglePermissionUid = (field, uidOrAll) => {
    if (!isGM) return;
    const currentList = Array.isArray(character[field]) ? character[field] : [];
    const exists = currentList.includes(uidOrAll);
    const nextList = exists
      ? currentList.filter((id) => id !== uidOrAll)
      : [...currentList, uidOrAll];
    onUpdateCharacter(character.id, { [field]: nextList });
  };

  const wrapperStyle = isStandaloneWindow
    ? {
        width: "100vw",
        height: "100vh",
        padding: "12px",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center"
      }
    : undefined;

  const sheetBody = (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        maxWidth: isStandaloneWindow ? "1280px" : "1040px",
        height: isStandaloneWindow ? "95vh" : "86vh",
        maxHeight: "780px"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* LADO ESQUERDO: PLAYER CARD DO PINGUIM (ESTILO CLÁSSICO CLUB PENGUIN) */}
      <div
        className="cp-window"
        style={{
          width: "320px",
          flexShrink: 0,
          background: `linear-gradient(180deg, ${cardBgColor} 0%, #012247 100%)`,
          borderRadius: "22px 0 0 22px",
          borderRight: "none",
          justifyContent: "space-between",
          overflowY: "auto"
        }}
      >
        {/* Topo do Player Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px"
            }}
          >
            <input
              type="text"
              value={character.name || ""}
              disabled={!canEdit}
              onChange={(e) =>
                onUpdateCharacter(character.id, { name: e.target.value })
              }
              style={{
                background: "rgba(0, 27, 58, 0.45)",
                border: "2px solid rgba(255,255,255,0.35)",
                borderRadius: "10px",
                color: "#ffffff",
                fontFamily: "var(--font-display)",
                fontSize: "18px",
                padding: "4px 8px",
                width: "100%",
                textAlign: "center"
              }}
            />

            {!isStandaloneWindow && (
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ padding: "4px 8px", fontSize: "12px" }}
                onClick={handlePopoutWindow}
                title="Abrir em Nova Janela"
              >
                ↗
              </button>
            )}
          </div>

          {/* Paleta de Cores do Cartão do Pinguim */}
          {canEdit && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "5px",
                flexWrap: "wrap"
              }}
            >
              {CARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    onUpdateCharacter(character.id, { cardColor: c })
                  }
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: c,
                    border:
                      cardBgColor === c
                        ? "2.5px solid #ffffff"
                        : "1.5px solid #001b3a",
                    cursor: "pointer"
                  }}
                />
              ))}
            </div>
          )}

          {/* Moldura Central do Boneco / Avatar */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "200px",
              background:
                "radial-gradient(circle at 50% 40%, #dff0ff 0%, #89c4f4 65%, #3a89c9 100%)",
              border: "3px solid var(--cp-blue-border)",
              borderRadius: "16px",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 4px 12px rgba(0, 27, 58, 0.25)"
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={character.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain"
                }}
              />
            ) : (
              <span
                className="cp-title"
                style={{ fontSize: "52px", opacity: 0.7 }}
              >
                {(character.name || "P").slice(0, 2).toUpperCase()}
              </span>
            )}

            {canEdit && (
              <label
                className="cp-btn"
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "8px",
                  padding: "4px 10px",
                  fontSize: "11px"
                }}
              >
                Foto
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadCharacterImage(character.id, f, "avatar");
                  }}
                />
              </label>
            )}
          </div>

          {/* Mini-Painel do Token do Personagem */}
          <div
            style={{
              background: "rgba(0, 20, 44, 0.55)",
              border: "2px solid var(--cp-blue-border)",
              borderRadius: "12px",
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  border: `3px solid ${cardBgColor}`,
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
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <span className="cp-title" style={{ fontSize: "14px" }}>
                    TK
                  </span>
                )}
              </div>

              {canEdit && (
                <label
                  className="cp-btn"
                  style={{ padding: "4px 8px", fontSize: "11px" }}
                >
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
            </div>

            {onSpawnTokenOnMap && (
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "5px 10px", fontSize: "11px" }}
                onClick={() => onSpawnTokenOnMap(character)}
              >
                + No Mapa
              </button>
            )}
          </div>

          {/* Barras de Vida (HP), Energia (MP) e Defesa */}
          <div
            className="cp-window-inner"
            style={{
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {/* Barra de Vida */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                  marginBottom: "3px"
                }}
              >
                <span style={{ color: "#c62828" }}>VIDA (HP)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={hp.current}
                    onChange={(e) =>
                      handleUpdateResource("hp", "current", e.target.value)
                    }
                    style={{
                      width: "46px",
                      textAlign: "center",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "1.5px solid #001b3a"
                    }}
                  />
                  <span>/</span>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={hp.max}
                    onChange={(e) =>
                      handleUpdateResource("hp", "max", e.target.value)
                    }
                    style={{
                      width: "46px",
                      textAlign: "center",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "1.5px solid #001b3a"
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  height: "10px",
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

            {/* Barra de Energia */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                  fontWeight: 800,
                  marginBottom: "3px"
                }}
              >
                <span style={{ color: "#02529c" }}>ENERGIA (MP)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={mp.current}
                    onChange={(e) =>
                      handleUpdateResource("mp", "current", e.target.value)
                    }
                    style={{
                      width: "46px",
                      textAlign: "center",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "1.5px solid #001b3a"
                    }}
                  />
                  <span>/</span>
                  <input
                    type="number"
                    disabled={!canEdit}
                    value={mp.max}
                    onChange={(e) =>
                      handleUpdateResource("mp", "max", e.target.value)
                    }
                    style={{
                      width: "46px",
                      textAlign: "center",
                      fontWeight: 800,
                      borderRadius: "6px",
                      border: "1.5px solid #001b3a"
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  height: "10px",
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

            {/* Defesa e Nível */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginTop: "2px"
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid var(--cp-blue-border)",
                  borderRadius: "10px",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <strong style={{ fontSize: "11px" }}>DEFESA</strong>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={character.defense ?? 10}
                  onChange={(e) =>
                    onUpdateCharacter(character.id, {
                      defense: Number(e.target.value) || 0
                    })
                  }
                  style={{
                    width: "44px",
                    border: "none",
                    fontWeight: 800,
                    fontSize: "15px",
                    textAlign: "right",
                    background: "transparent"
                  }}
                />
              </div>

              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid var(--cp-blue-border)",
                  borderRadius: "10px",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <strong style={{ fontSize: "11px" }}>NÍVEL</strong>
                <input
                  type="number"
                  disabled={!canEdit}
                  value={character.level ?? 1}
                  onChange={(e) =>
                    onUpdateCharacter(character.id, {
                      level: Number(e.target.value) || 1
                    })
                  }
                  style={{
                    width: "44px",
                    border: "none",
                    fontWeight: 800,
                    fontSize: "15px",
                    textAlign: "right",
                    background: "transparent"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Controle de Permissões (Exclusivo Mestre) */}
          {isGM && (
            <div>
              <button
                type="button"
                className="cp-btn cp-btn-epf"
                style={{ width: "100%", padding: "5px", fontSize: "11px" }}
                onClick={() => setShowPermissions((p) => !p)}
              >
                Permissões da Ficha
              </button>

              {showPermissions && (
                <div
                  className="epf-screen"
                  style={{
                    marginTop: "6px",
                    padding: "8px",
                    fontSize: "11px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <label style={{ display: "flex", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={(character.visibleTo || []).includes("ALL")}
                      onChange={() => togglePermissionUid("visibleTo", "ALL")}
                    />
                    Visível a Todos
                  </label>
                  {Object.values(playersMap || {}).map((p) => (
                    <div
                      key={p.uid}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <span>{p.displayName}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={(character.visibleTo || []).includes(p.uid)}
                            onChange={() =>
                              togglePermissionUid("visibleTo", p.uid)
                            }
                          />{" "}
                          Ver
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={(character.editableBy || []).includes(
                              p.uid
                            )}
                            onChange={() =>
                              togglePermissionUid("editableBy", p.uid)
                            }
                          />{" "}
                          Editar
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LADO DIREITO: GAVETA DO INVENTÁRIO CLUB PENGUIN COM ABAS LATERAIS */}
      <div
        className="cp-window"
        style={{
          flex: 1,
          borderRadius: "0 22px 22px 0",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Cabeçalho de Abas no Estilo Inventário do Club Penguin + Botão Fechar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`cp-btn ${activeTab === "main" ? "cp-btn-gold" : ""}`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setActiveTab("main")}
            >
              Atributos & Skills
            </button>
            <button
              type="button"
              className={`cp-btn ${
                activeTab === "inventory" ? "cp-btn-gold" : ""
              }`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setActiveTab("inventory")}
            >
              Inventário
            </button>
            <button
              type="button"
              className={`cp-btn ${activeTab === "notes" ? "cp-btn-gold" : ""}`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setActiveTab("notes")}
            >
              História & Notas
            </button>
            <button
              type="button"
              className={`cp-btn ${activeTab === "rolls" ? "cp-btn-gold" : ""}`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setActiveTab("rolls")}
            >
              Rolagens
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {onChangeRollVisibility && (
              <button
                type="button"
                className={`cp-btn cp-btn-epf ${
                  rollVisibility === "gm_only" ? "active" : ""
                }`}
                style={{ padding: "5px 10px", fontSize: "11px" }}
                onClick={() =>
                  onChangeRollVisibility(
                    rollVisibility === "public" ? "gm_only" : "public"
                  )
                }
              >
                {rollVisibility === "gm_only" ? "Modo: Secreto" : "Modo: Público"}
              </button>
            )}

            {!isStandaloneWindow && onClose && (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "5px 12px", fontSize: "13px" }}
                onClick={onClose}
              >
                X
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo da Aba Selecionada */}
        <div
          className="cp-window-inner"
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {/* ABA 1: ATRIBUTOS, PERÍCIAS E HABILIDADES */}
          {activeTab === "main" && (
            <>
              {/* Seção Atributos */}
              <div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))",
                    gap: "8px"
                  }}
                >
                  {attributes.map((attr) => (
                    <div
                      key={attr.key}
                      style={{
                        background: "#ffffff",
                        border: "2.5px solid var(--cp-blue-border)",
                        borderRadius: "12px",
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        boxShadow: "0 3px 0 rgba(0,27,58,0.18)"
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
                        <strong style={{ fontSize: "12px" }}>
                          {attr.label}
                        </strong>
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
                              fontSize: "11px"
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <input
                        type="number"
                        className="cp-input"
                        disabled={!canEdit}
                        value={attr.value}
                        onChange={(e) =>
                          handleUpdateAttrValue(attr.key, e.target.value)
                        }
                        style={{
                          textAlign: "center",
                          fontSize: "18px",
                          padding: "4px"
                        }}
                      />

                      <div style={{ display: "flex", gap: "4px", width: "100%" }}>
                        <button
                          type="button"
                          className="cp-btn cp-btn-gold"
                          style={{
                            flex: 1,
                            padding: "4px 6px",
                            fontSize: "11px"
                          }}
                          onClick={() =>
                            triggerRoll({
                              title: `Teste de ${attr.label}`,
                              categoryColor: "#02529c",
                              primaryFormula: `1d20 + @${attr.key}`,
                              primaryLabel: attr.label
                            })
                          }
                        >
                          🎲 Rolar
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="cp-btn"
                            style={{ padding: "4px 6px", fontSize: "11px" }}
                            onClick={() =>
                              pinToRollGroup({
                                name: `Teste ${attr.label}`,
                                color: "#02529c",
                                hitFormula: `1d20 + @${attr.key}`
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
                    style={{ display: "flex", gap: "6px", marginTop: "8px" }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      style={{ maxWidth: "220px", padding: "5px 10px" }}
                      placeholder="Novo Atributo..."
                      value={newAttrLabel}
                      onChange={(e) => setNewAttrLabel(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      + Atributo
                    </button>
                  </form>
                )}
              </div>

              {/* Seção Perícias (Skills) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  {skills.map((sk) => (
                    <div
                      key={sk.id}
                      style={{
                        background: "#ffffff",
                        border: "2px solid var(--cp-blue-border)",
                        borderRadius: "10px",
                        padding: "6px 10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        flexWrap: "wrap"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flex: 1,
                          minWidth: "180px"
                        }}
                      >
                        <strong>{sk.name}</strong>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--cp-text-muted)",
                            fontWeight: 700
                          }}
                        >
                          ({sk.attribute})
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <input
                          type="number"
                          className="cp-input"
                          disabled={!canEdit}
                          value={sk.bonus ?? 0}
                          onChange={(e) =>
                            handleUpdateSkill(
                              sk.id,
                              "bonus",
                              Number(e.target.value)
                            )
                          }
                          style={{
                            width: "58px",
                            padding: "4px",
                            textAlign: "center"
                          }}
                        />

                        <input
                          type="text"
                          className="cp-input"
                          disabled={!canEdit}
                          value={sk.formula || `1d20 + @${sk.attribute}`}
                          onChange={(e) =>
                            handleUpdateSkill(sk.id, "formula", e.target.value)
                          }
                          style={{
                            width: "165px",
                            padding: "4px 8px",
                            fontFamily: "var(--font-epf)",
                            fontSize: "12px"
                          }}
                        />

                        <button
                          type="button"
                          className="cp-btn cp-btn-gold"
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                          onClick={() =>
                            triggerRoll({
                              title: sk.name,
                              categoryColor: "#1e88e5",
                              primaryFormula:
                                sk.formula || `1d20 + @${sk.attribute}`,
                              primaryLabel: sk.name
                            })
                          }
                        >
                          🎲 Rolar
                        </button>

                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() =>
                                pinToRollGroup({
                                  name: sk.name,
                                  color: "#1e88e5",
                                  hitFormula:
                                    sk.formula || `1d20 + @${sk.attribute}`
                                })
                              }
                            >
                              ★
                            </button>
                            <button
                              type="button"
                              className="cp-btn cp-btn-orange"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleDeleteSkill(sk.id)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <form
                    onSubmit={handleAddSkill}
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginTop: "8px",
                      flexWrap: "wrap"
                    }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      style={{ width: "170px", padding: "5px 10px" }}
                      placeholder="Nova Perícia..."
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                    />
                    <select
                      className="cp-input"
                      style={{ width: "130px", padding: "5px 8px" }}
                      value={newSkillAttr}
                      onChange={(e) => setNewSkillAttr(e.target.value)}
                    >
                      {attributes.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="cp-input"
                      style={{ width: "70px", padding: "5px 8px" }}
                      value={newSkillBonus}
                      onChange={(e) => setNewSkillBonus(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      + Perícia
                    </button>
                  </form>
                )}
              </div>

              {/* Seção Habilidades & Magias (Estilo Cartas Card-Jitsu) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}
                >
                  <strong style={{ fontSize: "14px" }}>
                    HABILIDADES & MAGIAS
                  </strong>

                  {canEdit && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      {compendiumEntries.filter((e) => e.type !== "item")
                        .length > 0 && (
                        <select
                          className="cp-input"
                          style={{ width: "210px", padding: "4px 8px", fontSize: "12px" }}
                          defaultValue=""
                          onChange={(e) => {
                            const found = compendiumEntries.find(
                              (c) => c.id === e.target.value
                            );
                            if (found) handlePullFromCompendium(found);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>
                            + Puxar do Compêndio...
                          </option>
                          {compendiumEntries
                            .filter((e) => e.type !== "item")
                            .map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                        </select>
                      )}

                      <button
                        type="button"
                        className="cp-btn cp-btn-green"
                        style={{ padding: "4px 12px", fontSize: "12px" }}
                        onClick={() => setNewAbilityOpen((p) => !p)}
                      >
                        + Nova Habilidade
                      </button>
                    </div>
                  )}
                </div>

                {newAbilityOpen && canEdit && (
                  <form
                    onSubmit={handleAddAbility}
                    style={{
                      background: "#ffffff",
                      border: "2.5px solid var(--cp-blue-border)",
                      borderRadius: "12px",
                      padding: "10px",
                      marginBottom: "10px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px"
                    }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Nome da Habilidade/Magia"
                      value={abName}
                      onChange={(e) => setAbName(e.target.value)}
                      required
                    />
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="color"
                        className="cp-input"
                        style={{ width: "54px", padding: "2px" }}
                        value={abColor}
                        onChange={(e) => setAbColor(e.target.value)}
                      />
                      <select
                        className="cp-input"
                        value={abCostRes}
                        onChange={(e) => setAbCostRes(e.target.value)}
                      >
                        <option value="mp">MP</option>
                        <option value="hp">HP</option>
                      </select>
                      <input
                        type="number"
                        className="cp-input"
                        placeholder="Custo"
                        value={abCostAmt}
                        onChange={(e) => setAbCostAmt(e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Acerto/Teste (ex: 1d20 + @forca)"
                      value={abHit}
                      onChange={(e) => setAbHit(e.target.value)}
                    />
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Dano/Efeito (ex: 2d6 + @forca)"
                      value={abEffect}
                      onChange={(e) => setAbEffect(e.target.value)}
                    />
                    <input
                      type="text"
                      className="cp-input"
                      style={{ gridColumn: "1 / -1" }}
                      placeholder="Descrição"
                      value={abDesc}
                      onChange={(e) => setAbDesc(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn cp-btn-green"
                      style={{ gridColumn: "1 / -1" }}
                    >
                      Salvar Habilidade
                    </button>
                  </form>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                    gap: "10px"
                  }}
                >
                  {abilities.map((ab) => (
                    <div
                      key={ab.id}
                      style={{
                        background: "#ffffff",
                        border: `3.5px solid ${ab.elementColor || "#e53935"}`,
                        borderRadius: "14px",
                        padding: "10px",
                        boxShadow: "0 3px 0 #001b3a",
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
                            alignItems: "center"
                          }}
                        >
                          <strong style={{ fontSize: "15px" }}>
                            {ab.name}
                          </strong>
                          {ab.cost?.amount > 0 && (
                            <span
                              style={{
                                background: "#02529c",
                                color: "#ffffff",
                                fontSize: "10px",
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: "999px"
                              }}
                            >
                              {ab.cost.amount}{" "}
                              {(ab.cost.resource || "mp").toUpperCase()}
                            </span>
                          )}
                        </div>

                        {ab.hitFormula && (
                          <div
                            style={{
                              fontFamily: "var(--font-epf)",
                              fontSize: "11px",
                              color: "#013567"
                            }}
                          >
                            Teste: {ab.hitFormula}
                          </div>
                        )}
                        {ab.effectFormula && (
                          <div
                            style={{
                              fontFamily: "var(--font-epf)",
                              fontSize: "11px",
                              color: "#b71c1c"
                            }}
                          >
                            Efeito: {ab.effectFormula}
                          </div>
                        )}
                        {ab.description && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--cp-text-muted)",
                              marginTop: "2px"
                            }}
                          >
                            {ab.description}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          className="cp-btn cp-btn-gold"
                          style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                          onClick={() =>
                            triggerRoll({
                              title: ab.name,
                              categoryColor: ab.elementColor || "#e53935",
                              description: ab.description || "",
                              primaryFormula:
                                ab.hitFormula || ab.effectFormula || "1d20",
                              primaryLabel: ab.hitFormula ? "Acerto" : "Efeito",
                              secondaryFormula: ab.hitFormula
                                ? ab.effectFormula
                                : "",
                              secondaryLabel: "Dano / Efeito",
                              cost: ab.cost
                            })
                          }
                        >
                          🎲 Rolar
                        </button>

                        {canEdit && (
                          <>
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ padding: "5px 8px", fontSize: "11px" }}
                              onClick={() =>
                                pinToRollGroup({
                                  name: ab.name,
                                  color: ab.elementColor || "#e53935",
                                  hitFormula:
                                    ab.hitFormula || ab.effectFormula || "1d20",
                                  effectFormula: ab.hitFormula
                                    ? ab.effectFormula
                                    : "",
                                  costResource: ab.cost?.resource || "mp",
                                  costAmount: ab.cost?.amount || 0
                                })
                              }
                            >
                              ★
                            </button>
                            <button
                              type="button"
                              className="cp-btn cp-btn-orange"
                              style={{ padding: "5px 8px", fontSize: "11px" }}
                              onClick={() => handleDeleteAbility(ab.id)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ABA 2: INVENTÁRIO (ESTILO GRADE DE ITENS DO CLUB PENGUIN) */}
          {activeTab === "inventory" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {canEdit && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "6px"
                  }}
                >
                  {compendiumEntries.filter((e) => e.type === "item").length >
                    0 && (
                    <select
                      className="cp-input"
                      style={{ width: "220px", padding: "5px 8px", fontSize: "12px" }}
                      defaultValue=""
                      onChange={(e) => {
                        const found = compendiumEntries.find(
                          (c) => c.id === e.target.value
                        );
                        if (found) handlePullFromCompendium(found);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        + Puxar Item do Compêndio...
                      </option>
                      {compendiumEntries
                        .filter((e) => e.type === "item")
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                    </select>
                  )}

                  <button
                    type="button"
                    className="cp-btn cp-btn-green"
                    style={{ padding: "5px 12px", fontSize: "12px" }}
                    onClick={() => setNewItemOpen((p) => !p)}
                  >
                    + Novo Item
                  </button>
                </div>
              )}

              {newItemOpen && canEdit && (
                <form
                  onSubmit={handleAddItem}
                  style={{
                    background: "#ffffff",
                    border: "2.5px solid var(--cp-blue-border)",
                    borderRadius: "12px",
                    padding: "10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 1fr",
                    gap: "8px"
                  }}
                >
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Nome do Item"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    className="cp-input"
                    min={1}
                    placeholder="Qtd"
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value)}
                  />
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Fórmula (ex: 2d4 + 2)"
                    value={itemFormula}
                    onChange={(e) => setItemFormula(e.target.value)}
                  />
                  <input
                    type="text"
                    className="cp-input"
                    style={{ gridColumn: "1 / -1" }}
                    placeholder="Descrição / Efeito"
                    value={itemDesc}
                    onChange={(e) => setItemDesc(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="cp-btn cp-btn-green"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    Adicionar ao Inventário
                  </button>
                </form>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: "10px"
                }}
              >
                {inventory.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      background: "#ffffff",
                      border: "3px solid var(--cp-blue-border)",
                      borderRadius: "14px",
                      padding: "10px",
                      boxShadow: "0 3px 0 rgba(0,27,58,0.2)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "8px"
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <strong>{it.name}</strong>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                        >
                          {canEdit && (
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ padding: "1px 6px", fontSize: "11px" }}
                              onClick={() => handleAdjustItemQty(it.id, -1)}
                            >
                              -
                            </button>
                          )}
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "13px",
                              padding: "0 4px"
                            }}
                          >
                            x{it.qty}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              className="cp-btn"
                              style={{ padding: "1px 6px", fontSize: "11px" }}
                              onClick={() => handleAdjustItemQty(it.id, 1)}
                            >
                              +
                            </button>
                          )}
                        </div>
                      </div>

                      {it.rollFormula && (
                        <div
                          style={{
                            fontFamily: "var(--font-epf)",
                            fontSize: "11px",
                            color: "#1f8a4c",
                            marginTop: "2px"
                          }}
                        >
                          Rolagem: {it.rollFormula}
                        </div>
                      )}

                      {it.description && (
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--cp-text-muted)",
                            marginTop: "2px"
                          }}
                        >
                          {it.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="cp-btn cp-btn-gold"
                        style={{ flex: 1, padding: "4px", fontSize: "12px" }}
                        onClick={() =>
                          triggerRoll({
                            title: `Item: ${it.name}`,
                            categoryColor: "#38c172",
                            description: it.description || "",
                            primaryFormula: it.rollFormula || "1d20",
                            primaryLabel: "Uso / Efeito"
                          })
                        }
                      >
                        🎲 Rolar / Usar
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          className="cp-btn"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() =>
                            pinToRollGroup({
                              name: it.name,
                              color: "#38c172",
                              hitFormula: it.rollFormula || "1d20"
                            })
                          }
                        >
                          ★
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 3: HISTÓRIA & ANOTAÇÕES DA FICHA */}
          {activeTab === "notes" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                height: "100%"
              }}
            >
              <textarea
                className="cp-input"
                rows={7}
                disabled={!canEdit}
                placeholder="História do Pinguim, origem, personalidade..."
                value={character.biography || ""}
                onChange={(e) =>
                  onUpdateCharacter(character.id, { biography: e.target.value })
                }
              />

              <textarea
                className="cp-input"
                rows={8}
                disabled={!canEdit}
                placeholder="Anotações da ficha, condições, lembretes..."
                value={character.notes || ""}
                onChange={(e) =>
                  onUpdateCharacter(character.id, { notes: e.target.value })
                }
              />
            </div>
          )}

          {/* ABA 4: ROLAGENS PERSONALIZÁVEIS (GRUPOS, MACROS E ATALHOS DO PLAYER) */}
          {activeTab === "rolls" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Barra de Criação de Grupo e Nova Rolagem */}
              {canEdit && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}
                >
                  <form
                    onSubmit={handleCreateRollGroup}
                    style={{ display: "flex", gap: "6px" }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      style={{ width: "200px", padding: "5px 10px" }}
                      placeholder="Nome do novo grupo..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                    >
                      + Grupo
                    </button>
                  </form>

                  <button
                    type="button"
                    className="cp-btn cp-btn-green"
                    style={{ padding: "5px 12px", fontSize: "12px" }}
                    onClick={() => setNewCustomRollOpen((p) => !p)}
                  >
                    + Nova Rolagem Customizada
                  </button>
                </div>
              )}

              {/* Modal inline para criar nova rolagem customizada */}
              {newCustomRollOpen && canEdit && (
                <form
                  onSubmit={handleAddCustomRollToGroup}
                  style={{
                    background: "#ffffff",
                    border: "2.5px solid var(--cp-blue-border)",
                    borderRadius: "12px",
                    padding: "10px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px"
                  }}
                >
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Título da Rolagem"
                    value={crName}
                    onChange={(e) => setCrName(e.target.value)}
                    required
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      className="cp-input"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      {rollGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="color"
                      className="cp-input"
                      style={{ width: "50px", padding: "2px" }}
                      value={crColor}
                      onChange={(e) => setCrColor(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Fórmula 1 (ex: 1d20 + @forca + @luta)"
                    value={crHit}
                    onChange={(e) => setCrHit(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Fórmula 2 opcional (ex: 2d6 + @forca)"
                    value={crEffect}
                    onChange={(e) => setCrEffect(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <select
                      className="cp-input"
                      value={crCostRes}
                      onChange={(e) => setCrCostRes(e.target.value)}
                    >
                      <option value="mp">Custo MP</option>
                      <option value="hp">Custo HP</option>
                    </select>
                    <input
                      type="number"
                      className="cp-input"
                      min={0}
                      value={crCostAmt}
                      onChange={(e) => setCrCostAmt(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="cp-btn cp-btn-green">
                    Salvar no Grupo
                  </button>
                </form>
              )}

              {/* Renderização dos Grupos de Rolagem */}
              {rollGroups.map((grp) => (
                <div
                  key={grp.id}
                  style={{
                    background: "#ffffff",
                    border: "2.5px solid var(--cp-blue-border)",
                    borderRadius: "14px",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <strong style={{ fontSize: "15px", color: "#02529c" }}>
                      {grp.name}
                    </strong>
                    {canEdit && (
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{ padding: "2px 8px", fontSize: "10px" }}
                        onClick={() => handleDeleteRollGroup(grp.id)}
                      >
                        Excluir Grupo
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "8px"
                    }}
                  >
                    {(grp.rolls || []).map((r, idx) => (
                      <div
                        key={r.id}
                        style={{
                          border: `3px solid ${r.color || "#3090f0"}`,
                          borderRadius: "12px",
                          padding: "8px",
                          background: "var(--cp-ice-bg)",
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
                              alignItems: "center"
                            }}
                          >
                            <strong style={{ fontSize: "14px" }}>
                              {r.name}
                            </strong>
                            {r.costAmount > 0 && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  color: "#02529c"
                                }}
                              >
                                {r.costAmount}{" "}
                                {(r.costResource || "mp").toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--font-epf)",
                              fontSize: "11px"
                            }}
                          >
                            {r.hitFormula}
                            {r.effectFormula ? ` | ${r.effectFormula}` : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "4px" }}>
                          <button
                            type="button"
                            className="cp-btn cp-btn-gold"
                            style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                            onClick={() =>
                              triggerRoll({
                                title: r.name,
                                categoryColor: r.color || "#3090f0",
                                primaryFormula: r.hitFormula || "1d20",
                                primaryLabel: "Rolagem",
                                secondaryFormula: r.effectFormula || "",
                                secondaryLabel: "Efeito / Dano",
                                cost:
                                  r.costAmount > 0
                                    ? {
                                        resource: r.costResource || "mp",
                                        amount: r.costAmount
                                      }
                                    : null
                              })
                            }
                          >
                            🎲 Rolar
                          </button>

                          {canEdit && (
                            <>
                              <button
                                type="button"
                                className="cp-btn"
                                style={{ padding: "4px 6px", fontSize: "10px" }}
                                onClick={() =>
                                  handleMoveRollOrder(grp.id, idx, -1)
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="cp-btn"
                                style={{ padding: "4px 6px", fontSize: "10px" }}
                                onClick={() =>
                                  handleMoveRollOrder(grp.id, idx, 1)
                                }
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="cp-btn cp-btn-orange"
                                style={{ padding: "4px 6px", fontSize: "10px" }}
                                onClick={() =>
                                  handleRemoveRollFromGroup(grp.id, r.id)
                                }
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isStandaloneWindow) {
    return <div style={wrapperStyle}>{sheetBody}</div>;
  }

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      {sheetBody}
    </div>
  );
}

