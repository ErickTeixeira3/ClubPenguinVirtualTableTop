import { useState } from "react";
import { useCampaign } from "../../contexts/CampaignContext";
import { useAuth } from "../../contexts/AuthContext";

export default function GMPanelModal({ onClose }) {
  const { user } = useAuth();
  const {
    campaign,
    onlineUsers,
    isRealGM,
    authorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
    assignGM,
    updateCampaignName
  } = useCampaign();

  const [campaignName, setCampaignName] = useState(campaign?.name || "");
  const [saving, setSaving] = useState(false);

  // Formulário para autorizar novo acesso
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("player");
  const [addingUser, setAddingUser] = useState(false);
  const [authError, setAuthError] = useState("");

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

  const handleAddAuthorized = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !isRealGM) return;
    setAddingUser(true);
    setAuthError("");
    try {
      await addAuthorizedUser({
        email: newEmail.trim(),
        defaultDisplayName: newName.trim(),
        role: newRole
      });
      setNewEmail("");
      setNewName("");
      setNewRole("player");
    } catch (err) {
      setAuthError(err?.message || "Erro ao autorizar conta.");
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveAuthorized = async (emailToRemove) => {
    if (!isRealGM) return;
    setAuthError("");
    try {
      await removeAuthorizedUser(emailToRemove);
    } catch (err) {
      setAuthError(err?.message || "Erro ao remover autorização.");
    }
  };

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="epf-visor"
        style={{ width: "100%", maxWidth: "560px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
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
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
            scrollbarWidth: "thin",
            paddingRight: "6px"
          }}
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

          {/* Seção: Acessos Autorizados (Whitelist) - Somente Mestre */}
          {isRealGM && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "rgba(0, 240, 255, 0.04)",
                border: "1px solid rgba(0, 240, 255, 0.2)",
                borderRadius: "8px",
                padding: "12px"
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-epf)",
                  fontSize: "14px",
                  color: "var(--epf-cyan-glow)",
                  letterSpacing: "0.5px"
                }}
              >
                CONTAS AUTORIZADAS
              </span>

              {/* Formulário para autorizar novo jogador */}
              <form
                onSubmit={handleAddAuthorized}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px"
                }}
              >
                <input
                  type="email"
                  className="cp-input"
                  style={{ flex: "2 1 180px", fontSize: "12px", padding: "6px 8px" }}
                  placeholder="E-mail (Google ou Conta)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
                <input
                  type="text"
                  className="cp-input"
                  style={{ flex: "1 1 120px", fontSize: "12px", padding: "6px 8px" }}
                  placeholder="Nome do Jogador"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  style={{
                    background: "#001b3a",
                    border: "2px solid var(--cp-blue-border)",
                    borderRadius: "8px",
                    color: "#ffffff",
                    fontSize: "12px",
                    padding: "4px 8px",
                    fontWeight: 700
                  }}
                >
                  <option value="player">Jogador</option>
                  <option value="gm">Mestre</option>
                </select>
                <button
                  type="submit"
                  className="cp-btn cp-btn-epf"
                  disabled={addingUser || !newEmail.trim()}
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                >
                  Autorizar
                </button>
              </form>

              {authError && (
                <div
                  style={{
                    color: "#ff5252",
                    fontSize: "12px",
                    fontWeight: 700
                  }}
                >
                  {authError}
                </div>
              )}

              {/* Lista de e-mails autorizados */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {authorizedUsers.map((item) => {
                  const isCurrentGM = item.email.toLowerCase() === user?.email?.toLowerCase();
                  return (
                    <div
                      key={item.email}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        background: "rgba(0, 27, 58, 0.4)",
                        border: "1px solid rgba(0, 240, 255, 0.15)",
                        borderRadius: "6px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          overflow: "hidden"
                        }}
                      >
                        <span
                          style={{
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 700
                          }}
                        >
                          {item.email}
                        </span>
                        {item.defaultDisplayName && (
                          <span
                            style={{
                              color: "#94a3b8",
                              fontSize: "11px"
                            }}
                          >
                            ({item.defaultDisplayName})
                          </span>
                        )}
                        <span
                          className={`cp-badge ${
                            item.role === "gm" ? "cp-badge-gm" : "cp-badge-player"
                          }`}
                          style={{ fontSize: "9px", padding: "1px 6px" }}
                        >
                          {item.role === "gm" ? "MESTRE" : "PLAYER"}
                        </span>
                      </div>

                      {!isCurrentGM && (
                        <button
                          type="button"
                          className="cp-btn cp-btn-orange"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => handleRemoveAuthorized(item.email)}
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção: Jogadores Conectados */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontFamily: "var(--font-epf)",
                fontSize: "14px",
                color: "var(--epf-cyan-glow)",
                letterSpacing: "0.5px"
              }}
            >
              JOGADORES CONECTADOS
            </span>

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

                    {p.photoURL ? (
                      <img
                        src={p.photoURL}
                        alt=""
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: isThisGM
                            ? "2px solid #ffcc00"
                            : "2px solid var(--cp-blue-border)"
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "16px" }}>🐧</span>
                    )}

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                        {p.displayName}
                      </span>
                      {p.email && (
                        <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                          {p.email}
                        </span>
                      )}
                    </div>

                    <span
                      className={`cp-badge ${
                        isThisGM ? "cp-badge-gm" : "cp-badge-player"
                      }`}
                    >
                      {isThisGM ? "MESTRE" : "PLAYER"}
                    </span>
                  </div>

                  {!isThisGM && isRealGM && (
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
