import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import CPButton from "../ui/CPButton.jsx";
import AuthErrorBanner from "./AuthErrorBanner.jsx";

export default function VerifyEmailScreen() {
  const {
    user,
    authError,
    resendVerificationEmail,
    refreshCurrentUser,
    logout
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sentFeedback, setSentFeedback] = useState(false);
  const [notVerifiedFeedback, setNotVerifiedFeedback] = useState(false);

  const handleRefresh = async () => {
    setBusy(true);
    setSentFeedback(false);
    setNotVerifiedFeedback(false);
    try {
      const refreshed = await refreshCurrentUser();
      if (refreshed && !refreshed.emailVerified) {
        setNotVerifiedFeedback(true);
      }
    } catch {
      // Erro já registrado no AuthContext
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setSentFeedback(false);
    setNotVerifiedFeedback(false);
    try {
      await resendVerificationEmail();
      setSentFeedback(true);
    } catch {
      // Erro já registrado no AuthContext
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 50%, #004b94 0%, #001f44 100%)",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "28px",
          background:
            "radial-gradient(ellipse at 50% 30%, #0589de 0%, #0070bb 55%, #005098 100%)",
          boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          boxSizing: "border-box"
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#ffffff",
            fontFamily: "'Fredoka', sans-serif",
            fontSize: "22px",
            textAlign: "center"
          }}
        >
          VERIFICAR E-MAIL
        </h2>

        <div
          style={{
            color: "#ffffff",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: "14px",
            textAlign: "center"
          }}
        >
          {user?.email || ""}
        </div>

        {sentFeedback && (
          <div
            style={{
              background: "#e8f5e9",
              border: "2px solid #2e7d32",
              color: "#1b5e20",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              textAlign: "center",
              width: "100%"
            }}
          >
            Link de verificação enviado.
          </div>
        )}

        <AuthErrorBanner
          message={authError || (notVerifiedFeedback ? "E-mail ainda não verificado." : "")}
          style={{ width: "100%" }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%",
            marginTop: "6px"
          }}
        >
          <CPButton
            variant="green"
            disabled={busy}
            onClick={handleRefresh}
            style={{ padding: "10px 16px", fontSize: "14px" }}
          >
            Já verifiquei
          </CPButton>
          <CPButton
            variant="gold"
            disabled={busy}
            onClick={handleResend}
            style={{ padding: "10px 16px", fontSize: "14px" }}
          >
            Reenviar e-mail
          </CPButton>
          <CPButton
            variant="orange"
            disabled={busy}
            onClick={logout}
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Sair
          </CPButton>
        </div>
      </div>
    </div>
  );
}
