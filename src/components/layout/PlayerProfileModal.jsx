import { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { compressImageToWebP } from "../../engines/imageCompressor";

export default function PlayerProfileModal({ onClose }) {
  const { user } = useAuth();
  const { myPlayerProfile, updatePlayerProfile } = useCampaign();

  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(
    myPlayerProfile?.displayName || user?.displayName || ""
  );
  const [photoURL, setPhotoURL] = useState(
    myPlayerProfile?.photoURL || user?.photoURL || ""
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    try {
      const compressed = await compressImageToWebP(file, "avatar");
      setPhotoURL(compressed.dataUrl);
    } catch {
      setErrorMsg("Erro ao processar imagem.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setSaving(true);
    setErrorMsg("");
    try {
      await updatePlayerProfile({
        displayName: displayName.trim(),
        photoURL: photoURL || null
      });
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const isGM = myPlayerProfile?.role === "gm";

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="cp-window"
        style={{ width: "100%", maxWidth: "420px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "18px" }}>
            PERFIL DO JOGADOR
          </h2>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div className="cp-window-inner">
          <form
            onSubmit={handleSave}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {/* Foto de Perfil do Jogador */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <div
                style={{
                  width: "88px",
                  height: "88px",
                  borderRadius: "50%",
                  border: isGM
                    ? "3.5px solid #ffcc00"
                    : "3.5px solid var(--cp-blue-border)",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
                  background: "#ffffff",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px"
                }}
              >
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Foto do Jogador"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                ) : (
                  <span>🐧</span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-gold"
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Trocar Foto
                </button>
                {photoURL && (
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={() => setPhotoURL("")}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>

            {/* Campo: Nome do Jogador */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                style={{
                  fontWeight: 800,
                  fontSize: "12px",
                  color: "var(--cp-text-dark)"
                }}
              >
                Nome do Jogador
              </label>
              <input
                type="text"
                className="cp-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome ou apelido"
                required
              />
            </div>

            {/* Campo: E-mail da Conta */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label
                style={{
                  fontWeight: 800,
                  fontSize: "12px",
                  color: "var(--cp-text-dark)"
                }}
              >
                E-mail Vinculado
              </label>
              <input
                type="text"
                className="cp-input"
                value={user?.email || ""}
                disabled
                style={{ opacity: 0.75, cursor: "not-allowed" }}
              />
            </div>

            {/* Papel na Mesa */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "rgba(0, 27, 58, 0.05)",
                borderRadius: "8px",
                border: "1px solid rgba(0, 27, 58, 0.1)"
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700 }}>
                Papel na Mesa
              </span>
              <span
                className={`cp-badge ${isGM ? "cp-badge-gm" : "cp-badge-player"}`}
              >
                {isGM ? "MESTRE" : "JOGADOR"}
              </span>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: "#ffebee",
                  border: "2px solid #c62828",
                  color: "#b71c1c",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Ações */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                type="submit"
                className="cp-btn cp-btn-green"
                disabled={saving || !displayName.trim()}
                style={{ flex: 1, padding: "8px", fontSize: "14px" }}
              >
                {saving ? "Salvando..." : "Salvar Perfil"}
              </button>
              <button
                type="button"
                className="cp-btn"
                onClick={onClose}
                style={{ padding: "8px 16px", fontSize: "14px" }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

