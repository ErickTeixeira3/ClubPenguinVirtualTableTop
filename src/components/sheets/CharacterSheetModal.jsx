import { useEffect, useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import { renderCpFlashIcon } from "./CpFlashIcons";
import CpIconPicker from "./CpIconPicker";
import { TABS } from "./sheetConstants";
import {
  buildHotbarSlotFromRoll,
  resolveDynamicRollEntry,
  resolveHotbarSlot
} from "../../services/rollService";
import { Z_LAYERS } from "../../constants/zLayers";
import SheetNotesTab from "./tabs/SheetNotesTab";
import SheetAttributesTab from "./tabs/SheetAttributesTab";
import SheetInventoryTab from "./tabs/SheetInventoryTab";
import SheetInventoryItemForm from "./tabs/SheetInventoryItemForm";
import SheetInventoryToolbar from "./tabs/SheetInventoryToolbar";
import SheetSkillsToolbar from "./tabs/SheetSkillsToolbar";
import SheetSkillsTab from "./tabs/SheetSkillsTab";
import SheetRollsTab from "./tabs/SheetRollsTab";
import PlayerCardLeftPanel from "./PlayerCardLeftPanel";
import { usePlayerCardEditState } from "./state/usePlayerCardEditState";
import { useSkillsFormState } from "./state/useSkillsFormState";
import { useInventoryItemFormState } from "./state/useInventoryItemFormState";
import { useRollsFormState } from "./state/useRollsFormState";

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
  onPingSkill,
  onSpawnTokenOnMap,
  onClose,
  isStandaloneWindow = false,
  onStartAoeDemarcate = null
}) {
  // 'attributes' | 'skills' | 'inventory' | 'notes' | 'rolls'
  const [activeTab, setActiveTab] = useState("inventory");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(
    character?.rollGroups?.[0]?.id || "grp_combate"
  );
  const [expandedSkillIds, setExpandedSkillIds] = useState(new Set());

  // Estados de edição das Moedas e XP
  const cardEdit = usePlayerCardEditState(character);

  // Item selecionado no inventário para exibir popup de detalhes
  const [inspectedItem, setInspectedItem] = useState(null);

  // Estados para adição rápida
  const [newAttrLabel, setNewAttrLabel] = useState("");
  const skillsForm = useSkillsFormState();

  const itemForm = useInventoryItemFormState();
  const { newItemOpen } = itemForm;
  const [inspectedIconPickerOpen, setInspectedIconPickerOpen] = useState(false);

  const rollsForm = useRollsFormState();
  const { hotbarModalRoll, setHotbarModalRoll, editingRollIconTarget, setEditingRollIconTarget } = rollsForm;
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

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

  const hp = character.resources?.hp || { label: "Vida", current: 20, max: 20 };
  const mp = character.resources?.mp || {
    label: "Energia",
    current: 10,
    max: 10
  };
  const triggerRoll = (config) => {
    return onExecuteRoll({
      ...config,
      character,
      visibility: rollVisibility
    });
  };

  const handleDemarcateArea = (ab) => {
    const config = {
      skillId: ab.id,
      skillName: ab.name,
      rangeType: ab.range?.type || ab.rangeType || "ranged",
      rangeMeters: Number(ab.range?.distanceMeters ?? ab.rangeMeters ?? 9) || 9,
      aoeType: ab.aoe?.type || ab.aoeType || "circle",
      aoeRadiusMeters: Number(ab.aoe?.radiusMeters ?? ab.aoeRadiusMeters ?? 6) || 6,
      aoeConeAngleDeg: Number(ab.aoe?.coneAngleDeg ?? ab.aoeConeAngleDeg ?? 45) || 45,
      sourceCharacterId: character?.id || null,
      sourceCharacterName: character?.name || null,
      timestamp: Date.now()
    };
    if (onStartAoeDemarcate) {
      onStartAoeDemarcate(config);
    }
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
      sourceType: rollEntry.sourceType || "custom",
      sourceId: rollEntry.sourceId || null,
      customIcon: Boolean(rollEntry.customIcon),
      // Fase 6.3 (A18): atalho criado pela ficha segue o nome da origem (renomear propaga)
      customName: Boolean(rollEntry.customName),
      name: rollEntry.name || "Rolagem",
      color: rollEntry.color || "#02529c",
      // Fase 3.1 (V-19): atributo fixado recebe "clover" (mesmo ícone do resolvedor dinâmico)
      icon: rollEntry.icon || (rollEntry.sourceType === "attribute" ? "clover" : "sword"),
      hitFormula: rollEntry.hitFormula ?? "1d20",
      effectFormula: rollEntry.effectFormula || "",
      effectType: rollEntry.effectType || (rollEntry.effectFormula ? "damage" : null),
      rollKind: rollEntry.rollKind || null,
      range: rollEntry.range || null,
      aoe: rollEntry.aoe || null,
      trigger: rollEntry.trigger || null,
      savingThrow: rollEntry.savingThrow || null,
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
            icon: entry.icon || "sword",
            rollFormula: entry.effectFormula || entry.hitFormula || "",
            trigger: entry.trigger || "active",
            effectType: entry.effectType || "heal",
            savingThrow: entry.savingThrow || null,
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
            trigger: entry.trigger || "active",
            effectType: entry.effectType || "damage",
            savingThrow: entry.savingThrow || null,
            description: entry.description || ""
          }
        ]
      });
    }
  };

  const handleAssignRollToHotbar = (roll, slotIndex) => {
    if (!canEdit) return;
    const resolvedRoll = resolveDynamicRollEntry(roll, character) || roll;
    const currentHotbar = Array.isArray(character.hotbar)
      ? [...character.hotbar]
      : Array(9).fill(null);
    while (currentHotbar.length < 9) {
      currentHotbar.push(null);
    }
    // Fase 3.1 (V-09b): montagem única do slot (mesma da barra rápida)
    currentHotbar[slotIndex] = buildHotbarSlotFromRoll(resolvedRoll);
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
          r.id === rollId ? { ...r, icon: newIconId, customIcon: true } : r
        )
      };
    });
    const rawHotbar = Array.isArray(character.hotbar) ? [...character.hotbar] : [];
    const nextHotbar = rawHotbar.map((s) =>
      s?.rollId === rollId ? { ...s, icon: newIconId, customIcon: true } : s
    );
    onUpdateCharacter(character.id, {
      rollGroups: nextGroups,
      hotbar: nextHotbar
    });
    setEditingRollIconTarget(null);
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

  // Preenche a grade do inventário com pelo menos 12 slots para manter o padrão 3x4 do Club Penguin
  const wrapperStyle = isStandaloneWindow
    ? {
        width: "100vw",
        height: "100vh",
        padding: 0,
        margin: 0,
        overflow: "hidden",
        display: "flex"
      }
    : undefined;

  const sheetBody = (
    <div
      className={`cp-playercard-container ${isStandaloneWindow ? "standalone" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* LADO ESQUERDO: PLAYER CARD CLÁSSICO DO CLUB PENGUIN */}
      <PlayerCardLeftPanel
        cardBgColor={cardBgColor}
        character={character}
        canEdit={canEdit}
        onUpdateCharacter={onUpdateCharacter}
        isStandaloneWindow={isStandaloneWindow}
        onClose={onClose}
        avatarUrl={avatarUrl}
        onUploadCharacterImage={onUploadCharacterImage}
        campaignId={campaignId}
        cardEdit={cardEdit}
      />

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

            {isStandaloneWindow && (
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ padding: "3px 8px", fontSize: "11px", height: "26px" }}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? "⛶ Sair da Tela Cheia" : "⛶ Tela Cheia"}
              </button>
            )}
          </div>

          {/* Ações Específicas da Aba Aberta */}
          {activeTab === "inventory" && canEdit && (
            <SheetInventoryToolbar
              compendiumEntries={compendiumEntries}
              handlePullFromCompendium={handlePullFromCompendium}
              itemForm={itemForm}
            />
          )}

          {activeTab === "skills" && canEdit && (
            <SheetSkillsToolbar
              compendiumEntries={compendiumEntries}
              handlePullFromCompendium={handlePullFromCompendium}
              skillsForm={skillsForm}
            />
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
          <SheetInventoryItemForm
            canEdit={canEdit}
            onUpdateCharacter={onUpdateCharacter}
            character={character}
            inventory={inventory}
            itemForm={itemForm}
          />
        )}

        {/* ÁREA CENTRAL DAS ABAS */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* =========================================================================
              ABA 2: INVENTÁRIO (ESTILO GRADE DE QUADRADOS CLUB PENGUIN 3x4)
             ========================================================================= */}
          {activeTab === "inventory" && (
            <SheetInventoryTab
              inventory={inventory}
              inspectedItem={inspectedItem}
              setInspectedItem={setInspectedItem}
              canEdit={canEdit}
              setInspectedIconPickerOpen={setInspectedIconPickerOpen}
              triggerRoll={triggerRoll}
              pinToRollGroup={pinToRollGroup}
              inspectedIconPickerOpen={inspectedIconPickerOpen}
              onUpdateCharacter={onUpdateCharacter}
              character={character}
            />
          )}

          {/* =========================================================================
              ABA: ATRIBUTOS (Recursos HP/MP, Defesa, Nível, Token e Atributos Principais)
             ========================================================================= */}
          {(activeTab === "attributes" || activeTab === "main") && (
            <SheetAttributesTab
              canEdit={canEdit}
              hp={hp}
              mp={mp}
              character={character}
              onUpdateCharacter={onUpdateCharacter}
              cardBgColor={cardBgColor}
              tokenUrl={tokenUrl}
              onUploadCharacterImage={onUploadCharacterImage}
              onSpawnTokenOnMap={onSpawnTokenOnMap}
              attributes={attributes}
              triggerRoll={triggerRoll}
              pinToRollGroup={pinToRollGroup}
              newAttrLabel={newAttrLabel}
              setNewAttrLabel={setNewAttrLabel}
            />
          )}

          {/* =========================================================================
              ABA: SKILLS (Habilidades & Magias com Expansão e Ping, e Perícias)
             ========================================================================= */}
          {activeTab === "skills" && (
            <SheetSkillsTab
              canEdit={canEdit}
              abilities={abilities}
              expandedSkillIds={expandedSkillIds}
              handleDemarcateArea={handleDemarcateArea}
              triggerRoll={triggerRoll}
              pinToRollGroup={pinToRollGroup}
              skills={skills}
              attributes={attributes}
              setExpandedSkillIds={setExpandedSkillIds}
              onPingSkill={onPingSkill}
              character={character}
              rollVisibility={rollVisibility}
              onExecuteRoll={onExecuteRoll}
              onUpdateCharacter={onUpdateCharacter}
              skillsForm={skillsForm}
            />
          )}

          {/* =========================================================================
              ABA 3: HISTÓRIA & NOTAS DA FICHA
             ========================================================================= */}
          {activeTab === "notes" && (
            <SheetNotesTab
              canEdit={canEdit}
              character={character}
              onUpdateCharacter={onUpdateCharacter}
            />
          )}

          {/* =========================================================================
              ABA 4: ROLAGENS PERSONALIZÁVEIS E MACROS
             ========================================================================= */}
          {activeTab === "rolls" && (
            <SheetRollsTab
              canEdit={canEdit}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              rollGroups={rollGroups}
              skills={skills}
              pinToRollGroup={pinToRollGroup}
              abilities={abilities}
              character={character}
              triggerRoll={triggerRoll}
              handleDemarcateArea={handleDemarcateArea}
              onUpdateCharacter={onUpdateCharacter}
              rollsForm={rollsForm}
            />
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
    <div className="cp-modal-overlay" onClick={() => setHotbarModalRoll(null)} style={{ zIndex: Z_LAYERS.modalNested }}>
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
            const rawSlot = (character.hotbar || [])[slotIdx];
            const currentSlot = resolveHotbarSlot(rawSlot, character);
            // Fase 6.3 (A19): compara pelo rollId do slot salvo, não do resolvido
            const isThisRoll = Boolean(rawSlot?.rollId) && rawSlot.rollId === hotbarModalRoll.id;

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
    <div className="cp-modal-overlay" onClick={() => setEditingRollIconTarget(null)} style={{ zIndex: Z_LAYERS.modalNested }}>
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
