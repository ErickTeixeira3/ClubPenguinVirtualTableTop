import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  fromAppConfigDoc,
  normalizeAppConfig,
  toAppConfigDoc,
  validateAppConfig
} from "../../../../src/domain/models/appConfig.js";
import {
  fromChatStateDoc,
  normalizeChatState,
  toChatStateDoc,
  validateChatState
} from "../../../../src/domain/models/chatState.js";
import {
  fromPendingCostDoc,
  normalizePendingCost,
  toPendingCostDoc,
  validatePendingCost
} from "../../../../src/domain/models/pendingCost.js";
import {
  fromPlatformAdminDoc,
  normalizePlatformAdmin,
  toPlatformAdminDoc,
  validatePlatformAdmin
} from "../../../../src/domain/models/platformAdmin.js";
import {
  fromTurnStateDoc,
  normalizeCombatant,
  normalizeTurnState,
  toTurnStateDoc,
  validateTurnState
} from "../../../../src/domain/models/turnState.js";

describe("domain/models/turnState", () => {
  it("preserves frozen U1 behavior (actionsMax/reactionsMax 0 -> 1, round >= 1, clamp activeTurnIndex)", () => {
    const empty = normalizeTurnState(null);
    expect(empty).toEqual({
      active: false,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true,
      turnOrder: []
    });
    expect(validateTurnState(empty)).toEqual({ ok: true, errors: [] });

    const comb = normalizeCombatant({ actionsMax: 0, reactionsMax: 0 }, 2);
    expect(comb.combatantId).toBe("comb_2");
    expect(comb.actionsMax).toBe(1);
    expect(comb.reactionsMax).toBe(1);

    const state = fromTurnStateDoc({
      active: true,
      round: 0,
      activeTurnIndex: 5,
      turnOrder: [{ tokenId: "tok_1", name: "Pingu" }]
    });
    expect(state.round).toBe(1);
    expect(state.activeTurnIndex).toBe(0);
    expect(validateTurnState(state).ok).toBe(true);
    expect(toTurnStateDoc(state)).toEqual(state);
  });

  it("validates turnState invariants", () => {
    expect(validateTurnState(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    const res = validateTurnState({
      active: "yes",
      round: 0,
      activeTurnIndex: 1,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true,
      turnOrder: [
        {
          combatantId: "",
          name: "",
          initiative: Number.NaN,
          movementBudgetMeters: -1,
          movementUsedMeters: -1,
          actionsMax: 0,
          actionsRemaining: -1,
          reactionsMax: 0,
          reactionsRemaining: -1
        }
      ]
    });
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(res.errors.map((e) => e.code)).toContain(
      ERROR_CODES.MISSING_REQUIRED_FIELD
    );

    const invalidTypes = validateTurnState({
      active: false,
      round: "1",
      activeTurnIndex: "0",
      lockMovementOutsideTurn: "yes",
      lockActionsOutsideTurn: "no",
      turnOrder: "not-array"
    });
    expect(invalidTypes.errors.map((e) => e.code)).toContain(
      ERROR_CODES.INVALID_TYPE
    );

    const badCombatantEntry = validateTurnState({
      active: false,
      round: 1,
      activeTurnIndex: 0,
      lockMovementOutsideTurn: true,
      lockActionsOutsideTurn: true,
      turnOrder: [null]
    });
    expect(badCombatantEntry.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    expect(
      normalizeCombatant({
        combatantId: "c1",
        tokenId: " ",
        characterId: 123,
        ownerId: " u1 ",
        movementBudgetMeters: Number.NaN,
        actionsMax: Number.NaN,
        reactionsMax: Number.NaN
      }).movementBudgetMeters
    ).toBe(9);
  });
});

describe("domain/models/chatState", () => {
  it("validates lastSeq/lastMessageId consistency and emits strictly 2 keys in toDoc", () => {
    const empty = normalizeChatState();
    expect(empty).toEqual({ lastSeq: 0, lastMessageId: null });
    expect(validateChatState(empty)).toEqual({ ok: true, errors: [] });

    const active = fromChatStateDoc({ lastSeq: 5, lastMessageId: "msg_5" });
    expect(validateChatState(active).ok).toBe(true);
    expect(Object.keys(toChatStateDoc(active))).toEqual([
      "lastSeq",
      "lastMessageId"
    ]);

    expect(validateChatState(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateChatState(normalizeChatState({ lastSeq: -1 })).errors[0].code
    ).toBe(ERROR_CODES.OUT_OF_RANGE);
    expect(
      validateChatState({ lastSeq: 0, lastMessageId: "msg_1" }).errors[0].code
    ).toBe(ERROR_CODES.VALIDATION_FAILED);
    expect(
      validateChatState({ lastSeq: 2, lastMessageId: null }).errors[0].code
    ).toBe(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(
      validateChatState(normalizeChatState({ lastSeq: "NaN", lastMessageId: 123 }))
        .errors.map((e) => e.code)
    ).toEqual([ERROR_CODES.INVALID_TYPE, ERROR_CODES.INVALID_TYPE]);
    expect(normalizeChatState(null)).toEqual({ lastSeq: 0, lastMessageId: null });
    expect(fromChatStateDoc({ lastSeq: 1, lastMessageId: "  " }).lastMessageId).toBeNull();
  });
});

describe("domain/models/pendingCost", () => {
  it("normalizes, filters unsafe keys, and validates pending/applied invariants", () => {
    const polluted = JSON.parse('{"__proto__":10,"mp":4}');
    const cost = fromPendingCostDoc(
      {
        campaignId: "camp_1",
        characterId: "char_1",
        sourceMessageId: "msg_1",
        costs: polluted,
        createdBy: "u_1"
      },
      "op_1"
    );
    expect(cost.opId).toBe("op_1");
    expect(cost.status).toBe("pending");
    expect(cost.costs).toEqual({ mp: 4 });
    expect(validatePendingCost(cost)).toEqual({ ok: true, errors: [] });

    const docOut = toPendingCostDoc(cost);
    expect(docOut).not.toHaveProperty("id");
    expect(fromPendingCostDoc(docOut, "op_1")).toEqual(cost);

    expect(validatePendingCost(null).errors[0].code).toBe(
      ERROR_CODES.INVALID_TYPE
    );
    const badApplied = normalizePendingCost({
      opId: "op_2",
      campaignId: "camp_1",
      characterId: "char_1",
      sourceMessageId: "msg_1",
      costs: { xp: 5, hp: -1 },
      createdBy: "u_1",
      status: "applied",
      appliedBy: null
    });
    const res = validatePendingCost(badApplied);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.VALIDATION_FAILED);
    expect(res.errors.map((e) => e.code)).toContain(ERROR_CODES.OUT_OF_RANGE);
    expect(res.errors.map((e) => e.code)).toContain(
      ERROR_CODES.MISSING_REQUIRED_FIELD
    );

    expect(
      validatePendingCost(
        normalizePendingCost({
          opId: "op_3",
          campaignId: "camp_1",
          characterId: "char_1",
          sourceMessageId: "msg_1",
          costs: { mp: 2 },
          createdBy: "u_1",
          status: "pending",
          appliedBy: "u_2"
        })
      ).errors.map((e) => e.code)
    ).toContain(ERROR_CODES.VALIDATION_FAILED);

    const pollutedAndBad = normalizePendingCost(
      JSON.parse(
        '{"opId":"op_4","campaignId":"camp_1","characterId":"char_1","sourceMessageId":"msg_1","createdBy":"u_1","itemId":"  ","appliedBy":"  ","costs":{"__proto__":1," ":2,"mp":null}}'
      ),
      null
    );
    expect(pollutedAndBad.itemId).toBeNull();
    expect(pollutedAndBad.appliedBy).toBeNull();
    expect(pollutedAndBad.costs).toEqual({});
    expect(validatePendingCost(pollutedAndBad).errors.map((e) => e.code)).toContain(
      ERROR_CODES.VALIDATION_FAILED
    );

    expect(
      validatePendingCost({
        opId: "op_5",
        campaignId: "camp_1",
        characterId: "char_1",
        sourceMessageId: "msg_1",
        createdBy: "u_1",
        itemId: 99,
        costs: "not-obj",
        status: "invalid_status"
      }).errors.map((e) => e.code)
    ).toEqual([
      ERROR_CODES.INVALID_TYPE,
      ERROR_CODES.INVALID_TYPE,
      ERROR_CODES.INVALID_ENUM_VALUE
    ]);

    expect(
      normalizePendingCost({ itemId: 42, appliedBy: 42, costs: { mp: "3" } }).costs.mp
    ).toBe(3);
    expect(fromPendingCostDoc(null, null, null).opId).toBe("");
  });
});

describe("domain/models/appConfig & platformAdmin", () => {
  it("normalizes and validates appConfig semver and schemaVersion", () => {
    const cfg = fromAppConfigDoc({ minClientVersion: "2.1.0-beta.1", schemaVersion: 2 });
    expect(validateAppConfig(cfg)).toEqual({ ok: true, errors: [] });
    expect(toAppConfigDoc(cfg)).toEqual({
      minClientVersion: "2.1.0-beta.1",
      schemaVersion: 2
    });

    expect(validateAppConfig(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateAppConfig(
        normalizeAppConfig({ minClientVersion: "bad", schemaVersion: 0 })
      ).errors.map((e) => e.code)
    ).toEqual([ERROR_CODES.VALIDATION_FAILED, ERROR_CODES.OUT_OF_RANGE]);

    const updatedCfg = normalizeAppConfig(
      { minClientVersion: 123, schemaVersion: "NaN", updatedAt: 999 },
      null
    );
    expect(updatedCfg.minClientVersion).toBe("");
    expect(validateAppConfig(updatedCfg).errors.map((e) => e.code)).toEqual([
      ERROR_CODES.VALIDATION_FAILED,
      ERROR_CODES.INVALID_TYPE
    ]);
    expect(toAppConfigDoc({ minClientVersion: "2.0.0", updatedAt: 999 }).updatedAt).toBe(
      999
    );
    expect(fromAppConfigDoc(null, null, null).id).toBe("runtime");
  });

  it("normalizes and validates platformAdmin uid and docId reference", () => {
    const admin = fromPlatformAdminDoc({ createdAt: 100 }, "adm_1");
    expect(admin).toEqual({ uid: "adm_1", createdAt: 100 });
    expect(validatePlatformAdmin(admin, { docId: "adm_1" })).toEqual({
      ok: true,
      errors: []
    });
    expect(toPlatformAdminDoc(admin)).toEqual({ uid: "adm_1", createdAt: 100 });

    expect(validatePlatformAdmin(null).errors[0].code).toBe(
      ERROR_CODES.INVALID_TYPE
    );
    expect(
      validatePlatformAdmin(normalizePlatformAdmin({}, null), null).errors[0].code
    ).toBe(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(
      validatePlatformAdmin(admin, { docId: "other" }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_REFERENCE);
    expect(fromPlatformAdminDoc(null, null, { uid: "adm_ctx" }).uid).toBe("adm_ctx");
    expect(fromPlatformAdminDoc(null, null, null).uid).toBe("");
  });
});
