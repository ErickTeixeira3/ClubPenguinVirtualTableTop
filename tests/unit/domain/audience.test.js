import { describe, expect, it } from "vitest";
import { assertAudience, computeAudience } from "../../../src/domain/audience.js";
import { AppError, ERROR_CODES } from "../../../src/domain/errors.js";

describe("domain/audience", () => {
  describe("computeAudience", () => {
    it("handles message visibility modes (public, gm_only, self) and deduplicates", () => {
      expect(
        computeAudience({ visibility: "public", senderUid: "p1", gmId: "gm1" })
      ).toEqual({
        visibleTo: ["ALL"],
        editableBy: []
      });

      expect(
        computeAudience({ visibility: "gm_only", senderUid: "p1", gmId: "gm1" })
      ).toEqual({
        visibleTo: ["gm1", "p1"],
        editableBy: []
      });

      expect(
        computeAudience({
          visibility: "gm_only",
          senderUid: "gm1",
          gmId: "gm1"
        })
      ).toEqual({
        visibleTo: ["gm1"],
        editableBy: []
      });

      expect(
        computeAudience({ visibility: "self", senderUid: "p1" })
      ).toEqual({
        visibleTo: ["p1"],
        editableBy: []
      });
    });

    it("enforces scope invariants for gm, party, and player", () => {
      expect(
        computeAudience({
          scope: "gm",
          ownerId: "gm_old",
          gmId: "gm_new",
          visibleTo: ["ALL", "p1"],
          editableBy: ["ALL", "p1"]
        })
      ).toEqual({
        visibleTo: [],
        editableBy: []
      });

      expect(
        computeAudience({
          scope: "gm",
          ownerId: "gm_only"
        })
      ).toEqual({
        visibleTo: [],
        editableBy: []
      });

      expect(
        computeAudience({
          scope: "party",
          ownerId: "p1",
          visibleTo: ["p2"],
          editableBy: ["p1"]
        })
      ).toEqual({
        visibleTo: ["ALL", "p1", "p2"],
        editableBy: ["ALL", "p1"]
      });

      expect(
        computeAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["ALL", "p2"],
          editableBy: ["ALL", "p3"]
        })
      ).toEqual({
        visibleTo: ["p1", "ALL", "p2"],
        editableBy: ["p1", "p3"]
      });

      expect(
        computeAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: [],
          editableBy: ["ALL"]
        })
      ).toEqual({
        visibleTo: ["p1"],
        editableBy: ["p1"]
      });

      expect(
        computeAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["p2"],
          editableBy: ["p2"]
        })
      ).toEqual({
        visibleTo: ["p1", "p2"],
        editableBy: ["p1", "p2"]
      });
    });

    it("fails closed on unrecognized visibility or scope in computeAudience", () => {
      for (const badVis of ["gmOnly", "", "unknown", 123]) {
        expect(() =>
          computeAudience({ visibility: badVis, senderUid: "p1", gmId: "gm1" })
        ).toThrow(AppError);
        try {
          computeAudience({ visibility: badVis, senderUid: "p1", gmId: "gm1" });
        } catch (err) {
          expect(err.code).toBe(ERROR_CODES.INVALID_AUDIENCE);
        }
      }

      for (const badScope of ["bogus", "", 42]) {
        expect(() =>
          computeAudience({ scope: badScope, ownerId: "p1" })
        ).toThrow(AppError);
        try {
          computeAudience({ scope: badScope, ownerId: "p1" });
        } catch (err) {
          expect(err.code).toBe(ERROR_CODES.INVALID_AUDIENCE);
        }
      }
    });

    it("computes audience for owner-based, media, and ownerless entities while sanitizing entries", () => {
      expect(
        computeAudience({
          ownerId: " p1 ",
          gmId: "gm1",
          visibleTo: ["", null, "  ", "p2", "p1", 42],
          editableBy: "not-an-array"
        })
      ).toEqual({
        visibleTo: ["p1", "p2"],
        editableBy: ["p1"]
      });

      expect(
        computeAudience({
          uploadedBy: "p1",
          visibleTo: ["p2"]
        })
      ).toEqual({
        visibleTo: ["p1", "p2"],
        editableBy: []
      });

      expect(
        computeAudience({
          uploadedBy: "p1",
          visibleTo: ["ALL", "p2"]
        })
      ).toEqual({
        visibleTo: ["ALL", "p2"],
        editableBy: []
      });

      expect(computeAudience({ visibleTo: ["ALL"] })).toEqual({
        visibleTo: ["ALL"],
        editableBy: []
      });
      expect(computeAudience()).toEqual({
        visibleTo: [],
        editableBy: []
      });
    });
  });

  describe("assertAudience", () => {
    it("rejects non-object entities and malformed string arrays", () => {
      expect(assertAudience(null).ok).toBe(false);
      expect(assertAudience([]).ok).toBe(false);
      expect(
        assertAudience({ visibleTo: "ALL" }, { entityType: "scene" }).errors[0]
          .code
      ).toBe(ERROR_CODES.INVALID_AUDIENCE);
      expect(
        assertAudience(
          { visibleTo: ["p1", "  ", 123] },
          { entityType: "scene" }
        ).errors
      ).toHaveLength(2);
    });

    it("validates messages (public and gm_only)", () => {
      expect(
        assertAudience({ visibility: "public", visibleTo: ["ALL"] }).ok
      ).toBe(true);
      expect(
        assertAudience({ visibility: "public", visibleTo: ["p1"] }).ok
      ).toBe(false);

      expect(
        assertAudience({
          visibility: "gm_only",
          visibleTo: ["gm1", "p1"],
          sender: { uid: "p1" }
        }).ok
      ).toBe(true);
      expect(
        assertAudience({
          visibility: "gm_only",
          visibleTo: ["ALL", "p1"],
          sender: { uid: "p1" }
        }).ok
      ).toBe(false);
      expect(
        assertAudience(
          { visibility: "gm_only", visibleTo: ["gm1"] },
          { senderUid: "p1" }
        ).ok
      ).toBe(false);
      expect(
        assertAudience({ visibility: "unknown", visibleTo: ["ALL"] }).ok
      ).toBe(false);
    });

    it("validates media, scenes, and compendium entries", () => {
      expect(
        assertAudience({ uploadedBy: "p1", visibleTo: ["p1"] }).ok
      ).toBe(true);
      expect(
        assertAudience({ uploadedBy: " ", visibleTo: [] }, { entityType: "media" })
          .errors.length
      ).toBeGreaterThanOrEqual(2);

      expect(
        assertAudience({ visibleTo: [] }, { entityType: "scene" }).ok
      ).toBe(true);
      expect(
        assertAudience({ visibleTo: ["ALL"] }, { entityType: "compendiumEntry" })
          .ok
      ).toBe(true);
    });

    it("validates scoped notes and journal folders including GM transfer", () => {
      expect(
        assertAudience({
          scope: "gm",
          ownerId: "gm_old",
          visibleTo: ["gm_new"],
          editableBy: []
        }).ok
      ).toBe(true);
      expect(
        assertAudience({
          scope: "gm",
          ownerId: "gm1",
          visibleTo: ["ALL"],
          editableBy: ["ALL"]
        }).errors
      ).toHaveLength(2);

      expect(
        assertAudience({
          scope: "party",
          ownerId: "p1",
          visibleTo: ["ALL", "p1"],
          editableBy: ["ALL", "p1"]
        }).ok
      ).toBe(true);
      expect(
        assertAudience({
          scope: "party",
          ownerId: "p1",
          visibleTo: ["p1"],
          editableBy: ["p1"]
        }).errors
      ).toHaveLength(2);

      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["ALL", "p1"],
          editableBy: ["p1"]
        }).ok
      ).toBe(true);
      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["ALL", "p1"],
          editableBy: ["ALL", "p1"]
        }).ok
      ).toBe(false);

      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["p1"],
          editableBy: ["p1", "ALL"]
        }).ok
      ).toBe(false);

      expect(
        assertAudience({
          scope: "player",
          ownerId: " p1 ",
          visibleTo: ["p1"],
          editableBy: ["p1"]
        }).ok
      ).toBe(false);

      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["p2"],
          editableBy: ["p2"]
        }).errors
      ).toHaveLength(2);

      expect(
        assertAudience(
          {
            domain: "journal",
            scope: "invalid",
            ownerId: "",
            visibleTo: [],
            editableBy: []
          },
          { entityType: "folder" }
        ).ok
      ).toBe(false);
    });

    it("validates owner-based characters, character folders, and generic fallback", () => {
      expect(
        assertAudience({
          ownerId: "p1",
          visibleTo: ["p1"],
          editableBy: ["p1"]
        }).ok
      ).toBe(true);
      expect(
        assertAudience(
          {
            ownerId: "",
            visibleTo: [],
            editableBy: []
          },
          { entityType: "character" }
        ).ok
      ).toBe(false);
      expect(
        assertAudience(
          {
            ownerId: "p1",
            visibleTo: ["p2"],
            editableBy: ["p2"]
          },
          { entityType: "folder" }
        ).errors
      ).toHaveLength(2);

      expect(
        assertAudience(
          {
            ownerId: " p1 ",
            visibleTo: ["p1"],
            editableBy: ["p1"]
          },
          { entityType: "character" }
        ).ok
      ).toBe(false);

      expect(
        assertAudience(
          {
            ownerId: "p1",
            visibleTo: "not-array",
            editableBy: "not-array"
          },
          { entityType: "character" }
        ).errors
      ).toHaveLength(4);

      expect(assertAudience({ visibleTo: ["ALL"] }).ok).toBe(true);
      expect(assertAudience({ visibleTo: ["ALL"] }, null).ok).toBe(true);
    });

    it("covers defensive branches for mixed entity fields and non-array lists", () => {
      // uploadedBy + ownerId falls through to character detection
      expect(
        assertAudience({
          uploadedBy: "u1",
          ownerId: "u1",
          visibleTo: ["u1"],
          editableBy: ["u1"]
        }).ok
      ).toBe(true);

      // scope: null is treated as non-scoped (falls through to owner/character)
      expect(
        assertAudience({
          scope: null,
          ownerId: "p1",
          visibleTo: ["p1"],
          editableBy: ["p1"]
        }).ok
      ).toBe(true);

      // message with non-array visibleTo and gm_only without sender
      expect(
        assertAudience({ visibility: "public", visibleTo: "ALL" }).errors
      ).toHaveLength(2);
      expect(
        assertAudience({ visibility: "gm_only", visibleTo: ["gm1"] }).ok
      ).toBe(true);

      // scoped entity with non-array visibleTo/editableBy
      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: null,
          editableBy: null
        }).errors
      ).toHaveLength(4);

      // untrimmed entries in visibleTo / editableBy must be rejected by assertAudience
      expect(
        assertAudience({
          scope: "player",
          ownerId: "p1",
          visibleTo: ["p1", " p2 "],
          editableBy: ["p1"]
        }).ok
      ).toBe(false);
      expect(
        assertAudience(
          { visibleTo: [" p1 "] },
          { entityType: "scene" }
        ).ok
      ).toBe(false);

      // undefined/null visibility must NOT be misclassified as message
      const undefVisResult = assertAudience({
        visibility: undefined,
        scope: "gm",
        ownerId: "gm1",
        visibleTo: ["ALL"],
        editableBy: ["ALL"]
      });
      expect(undefVisResult.ok).toBe(false);
      expect(undefVisResult.errors.map((e) => e.details.field)).toEqual([
        "visibleTo",
        "editableBy"
      ]);
      expect(
        assertAudience({
          visibility: null,
          scope: "player",
          ownerId: "p1",
          visibleTo: ["p1"],
          editableBy: ["p1"]
        }).ok
      ).toBe(true);

      // media with explicit ownerId: null routes to media, not character
      expect(
        assertAudience({
          uploadedBy: "u1",
          ownerId: null,
          visibleTo: ["u1"]
        }).ok
      ).toBe(true);

      // ownerId: null without uploadedBy/visibility still routes to character and fails owner check
      const nullOwnerRes = assertAudience({
        ownerId: null,
        visibleTo: [],
        editableBy: []
      });
      expect(nullOwnerRes.ok).toBe(false);
      expect(nullOwnerRes.errors[0].details.field).toBe("ownerId");
    });

    it("supports throwOnError option", () => {
      expect(
        assertAudience(
          { visibleTo: ["ALL"] },
          { entityType: "scene", throwOnError: true }
        ).ok
      ).toBe(true);

      expect(() =>
        assertAudience(
          { visibility: "public", visibleTo: [] },
          { throwOnError: true }
        )
      ).toThrow(AppError);

      try {
        assertAudience(
          { visibility: "public", visibleTo: [] },
          { throwOnError: true }
        );
      } catch (err) {
        expect(err.code).toBe(ERROR_CODES.INVALID_AUDIENCE);
        expect(err.details.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
