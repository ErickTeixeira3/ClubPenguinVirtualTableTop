import { TOKEN_KINDS } from "../../domain/constants.js";
import {
  DEFAULT_COLORS,
  DEFAULT_FREE_TOKEN_DEFENSE
} from "../../domain/defaults.js";
import { normalizeControlledByList } from "../../domain/permissions.js";

export function createInitialTokenModalState({
  initialToken,
  initialSecret,
  linkedCharacter,
  defaultLayer,
  isGM
}) {
  const isPc = initialToken?.kind === TOKEN_KINDS.PC;
  const hpSource = isPc
    ? linkedCharacter?.resources?.hp ||
      (initialToken?.bars?.hpMax != null
        ? { current: initialToken.bars.hpCurrent, max: initialToken.bars.hpMax }
        : null)
    : initialSecret?.hp || null;
  const mpSource = isPc
    ? linkedCharacter?.resources?.mp ||
      (initialToken?.bars?.mpMax != null
        ? { current: initialToken.bars.mpCurrent, max: initialToken.bars.mpMax }
        : null)
    : initialSecret?.mp || null;
  const defenseSource = isPc
    ? linkedCharacter?.defense ?? DEFAULT_FREE_TOKEN_DEFENSE
    : initialSecret?.defense ?? DEFAULT_FREE_TOKEN_DEFENSE;

  return {
    label: initialToken?.label || "",
    layer: initialToken?.layer || (isGM ? defaultLayer : "tokens"),
    compressedImage: null,
    externalUrl: initialToken?.image?.url || "",
    hasExistingImage: Boolean(
      initialToken?.image?.mediaId || initialToken?.image?.url
    ),
    hadExternalUrlOnly: Boolean(
      initialToken?.image?.url && !initialToken?.image?.mediaId
    ),
    imageCleared: false,
    sizeInCells: initialToken?.sizeInCells || 1,
    ringColor: initialToken?.ringColor || DEFAULT_COLORS.tokenRing,
    hidden: initialToken ? Boolean(initialToken.hidden) : false,
    showName: initialToken ? initialToken.showName !== false : true,
    hpCurrent: hpSource?.current ?? "",
    hpMax: hpSource?.max ?? "",
    mpCurrent: mpSource?.current ?? "",
    mpMax: mpSource?.max ?? "",
    defense: defenseSource,
    showBarsToPlayers: initialSecret ? initialSecret.showBarsToPlayers !== false : true,
    controlledBy: initialToken
      ? normalizeControlledByList(initialToken.controlledBy)
      : isGM
        ? ["ALL"]
        : [],
    submitting: false,
    errorMsg: ""
  };
}

export function tokenModalReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD": {
      const next = { ...state, [action.field]: action.value };
      if (action.field === "externalUrl") {
        const trimmed = String(action.value || "").trim();
        if (trimmed) {
          next.imageCleared = false;
        } else if (state.hadExternalUrlOnly && !state.compressedImage) {
          next.imageCleared = true;
        }
      }
      return next;
    }
    case "SET_IMAGE":
      return {
        ...state,
        compressedImage: action.compressed,
        imageCleared: false,
        label: state.label.trim() ? state.label : action.fallbackName || state.label,
        errorMsg: ""
      };
    case "CLEAR_IMAGE":
      return {
        ...state,
        compressedImage: null,
        externalUrl: "",
        imageCleared: true,
        errorMsg: ""
      };
    case "TOGGLE_CONTROLLER": {
      const target = action.uidOrAll;
      if (target === "ALL") {
        return {
          ...state,
          controlledBy: state.controlledBy.includes("ALL") ? [] : ["ALL"]
        };
      }
      const withoutAll = state.controlledBy.filter((id) => id !== "ALL");
      const next = withoutAll.includes(target)
        ? withoutAll.filter((id) => id !== target)
        : [...withoutAll, target];
      return { ...state, controlledBy: next };
    }
    case "SUBMIT_START":
      return { ...state, submitting: true, errorMsg: "" };
    case "SUBMIT_ERROR":
      return { ...state, submitting: false, errorMsg: action.message };
    case "SUBMIT_DONE":
      return { ...state, submitting: false };
    default:
      return state;
  }
}
