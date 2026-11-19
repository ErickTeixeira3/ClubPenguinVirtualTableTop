import { useCallback, useMemo, useReducer } from "react";
import { LAYER_NAMES } from "../../domain/constants.js";
import { DEFAULT_COLORS } from "../../domain/defaults.js";

export const INITIAL_BOARD_TOOLS_STATE = Object.freeze({
  toolMode: "move",
  openFlyout: null,
  leftToolbarCollapsed: false,
  gmLayer: LAYER_NAMES.TOKENS,
  drawColor: DEFAULT_COLORS.drawingStroke,
  drawWidth: 4,
  drawFontSize: 24,
  shapeHasFill: false,
  shapeFillColor: DEFAULT_COLORS.drawingFill,
  measureShape: "line",
  coneAngle: 45
});

export function boardToolsReducer(state, action) {
  switch (action.type) {
    case "SET_TOOL_MODE": {
      const nextTool =
        typeof action.payload === "function"
          ? action.payload(state.toolMode)
          : action.payload;
      return {
        ...state,
        toolMode: nextTool,
        openFlyout: action.closeFlyout ? null : state.openFlyout
      };
    }
    case "TOGGLE_FLYOUT": {
      const next = state.openFlyout === action.payload ? null : action.payload;
      return { ...state, openFlyout: next };
    }
    case "SET_OPEN_FLYOUT": {
      const next =
        typeof action.payload === "function"
          ? action.payload(state.openFlyout)
          : action.payload;
      return { ...state, openFlyout: next };
    }
    case "TOGGLE_TOOLBAR_COLLAPSED":
      return {
        ...state,
        leftToolbarCollapsed: !state.leftToolbarCollapsed,
        openFlyout: null
      };
    case "SET_GM_LAYER":
      return {
        ...state,
        gmLayer: action.payload,
        openFlyout: null
      };
    case "SET_DRAW_COLOR":
      return { ...state, drawColor: action.payload };
    case "SET_DRAW_WIDTH":
      return { ...state, drawWidth: action.payload };
    case "SET_DRAW_FONT_SIZE": {
      const next =
        typeof action.payload === "function"
          ? action.payload(state.drawFontSize)
          : action.payload;
      return { ...state, drawFontSize: Math.max(12, Math.min(72, next)) };
    }
    case "SET_SHAPE_HAS_FILL":
      return { ...state, shapeHasFill: Boolean(action.payload) };
    case "SET_SHAPE_FILL_COLOR":
      return { ...state, shapeFillColor: action.payload };
    case "SET_MEASURE_SHAPE":
      return {
        ...state,
        measureShape: action.payload,
        toolMode: action.activateMeasure ? "measure" : state.toolMode,
        openFlyout: action.closeFlyout ? null : state.openFlyout
      };
    case "SET_CONE_ANGLE":
      return { ...state, coneAngle: action.payload === 60 ? 60 : 45 };
    // FUN-03: alterna cone/ângulo atomicamente no reducer sem setState dentro de updater
    case "SELECT_OR_CYCLE_CONE":
      if (state.measureShape !== "cone") {
        return { ...state, measureShape: "cone" };
      }
      return { ...state, coneAngle: state.coneAngle === 45 ? 60 : 45 };
    default:
      return state;
  }
}

export function useBoardTools({ isGM = false } = {}) {
  const [state, dispatch] = useReducer(boardToolsReducer, INITIAL_BOARD_TOOLS_STATE);

  const effectiveLayer = isGM ? state.gmLayer : LAYER_NAMES.TOKENS;
  const isDrawToolActive =
    state.toolMode === "draw_pencil" ||
    state.toolMode === "draw_select" ||
    state.toolMode === "draw_text" ||
    state.toolMode === "draw_circle" ||
    state.toolMode === "draw_rect";

  const setToolMode = useCallback(
    (payload, { closeFlyout = false } = {}) =>
      dispatch({ type: "SET_TOOL_MODE", payload, closeFlyout }),
    []
  );
  const toggleFlyout = useCallback(
    (flyout) => dispatch({ type: "TOGGLE_FLYOUT", payload: flyout }),
    []
  );
  const setOpenFlyout = useCallback(
    (payload) => dispatch({ type: "SET_OPEN_FLYOUT", payload }),
    []
  );
  const toggleToolbarCollapsed = useCallback(
    () => dispatch({ type: "TOGGLE_TOOLBAR_COLLAPSED" }),
    []
  );
  const setGmLayer = useCallback(
    (layer) => dispatch({ type: "SET_GM_LAYER", payload: layer }),
    []
  );
  const setDrawColor = useCallback(
    (color) => dispatch({ type: "SET_DRAW_COLOR", payload: color }),
    []
  );
  const setDrawWidth = useCallback(
    (width) => dispatch({ type: "SET_DRAW_WIDTH", payload: width }),
    []
  );
  const setDrawFontSize = useCallback(
    (size) => dispatch({ type: "SET_DRAW_FONT_SIZE", payload: size }),
    []
  );
  const setShapeHasFill = useCallback(
    (hasFill) => dispatch({ type: "SET_SHAPE_HAS_FILL", payload: hasFill }),
    []
  );
  const setShapeFillColor = useCallback(
    (color) => dispatch({ type: "SET_SHAPE_FILL_COLOR", payload: color }),
    []
  );
  const setMeasureShape = useCallback(
    (shape, options = {}) =>
      dispatch({
        type: "SET_MEASURE_SHAPE",
        payload: shape,
        activateMeasure: Boolean(options.activateMeasure),
        closeFlyout: Boolean(options.closeFlyout)
      }),
    []
  );
  const setConeAngle = useCallback(
    (angle) => dispatch({ type: "SET_CONE_ANGLE", payload: angle }),
    []
  );
  const selectOrCycleCone = useCallback(
    () => dispatch({ type: "SELECT_OR_CYCLE_CONE" }),
    []
  );

  return useMemo(
    () => ({
      ...state,
      effectiveLayer,
      isDrawToolActive,
      setToolMode,
      toggleFlyout,
      setOpenFlyout,
      toggleToolbarCollapsed,
      setGmLayer,
      setDrawColor,
      setDrawWidth,
      setDrawFontSize,
      setShapeHasFill,
      setShapeFillColor,
      setMeasureShape,
      setConeAngle,
      selectOrCycleCone
    }),
    [
      state,
      effectiveLayer,
      isDrawToolActive,
      setToolMode,
      toggleFlyout,
      setOpenFlyout,
      toggleToolbarCollapsed,
      setGmLayer,
      setDrawColor,
      setDrawWidth,
      setDrawFontSize,
      setShapeHasFill,
      setShapeFillColor,
      setMeasureShape,
      setConeAngle,
      selectOrCycleCone
    ]
  );
}
