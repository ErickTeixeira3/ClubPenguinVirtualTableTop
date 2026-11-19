import { describe, expect, it } from "vitest";
import {
  CHARACTER_TYPES,
  HIT_EVALUATION_STATUS,
  TOKEN_KINDS
} from "../../../../src/domain/constants.js";
import {
  DEFAULT_CHARACTER_DEFENSE,
  DEFAULT_FREE_TOKEN_DEFENSE
} from "../../../../src/domain/defaults.js";
import {
  buildTargetInfo,
  evaluatePendingHitEvaluation,
  resolveTokenTargetData
} from "../../../../src/engines/combat/index.js";

describe("engines/combat/targetResolution", () => {
  describe("resolveTokenTargetData", () => {
    it("returns null for invalid targetedToken", () => {
      expect(resolveTokenTargetData()).toBeNull();
      expect(resolveTokenTargetData(null)).toBeNull();
      expect(resolveTokenTargetData({ targetedToken: null })).toBeNull();
    });

    it("strictly refuses name matching when characterId is absent (SEG-08)", () => {
      const token = { id: "tok_1", kind: TOKEN_KINDS.NPC, label: "Dragão" };
      const allChars = [
        { id: "char_dragon", name: "Dragão", type: CHARACTER_TYPES.NPC, defense: 20 }
      ];
      const resolved = resolveTokenTargetData({
        targetedToken: token,
        allCharacters: allChars
      });
      expect(resolved.linkedCharacter).toBeNull();
      expect(resolved.characterId).toBeNull();
      expect(resolved.defense).toBeNull();
    });

    it("resolves PC defense from linkedChar (array or map) and returns null if PC sheet missing", () => {
      const pcToken = {
        id: "tok_pc",
        kind: TOKEN_KINDS.PC,
        characterId: "char_pc1",
        label: "Fallback"
      };
      const pcChar = {
        id: "char_pc1",
        type: CHARACTER_TYPES.PC,
        name: "Herói",
        defense: 15,
        avatar: { mediaId: "m1", url: null }
      };

      const withSheet = resolveTokenTargetData({
        targetedToken: pcToken,
        allCharacters: { char_pc1: pcChar },
        sceneId: "scene_1"
      });
      expect(withSheet.defense).toBe(15);
      expect(withSheet.label).toBe("Herói");
      expect(withSheet.sceneId).toBe("scene_1");

      const defaultDefPc = resolveTokenTargetData({
        targetedToken: pcToken,
        allCharacters: [{ id: "char_pc1", type: CHARACTER_TYPES.PC, name: "P" }]
      });
      expect(defaultDefPc.defense).toBe(DEFAULT_CHARACTER_DEFENSE);

      const missingPc = resolveTokenTargetData({
        targetedToken: pcToken,
        allCharacters: []
      });
      expect(missingPc.defense).toBeNull();
    });

    it("resolves NPC and free token defense strictly from tokenSecret (not NPC sheet without secret)", () => {
      const npcToken = {
        id: "tok_npc",
        kind: TOKEN_KINDS.NPC,
        characterId: "char_npc1",
        label: "Goblin"
      };
      const npcChar = {
        id: "char_npc1",
        type: CHARACTER_TYPES.NPC,
        name: "Goblin Chefe",
        defense: 16
      };

      const hiddenNpc = resolveTokenTargetData({
        targetedToken: npcToken,
        allCharacters: [npcChar]
      });
      expect(hiddenNpc.defense).toBeNull();

      const revealedNpc = resolveTokenTargetData({
        targetedToken: npcToken,
        tokenSecret: { defense: "18" },
        allCharacters: [npcChar]
      });
      expect(revealedNpc.defense).toBe(18);

      const secretWithoutNumber = resolveTokenTargetData({
        targetedToken: { id: "tok_free", kind: TOKEN_KINDS.FREE, label: "Caixa" },
        tokenSecret: {}
      });
      expect(secretWithoutNumber.defense).toBe(DEFAULT_FREE_TOKEN_DEFENSE);

      const legacyTokenDefense = resolveTokenTargetData({
        targetedToken: { id: "tok_leg", defense: 13 }
      });
      expect(legacyTokenDefense.defense).toBe(13);

      const inferredPc = resolveTokenTargetData({
        targetedToken: {
          tokenId: "tok_inf",
          characterType: CHARACTER_TYPES.PC,
          characterId: "__proto__"
        },
        allCharacters: { char_1: {} }
      });
      expect(inferredPc.tokenId).toBe("tok_inf");
      expect(inferredPc.kind).toBe(TOKEN_KINDS.PC);
      expect(inferredPc.label).toBe("Alvo");

      const badCharsCollection = resolveTokenTargetData({
        targetedToken: { id: "tok_bad", characterId: "c1" },
        allCharacters: "not_a_collection"
      });
      expect(badCharsCollection.kind).toBe(TOKEN_KINDS.NPC);
      expect(badCharsCollection.linkedCharacter).toBeNull();
    });
  });

  describe("buildTargetInfo", () => {
    it("returns null when no valid target tokens are provided", () => {
      expect(buildTargetInfo()).toBeNull();
      expect(buildTargetInfo(null)).toBeNull();
      expect(buildTargetInfo({ targetedTokens: [null] })).toBeNull();
    });

    it("emits targets without numeric defense and NONE status for non-attack rolls", () => {
      const info = buildTargetInfo({
        targetedToken: {
          id: "tok_1",
          kind: TOKEN_KINDS.FREE,
          label: "Alvo"
        },
        tokenSecretsById: { tok_1: { defense: 14 } },
        sceneId: "sc_1",
        isAttackRoll: false
      });

      expect(info).toEqual({
        targets: [
          { tokenId: "tok_1", sceneId: "sc_1", characterId: null, label: "Alvo" }
        ],
        hitEvaluation: { status: HIT_EVALUATION_STATUS.NONE, results: [] },
        targetCount: 1,
        isAttackRoll: false
      });
      expect("defense" in info.targets[0]).toBe(false);
    });

    it("evaluates DONE when attacker canSeeSecret for all targets and PENDING otherwise", () => {
      const pcChar = {
        id: "char_pc",
        type: CHARACTER_TYPES.PC,
        name: "Aliado",
        ownerId: "u_player",
        visibleTo: ["ALL"],
        defense: 14
      };
      const pcToken = {
        id: "tok_pc",
        kind: TOKEN_KINDS.PC,
        characterId: "char_pc",
        ownerId: "u_player"
      };
      const npcToken = {
        id: "tok_npc",
        kind: TOKEN_KINDS.NPC,
        ownerId: "u_gm",
        controlledBy: { u_player: true }
      };
      const secretNpcToken = {
        id: "tok_secret",
        kind: TOKEN_KINDS.NPC,
        ownerId: "u_gm"
      };

      const doneInfo = buildTargetInfo({
        targetedTokens: [pcToken, npcToken],
        tokenSecretsById: { tok_npc: { defense: 16 } },
        allCharacters: [pcChar],
        sceneId: "sc_1",
        actorUid: "u_player",
        isGM: false,
        attackTotal: 15,
        isAttackRoll: true,
        isCrit: true,
        isFumble: false
      });
      expect(doneInfo.hitEvaluation).toEqual({
        status: HIT_EVALUATION_STATUS.DONE,
        results: [
          { tokenId: "tok_pc", hit: true, crit: true, fumble: false },
          { tokenId: "tok_npc", hit: false, crit: true, fumble: false }
        ]
      });

      const pendingSecret = buildTargetInfo({
        targetedTokens: [pcToken, secretNpcToken],
        tokenSecretsById: { tok_secret: { defense: 14 } },
        allCharacters: [pcChar],
        actorUid: "u_player",
        isGM: false,
        attackTotal: 18,
        isAttackRoll: true
      });
      expect(pendingSecret.hitEvaluation).toEqual({
        status: HIT_EVALUATION_STATUS.PENDING,
        results: []
      });

      const pendingMissingAttackTotal = buildTargetInfo({
        targetedToken: pcToken,
        allCharacters: [pcChar],
        actorUid: "u_player",
        attackTotal: null,
        isAttackRoll: true
      });
      expect(pendingMissingAttackTotal.hitEvaluation.status).toBe(
        HIT_EVALUATION_STATUS.PENDING
      );

      // Zero defense guard: null defense must NOT evaluate as 0
      const pendingNullDefense = buildTargetInfo({
        targetedToken: secretNpcToken,
        actorUid: "u_gm",
        isGM: true,
        attackTotal: 5,
        isAttackRoll: true
      });
      expect(pendingNullDefense.hitEvaluation.status).toBe(
        HIT_EVALUATION_STATUS.PENDING
      );
    });
  });

  describe("evaluatePendingHitEvaluation", () => {
    it("allows GM referee to transition pending attack to DONE when secrets are supplied", () => {
      expect(evaluatePendingHitEvaluation()).toEqual({
        status: HIT_EVALUATION_STATUS.PENDING,
        results: []
      });

      const secretNpcToken = {
        id: "tok_secret",
        kind: TOKEN_KINDS.NPC,
        ownerId: "u_gm",
        hidden: true
      };
      const missingActorEval = evaluatePendingHitEvaluation({
        targetedTokens: [secretNpcToken],
        tokenSecretsById: { tok_secret: { defense: 17 } },
        attackTotal: 17
      });
      expect(missingActorEval).toEqual({
        status: HIT_EVALUATION_STATUS.PENDING,
        results: []
      });

      const evalRes = evaluatePendingHitEvaluation({
        targetedTokens: [secretNpcToken],
        tokenSecretsById: { tok_secret: { defense: 17 } },
        actorUid: "u_gm",
        isGM: true,
        attackTotal: 17,
        isCrit: false,
        isFumble: false
      });
      expect(evalRes).toEqual({
        status: HIT_EVALUATION_STATUS.DONE,
        results: [{ tokenId: "tok_secret", hit: true, crit: false, fumble: false }]
      });
    });
  });
});
