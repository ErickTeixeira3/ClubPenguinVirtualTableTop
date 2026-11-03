import { useState } from "react";
import { useCampaign } from "../../contexts/CampaignContext";
import { useAuth } from "../../contexts/AuthContext";

export default function GMPanelModal({ onClose }) {
  const { user } = useAuth();
  const {
    campaign,
    onlineUsers,
    isRealGM,
    assignGM,
    updateCampaignName
  } = useCampaign();

  const [campaignName, setCampaignName] = useState(campaign?.name || "");
  const [saving, setSaving] = useState(false);

  if (!campaign) return null;

  const playersList = Object.values(campaign.players || {});

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !isRealGM) return;
    setSaving(true);
    try {
      await updateCampaignName(campaignName);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="epf-visor"
        style={{ width: "100%", maxWidth: "540px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px"
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-epf)",
              fontSize: "18px",
              color: "var(--epf-cyan-glow)",
              letterSpacing: "1px"
            }}
          >
            TERMINAL EPF // CONTROLE DA MESA
          </span>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 12px", fontSize: "13px" }}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <div
          className="epf-screen"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {isRealGM && (
            <form
              onSubmit={handleSaveName}
              style={{ display: "flex", gap: "8px" }}
            >
              <input
                type="text"
                className="cp-input"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Nome da Campanha"
              />
              <button
                type="submit"
                className="cp-btn cp-btn-gold"
                disabled={saving}
              >
                Salvar
              </button>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {playersList.map((p) => {
              const isOnline = Boolean(onlineUsers?.[p.uid]?.online);
              const isThisGM = campaign.gmId === p.uid;

              return (
                <div
                  key={p.uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "rgba(0, 240, 255, 0.06)",
                    border: "1px solid rgba(0, 240, 255, 0.25)",
                    borderRadius: "8px"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <span
                      className="presence-dot"
                      style={{
                        background: isOnline
                          ? "var(--epf-green-radar)"
                          : "#64748b",
                        boxShadow: isOnline
                          ? "0 0 6px var(--epf-green-radar)"
                          : "none"
                      }}
                    />
                    <span style={{ color: "#ffffff", fontWeight: 700 }}>
                      {p.displayName}
                    </span>
                    <span
                      className={`cp-badge ${
                        isThisGM ? "cp-badge-gm" : "cp-badge-player"
                      }`}
                    >
                      {isThisGM ? "MESTRE" : "PLAYER"}
                    </span>
                  </div>

                  {!isThisGM && (isRealGM || p.uid === user?.uid) && (
                    <button
                      type="button"
                      className="cp-btn cp-btn-epf"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                      onClick={() => assignGM(p.uid)}
                    >
                      Definir Mestre
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

