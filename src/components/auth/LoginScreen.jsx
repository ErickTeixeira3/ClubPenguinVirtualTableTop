import { useEffect, useRef, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "../../contexts/AuthContext";
import { DEFAULT_AUTHORIZED_USERS } from "../../constants/authorizedUsers";
import { auth } from "../../services/firebase";
import { compressImageToWebP } from "../../engines/imageCompressor";

export default function LoginScreen() {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    authError,
    setAuthError
  } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'

  // Estados de Login
  const [penguinNameOrEmail, setPenguinNameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);

  // Estados de Cadastro (Criar Pinguim)
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPhotoURL, setRegisterPhotoURL] = useState(null);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Carrega credenciais salvas se "Lembrar de mim" ou "Lembrar senha" estiverem marcados
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("cp_remember_penguin");
      if (savedUser) {
        setPenguinNameOrEmail(savedUser);
        setRememberMe(true);
      }
      const savedPwd = localStorage.getItem("cp_remember_pwd");
      if (savedPwd) {
        setPassword(atob(savedPwd));
        setRememberPassword(true);
      }
    } catch {
      // Ignora falhas de parse
    }
  }, []);

  // Resolve nome do pinguim para e-mail caso o usuário tenha digitado o username
  const resolveEmail = (input) => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) return trimmed.toLowerCase();

    const matched = DEFAULT_AUTHORIZED_USERS.find(
      (u) => u.defaultDisplayName?.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) return matched.email.toLowerCase();

    // Fallback: se não tiver @, monta no domínio padrão
    return `${trimmed.toLowerCase().replace(/\s+/g, "")}@clubpenguin.vtt`;
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!penguinNameOrEmail.trim() || !password) return;

    setSubmitting(true);
    setAuthError("");

    const targetEmail = resolveEmail(penguinNameOrEmail);

    try {
      await loginWithEmail(targetEmail, password);

      // Salva ou remove preferências nos checkboxes
      if (rememberMe) {
        localStorage.setItem("cp_remember_penguin", penguinNameOrEmail.trim());
      } else {
        localStorage.removeItem("cp_remember_penguin");
      }

      if (rememberPassword) {
        localStorage.setItem("cp_remember_pwd", btoa(password));
      } else {
        localStorage.removeItem("cp_remember_pwd");
      }
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
      const compressed = await compressImageToWebP(file, "avatar");
      setRegisterPhotoURL(compressed.dataUrl);
    } catch {
      setAuthError("Erro ao processar imagem.");
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
      setAuthError("Você precisa concordar com os termos para criar seu pinguim.");
      return;
    }

    setSubmitting(true);
    setAuthError("");

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
    if (!penguinNameOrEmail.trim()) return;

    setSubmitting(true);
    setAuthError("");
    setResetSent(false);

    try {
      const targetEmail = resolveEmail(penguinNameOrEmail);
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSent(true);
    } catch (err) {
      setAuthError(err?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setAuthError("");
    try {
      await loginWithGoogle();
    } catch {
      // Erro registrado no AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode) => {
    setAuthError("");
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
        background: "radial-gradient(ellipse at 50% 50%, #004b94 0%, #001f44 100%)",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      {/* ======================================================== */}
      {/* TELA 1: LOGIN (Modelo Fiel com Post-it) */}
      {/* ======================================================== */}
      {mode === "login" && (
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
          {/* Post-it Amarelo ("MANTENHA SUA SENHA SECRETA") */}
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
                fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', cursive, sans-serif",
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
            onSubmit={handleLoginSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              zIndex: 2
            }}
          >
            {/* Campos de Entrada */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxWidth: "380px"
              }}
            >
              {/* Nome do Pinguim */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px"
                }}
              >
                <label
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#00081c",
                    whiteSpace: "nowrap"
                  }}
                >
                  Nome do Pinguim:
                </label>
                <input
                  type="text"
                  value={penguinNameOrEmail}
                  onChange={(e) => setPenguinNameOrEmail(e.target.value)}
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

              {/* Senha */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px"
                }}
              >
                <label
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
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              {/* Checkboxes alinhados com o campo de texto */}
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
                    onChange={(e) => setRememberMe(e.target.checked)}
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
                    checked={rememberPassword}
                    onChange={(e) => setRememberPassword(e.target.checked)}
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
                  Lembrar da minha senha
                </label>
              </div>
            </div>

            {/* Mensagem de Erro */}
            {authError && (
              <div
                style={{
                  background: "#ffebee",
                  border: "2px solid #c62828",
                  color: "#b71c1c",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  maxWidth: "380px",
                  marginTop: "10px",
                  textAlign: "center"
                }}
              >
                {authError}
              </div>
            )}

            {/* Grupo Central de Botões (Login e Google) */}
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
                  fontFamily: "'Fredoka', 'Burbank Big Condensed', system-ui, sans-serif",
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

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleLogin}
                style={{
                  width: "185px",
                  height: "36px",
                  borderRadius: "20px",
                  border: "2px solid #001f4d",
                  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
                  boxShadow:
                    "inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 3px 6px rgba(0, 0, 0, 0.25)",
                  color: "#001f4d",
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: "13px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  outline: "none",
                  transition: "transform 0.1s ease"
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Entrar com Google
              </button>
            </div>

            {/* Links Inferiores */}
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
                onClick={() => switchMode("forgot")}
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

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
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
                  onClick={() => switchMode("register")}
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
                  onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Criar uma conta grátis agora
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPenguinNameOrEmail("");
                  setPassword("");
                  setAuthError("");
                }}
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
      )}

      {/* ======================================================== */}
      {/* TELA 2: CRIAR PINGUIM (Modelo Fiel de Criação de Conta) */}
      {/* ======================================================== */}
      {mode === "register" && (
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
          {/* Cabeçalho Superior */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderBottom: "2px solid rgba(255, 255, 255, 0.15)"
            }}
          >
            {/* Botão Voltar (Círculo Branco com Seta) */}
            <button
              type="button"
              onClick={() => switchMode("login")}
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

            {/* Título Central */}
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

            {/* Botão Fechar (Círculo Branco com X) */}
            <button
              type="button"
              onClick={() => switchMode("login")}
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

          {/* Input oculto para upload de foto de perfil */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoUpload}
          />

          {/* Corpo do Cadastro em 2 Colunas */}
          <form
            onSubmit={handleRegisterSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "28px",
              padding: "24px 36px 36px 36px",
              alignItems: "center",
              flex: 1
            }}
          >
            {/* COLUNA ESQUERDA: Círculo de Foto e Nome do Pinguim */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "18px"
              }}
            >
              {/* Moldura Circular de Upload de Foto */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "relative",
                  width: "230px",
                  height: "230px",
                  borderRadius: "50%",
                  border: "7px solid #00569e",
                  background: registerPhotoURL
                    ? `url(${registerPhotoURL}) center/cover no-repeat`
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
                {!registerPhotoURL && (
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

                {registerPhotoURL && (
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

              {/* Balão Amarelo de Fala: "Seu Pinguim necessita de um nome!" */}
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
                  {/* Ponta do balão apontando para o input */}
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

                {/* Campo de Nome do Pinguim com X para limpar */}
                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    type="text"
                    value={registerDisplayName}
                    onChange={(e) => setRegisterDisplayName(e.target.value)}
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
                  {registerDisplayName && (
                    <button
                      type="button"
                      onClick={() => setRegisterDisplayName("")}
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

            {/* COLUNA DIREITA: Senha, E-mail, Termos e Botão de Criação */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                width: "100%",
                maxWidth: "420px"
              }}
            >
              {/* Campo 1: CRIAR SENHA */}
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
                  type={showRegisterPassword ? "text" : "password"}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
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
                {/* Botão Cápsula: MOSTRAR SENHA: ON / OFF */}
                <div style={{ display: "flex", justifyContent: "center", marginTop: "2px" }}>
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
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
                    MOSTRAR SENHA: {showRegisterPassword ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {/* Campo 2: SEU E-MAIL */}
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
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
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

              {/* Termos com o texto solicitado pelo usuário */}
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
                  onChange={(e) => setTermsAccepted(e.target.checked)}
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

              {/* Mensagem de Erro no Cadastro */}
              {authError && (
                <div
                  style={{
                    background: "#ffebee",
                    border: "2px solid #c62828",
                    color: "#b71c1c",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textAlign: "center"
                  }}
                >
                  {authError}
                </div>
              )}

              {/* Botão de Criação "CRIAR SEU PINGUIM" */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
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
                    textShadow: termsAccepted ? "0 2px 4px rgba(0, 20, 60, 0.6)" : "none",
                    boxShadow: termsAccepted ? "0 4px 14px rgba(0, 0, 0, 0.35)" : "none",
                    cursor: submitting || !termsAccepted ? "not-allowed" : "pointer",
                    transition: "all 0.15s ease",
                    outline: "none"
                  }}
                >
                  {submitting ? "CRIANDO..." : "CRIAR SEU PINGUIM"}
                </button>

                {/* Opção alternativa com Google */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleLogin}
                  style={{
                    width: "100%",
                    height: "38px",
                    borderRadius: "19px",
                    border: "2px solid #003366",
                    background: "#ffffff",
                    color: "#001b3a",
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: "13px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    outline: "none"
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Ou crie com sua conta Google
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* TELA 3: ESQUECEU A SENHA (Recuperação de Conta) */}
      {/* ======================================================== */}
      {mode === "forgot" && (
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
            onSubmit={handleForgotSubmit}
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
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "#00081c",
                    whiteSpace: "nowrap"
                  }}
                >
                  Nome ou E-mail:
                </label>
                <input
                  type="text"
                  value={penguinNameOrEmail}
                  onChange={(e) => setPenguinNameOrEmail(e.target.value)}
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

            {authError && (
              <div
                style={{
                  background: "#ffebee",
                  border: "2px solid #c62828",
                  color: "#b71c1c",
                  borderRadius: "8px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 700,
                  maxWidth: "380px",
                  marginTop: "10px",
                  textAlign: "center"
                }}
              >
                {authError}
              </div>
            )}

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
                  fontFamily: "'Fredoka', 'Burbank Big Condensed', system-ui, sans-serif",
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
                onClick={() => switchMode("login")}
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
      )}
    </div>
  );
}
