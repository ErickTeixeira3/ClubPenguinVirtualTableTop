import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { RESERVED_FORMULA_KEYS } from "../../domain/constants.js";
import { mapCompendiumEntryToCharacterEntry } from "../../engines/compendium";
import {
  buildHotbarSlotFromRoll,
  resolveDynamicRollEntry
} from "../../engines/rolls";
import { useMediaUrl } from "../../hooks/useMediaUrl";
import HotbarSlotModal from "./HotbarSlotModal";
import PlayerCardLeftPanel from "./PlayerCardLeftPanel";
import RollIconModal from "./RollIconModal";
import SheetPermissionsPanel from "./SheetPermissionsPanel";
import {
  createInitialInventoryFormState,
  createInitialRollsFormState,
  createInitialSkillsFormState,
  inventoryFormReducer,
  rollsFormReducer,
  skillsFormReducer
} from "./reducers/sheetFormReducers";
import { TABS, toSortedEntries } from "./sheetConstants";
import SheetAttributesTab from "./tabs/SheetAttributesTab";
import SheetInventoryItemForm from "./tabs/SheetInventoryItemForm";
import SheetInventoryTab from "./tabs/SheetInventoryTab";
import SheetInventoryToolbar from "./tabs/SheetInventoryToolbar";
import SheetNotesTab from "./tabs/SheetNotesTab";
import SheetRollsTab from "./tabs/SheetRollsTab";
import SheetSkillsTab from "./tabs/SheetSkillsTab";
import SheetSkillsToolbar from "./tabs/SheetSkillsToolbar";

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
  onRenameCharacter = null,
  onUpdateCharacterResource = null,
  onAddCharacterEntry = null,
  onUpdateCharacterEntry = null,
  onRemoveCharacterEntry = null,
  onReorderCharacterEntries = null,
  onSetHotbarSlot = null,
  onShareCharacter = null,
  onTransferCharacter = null,
  onConsumeCharacterItem = null,
  onPullCompendiumEntry = null,
  onUploadCharacterImage,
  onExecuteRoll,
  onPingSkill,
  onSpawnTokenOnMap,
  onClose,
  isStandaloneWindow = false,
  onStartAoeDemarcate = null
}) {
  const [activeTab, setActiveTab] = useState("inventory");
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [expandedSkillIds, setExpandedSkillIds] = useState(new Set());
  const [newAttrLabel, setNewAttrLabel] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rollGroups = useMemo(
    () => toSortedEntries(character?.rollGroups, "id"),
    [character?.rollGroups]
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    () => rollGroups[0]?.id || "grp_combate"
  );
  const pendingRollGroupsRef = useRef(new Map());

  useEffect(() => {
    const pendingMap = pendingRollGroupsRef.current;
    if (pendingMap.size === 0) return;
    const charId = character?.id;
    for (const [pendingKey, entry] of pendingMap.entries()) {
      if (!charId || !pendingKey.startsWith(`${charId}:`)) {
        pendingMap.delete(pendingKey);
        continue;
      }
      if (entry?.resolvedId && rollGroups.some((g) => g.id === entry.resolvedId)) {
        pendingMap.delete(pendingKey);
      }
    }
  }, [character?.id, rollGroups]);

  const [skillsState, dispatchSkills] = useReducer(
    skillsFormReducer,
    "forca",
    createInitialSkillsFormState
  );
  const [inventoryState, dispatchInventory] = useReducer(
    inventoryFormReducer,
    undefined,
    createInitialInventoryFormState
  );
  const [rollsState, dispatchRolls] = useReducer(
    rollsFormReducer,
    undefined,
    createInitialRollsFormState
  );

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
    character?.avatar?.mediaId ?? character?.avatarMediaId,
    character?.avatar?.url ?? character?.avatarExternalUrl,
    campaignId
  );

  const { url: tokenUrl } = useMediaUrl(
    character?.token?.image?.mediaId ??
      character?.avatar?.mediaId ??
      character?.defaultToken?.mediaId ??
      character?.avatarMediaId,
    character?.token?.image?.url ??
      character?.avatar?.url ??
      character?.defaultToken?.externalUrl ??
      character?.avatarExternalUrl,
    campaignId
  );

  if (!character) return null;

  const cardBgColor = character.cardColor || "#008be3";
  const attributes = toSortedEntries(character.attributes, "key");
  const skills = toSortedEntries(character.skills, "key");
  const abilities = toSortedEntries(character.abilities, "id");
  const inventory = toSortedEntries(character.inventory, "id");

  const activeGroupId = rollGroups.some((g) => g.id === selectedGroupId)
    ? selectedGroupId
    : rollGroups[0]?.id || "grp_combate";

  const hp = character.resources?.hp || { current: 20, max: 20 };
  const mp = character.resources?.mp || { current: 10, max: 10 };

  const triggerRoll = (config) => {
    return onExecuteRoll({
      ...config,
      character,
      visibility: rollVisibility
    });
  };

  const handleDemarcateArea = (ab) => {
    if (!ab) return;
    const config = {
      skillId: ab.source?.id || ab.sourceId || ab.id,
      skillName: ab.name,
      rangeType: ab.range?.type || "ranged",
      rangeMeters: Number(ab.range?.distanceMeters ?? 9) || 9,
      aoeType: ab.aoe?.type || "circle",
      aoeRadiusMeters: Number(ab.aoe?.radiusMeters ?? 6) || 6,
      aoeConeAngleDeg: Number(ab.aoe?.coneAngleDeg ?? 45) || 45,
      sourceCharacterId: character?.id || null,
      sourceCharacterName: character?.name || null,
      timestamp: Date.now()
    };
    onStartAoeDemarcate?.(config);
  };

  const pinToRollGroup = async (rollEntry, targetGroupId = null) => {
    if (!canEdit) return;
    try {
      const gid = targetGroupId || activeGroupId || "grp_combate";
      let targetGroup = rollGroups.find((g) => g.id === gid);

      if (!targetGroup) {
        let createdGroupId = gid;
        if (onAddCharacterEntry) {
          const pendingKey = `${character.id}:${gid}`;
          let pendingRecord = pendingRollGroupsRef.current.get(pendingKey);
          if (!pendingRecord) {
            const createPromise = Promise.resolve(
              onAddCharacterEntry(character.id, "rollGroups", {
                id: gid,
                name: "Ações de Combate"
              })
            )
              .then((createdGroup) => {
                if (createdGroup === null) {
                  pendingRollGroupsRef.current.delete(pendingKey);
                  return null;
                }
                const resolved =
                  createdGroup?.key || createdGroup?.entryKey || gid;
                const record = { promise: createPromise, resolvedId: resolved };
                pendingRollGroupsRef.current.set(pendingKey, record);
                if (resolved !== gid) {
                  pendingRollGroupsRef.current.set(
                    `${character.id}:${resolved}`,
                    record
                  );
                }
                return resolved;
              })
              .catch((err) => {
                pendingRollGroupsRef.current.delete(pendingKey);
                throw err;
              });
            pendingRecord = { promise: createPromise, resolvedId: null };
            pendingRollGroupsRef.current.set(pendingKey, pendingRecord);
          }
          createdGroupId = await pendingRecord.promise;
          if (!createdGroupId) return;
        }
        setSelectedGroupId(createdGroupId);
        targetGroup = { id: createdGroupId, name: "Ações de Combate", rolls: {} };
      }

      const sourceType = rollEntry.source?.type || rollEntry.sourceType || "custom";
      const sourceId = rollEntry.source?.id ?? rollEntry.sourceId ?? null;
      const overrides = {};
      if ((sourceType === "custom" || rollEntry.customName === true) && rollEntry.name) {
        overrides.name = rollEntry.name;
      }
      if ((sourceType === "custom" || rollEntry.customIcon === true) && rollEntry.icon) {
        overrides.icon = rollEntry.icon;
      }
      if ((sourceType === "custom" || rollEntry.customColor === true) && rollEntry.color) {
        overrides.color = rollEntry.color;
      }

      const payload = {
        source: { type: sourceType, id: sourceType === "custom" ? null : sourceId },
        overrides
      };

      if (sourceType === "custom") {
        payload.custom = {
          hitFormula: rollEntry.hitFormula ?? "1d20",
          effectFormula: rollEntry.effectFormula || "",
          rollKind: rollEntry.rollKind || "attack",
          effectType: rollEntry.effectType || "damage",
          cost: {
            resource: rollEntry.costResource || "mp",
            amount: Number(rollEntry.costAmount) || 0
          },
          savingThrow: rollEntry.savingThrow || {
            enabled: false,
            dcFormula: "12",
            attributeKey: "resistencia",
            effectDescription: ""
          }
        };
      }

      if (onAddCharacterEntry) {
        await onAddCharacterEntry(character.id, "rolls", payload, {
          rollGroupId: targetGroup.id
        });
      } else if (Array.isArray(character.rollGroups)) {
        const legacyRoll = {
          id: `roll_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sourceType,
          sourceId,
          customIcon: Boolean(rollEntry.customIcon),
          customName: Boolean(rollEntry.customName),
          name: rollEntry.name || "Rolagem",
          color: rollEntry.color || "#02529c",
          icon: rollEntry.icon || (sourceType === "attribute" ? "clover" : "sword"),
          hitFormula: rollEntry.hitFormula ?? "1d20",
          effectFormula: rollEntry.effectFormula || "",
          effectType: rollEntry.effectType || null,
          rollKind: rollEntry.rollKind || null,
          range: rollEntry.range || null,
          aoe: rollEntry.aoe || null,
          trigger: rollEntry.trigger || null,
          savingThrow: rollEntry.savingThrow || null,
          costResource: rollEntry.costResource || "mp",
          costAmount: rollEntry.costAmount || 0
        };
        const baseGroups =
          rollGroups.length > 0
            ? rollGroups
            : [{ id: targetGroup.id, name: "Ações Rápidas", rolls: [] }];
        const nextGroups = baseGroups.map((g) =>
          g.id === targetGroup.id ? { ...g, rolls: [...(g.rolls || []), legacyRoll] } : g
        );
        await onUpdateCharacter(character.id, { rollGroups: nextGroups });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handlePullFromCompendium = async (entry) => {
    if (!canEdit || !entry) return;
    try {
      if (onPullCompendiumEntry) {
        await onPullCompendiumEntry(character.id, entry);
        return;
      }
      const existingKeys = [
        ...attributes.map((a) => a.key),
        ...skills.map((s) => s.key || s.id),
        ...RESERVED_FORMULA_KEYS
      ];
      const orderCount =
        entry.type === "item"
          ? inventory.length
          : entry.type === "skill"
            ? skills.length
            : abilities.length;
      const mapped = mapCompendiumEntryToCharacterEntry(entry, {
        createId: (prefix) =>
          `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        existingKeys,
        existingOrder: orderCount
      });

      if (onAddCharacterEntry) {
        await onAddCharacterEntry(character.id, mapped.collection, {
          ...mapped.entry,
          allowFallbackAttribute: true
        });
      } else {
        await onUpdateCharacter(character.id, {
          [`${mapped.collection}.${mapped.entryKey}`]: mapped.entry
        });
      }
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleAssignRollToHotbar = async (roll, slotIndex) => {
    if (!canEdit) return;
    try {
      const slotKey = String(slotIndex + 1);
      const resolvedRoll = resolveDynamicRollEntry(roll, character) || roll;
      const slotValue = buildHotbarSlotFromRoll(
        resolvedRoll,
        roll.rollGroupId || activeGroupId
      );
      if (onSetHotbarSlot) {
        await onSetHotbarSlot(character.id, slotKey, slotValue);
      } else if (Array.isArray(character.hotbar)) {
        const next = [...character.hotbar];
        while (next.length < 9) next.push(null);
        next[slotIndex] = slotValue;
        await onUpdateCharacter(character.id, { hotbar: next });
      } else {
        await onUpdateCharacter(character.id, { [`hotbar.${slotKey}`]: slotValue });
      }
      dispatchRolls({ type: "SET_FIELD", field: "hotbarModalRoll", value: null });
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleRemoveRollFromHotbar = async (slotIndex) => {
    if (!canEdit) return;
    try {
      const slotKey = String(slotIndex + 1);
      if (onSetHotbarSlot) {
        await onSetHotbarSlot(character.id, slotKey, null);
      } else if (Array.isArray(character.hotbar)) {
        const next = [...character.hotbar];
        while (next.length < 9) next.push(null);
        next[slotIndex] = null;
        await onUpdateCharacter(character.id, { hotbar: next });
      } else {
        await onUpdateCharacter(character.id, { [`hotbar.${slotKey}`]: null });
      }
      dispatchRolls({ type: "SET_FIELD", field: "hotbarModalRoll", value: null });
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleUpdateRollIcon = async (groupId, rollId, newIconId) => {
    if (!canEdit) return;
    try {
      const grp = rollGroups.find((g) => g.id === groupId);
      const existingRoll = toSortedEntries(grp?.rolls).find((r) => r.id === rollId);
      if (onUpdateCharacterEntry) {
        await onUpdateCharacterEntry(
          character.id,
          "rolls",
          rollId,
          {
            overrides: {
              ...(existingRoll?.overrides || {}),
              icon: newIconId
            }
          },
          { rollGroupId: groupId }
        );
      } else if (Array.isArray(character.rollGroups)) {
        const nextGroups = rollGroups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                rolls: (g.rolls || []).map((r) =>
                  r.id === rollId ? { ...r, icon: newIconId, customIcon: true } : r
                )
              }
            : g
        );
        await onUpdateCharacter(character.id, { rollGroups: nextGroups });
      }
      dispatchRolls({ type: "SET_FIELD", field: "editingRollIconTarget", value: null });
    } catch {
      // Erro já notificado pelo hook
    }
  };

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
      <PlayerCardLeftPanel
        cardBgColor={cardBgColor}
        character={character}
        canEdit={canEdit}
        onUpdateCharacter={onUpdateCharacter}
        onRenameCharacter={onRenameCharacter}
        isStandaloneWindow={isStandaloneWindow}
        onClose={onClose}
        avatarUrl={avatarUrl}
        onUploadCharacterImage={onUploadCharacterImage}
        campaignId={campaignId}
      />

      <div className="cp-playercard-right">
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

          {activeTab === "inventory" && canEdit && (
            <SheetInventoryToolbar
              compendiumEntries={compendiumEntries}
              handlePullFromCompendium={handlePullFromCompendium}
              onToggleNewItem={() => dispatchInventory({ type: "TOGGLE_NEW_ITEM" })}
            />
          )}

          {activeTab === "skills" && canEdit && (
            <SheetSkillsToolbar
              compendiumEntries={compendiumEntries}
              handlePullFromCompendium={handlePullFromCompendium}
              onToggleNewAbility={() => dispatchSkills({ type: "TOGGLE_NEW_ABILITY" })}
            />
          )}
        </div>

        {showPermissions && isGM && (
          <SheetPermissionsPanel
            character={character}
            playersMap={playersMap}
            onShareCharacter={onShareCharacter}
            onTransferCharacter={onTransferCharacter}
            onUpdateCharacter={onUpdateCharacter}
          />
        )}

        {inventoryState.newItemOpen && activeTab === "inventory" && canEdit && (
          <SheetInventoryItemForm
            canEdit={canEdit}
            onUpdateCharacter={onUpdateCharacter}
            onAddCharacterEntry={onAddCharacterEntry}
            character={character}
            inventoryState={inventoryState}
            dispatchInventory={dispatchInventory}
          />
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {activeTab === "inventory" && (
            <SheetInventoryTab
              inventory={inventory}
              inspectedItemId={inventoryState.inspectedItemId}
              inspectedIconPickerOpen={inventoryState.inspectedIconPickerOpen}
              confirmDeleteItem={inventoryState.confirmDeleteItem}
              dispatchInventory={dispatchInventory}
              canEdit={canEdit}
              triggerRoll={triggerRoll}
              pinToRollGroup={pinToRollGroup}
              onUpdateCharacter={onUpdateCharacter}
              onUpdateCharacterEntry={onUpdateCharacterEntry}
              onRemoveCharacterEntry={onRemoveCharacterEntry}
              onConsumeCharacterItem={onConsumeCharacterItem}
              character={character}
            />
          )}

          {activeTab === "attributes" && (
            <SheetAttributesTab
              canEdit={canEdit}
              hp={hp}
              mp={mp}
              character={character}
              onUpdateCharacter={onUpdateCharacter}
              onUpdateCharacterResource={onUpdateCharacterResource}
              onAddCharacterEntry={onAddCharacterEntry}
              onUpdateCharacterEntry={onUpdateCharacterEntry}
              onRemoveCharacterEntry={onRemoveCharacterEntry}
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
              onAddCharacterEntry={onAddCharacterEntry}
              onUpdateCharacterEntry={onUpdateCharacterEntry}
              onRemoveCharacterEntry={onRemoveCharacterEntry}
              skillsState={skillsState}
              dispatchSkills={dispatchSkills}
            />
          )}

          {activeTab === "notes" && (
            <SheetNotesTab
              canEdit={canEdit}
              character={character}
              onUpdateCharacter={onUpdateCharacter}
            />
          )}

          {activeTab === "rolls" && (
            <SheetRollsTab
              canEdit={canEdit}
              selectedGroupId={activeGroupId}
              setSelectedGroupId={setSelectedGroupId}
              rollGroups={rollGroups}
              skills={skills}
              pinToRollGroup={pinToRollGroup}
              abilities={abilities}
              character={character}
              triggerRoll={triggerRoll}
              handleDemarcateArea={handleDemarcateArea}
              onUpdateCharacter={onUpdateCharacter}
              onAddCharacterEntry={onAddCharacterEntry}
              onRemoveCharacterEntry={onRemoveCharacterEntry}
              onReorderCharacterEntries={onReorderCharacterEntries}
              rollsState={rollsState}
              dispatchRolls={dispatchRolls}
            />
          )}
        </div>

        <div className="cp-inv-bottom-dock">
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

  const hotbarModalNode = (
    <HotbarSlotModal
      character={character}
      hotbarModalRoll={rollsState.hotbarModalRoll}
      onAssignRoll={handleAssignRollToHotbar}
      onRemoveSlot={handleRemoveRollFromHotbar}
      onClose={() =>
        dispatchRolls({ type: "SET_FIELD", field: "hotbarModalRoll", value: null })
      }
    />
  );

  const rollIconPickerModalNode = (
    <RollIconModal
      target={rollsState.editingRollIconTarget}
      onSelectIcon={handleUpdateRollIcon}
      onClose={() =>
        dispatchRolls({ type: "SET_FIELD", field: "editingRollIconTarget", value: null })
      }
    />
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
