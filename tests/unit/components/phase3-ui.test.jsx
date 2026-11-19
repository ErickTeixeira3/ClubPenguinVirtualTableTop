// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  auth: {
    user: { uid: "gm1", email: "gm@example.com", emailVerified: true },
    authError: "",
    loginWithGoogle: vi.fn(async () => {}),
    loginWithEmail: vi.fn(async () => {}),
    registerWithEmail: vi.fn(async () => {}),
    sendPasswordReset: vi.fn(async () => {}),
    readRememberedEmail: vi.fn(() => ""),
    saveRememberedEmail: vi.fn(),
    setAuthError: vi.fn(),
    clearAuthError: vi.fn(),
    resendVerificationEmail: vi.fn(async () => {}),
    refreshCurrentUser: vi.fn(async () => {}),
    logout: vi.fn(async () => {})
  },
  campaign: {
    campaignId: "camp1",
    campaign: { id: "camp1", name: "Ilha Secreta", gmId: "gm1" },
    gmId: "gm1",
    isRealGM: true,
    assignGM: vi.fn(async () => {}),
    updateCampaignName: vi.fn(async () => {})
  },
  members: {
    members: [
      { uid: "gm1", displayName: "Mestre", avatar: { mediaId: null, url: null } },
      { uid: "p1", displayName: "Pinguim Um", avatar: { mediaId: null, url: null } }
    ],
    invites: [
      { email: "convite@example.com", defaultDisplayName: "Convidado", acceptedBy: null },
      { email: "p1@example.com", defaultDisplayName: "Pinguim Um", acceptedBy: "p1" }
    ],
    playersMap: {
      gm1: { uid: "gm1", displayName: "Mestre", photoURL: null },
      p1: { uid: "p1", displayName: "Pinguim Um", photoURL: null }
    },
    myMember: { uid: "gm1", displayName: "Mestre", avatar: { mediaId: null, url: "https://example.invalid/a.png" } },
    inviteMember: vi.fn(async () => {}),
    revokeMember: vi.fn(async () => {}),
    revokeInvite: vi.fn(async () => {}),
    updateMyProfile: vi.fn(async () => {})
  },
  presence: {
    onlineUsers: {
      gm1: { online: true }
    }
  },
  compressAvatar: vi.fn(async () => ({ dataUrl: "data:image/webp;base64,AAA" }))
}));

vi.mock("../../../src/contexts/AuthContext.jsx", () => ({
  useAuth: () => spies.auth
}));
vi.mock("../../../src/contexts/CampaignContext.jsx", () => ({
  useCampaign: () => spies.campaign
}));
vi.mock("../../../src/contexts/MembersContext.js", () => ({
  useMembers: () => spies.members
}));
vi.mock("../../../src/contexts/PresenceContext.js", () => ({
  usePresence: () => spies.presence
}));
vi.mock("../../../src/hooks/useAvatarCompression.js", () => ({
  useAvatarCompression: () => spies.compressAvatar
}));
vi.mock("../../../src/hooks/useMediaUrl.js", () => ({
  useMediaUrl: (_id, externalUrl) => ({ url: externalUrl || null, loading: false })
}));

const LoginScreen = (await import("../../../src/components/auth/LoginScreen.jsx")).default;
const VerifyEmailScreen = (await import("../../../src/components/auth/VerifyEmailScreen.jsx")).default;
const GMPanelModal = (await import("../../../src/components/gm/GMPanelModal.jsx")).default;
const PlayerProfileModal = (await import("../../../src/components/layout/PlayerProfileModal.jsx")).default;

beforeEach(() => {
  vi.clearAllMocks();
  spies.campaign.isRealGM = true;
});

afterEach(cleanup);

describe("Fase 3 UI — Auth e VerifyEmailScreen", () => {
  it("LoginScreen envia apenas e-mail normalizado e salva Remember Email sem senha (D-DER-2 / MOD-14)", async () => {
    render(<LoginScreen />);

    const emailInput = screen.getByLabelText("E-mail:");
    const passwordInput = screen.getByLabelText("Senha:");
    const rememberCheckbox = screen.getByLabelText("Lembrar de mim neste computador");

    expect(emailInput.getAttribute("type")).toBe("email");
    fireEvent.change(emailInput, { target: { value: "  Mestre@Example.COM " } });
    fireEvent.change(passwordInput, { target: { value: "senha123" } });
    fireEvent.click(rememberCheckbox);
    fireEvent.click(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(spies.auth.loginWithEmail).toHaveBeenCalledWith("mestre@example.com", "senha123");
    });
    expect(spies.auth.saveRememberedEmail).toHaveBeenCalledWith("mestre@example.com");
  }, 15000);

  it("LoginScreen troca entre recuperar senha (e-mail real) e cadastro", async () => {
    render(<LoginScreen />);

    fireEvent.click(screen.getByText("Esqueceu sua senha?"));
    const resetEmail = screen.getByLabelText("E-mail:");
    fireEvent.change(resetEmail, { target: { value: "Agente@Example.com" } });
    fireEvent.click(screen.getByText("Recuperar Senha"));

    await waitFor(() => {
      expect(spies.auth.sendPasswordReset).toHaveBeenCalledWith("agente@example.com");
    });

    fireEvent.click(screen.getByText("Voltar ao Login"));
    fireEvent.click(screen.getByText("Criar uma conta grátis agora"));
    expect(screen.getByText("CRIAR PINGUIM")).toBeTruthy();
  }, 15000);

  it("VerifyEmailScreen permite atualizar verificação, reenviar e-mail e sair", async () => {
    render(<VerifyEmailScreen />);
    expect(screen.getByText("VERIFICAR E-MAIL")).toBeTruthy();
    expect(screen.getByText("gm@example.com")).toBeTruthy();

    spies.auth.refreshCurrentUser.mockResolvedValueOnce({
      uid: "gm1",
      email: "gm@example.com",
      emailVerified: false
    });
    fireEvent.click(screen.getByRole("button", { name: "Já verifiquei" }));
    await waitFor(() => {
      expect(spies.auth.refreshCurrentUser).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("E-mail ainda não verificado.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar e-mail" }));
    await waitFor(() => {
      expect(spies.auth.resendVerificationEmail).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("E-mail ainda não verificado.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(spies.auth.logout).toHaveBeenCalledTimes(1);
  });
});

describe("Fase 3 UI — GMPanelModal e PlayerProfileModal", () => {
  it("GMPanelModal não exibe seletor de role no convite e exige confirmação ao revogar/delegar", async () => {
    render(<GMPanelModal onClose={vi.fn()} />);

    expect(screen.queryByRole("combobox")).toBeNull();

    // Enviar convite sem seletor de papel
    fireEvent.change(screen.getByPlaceholderText("E-mail (Google ou Conta)"), {
      target: { value: "novo@example.com" }
    });
    fireEvent.change(screen.getByPlaceholderText("Nome do Jogador"), {
      target: { value: "Novo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));
    await waitFor(() => {
      expect(spies.members.inviteMember).toHaveBeenCalledWith({
        email: "novo@example.com",
        defaultDisplayName: "Novo"
      });
    });

    // Confirmar delegação de Mestre
    fireEvent.click(screen.getByRole("button", { name: "Definir Mestre" }));
    expect(spies.campaign.assignGM).not.toHaveBeenCalled();
    const dialogButtons = screen.getAllByRole("button", { name: "Definir Mestre" });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    await waitFor(() => {
      expect(spies.campaign.assignGM).toHaveBeenCalledWith("p1");
    });

    // Confirmar revogação de convite e membro
    const removeButtons = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(removeButtons[0]); // convite pendente
    const confirmRemove = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(confirmRemove[confirmRemove.length - 1]);
    await waitFor(() => {
      expect(spies.members.revokeInvite).toHaveBeenCalledWith("convite@example.com");
    });

    const removeButtonsAfter = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(removeButtonsAfter[1]); // membro p1
    const confirmRemoveMember = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(confirmRemoveMember[confirmRemoveMember.length - 1]);
    await waitFor(() => {
      expect(spies.members.revokeMember).toHaveBeenCalledWith("p1");
    });
  }, 15000);

  it("PlayerProfileModal deriva badge MESTRE/JOGADOR de isRealGM e remove foto via avatarAction", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<PlayerProfileModal onClose={onClose} />);
    expect(screen.getByText("MESTRE")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar Perfil" }));

    await waitFor(() => {
      expect(spies.members.updateMyProfile).toHaveBeenCalledWith({
        displayName: "Mestre",
        avatarAction: "remove"
      });
    });

    spies.campaign.isRealGM = false;
    rerender(<PlayerProfileModal onClose={onClose} />);
    expect(screen.getByText("JOGADOR")).toBeTruthy();
  });
});
