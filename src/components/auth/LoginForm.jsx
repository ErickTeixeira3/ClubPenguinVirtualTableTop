import AuthErrorBanner from "./AuthErrorBanner.jsx";
import GoogleSignInButton from "./GoogleSignInButton.jsx";

export default function LoginForm({
  email,
  onChangeEmail,
  password,
  onChangePassword,
  rememberMe,
  onChangeRememberMe,
  authError,
  submitting,
  onSubmit,
  onGoogleLogin,
  onOpenForgot,
  onOpenRegister,
  onClearFields
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "584px",
        minHeight: "485px",
        borderRadius: "28px",
        background:
          "radial-gradient(ellipse at 50% 30%, #0589de 0%, #0070bb 55%, #005098 100%)",
        boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
        padding: "36px 32px 32px 32px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      <div
        className="cp-login-postit"
        style={{
          position: "absolute",
          right: "22px",
          top: "185px",
          width: "160px",
          height: "128px",
          background: "linear-gradient(145deg, #fff275 0%, #fde02a 65%, #f0cd17 100%)",
          transform: "rotate(-6deg)",
          boxShadow:
            "3px 6px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          borderRadius: "2px 2px 10px 2px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          boxSizing: "border-box",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 3
        }}
      >
        <span
          style={{
            fontFamily:
              "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive, sans-serif",
            fontWeight: 900,
            fontStyle: "italic",
            color: "#3d2500",
            fontSize: "13.5px",
            lineHeight: 1.18,
            textAlign: "center",
            letterSpacing: "-0.2px",
            textTransform: "uppercase"
          }}
        >
          MANTENHA
          <br />
          SUA SENHA
          <br />
          SECRETA
        </span>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          zIndex: 2
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
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
              htmlFor="cp-login-email"
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
              id="cp-login-email"
              type="email"
              value={email}
              onChange={(e) => onChangeEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              style={{
                width: "220px",
                height: "26px",
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px"
            }}
          >
            <label
              htmlFor="cp-login-password"
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                fontSize: "14px",
                color: "#00081c",
                whiteSpace: "nowrap"
              }}
            >
              Senha:
            </label>
            <input
              id="cp-login-password"
              type="password"
              value={password}
              onChange={(e) => onChangePassword(e.target.value)}
              required
              style={{
                width: "220px",
                height: "26px",
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              marginLeft: "155px",
              marginTop: "2px"
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontFamily: "'Nunito', sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: "#000a20",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => onChangeRememberMe(e.target.checked)}
                style={{
                  width: "15px",
                  height: "15px",
                  background: "#ffffff",
                  border: "2px solid #000c24",
                  borderRadius: "2px",
                  cursor: "pointer",
                  margin: 0
                }}
              />
              Lembrar de mim neste computador
            </label>
          </div>
        </div>

        <AuthErrorBanner
          message={authError}
          style={{ maxWidth: "380px", marginTop: "10px" }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            marginTop: "20px",
            maxWidth: "380px"
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "185px",
              height: "48px",
              borderRadius: "24px",
              border: "2.5px solid #001f4d",
              background:
                "linear-gradient(180deg, #2b95e9 0%, #0070d0 48%, #0050aa 52%, #0066cc 100%)",
              boxShadow:
                "inset 0 2px 2px rgba(255, 255, 255, 0.75), inset 0 -2px 3px rgba(0, 0, 0, 0.35), 0 4px 8px rgba(0, 0, 0, 0.3)",
              color: "#ffffff",
              fontFamily:
                "'Fredoka', 'Burbank Big Condensed', system-ui, sans-serif",
              fontSize: "19px",
              fontWeight: 700,
              textShadow: "0 1px 2px rgba(0, 20, 60, 0.8)",
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              outline: "none",
              transition: "transform 0.1s ease, filter 0.1s ease"
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <GoogleSignInButton
            label="Entrar com Google"
            variant="login"
            disabled={submitting}
            onClick={onGoogleLogin}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "12px",
            marginTop: "16px"
          }}
        >
          <button
            type="button"
            onClick={onOpenForgot}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontFamily: "'Nunito', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
              textDecoration: "none"
            }}
            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Esqueceu sua senha?
          </button>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontFamily: "'Nunito', sans-serif",
                fontSize: "12px",
                fontWeight: 600
              }}
            >
              Não tem um pinguim?
            </span>
            <button
              type="button"
              onClick={onOpenRegister}
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                fontFamily: "'Fredoka', 'Nunito', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                padding: "2px 0",
                textDecoration: "none"
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.textDecoration = "underline")
              }
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Criar uma conta grátis agora
            </button>
          </div>

          <button
            type="button"
            onClick={onClearFields}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontFamily: "'Nunito', sans-serif",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              marginTop: "8px"
            }}
            onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
            onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  );
}
