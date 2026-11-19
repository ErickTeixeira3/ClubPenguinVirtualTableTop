import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const firestoreSpies = vi.hoisted(() => ({
  doc: vi.fn((_db, p) => ({ path: p })),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "__SERVER_TS__"),
  updateDoc: vi.fn(async () => {})
}));

const authSpies = vi.hoisted(() => ({
  updateProfile: vi.fn(async () => {})
}));

const mediaSpies = vi.hoisted(() => ({
  uploadDataUrlMedia: vi.fn(async ({ dataUrl }) => ({
    mediaId: "med_uploaded",
    dataUrl
  })),
  grantMediaAudience: vi.fn(async ({ mediaId, visibleTo }) => ({
    mediaId,
    visibleTo,
    updated: true
  }))
}));

const avatarStoreSpies = vi.hoisted(() => ({
  clearPendingAvatarDataUrl: vi.fn(),
  readPendingAvatarDataUrl: vi.fn(() => null)
}));

const compressionSpies = vi.hoisted(() => ({
  compressImageToWebP: vi.fn(async () => ({ dataUrl: "data:image/webp;base64,BBB" }))
}));

const runtimeState = vi.hoisted(() => ({
  blocked: false
}));

vi.mock("firebase/firestore", () => firestoreSpies);
vi.mock("firebase/auth", () => authSpies);
vi.mock("../../../src/infra/firebase.js", () => ({
  auth: { currentUser: { uid: "u1" } },
  db: {},
  DEFAULT_CAMPAIGN_ID: "main-table"
}));
vi.mock("../../../src/infra/imageCompression.js", () => compressionSpies);
vi.mock("../../../src/infra/pendingAvatarStore.js", () => avatarStoreSpies);
vi.mock("../../../src/services/mediaService.js", () => mediaSpies);
vi.mock("../../../src/services/runtimeConfigService.js", () => ({
  assertClientUpToDate: () => {
    if (runtimeState.blocked) {
      const err = new Error("Client outdated");
      err.code = ERROR_CODES.CLIENT_OUTDATED;
      throw err;
    }
  }
}));

const profileService = await import("../../../src/services/profileService.js");
const campaignService = await import("../../../src/services/campaignService.js");

beforeEach(() => {
  vi.clearAllMocks();
  runtimeState.blocked = false;
});

describe("profileService", () => {
  it("updateMemberProfile envia dataUrl como mediaId, remove foto limpando Google photoURL e preserva avatar ao editar só nome", async () => {
    const authInstance = { currentUser: { uid: "u1", photoURL: "https://google.invalid/pic.png" } };

    // 1) Upload dataUrl -> mediaId
    const resUpload = await profileService.updateMemberProfile({
      campaignId: "camp1",
      uid: "u1",
      currentMember: { displayName: "Antigo", avatar: { mediaId: null, url: null } },
      displayName: "Novo Nome",
      photoURL: "data:image/webp;base64,AAA",
      authInstance
    });
    expect(resUpload).toEqual({
      displayName: "Novo Nome",
      avatar: { mediaId: "med_uploaded", url: null },
      uploadedDataUrl: "data:image/webp;base64,AAA"
    });
    expect(mediaSpies.uploadDataUrlMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp1",
        uploadedBy: "u1",
        visibleTo: ["ALL"]
      })
    );
    expect(firestoreSpies.updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/members/u1" },
      {
        displayName: "Novo Nome",
        avatar: { mediaId: "med_uploaded", url: null },
        updatedAt: "__SERVER_TS__"
      }
    );
    expect(authSpies.updateProfile).toHaveBeenCalledWith(authInstance.currentUser, {
      displayName: "Novo Nome",
      photoURL: ""
    });

    // 2) Remover foto explicitamente -> { mediaId: null, url: null } e photoURL: ""
    firestoreSpies.updateDoc.mockClear();
    authSpies.updateProfile.mockClear();
    const resRemove = await profileService.updateMemberProfile({
      campaignId: "camp1",
      uid: "u1",
      currentMember: { displayName: "Novo Nome", avatar: { mediaId: "med_uploaded", url: null } },
      displayName: "Novo Nome",
      avatarAction: "remove",
      authInstance
    });
    expect(resRemove.avatar).toEqual({ mediaId: null, url: null });
    expect(firestoreSpies.updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/members/u1" },
      {
        displayName: "Novo Nome",
        avatar: { mediaId: null, url: null },
        updatedAt: "__SERVER_TS__"
      }
    );
    expect(authSpies.updateProfile).toHaveBeenCalledWith(authInstance.currentUser, {
      displayName: "Novo Nome",
      photoURL: ""
    });

    // 3) Editar só o nome não sobrescreve avatar existente
    firestoreSpies.updateDoc.mockClear();
    const resNameOnly = await profileService.updateMemberProfile({
      campaignId: "camp1",
      uid: "u1",
      currentMember: { displayName: "A", avatar: { mediaId: "med_keep", url: null } },
      displayName: "B",
      authInstance
    });
    expect(resNameOnly.avatar).toEqual({ mediaId: "med_keep", url: null });
    expect(firestoreSpies.updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1/members/u1" },
      { displayName: "B", updatedAt: "__SERVER_TS__" }
    );

    // 4) Vincular avatarMediaId existente concede audiência ["ALL"] antes de gravar o membro
    await profileService.updateMemberProfile({
      campaignId: "camp1",
      uid: "u1",
      currentMember: { displayName: "B", avatar: { mediaId: null, url: null } },
      displayName: "B",
      avatarMediaId: "med_reused",
      authInstance
    });
    expect(mediaSpies.grantMediaAudience).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "camp1",
        mediaId: "med_reused",
        visibleTo: ["ALL"]
      })
    );
  });

  it("migratePendingAvatar envia avatar pendente do uid e limpa store depois", async () => {
    avatarStoreSpies.readPendingAvatarDataUrl.mockReturnValueOnce("data:image/webp;base64,ZZZ");

    const res = await profileService.migratePendingAvatar({
      campaignId: "camp1",
      uid: "u1",
      currentMember: { displayName: "Cad", avatar: { mediaId: null, url: null } },
      authInstance: { currentUser: null }
    });

    expect(res.avatar).toEqual({ mediaId: "med_uploaded", url: null });
    expect(avatarStoreSpies.clearPendingAvatarDataUrl).toHaveBeenCalledTimes(1);
  });

  it("bloqueia escrita quando cliente está desatualizado", async () => {
    runtimeState.blocked = true;
    await expect(
      profileService.updateMemberProfile({
        campaignId: "camp1",
        uid: "u1",
        displayName: "X"
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.CLIENT_OUTDATED });
  });
});

describe("campaignService", () => {
  it("subscribeCampaign normaliza campanha e preserva T-TURN-1 combatState", () => {
    let cb;
    firestoreSpies.onSnapshot.mockImplementation((_ref, onNext) => {
      cb = onNext;
      return vi.fn();
    });

    const onData = vi.fn();
    campaignService.subscribeCampaign({ campaignId: "camp1", firestoreDb: {}, onData });
    cb({ exists: () => false });
    expect(onData).toHaveBeenCalledWith(null);

    cb({
      exists: () => true,
      id: "camp1",
      data: () => ({
        name: "Mesa",
        gmId: "gm1",
        combatState: { active: true, round: 2 }
      })
    });
    expect(onData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "camp1",
        campaignId: "camp1",
        name: "Mesa",
        gmId: "gm1",
        combatState: { active: true, round: 2 }
      })
    );
  });

  it("updateCampaignName e setActiveScene respeitam CLIENT_OUTDATED", async () => {
    await campaignService.updateCampaignName({
      campaignId: "camp1",
      name: "  Nova Ilha ",
      firestoreDb: {}
    });
    expect(firestoreSpies.updateDoc).toHaveBeenCalledWith(
      { path: "campaigns/camp1" },
      { name: "Nova Ilha", updatedAt: "__SERVER_TS__" }
    );

    await campaignService.setActiveScene({
      campaignId: "camp1",
      sceneId: "scene_1",
      firestoreDb: {}
    });
    expect(firestoreSpies.updateDoc).toHaveBeenLastCalledWith(
      { path: "campaigns/camp1" },
      { activeSceneId: "scene_1", updatedAt: "__SERVER_TS__" }
    );

    runtimeState.blocked = true;
    await expect(
      campaignService.updateCampaignName({ campaignId: "camp1", name: "X", firestoreDb: {} })
    ).rejects.toMatchObject({ code: ERROR_CODES.CLIENT_OUTDATED });
    await expect(
      campaignService.setActiveScene({ campaignId: "camp1", sceneId: "s1", firestoreDb: {} })
    ).rejects.toMatchObject({ code: ERROR_CODES.CLIENT_OUTDATED });
  });
});
