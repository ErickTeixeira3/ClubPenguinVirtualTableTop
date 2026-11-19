import AuthErrorBanner from "./AuthErrorBanner.jsx";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

export default function RegisterForm({
  displayName,
  onChangeDisplayName,
  email,
  onChangeEmail,
  password,
  onChangePassword,
  showPassword,
  onToggleShowPassword,
  photoURL,
  termsAccepted,
  onChangeTermsAccepted,
  fileInputRef,
  onPhotoUpload,
  authError,
  submitting,
  onSubmit,
  onGoogleLogin,
  onBackToLogin
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "920px",
        minHeight: "560px",
        borderRadius: "28px",
        background: "#0072cb",
        boxShadow: "0 18px 46px rgba(0, 0, 0, 0.45)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "2px solid rgba(255, 255, 255, 0.15)"
        }}
      >
        <button
          type="button"
          onClick={onBackToLogin}
          title="Voltar ao login"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "3px solid #ffffff",
            background: "#00569e",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
            outline: "none"
          }}
        >
          ❮
        </button>

        <h1
          style={{
            margin: 0,
            color: "#ffffff",
            fontFamily: "'Fredoka', 'Burbank Big Condensed', sans-serif",
            fontSize: "22px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            textShadow: "0 2px 4px rgba(0, 20, 60, 0.6)"
          }}
        >
          CRIAR PINGUIM
        </h1>

        <button
          type="button"
          onClick={onBackToLogin}
          title="Fechar"
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "3px solid #ffffff",
            background: "#00569e",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
            outline: "none"
          }}
        >
          ✕
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={onPhotoUpload}
      />

      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "28px",
          padding: "24px 36px 36px 36px",
          alignItems: "center",
          flex: 1
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "18px"
          }}
        >
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: "relative",
              width: "230px",
              height: "230px",
              borderRadius: "50%",
              border: "7px solid #00569e",
              background: photoURL
                ? `url(${photoURL}) center/cover no-repeat`
                : "radial-gradient(circle, #008be3 0%, #004b90 100%)",
              boxShadow:
                "0 8px 24px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.35)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              overflow: "hidden",
              transition: "transform 0.15s ease",
              userSelect: "none"
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            title="Clique para escolher a foto do seu pinguim"
          >
            {!photoURL && (
              <>
                <svg
                  width="54"
                  height="54"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    opacity: 0.95,
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))"
                  }}
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span
                  style={{
                    color: "#ffffff",
                    fontFamily: "'Fredoka', sans-serif",
                    fontSize: "14px",
                    fontWeight: 700,
                    marginTop: "8px",
                    textShadow: "0 2px 4px rgba(0, 20, 60, 0.6)"
                  }}
                >
                  ENVIAR SUA FOTO
                </span>
              </>
            )}

            {photoURL && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(0, 25, 60, 0.72)",
                  color: "#ffffff",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: "11px",
                  fontWeight: 800,
                  textAlign: "center",
                  padding: "5px 0"
                }}
              >
                Trocar Foto
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "320px"
            }}
          >
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <div
                style={{
                  background: "#ffae19",
                  color: "#001b3a",
                  borderRadius: "10px",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: 800,
                  fontFamily: "'Nunito', sans-serif",
                  textAlign: "center",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.25)"
                }}
              >
                Seu Pinguim necessita de um nome!
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: "-6px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 0,
                  height: 0,
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "6px solid #ffae19"
                }}
              />
            </div>

            <div style={{ position: "relative", width: "100%" }}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => onChangeDisplayName(e.target.value)}
                placeholder="Nome do Pinguim"
                required
                style={{
                  width: "100%",
                  height: "44px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "2.5px solid #ffae19",
                  color: "#001b3a",
                  fontFamily: "'Fredoka', 'Nunito', sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  textAlign: "center",
                  padding: "0 36px 0 16px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              {displayName && (
                <button
                  type="button"
                  onClick={() => onChangeDisplayName("")}
                  title="Limpar nome"
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#ffae19",
                    fontSize: "18px",
                    fontWeight: 900,
                    cursor: "pointer",
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            width: "100%",
            maxWidth: "420px"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                color: "#ffffff",
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textAlign: "center"
              }}
            >
              CRIAR SENHA
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
              placeholder="SENHA"
              required
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "2px solid #003366",
                color: "#001b3a",
                fontFamily: "'Nunito', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
            <div style={{ display: "flex", justifyContent: "center", marginTop: "2px" }}>
              <button
                type="button"
                onClick={onToggleShowPassword}
                style={{
                  background: "#003366",
                  border: "none",
                  borderRadius: "14px",
                  color: "#ffffff",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "4px 18px",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                MOSTRAR SENHA: {showPassword ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span
              style={{
                color: "#ffffff",
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "13px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textAlign: "center"
              }}
            >
              SEU E-MAIL
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              placeholder="SEU E-MAIL"
              required
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "14px",
                background: "#ffffff",
                border: "2px solid #003366",
                color: "#001b3a",
                fontFamily: "'Nunito', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
              userSelect: "none"
            }}
          >
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => onChangeTermsAccepted(e.target.checked)}
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                border: "2px solid #ffffff",
                background: "#ffffff",
                cursor: "pointer",
                flexShrink: 0,
                marginTop: "2px"
              }}
            />
            <span
              style={{
                color: "#ffe600",
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                fontSize: "12.5px",
                lineHeight: "1.35",
                textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)"
              }}
            >
              Eu concordo em não destruir o site do meu mestre, me divertir com a campanha e não tentar enforcar nenhum civil que já está amedrontado
            </span>
          </label>

          <AuthErrorBanner message={authError} />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginTop: "8px"
            }}
          >
            <button
              type="submit"
              disabled={submitting || !termsAccepted}
              style={{
                width: "100%",
                height: "52px",
                borderRadius: "26px",
                border: "none",
                background: termsAccepted
                  ? "linear-gradient(180deg, #00b4d8 0%, #0077b6 100%)"
                  : "#206680",
                color: termsAccepted ? "#ffffff" : "#4a9cb5",
                fontFamily: "'Fredoka', sans-serif",
                fontSize: "18px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textShadow: termsAccepted
                  ? "0 2px 4px rgba(0, 20, 60, 0.6)"
                  : "none",
                boxShadow: termsAccepted
                  ? "0 4px 14px rgba(0, 0, 0, 0.35)"
                  : "none",
                cursor: submitting || !termsAccepted ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                outline: "none"
              }}
            >
              {submitting ? "CRIANDO..." : "CRIAR SEU PINGUIM"}
            </button>

            <GoogleSignInButton
              label="Ou crie com sua conta Google"
              variant="register"
              disabled={submitting}
              onClick={onGoogleLogin}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
