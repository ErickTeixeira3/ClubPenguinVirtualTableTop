// @vitest-environment jsdom
// Regressão portada de auditoria_refatoracao/validar-regressoes.mjs: A10 e A11.
// A11 (ficha alheia só com "ALL" fica fora da lista do jogador) é revisitado na Fase 6 pela D-DER-5
// (seção de fichas compartilhadas por dono).
import { cleanup, renderHook } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, resetFakeDb } from "../support/fakeFirebase.js";

const session = vi.hoisted(() => ({ user: null, campaign: null }));

vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);
vi.mock("../../src/services/mediaService.js", () => ({
  uploadCompressedMedia: async () => ({ mediaId: "med_stub", byteLength: 100 }),
  grantMediaAudience: async () => null
}));
vi.mock("../../src/hooks/useMediaUrl.js", () => ({ useMediaUrl: (_id, externalUrl) => ({ url: externalUrl || null, loading: false }) }));
vi.mock("../../src/contexts/AuthContext.jsx", () => ({ useAuth: () => ({ user: session.user }) }));
vi.mock("../../src/contexts/CampaignContext.jsx", () => ({ useCampaign: () => session.campaign }));

const { useScenes } = await import("../../src/hooks/useScenes.js");
const CharactersSidebarList = (await import("../../src/components/sheets/CharactersSidebarList.jsx")).default;

beforeEach(resetFakeDb);
afterEach(cleanup);

describe("A10: Visão Player do Mestre real", () => {
  it("oculta a cena não liberada mesmo com o uid do Mestre em visibleTo", () => {
    fakeDb.collections.set("campaigns/main-table/scenes", [
      { id: "s_priv", name: "Covil Secreto", visibleTo: ["gm1"], isDeleted: false },
      { id: "s_pub", name: "Praça", visibleTo: ["ALL"], isDeleted: false }
    ]);
    session.user = { uid: "gm1" };
    session.campaign = {
      campaignId: "main-table",
      campaign: { id: "main-table", gmId: "gm1" },
      isRealGM: true,
      isGM: false,
      setActiveScene: async () => {}
    };
    const { result } = renderHook(() => useScenes());
    expect(result.current.scenes.map((s) => s.id)).toEqual(["s_pub"]);
  });
});

describe("A11: lista lateral de fichas do jogador", () => {
  it("mostra a própria e a compartilhada e oculta a alheia só com ALL", () => {
    const html = renderToStaticMarkup(
      <CharactersSidebarList
        campaignId="main-table"
        isGM={false}
        currentUser={{ uid: "player1" }}
        gmId="gm1"
        playersMap={{
          gm1: { uid: "gm1", displayName: "GM" },
          player1: { uid: "player1", displayName: "P1" },
          player2: { uid: "player2", displayName: "P2" }
        }}
        characters={[
          { id: "c_own", name: "Ficha Propria", ownerId: "player1", visibleTo: ["ALL"] },
          { id: "c_shared", name: "Ficha Compartilhada", ownerId: "player2", visibleTo: ["player1", "player2", "gm1"] },
          { id: "c_all_other", name: "Ficha Alheia ALL", ownerId: "player2", visibleTo: ["ALL"] }
        ]}
        folders={[]}
        canEditCharacter={(c) => c.ownerId === "player1"}
        onOpenSheet={() => {}}
      />
    );
    expect(html).toContain("Ficha Propria");
    expect(html).toContain("Ficha Compartilhada");
    expect(html).not.toContain("Ficha Alheia ALL");
  });
});
