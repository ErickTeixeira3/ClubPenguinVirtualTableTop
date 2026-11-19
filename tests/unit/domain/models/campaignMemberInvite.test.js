import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  DEFAULT_CAMPAIGN_SCHEMA_VERSION,
  fromCampaignDoc,
  normalizeCampaign,
  toCampaignDoc,
  validateCampaign
} from "../../../../src/domain/models/campaign.js";
import {
  fromInviteDoc,
  normalizeInvite,
  normalizeInviteEmail,
  toInviteDoc,
  toInviteEmailKey,
  validateInvite
} from "../../../../src/domain/models/invite.js";
import {
  fromMemberDoc,
  normalizeMember,
  toMemberDoc,
  validateMember
} from "../../../../src/domain/models/member.js";

describe("domain/models/campaign", () => {
  it("normalizes defaults and strips v1 legacy fields on fromDoc/toDoc", () => {
    expect(DEFAULT_CAMPAIGN_SCHEMA_VERSION).toBe(2);
    const camp = fromCampaignDoc(
      {
        name: "  Ilha Gelada  ",
        gmId: "  gm_1 ",
        activeSceneId: "  scene_1 ",
        schemaVersion: "2",
        players: { gm_1: {} },
        authorizedUsers: [],
        authorizedEmails: [],
        combatState: { active: true },
        createdAt: 100
      },
      "camp_1"
    );

    expect(camp).toEqual({
      id: "camp_1",
      campaignId: "camp_1",
      name: "Ilha Gelada",
      gmId: "gm_1",
      activeSceneId: "scene_1",
      schemaVersion: 2,
      createdAt: 100,
      updatedAt: null
    });
    expect(validateCampaign(camp)).toEqual({ ok: true, errors: [] });

    const docOut = toCampaignDoc(camp);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("players");
    expect(docOut).not.toHaveProperty("combatState");
    expect(fromCampaignDoc(docOut, "camp_1")).toEqual(camp);
  });

  it("validates required fields, reference equality, activeSceneId, schemaVersion, and legacy keys", () => {
    expect(validateCampaign(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateCampaign(
        normalizeCampaign({
          id: "",
          campaignId: "",
          name: "   ",
          gmId: "",
          activeSceneId: "bad/scene",
          schemaVersion: 0
        })
      ).errors.map((e) => e.code)
    ).toEqual([
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      ERROR_CODES.INVALID_REFERENCE,
      ERROR_CODES.OUT_OF_RANGE
    ]);

    expect(
      validateCampaign({
        id: "c1",
        campaignId: "c2",
        name: "Camp",
        gmId: "gm1",
        activeSceneId: 123,
        schemaVersion: 1.5,
        players: {}
      }).errors.map((e) => e.code)
    ).toEqual([
      ERROR_CODES.INVALID_REFERENCE,
      ERROR_CODES.INVALID_TYPE,
      ERROR_CODES.INVALID_TYPE,
      ERROR_CODES.VALIDATION_FAILED
    ]);

    expect(normalizeCampaign(null, null).schemaVersion).toBe(2);
    expect(
      normalizeCampaign({ activeSceneId: "   ", schemaVersion: 3 }).activeSceneId
    ).toBeNull();
    expect(normalizeCampaign({ activeSceneId: 42 }).activeSceneId).toBe(42);
    expect(fromCampaignDoc(null, null, null).id).toBe("");
    expect(
      validateCampaign(normalizeCampaign({ id: "c1", campaignId: "c1", name: "Camp", gmId: "gm1" })).ok
    ).toBe(true);
    expect(
      validateCampaign({
        id: "c1",
        campaignId: "c1",
        name: "Camp",
        gmId: "gm1",
        activeSceneId: " ",
        schemaVersion: 2
      }).errors.map((e) => e.code)
    ).toEqual([ERROR_CODES.INVALID_TYPE]);
  });
});

describe("domain/models/member", () => {
  it("normalizes defaults and converts v1 player profile fields", () => {
    const member = fromMemberDoc(
      {
        campaignId: " camp_1 ",
        displayName: "   ",
        role: "gm",
        email: "a@b.com",
        avatarMediaId: "med_5",
        photoURL: "https://old.com/a.png",
        activeCharacterId: " char_1 ",
        joinedAt: 50
      },
      "u_1"
    );

    expect(member).toEqual({
      id: "u_1",
      uid: "u_1",
      campaignId: "camp_1",
      displayName: "Pinguim",
      avatar: { mediaId: "med_5", url: null },
      activeCharacterId: "char_1",
      joinedAt: 50,
      createdAt: null,
      updatedAt: null
    });
    expect(validateMember(member).ok).toBe(true);

    const docOut = toMemberDoc(member);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("role");
    expect(docOut).not.toHaveProperty("email");
    expect(fromMemberDoc(docOut, "u_1")).toEqual(member);
  });

  it("validates uid, id mismatch, campaignId, displayName, avatar, activeCharacterId, and legacy keys", () => {
    expect(validateMember("bad").errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    const bad = validateMember({
      id: "u_2",
      uid: "u_1",
      campaignId: "",
      displayName: 123,
      avatar: { mediaId: "med_1", url: "https://x.com/a.png" },
      activeCharacterId: "bad/ref",
      role: "player"
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.map((e) => e.code)).toContain(ERROR_CODES.INVALID_REFERENCE);
    expect(bad.errors.map((e) => e.code)).toContain(ERROR_CODES.INVALID_IMAGE_REF);
    expect(bad.errors.map((e) => e.code)).toContain(ERROR_CODES.VALIDATION_FAILED);

    expect(
      validateMember(
        normalizeMember({
          uid: "",
          campaignId: "c1",
          displayName: "Pingu",
          activeCharacterId: 99
        })
      ).errors.map((e) => e.code)
    ).toEqual([ERROR_CODES.MISSING_REQUIRED_FIELD, ERROR_CODES.INVALID_TYPE]);

    const nonStringDisplay = normalizeMember(
      { uid: "u1", campaignId: "c1", displayName: 123, activeCharacterId: "   " },
      null
    );
    expect(nonStringDisplay.displayName).toBe("");
    expect(nonStringDisplay.activeCharacterId).toBeNull();
    expect(validateMember(nonStringDisplay).ok).toBe(false);

    const v2WithAvatarObj = fromMemberDoc(
      {
        campaignId: "c1",
        displayName: "Pingu",
        avatar: { mediaId: null, url: "https://cdn.site/av.png" }
      },
      "u_3",
      null
    );
    expect(v2WithAvatarObj.avatar).toEqual({
      mediaId: null,
      url: "https://cdn.site/av.png"
    });
    expect(fromMemberDoc(null, null, null).uid).toBe("");
  });
});

describe("domain/models/invite", () => {
  it("normalizes email and generates RTDB email keys replacing all dots", () => {
    expect(normalizeInviteEmail("  Foo.Bar.Baz@Gmail.Com ")).toBe(
      "foo.bar.baz@gmail.com"
    );
    expect(normalizeInviteEmail(123)).toBe("");
    expect(toInviteEmailKey("Foo.Bar.Baz@Gmail.Com")).toBe(
      "foo,bar,baz@gmail,com"
    );

    for (const invalid of ["", "no-at", "a/b@c.com", "a#b@c.com", "a$b@c.com", "a[b]@c.com", "a b@c.com"]) {
      expect(() => toInviteEmailKey(invalid)).toThrow();
    }
  });

  it("converts v1 invite docs and validates v2 invariants", () => {
    const inv = fromInviteDoc(
      {
        campaignId: "camp_1",
        role: "player",
        acceptedBy: "  "
      },
      "Player.One@Example.COM"
    );

    expect(inv).toEqual({
      id: "player.one@example.com",
      email: "player.one@example.com",
      campaignId: "camp_1",
      defaultDisplayName: "player.one",
      acceptedBy: null,
      createdAt: null,
      updatedAt: null
    });
    expect(validateInvite(inv).ok).toBe(true);

    const docOut = toInviteDoc(inv);
    expect(docOut).not.toHaveProperty("id");
    expect(docOut).not.toHaveProperty("role");
    expect(fromInviteDoc(docOut, inv.email)).toEqual(inv);

    expect(validateInvite(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    const invalidRes = validateInvite({
      id: "other@x.com",
      email: "Upper@X.COM",
      campaignId: "",
      defaultDisplayName: "",
      acceptedBy: 123,
      role: "player"
    });
    expect(invalidRes.ok).toBe(false);
    expect(invalidRes.errors.map((e) => e.code)).toContain(ERROR_CODES.INVALID_REFERENCE);
    expect(invalidRes.errors.map((e) => e.code)).toContain(ERROR_CODES.VALIDATION_FAILED);

    expect(validateInvite(normalizeInvite({})).ok).toBe(false);
    expect(normalizeInvite(null, null).email).toBe("");
    expect(
      normalizeInvite({ email: "a@b.com", acceptedBy: " u_acc ", id: "a@b.com" }).acceptedBy
    ).toBe("u_acc");
    expect(
      validateInvite({
        id: null,
        email: "valid@example.com",
        campaignId: "c1",
        defaultDisplayName: "Valid",
        acceptedBy: "u_acc"
      }).ok
    ).toBe(true);
    expect(
      validateInvite({
        id: "   ",
        email: "bad-email",
        campaignId: "c1",
        defaultDisplayName: "Valid",
        acceptedBy: "   "
      }).errors.map((e) => e.code)
    ).toEqual([
      ERROR_CODES.INVALID_TYPE,
      ERROR_CODES.INVALID_REFERENCE,
      ERROR_CODES.INVALID_TYPE
    ]);
    expect(fromInviteDoc(null, null, null).email).toBe("");
  });
});
