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

const AuthContext = createContext(null);

function formatAuthError(error) {
  const code = error?.code || "";
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setAuthError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const loginWithEmail = async (email, password) => {
    setAuthError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const registerWithEmail = async (email, password, displayName) => {
    setAuthError("");
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName?.trim()) {
        await updateProfile(result.user, {
          displayName: displayName.trim()
        });
        setUser({ ...result.user, displayName: displayName.trim() });
      }
      return result.user;
    } catch (err) {
      const msg = formatAuthError(err);
      setAuthError(msg);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError("");
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

