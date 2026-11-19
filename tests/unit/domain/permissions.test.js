import { describe, expect, it } from "vitest";
import {
  canControlToken,
  canDeleteResource,
  canEditDrawing,
  canEditResource,
  canManageResourceAccess,
  canReadResource,
  canSeeSecret,
  canSeeTargetOutcome,
  canUserWriteTokenProjection,
  hasControlledByAccess,
  isReleasedToPlayers,
  isUserResponsibleForSavingThrow,
  normalizeControlledByList,
  toControlledByMap
} from "../../../src/domain/permissions.js";

describe("domain/permissions", () => {
  describe("controlledBy helpers", () => {
    it("normalizes arrays, boolean maps, sparse RTDB objects, and invalid values", () => {
      expect(normalizeControlledByList([" u1 ", "", null, "u1", "u2"])).toEqual([
        "u1",
        "u2"
      ]);
      expect(
        normalizeControlledByList({
          u1: true,
          u2: false,
          "  ": true,
          0: " u3 ",
          1: "   ",
          2: 123
        })
      ).toEqual(["u3", "u1"]);
      expect(normalizeControlledByList(null)).toEqual([]);
      expect(normalizeControlledByList("u1")).toEqual([]);
    });

    it("converts to RTDB map and rejects unsafe prototype/method keys everywhere", () => {
      const unsafeList = [
        "u1",
        "__proto__",
        "constructor",
        "prototype",
        "toString",
        "valueOf",
        "hasOwnProperty",
        "isPrototypeOf",
        "propertyIsEnumerable",
        "toLocaleString",
        "ALL"
      ];
      const map = toControlledByMap(unsafeList);
      expect(map).toEqual({ u1: true, ALL: true });
      expect(String(map)).toBe("[object Object]");
      expect(Object.hasOwn(map, "toString")).toBe(false);

      const jsonObj = JSON.parse(
        '{"__proto__":true,"constructor":true,"prototype":true,"toString":true,"hasOwnProperty":true,"0":"valueOf","1":"u2","u1":true}'
      );
      expect(normalizeControlledByList(jsonObj)).toEqual(["u2", "u1"]);
      expect(normalizeControlledByList(unsafeList)).toEqual(["u1", "ALL"]);

      const protoInherited = Object.create({ ALL: true, u1: true });
      expect(hasControlledByAccess(protoInherited, "u1")).toBe(false);
      expect(hasControlledByAccess(JSON.parse('{"__proto__":true}'), "__proto__")).toBe(false);
      expect(hasControlledByAccess({ toString: true }, "toString")).toBe(false);
    });

    it("checks controlledBy access for map, array, ALL, and rejects empty uid", () => {
      expect(hasControlledByAccess({ ALL: true }, "u1")).toBe(true);
      expect(hasControlledByAccess({ u1: true }, "u1")).toBe(true);
      expect(hasControlledByAccess({ u1: false }, "u1")).toBe(false);
      expect(hasControlledByAccess(["u1"], "u1")).toBe(true);
      expect(hasControlledByAccess(["ALL"], "u2")).toBe(true);
      expect(hasControlledByAccess({ ALL: true }, "")).toBe(false);
      expect(hasControlledByAccess(null, "u1")).toBe(false);
    });
  });

  describe("resource read/edit/delete/manage access", () => {
    it("enforces scope === 'gm' isolation even against ownerId and visibleTo", () => {
      const gmNote = {
        scope: "gm",
        ownerId: "former_gm",
        visibleTo: ["former_gm", "ALL"],
        editableBy: ["former_gm", "ALL"]
      };

      expect(canReadResource(gmNote, { uid: "former_gm", isGM: false })).toBe(false);
      expect(canEditResource(gmNote, { uid: "former_gm", isGM: false })).toBe(false);
      expect(canDeleteResource(gmNote, { uid: "former_gm", isGM: false })).toBe(false);
      expect(canManageResourceAccess(gmNote, { uid: "former_gm", isGM: false })).toBe(false);

      expect(canReadResource(gmNote, { uid: "new_gm", isGM: true })).toBe(true);
      expect(canEditResource(gmNote, { uid: "new_gm", isGM: true })).toBe(true);
      expect(canDeleteResource(gmNote, { uid: "new_gm", isGM: true })).toBe(true);
      expect(canManageResourceAccess(gmNote, { uid: "new_gm", isGM: true })).toBe(true);
    });

    it("checks read and edit for party, owner, sender, and explicit lists", () => {
      expect(canReadResource(null, { uid: "u1" })).toBe(false);
      expect(canReadResource({ visibleTo: ["ALL"] }, { uid: "" })).toBe(false);
      expect(canEditResource(null, { uid: "u1" })).toBe(false);

      const partyNote = { scope: "party", ownerId: "u1", visibleTo: [], editableBy: [] };
      expect(canReadResource(partyNote, { uid: "u2", isGM: false })).toBe(true);
      expect(canEditResource(partyNote, { uid: "u2", isGM: false })).toBe(true);

      const playerNote = {
        scope: "player",
        ownerId: "u1",
        visibleTo: ["u1", "u2"],
        editableBy: ["u1", "u3"]
      };
      expect(canReadResource(playerNote, { uid: "u1" })).toBe(true);
      expect(canReadResource(playerNote, { uid: "u2" })).toBe(true);
      expect(canReadResource(playerNote, { uid: "u4" })).toBe(false);
      expect(canReadResource(playerNote, { uid: "gm1", isGM: true })).toBe(true);
      expect(canEditResource(playerNote, { uid: "u1" })).toBe(true);
      expect(canEditResource(playerNote, { uid: "u3" })).toBe(true);
      expect(canEditResource(playerNote, { uid: "u2" })).toBe(false);
      expect(canEditResource(playerNote, { uid: "gm1", isGM: true })).toBe(true);

      expect(
        canReadResource({ sender: { uid: "u1" } }, { uid: "u1", isGM: false })
      ).toBe(true);
      expect(canReadResource({}, { uid: "u2", isGM: false })).toBe(false);
      expect(canEditResource({}, { uid: "u2", isGM: false })).toBe(false);
      expect(canEditResource({ editableBy: ["ALL"] }, { uid: "u2" })).toBe(true);
    });

    it("enforces D-3 delete and access-management matrix", () => {
      expect(canDeleteResource(null, { uid: "u1" })).toBe(false);
      expect(canManageResourceAccess(null, { uid: "u1" })).toBe(false);

      const sharedNote = {
        scope: "party",
        noteType: "lore",
        ownerId: "u1",
        visibleTo: ["ALL", "u1"],
        editableBy: ["ALL", "u1"]
      };
      expect(canDeleteResource(sharedNote, { uid: "u2", isGM: false })).toBe(false);
      expect(canDeleteResource(sharedNote, { uid: "u1", isGM: false })).toBe(true);
      expect(canManageResourceAccess(sharedNote, { uid: "u2", isGM: false })).toBe(false);
      expect(canManageResourceAccess(sharedNote, { uid: "u1", isGM: false })).toBe(true);

      expect(
        canDeleteResource({ ownerId: "u1" }, { uid: "u1", entityType: "message" })
      ).toBe(false);
      expect(
        canDeleteResource({ ownerId: "u1" }, { uid: "u1", entityType: "scene" })
      ).toBe(false);
      expect(
        canDeleteResource({ ownerId: "u1" }, { uid: "u1", entityType: "compendiumEntry" })
      ).toBe(false);
      expect(
        canDeleteResource({ ownerId: "u1" }, { uid: "u1", entityType: "media" })
      ).toBe(false);
      expect(
        canDeleteResource({ uploadedBy: "gm1" }, { uid: "gm1", isGM: true, entityType: "media" })
      ).toBe(false);
      expect(
        canDeleteResource({}, { uid: "gm1", isGM: true, entityType: "scene" })
      ).toBe(true);

      const pcSheet = { type: "pc", ownerId: "u1", visibleTo: ["u1"], editableBy: ["u1"] };
      expect(canManageResourceAccess(pcSheet, { uid: "u1", isGM: false })).toBe(false);
      expect(canManageResourceAccess(pcSheet, { uid: "gm1", isGM: true })).toBe(true);
      expect(
        canManageResourceAccess(
          { ownerId: "u1" },
          { uid: "u1", entityType: "character" }
        )
      ).toBe(false);
    });
  });

  describe("tokens, drawings, secrets, outcomes, and saving throws", () => {
    it("enforces token control including hidden === true isolation", () => {
      expect(canControlToken(null, { uid: "u1" })).toBe(false);
      expect(
        canControlToken({ hidden: true, ownerId: "u1", controlledBy: { u1: true } }, { uid: "u1", isGM: false })
      ).toBe(false);
      expect(
        canControlToken({ hidden: true }, { uid: "gm1", isGM: true })
      ).toBe(true);
      expect(
        canControlToken({ hidden: false, ownerId: "u1" }, { uid: "u1" })
      ).toBe(true);
      expect(
        canControlToken({ hidden: false, controlledBy: { u2: true } }, { uid: "u2" })
      ).toBe(true);
      expect(
        canControlToken({ hidden: false, controlledBy: { u2: true } }, { uid: "u3" })
      ).toBe(false);
    });

    it("checks drawing edit strictly by authorId (ignoring legacy createdBy)", () => {
      expect(canEditDrawing(null, { uid: "u1" })).toBe(false);
      expect(canEditDrawing({ authorId: "u1" }, { uid: "u1" })).toBe(true);
      expect(canEditDrawing({ createdBy: "u1" }, { uid: "u1" })).toBe(false);
      expect(canEditDrawing({ authorId: "u2" }, { uid: "gm1", isGM: true })).toBe(true);
    });

    it("validates canUserWriteTokenProjection and isReleasedToPlayers edge cases", () => {
      expect(canUserWriteTokenProjection(null, { uid: "u1" })).toBe(false);
      expect(canUserWriteTokenProjection({ ownerId: "u1" }, { uid: "" })).toBe(false);
      expect(
        canUserWriteTokenProjection({ ownerId: "u1", hidden: false }, { uid: "gm1", isGM: true })
      ).toBe(true);
      expect(
        canUserWriteTokenProjection({ ownerId: "u1", hidden: true }, { uid: "u1", isGM: false })
      ).toBe(false);
      expect(
        canUserWriteTokenProjection(
          { ownerId: "u1", hidden: false },
          { uid: "u1", isGM: false, inHiddenBucket: true }
        )
      ).toBe(false);
      expect(
        canUserWriteTokenProjection({ ownerId: "u1", hidden: false }, { uid: "u1", isGM: false })
      ).toBe(true);
      expect(
        canUserWriteTokenProjection(
          { ownerId: "gm1", controlledBy: { u2: true }, hidden: false },
          { uid: "u2", isGM: false }
        )
      ).toBe(true);
      expect(
        canUserWriteTokenProjection(
          { ownerId: "gm1", controlledBy: { u2: true }, hidden: false },
          { uid: "u3", isGM: false }
        )
      ).toBe(false);

      expect(isReleasedToPlayers(null)).toBe(false);
      expect(isReleasedToPlayers({ scope: "gm", visibleTo: ["ALL"] })).toBe(false);
      expect(isReleasedToPlayers({ scope: "party", visibleTo: ["ALL"] })).toBe(true);
      expect(isReleasedToPlayers({ scope: "player", visibleTo: ["u1"] }, "u1")).toBe(true);
      expect(isReleasedToPlayers({ scope: "player", visibleTo: ["u1"] }, "u2")).toBe(false);
    });

    it("enforces secret and outcome visibility with zero name matching (SEG-08)", () => {
      expect(canSeeSecret({}, {}, { uid: "" })).toBe(false);
      expect(canSeeSecret({ hidden: true }, null, { uid: "gm1", isGM: true })).toBe(true);
      expect(canSeeSecret({ hidden: true, ownerId: "u1" }, null, { uid: "u1" })).toBe(false);

      const pcChar = {
        id: "char_pc",
        name: "Gelo",
        type: "pc",
        ownerId: "u1",
        visibleTo: ["u1"]
      };
      const pcToken = {
        id: "tok_pc",
        kind: "pc",
        characterId: "char_pc",
        hidden: false
      };
      expect(canSeeSecret(pcToken, pcChar, { uid: "u1" })).toBe(true);
      expect(canSeeSecret(pcToken, pcChar, { uid: "u2" })).toBe(false);
      expect(canSeeSecret(pcToken, null, { uid: "u1" })).toBe(false);

      // SEG-08: same name, different characterId must NOT grant access
      const sameNameDifferentChar = {
        id: "char_other",
        name: "Gelo",
        type: "pc",
        ownerId: "u2",
        visibleTo: ["u2"]
      };
      expect(
        canSeeSecret(pcToken, sameNameDifferentChar, { uid: "u2" })
      ).toBe(false);

      // SEG-08: character omitting .id must NOT bypass token.characterId check
      const charWithoutId = {
        name: "Gelo",
        type: "pc",
        ownerId: "u2",
        visibleTo: ["u2"]
      };
      expect(canSeeSecret(pcToken, charWithoutId, { uid: "u2" })).toBe(false);

      // PC inferred from character when token omitted
      expect(canSeeSecret(null, pcChar, { uid: "u1" })).toBe(true);
      // NPC/free token without token object
      expect(canSeeSecret(null, null, { uid: "u1" })).toBe(false);
      expect(
        canSeeSecret(
          { kind: "npc", ownerId: "u2", controlledBy: { u3: true } },
          null,
          { uid: "u3" }
        )
      ).toBe(true);
      expect(
        canSeeSecret({ kind: "free", ownerId: "u2" }, null, { uid: "u1" })
      ).toBe(false);

      expect(canSeeTargetOutcome({ uid: "" })).toBe(false);
      expect(canSeeTargetOutcome({ uid: "gm1", isGM: true })).toBe(true);
      expect(
        canSeeTargetOutcome({ uid: "attacker", senderId: "attacker", token: null })
      ).toBe(true);
      expect(
        canSeeTargetOutcome({
          uid: "u2",
          senderUid: "attacker",
          token: { kind: "free", ownerId: "u3" }
        })
      ).toBe(false);
    });

    it("determines saving throw responsibility using IDs and filtering ALL/gmId", () => {
      expect(isUserResponsibleForSavingThrow({ uid: "" })).toBe(false);
      expect(
        isUserResponsibleForSavingThrow({ uid: "u1", savingThrowRequest: null })
      ).toBe(false);

      // PC with owner & non-GM editor
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u2",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_1" },
          targetCharacter: {
            id: "char_1",
            type: "pc",
            ownerId: "u1",
            editableBy: ["ALL", "gm1", "u2"]
          }
        })
      ).toBe(true);

      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_1" },
          targetCharacter: {
            id: "char_1",
            type: "pc",
            ownerId: "u1",
            editableBy: ["ALL", "gm1"]
          }
        })
      ).toBe(false);

      // GM NPC (ignores ALL in controlledBy)
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGMId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_npc" },
          targetToken: {
            id: "tok_npc",
            kind: "npc",
            ownerId: "gm1",
            controlledBy: { ALL: true }
          }
        })
      ).toBe(true);

      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: false,
          campaignGMId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_npc" },
          targetToken: {
            id: "tok_npc",
            kind: "npc",
            ownerId: "gm1",
            controlledBy: { ALL: true }
          }
        })
      ).toBe(false);

      // Player-controlled free token: player responsible, GM NOT responsible
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u3",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_free" },
          targetToken: {
            id: "tok_free",
            kind: "free",
            ownerId: "gm1",
            controlledBy: { u3: true }
          }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_free" },
          targetToken: {
            id: "tok_free",
            kind: "free",
            ownerId: "gm1",
            controlledBy: { u3: true }
          }
        })
      ).toBe(false);

      // Player PC whose token was spawned by GM (token.ownerId === gmId): GM NOT responsible
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: {
            targetCharacterId: "char_pc",
            targetTokenId: "tok_pc"
          },
          targetCharacter: {
            id: "char_pc",
            type: "pc",
            ownerId: "u1",
            editableBy: ["u1"]
          },
          targetToken: {
            id: "tok_pc",
            kind: "pc",
            characterId: "char_pc",
            ownerId: "gm1",
            controlledBy: { u1: true }
          }
        })
      ).toBe(false);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u1",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: {
            targetCharacterId: "char_pc",
            targetTokenId: "tok_pc"
          },
          targetCharacter: {
            id: "char_pc",
            type: "pc",
            ownerId: "u1",
            editableBy: ["u1"]
          },
          targetToken: {
            id: "tok_pc",
            kind: "pc",
            characterId: "char_pc",
            ownerId: "gm1",
            controlledBy: { u1: true }
          }
        })
      ).toBe(true);

      // Unowned PC (ownerId: null, no non-GM editors/controllers) falls back to GM
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_orphan" },
          targetCharacter: {
            id: "char_orphan",
            type: "pc",
            ownerId: null,
            editableBy: []
          }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u1",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_orphan" },
          targetCharacter: {
            id: "char_orphan",
            type: "pc",
            ownerId: null,
            editableBy: []
          }
        })
      ).toBe(false);

      // SEG-08: targetCharacter / targetToken omitting .id must NOT bypass target*Id check
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u1",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: {
            targetCharacterId: "char_npc_gelo",
            targetTokenId: "tok_npc_gelo"
          },
          targetCharacter: {
            name: "Gelo",
            type: "pc",
            ownerId: "u1",
            editableBy: ["u1"]
          },
          targetToken: {
            kind: "pc",
            ownerId: "u1",
            controlledBy: { u1: true }
          }
        })
      ).toBe(false);

      // Mismatched targetCharacter / targetToken ignored, fallback to v1 snapshot fields
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u5",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: {
            targetCharacterId: "char_expected",
            targetTokenId: "tok_expected",
            targetOwnerId: "u5",
            targetEditableBy: ["u6"]
          },
          targetCharacter: { id: "char_wrong", type: "pc", ownerId: "u9" },
          targetToken: { id: "tok_wrong", ownerId: "u9" }
        })
      ).toBe(true);

      // Omitted campaignGmId and omitted targetOwnerId fall back to GM when no player owns target
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          savingThrowRequest: {},
          targetCharacter: { ownerId: null, editableBy: null }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u1",
          isGM: false,
          savingThrowRequest: {}
        })
      ).toBe(false);

      // Finding 1: targetCharacter null/mismatched with GM-spawned token must NOT shadow targetOwnerId
      const shadowedTargetReq = {
        targetCharacterId: "char_pc",
        targetTokenId: "tok_pc",
        targetOwnerId: "u5",
        targetEditableBy: []
      };
      const gmSpawnedToken = {
        id: "tok_pc",
        kind: "pc",
        characterId: "char_pc",
        ownerId: "gm1",
        controlledBy: {}
      };
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u5",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: shadowedTargetReq,
          targetCharacter: null,
          targetToken: gmSpawnedToken
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: shadowedTargetReq,
          targetCharacter: null,
          targetToken: gmSpawnedToken
        })
      ).toBe(false);

      // Finding 2: whitespace-only ownerId/tokenOwner falls back to GM; padded UIDs match trimmed safeUid
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_ws", targetTokenId: "tok_ws" },
          targetCharacter: { id: "char_ws", type: "pc", ownerId: "   ", editableBy: [] },
          targetToken: { id: "tok_ws", kind: "free", ownerId: "   ", controlledBy: {} }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u1",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_u1" },
          targetCharacter: { id: "char_u1", type: "pc", ownerId: " u1 ", editableBy: [] }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          campaignGmId: "gm1",
          savingThrowRequest: { targetCharacterId: "char_u1" },
          targetCharacter: { id: "char_u1", type: "pc", ownerId: " u1 ", editableBy: [] }
        })
      ).toBe(false);

      // Finding 3: omitted campaignGmId with isGM: true still prevents GM false positive on PC token
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          savingThrowRequest: {
            targetCharacterId: "char_pc",
            targetTokenId: "tok_pc"
          },
          targetCharacter: {
            id: "char_pc",
            type: "pc",
            ownerId: "u1",
            editableBy: ["u1"]
          },
          targetToken: {
            id: "tok_pc",
            kind: "pc",
            characterId: "char_pc",
            ownerId: "gm1",
            controlledBy: { u1: true }
          }
        })
      ).toBe(false);
      // And preserves GM fallback on GM-owned NPC when campaignGmId is omitted
      expect(
        isUserResponsibleForSavingThrow({
          uid: "gm1",
          isGM: true,
          savingThrowRequest: { targetTokenId: "tok_npc" },
          targetToken: {
            id: "tok_npc",
            kind: "npc",
            ownerId: "gm1",
            controlledBy: { ALL: true }
          }
        })
      ).toBe(true);

      // Line 337 branch: non-GM tokenOwner directly responsible without controlledBy or character owner
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u4",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_owned_p4" },
          targetToken: {
            id: "tok_owned_p4",
            kind: "free",
            ownerId: " u4 ",
            controlledBy: {}
          }
        })
      ).toBe(true);
      expect(
        isUserResponsibleForSavingThrow({
          uid: "u9",
          isGM: false,
          campaignGmId: "gm1",
          savingThrowRequest: { targetTokenId: "tok_owned_p4" },
          targetToken: {
            id: "tok_owned_p4",
            kind: "free",
            ownerId: " u4 ",
            controlledBy: {}
          }
        })
      ).toBe(false);
    });
  });
});
