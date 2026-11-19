import { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useAvatarCompression } from "../../hooks/useAvatarCompression.js";
import ForgotPasswordForm from "./ForgotPasswordForm.jsx";
import LoginForm from "./LoginForm.jsx";
import RegisterForm from "./RegisterForm.jsx";

export default function LoginScreen() {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    readRememberedEmail,
    saveRememberedEmail,
    authError,
    setAuthError,
    clearAuthError
  } = useAuth();
  const compressAvatar = useAvatarCompression();

  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'

  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => Boolean(readRememberedEmail()));

  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPhotoURL, setRegisterPhotoURL] = useState(null);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    clearAuthError();

    try {
      const cleanEmail = email.trim().toLowerCase();
      await loginWithEmail(cleanEmail, password);
      saveRememberedEmail(rememberMe ? cleanEmail : "");
    } catch {
      // Erro registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressAvatar(file);
      setRegisterPhotoURL(compressed.dataUrl);
    } catch (err) {
      setAuthError(err?.message || "Erro ao processar imagem.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerEmail.trim() || !registerPassword) return;
    if (!termsAccepted) {
      setAuthError(
        "Você precisa concordar com os termos para criar seu pinguim."
      );
      return;
    }

    setSubmitting(true);
    clearAuthError();

    try {
      await registerWithEmail(
        registerEmail.trim().toLowerCase(),
        registerPassword,
        registerDisplayName.trim() || registerEmail.split("@")[0],
        registerPhotoURL || null
      );
    } catch {
      // Erro registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    clearAuthError();
    setResetSent(false);

    try {
      await sendPasswordReset(email.trim().toLowerCase());
      setResetSent(true);
    } catch {
      // Erro registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    clearAuthError();
    try {
      await loginWithGoogle();
    } catch {
      // Erro registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    clearAuthError();
    setResetSent(false);
    setMode(nextMode);
  };

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 50%, #004b94 0%, #001f44 100%)",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      {mode === "login" && (
        <LoginForm
          email={email}
          onChangeEmail={setEmail}
          password={password}
          onChangePassword={setPassword}
          rememberMe={rememberMe}
          onChangeRememberMe={setRememberMe}
          authError={authError}
          submitting={submitting}
          onSubmit={handleLoginSubmit}
          onGoogleLogin={handleGoogleLogin}
          onOpenForgot={() => switchMode("forgot")}
          onOpenRegister={() => switchMode("register")}
          onClearFields={() => {
            setEmail("");
            setPassword("");
            clearAuthError();
          }}
        />
      )}

      {mode === "register" && (
        <RegisterForm
          displayName={registerDisplayName}
          onChangeDisplayName={setRegisterDisplayName}
          email={registerEmail}
          onChangeEmail={setRegisterEmail}
          password={registerPassword}
          onChangePassword={setRegisterPassword}
          showPassword={showRegisterPassword}
          onToggleShowPassword={() => setShowRegisterPassword((prev) => !prev)}
          photoURL={registerPhotoURL}
          termsAccepted={termsAccepted}
          onChangeTermsAccepted={setTermsAccepted}
          fileInputRef={fileInputRef}
          onPhotoUpload={handlePhotoUpload}
          authError={authError}
          submitting={submitting}
          onSubmit={handleRegisterSubmit}
          onGoogleLogin={handleGoogleLogin}
          onBackToLogin={() => switchMode("login")}
        />
      )}

      {mode === "forgot" && (
        <ForgotPasswordForm
          email={email}
          onChangeEmail={setEmail}
          resetSent={resetSent}
          authError={authError}
          submitting={submitting}
          onSubmit={handleForgotSubmit}
          onBackToLogin={() => switchMode("login")}
        />
      )}
    </div>
  );
}
