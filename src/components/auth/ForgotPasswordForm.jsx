import AuthErrorBanner from "./AuthErrorBanner.jsx";

export default function ForgotPasswordForm({
  email,
  onChangeEmail,
  resetSent,
  authError,
  submitting,
  onSubmit,
  onBackToLogin
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "584px",
        minHeight: "380px",
        borderRadius: "28px",
        background:
          "radial-gradient(ellipse at 50% 30%, #0589de 0%, #0070bb 55%, #005098 100%)",
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
        padding: "36px 32px 32px 32px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box"
      }}
    >
      <h2
        style={{
          margin: "0 0 16px 0",
          color: "#ffffff",
          fontFamily: "'Fredoka', sans-serif",
          fontSize: "22px",
          textAlign: "center"
        }}
      >
        RECUPERAR SENHA
      </h2>

      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: 1
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "100%",
            maxWidth: "380px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px"
            }}
          >
            <label
              htmlFor="cp-forgot-email"
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                color: "#00081c",
                whiteSpace: "nowrap"
              }}
            >
              E-mail:
            </label>
            <input
              id="cp-forgot-email"
              type="email"
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              required
              style={{
                width: "220px",
                height: "28px",
                background: "#ffffff",
                border: "2px solid #000c24",
                borderRadius: "2px",
                fontFamily: "'Nunito', sans-serif",
                fontSize: "14px",
                fontWeight: 700,
                color: "#000a20",
                padding: "2px 8px",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>

        {resetSent && (
          <div
            style={{
              background: "#e8f5e9",
              border: "2px solid #2e7d32",
              color: "#1b5e20",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              maxWidth: "380px",
              marginTop: "12px",
              textAlign: "center"
            }}
          >
            E-mail de recuperação enviado! Verifique sua caixa de entrada.
          </div>
        )}

        <AuthErrorBanner
          message={authError}
          style={{ maxWidth: "380px", marginTop: "10px" }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            marginTop: "24px",
            maxWidth: "380px"
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "200px",
              height: "46px",
              borderRadius: "24px",
              border: "2.5px solid #001f4d",
              background:
                "linear-gradient(180deg, #2b95e9 0%, #0070d0 48%, #0050aa 52%, #0066cc 100%)",
              boxShadow:
                "inset 0 2px 2px rgba(255, 255, 255, 0.75), inset 0 -2px 3px rgba(0, 0, 0, 0.35), 0 4px 8px rgba(0, 0, 0, 0.3)",
              color: "#ffffff",
              fontFamily:
                "'Fredoka', 'Burbank Big Condensed', system-ui, sans-serif",
              fontSize: "16px",
              fontWeight: 700,
              textShadow: "0 1px 2px rgba(0, 20, 60, 0.8)",
              cursor: submitting ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? "Enviando..." : "Recuperar Senha"}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontFamily: "'Nunito', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "12px"
            }}
          >
            Voltar ao Login
          </button>
        </div>
      </form>
    </div>
  );
}
