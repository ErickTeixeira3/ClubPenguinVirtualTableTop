import { DEFAULT_CELL_SIZE_PX, TOKEN_KINDS } from "../../domain/constants.js";
import {
  hasControlledByAccess,
  normalizeControlledByList
} from "../../domain/permissions.js";
import { getTokenCenter } from "../geometry/index.js";

const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

function isFiniteNum(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeAreas(areas) {
  if (!areas || typeof areas !== "object") {
    return [];
  }
  const list = [];
  if (Array.isArray(areas)) {
    for (const area of areas) {
      if (area && typeof area === "object") {
        list.push(area);
      }
    }
  } else {
    for (const [key, area] of Object.entries(areas)) {
      if (!UNSAFE_KEYS.has(key) && area && typeof area === "object") {
        list.push(area);
      }
    }
  }
  return list.sort((a, b) => {
    const tA = isFiniteNum(a.createdAt) ? a.createdAt : 0;
    const tB = isFiniteNum(b.createdAt) ? b.createdAt : 0;
    return tA - tB;
  });
}

function normalizeTokensList(tokens) {
  if (!tokens || typeof tokens !== "object") {
    return [];
  }
  const list = [];
  if (Array.isArray(tokens)) {
    for (const token of tokens) {
      if (token && typeof token === "object") {
        list.push(token);
      }
    }
  } else {
    for (const [key, token] of Object.entries(tokens)) {
      if (!UNSAFE_KEYS.has(key) && token && typeof token === "object") {
        list.push(token);
      }
    }
  }
  return list;
}

function isPlayerControlled(token, safeGmId) {
  if (hasControlledByAccess(token.controlledBy, "ALL")) {
    return true;
  }
  const controllers = normalizeControlledByList(token.controlledBy);
  if (safeGmId) {
    return controllers.some((id) => id !== safeGmId);
  }
  return controllers.length > 0;
}

export function isPointRevealed(px, py, fogState) {
  if (!isFiniteNum(px) || !isFiniteNum(py)) {
    return false;
  }
  if (!fogState || typeof fogState !== "object" || !fogState.enabled) {
    return true;
  }
  let revealed = false;
  for (const area of normalizeAreas(fogState.areas)) {
    if (
      !isFiniteNum(area.x) ||
      !isFiniteNum(area.y) ||
      !isFiniteNum(area.w) ||
      !isFiniteNum(area.h) ||
      area.w <= 0 ||
      area.h <= 0
    ) {
      continue;
    }
    const inside =
      px >= area.x &&
      px <= area.x + area.w &&
      py >= area.y &&
      py <= area.y + area.h;
    if (inside) {
      if (area.op === "reveal") {
        revealed = true;
      } else if (area.op === "hide") {
        revealed = false;
      }
    }
  }
  return revealed;
}

export function partitionTokensByFog(params = {}) {
  const safeParams = params && typeof params === "object" ? params : {};
  const {
    tokens,
    fogState,
    cellSizePx = DEFAULT_CELL_SIZE_PX,
    gmId = null
  } = safeParams;

  const publicTokens = [];
  const hiddenTokens = [];
  const fogEnabled = Boolean(
    fogState && typeof fogState === "object" && fogState.enabled
  );
  const safeGmId = typeof gmId === "string" ? gmId.trim() : "";

  for (const token of normalizeTokensList(tokens)) {
    if (token.hidden === true) {
      hiddenTokens.push(token);
      continue;
    }
    if (
      !fogEnabled ||
      token.kind === TOKEN_KINDS.PC ||
      isPlayerControlled(token, safeGmId)
    ) {
      publicTokens.push(token);
      continue;
    }
    const center = getTokenCenter(token, cellSizePx);
    if (center && isPointRevealed(center.x, center.y, fogState)) {
      publicTokens.push(token);
    } else {
      hiddenTokens.push(token);
    }
  }

  return { publicTokens, hiddenTokens };
}
