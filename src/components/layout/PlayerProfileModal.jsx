import { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useCampaign } from "../../contexts/CampaignContext.jsx";
import { useMembers } from "../../contexts/MembersContext.js";
import { useAvatarCompression } from "../../hooks/useAvatarCompression.js";
import { useMediaUrl } from "../../hooks/useMediaUrl.js";
import CPButton from "../ui/CPButton.jsx";
import WindowModal from "../ui/WindowModal.jsx";

export default function PlayerProfileModal({ onClose }) {
  const { user } = useAuth();
  const { campaignId, isRealGM } = useCampaign();
  const { myMember, updateMyProfile } = useMembers();
  const compressAvatar = useAvatarCompression();

  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(
    myMember?.displayName || user?.displayName || ""
  );
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState("");
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const avatarMediaId = photoRemoved ? null : myMember?.avatar?.mediaId || null;
  const avatarExternalUrl =
    photoRemoved || avatarMediaId ? null : myMember?.avatar?.url || null;

  const { url: resolvedAvatarUrl } = useMediaUrl(
    avatarMediaId,
    avatarExternalUrl,
    campaignId
  );

  const previewAvatarUrl = photoRemoved
    ? ""
    : newPhotoDataUrl || resolvedAvatarUrl || "";

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    try {
      const compressed = await compressAvatar(file);
      setPhotoRemoved(false);
      setNewPhotoDataUrl(compressed.dataUrl);
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao processar imagem.");
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
      if (photoRemoved) {
        await updateMyProfile({
          displayName: displayName.trim(),
          avatarAction: "remove"
        });
      } else if (newPhotoDataUrl) {
        await updateMyProfile({
          displayName: displayName.trim(),
          photoURL: newPhotoDataUrl
        });
      } else {
        await updateMyProfile({ displayName: displayName.trim() });
      }
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  const isGM = Boolean(isRealGM);

  return (
    <WindowModal variant="cp" maxWidth="420px" onClose={onClose}>
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
        <CPButton
          variant="orange"
          style={{ padding: "4px 10px", fontSize: "12px" }}
          onClick={onClose}
        >
          X
        </CPButton>
      </div>

      <div className="cp-window-inner">
        <form
          onSubmit={handleSave}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
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
              {previewAvatarUrl ? (
                <img
                  src={previewAvatarUrl}
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
              <CPButton
                variant="gold"
                style={{ padding: "4px 12px", fontSize: "12px" }}
                onClick={() => fileInputRef.current?.click()}
              >
                Trocar Foto
              </CPButton>
              {previewAvatarUrl && (
                <CPButton
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                  onClick={() => {
                    setPhotoRemoved(true);
                    setNewPhotoDataUrl("");
                  }}
                >
                  Remover
                </CPButton>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label
              htmlFor="cp-profile-name"
              style={{
                fontWeight: 800,
                fontSize: "12px",
                color: "var(--cp-text-dark)"
              }}
            >
              Nome do Jogador
            </label>
            <input
              id="cp-profile-name"
              type="text"
              className="cp-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome ou apelido"
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label
              htmlFor="cp-profile-email"
              style={{
                fontWeight: 800,
                fontSize: "12px",
                color: "var(--cp-text-dark)"
              }}
            >
              E-mail Vinculado
            </label>
            <input
              id="cp-profile-email"
              type="text"
              className="cp-input"
              value={user?.email || ""}
              disabled
              style={{ opacity: 0.75, cursor: "not-allowed" }}
            />
          </div>

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
              role="alert"
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

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <CPButton
              type="submit"
              variant="green"
              disabled={saving || !displayName.trim()}
              style={{ flex: 1, padding: "8px", fontSize: "14px" }}
            >
              {saving ? "Salvando..." : "Salvar Perfil"}
            </CPButton>
            <CPButton
              onClick={onClose}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              Cancelar
            </CPButton>
          </div>
        </form>
      </div>
    </WindowModal>
  );
}
