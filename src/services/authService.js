import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import { localStore } from "../infra/browserStorage.js";
import { auth, googleProvider } from "../infra/firebase.js";
import {
  clearPendingAvatarDataUrl,
  savePendingAvatarDataUrl
} from "../infra/pendingAvatarStore.js";
import { disconnectAllActivePresence } from "./presenceService.js";

const REMEMBER_EMAIL_STORAGE_KEY = "auth:remember_email";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toAuthUser(firebaseUser) {
  if (!firebaseUser) return null;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || null,
    emailVerified: Boolean(firebaseUser.emailVerified),
    displayName: firebaseUser.displayName || null,
    photoURL: firebaseUser.photoURL || null
  };
}

export function normalizeLoginEmail(email) {
  const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(clean)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Informe um e-mail válido."
    );
  }
  return clean;
}

export function formatAuthError(error) {
  const code = error?.code || "";
  switch (code) {
    case ERROR_CODES.VALIDATION_FAILED:
    case ERROR_CODES.PERMISSION_DENIED:
    case ERROR_CODES.CLIENT_OUTDATED:
      return error.message;
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    case "auth/popup-closed-by-user":
      return "Janela de login fechada antes de concluir.";
    case "auth/operation-not-allowed":
      return "Método de login ainda não habilitado no Firebase Console.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns instantes e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de conexão ao autenticar. Verifique sua internet.";
    case "auth/user-disabled":
      return "Esta conta foi desativada.";
    default:
      return "Erro ao autenticar.";
  }
}

export function readRememberedEmail() {
  const saved = localStore.getRaw(REMEMBER_EMAIL_STORAGE_KEY);
  return saved && EMAIL_PATTERN.test(saved) ? saved : "";
}

export function saveRememberedEmail(email) {
  const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!clean) {
    localStore.remove(REMEMBER_EMAIL_STORAGE_KEY);
    return;
  }
  if (EMAIL_PATTERN.test(clean)) {
    localStore.setRaw(REMEMBER_EMAIL_STORAGE_KEY, clean);
  }
}

export function subscribeAuthState(callback, { authInstance = auth } = {}) {
  return onAuthStateChanged(authInstance, (currentUser) => {
    callback(toAuthUser(currentUser));
  });
}

export async function loginWithGoogle({
  authInstance = auth,
  provider = googleProvider
} = {}) {
  clearPendingAvatarDataUrl();
  const result = await signInWithPopup(authInstance, provider);
  return toAuthUser(result.user);
}

export async function loginWithEmail({
  email,
  password,
  authInstance = auth
}) {
  clearPendingAvatarDataUrl();
  const cleanEmail = normalizeLoginEmail(email);
  const result = await signInWithEmailAndPassword(
    authInstance,
    cleanEmail,
    password
  );
  return toAuthUser(result.user);
}

export async function registerWithEmail({
  email,
  password,
  displayName = "",
  avatarDataUrl = null,
  authInstance = auth
}) {
  clearPendingAvatarDataUrl();
  const cleanEmail = normalizeLoginEmail(email);
  const result = await createUserWithEmailAndPassword(
    authInstance,
    cleanEmail,
    password
  );

  if (typeof avatarDataUrl === "string" && avatarDataUrl.startsWith("data:")) {
    savePendingAvatarDataUrl(result.user.uid, avatarDataUrl);
  }

  const cleanName = typeof displayName === "string" ? displayName.trim() : "";
  if (cleanName) {
    await updateProfile(result.user, { displayName: cleanName });
  }

  await sendEmailVerification(result.user);

  return toAuthUser(result.user);
}

export async function sendPasswordReset({ email, authInstance = auth }) {
  const cleanEmail = normalizeLoginEmail(email);
  await sendPasswordResetEmail(authInstance, cleanEmail);
}

export async function resendVerificationEmail({ authInstance = auth } = {}) {
  if (!authInstance.currentUser) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Faça login antes de reenviar o e-mail de verificação."
    );
  }
  await sendEmailVerification(authInstance.currentUser);
}

export async function reloadCurrentUser({ authInstance = auth } = {}) {
  if (!authInstance.currentUser) {
    return null;
  }
  await authInstance.currentUser.reload();
  if (
    authInstance.currentUser.emailVerified &&
    typeof authInstance.currentUser.getIdToken === "function"
  ) {
    await authInstance.currentUser.getIdToken(true);
  }
  return toAuthUser(authInstance.currentUser);
}

export async function logout({ authInstance = auth } = {}) {
  clearPendingAvatarDataUrl();
  try {
    await disconnectAllActivePresence();
  } finally {
    await signOut(authInstance);
  }
}
