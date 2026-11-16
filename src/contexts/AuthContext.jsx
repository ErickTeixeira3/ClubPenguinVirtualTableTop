import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";
import { checkIsEmailAuthorized } from "../constants/authorizedUsers";
import {
  clearPendingAvatarDataUrl,
  savePendingAvatarDataUrl
} from "../utils/stringUtils";

const AuthContext = createContext(null);

function formatAuthError(error) {
  const code = error?.code || "";
  if (error?.message && error.message.includes("Acesso restrito")) {
    return error.message;
  }
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos.";
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    case "auth/popup-closed-by-user":
      return "Janela de login fechada antes de concluir.";
    case "auth/operation-not-allowed":
      return "Método de login ainda não habilitado no Firebase Console.";
    default:
      return error?.message || "Erro ao autenticar.";
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser?.email) {
        const isAuth = await checkIsEmailAuthorized(currentUser.email);
        if (!isAuth) {
          clearPendingAvatarDataUrl();
          await signOut(auth);
          setUser(null);
          setAuthError("Acesso restrito: este e-mail não está autorizado nesta mesa.");
          setLoading(false);
          return;
        }
      } else {
        clearPendingAvatarDataUrl();
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError("");
    clearPendingAvatarDataUrl();
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const isAuth = await checkIsEmailAuthorized(result.user.email);
      if (!isAuth) {
        clearPendingAvatarDataUrl();
        await signOut(auth);
        const err = new Error("Acesso restrito: este e-mail não está autorizado nesta mesa.");
        setAuthError(err.message);
        throw err;
      }
      return result.user;
    } catch (err) {
      clearPendingAvatarDataUrl();
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email, password) => {
    setAuthError("");
    clearPendingAvatarDataUrl();
    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const isAuth = await checkIsEmailAuthorized(result.user.email);
      if (!isAuth) {
        clearPendingAvatarDataUrl();
        await signOut(auth);
        const err = new Error("Acesso restrito: este e-mail não está autorizado nesta mesa.");
        setAuthError(err.message);
        throw err;
      }
      return result.user;
    } catch (err) {
      clearPendingAvatarDataUrl();
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const registerWithEmail = async (email, password, displayName, photoURL = null) => {
    setAuthError("");
    clearPendingAvatarDataUrl();
    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const isAuth = await checkIsEmailAuthorized(result.user.email);
      if (!isAuth) {
        clearPendingAvatarDataUrl();
        try {
          await result.user.delete();
        } catch {
          await signOut(auth);
        }
        const err = new Error("Acesso restrito: este e-mail não está autorizado nesta mesa.");
        setAuthError(err.message);
        throw err;
      }
      const isDataUrlPhoto =
        typeof photoURL === "string" && photoURL.startsWith("data:");
      const isHttpPhoto =
        typeof photoURL === "string" &&
        /^https?:\/\//i.test(photoURL) &&
        photoURL.length < 2000;

      if (isDataUrlPhoto) {
        savePendingAvatarDataUrl(result.user.uid, photoURL);
      }

      if (displayName?.trim() || isHttpPhoto) {
        await updateProfile(result.user, {
          ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
          ...(isHttpPhoto ? { photoURL } : {})
        });
        setUser({
          ...result.user,
          displayName: displayName?.trim() || result.user.displayName,
          photoURL: isHttpPhoto ? photoURL : result.user.photoURL
        });
      }
      return result.user;
    } catch (err) {
      clearPendingAvatarDataUrl();
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError("");
    clearPendingAvatarDataUrl();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}
