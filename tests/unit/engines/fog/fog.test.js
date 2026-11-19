import { describe, expect, it } from "vitest";
import { TOKEN_KINDS } from "../../../../src/domain/constants.js";
import { DEFAULT_FOG_DEFAULTS } from "../../../../src/domain/defaults.js";
import {
  isPointRevealed,
  partitionTokensByFog
} from "../../../../src/engines/fog/index.js";

describe("fog/isPointRevealed", () => {
  it("fails closed (false) on non-finite coordinates even when fog is disabled", () => {
    expect(isPointRevealed(Number.NaN, 10, { enabled: false })).toBe(false);
    expect(isPointRevealed(10, Number.POSITIVE_INFINITY, null)).toBe(false);
    expect(isPointRevealed(null, 10, { enabled: false })).toBe(false);
    expect(isPointRevealed(10, undefined, { enabled: false })).toBe(false);
    expect(isPointRevealed("10", 10, { enabled: false })).toBe(false);
  });

  it("returns true when fogState is missing, invalid, or disabled", () => {
    expect(isPointRevealed(50, 50, null)).toBe(true);
    expect(isPointRevealed(50, 50, undefined)).toBe(true);
    expect(isPointRevealed(50, 50, "bad")).toBe(true);
    expect(isPointRevealed(50, 50, { enabled: false })).toBe(true);
    expect(isPointRevealed(50, 50, {})).toBe(true);
  });

  it("always starts opaque when enabled regardless of defaultOpaque", () => {
    expect(
      isPointRevealed(50, 50, { ...DEFAULT_FOG_DEFAULTS, enabled: true, areas: {} })
    ).toBe(false);
    expect(
      isPointRevealed(50, 50, { enabled: true, defaultOpaque: true, areas: [] })
    ).toBe(false);
  });

  it("normalizes areas from arrays or object maps, skipping unsafe keys and invalid rects", () => {
    const mapWithUnsafe = Object.assign(Object.create(null), {
      a1: { op: "reveal", x: 0, y: 0, w: 100, h: 100, createdAt: 10 },
      a2: null,
      invalidZero: { op: "reveal", x: 200, y: 200, w: 0, h: 50 },
      invalidNeg: { op: "reveal", x: 200, y: 200, w: 50, h: -10 },
      invalidNaN: { op: "reveal", x: Number.NaN, y: 0, w: 50, h: 50 }
    });
    Object.defineProperty(mapWithUnsafe, "__proto__", {
      value: { op: "reveal", x: 300, y: 300, w: 50, h: 50 },
      enumerable: true
    });

    const fog = { enabled: true, areas: mapWithUnsafe };
    expect(isPointRevealed(50, 50, fog)).toBe(true);
    expect(isPointRevealed(210, 210, fog)).toBe(false);
    expect(isPointRevealed(310, 310, fog)).toBe(false);

    expect(
      isPointRevealed(50, 50, { enabled: true, areas: [null, "bad"] })
    ).toBe(false);
    expect(isPointRevealed(50, 50, { enabled: true, areas: "bad" })).toBe(false);
  });

  it("sorts chronologically by createdAt, applies inclusive boundaries, and handles reveal/hide/unknown ops", () => {
    const fog = {
      enabled: true,
      areas: {
        second: { op: "hide", x: 20, y: 20, w: 40, h: 40, createdAt: 200 },
        first: { op: "reveal", x: 0, y: 0, w: 100, h: 100, createdAt: 100 },
        noop: { op: "noop", x: 0, y: 0, w: 100, h: 100, createdAt: 300 },
        reReveal: { op: "reveal", x: 30, y: 30, w: 10, h: 10, createdAt: 400 },
        noTs: { op: "hide", x: 90, y: 90, w: 10, h: 10 }
      }
    };

    // Inclusive boundary on reveal rect [0, 100] x [0, 100]
    expect(isPointRevealed(0, 0, fog)).toBe(true);
    expect(isPointRevealed(100, 80, fog)).toBe(true);
    expect(isPointRevealed(-0.01, 0, fog)).toBe(false);
    expect(isPointRevealed(100.01, 80, fog)).toBe(false);
    expect(isPointRevealed(50, -0.01, fog)).toBe(false);
    expect(isPointRevealed(50, 100.01, fog)).toBe(false);

    // Hidden by `second` at t=200 (noop at t=300 does not toggle)
    expect(isPointRevealed(25, 25, fog)).toBe(false);
    // Re-revealed by `reReveal` at t=400
    expect(isPointRevealed(35, 35, fog)).toBe(true);
    // `noTs` defaults createdAt to 0 (runs before t=100 reveal)
    expect(isPointRevealed(95, 95, fog)).toBe(true);
  });
});

describe("fog/partitionTokensByFog", () => {
  const revealedFog = {
    enabled: true,
    areas: [{ op: "reveal", x: 0, y: 0, w: 128, h: 128, createdAt: 1 }]
  };

  it("handles empty, null, array, and object-map token collections safely", () => {
    expect(partitionTokensByFog()).toEqual({ publicTokens: [], hiddenTokens: [] });
    expect(partitionTokensByFog(null)).toEqual({ publicTokens: [], hiddenTokens: [] });
    expect(partitionTokensByFog({ tokens: null })).toEqual({
      publicTokens: [],
      hiddenTokens: []
    });
    expect(partitionTokensByFog({ tokens: [null, "bad"], fogState: revealedFog })).toEqual({
      publicTokens: [],
      hiddenTokens: []
    });

    const tok1 = { id: "t1", kind: TOKEN_KINDS.PC, x: 500, y: 500 };
    const tokenMap = Object.assign(Object.create(null), {
      t1: tok1,
      bad: null
    });
    Object.defineProperty(tokenMap, "__proto__", {
      value: { id: "proto", kind: TOKEN_KINDS.NPC, x: 0, y: 0 },
      enumerable: true
    });

    const result = partitionTokensByFog({ tokens: tokenMap, fogState: revealedFog });
    expect(result.publicTokens).toEqual([tok1]);
    expect(result.hiddenTokens).toEqual([]);
  });

  it("always places hidden === true tokens into hiddenTokens regardless of kind, controllers, or fog", () => {
    const hiddenPc = { id: "pc", kind: TOKEN_KINDS.PC, hidden: true, x: 32, y: 32 };
    const hiddenControlled = {
      id: "npc",
      kind: TOKEN_KINDS.NPC,
      hidden: true,
      controlledBy: { ALL: true },
      x: 32,
      y: 32
    };

    const resDisabled = partitionTokensByFog({
      tokens: [hiddenPc, hiddenControlled],
      fogState: { enabled: false }
    });
    expect(resDisabled.publicTokens).toEqual([]);
    expect(resDisabled.hiddenTokens).toEqual([hiddenPc, hiddenControlled]);
  });

  it("keeps non-hidden PCs and player-controlled tokens public even under fog, while excluding gmId", () => {
    const pc = { id: "pc", kind: TOKEN_KINDS.PC, x: 500, y: 500 };
    const npcAll = {
      id: "npcAll",
      kind: TOKEN_KINDS.NPC,
      controlledBy: { ALL: true },
      x: 500,
      y: 500
    };
    const npcPlayer = {
      id: "npcPlayer",
      kind: TOKEN_KINDS.NPC,
      controlledBy: { gm1: true, p1: true },
      x: 500,
      y: 500
    };
    const npcGmOnly = {
      id: "npcGmOnly",
      kind: TOKEN_KINDS.NPC,
      controlledBy: { gm1: true },
      x: 500,
      y: 500
    };
    const freeNoCtrl = {
      id: "freeNoCtrl",
      kind: TOKEN_KINDS.FREE,
      controlledBy: {},
      x: 500,
      y: 500
    };

    const withGm = partitionTokensByFog({
      tokens: [pc, npcAll, npcPlayer, npcGmOnly, freeNoCtrl],
      fogState: revealedFog,
      gmId: " gm1 "
    });
    expect(withGm.publicTokens).toEqual([pc, npcAll, npcPlayer]);
    expect(withGm.hiddenTokens).toEqual([npcGmOnly, freeNoCtrl]);

    const withoutGm = partitionTokensByFog({
      tokens: [npcGmOnly],
      fogState: revealedFog
    });
    expect(withoutGm.publicTokens).toEqual([npcGmOnly]);
  });

  it("partitions non-PC un-controlled tokens by token center and fails closed on corrupt coords", () => {
    // 2x2 token at (-32, -32) with cellSizePx=64 has center at (32, 32) -> revealed!
    const largeRevealed = {
      id: "big",
      kind: TOKEN_KINDS.NPC,
      x: -32,
      y: -32,
      sizeInCells: 2
    };
    // 1x1 token at (110, 110) has center at (142, 142) -> outside [0,128]x[0,128] -> hidden!
    const outsideCenter = {
      id: "out",
      kind: TOKEN_KINDS.FREE,
      x: 110,
      y: 110,
      sizeInCells: 1
    };
    // Corrupt/unpositioned token -> getTokenCenter returns null -> hidden!
    const corruptPos = {
      id: "corrupt",
      kind: TOKEN_KINDS.NPC
    };

    const res = partitionTokensByFog({
      tokens: [largeRevealed, outsideCenter, corruptPos],
      fogState: revealedFog,
      cellSizePx: 64
    });
    expect(res.publicTokens).toEqual([largeRevealed]);
    expect(res.hiddenTokens).toEqual([outsideCenter, corruptPos]);

    // Invalid cellSizePx delegates safely to geometry (falls back to 64)
    const fallbackCell = partitionTokensByFog({
      tokens: [outsideCenter],
      fogState: revealedFog,
      cellSizePx: 0
    });
    expect(fallbackCell.hiddenTokens).toEqual([outsideCenter]);
  });

  it("keeps all non-hidden tokens public when fog is disabled", () => {
    const npc = { id: "n1", kind: TOKEN_KINDS.NPC };
    const res = partitionTokensByFog({
      tokens: [npc],
      fogState: null
    });
    expect(res.publicTokens).toEqual([npc]);
    expect(res.hiddenTokens).toEqual([]);
  });
});
