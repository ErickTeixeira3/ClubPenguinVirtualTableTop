import {
  COMPENDIUM_TYPES,
  EFFECT_TYPES,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../domain/constants.js";
import { DEFAULT_COLORS } from "../../domain/defaults.js";
import { isReleasedToPlayers } from "../../domain/permissions.js";

export function createInitialCompendiumFormState() {
  return {
    editingId: null,
    name: "",
    type: COMPENDIUM_TYPES.ABILITY,
    category: "",
    icon: "sword",
    showIconPicker: false,
    elementColor: DEFAULT_COLORS.compendiumElement,
    costResource: "mp",
    costAmount: 0,
    hitFormula: "1d20 + @forca",
    effectFormula: "1d8 + @forca",
    trigger: TRIGGER_TYPES.ACTIVE,
    effectType: EFFECT_TYPES.DAMAGE,
    rangeType: SKILL_RANGE_TYPES.RANGED,
    rangeMeters: 9,
    aoeType: SKILL_AOE_TYPES.SINGLE,
    aoeRadiusMeters: 6,
    aoeConeAngleDeg: 45,
    saveEnabled: false,
    saveDcFormula: "12",
    saveAttributeKey: "resistencia",
    saveEffectDesc: "",
    bonus: 2,
    attributeKey: "forca",
    description: "",
    isPublic: true,
    formError: null
  };
}

export function createInitialCompendiumState(initialTargetCharId = "") {
  return {
    filterType: "ALL",
    search: "",
    selectedTargetCharId: initialTargetCharId,
    addedFeedback: {},
    confirmDeleteEntry: null, // null | { id: string, name: string }
    form: createInitialCompendiumFormState()
  };
}

export function compendiumReducer(state, action) {
  switch (action.type) {
    case "SET_FILTER_TYPE":
      return { ...state, filterType: action.value };
    case "SET_SEARCH":
      return { ...state, search: action.value };
    case "SET_TARGET_CHAR":
      return { ...state, selectedTargetCharId: action.value };
    case "SET_ADDED_FEEDBACK":
      return {
        ...state,
        addedFeedback: { ...state.addedFeedback, [action.entryId]: action.active }
      };
    case "SET_CONFIRM_DELETE":
      return { ...state, confirmDeleteEntry: action.entry || null };
    case "SET_FORM_FIELD":
      return {
        ...state,
        form: {
          ...state.form,
          [action.field]: action.value,
          formError: null
        }
      };
    case "SET_FORM_ERROR":
      return {
        ...state,
        form: {
          ...state.form,
          formError: action.error || null
        }
      };
    case "START_EDIT": {
      const entry = action.entry;
      if (!entry) return state;
      return {
        ...state,
        form: {
          editingId: entry.id,
          name: entry.name || "",
          type: entry.type || COMPENDIUM_TYPES.ABILITY,
          category: entry.category || "",
          icon: entry.icon || "sword",
          showIconPicker: false,
          elementColor: entry.elementColor || DEFAULT_COLORS.compendiumElement,
          costResource: entry.cost?.resource || "mp",
          costAmount: entry.cost?.amount ?? 0,
          hitFormula: entry.hitFormula || "",
          effectFormula: entry.effectFormula || "",
          trigger: entry.trigger || TRIGGER_TYPES.ACTIVE,
          effectType: entry.effectType || EFFECT_TYPES.DAMAGE,
          rangeType: entry.range?.type || SKILL_RANGE_TYPES.RANGED,
          rangeMeters: entry.range?.distanceMeters ?? 9,
          aoeType: entry.aoe?.type || SKILL_AOE_TYPES.SINGLE,
          aoeRadiusMeters: entry.aoe?.radiusMeters ?? 6,
          aoeConeAngleDeg: entry.aoe?.coneAngleDeg === 60 ? 60 : 45,
          saveEnabled: Boolean(entry.savingThrow?.enabled),
          saveDcFormula: entry.savingThrow?.dcFormula || "12",
          saveAttributeKey:
            entry.savingThrow?.attributeKey ||
            entry.savingThrow?.attribute ||
            "resistencia",
          saveEffectDesc: entry.savingThrow?.effectDescription || "",
          bonus: entry.bonus ?? 2,
          attributeKey: entry.attributeKey || entry.attribute || "forca",
          description: entry.description || "",
          isPublic: isReleasedToPlayers(entry),
          formError: null
        }
      };
    }
    case "RESET_FORM":
      return {
        ...state,
        form: createInitialCompendiumFormState()
      };
    default:
      return state;
  }
}
