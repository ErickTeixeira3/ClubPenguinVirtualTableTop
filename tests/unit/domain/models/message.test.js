import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  fromMessageDoc,
  normalizeMessage,
  toMessageDoc,
  validateMessage
} from "../../../../src/domain/models/message.js";

describe("domain/models/message", () => {
  it("normalizes text, emote, skill_ping, and roll messages and converts v1 legacy docs", () => {
    const textMsg = normalizeMessage({
      campaignId: "camp_1",
      type: "text",
      seq: 1,
      sender: { uid: "u_1", displayName: "Pingu" },
      content: "Olá!"
    });
    expect(textMsg.visibleTo).toEqual(["ALL"]);
    expect(validateMessage(textMsg)).toEqual({ ok: true, errors: [] });

    const emoteMsg = fromMessageDoc(
      {
        campaignId: "camp_1",
        type: "emote",
        seq: 2,
        senderId: "u_1",
        senderName: "Pingu",
        icon: "snowflake",
        timestampMs: 1234
      },
      "msg_2"
    );
    expect(emoteMsg.emote).toEqual({ icon: "snowflake" });
    expect(emoteMsg.createdAt).toBe(1234);
    expect(validateMessage(emoteMsg).ok).toBe(true);

    const pingMsg = fromMessageDoc(
      {
        campaignId: "camp_1",
        type: "skill_ping",
        seq: 3,
        senderId: "u_1",
        skillData: {
          id: "ab_1",
          name: "Jato de Neve",
          attribute: "intelecto"
        }
      },
      "msg_3"
    );
    expect(pingMsg.skillPing.name).toBe("Jato de Neve");
    expect(pingMsg.skillPing.attributeKey).toBe("intelecto");
    expect(validateMessage(pingMsg).ok).toBe(true);

    const legacyRoll = fromMessageDoc(
      {
        campaignId: "camp_1",
        type: "ability_roll",
        seq: 4,
        visibility: "gm_only",
        senderId: "u_1",
        senderName: "Pingu",
        characterId: "char_1",
        characterMediaId: "med_c1",
        rollData: {
          title: "Ataque",
          rollKind: "attack",
          categoryColor: "#ff0000",
          primary: { total: 18 },
          costPaid: { resource: "MP", amount: 2 },
          targetInfo: {
            isAttackRoll: true,
            isHit: true,
            defense: 15,
            targets: [{ tokenId: "tok_1", sceneId: "s_1", name: "Inimigo", defense: 15 }]
          },
          savingThrowRequest: {
            id: "save_1",
            attribute: "reflexos",
            dc: 0,
            sourceRollName: "Ataque"
          },
          damageConfig: { formula: "2d6", label: "Gelo", effectType: "damage" },
          parentMessageId: "msg_parent",
          respondedToSaveId: "save_0",
          appliedEffects: [{ opId: "op_1", effectType: "damage", finalValue: 8 }]
        }
      },
      "msg_4",
      { gmId: "gm_1" }
    );

    expect(legacyRoll.type).toBe("roll");
    expect(legacyRoll.visibleTo).toEqual(["gm_1", "u_1"]);
    expect(legacyRoll.sender.image).toEqual({ mediaId: "med_c1", url: null });
    expect(legacyRoll.roll.hitEvaluation).toEqual({
      status: "done",
      results: [{ tokenId: "tok_1", hit: true, crit: false, fumble: false }]
    });
    expect(legacyRoll.roll.targets[0]).not.toHaveProperty("defense");
    expect(legacyRoll.roll.savingThrowRequest.dc).toBe(0);
    expect(legacyRoll.roll.respondsTo).toEqual({
      messageId: "msg_parent",
      saveId: "save_0"
    });
    expect(legacyRoll.roll.appliedEffects.op_1.finalValue).toBe(8);
    expect(validateMessage(legacyRoll)).toEqual({ ok: true, errors: [] });

    const docOut = toMessageDoc(legacyRoll);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("rollData");
    expect(docOut).not.toHaveProperty("timestampMs");
    expect(fromMessageDoc(docOut, "msg_4")).toEqual(legacyRoll);
  });

  it("forbids defense inside roll.hitEvaluation & roll.targets, rejects seq: 0, and catches invalid fields", () => {
    expect(validateMessage(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const badRollMsg = {
      ...normalizeMessage({
        campaignId: "",
        type: "roll",
        seq: 0,
        status: "pending",
        opId: null,
        sender: { uid: "", displayName: "", characterId: "  " },
        roll: {
          kind: "bad_kind",
          title: "",
          targets: [{ tokenId: "t1", label: "Alvo", defense: 14 }],
          hitEvaluation: {
            status: "bad",
            defense: 14,
            results: [{ tokenId: "t1", hit: true, defense: 14 }]
          },
          savingThrowRequest: { id: "", attributeKey: "", dc: "bad" },
          respondsTo: { messageId: "", saveId: "" },
          secondary: { formula: 123, effectType: "bad", deferred: "no", rolled: "no" }
        }
      }),
      timestampMs: 123
    };

    const res = validateMessage(badRollMsg);
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.INVALID_ENUM_VALUE);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);

    const missingVariantPayloads = [
      normalizeMessage({ campaignId: "c1", type: "text", seq: 1, sender: { uid: "u1" }, content: "   " }),
      normalizeMessage({ campaignId: "c1", type: "emote", seq: 1, sender: { uid: "u1" }, emote: {} }),
      normalizeMessage({ campaignId: "c1", type: "skill_ping", seq: 1, sender: { uid: "u1" }, skillPing: {} }),
      normalizeMessage({ campaignId: "c1", type: "roll", seq: 1, sender: { uid: "u1" }, roll: null })
    ];
    for (const msg of missingVariantPayloads) {
      expect(validateMessage(msg).ok).toBe(false);
    }

    const moreInvalid = validateMessage({
      campaignId: "c1",
      type: "invalid_type",
      seq: 1,
      visibility: "bad_vis",
      visibleTo: ["u1"],
      sender: "bad_sender",
      status: "bad_status",
      opId: "  ",
      isDeleted: "no"
    });
    expect(moreInvalid.ok).toBe(false);

    const invalidRollNested = validateMessage({
      campaignId: "c1",
      type: "roll",
      seq: 1,
      visibility: "public",
      visibleTo: ["ALL"],
      sender: {
        uid: "u1",
        characterId: 99,
        displayName: "P",
        image: { mediaId: null, url: null }
      },
      status: "committed",
      opId: null,
      isDeleted: false,
      roll: {
        kind: "attack",
        title: "Atk",
        rolls: "bad",
        costs: "bad",
        targets: "bad",
        allyCostOps: "bad",
        hitEvaluation: "bad",
        savingThrowRequest: "bad",
        respondsTo: "bad",
        secondary: "bad",
        appliedEffects: "bad"
      }
    });
    expect(invalidRollNested.ok).toBe(false);

    const invalidHitEvalNested = validateMessage({
      campaignId: "c1",
      type: "roll",
      seq: 1,
      visibility: "public",
      visibleTo: ["ALL"],
      sender: {
        uid: "u1",
        characterId: null,
        displayName: "P",
        image: { mediaId: null, url: null }
      },
      status: "committed",
      opId: null,
      isDeleted: false,
      roll: {
        kind: "attack",
        title: "Atk",
        rolls: [],
        costs: [],
        targets: [],
        allyCostOps: [],
        hitEvaluation: { status: "done", results: "bad" },
        appliedEffects: JSON.parse('{"__proto__":{}}')
      }
    });
    expect(invalidHitEvalNested.ok).toBe(false);

    const legacyV1TargetHit = fromMessageDoc(
      {
        campaignId: "c1",
        type: "roll",
        seq: "5",
        visibility: "invalid_vis",
        sender: { uid: "u1", displayName: 123, image: { mediaId: null, url: null } },
        opId: 99,
        deletedBy: "  ",
        rollData: {
          title: 123,
          targetInfo: { tokenId: "tok_single", name: "Goblin" },
          appliedEffects: JSON.parse('[null, {"opId":"__proto__"},{"finalValue":3}]')
        }
      },
      null,
      null
    );
    expect(legacyV1TargetHit.seq).toBe(5);
    expect(legacyV1TargetHit.roll.targets[0].tokenId).toBe("tok_single");
    expect(legacyV1TargetHit.roll.appliedEffects.legacy_2.finalValue).toBe(3);

    const emoteDocOut = toMessageDoc(
      fromMessageDoc(
        {
          campaignId: "c1",
          type: "emote",
          seq: 6,
          senderId: "u1",
          emote: { icon: "star" },
          skillPing: { name: "Skill", bonus: "2" }
        },
        "m6"
      )
    );
    expect(emoteDocOut.emote).toEqual({ icon: "star" });
    expect(emoteDocOut.skillPing.bonus).toBe(2);
    expect(fromMessageDoc(null, null, null).type).toBe("text");
    expect(
      normalizeMessage({
        campaignId: "c1",
        type: "roll",
        seq: 1,
        sender: { uid: "u1" },
        roll: {
          kind: "attack",
          title: "T",
          hitEvaluation: { status: "done", results: [{ tokenId: "t1", defense: 10 }] },
          appliedEffects: JSON.parse('{"__proto__":{}," ":{},"op1":{"effectType":"damage","finalValue":5}}')
        }
      }).roll.appliedEffects.op1.finalValue
    ).toBe(5);
  });
});
