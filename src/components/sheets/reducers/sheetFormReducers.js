import {
  EFFECT_TYPES,
  ROLL_KINDS,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../../domain/constants.js";
import { DEFAULT_COLORS } from "../../../domain/defaults.js";

// ============================================================================
// PlayerCardLeftPanel — edição inline unificada de Moedas e XP
// ============================================================================

export function createInitialPlayerCardEditState() {
  return {
    editingField: null, // null | 'coins' | 'xp'
    draftValue: 0
  };
}

export function playerCardEditReducer(state, action) {
  switch (action.type) {
    case "START_EDIT":
      return {
        editingField: action.field,
        draftValue: action.value ?? 0
      };
    case "SET_DRAFT":
      return {
        ...state,
        draftValue: action.value
      };
    case "CANCEL_EDIT":
      return {
        ...state,
        editingField: null
      };
    default:
      return state;
  }
}

// ============================================================================
// Aba Skills — formulários de Perícia e Habilidade + confirmações U6
// ============================================================================

export function createInitialSkillsFormState(defaultSkillAttr = "forca") {
  return {
    newSkillName: "",
    newSkillAttr: defaultSkillAttr,
    newSkillBonus: 2,
    newAbilityOpen: false,
    editingAbilityId: null,
    abName: "",
    abIcon: "sword",
    showAbIconPicker: false,
    abColor: DEFAULT_COLORS.abilityElement,
    abCostRes: "mp",
    abCostAmt: 0,
    abHit: "1d20 + @forca",
    abEffect: "1d8 + @forca",
    abTrigger: TRIGGER_TYPES.ACTIVE,
    abEffectType: EFFECT_TYPES.DAMAGE,
    abRangeType: SKILL_RANGE_TYPES.RANGED,
    abRangeDist: 9,
    abAoeType: SKILL_AOE_TYPES.SINGLE,
    abAoeRadius: 6,
    abAoeConeAngle: 45,
    abSaveEnabled: false,
    abSaveDc: "12",
    abSaveAttr: "resistencia",
    abSaveDesc: "",
    abDesc: "",
    confirmDelete: null, // null | { kind: 'skill' | 'ability', key: string, label: string }
    formError: null
  };
}

export function skillsFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        formError: null
      };
    case "TOGGLE_NEW_ABILITY": {
      if (state.newAbilityOpen) {
        return {
          ...createInitialSkillsFormState(state.newSkillAttr),
          newSkillName: state.newSkillName,
          newSkillBonus: state.newSkillBonus,
          newAbilityOpen: false
        };
      }
      return {
        ...createInitialSkillsFormState(state.newSkillAttr),
        newSkillName: state.newSkillName,
        newSkillBonus: state.newSkillBonus,
        newAbilityOpen: true
      };
    }
    case "START_EDIT_ABILITY": {
      const ab = action.ability;
      if (!ab) return state;
      return {
        ...state,
        newAbilityOpen: true,
        editingAbilityId: ab.id,
        abName: ab.name || "",
        abIcon: ab.icon || "sword",
        showAbIconPicker: false,
        abColor: ab.elementColor || DEFAULT_COLORS.abilityElement,
        abCostRes: ab.cost?.resource || "mp",
        abCostAmt: ab.cost?.amount ?? 0,
        abHit: ab.hitFormula ?? "",
        abEffect: ab.effectFormula ?? "",
        abTrigger: ab.trigger || TRIGGER_TYPES.ACTIVE,
        abEffectType: ab.effectType || EFFECT_TYPES.DAMAGE,
        abRangeType: ab.range?.type || SKILL_RANGE_TYPES.RANGED,
        abRangeDist: ab.range?.distanceMeters ?? 9,
        abAoeType: ab.aoe?.type || SKILL_AOE_TYPES.SINGLE,
        abAoeRadius: ab.aoe?.radiusMeters ?? 6,
        abAoeConeAngle: ab.aoe?.coneAngleDeg === 60 ? 60 : 45,
        abSaveEnabled: Boolean(ab.savingThrow?.enabled),
        abSaveDc: ab.savingThrow?.dcFormula || "12",
        abSaveAttr: ab.savingThrow?.attributeKey || ab.savingThrow?.attribute || "resistencia",
        abSaveDesc: ab.savingThrow?.effectDescription || "",
        abDesc: ab.description || "",
        formError: null
      };
    }
    case "RESET_ABILITY_FORM":
      return {
        ...createInitialSkillsFormState(state.newSkillAttr),
        newSkillName: state.newSkillName,
        newSkillBonus: state.newSkillBonus,
        newAbilityOpen: false
      };
    case "OPEN_DELETE_CONFIRM":
      return {
        ...state,
        confirmDelete: action.payload
      };
    case "CLOSE_DELETE_CONFIRM":
      return {
        ...state,
        confirmDelete: null
      };
    case "SET_ERROR":
      return {
        ...state,
        formError: action.error || null
      };
    default:
      return state;
  }
}

// ============================================================================
// Aba Inventário — formulário de item, inspeção por ID (INT-18) e confirmação U6
// ============================================================================

export function createInitialInventoryFormState() {
  return {
    newItemOpen: false,
    inspectedItemId: null,
    inspectedIconPickerOpen: false,
    itemName: "",
    itemQty: 1,
    itemFormula: "",
    itemTrigger: TRIGGER_TYPES.ACTIVE,
    itemEffectType: EFFECT_TYPES.HEAL,
    itemConsumeOnUse: true,
    itemSaveEnabled: false,
    itemSaveDc: "12",
    itemSaveAttr: "resistencia",
    itemSaveDesc: "",
    itemDesc: "",
    itemIcon: "sword",
    showIconPicker: false,
    confirmDeleteItem: null, // null | { id: string, label: string }
    formError: null
  };
}

export function inventoryFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        formError: null
      };
    case "TOGGLE_NEW_ITEM":
      return {
        ...state,
        newItemOpen: !state.newItemOpen,
        formError: null
      };
    case "TOGGLE_INSPECT_ITEM": {
      const nextId = state.inspectedItemId === action.itemId ? null : action.itemId;
      return {
        ...state,
        inspectedItemId: nextId,
        inspectedIconPickerOpen: false
      };
    }
    case "CLEAR_INSPECTED":
      return {
        ...state,
        inspectedItemId: null,
        inspectedIconPickerOpen: false
      };
    case "RESET_ITEM_FORM":
      return {
        ...createInitialInventoryFormState(),
        inspectedItemId: state.inspectedItemId
      };
    case "OPEN_DELETE_CONFIRM":
      return {
        ...state,
        confirmDeleteItem: action.payload
      };
    case "CLOSE_DELETE_CONFIRM":
      return {
        ...state,
        confirmDeleteItem: null
      };
    case "SET_ERROR":
      return {
        ...state,
        formError: action.error || null
      };
    default:
      return state;
  }
}

// ============================================================================
// Aba Rolagens & Ações — sem estado morto crSave*
// ============================================================================

export function createInitialRollsFormState() {
  return {
    newGroupName: "",
    newCustomRollOpen: false,
    importFromSheetOpen: false,
    crName: "",
    crIcon: "sword",
    showRollIconPicker: false,
    crColor: DEFAULT_COLORS.customRoll,
    crHit: "1d20 + @forca",
    crEffect: "",
    crEffectType: EFFECT_TYPES.DAMAGE,
    crRollKind: ROLL_KINDS.ATTACK,
    crCostRes: "mp",
    crCostAmt: 0,
    hotbarModalRoll: null,
    editingRollIconTarget: null,
    confirmDelete: null, // null | { kind: 'group' | 'roll', groupId: string, rollId?: string, label: string }
    formError: null
  };
}

export function rollsFormReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.field]: action.value,
        formError: null
      };
    case "TOGGLE_CUSTOM_ROLL":
      return {
        ...state,
        newCustomRollOpen: !state.newCustomRollOpen,
        importFromSheetOpen: false,
        formError: null
      };
    case "TOGGLE_IMPORT_SHEET":
      return {
        ...state,
        importFromSheetOpen: !state.importFromSheetOpen,
        newCustomRollOpen: false,
        formError: null
      };
    case "RESET_CUSTOM_FORM":
      return {
        ...state,
        newCustomRollOpen: false,
        crName: "",
        crIcon: "sword",
        showRollIconPicker: false,
        crEffect: "",
        crEffectType: EFFECT_TYPES.DAMAGE,
        crRollKind: ROLL_KINDS.ATTACK,
        crCostAmt: 0,
        formError: null
      };
    case "OPEN_DELETE_CONFIRM":
      return {
        ...state,
        confirmDelete: action.payload
      };
    case "CLOSE_DELETE_CONFIRM":
      return {
        ...state,
        confirmDelete: null
      };
    case "SET_ERROR":
      return {
        ...state,
        formError: action.error || null
      };
    default:
      return state;
  }
}
