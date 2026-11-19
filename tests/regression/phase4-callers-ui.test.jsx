// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../support/fakeFirebase.js";

const grantMediaAudienceMock = vi.fn(async () => ({ updated: true }));
const uploadCompressedMediaMock = vi.fn(async () => ({
  mediaId: "med_uploaded_1",
  widthPx: 64,
  heightPx: 64,
  byteLength: 100
}));

const setActiveSceneMock = vi.fn(async () => {});
const setFoldersMock = vi.fn();

const authState = { user: { uid: "gm1", displayName: "Mestre", email: "gm@example.invalid" } };
const campaignState = {
  campaignId: "camp1",
  campaign: { id: "camp1", gmId: "gm1", activeSceneId: "scene_hidden" },
  isGM: true,
  isRealGM: true,
  setActiveScene: setActiveSceneMock
};

vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
vi.mock("firebase/database", async () => (await import("../support/fakeFirebase.js")).databaseModule);
vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);
vi.mock("../../src/services/mediaService.js", () => ({
  grantMediaAudience: grantMediaAudienceMock,
  uploadCompressedMedia: uploadCompressedMediaMock
}));
vi.mock("../../src/services/mediaService", () => ({
  grantMediaAudience: grantMediaAudienceMock,
  uploadCompressedMedia: uploadCompressedMediaMock
}));
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => authState
}));
vi.mock("../../src/contexts/CampaignContext", () => ({
  useCampaign: () => campaignState
}));
vi.mock("../../src/hooks/useMediaUrl", () => ({
  useMediaUrl: () => ({ url: null, loading: false })
}));
vi.mock("../../src/hooks/useFolders", () => ({
  useFolders: () => ({ folders: [], setFolders: setFoldersMock })
}));

const {
  createJournalNote,
  updateJournalNote,
  cloneJournalNoteToTarget,
  shareJournalNoteWithTarget
} = await import("../../src/services/journalService.js");
const { spawnCharacterTokenToScene } = await import("../../src/services/combatService.js");
const {
  sendEmoteChatMessage,
  sendTextChatMessage,
  sendSkillPingChatMessage,
  executeChatRollMessage
} = await import("../../src/services/rollService.js");
const { useScenes } = await import("../../src/hooks/useScenes.js");
const { useSceneTokens } = await import("../../src/hooks/useSceneTokens.js");
const { useCharacters } = await import("../../src/hooks/useCharacters.js");
const { useCompendium } = await import("../../src/hooks/useCompendium.js");
const CompendiumModal = (await import("../../src/components/compendium/CompendiumModal.jsx")).default;
const ScenesManagerModal = (await import("../../src/components/scenes/ScenesManagerModal.jsx")).default;

const flushMicrotasks = () => act(async () => {});

beforeEach(() => {
  resetFakeDb();
  grantMediaAudienceMock.mockClear();
  uploadCompressedMediaMock.mockClear();
  setActiveSceneMock.mockClear();
  setFoldersMock.mockClear();
  authState.user = { uid: "gm1", displayName: "Mestre", email: "gm@example.invalid" };
  campaignState.campaignId = "camp1";
  campaignState.campaign = { id: "camp1", gmId: "gm1", activeSceneId: "scene_hidden" };
  campaignState.isGM = true;
  campaignState.isRealGM = true;
  campaignState.setActiveScene = setActiveSceneMock;
});

afterEach(() => {
  cleanup();
});

describe("journalService — regressões Fase 4 (editor não-dono, scope gm e image.mediaId)", () => {
  it("editor não-dono passando scope='party' ou 'player' não reescreve scope/visibleTo/editableBy/ownerId", async () => {
    const partyNote = {
      id: "n_party",
      ownerId: "player1",
      scope: "party",
      visibleTo: ["ALL", "player1"],
      editableBy: ["ALL", "player1"]
    };
    const sharedNote = {
      id: "n_shared",
      ownerId: "player1",
      scope: "player",
      visibleTo: ["player1", "player2"],
      editableBy: ["player1", "player2"]
    };

    await updateJournalNote({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      noteId: "n_party",
      updates: { title: "Editado por P2", scope: "party" },
      user: { uid: "player2" },
      isGM: false,
      existingNote: partyNote
    });
    await updateJournalNote({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      noteId: "n_shared",
      updates: { title: "Editado Compartilhada", scope: "player" },
      user: { uid: "player2" },
      isGM: false,
      existingNote: sharedNote
    });

    const writes = fakeDb.writes.filter((w) => w.store === "fs" && w.op === "update");
    expect(writes).toHaveLength(2);
    for (const w of writes) {
      expect(w.payload).not.toHaveProperty("scope");
      expect(w.payload).not.toHaveProperty("visibleTo");
      expect(w.payload).not.toHaveProperty("editableBy");
      expect(w.payload).not.toHaveProperty("ownerId");
    }
  });

  it("createJournalNote scope='gm' grava visibleTo=[] e editableBy=[]; clone/share/update propagam image.mediaId", async () => {
    await createJournalNote({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      title: "Segredo Mestre",
      scope: "gm",
      noteType: "lore",
      content: "x",
      user: { uid: "gm1" },
      isGM: true
    });
    const created = fakeDb.writes.find((w) => w.op === "set").payload;
    expect(created.visibleTo).toEqual([]);
    expect(created.editableBy).toEqual([]);

    const noteWithV2Image = {
      id: "n_img",
      title: "Pista",
      noteType: "lore",
      ownerId: "player1",
      scope: "player",
      visibleTo: ["player1"],
      editableBy: ["player1"],
      image: { mediaId: "med_v2_ref", url: null }
    };

    await updateJournalNote({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      noteId: "n_img",
      updates: { scope: "party" },
      user: { uid: "player1" },
      isGM: false,
      existingNote: noteWithV2Image
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_v2_ref",
      visibleTo: ["ALL", "player1"]
    });

    grantMediaAudienceMock.mockClear();
    await shareJournalNoteWithTarget({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      note: noteWithV2Image,
      noteId: "n_img",
      target: "player2",
      user: { uid: "player1" },
      isGM: false
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_v2_ref",
      visibleTo: ["player1", "player2"]
    });

    grantMediaAudienceMock.mockClear();
    await cloneJournalNoteToTarget({
      campaignId: "camp1",
      campaign: { gmId: "gm1" },
      sourceNote: noteWithV2Image,
      targetScope: "party",
      targetOwnerId: "player1",
      user: { uid: "player1" },
      isGM: false
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_v2_ref",
      visibleTo: ["ALL", "player1"]
    });
  });
});

describe("combatService & rollService — grantMediaAudience antes de publicar", () => {
  it("spawnCharacterTokenToScene concede audiência antes de gravar no RTDB (público e oculto)", async () => {
    let writesWhenGrantCalled = -1;
    grantMediaAudienceMock.mockImplementationOnce(async () => {
      writesWhenGrantCalled = fakeDb.writes.length;
      return { updated: true };
    });

    await spawnCharacterTokenToScene({
      campaignId: "camp1",
      campaign: { gmId: "gm1", activeSceneId: "scene1" },
      activeScene: { id: "scene1" },
      char: {
        id: "ch1",
        name: "Pinguim",
        ownerId: "p1",
        type: "npc",
        defaultToken: { mediaId: "med_tok_pub", visibleToPlayers: true }
      },
      user: { uid: "gm1" },
      isGM: true,
      canEditCharacter: () => true
    });
    expect(writesWhenGrantCalled).toBe(0);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_tok_pub",
      visibleTo: ["ALL"]
    });
    expect(fakeDb.writes.some((w) => w.store === "rtdb")).toBe(true);

    grantMediaAudienceMock.mockClear();
    await spawnCharacterTokenToScene({
      campaignId: "camp1",
      campaign: { gmId: "gm1", activeSceneId: "scene1" },
      activeScene: { id: "scene1" },
      char: {
        id: "ch2",
        name: "Chefe Oculto",
        ownerId: "p2",
        type: "npc",
        defaultToken: {
          mediaId: "med_tok_priv"
        }
      },
      spawnOptions: { hidden: true },
      user: { uid: "gm1" },
      isGM: true,
      canEditCharacter: () => true
    });
    expect(grantMediaAudienceMock).not.toHaveBeenCalled();
  });

  it("rollService propaga audiência da mídia do remetente/personagem em emote, text, skill_ping e roll", async () => {
    const campaign = {
      id: "camp1",
      gmId: "gm1",
      players: { p1: { avatar: { mediaId: "med_avatar_p1", url: null } } }
    };
    const sender = { uid: "p1", displayName: "Pinguim Um" };
    const char = { id: "ch1", name: "Agente", avatar: { mediaId: "med_char_1", url: null } };

    let writesWhenGrantCalled = -1;
    grantMediaAudienceMock.mockImplementationOnce(async () => {
      writesWhenGrantCalled = fakeDb.writes.length;
      return { updated: true };
    });

    await sendEmoteChatMessage({
      campaignId: "camp1",
      campaign,
      user: sender,
      icon: "wave",
      visibility: "public"
    });
    expect(writesWhenGrantCalled).toBe(0);
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_avatar_p1",
      visibleTo: ["ALL"]
    });

    grantMediaAudienceMock.mockClear();
    await sendTextChatMessage({
      campaignId: "camp1",
      campaign,
      user: sender,
      content: "segredo",
      visibility: "gm_only"
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_avatar_p1",
      visibleTo: ["gm1", "p1"]
    });

    grantMediaAudienceMock.mockClear();
    await sendSkillPingChatMessage({
      campaignId: "camp1",
      campaign,
      user: sender,
      character: char,
      skill: { name: "Furtividade", total: 5 },
      visibility: "gm_only"
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_char_1",
      visibleTo: ["gm1", "p1"]
    });

    grantMediaAudienceMock.mockClear();
    await executeChatRollMessage({
      campaignId: "camp1",
      campaign,
      user: sender,
      character: char,
      title: "Ataque",
      primaryFormula: "1d20+2",
      visibility: "public"
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_char_1",
      visibleTo: ["ALL"]
    });
  });
});

describe("Hooks & Modais Fase 4 — useScenes, useRealtimeTokens, useCharacters, useCompendium", () => {
  it("useScenes grava visibleTo canônico sem visibleToPlayers e concede mídia em mapImage/ambientAudio/activate", async () => {
    fakeDb.collections.set("campaigns/camp1/scenes", [
      {
        id: "scene_hidden",
        name: "Covil",
        visibleTo: ["gm1"],
        mapImage: { mediaId: "med_covil", url: null },
        ambientAudio: { mediaId: "med_bgm_covil", url: null },
        isDeleted: false
      }
    ]);

    const { result } = renderHook(() => useScenes());
    await flushMicrotasks();

    await act(async () => {
      await result.current.createScene({ name: "Praça", isPublic: false });
    });
    const createdScene = fakeDb.writes.find((w) => w.op === "set" && w.path.includes("/scenes/")).payload;
    expect(createdScene.visibleTo).toEqual(["gm1"]);
    expect(createdScene).not.toHaveProperty("visibleToPlayers");

    await act(async () => {
      await result.current.updateScene("scene_hidden", {
        mapImage: { mediaId: "med_novo_mapa", url: null },
        ambientAudio: { mediaId: "med_novo_audio", url: null }
      });
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_novo_mapa",
      visibleTo: ["gm1"]
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_novo_audio",
      visibleTo: ["gm1"]
    });

    grantMediaAudienceMock.mockClear();
    await act(async () => {
      await result.current.activateSceneForTable("scene_hidden");
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_covil",
      visibleTo: ["ALL"]
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_bgm_covil",
      visibleTo: ["ALL"]
    });
    expect(setActiveSceneMock).toHaveBeenCalledWith("scene_hidden");
    const releaseWrite = fakeDb.writes.find(
      (w) => w.op === "update" && w.path === "campaigns/camp1/scenes/scene_hidden" && w.payload.visibleTo
    );
    expect(releaseWrite.payload.visibleTo).toEqual(["ALL"]);
    expect(releaseWrite.payload).not.toHaveProperty("visibleToPlayers");
  });

  it("useSceneTokens inclui gmId e ownerId em tokens ocultos e propaga alteração só de controlledBy", async () => {
    fakeDb.rtdb["vtt_realtime/camp1/hiddenTokens/scene1"] = {
      tok1: {
        id: "tok1",
        kind: "free",
        ownerId: "p_owner",
        layer: "tokens",
        hidden: true,
        label: "Oculto",
        image: { mediaId: "med_tok_hidden" },
        x: 0,
        y: 0,
        sizeInCells: 1,
        rotation: 0,
        ringColor: "#3090f0",
        showName: true,
        rev: 0,
        controlledBy: { p1: true }
      }
    };

    const { result } = renderHook(() => useSceneTokens("scene1"));
    await flushMicrotasks();

    await act(async () => {
      await result.current.createFreeToken({
        label: "Sombra",
        image: { mediaId: "med_tok_new", url: null },
        hidden: true,
        controlledBy: ["p1"]
      });
    });
    expect(grantMediaAudienceMock).not.toHaveBeenCalled();

    grantMediaAudienceMock.mockClear();
    const tok1 = result.current.tokens.find((t) => t.id === "tok1");
    await act(async () => {
      await result.current.updateTokenAdmin(tok1, {
        controlledBy: ["p1", "p2"]
      });
    });
    expect(grantMediaAudienceMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.updateTokenAdmin(tok1, {
        hidden: false
      });
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_tok_hidden",
      visibleTo: ["ALL"]
    });
  });

  it("useCharacters cria pasta de personagem sem scope e propaga mídia ao liberar ficha", async () => {
    fakeDb.collections.set("campaigns/camp1/characters", [
      {
        id: "c_npc",
        name: "Pinguim Misterioso",
        type: "npc",
        ownerId: "gm1",
        visibleTo: ["gm1"],
        editableBy: ["gm1"],
        avatarMediaId: "med_npc_avatar",
        defaultToken: { mediaId: "med_npc_tok" },
        isDeleted: false
      }
    ]);

    const { result } = renderHook(() => useCharacters());
    await flushMicrotasks();

    await act(async () => {
      await result.current.createFolder({ name: "Vilões" });
    });
    const folderWrite = fakeDb.writes.find((w) => w.op === "set" && w.path.includes("/folders/")).payload;
    expect(folderWrite.domain).toBe("character");
    expect(folderWrite).not.toHaveProperty("scope");
    expect(folderWrite.visibleTo.slice().sort()).toEqual(["ALL", "gm1"]);
    expect(setFoldersMock).toHaveBeenCalled();

    await act(async () => {
      await result.current.updateCharacter("c_npc", { visibleTo: ["ALL"] });
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_npc_avatar",
      visibleTo: ["gm1", "ALL"]
    });
    expect(grantMediaAudienceMock).toHaveBeenCalledWith({
      campaignId: "camp1",
      mediaId: "med_npc_tok",
      visibleTo: ["gm1", "ALL"]
    });
  });

  it("useCompendium, CompendiumModal e ScenesManagerModal usam apenas visibilidade canônica (sem visibleToPlayers)", async () => {
    const { result: compHook } = renderHook(() => useCompendium());
    await flushMicrotasks();

    await act(async () => {
      await compHook.current.createEntry({ name: "Bola de Neve", isPublic: false });
    });
    const compSet = fakeDb.writes.find((w) => w.op === "set" && w.path.includes("/compendium/")).payload;
    expect(compSet.visibleTo).toEqual(["gm1"]);
    expect(compSet).not.toHaveProperty("visibleToPlayers");

    const onUpdateEntry = vi.fn(async () => {});
    render(
      <CompendiumModal
        entries={[
          {
            id: "e1",
            name: "Item Legado Falso",
            category: "item",
            visibleTo: ["gm1"],
            visibleToPlayers: true
          }
        ]}
        isGM
        characters={[]}
        activeCharacter={null}
        canEditCharacter={() => false}
        onUpdateCharacter={() => {}}
        onCreateEntry={vi.fn(async () => {})}
        onUpdateEntry={onUpdateEntry}
        onDeleteEntry={vi.fn(async () => {})}
        onClose={() => {}}
      />
    );
    const toggleBtn = screen.getByText("Oculto");
    fireEvent.click(toggleBtn);
    await flushMicrotasks();
    expect(onUpdateEntry).toHaveBeenCalledWith("e1", { isPublic: true });
    expect(onUpdateEntry.mock.calls[0][1]).not.toHaveProperty("visibleToPlayers");

    cleanup();

    const onUpdateScene = vi.fn(async () => {});
    render(
      <ScenesManagerModal
        scenes={[
          {
            id: "s1",
            name: "Dojo Oculto",
            visibleTo: ["gm1"],
            visibleToPlayers: true,
            gridConfig: { size: 64 }
          }
        ]}
        activeSceneId="s1"
        campaignId="camp1"
        isGM
        initialTab="scenes"
        onCreateScene={vi.fn(async () => "s2")}
        onUpdateScene={onUpdateScene}
        onDeleteScene={vi.fn(async () => {})}
        onActivateScene={vi.fn(async () => {})}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("OCULTO")).toBeTruthy();
    fireEvent.click(screen.getByText("Liberar"));
    await flushMicrotasks();
    expect(onUpdateScene).toHaveBeenCalledWith("s1", { isPublic: true });
    expect(onUpdateScene.mock.calls[0][1]).not.toHaveProperty("visibleToPlayers");
  });
});
