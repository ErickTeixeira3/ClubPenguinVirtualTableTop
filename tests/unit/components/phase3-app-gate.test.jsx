// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auth: {
    user: null,
    loading: false,
    logout: vi.fn(async () => {})
  },
  runtime: {
    updateRequired: false,
    runtimeConfig: { minClientVersion: "2.1.0" },
    clientVersion: "2.0.0",
    requestReload: vi.fn(async ({ confirmDiscard }) => {
      await confirmDiscard?.();
    })
  },
  campaign: {
    campaignId: "camp1",
    campaign: { id: "camp1", name: "Mesa" },
    campaignLoading: false,
    firestoreError: null,
    membershipDenied: false,
    canCreateCampaign: false,
    createCampaign: vi.fn(async () => {}),
    retryMembership: vi.fn(async () => {})
  },
  mounts: [],
  unmounts: []
}));

vi.mock("../../../src/services/campaignService.js", () => ({
  DEFAULT_CAMPAIGN_ID: "main-table",
  resolveInitialCampaignId: () => "main-table",
  saveActiveCampaignId: vi.fn()
}));
vi.mock("../../../src/contexts/AuthContext.jsx", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => state.auth
}));
vi.mock("../../../src/contexts/RuntimeConfigProvider.jsx", () => ({
  default: ({ children }) => children
}));
vi.mock("../../../src/contexts/RuntimeConfigContext.js", () => ({
  useRuntimeConfig: () => state.runtime,
  useOptionalRuntimeConfig: () => state.runtime
}));
vi.mock("../../../src/contexts/CampaignContext.jsx", () => ({
  CampaignProvider: ({ campaignId, children }) => {
    useEffect(() => {
      state.mounts.push(campaignId);
      return () => state.unmounts.push(campaignId);
    }, [campaignId]);
    return children;
  },
  useCampaign: () => state.campaign
}));
vi.mock("../../../src/contexts/MembersProvider.jsx", () => ({
  default: ({ children }) => children
}));
vi.mock("../../../src/contexts/PresenceProvider.jsx", () => ({
  default: ({ children }) => children
}));
vi.mock("../../../src/components/auth/LoginScreen.jsx", () => ({
  default: () => <div>LOGIN_SCREEN</div>
}));
vi.mock("../../../src/components/auth/VerifyEmailScreen.jsx", () => ({
  default: () => <div>VERIFY_EMAIL_SCREEN</div>
}));
vi.mock("../../../src/components/layout/VTTLayout.jsx", () => ({
  default: () => <div>VTT_LAYOUT</div>
}));
vi.mock("../../../src/components/ui/Toast.jsx", () => ({
  default: () => null
}));

const { AppContent } = await import("../../../src/App.jsx");

beforeEach(() => {
  vi.clearAllMocks();
  state.mounts = [];
  state.unmounts = [];
  state.auth.user = null;
  state.auth.loading = false;
  state.runtime.updateRequired = false;
  state.campaign.campaignLoading = false;
  state.campaign.membershipDenied = false;
  state.campaign.canCreateCampaign = false;
  state.campaign.campaign = { id: "camp1", name: "Mesa" };
});

afterEach(cleanup);

describe("AppContent gates (Fase 3)", () => {
  it("exibe LoginScreen sem usuário, VerifyEmailScreen sem verificação e AccessDenied quando não membro", () => {
    const { rerender } = render(<AppContent campaignId="camp1" onSwitchCampaign={vi.fn()} />);
    expect(screen.getByText("LOGIN_SCREEN")).toBeTruthy();

    state.auth.user = { uid: "u1", email: "u1@example.com", emailVerified: false };
    rerender(<AppContent campaignId="camp1" onSwitchCampaign={vi.fn()} />);
    expect(screen.getByText("VERIFY_EMAIL_SCREEN")).toBeTruthy();

    state.auth.user = { uid: "u1", email: "u1@example.com", emailVerified: true };
    state.campaign.membershipDenied = true;
    state.campaign.campaign = null;
    state.campaign.firestoreError = "Sem convite.";
    rerender(<AppContent campaignId="camp1" onSwitchCampaign={vi.fn()} />);
    expect(screen.getByText("ACESSO RESTRITO")).toBeTruthy();
    expect(screen.getByText("Sem convite.")).toBeTruthy();
  });

  it("exibe CreateCampaignCard para platformAdmin quando campanha não existe e cria campanha", async () => {
    state.auth.user = { uid: "admin1", email: "admin@example.com", emailVerified: true };
    state.campaign.campaignId = "nova-mesa";
    state.campaign.canCreateCampaign = true;
    state.campaign.campaign = null;

    render(<AppContent campaignId="nova-mesa" onSwitchCampaign={vi.fn()} />);
    expect(screen.getByText("NOVA CAMPANHA")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Nome da Campanha"), {
      target: { value: "Expedição Polar" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar Campanha" }));

    await waitFor(() => {
      expect(state.campaign.createCampaign).toHaveBeenCalledWith({
        name: "Expedição Polar",
        targetCampaignId: "nova-mesa"
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(state.campaign.retryMembership).toHaveBeenCalledTimes(1);
  });

  it("remonta CampaignProvider por key uid:campaignId e exibe RuntimeReloadGate com confirmação", async () => {
    state.auth.user = { uid: "u1", email: "u1@example.com", emailVerified: true };
    state.runtime.updateRequired = true;

    const { rerender } = render(<AppContent campaignId="camp1" onSwitchCampaign={vi.fn()} />);
    expect(screen.getByText("VTT_LAYOUT")).toBeTruthy();
    expect(screen.getByText("ATUALIZAÇÃO NECESSÁRIA")).toBeTruthy();
    expect(screen.getByText("v2.0.0 → v2.1.0")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Recarregar" }));
    await waitFor(() => {
      expect(state.runtime.requestReload).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Alterações não salvas")).toBeTruthy();

    rerender(<AppContent campaignId="camp2" onSwitchCampaign={vi.fn()} />);
    expect(state.unmounts).toEqual(["camp1"]);
    expect(state.mounts).toEqual(["camp1", "camp2"]);
  });
});
