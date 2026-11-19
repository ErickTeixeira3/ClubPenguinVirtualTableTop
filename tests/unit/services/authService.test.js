import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";

const firebaseAuthSpies = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  onAuthStateChanged: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn()
}));

const pendingAvatarSpies = vi.hoisted(() => ({
  clearPendingAvatarDataUrl: vi.fn(),
  savePendingAvatarDataUrl: vi.fn()
}));

const presenceSpies = vi.hoisted(() => ({
  disconnectAllActivePresence: vi.fn(async () => {})
}));

vi.mock("firebase/auth", () => firebaseAuthSpies);
vi.mock("../../../src/infra/firebase.js", () => ({
  auth: { currentUser: null },
  googleProvider: { providerId: "google.com" }
}));
vi.mock("../../../src/infra/pendingAvatarStore.js", () => pendingAvatarSpies);
vi.mock("../../../src/services/presenceService.js", () => presenceSpies);

const authService = await import("../../../src/services/authService.js");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authService", () => {
  it("normaliza Firebase User sem spread de objeto nativo", () => {
    const nativeLike = {
      uid: "u1",
      email: "a@b.com",
      emailVerified: true,
      displayName: "Pinguim",
      photoURL: "https://example.invalid/p.png",
      accessToken: "secret-should-not-leak"
    };
    const dto = authService.toAuthUser(nativeLike);
    expect(dto).toEqual({
      uid: "u1",
      email: "a@b.com",
      emailVerified: true,
      displayName: "Pinguim",
      photoURL: "https://example.invalid/p.png"
    });
    expect(dto.accessToken).toBeUndefined();
    expect(authService.toAuthUser(null)).toBeNull();
  });

  it("exige e-mail real no login e recuperação (D-DER-2, sem nickname/@clubpenguin.vtt)", async () => {
    expect(() => authService.normalizeLoginEmail("rockhopper")).toThrow(/e-mail válido/);
    await expect(
      authService.loginWithEmail({ email: "rockhopper", password: "123", authInstance: {} })
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });

    firebaseAuthSpies.signInWithEmailAndPassword.mockResolvedValue({
      user: { uid: "u1", email: "user@example.com", emailVerified: true }
    });
    const user = await authService.loginWithEmail({
      email: "  USER@Example.com  ",
      password: "secret",
      authInstance: {}
    });
    expect(firebaseAuthSpies.signInWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      "user@example.com",
      "secret"
    );
    expect(user.email).toBe("user@example.com");

    await expect(
      authService.sendPasswordReset({ email: "sem-arroba", authInstance: {} })
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_FAILED });
    await authService.sendPasswordReset({ email: " Player@Example.com ", authInstance: {} });
    expect(firebaseAuthSpies.sendPasswordResetEmail).toHaveBeenCalledWith({}, "player@example.com");
  });

  it("cadastro envia e-mail de verificação e não exclui conta recém-criada (D-DER-1)", async () => {
    const deleteSpy = vi.fn();
    const createdUser = {
      uid: "u_new",
      email: "new@example.com",
      emailVerified: false,
      displayName: null,
      photoURL: null,
      delete: deleteSpy
    };
    firebaseAuthSpies.createUserWithEmailAndPassword.mockResolvedValue({ user: createdUser });
    firebaseAuthSpies.updateProfile.mockImplementation(async (u, upd) => {
      u.displayName = upd.displayName;
    });
    firebaseAuthSpies.sendEmailVerification.mockResolvedValue();

    const user = await authService.registerWithEmail({
      email: "New@Example.com",
      password: "password123",
      displayName: "Agente Novo",
      avatarDataUrl: "data:image/webp;base64,ABC",
      authInstance: {}
    });

    expect(firebaseAuthSpies.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      {},
      "new@example.com",
      "password123"
    );
    expect(pendingAvatarSpies.savePendingAvatarDataUrl).toHaveBeenCalledWith(
      "u_new",
      "data:image/webp;base64,ABC"
    );
    expect(firebaseAuthSpies.sendEmailVerification).toHaveBeenCalledWith(createdUser);
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(user).toMatchObject({ uid: "u_new", emailVerified: false, displayName: "Agente Novo" });
  });

  it("reloadCurrentUser força atualização do token ID quando e-mail foi verificado", async () => {
    const getIdToken = vi.fn(async () => "fresh-token");
    const reload = vi.fn(async function () {
      this.emailVerified = true;
    });
    const fakeAuth = {
      currentUser: {
        uid: "u_verif",
        email: "v@example.com",
        emailVerified: false,
        displayName: "Verif",
        photoURL: null,
        reload,
        getIdToken
      }
    };

    const updated = await authService.reloadCurrentUser({ authInstance: fakeAuth });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(updated.emailVerified).toBe(true);

    const getIdTokenUnverif = vi.fn();
    const unverifAuth = {
      currentUser: {
        uid: "u_unverif",
        email: "u@example.com",
        emailVerified: false,
        reload: vi.fn(async () => {}),
        getIdToken: getIdTokenUnverif
      }
    };
    const stillUnverif = await authService.reloadCurrentUser({ authInstance: unverifAuth });
    expect(stillUnverif.emailVerified).toBe(false);
    expect(getIdTokenUnverif).not.toHaveBeenCalled();
  });

  it("logout desconecta presença ativa e limpa avatar pendente antes de signOut", async () => {
    const callOrder = [];
    presenceSpies.disconnectAllActivePresence.mockImplementation(async () => {
      callOrder.push("disconnect");
    });
    firebaseAuthSpies.signOut.mockImplementation(async () => {
      callOrder.push("signOut");
    });

    await authService.logout({ authInstance: { tag: "auth" } });
    expect(pendingAvatarSpies.clearPendingAvatarDataUrl).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["disconnect", "signOut"]);

    presenceSpies.disconnectAllActivePresence.mockRejectedValueOnce(new Error("rtdb-down"));
    await expect(authService.logout({ authInstance: { tag: "auth" } })).rejects.toThrow(
      "rtdb-down"
    );
    expect(firebaseAuthSpies.signOut).toHaveBeenCalledTimes(2);
  });

  it("mapeia erros Firebase Auth apenas pelo código", () => {
    expect(authService.formatAuthError({ code: "auth/wrong-password" })).toBe(
      "E-mail ou senha incorretos."
    );
    expect(authService.formatAuthError({ code: "auth/invalid-credential" })).toBe(
      "E-mail ou senha incorretos."
    );
    expect(authService.formatAuthError({ code: "auth/email-already-in-use" })).toBe(
      "Este e-mail já está em uso."
    );
    expect(authService.formatAuthError({ code: "unknown", message: "raw internal" })).toBe(
      "Erro ao autenticar."
    );
  });
});
