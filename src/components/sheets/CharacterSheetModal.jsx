import { useRef, useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { CP_FLASH_ICONS, renderCpFlashIcon } from "./CpFlashIcons";

const CARD_COLORS = [
  "#008be3", // CP Blue Classic
  "#02529c", // CP Navy Deep
  "#c62828", // Vermelho
  "#2e7d32", // Verde
  "#f59f00", // Laranja
  "#d84315", // Marrom
  "#6a1b9a", // Roxo
  "#ad1457", // Rosa
  "#00838f", // Turquesa
  "#1a202c"  // Preto
];

const TABS = [
  { id: "inventory", label: "Inventário" },
  { id: "main", label: "Atributos & Skills" },
  { id: "notes", label: "História & Notas" },
  { id: "rolls", label: "Rolagens & Ações" }
];

const resolveItemIcon = (item) => {
  if (!item) return "fluffy_fish";
  if (typeof item === "string") {
    const s = item.toLowerCase();
    if (s.includes("peixe") || s.includes("fish") || s.includes("fluffy")) return "fluffy_fish";
    return item;
  }
  const name = (item.name || "").toLowerCase();
  const id = (item.id || "").toLowerCase();
  const icon = (item.icon || "").toLowerCase();
  if (
    name.includes("peixe") ||
    name.includes("fish") ||
    name.includes("fluffy") ||
    id.includes("peixe") ||
    id.includes("fish")
  ) {
    if (!icon || icon === "meat" || icon === "carne" || icon === "fish") {
      return "fluffy_fish";
    }
  }
  return item.icon || item.name;
};

function CpCoinIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{ flexShrink: 0, filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.35))" }}
    >
      <circle cx="16" cy="16" r="14" fill="#d99800" stroke="#523200" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="11.5" fill="#ffcb2b" stroke="#b37800" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="8" fill="#ffe566" opacity="0.6" />
      <path
        d="M16 9.5L17.5 13.8H22L18.4 16.5L19.8 21L16 18.2L12.2 21L13.6 16.5L10 13.8H14.5L16 9.5Z"
        fill="#995e00"
      />
    </svg>
  );
}

function CpStampIcon({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      style={{ flexShrink: 0, filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.35))" }}
    >
      <rect x="3" y="3" width="26" height="26" rx="6" fill="#ffffff" stroke="#00264d" strokeWidth="2.5" />
      <rect x="5.5" y="5.5" width="21" height="21" rx="4" fill="#008be3" />
      <circle cx="16" cy="16" r="7" fill="#ffffff" />
      <path
        d="M16 11.5L17.2 14.8H20.8L18 16.8L19 20.2L16 18.2L13 20.2L14 16.8L11.2 14.8H14.8L16 11.5Z"
        fill="#005b96"
      />
    </svg>
  );
}

function CpMemberBadge({ level = 1 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "linear-gradient(180deg, #ffe57f 0%, #ffb300 100%)",
        border: "2px solid #5d3b00",
        borderRadius: "8px",
        padding: "2px 7px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.7)",
        color: "#3d2400",
        fontFamily: "var(--font-display)",
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.5px",
        flexShrink: 0,
        userSelect: "none"
      }}
      title={`Nível ${level}`}
    >
      <span style={{ fontSize: "11px", color: "#5d3b00" }}>⭐</span>
      <span>NÍVEL {level}</span>
    </div>
  );
}

function CpIconPicker({ selectedIconId, onSelectIcon, onClose }) {
  const [activeCat, setActiveCat] = useState("all");
  const categories = [
    { id: "all", label: "Todos" },
    { id: "reactions", label: "Expressões" },
    { id: "combat", label: "Combate" },
    { id: "magic", label: "Magia" },
    { id: "food", label: "Comidas" },
    { id: "creatures", label: "Criaturas" },
    { id: "treasure", label: "Tesouros" },
    { id: "activities", label: "Atividades" },
    { id: "symbols", label: "Símbolos" }
  ];

  const filtered = activeCat === "all"
    ? CP_FLASH_ICONS
    : CP_FLASH_ICONS.filter((i) => i.category === activeCat);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "2.5px solid #7a8c9e",
        borderRadius: "14px",
        padding: "10px",
        boxShadow: "0 8px 24px rgba(0, 27, 58, 0.3)",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            style={{
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 700,
              borderRadius: "999px",
              border: activeCat === c.id ? "1.5px solid #008be3" : "1px solid #cbd5e1",
              background: activeCat === c.id ? "#eef6fd" : "#ffffff",
              color: activeCat === c.id ? "#0060a8" : "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "6px",
          maxHeight: "165px",
          overflowY: "auto",
          padding: "4px"
        }}
      >
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectIcon(item.id)}
            title={item.label}
            style={{
              width: "42px",
              height: "42px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: selectedIconId === item.id ? "#e0f2fe" : "#f8fafc",
              border: selectedIconId === item.id ? "2px solid #008be3" : "1.5px solid #cbd5e1",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "2px",
              transition: "transform 0.1s ease, border-color 0.1s ease"
            }}
          >
            {item.render(32)}
          </button>
        ))}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "flex-end",
            padding: "3px 10px",
            fontSize: "11px",
            background: "#e2e8f0",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 700,
            color: "#334155"
          }}
        >
          Fechar
        </button>
      )}
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState("inventory");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(
    character?.rollGroups?.[0]?.id || "grp_combate"
  );

  // Estados de edição das Moedas e XP
  const [editingCoins, setEditingCoins] = useState(false);
  const [coinsInput, setCoinsInput] = useState(character?.coins ?? 0);
  const [editingXp, setEditingXp] = useState(false);
  const [xpInput, setXpInput] = useState(character?.xp ?? 0);

  // Item selecionado no inventário para exibir popup de detalhes
  const [inspectedItem, setInspectedItem] = useState(null);

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
  const [itemIcon, setItemIcon] = useState("sword");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [inspectedIconPickerOpen, setInspectedIconPickerOpen] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [newCustomRollOpen, setNewCustomRollOpen] = useState(false);
  const [crName, setCrName] = useState("");
  const [crIcon, setCrIcon] = useState("sword");
  const [showRollIconPicker, setShowRollIconPicker] = useState(false);
  const [crColor, setCrColor] = useState("#3090f0");
  const [crHit, setCrHit] = useState("1d20 + @forca");
  const [crEffect, setCrEffect] = useState("");
  const [crCostRes, setCrCostRes] = useState("mp");
  const [crCostAmt, setCrCostAmt] = useState(0);
  const [hotbarModalRoll, setHotbarModalRoll] = useState(null);
  const [importFromSheetOpen, setImportFromSheetOpen] = useState(false);
  const [editingRollIconTarget, setEditingRollIconTarget] = useState(null);

  const inventoryScrollRef = useRef(null);

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

  const cardBgColor = character.cardColor || "#008be3";
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

  const coins = character.coins ?? 0;
  const xp = character.xp ?? 0;

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

  const triggerRoll = (config) => {
    onExecuteRoll({
      ...config,
      character,
      visibility: rollVisibility
    });
  };

  const pinToRollGroup = (rollEntry, targetGroupId = null) => {
    if (!canEdit) return;
    const groups =
      rollGroups.length > 0
        ? [...rollGroups]
        : [{ id: "grp_combate", name: "Ações Rápidas", rolls: [] }];
    const gid = targetGroupId || selectedGroupId || groups[0]?.id;
    const targetGroup = groups.find((g) => g.id === gid) || groups[0];

    const newRoll = {
      id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: rollEntry.name || "Rolagem",
      color: rollEntry.color || "#02529c",
      icon: rollEntry.icon || "sword",
      hitFormula: rollEntry.hitFormula || "1d20",
      effectFormula: rollEntry.effectFormula || "",
      costResource: rollEntry.costResource || "mp",
      costAmount: rollEntry.costAmount || 0
    };

    const nextGroups = groups.map((g) => {
      if (g.id !== targetGroup.id) return g;
      return {
        ...g,
        rolls: [...(g.rolls || []), newRoll]
      };
    });

    onUpdateCharacter(character.id, { rollGroups: nextGroups });
  };

  const handleUpdateAttrValue = (key, value) => {
    if (!canEdit) return;
    const val = Number(value) || 0;
    const nextAttrs = attributes.map((a) =>
      a.key === key ? { ...a, value: val } : a
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

  const handleDeleteSkill = (skillId) => {
    if (!canEdit) return;
    onUpdateCharacter(character.id, {
      skills: skills.filter((s) => s.id !== skillId)
    });
  };

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
      const entryNameLower = (entry.name || "").toLowerCase();
      const isFish =
        entryNameLower.includes("peixe") ||
        entryNameLower.includes("fish") ||
        entryNameLower.includes("fluffy");
      onUpdateCharacter(character.id, {
        inventory: [
          ...inventory,
          {
            id: `inv_${Date.now()}`,
            name: entry.name,
            qty: 1,
            elementColor: entry.elementColor || "#38c172",
            icon: isFish ? "fluffy_fish" : (entry.icon || "sword"),
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

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!canEdit || !itemName.trim()) return;
    const nameLower = itemName.trim().toLowerCase();
    const isFish =
      nameLower.includes("peixe") ||
      nameLower.includes("fish") ||
      nameLower.includes("fluffy");
    const finalIcon =
      isFish && (itemIcon === "sword" || itemIcon === "meat" || itemIcon === "fish")
        ? "fluffy_fish"
        : itemIcon;
    onUpdateCharacter(character.id, {
      inventory: [
        ...inventory,
        {
          id: `inv_${Date.now()}`,
          name: itemName.trim(),
          qty: Math.max(1, Number(itemQty) || 1),
          elementColor: "#38c172",
          icon: finalIcon,
          rollFormula: itemFormula.trim(),
          description: itemDesc.trim()
        }
      ]
    });
    setItemName("");
    setItemFormula("");
    setItemDesc("");
    setItemIcon("sword");
    setShowIconPicker(false);
    setNewItemOpen(false);
  };

  const handleUpdateItemIcon = (itemId, newIcon) => {
    if (!canEdit) return;
    const nextInv = inventory.map((it) =>
      it.id === itemId ? { ...it, icon: newIcon } : it
    );
    onUpdateCharacter(character.id, { inventory: nextInv });
    if (inspectedItem?.id === itemId) {
      setInspectedItem((prev) => (prev ? { ...prev, icon: newIcon } : null));
    }
    setInspectedIconPickerOpen(false);
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
    if (inspectedItem?.id === itemId) {
      const updated = nextInv.find((it) => it.id === itemId);
      if (updated) {
        setInspectedItem(updated);
      } else {
        setInspectedItem(null);
      }
    }
  };

  const handleDeleteItem = (itemId) => {
    if (!canEdit) return;
    const nextInv = inventory.filter((it) => it.id !== itemId);
    onUpdateCharacter(character.id, { inventory: nextInv });
    if (inspectedItem?.id === itemId) {
      setInspectedItem(null);
    }
  };

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
        icon: crIcon,
        hitFormula: crHit.trim(),
        effectFormula: crEffect.trim(),
        costResource: crCostRes,
        costAmount: Number(crCostAmt) || 0
      },
      selectedGroupId
    );
    setCrName("");
    setCrEffect("");
    setCrIcon("sword");
    setShowRollIconPicker(false);
    setNewCustomRollOpen(false);
  };

  const handleRemoveRollFromGroup = (groupId, rollId) => {
    if (!canEdit) return;
    const next = rollGroups.map((g) =>
      g.id === groupId
        ? { ...g, rolls: (g.rolls || []).filter((r) => r.id !== rollId) }
        : g
    );
    const rawHotbar = Array.isArray(character.hotbar) ? [...character.hotbar] : [];
    const nextHotbar = rawHotbar.map((s) => (s?.rollId === rollId ? null : s));
    onUpdateCharacter(character.id, { rollGroups: next, hotbar: nextHotbar });
  };

  const handleAssignRollToHotbar = (roll, slotIndex) => {
    if (!canEdit) return;
    const currentHotbar = Array.isArray(character.hotbar)
      ? [...character.hotbar]
      : Array(9).fill(null);
    while (currentHotbar.length < 9) {
      currentHotbar.push(null);
    }
    currentHotbar[slotIndex] = {
      rollId: roll.id,
      name: roll.name,
      color: roll.color || "#02529c",
      icon: roll.icon || roll.name,
      hitFormula: roll.hitFormula || "1d20",
      effectFormula: roll.effectFormula || "",
      costResource: roll.costResource || "mp",
      costAmount: roll.costAmount || 0
    };
    onUpdateCharacter(character.id, { hotbar: currentHotbar });
    setHotbarModalRoll(null);
  };

  const handleRemoveRollFromHotbar = (slotIndex) => {
    if (!canEdit) return;
    const currentHotbar = Array.isArray(character.hotbar)
      ? [...character.hotbar]
      : Array(9).fill(null);
    while (currentHotbar.length < 9) {
      currentHotbar.push(null);
    }
    currentHotbar[slotIndex] = null;
    onUpdateCharacter(character.id, { hotbar: currentHotbar });
    setHotbarModalRoll(null);
  };

  const handleUpdateRollIcon = (groupId, rollId, newIconId) => {
    if (!canEdit) return;
    const nextGroups = rollGroups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rolls: (g.rolls || []).map((r) =>
          r.id === rollId ? { ...r, icon: newIconId } : r
        )
      };
    });
    const rawHotbar = Array.isArray(character.hotbar) ? [...character.hotbar] : [];
    const nextHotbar = rawHotbar.map((s) =>
      s?.rollId === rollId ? { ...s, icon: newIconId } : s
    );
    onUpdateCharacter(character.id, {
      rollGroups: nextGroups,
      hotbar: nextHotbar
    });
    setEditingRollIconTarget(null);
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

  const scrollInventory = (delta) => {
    if (inventoryScrollRef.current) {
      inventoryScrollRef.current.scrollTop += delta;
    }
  };

  // Preenche a grade do inventário com pelo menos 12 slots para manter o padrão 3x4 do Club Penguin
  const emptySlotsCount = Math.max(0, 12 - inventory.length);

  const wrapperStyle = isStandaloneWindow
    ? {
        width: "100vw",
        height: "100vh",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }
    : undefined;

  const sheetBody = (
    <div
      className="cp-playercard-container"
      onClick={(e) => e.stopPropagation()}
    >
      {/* LADO ESQUERDO: PLAYER CARD CLÁSSICO DO CLUB PENGUIN */}
      <div
        className="cp-playercard-left"
        style={{
          background: `linear-gradient(180deg, ${cardBgColor} 0%, #004c82 85%, #002b4d 100%)`
        }}
      >
        {/* Notch superior do Club Penguin */}
        <div className="cp-playercard-notch">
          <div className="cp-playercard-notch-ridge" />
          <div className="cp-playercard-notch-ridge" />
          <div className="cp-playercard-notch-ridge" />
        </div>

        {/* Topo: Selo/Assinante, Nome do Pinguim e Botão Fechar ⓧ */}
        <div className="cp-playercard-header">
          <CpMemberBadge level={character.level ?? 1} />

          <input
            type="text"
            value={character.name || ""}
            disabled={!canEdit}
            onChange={(e) =>
              onUpdateCharacter(character.id, { name: e.target.value })
            }
            title={character.name || "Nome do Pinguim"}
            style={{
              background: "rgba(0, 27, 58, 0.35)",
              border: "1.5px solid rgba(255, 255, 255, 0.4)",
              borderRadius: "8px",
              color: "#ffffff",
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              fontWeight: 800,
              padding: "2px 6px",
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              outline: "none"
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {!isStandaloneWindow && (
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{
                  width: "26px",
                  height: "26px",
                  padding: 0,
                  fontSize: "11px",
                  borderRadius: "50%"
                }}
                onClick={handlePopoutWindow}
                title="Abrir em Nova Janela"
              >
                ↗
              </button>
            )}

            {!isStandaloneWindow && onClose && (
              <button
                type="button"
                className="cp-playercard-close-btn"
                onClick={onClose}
                title="Fechar Ficha"
              >
                <div className="cp-playercard-close-inner">✕</div>
              </button>
            )}
          </div>
        </div>

        {/* Moldura da Foto / Avatar do Pinguim */}
        <div className="cp-playercard-photo-frame">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={character.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none"
              }}
            />
          ) : (
            <span
              className="cp-title"
              style={{ fontSize: "56px", opacity: 0.55 }}
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
                right: "8px",
                padding: "3px 8px",
                fontSize: "10px",
                background: "rgba(0, 27, 58, 0.75)",
                border: "1.5px solid #ffffff",
                boxShadow: "0 2px 5px rgba(0,0,0,0.4)"
              }}
              title="Trocar Foto"
            >
              📷 Foto
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

        {/* Rodapé: Moedas e XP (estilo Club Penguin com modo de edição) */}
        <div className="cp-playercard-footer">
          {/* Suas Moedas */}
          {editingCoins ? (
            <form
              className="cp-playercard-stat-row"
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateCharacter(character.id, {
                  coins: Math.max(0, Number(coinsInput) || 0)
                });
                setEditingCoins(false);
              }}
            >
              <CpCoinIcon size={22} />
              <span className="cp-stat-label">Your Coins:</span>
              <input
                type="number"
                className="cp-stat-input"
                min={0}
                value={coinsInput}
                autoFocus
                onChange={(e) => setCoinsInput(e.target.value)}
              />
              <button type="submit" className="cp-stat-save-btn">✓</button>
              <button
                type="button"
                className="cp-stat-cancel-btn"
                onClick={() => setEditingCoins(false)}
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="cp-playercard-stat-row">
              <CpCoinIcon size={22} />
              <span className="cp-stat-label">Your Coins:</span>
              <span className="cp-stat-value">{coins}</span>
              {canEdit && (
                <button
                  type="button"
                  className="cp-stat-edit-btn"
                  onClick={() => {
                    setCoinsInput(coins);
                    setEditingCoins(true);
                  }}
                  title="Editar moedas"
                >
                  ✏️
                </button>
              )}
            </div>
          )}

          {/* XP / Selos */}
          {editingXp ? (
            <form
              className="cp-playercard-stat-row"
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateCharacter(character.id, {
                  xp: Math.max(0, Number(xpInput) || 0)
                });
                setEditingXp(false);
              }}
            >
              <CpStampIcon size={22} />
              <span className="cp-stat-label">Your Stamps:</span>
              <input
                type="number"
                className="cp-stat-input"
                min={0}
                value={xpInput}
                autoFocus
                onChange={(e) => setXpInput(e.target.value)}
              />
              <button type="submit" className="cp-stat-save-btn">✓</button>
              <button
                type="button"
                className="cp-stat-cancel-btn"
                onClick={() => setEditingXp(false)}
              >
                ✕
              </button>
            </form>
          ) : (
            <div className="cp-playercard-stat-row">
              <CpStampIcon size={22} />
              <span className="cp-stat-label">Your Stamps:</span>
              <span className="cp-stat-value">{xp}</span>
              {canEdit && (
                <button
                  type="button"
                  className="cp-stat-edit-btn"
                  onClick={() => {
                    setXpInput(xp);
                    setEditingXp(true);
                  }}
                  title="Editar XP"
                >
                  ✏️
                </button>
              )}
            </div>
          )}

          {/* Seletor de Cor do Cartão (quando em modo edição) */}
          {canEdit && (
            <div
              style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "4px"
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
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: c,
                    border:
                      cardBgColor === c
                        ? "2px solid #ffffff"
                        : "1px solid #001b3a",
                    cursor: "pointer",
                    padding: 0
                  }}
                  title={c}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LADO DIREITO: GAVETA CONECTADA COM AS ABAS */}
      <div className="cp-playercard-right">
        {/* Barra Superior da Direita: Ações Rápidas & Modo de Rolagem */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px 4px 14px",
            borderBottom: "1px solid #e2e8f0"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {onChangeRollVisibility && (
              <button
                type="button"
                className={`cp-btn cp-btn-epf ${
                  rollVisibility === "gm_only" ? "active" : ""
                }`}
                style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                onClick={() =>
                  onChangeRollVisibility(
                    rollVisibility === "public" ? "gm_only" : "public"
                  )
                }
              >
                {rollVisibility === "gm_only"
                  ? "Modo: Secreto"
                  : "Modo: Público"}
              </button>
            )}

            {isGM && (
              <button
                type="button"
                className="cp-btn cp-btn-epf"
                style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                onClick={() => setShowPermissions((p) => !p)}
              >
                Permissões
              </button>
            )}
          </div>

          {/* Ações Específicas da Aba Aberta */}
          {activeTab === "inventory" && canEdit && (
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {compendiumEntries.filter((e) => e.type === "item").length > 0 && (
                <select
                  className="cp-input"
                  style={{
                    width: "160px",
                    padding: "2px 6px",
                    fontSize: "11px",
                    height: "26px"
                  }}
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
                    + Puxar Compêndio...
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
                style={{ padding: "3px 10px", fontSize: "11px", height: "26px" }}
                onClick={() => setNewItemOpen((p) => !p)}
              >
                + Novo Item
              </button>
            </div>
          )}
        </div>

        {/* Modal de Permissões (para o Mestre) */}
        {showPermissions && isGM && (
          <div
            className="epf-screen"
            style={{
              margin: "6px 14px",
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
                      onChange={() => togglePermissionUid("visibleTo", p.uid)}
                    />{" "}
                    Ver
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={(character.editableBy || []).includes(p.uid)}
                      onChange={() => togglePermissionUid("editableBy", p.uid)}
                    />{" "}
                    Editar
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulário inline para adicionar novo item ao inventário */}
        {newItemOpen && activeTab === "inventory" && canEdit && (
          <form
            onSubmit={handleAddItem}
            style={{
              background: "#f0f6fc",
              border: "1.5px solid #008be3",
              borderRadius: "10px",
              margin: "6px 14px",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              position: "relative"
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 70px 1fr", gap: "6px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setShowIconPicker((p) => !p)}
                title="Escolher Ícone"
                style={{
                  width: "38px",
                  height: "32px",
                  background: "#ffffff",
                  border: "1.5px solid #7a8c9e",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0
                }}
              >
                {renderCpFlashIcon(itemIcon, 26)}
              </button>
              <input
                type="text"
                className="cp-input"
                placeholder="Nome do Item..."
                value={itemName}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemName(val);
                  const lower = val.toLowerCase();
                  if (lower.includes("peixe") || lower.includes("fish") || lower.includes("fluffy")) {
                    if (itemIcon === "sword" || itemIcon === "meat") {
                      setItemIcon("fluffy_fish");
                    }
                  }
                }}
                required
                style={{ fontSize: "11px", padding: "3px 6px" }}
              />
              <input
                type="number"
                className="cp-input"
                min={1}
                placeholder="Qtd"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                style={{ fontSize: "11px", padding: "3px 6px" }}
              />
              <input
                type="text"
                className="cp-input"
                placeholder="Fórmula (ex: 2d4 + 2)"
                value={itemFormula}
                onChange={(e) => setItemFormula(e.target.value)}
                style={{ fontSize: "11px", padding: "3px 6px" }}
              />
            </div>

            {/* Seletor de Ícones de RPG / Club Penguin */}
            {showIconPicker && (
              <CpIconPicker
                selectedIconId={itemIcon}
                onSelectIcon={(ic) => {
                  setItemIcon(ic);
                  setShowIconPicker(false);
                }}
                onClose={() => setShowIconPicker(false)}
              />
            )}

            <input
              type="text"
              className="cp-input"
              placeholder="Descrição / Efeito..."
              value={itemDesc}
              onChange={(e) => setItemDesc(e.target.value)}
              style={{ fontSize: "11px", padding: "3px 6px" }}
            />
            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "3px 8px", fontSize: "11px" }}
                onClick={() => {
                  setShowIconPicker(false);
                  setNewItemOpen(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="cp-btn cp-btn-green"
                style={{ padding: "3px 12px", fontSize: "11px" }}
              >
                Salvar Item
              </button>
            </div>
          </form>
        )}

        {/* ÁREA CENTRAL DAS ABAS */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* =========================================================================
              ABA 2: INVENTÁRIO (ESTILO GRADE DE QUADRADOS CLUB PENGUIN 3x4)
             ========================================================================= */}
          {activeTab === "inventory" && (
            <div className="cp-inv-grid-wrapper">
              <div className="cp-inv-grid" ref={inventoryScrollRef}>
                {inventory.map((item) => {
                  const isSelected = inspectedItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className="cp-inv-slot"
                      onClick={() =>
                        setInspectedItem((prev) =>
                          prev?.id === item.id ? null : item
                        )
                      }
                      style={{
                        borderColor: isSelected ? "#008be3" : "#b8c8d8",
                        background: isSelected ? "#f0f8ff" : "#ffffff",
                        boxShadow: isSelected
                          ? "0 0 0 2px #008be3, 0 4px 8px rgba(0,139,227,0.25)"
                          : undefined
                      }}
                      title={item.name}
                    >
                      {/* Ícone do Item (estilo vetorial Flash Club Penguin) */}
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          userSelect: "none",
                          filter: "drop-shadow(0 2px 3px rgba(0, 27, 58, 0.2))"
                        }}
                      >
                        {renderCpFlashIcon(resolveItemIcon(item), 40)}
                      </div>

                      {/* Nome do Item */}
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#1a365d",
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: "100%",
                          marginTop: "2px"
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Badge de Quantidade (estilo x2 no canto do item) */}
                      {item.qty > 1 && (
                        <span
                          style={{
                            position: "absolute",
                            top: "4px",
                            right: "6px",
                            background: "#008be3",
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: 900,
                            padding: "1px 5px",
                            borderRadius: "8px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
                          }}
                        >
                          x{item.qty}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Slots Vazios adicionais para preencher a grade estilo Club Penguin */}
                {Array.from({ length: emptySlotsCount }).map((_, i) => (
                  <div key={`empty_${i}`} className="cp-inv-slot empty" />
                ))}
              </div>

              {/* Controles de Rolagem Vertical Clássicos do Club Penguin */}
              <div className="cp-inv-scroll-controls">
                <button
                  type="button"
                  className="cp-inv-scroll-btn"
                  onClick={() => scrollInventory(-102)}
                  title="Subir"
                >
                  ▲
                </button>
                <div className="cp-inv-scroll-track" />
                <button
                  type="button"
                  className="cp-inv-scroll-btn"
                  onClick={() => scrollInventory(102)}
                  title="Descer"
                >
                  ▼
                </button>
              </div>
            </div>
          )}

          {/* Painel Flutuante de Inspeção do Item Selecionado no Inventário */}
          {activeTab === "inventory" && inspectedItem && (
            <div
              style={{
                margin: "0 14px 6px 14px",
                background: "#f0f6fc",
                border: "2px solid #008be3",
                borderRadius: "12px",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                boxShadow: "0 3px 8px rgba(0,27,58,0.15)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                  {/* Ícone clicável para trocar no inspetor se canEdit */}
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => canEdit && setInspectedIconPickerOpen((p) => !p)}
                    title={canEdit ? "Trocar ícone do item" : ""}
                    style={{
                      width: "44px",
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#ffffff",
                      border: canEdit ? "1.5px dashed #008be3" : "1.5px solid #d4dde8",
                      borderRadius: "10px",
                      cursor: canEdit ? "pointer" : "default",
                      flexShrink: 0,
                      padding: 0
                    }}
                  >
                    {renderCpFlashIcon(resolveItemIcon(inspectedItem), 36)}
                  </button>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#003264" }}>
                        {inspectedItem.name}
                      </strong>
                      {inspectedItem.rollFormula && (
                        <span
                          style={{
                            fontFamily: "var(--font-epf)",
                            fontSize: "11px",
                            color: "#1f8a4c",
                            fontWeight: 700
                          }}
                        >
                          [{inspectedItem.rollFormula}]
                        </span>
                      )}
                    </div>
                    {inspectedItem.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#475569",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {inspectedItem.description}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  {canEdit && (
                    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "1px 6px", fontSize: "11px" }}
                        onClick={() => handleAdjustItemQty(inspectedItem.id, -1)}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 800, fontSize: "12px", padding: "0 4px" }}>
                        x{inspectedItem.qty}
                      </span>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "1px 6px", fontSize: "11px" }}
                        onClick={() => handleAdjustItemQty(inspectedItem.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="cp-btn cp-btn-gold"
                    style={{ padding: "4px 10px", fontSize: "11px" }}
                    onClick={() =>
                      triggerRoll({
                        title: `Item: ${inspectedItem.name}`,
                        categoryColor: "#38c172",
                        description: inspectedItem.description || "",
                        primaryFormula: inspectedItem.rollFormula || "1d20",
                        primaryLabel: "Uso / Efeito",
                        icon: resolveItemIcon(inspectedItem)
                      })
                    }
                  >
                    🎲 Usar
                  </button>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Fixar na aba Rolagens"
                        onClick={() =>
                          pinToRollGroup({
                            name: inspectedItem.name,
                            color: "#38c172",
                            hitFormula: inspectedItem.rollFormula || "1d20",
                            icon: resolveItemIcon(inspectedItem)
                          })
                        }
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        title="Excluir Item"
                        onClick={() => handleDeleteItem(inspectedItem.id)}
                      >
                        ✕
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setInspectedItem(null);
                      setInspectedIconPickerOpen(false);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: "0 4px"
                    }}
                    title="Fechar detalhes"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Seletor aberto para trocar ícone do item inspecionado */}
              {inspectedIconPickerOpen && canEdit && (
                <CpIconPicker
                  selectedIconId={resolveItemIcon(inspectedItem)}
                  onSelectIcon={(ic) => handleUpdateItemIcon(inspectedItem.id, ic)}
                  onClose={() => setInspectedIconPickerOpen(false)}
                />
              )}
            </div>
          )}

          {/* =========================================================================
              ABA 1: ATRIBUTOS, PERÍCIAS E HABILIDADES
             ========================================================================= */}
          {activeTab === "main" && (
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
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={hp.current}
                          onChange={(e) =>
                            handleUpdateResource("hp", "current", e.target.value)
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
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={hp.max}
                          onChange={(e) =>
                            handleUpdateResource("hp", "max", e.target.value)
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
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={mp.current}
                          onChange={(e) =>
                            handleUpdateResource("mp", "current", e.target.value)
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
                        <input
                          type="number"
                          disabled={!canEdit}
                          value={mp.max}
                          onChange={(e) =>
                            handleUpdateResource("mp", "max", e.target.value)
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

                    {onSpawnTokenOnMap && (
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
                            style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
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

              {/* Seção Perícias (Skills) */}
              <div>
                <strong style={{ fontSize: "12px", color: "#003264", textTransform: "uppercase" }}>
                  Perícias
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    marginTop: "4px"
                  }}
                >
                  {skills.map((sk) => (
                    <div
                      key={sk.id}
                      style={{
                        background: "#ffffff",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flex: 1,
                          minWidth: "140px"
                        }}
                      >
                        <strong style={{ fontSize: "12px", color: "#1e293b" }}>{sk.name}</strong>
                        <span style={{ fontSize: "10px", color: "#64748b" }}>
                          ({sk.attribute})
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#003264" }}>
                          +{sk.bonus}
                        </span>
                        <button
                          type="button"
                          className="cp-btn cp-btn-gold"
                          style={{ padding: "3px 8px", fontSize: "10px", height: "24px" }}
                          onClick={() =>
                            triggerRoll({
                              title: `Perícia: ${sk.name}`,
                              categoryColor: "#02529c",
                              primaryFormula: sk.formula || `1d20 + @${sk.attribute} + ${sk.bonus}`,
                              primaryLabel: sk.name,
                              icon: sk.icon || sk.name
                            })
                          }
                        >
                          🎲 Rolar
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSkill(sk.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef5350",
                              fontSize: "12px",
                              cursor: "pointer",
                              padding: "0 2px"
                            }}
                          >
                            ×
                          </button>
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
                      gap: "4px",
                      marginTop: "6px",
                      flexWrap: "wrap"
                    }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      style={{ width: "130px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
                      placeholder="Nova Perícia..."
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                    />
                    <select
                      className="cp-input"
                      style={{ width: "100px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
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
                      style={{ width: "50px", padding: "3px 4px", fontSize: "11px", height: "26px" }}
                      value={newSkillBonus}
                      onChange={(e) => setNewSkillBonus(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn"
                      style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                    >
                      + Perícia
                    </button>
                  </form>
                )}
              </div>

              {/* Seção Habilidades & Magias (Estilo Card-Jitsu) */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px"
                  }}
                >
                  <strong style={{ fontSize: "12px", color: "#003264", textTransform: "uppercase" }}>
                    Habilidades & Magias
                  </strong>

                  {canEdit && (
                    <button
                      type="button"
                      className="cp-btn cp-btn-green"
                      style={{ padding: "2px 8px", fontSize: "10px", height: "24px" }}
                      onClick={() => setNewAbilityOpen((p) => !p)}
                    >
                      + Habilidade
                    </button>
                  )}
                </div>

                {newAbilityOpen && canEdit && (
                  <form
                    onSubmit={handleAddAbility}
                    style={{
                      background: "#ffffff",
                      border: "2px solid #008be3",
                      borderRadius: "10px",
                      padding: "8px",
                      marginBottom: "6px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px"
                    }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Nome da Habilidade/Magia"
                      value={abName}
                      onChange={(e) => setAbName(e.target.value)}
                      required
                      style={{ fontSize: "11px", padding: "3px 6px" }}
                    />
                    <div style={{ display: "flex", gap: "4px" }}>
                      <input
                        type="color"
                        className="cp-input"
                        style={{ width: "38px", padding: "1px", height: "24px" }}
                        value={abColor}
                        onChange={(e) => setAbColor(e.target.value)}
                      />
                      <select
                        className="cp-input"
                        style={{ fontSize: "11px", padding: "2px" }}
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
                        style={{ fontSize: "11px", padding: "2px 4px", width: "50px" }}
                        value={abCostAmt}
                        onChange={(e) => setAbCostAmt(e.target.value)}
                      />
                    </div>
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Acerto (ex: 1d20 + @forca)"
                      value={abHit}
                      onChange={(e) => setAbHit(e.target.value)}
                      style={{ fontSize: "11px", padding: "3px 6px" }}
                    />
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Efeito (ex: 2d6 + @forca)"
                      value={abEffect}
                      onChange={(e) => setAbEffect(e.target.value)}
                      style={{ fontSize: "11px", padding: "3px 6px" }}
                    />
                    <input
                      type="text"
                      className="cp-input"
                      style={{ gridColumn: "1 / -1", fontSize: "11px", padding: "3px 6px" }}
                      placeholder="Descrição..."
                      value={abDesc}
                      onChange={(e) => setAbDesc(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn cp-btn-green"
                      style={{ gridColumn: "1 / -1", padding: "3px", fontSize: "11px" }}
                    >
                      Salvar Habilidade
                    </button>
                  </form>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "6px"
                  }}
                >
                  {abilities.map((ab) => (
                    <div
                      key={ab.id}
                      style={{
                        background: "#ffffff",
                        border: `2.5px solid ${ab.elementColor || "#e53935"}`,
                        borderRadius: "10px",
                        padding: "8px",
                        boxShadow: "0 2px 4px rgba(0,27,58,0.08)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "4px"
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
                          <strong style={{ fontSize: "12px", color: "#1e293b" }}>
                            {ab.name}
                          </strong>
                          {ab.cost?.amount > 0 && (
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
                              {ab.cost.amount} {(ab.cost.resource || "mp").toUpperCase()}
                            </span>
                          )}
                        </div>
                        {ab.hitFormula && (
                          <div style={{ fontFamily: "var(--font-epf)", fontSize: "10px", color: "#013567" }}>
                            Teste: {ab.hitFormula}
                          </div>
                        )}
                        {ab.effectFormula && (
                          <div style={{ fontFamily: "var(--font-epf)", fontSize: "10px", color: "#b71c1c" }}>
                            Efeito: {ab.effectFormula}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "3px", marginTop: "2px" }}>
                        <button
                          type="button"
                          className="cp-btn cp-btn-gold"
                          style={{ flex: 1, padding: "3px 6px", fontSize: "10px", height: "24px" }}
                          onClick={() =>
                            triggerRoll({
                              title: ab.name,
                              categoryColor: ab.elementColor || "#e53935",
                              description: ab.description || "",
                              primaryFormula: ab.hitFormula || ab.effectFormula || "1d20",
                              primaryLabel: ab.hitFormula ? "Acerto" : "Efeito",
                              secondaryFormula: ab.hitFormula ? ab.effectFormula : "",
                              secondaryLabel: "Dano / Efeito",
                              cost: ab.cost,
                              icon: ab.icon || ab.name
                            })
                          }
                        >
                          🎲 Rolar
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            className="cp-btn cp-btn-orange"
                            style={{ padding: "3px 6px", fontSize: "10px", height: "24px" }}
                            onClick={() => handleDeleteAbility(ab.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 3: HISTÓRIA & NOTAS DA FICHA
             ========================================================================= */}
          {activeTab === "notes" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div>
                <strong style={{ fontSize: "12px", color: "#003264" }}>História & Origem</strong>
                <textarea
                  className="cp-input"
                  rows={6}
                  disabled={!canEdit}
                  placeholder="Biografia do pinguim, histórico, amigos, conexões..."
                  value={character.biography || ""}
                  onChange={(e) =>
                    onUpdateCharacter(character.id, { biography: e.target.value })
                  }
                  style={{ width: "100%", marginTop: "3px", fontSize: "12px" }}
                />
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: "12px", color: "#003264" }}>Anotações da Ficha</strong>
                <textarea
                  className="cp-input"
                  rows={6}
                  disabled={!canEdit}
                  placeholder="Lembretes, pistas, missões em andamento..."
                  value={character.notes || ""}
                  onChange={(e) =>
                    onUpdateCharacter(character.id, { notes: e.target.value })
                  }
                  style={{ width: "100%", marginTop: "3px", fontSize: "12px", flex: 1 }}
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              ABA 4: ROLAGENS PERSONALIZÁVEIS E MACROS
             ========================================================================= */}
          {activeTab === "rolls" && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}
            >
              {canEdit && (
                <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                  <form
                    onSubmit={handleCreateRollGroup}
                    style={{ display: "flex", gap: "4px" }}
                  >
                    <input
                      type="text"
                      className="cp-input"
                      style={{ width: "140px", padding: "3px 6px", fontSize: "11px", height: "26px" }}
                      placeholder="Novo grupo..."
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="cp-btn"
                      style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                    >
                      + Grupo
                    </button>
                  </form>

                  <button
                    type="button"
                    className="cp-btn cp-btn-green"
                    style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                    onClick={() => {
                      setNewCustomRollOpen((p) => !p);
                      if (importFromSheetOpen) setImportFromSheetOpen(false);
                    }}
                  >
                    + Nova Rolagem
                  </button>

                  <button
                    type="button"
                    className="cp-btn cp-btn-gold"
                    style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                    onClick={() => {
                      setImportFromSheetOpen((p) => !p);
                      if (newCustomRollOpen) setNewCustomRollOpen(false);
                    }}
                    title="Criar rolagem a partir de uma perícia ou habilidade da ficha"
                  >
                    + Da Ficha (Perícias/Magias)
                  </button>
                </div>
              )}

              {/* Painel para criar rolagem a partir de Perícia, Habilidade ou Magia da Ficha */}
              {importFromSheetOpen && canEdit && (
                <div
                  style={{
                    background: "#f0f6fc",
                    border: "2px solid #eab308",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong style={{ fontSize: "12px", color: "#003264" }}>
                        Criar Rolagem a partir da Ficha
                      </strong>
                      <span style={{ fontSize: "11px", color: "#475569" }}>no Grupo:</span>
                      <select
                        className="cp-input"
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        style={{ fontSize: "11px", padding: "2px 6px" }}
                      >
                        {rollGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="cp-btn cp-btn-orange"
                      style={{ padding: "1px 6px", fontSize: "10px" }}
                      onClick={() => setImportFromSheetOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {/* Perícias */}
                    <div style={{ background: "#ffffff", padding: "6px", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#02529c", marginBottom: "4px" }}>
                        Perícias ({skills.length})
                      </div>
                      <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                        {skills.length === 0 ? (
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Nenhuma perícia na ficha</div>
                        ) : (
                          skills.map((sk) => (
                            <div
                              key={sk.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "3px 6px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0"
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1, paddingRight: "4px" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {sk.name}
                                </div>
                                <div style={{ fontSize: "9px", color: "#64748b" }}>
                                  {sk.formula || `1d20 + @${sk.attribute}`}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="cp-btn cp-btn-green"
                                style={{ padding: "2px 6px", fontSize: "9px" }}
                                onClick={() => {
                                  pinToRollGroup(
                                    {
                                      name: sk.name,
                                      color: "#3090f0",
                                      icon: sk.name.toLowerCase().includes("arco") ? "bow" : "clover",
                                      hitFormula: sk.formula || `1d20 + @${sk.attribute || "forca"} + ${sk.bonus || 0}`,
                                      effectFormula: "",
                                      costResource: "mp",
                                      costAmount: 0
                                    },
                                    selectedGroupId
                                  );
                                }}
                              >
                                + Rolagem
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Habilidades & Magias */}
                    <div style={{ background: "#ffffff", padding: "6px", borderRadius: "8px", border: "1.5px solid #cbd5e1" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#e53935", marginBottom: "4px" }}>
                        Habilidades & Magias ({abilities.length})
                      </div>
                      <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                        {abilities.length === 0 ? (
                          <div style={{ fontSize: "10px", color: "#64748b" }}>Nenhuma habilidade na ficha</div>
                        ) : (
                          abilities.map((ab) => (
                            <div
                              key={ab.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "3px 6px",
                                background: "#f8fafc",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0"
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1, paddingRight: "4px" }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {ab.name}
                                </div>
                                <div style={{ fontSize: "9px", color: "#64748b" }}>
                                  {ab.hitFormula || "1d20"} {ab.effectFormula ? `| ${ab.effectFormula}` : ""}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="cp-btn cp-btn-green"
                                style={{ padding: "2px 6px", fontSize: "9px" }}
                                onClick={() => {
                                  pinToRollGroup(
                                    {
                                      name: ab.name,
                                      color: ab.elementColor || "#e53935",
                                      icon: ab.icon || ab.name,
                                      hitFormula: ab.hitFormula || "1d20",
                                      effectFormula: ab.effectFormula || "",
                                      costResource: ab.cost?.resource || "mp",
                                      costAmount: Number(ab.cost?.amount) || 0
                                    },
                                    selectedGroupId
                                  );
                                }}
                              >
                                + Rolagem
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {newCustomRollOpen && canEdit && (
                <form
                  onSubmit={handleAddCustomRollToGroup}
                  style={{
                    background: "#f0f6fc",
                    border: "2px solid #008be3",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <input
                      type="text"
                      className="cp-input"
                      placeholder="Título da Rolagem"
                      value={crName}
                      onChange={(e) => setCrName(e.target.value)}
                      required
                      style={{ fontSize: "11px", padding: "3px 6px", flex: 1 }}
                    />
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "2px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => setShowRollIconPicker((prev) => !prev)}
                        title="Escolher Ícone da Rolagem"
                      >
                        {renderCpFlashIcon(crIcon, 18)}
                      </button>
                      {showRollIconPicker && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            zIndex: 150,
                            width: "320px"
                          }}
                        >
                          <CpIconPicker
                            selectedIconId={crIcon}
                            onSelectIcon={(ic) => {
                              setCrIcon(ic);
                              setShowRollIconPicker(false);
                            }}
                            onClose={() => setShowRollIconPicker(false)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <select
                      className="cp-input"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      style={{ fontSize: "11px", padding: "2px" }}
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
                      style={{ width: "36px", padding: "1px", height: "24px" }}
                      value={crColor}
                      onChange={(e) => setCrColor(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Fórmula 1 (ex: 1d20 + @forca)"
                    value={crHit}
                    onChange={(e) => setCrHit(e.target.value)}
                    required
                    style={{ fontSize: "11px", padding: "3px 6px" }}
                  />
                  <input
                    type="text"
                    className="cp-input"
                    placeholder="Fórmula 2 (ex: 2d6 + @forca)"
                    value={crEffect}
                    onChange={(e) => setCrEffect(e.target.value)}
                    style={{ fontSize: "11px", padding: "3px 6px" }}
                  />
                  <div style={{ display: "flex", gap: "4px" }}>
                    <select
                      className="cp-input"
                      value={crCostRes}
                      onChange={(e) => setCrCostRes(e.target.value)}
                      style={{ fontSize: "11px", padding: "2px" }}
                    >
                      <option value="mp">Custo MP</option>
                      <option value="hp">Custo HP</option>
                    </select>
                    <input
                      type="number"
                      className="cp-input"
                      placeholder="Qtd"
                      min={0}
                      value={crCostAmt}
                      onChange={(e) => setCrCostAmt(Number(e.target.value) || 0)}
                      style={{ fontSize: "11px", padding: "2px 4px", width: "50px" }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="cp-btn cp-btn-green"
                    style={{ padding: "3px", fontSize: "11px" }}
                  >
                    Salvar no Grupo
                  </button>
                </form>
              )}

              {rollGroups.map((grp) => (
                <div
                  key={grp.id}
                  style={{
                    background: "#ffffff",
                    border: "2px solid #cbd5e1",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "13px", color: "#003264" }}>{grp.name}</strong>
                    {canEdit && (
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{ padding: "1px 6px", fontSize: "10px" }}
                        onClick={() => handleDeleteRollGroup(grp.id)}
                      >
                        Excluir Grupo
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                      gap: "6px"
                    }}
                  >
                    {(grp.rolls || []).map((r, idx) => {
                      const hotbarList = Array.isArray(character.hotbar) ? character.hotbar : [];
                      const slotIdx = hotbarList.findIndex((s) => s?.rollId === r.id);

                      return (
                        <div
                          key={r.id}
                          style={{
                            border: `2.5px solid ${r.color || "#3090f0"}`,
                            borderRadius: "8px",
                            padding: "6px",
                            background: "#f8fafc",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "4px"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              type="button"
                              className="cp-btn"
                              style={{
                                width: "26px",
                                height: "26px",
                                padding: "1px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                background: "#ffffff",
                                border: `1.5px solid ${r.color || "#008be3"}`,
                                borderRadius: "8px",
                                cursor: canEdit ? "pointer" : "default"
                              }}
                              onClick={() => {
                                if (canEdit) setEditingRollIconTarget({ roll: r, groupId: grp.id });
                              }}
                              title={canEdit ? "Clique para alterar o ícone desta rolagem" : r.name}
                            >
                              {renderCpFlashIcon(r.icon || r.name, 20)}
                            </button>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <strong style={{ fontSize: "12px", color: "#1e293b", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {r.name}
                              </strong>
                              <div style={{ fontFamily: "var(--font-epf)", fontSize: "10px", color: "#475569" }}>
                                {r.hitFormula}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
                            <button
                              type="button"
                              className="cp-btn cp-btn-gold"
                              style={{ flex: 1, padding: "3px", fontSize: "10px", height: "24px" }}
                              onClick={() =>
                                triggerRoll({
                                  title: r.name,
                                  categoryColor: r.color || "#3090f0",
                                  primaryFormula: r.hitFormula || "1d20",
                                  primaryLabel: "Rolagem",
                                  secondaryFormula: r.effectFormula || "",
                                  secondaryLabel: "Efeito / Dano",
                                  costResource: r.costResource,
                                  costAmount: r.costAmount,
                                  icon: r.icon || r.name
                                })
                              }
                            >
                              🎲 Rolar
                            </button>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  className={`cp-btn ${slotIdx !== -1 ? "cp-btn-green" : ""}`}
                                  style={{ padding: "3px 5px", fontSize: "10px", height: "24px" }}
                                  onClick={() => setHotbarModalRoll(r)}
                                  title={
                                    slotIdx !== -1
                                      ? `Atalho no Slot ${slotIdx + 1} da Hotbar (Bola de Neve)`
                                      : "Configurar atalho na Hotbar (Bola de Neve)"
                                  }
                                >
                                  ❄️{slotIdx !== -1 ? `${slotIdx + 1}` : ""}
                                </button>
                                <button
                                  type="button"
                                  className="cp-btn"
                                  style={{ padding: "2px 4px", fontSize: "9px" }}
                                  onClick={() => handleMoveRollOrder(grp.id, idx, -1)}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="cp-btn cp-btn-orange"
                                  style={{ padding: "2px 4px", fontSize: "9px" }}
                                  onClick={() => handleRemoveRollFromGroup(grp.id, r.id)}
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =========================================================================
            BARRA INFERIOR DE ABAS (ONDE SE TROCAM AS ABAS NO ESTILO CLUB PENGUIN)
           ========================================================================= */}
        <div className="cp-inv-bottom-dock">
          {/* Menu popup que sobe a partir do botão com as opções de abas */}
          {tabMenuOpen && (
            <div className="cp-tabs-popup-menu">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`cp-tabs-popup-item ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(t.id);
                    setTabMenuOpen(false);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="cp-inv-category-pill"
            onClick={() => setTabMenuOpen((prev) => !prev)}
            title="Trocar aba da ficha"
          >
            <span>{TABS.find((t) => t.id === activeTab)?.label || "Inventário"}</span>
            <span style={{ fontSize: "11px", color: "#627384" }}>
              {tabMenuOpen ? "▼" : "▲"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const hotbarModalNode = hotbarModalRoll && (
    <div className="cp-modal-overlay" onClick={() => setHotbarModalRoll(null)} style={{ zIndex: 1200 }}>
      <div
        className="cp-window"
        style={{ width: "300px", display: "flex", flexDirection: "column", gap: "10px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cp-title" style={{ fontSize: "14px" }}>
            Hotbar (Bola de Neve)
          </span>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "2px 6px", fontSize: "11px" }}
            onClick={() => setHotbarModalRoll(null)}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: "12px", fontWeight: 800, color: "#001b3a", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {renderCpFlashIcon(hotbarModalRoll.icon || hotbarModalRoll.name, 22)}
          </div>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hotbarModalRoll.name}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "6px",
            background: "#ffffff",
            padding: "8px",
            borderRadius: "12px",
            border: "2px solid #cbd5e1"
          }}
        >
          {Array.from({ length: 9 }).map((_, slotIdx) => {
            const currentSlot = (character.hotbar || [])[slotIdx];
            const isThisRoll = currentSlot?.rollId === hotbarModalRoll.id;

            return (
              <button
                key={slotIdx}
                type="button"
                className={`cp-btn ${isThisRoll ? "cp-btn-green" : currentSlot ? "cp-btn-gold" : ""}`}
                style={{
                  height: "56px",
                  padding: "2px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  fontSize: "10px"
                }}
                onClick={() => {
                  if (isThisRoll) {
                    handleRemoveRollFromHotbar(slotIdx);
                  } else {
                    handleAssignRollToHotbar(hotbarModalRoll, slotIdx);
                  }
                }}
                title={
                  isThisRoll
                    ? "Remover deste slot"
                    : currentSlot
                    ? `Substituir ${currentSlot.name}`
                    : `Fixar no Slot ${slotIdx + 1}`
                }
              >
                <span style={{ fontWeight: 900, fontSize: "11px" }}>#{slotIdx + 1}</span>
                <span style={{ fontSize: "9px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70px" }}>
                  {isThisRoll ? "Remover" : currentSlot ? currentSlot.name : "Vazio"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const rollIconPickerModalNode = editingRollIconTarget && (
    <div className="cp-modal-overlay" onClick={() => setEditingRollIconTarget(null)} style={{ zIndex: 1250 }}>
      <div
        className="cp-window"
        style={{ width: "380px", display: "flex", flexDirection: "column", gap: "10px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="cp-title" style={{ fontSize: "14px" }}>
            Alterar Ícone
          </span>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "2px 6px", fontSize: "11px" }}
            onClick={() => setEditingRollIconTarget(null)}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: "12px", fontWeight: 800, color: "#001b3a" }}>
          {editingRollIconTarget.roll.name}
        </div>

        <CpIconPicker
          selectedIconId={editingRollIconTarget.roll.icon}
          onSelectIcon={(ic) => {
            handleUpdateRollIcon(
              editingRollIconTarget.groupId,
              editingRollIconTarget.roll.id,
              ic
            );
            setEditingRollIconTarget(null);
          }}
          onClose={() => setEditingRollIconTarget(null)}
        />
      </div>
    </div>
  );

  if (isStandaloneWindow) {
    return (
      <div style={wrapperStyle}>
        {sheetBody}
        {hotbarModalNode}
        {rollIconPickerModalNode}
      </div>
    );
  }

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      {sheetBody}
      {hotbarModalNode}
      {rollIconPickerModalNode}
    </div>
  );
}
