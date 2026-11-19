import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import * as modelsBarrel from "../../../../src/domain/models/index.js";
import {
  fromDrawingDoc,
  normalizeDrawing,
  toDrawingDoc,
  validateDrawing
} from "../../../../src/domain/models/drawing.js";
import {
  fromFogDoc,
  getOrderedFogAreas,
  normalizeFog,
  normalizeFogArea,
  toFogDoc,
  validateFog,
  validateFogArea
} from "../../../../src/domain/models/fog.js";
import {
  fromPingDoc,
  isPingExpired,
  normalizePing,
  toPingDoc,
  validatePing
} from "../../../../src/domain/models/ping.js";
import {
  fromPresenceDoc,
  normalizePresence,
  toPresenceDoc,
  validatePresence
} from "../../../../src/domain/models/presence.js";
import {
  buildPcProjectionFromCharacter,
  combineToken,
  fromTokenDoc,
  fromTokenSecretDoc,
  normalizeToken,
  normalizeTokenSecret,
  projectPublicBars,
  resolveCharacterTokenImage,
  splitTokenDoc,
  toTokenDoc,
  toTokenSecretDoc,
  validateToken,
  validateTokenSecret
} from "../../../../src/domain/models/token.js";

describe("domain/models/token", () => {
  it("converts v1 RTDB token docs, splits/combines public & secret payloads, and handles RTDB null omission", () => {
    const legacy = {
      campaignId: "camp_1",
      sceneId: "scene_1",
      name: "Pinguim",
      characterId: "char_1",
      characterType: "pc",
      ownerId: "u_1",
      controlledBy: ["u_1", "u_2"],
      visibleToPlayers: true,
      mediaId: "med_tok",
      defense: 14,
      hpCurrent: 20,
      hpMax: 25,
      mpCurrent: 10,
      mpMax: 15,
      showBarsToPlayers: true
    };

    const { publicDoc, secretDoc } = splitTokenDoc(legacy, "tok_1");
    expect(publicDoc.kind).toBe("pc");
    expect(publicDoc).not.toHaveProperty("campaignId");
    expect(publicDoc).not.toHaveProperty("sceneId");
    expect(publicDoc).not.toHaveProperty("defense");
    expect(publicDoc.controlledBy).toEqual({ u_1: true, u_2: true });
    expect(publicDoc.bars).toEqual({
      hpCurrent: 20,
      hpMax: 25,
      mpCurrent: 10,
      mpMax: 15
    });
    expect(secretDoc).toEqual({
      defense: 14,
      hp: { current: 20, max: 25 },
      mp: { current: 10, max: 15 },
      showBarsToPlayers: true,
      recentOps: {}
    });
    expect(validateToken(publicDoc)).toEqual({ ok: true, errors: [] });
    expect(validateTokenSecret(secretDoc)).toEqual({ ok: true, errors: [] });

    const combined = combineToken(publicDoc, secretDoc);
    expect(combined.secrets).toEqual(secretDoc);
    expect(combineToken(publicDoc, null).secrets).toBeNull();

    // RTDB strips null label and empty controlledBy on write
    const rtdbReadBack = fromTokenDoc(
      { id: "tok_free", kind: "free", ownerId: "gm_1", rev: 1 },
      "tok_free"
    );
    expect(rtdbReadBack.label).toBeNull();
    expect(rtdbReadBack.controlledBy).toEqual({});
    expect(rtdbReadBack.bars).toBeNull();
    expect(validateToken(rtdbReadBack).ok).toBe(true);
    expect(toTokenDoc(rtdbReadBack).id).toBe("tok_free");

    expect(projectPublicBars({ showBarsToPlayers: false, hp: { current: 1, max: 1 } })).toBeNull();
    expect(projectPublicBars({ showBarsToPlayers: true })).toBeNull();
  });

  it("validates kind/characterId rules, sizeInCells, recentOps limit, and legacy fields", () => {
    expect(validateToken(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(validateTokenSecret(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const badPc = {
      ...normalizeToken({
        id: "t1",
        kind: "pc",
        characterId: null,
        ownerId: "u1",
        sizeInCells: 10,
        rev: -1
      }),
      campaignId: "camp_1"
    };
    const res = validateToken(badPc);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.VALIDATION_FAILED);

    const badFree = normalizeToken({
      id: "t2",
      kind: "free",
      characterId: "char_1",
      ownerId: "u1"
    });
    expect(validateToken(badFree).errors.map((e) => e.code)).toContain(
      ERROR_CODES.VALIDATION_FAILED
    );

    const badSecret = fromTokenSecretDoc({
      defense: -5,
      hp: { current: -1, max: 10 },
      recentOps: Object.fromEntries(
        Array.from({ length: 51 }, (_, i) => [`op_${i}`, i])
      )
    });
    const secRes = validateTokenSecret(badSecret);
    expect(secRes.ok).toBe(false);
    expect(secRes.errors.map((e) => e.code)).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(toTokenSecretDoc(badSecret).defense).toBe(-5);
    expect(normalizeTokenSecret(null).defense).toBe(10);

    const npcWithBadFields = validateToken({
      id: "t3",
      kind: "npc",
      characterId: "  ",
      ownerId: "",
      controlledBy: "bad",
      layer: "bad_layer",
      hidden: "no",
      label: "  ",
      image: { mediaId: null, url: null },
      x: "bad",
      y: Number.NaN,
      rotation: Infinity,
      sizeInCells: 0,
      ringColor: "",
      showName: "no",
      bars: "bad",
      rev: 0,
      updatedAt: -5,
      updatedBy: "  "
    });
    expect(npcWithBadFields.ok).toBe(false);

    const badBarsAndCtrl = validateToken({
      ...normalizeToken({
        id: "t4",
        kind: "npc",
        characterId: "char_2",
        ownerId: "gm1",
        bars: { hpCurrent: -1, hpMax: "bad", mpCurrent: 0, mpMax: 0 }
      }),
      controlledBy: JSON.parse('{"__proto__":true,"u1":false,"  ":true}')
    });
    expect(badBarsAndCtrl.ok).toBe(false);

    const badSecretShape = validateTokenSecret({
      defense: "bad",
      hp: "bad",
      mp: { current: -1, max: "bad" },
      showBarsToPlayers: "no",
      recentOps: "bad"
    });
    expect(badSecretShape.ok).toBe(false);

    const badSecretOps = validateTokenSecret({
      defense: 10,
      hp: null,
      mp: null,
      showBarsToPlayers: true,
      recentOps: JSON.parse('{"__proto__":1,"  ":1,"op_bad":-1}')
    });
    expect(badSecretOps.ok).toBe(false);

    const npcLegacy = splitTokenDoc(
      {
        characterId: "char_npc",
        characterType: "npc",
        ownerId: "gm1",
        name: "   ",
        visibleToPlayers: false,
        hpCurrent: 12,
        mpMax: 8,
        showBarsToPlayers: true,
        updatedAt: "100",
        updatedBy: " gm1 "
      },
      "tok_npc"
    );
    expect(npcLegacy.publicDoc.kind).toBe("npc");
    expect(npcLegacy.publicDoc.hidden).toBe(true);
    expect(npcLegacy.publicDoc.label).toBeNull();
    expect(npcLegacy.secretDoc.hp).toEqual({ current: 12, max: 12 });
    expect(npcLegacy.secretDoc.mp).toEqual({ current: 8, max: 8 });
    expect(fromTokenDoc(null).kind).toBe("free");
    expect(
      normalizeToken({ ringColor: 123, label: 42, bars: { hpCurrent: null } }).ringColor
    ).toBe("");
    expect(
      fromTokenSecretDoc({ hpCurrent: null, hpMax: null, mpCurrent: null, mpMax: null }).hp
    ).toBeNull();

    // resolveCharacterTokenImage & buildPcProjectionFromCharacter edge branches
    expect(resolveCharacterTokenImage(null)).toEqual({ mediaId: null, url: null });
    expect(
      resolveCharacterTokenImage({
        tokenImage: { mediaId: "med_tok", url: null },
        avatar: { mediaId: "med_av", url: null }
      })
    ).toEqual({ mediaId: "med_tok", url: null });
    expect(
      resolveCharacterTokenImage({
        token: { image: { mediaId: "med_nested", url: null } },
        tokenImage: { mediaId: "med_tok", url: null },
        avatar: { mediaId: null, url: "https://example.com/a.png" }
      })
    ).toEqual({ mediaId: "med_nested", url: null });
    expect(
      resolveCharacterTokenImage({
        tokenImage: { mediaId: null, url: null },
        avatar: { mediaId: null, url: "https://example.com/a.png" }
      })
    ).toEqual({ mediaId: null, url: "https://example.com/a.png" });

    expect(buildPcProjectionFromCharacter(null)).toBeNull();
    expect(
      buildPcProjectionFromCharacter({
        name: "  ",
        rev: -3,
        resources: { hp: { current: 10, max: 20 } },
        avatar: { mediaId: null, url: null }
      })
    ).toEqual({
      label: "Token",
      image: { mediaId: null, url: null },
      bars: { hpCurrent: 10, hpMax: 20, mpCurrent: null, mpMax: null },
      ringColor: "#3090f0",
      showName: true,
      sizeInCells: 1,
      rev: 0
    });
    expect(
      buildPcProjectionFromCharacter({
        name: "Gigante",
        cardColor: "#ef4444",
        token: { sizeInCells: 12, showName: false },
        rev: 2
      })
    ).toMatchObject({
      ringColor: "#ef4444",
      showName: false,
      sizeInCells: 8
    });
    expect(
      buildPcProjectionFromCharacter({
        name: "Mago",
        rev: 4,
        resources: { mp: { current: 5, max: 10 } }
      }).bars
    ).toEqual({ hpCurrent: null, hpMax: null, mpCurrent: 5, mpMax: 10 });
    expect(
      buildPcProjectionFromCharacter({
        name: "SemPools",
        rev: 2,
        resources: {}
      }).bars
    ).toBeNull();
    expect(projectPublicBars(null)).toBeNull();
    expect(
      projectPublicBars({ showBarsToPlayers: true, mp: { current: 3, max: 6 } })
    ).toEqual({ hpCurrent: null, hpMax: null, mpCurrent: 3, mpMax: 6 });
    expect(
      splitTokenDoc({ id: "t_split", kind: "free", ownerId: "gm1", hp: { current: 5, max: 5 }, showBarsToPlayers: true }).publicDoc.bars
    ).toEqual({ hpCurrent: 5, hpMax: 5, mpCurrent: null, mpMax: null });
  });
});

describe("domain/models/drawing", () => {
  it("normalizes and validates stroke, rect, circle, and text drawings without cross-variant leakage", () => {
    const stroke = fromDrawingDoc(
      {
        campaignId: "c1",
        sceneId: "s1",
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        createdBy: "u1",
        timestamp: 500
      },
      "drw_1"
    );
    expect(stroke.type).toBe("stroke");
    expect(validateDrawing(stroke)).toEqual({ ok: true, errors: [] });
    const strokeDoc = toDrawingDoc(stroke);
    expect(strokeDoc).not.toHaveProperty("campaignId");
    expect(strokeDoc).not.toHaveProperty("w");

    const rect = fromDrawingDoc(
      {
        shapeType: "rect",
        color: "#fff",
        width: 2,
        hasFill: true,
        fillColor: "#000",
        x: 10,
        y: 20,
        w: 30,
        h: 40,
        authorId: "u1"
      },
      "shp_1"
    );
    expect(rect.type).toBe("rect");
    expect(validateDrawing(rect).ok).toBe(true);
    expect(toDrawingDoc(rect)).not.toHaveProperty("points");

    const text = fromDrawingDoc(
      {
        text: "Atenção!",
        x: 5,
        y: 5,
        authorId: "u1"
      },
      "txt_1"
    );
    expect(text.type).toBe("text");
    expect(validateDrawing(text).ok).toBe(true);

    expect(validateDrawing(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateDrawing({
        ...normalizeDrawing({ id: "", type: "stroke", points: [], width: 0 }),
        campaignId: "c1"
      }).ok
    ).toBe(false);
    expect(
      validateDrawing(
        normalizeDrawing({
          id: "t1",
          type: "text",
          authorId: "u1",
          text: "   ",
          fontSize: 0
        })
      ).ok
    ).toBe(false);

    const circleBad = validateDrawing({
      ...normalizeDrawing({
        id: "c1",
        type: "circle",
        layer: "bad_layer",
        authorId: "u1",
        authorName: 123,
        createdAt: -1,
        updatedAt: "bad",
        updatedBy: "  ",
        strokeColor: "",
        strokeWidth: 0,
        hasFill: true,
        fillColor: "",
        x: "bad",
        y: Number.NaN,
        rotation: Infinity,
        w: -1,
        h: -2
      }),
      hasFill: "no"
    });
    expect(circleBad.ok).toBe(false);

    expect(
      validateDrawing({
        ...normalizeDrawing({
          id: "c2",
          type: "rect",
          authorId: "u1",
          hasFill: false,
          fillColor: null
        }),
        fillColor: "  "
      }).ok
    ).toBe(false);

    expect(
      validateDrawing({
        ...normalizeDrawing({
          id: "s2",
          type: "stroke",
          authorId: "u1",
          points: [null]
        }),
        color: ""
      }).ok
    ).toBe(false);

    expect(
      validateDrawing({
        ...normalizeDrawing({
          id: "t2",
          type: "text",
          authorId: "u1",
          text: "Oi",
          fontFamily: "",
          color: "",
          x: "bad",
          y: "bad",
          rotation: "bad"
        })
      }).ok
    ).toBe(false);

    expect(fromDrawingDoc(null).type).toBe("stroke");
    expect(
      normalizeDrawing({
        id: "u1",
        type: "unknown",
        color: 1,
        authorName: " A ",
        updatedBy: 99,
        createdAt: "10"
      }).createdAt
    ).toBe(10);
    expect(
      normalizeDrawing({
        type: "text",
        text: 123,
        fontFamily: 123,
        color: 123
      }).text
    ).toBe("");
    expect(
      normalizeDrawing({
        type: "rect",
        strokeColor: 1,
        fillColor: 1
      }).strokeColor
    ).toBe("");
  });
});

describe("domain/models/ping", () => {
  it("handles standard ping vs snowball, expiration helper, and strips expiresAt", () => {
    const ping = fromPingDoc(
      {
        campaignId: "c1",
        sceneId: "s1",
        senderId: "u1",
        x: 100,
        y: 200,
        timestamp: 1000,
        expiresAt: 3200
      },
      "ping_1"
    );
    expect(ping.kind).toBe("ping");
    expect(ping.from).toBeNull();
    expect(validatePing(ping)).toEqual({ ok: true, errors: [] });
    expect(toPingDoc(ping)).not.toHaveProperty("expiresAt");
    expect(toPingDoc(ping)).not.toHaveProperty("from");
    expect(isPingExpired(ping, 3201)).toBe(true);
    expect(isPingExpired(ping, 3200)).toBe(false);
    expect(isPingExpired(null, 3200)).toBe(false);

    const snowball = fromPingDoc(
      {
        authorId: "u1",
        x: 300,
        y: 400,
        startX: 10,
        startY: 20
      },
      "ping_2"
    );
    expect(snowball.kind).toBe("snowball");
    expect(snowball.from).toEqual({ x: 10, y: 20 });
    expect(validatePing(snowball).ok).toBe(true);
    expect(toPingDoc(snowball).from).toEqual({ x: 10, y: 20 });

    expect(validatePing(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validatePing({
        ...normalizePing({ id: "", authorId: "", kind: "ping", from: { x: 1, y: 1 } }),
        expiresAt: 100
      }).ok
    ).toBe(false);
    expect(
      validatePing(
        normalizePing({
          id: "p3",
          authorId: "u1",
          kind: "snowball",
          x: "bad",
          y: "bad",
          from: null,
          color: 123,
          createdAt: -1
        })
      ).ok
    ).toBe(false);
    expect(
      validatePing(normalizePing({ id: "p4", authorId: "u1", kind: "invalid" })).ok
    ).toBe(false);
    expect(fromPingDoc(null).kind).toBe("ping");
    expect(normalizePing({ createdAt: "50", x: " " }).createdAt).toBe(50);
  });
});

describe("domain/models/fog & presence", () => {
  it("converts fog array/map areas, sorts deterministically, and strips drawings/pings", () => {
    const fog = fromFogDoc({
      campaignId: "c1",
      sceneId: "s1",
      enabled: true,
      drawings: {},
      pings: {},
      areas: [
        { id: "area_2", op: "hide", x: 0, y: 0, w: 50, h: 50, createdAt: 200 },
        { id: "area_1", op: "reveal", x: 0, y: 0, w: 100, h: 100, createdAt: 100 }
      ],
      updatedAt: 500
    });
    expect(Object.keys(fog.areas)).toEqual(["area_2", "area_1"]);
    expect(getOrderedFogAreas(fog).map((a) => a.id)).toEqual(["area_1", "area_2"]);
    expect(validateFog(fog)).toEqual({ ok: true, errors: [] });
    const fogDoc = toFogDoc(fog);
    expect(fogDoc).not.toHaveProperty("drawings");
    expect(fogDoc).not.toHaveProperty("pings");

    expect(validateFog(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(validateFogArea(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateFog({
        ...normalizeFog({
          areas: { a1: normalizeFogArea({ id: "wrong", w: 0, h: -1 }) },
          updatedAt: -1
        }),
        drawings: {}
      }).ok
    ).toBe(false);
    expect(getOrderedFogAreas(null)).toEqual([]);
    expect(
      validateFog({
        enabled: "no",
        areas: "bad",
        updatedAt: -1
      }).ok
    ).toBe(false);
    expect(
      validateFog({
        enabled: true,
        areas: JSON.parse('{"__proto__":{},"a1":{"id":"a1","op":"bad","x":"bad","y":"bad","w":0,"h":0,"createdAt":-1,"campaignId":"c1"}}'),
        updatedAt: null
      }).ok
    ).toBe(false);
    expect(
      normalizeFog({
        areas: [null, { id: " ", op: "reveal" }, { id: "a2", op: "reveal", createdAt: "10" }],
        updatedAt: "20"
      }).updatedAt
    ).toBe(20);
    expect(
      normalizeFog({
        areas: JSON.parse('{"__proto__":{}," ":{"id":"x"},"ok":{"op":"hide","w":"10","h":"20"}}')
      }).areas.ok.id
    ).toBe("ok");
  });

  it("normalizes and validates presence main vs sheet and strips profile fields", () => {
    const main = fromPresenceDoc({
      uid: "u1",
      displayName: "Pingu",
      online: true,
      updatedAt: 1000
    });
    expect(main).toEqual({ kind: "main", sheetId: null, connectedAt: 1000 });
    expect(validatePresence(main)).toEqual({ ok: true, errors: [] });
    expect(toPresenceDoc(main)).toEqual({ kind: "main", sheetId: null, connectedAt: 1000 });

    const sheet = normalizePresence({ kind: "sheet", sheetId: "char_1", connectedAt: 2000 });
    expect(validatePresence(sheet).ok).toBe(true);

    expect(validatePresence(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validatePresence({
        ...normalizePresence({ kind: "sheet", sheetId: null, connectedAt: -1 }),
        uid: "u1"
      }).ok
    ).toBe(false);
    expect(
      validatePresence(normalizePresence({ kind: "main", sheetId: "char_1" })).ok
    ).toBe(false);
    expect(
      validatePresence(normalizePresence({ kind: "bad_kind", sheetId: 42, connectedAt: "5" })).ok
    ).toBe(false);
    expect(fromPresenceDoc(null)).toEqual({ kind: "main", sheetId: null, connectedAt: null });
    expect(normalizePresence({ sheetId: "  " }).sheetId).toBeNull();
  });
});

describe("domain/models/index barrel exports", () => {
  it("exports all 21 *Model namespaces and collision-free named helpers", () => {
    const expectedNamespaces = [
      "imageRefModel",
      "campaignModel",
      "memberModel",
      "inviteModel",
      "characterModel",
      "folderModel",
      "noteModel",
      "sceneModel",
      "compendiumEntryModel",
      "messageModel",
      "mediaModel",
      "turnStateModel",
      "chatStateModel",
      "pendingCostModel",
      "tokenModel",
      "drawingModel",
      "pingModel",
      "fogModel",
      "presenceModel",
      "appConfigModel",
      "platformAdminModel"
    ];
    for (const ns of expectedNamespaces) {
      expect(modelsBarrel[ns]).toBeDefined();
      expect(typeof modelsBarrel[ns].toDoc).toBe("function");
      expect(typeof modelsBarrel[ns].fromDoc).toBe("function");
    }
    expect(modelsBarrel.toTokenDoc).toBe(toTokenDoc);
    expect(modelsBarrel.fromTokenDoc).toBe(fromTokenDoc);
    expect(modelsBarrel.toPresenceDoc).toBe(toPresenceDoc);
    expect(modelsBarrel.fromPresenceDoc).toBe(fromPresenceDoc);
  });
});
