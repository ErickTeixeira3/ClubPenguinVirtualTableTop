import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginScreen() {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    authError,
    setAuthError
  } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerWithEmail(email.trim(), password, displayName);
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch {
      // Erro já registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch {
      // Erro já registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setAuthError("");
    setMode(nextMode);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px"
      }}
    >
      <div className="cp-window" style={{ width: "100%", maxWidth: "410px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 0"
          }}
        >
          <h1 className="cp-title" style={{ fontSize: "28px" }}>
            CLUB PENGUIN VTT
          </h1>
        </div>

        <div className="cp-window-inner">
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px"
            }}
          >
            <button
              type="button"
              className={`cp-btn ${mode === "login" ? "cp-btn-gold" : ""}`}
              style={{ flex: 1 }}
              onClick={() => switchMode("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`cp-btn ${mode === "register" ? "cp-btn-gold" : ""}`}
              style={{ flex: 1 }}
              onClick={() => switchMode("register")}
            >
              Criar Pinguim
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {mode === "register" && (
              <input
                type="text"
                className="cp-input"
                placeholder="Nome do Pinguim"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            )}

            <input
              type="email"
              className="cp-input"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type="password"
              className="cp-input"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {authError && (
              <div
                style={{
                  background: "#ffebee",
                  border: "2px solid #c62828",
                  color: "#b71c1c",
                  borderRadius: "10px",
                  padding: "8px 12px",
                  fontSize: "13px",
                  fontWeight: 700
                }}
              >
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="cp-btn cp-btn-green"
              disabled={submitting}
              style={{ width: "100%", fontSize: "16px", padding: "11px" }}
            >
              {mode === "register" ? "Registrar e Entrar" : "Entrar na Ilha"}
            </button>
          </form>

          <div
            style={{
              height: "2px",
              background: "rgba(0, 27, 58, 0.12)",
              margin: "16px 0"
            }}
          />

          <button
            type="button"
            className="cp-btn"
            disabled={submitting}
            onClick={handleGoogleLogin}
            style={{ width: "100%" }}
          >
            Entrar com Google
          </button>
        </div>
      </div>
    </div>
  );
}

