export default function GoogleSignInButton({
  label = "Entrar com Google",
  variant = "login",
  disabled = false,
  onClick
}) {
  const isRegister = variant === "register";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={
        isRegister
          ? {
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
              cursor: disabled ? "not-allowed" : "pointer",
              outline: "none"
            }
          : {
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
              cursor: disabled ? "not-allowed" : "pointer",
              outline: "none",
              transition: "transform 0.1s ease"
            }
      }
      onMouseDown={
        isRegister ? undefined : (e) => (e.currentTarget.style.transform = "scale(0.97)")
      }
      onMouseUp={
        isRegister ? undefined : (e) => (e.currentTarget.style.transform = "scale(1)")
      }
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
      {label}
    </button>
  );
}
