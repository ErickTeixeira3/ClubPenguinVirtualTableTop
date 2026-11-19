import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  LEGACY_COMPENDIUM_KEYS,
  fromCompendiumEntryDoc,
  normalizeCompendiumEntry,
  toCompendiumEntryDoc,
  validateCompendiumEntry
} from "../../../../src/domain/models/compendiumEntry.js";
import {
  expandMediaVisibleTo,
  fromMediaDoc,
  hasRequiredMediaAudience,
  normalizeMedia,
  toMediaDoc,
  validateMedia,
  validateMediaAudienceExpansion
} from "../../../../src/domain/models/media.js";
import {
  fromSceneDoc,
  normalizeScene,
  toSceneDoc,
  validateScene
} from "../../../../src/domain/models/scene.js";

describe("domain/models/scene", () => {
  it("converts v1 scene docs, enforces mimeType === null for external URLs, and round-trips", () => {
    const extScene = fromSceneDoc(
      {
        campaignId: "camp_1",
        name: "Taverna",
        visibleToPlayers: true,
        mapImage: {
          externalUrl: "https://cdn.site/map.png",
          mimeType: "image/png",
          widthPx: 2048,
          heightPx: 1024,
          sizeBytes: 99999
        },
        fogOfWar: { enabled: true, defaultOpaque: true },
        ambientAudio: { url: "https://cdn.site/wind.mp3", volume: 0.5, loop: true, playing: false }
      },
      "scene_1"
    );

    expect(extScene.visibleTo).toEqual(["ALL"]);
    expect(extScene.mapImage.image).toEqual({
      mediaId: null,
      url: "https://cdn.site/map.png"
    });
    expect(extScene.mapImage.mimeType).toBeNull();
    expect(extScene.fogDefaults).toEqual({ enabled: true, defaultOpaque: true });
    expect(validateScene(extScene)).toEqual({ ok: true, errors: [] });

    const docOut = toSceneDoc(extScene);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("visibleToPlayers");
    expect(docOut).not.toHaveProperty("fogOfWar");
    expect(docOut.mapImage).not.toHaveProperty("sizeBytes");
    expect(docOut.ambientAudio).toBeDefined();
    expect(fromSceneDoc(docOut, "scene_1")).toEqual(extScene);

    const hiddenScene = fromSceneDoc(
      {
        campaignId: "camp_1",
        visibleTo: ["ALL", "u_1"],
        visibleToPlayers: false
      },
      "scene_2",
      { gmId: "gm_1" }
    );
    expect(hiddenScene.visibleTo).toEqual(["u_1"]);

    const gmFallback = fromSceneDoc(
      { campaignId: "camp_1", visibleTo: ["ALL"], visibleToPlayers: false },
      "scene_3",
      { gmId: "gm_1" }
    );
    expect(gmFallback.visibleTo).toEqual(["gm_1"]);
  });

  it("rejects cellSizePx < 8, external url with non-null mimeType, and legacy keys", () => {
    expect(validateScene(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const bad = {
      ...normalizeScene({
        campaignId: "",
        name: "   ",
        mapImage: {
          image: { mediaId: null, url: "https://cdn.site/a.png" },
          mimeType: "image/png",
          widthPx: 0,
          heightPx: -5
        },
        grid: { cellSizePx: 0, opacity: 2, color: "" },
        ambientAudio: { volume: 2, loop: "yes" }
      }),
      visibleToPlayers: true,
      fogOfWar: {}
    };
    bad.mapImage.sizeBytes = 123;

    const res = validateScene(bad);
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);
    expect(codes).toContain(ERROR_CODES.INVALID_TYPE);

    const mediaScene = fromSceneDoc(
      {
        campaignId: "camp_1",
        name: "Mapa",
        mapImage: { mediaId: "med_1", mimeType: "image/webp" },
        ambientAudio: { mediaId: null, url: null, volume: "0.25", loop: false }
      },
      "scene_m",
      null
    );
    expect(mediaScene.mapImage.mimeType).toBe("image/webp");
    expect(toSceneDoc(mediaScene).mapImage.mimeType).toBe("image/webp");
    expect(fromSceneDoc(null, null, null).name).toBe("Novo Mapa");
    expect(
      normalizeScene(
        {
          name: 123,
          deletedBy: "  ",
          mapImage: { mimeType: 42 },
          grid: {
            enabled: "no",
            snapToGrid: "no",
            cellSizePx: " ",
            offsetX: {},
            color: 123
          },
          fogDefaults: { enabled: "no", defaultOpaque: "no" },
          ambientAudio: { url: " ", mediaId: " med_a " }
        },
        null
      ).ambientAudio.mediaId
    ).toBe("med_a");

    const invalidNested = validateScene({
      campaignId: "c1",
      name: "S",
      visibleTo: ["ALL"],
      mapImage: "bad",
      grid: "bad",
      fogDefaults: "bad",
      ambientAudio: "bad",
      isDeleted: "no"
    });
    expect(invalidNested.ok).toBe(false);

    const invalidGridFields = validateScene({
      campaignId: "c1",
      name: "S",
      visibleTo: ["ALL"],
      mapImage: {
        image: { mediaId: "med_1", url: null },
        mimeType: " ",
        widthPx: 100,
        heightPx: 100,
        mediaId: "legacy",
        externalUrl: "legacy"
      },
      grid: {
        enabled: "no",
        snapToGrid: "no",
        cellSizePx: "bad",
        offsetX: "bad",
        offsetY: "bad",
        color: "",
        opacity: 0.5
      },
      fogDefaults: { enabled: "no", defaultOpaque: "no" },
      ambientAudio: null,
      isDeleted: false
    });
    expect(invalidGridFields.ok).toBe(false);
  });
});

describe("domain/models/compendiumEntry", () => {
  it("converts v1 flat cost/range/aoe/attribute fields and validates v2 invariants", () => {
    const entry = fromCompendiumEntryDoc(
      {
        campaignId: "camp_1",
        type: "spell",
        name: "Raio de Gelo",
        visibleToPlayers: true,
        costResource: "mp",
        costAmount: 3,
        rollFormula: "2d8",
        rangeType: "ranged",
        rangeMeters: 12,
        aoeType: "cone",
        aoeRadiusMeters: 6,
        coneAngleDeg: 45,
        savingThrow: { enabled: true, dcFormula: "0", attribute: "reflexos" },
        attribute: "intelecto"
      },
      "comp_1"
    );

    expect(entry.visibleTo).toEqual(["ALL"]);
    expect(entry.cost).toEqual({ resource: "mp", amount: 3 });
    expect(entry.effectFormula).toBe("2d8");
    expect(entry.range).toEqual({ type: "ranged", distanceMeters: 12 });
    expect(entry.aoe).toEqual({ type: "cone", radiusMeters: 6, coneAngleDeg: 45 });
    expect(entry.savingThrow.attributeKey).toBe("reflexos");
    expect(entry.savingThrow.dcFormula).toBe("0");
    expect(entry.attributeKey).toBe("intelecto");
    expect(validateCompendiumEntry(entry)).toEqual({ ok: true, errors: [] });

    const docOut = toCompendiumEntryDoc(entry);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("visibleToPlayers");
    expect(docOut).not.toHaveProperty("costResource");
    expect(fromCompendiumEntryDoc(docOut, "comp_1")).toEqual(entry);
  });

  it("rejects invalid enums, out-of-range fields, empty enabled dcFormula, and legacy keys", () => {
    expect(validateCompendiumEntry(null).errors[0].code).toBe(
      ERROR_CODES.INVALID_TYPE
    );

    const bad = {
      ...normalizeCompendiumEntry({
        campaignId: "",
        type: "invalid",
        name: "",
        cost: { resource: "stamina", amount: -1 },
        rollKind: "nope",
        trigger: "bad",
        effectType: "bad",
        range: { type: "bad", distanceMeters: -1 },
        aoe: { type: "bad", radiusMeters: -1, coneAngleDeg: 400 },
        savingThrow: { enabled: true, dcFormula: " ", attributeKey: "" }
      }),
      visibleToPlayers: false
    };
    const res = validateCompendiumEntry(bad);
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.INVALID_ENUM_VALUE);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);

    const skillEntry = fromCompendiumEntryDoc(
      {
        campaignId: "camp_1",
        type: "skill",
        name: "Atletismo",
        formula: "1d20+@forca",
        visibleTo: ["ALL", "u_1"],
        visibleToPlayers: false
      },
      "comp_skill",
      { gmId: "gm_1" }
    );
    expect(skillEntry.hitFormula).toBe("1d20+@forca");
    expect(skillEntry.visibleTo).toEqual(["u_1"]);

    const gmOnlyFallback = fromCompendiumEntryDoc(
      { campaignId: "camp_1", visibleTo: ["ALL"], visibleToPlayers: false },
      null,
      { gmId: "gm_1" }
    );
    expect(gmOnlyFallback.visibleTo).toEqual(["gm_1"]);

    const normalizedBadTypes = normalizeCompendiumEntry(
      {
        name: 123,
        icon: 123,
        elementColor: 123,
        attributeKey: 123,
        deletedBy: "  ",
        category: 123,
        hitFormula: 123,
        effectFormula: 123,
        description: 123,
        bonus: " "
      },
      null
    );
    expect(normalizedBadTypes.name).toBe("");
    expect(normalizedBadTypes.deletedBy).toBeNull();
    expect(fromCompendiumEntryDoc(null, null, null).type).toBe("ability");

    const nestedInvalid = validateCompendiumEntry({
      campaignId: "c1",
      type: "ability",
      name: "X",
      icon: "sword",
      elementColor: "#fff",
      attributeKey: "forca",
      visibleTo: ["ALL"],
      cost: "bad",
      rollKind: null,
      trigger: "active",
      effectType: "damage",
      range: "bad",
      aoe: "bad",
      savingThrow: "bad",
      bonus: "bad",
      category: 1,
      hitFormula: 1,
      effectFormula: 1,
      description: 1,
      isDeleted: "no"
    });
    expect(nestedInvalid.ok).toBe(false);

    const badSavingThrowTypes = validateCompendiumEntry({
      ...normalizeCompendiumEntry({ campaignId: "c1", visibleTo: ["ALL"] }),
      savingThrow: {
        attribute: "forca",
        enabled: "no",
        dcFormula: 12,
        attributeKey: "forca",
        effectDescription: 99
      }
    });
    expect(badSavingThrowTypes.ok).toBe(false);

    expect(LEGACY_COMPENDIUM_KEYS).toContain("coneAngleDeg");
    expect(LEGACY_COMPENDIUM_KEYS).toContain("rollFormula");
    for (const legacyKey of LEGACY_COMPENDIUM_KEYS) {
      const withLegacy = {
        ...normalizeCompendiumEntry({ campaignId: "c1", visibleTo: ["ALL"] }),
        [legacyKey]: legacyKey === "coneAngleDeg" ? 60 : "legacy"
      };
      const legacyCheck = validateCompendiumEntry(withLegacy);
      expect(legacyCheck.ok).toBe(false);
      expect(legacyCheck.errors.some((e) => e.code === ERROR_CODES.VALIDATION_FAILED && e.details?.field === legacyKey)).toBe(true);
    }
  });
});

describe("domain/models/media", () => {
  it("normalizes media, enforces trimmed uploadedBy, and validates monotonic visibleTo", () => {
    const media = fromMediaDoc(
      {
        campaignId: "camp_1",
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 256,
        heightPx: 256,
        sizeBytes: 120,
        dataUrl: "data:image/webp;base64,AAAA",
        uploadedBy: " u_1 "
      },
      "media_1"
    );

    expect(media.byteLength).toBe(120);
    expect(media.uploadedBy).toBe("u_1");
    expect(media.visibleTo).toEqual(["u_1"]);
    expect(validateMedia(media)).toEqual({ ok: true, errors: [] });

    const docOut = toMediaDoc(media);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("sizeBytes");
    expect(docOut).not.toHaveProperty("isDeleted");
    expect(fromMediaDoc(docOut, "media_1")).toEqual(media);

    const expanded = expandMediaVisibleTo(media.visibleTo, ["u_2", "u_1"]);
    expect(expanded).toEqual(["u_1", "u_2"]);
    expect(validateMediaAudienceExpansion(media.visibleTo, expanded).ok).toBe(
      true
    );
    expect(validateMediaAudienceExpansion(["u_1", "u_2"], ["u_1"]).ok).toBe(
      false
    );
    expect(validateMediaAudienceExpansion(null, ["u_1"]).ok).toBe(false);
    expect(validateMediaAudienceExpansion(["u_1"], []).ok).toBe(false);
    expect(validateMediaAudienceExpansion(["u_1"], ["u_1", "  "]).ok).toBe(
      false
    );

    expect(hasRequiredMediaAudience(media, ["u_1"])).toBe(true);
    expect(hasRequiredMediaAudience(media, ["u_2"])).toBe(false);
    expect(hasRequiredMediaAudience({ visibleTo: ["ALL"] }, ["u_2"])).toBe(
      true
    );
    expect(hasRequiredMediaAudience(null, ["u_1"])).toBe(false);
  });

  it("closes M1 uploadedBy whitespace caveat and rejects invalid dimensions/dataUrl/legacy keys", () => {
    expect(validateMedia(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const whitespaceUploader = {
      ...normalizeMedia({
        campaignId: "camp_1",
        category: "scene",
        widthPx: 100,
        heightPx: 100,
        byteLength: 10,
        dataUrl: "data:image/webp;base64,AA",
        uploadedBy: "u_1",
        visibleTo: ["u_1"]
      }),
      uploadedBy: " u_1 "
    };
    expect(validateMedia(whitespaceUploader).ok).toBe(false);

    const bad = {
      ...normalizeMedia({
        campaignId: "",
        category: "",
        mimeType: "",
        widthPx: 0,
        heightPx: -1,
        byteLength: 1.5,
        dataUrl: "https://not-data-url.com/a.png",
        uploadedBy: "",
        visibleTo: []
      }),
      isDeleted: false,
      chunks: 2
    };
    const res = validateMedia(bad);
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(codes).toContain(ERROR_CODES.INVALID_TYPE);
    expect(codes).toContain(ERROR_CODES.INVALID_AUDIENCE);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);

    expect(expandMediaVisibleTo(null, null)).toEqual([]);
    expect(hasRequiredMediaAudience({ visibleTo: ["u_1"] }, [])).toBe(true);
    expect(
      normalizeMedia({
        widthPx: " ",
        heightPx: {},
        byteLength: "12",
        dataUrl: 123,
        visibleTo: [123, "  "]
      }).byteLength
    ).toBe(12);
    expect(fromMediaDoc(null, null, null).mimeType).toBe("image/webp");
    expect(
      fromMediaDoc({ dataUrl: "data:image/webp;base64,ABCD" }, "m2").byteLength
    ).toBe(27);
  });
});
