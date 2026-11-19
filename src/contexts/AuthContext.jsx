import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import * as authService from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = authService.subscribeAuthState((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError("");
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError("");
    try {
      const nextUser = await authService.loginWithGoogle();
      setUser(nextUser);
      return nextUser;
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const loginWithEmail = useCallback(async (email, password) => {
    setAuthError("");
    try {
      const nextUser = await authService.loginWithEmail({ email, password });
      setUser(nextUser);
      return nextUser;
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const registerWithEmail = useCallback(
    async (email, password, displayName, photoURL = null) => {
      setAuthError("");
      try {
        const nextUser = await authService.registerWithEmail({
          email,
          password,
          displayName,
          avatarDataUrl: photoURL
        });
        setUser(nextUser);
        return nextUser;
      } catch (err) {
        setAuthError(authService.formatAuthError(err));
        throw err;
      }
    },
    []
  );

  const sendPasswordReset = useCallback(async (email) => {
    setAuthError("");
    try {
      await authService.sendPasswordReset({ email });
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    setAuthError("");
    try {
      await authService.resendVerificationEmail();
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    setAuthError("");
    try {
      const refreshed = await authService.reloadCurrentUser();
      if (refreshed) {
        setUser(refreshed);
      }
      return refreshed;
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError("");
    try {
      await authService.logout();
      setUser(null);
    } catch (err) {
      setAuthError(authService.formatAuthError(err));
      throw err;
    }
  }, []);

  const readRememberedEmail = useCallback(
    () => authService.readRememberedEmail(),
    []
  );

  const saveRememberedEmail = useCallback(
    (email) => authService.saveRememberedEmail(email),
    []
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      setAuthError,
      clearAuthError,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      refreshCurrentUser,
      logout,
      readRememberedEmail,
      saveRememberedEmail
    }),
    [
      user,
      loading,
      authError,
      clearAuthError,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      refreshCurrentUser,
      logout,
      readRememberedEmail,
      saveRememberedEmail
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}
