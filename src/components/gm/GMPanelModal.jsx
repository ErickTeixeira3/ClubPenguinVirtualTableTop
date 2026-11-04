import { useMemo, useState } from "react";
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

  // Lista unificada de todos os agentes (jogadores cadastrados na campanha e contas autorizadas)
  const allAgentsList = useMemo(() => {
    if (!campaign) return [];
    const list = [];
    const registeredPlayers = Object.values(campaign.players || {});
    const registeredEmails = new Set();
    const registeredUids = new Set();

    // 1. Jogadores registrados que já entraram na mesa
    registeredPlayers.forEach((p) => {
      const emailLower = (p.email || "").toLowerCase();
      if (emailLower) registeredEmails.add(emailLower);
      if (p.uid) registeredUids.add(p.uid);

      const isOnline = Boolean(onlineUsers?.[p.uid]?.online);
      const isThisGM = campaign.gmId === p.uid || p.role === "gm";

      list.push({
        id: p.uid,
        uid: p.uid,
        displayName: p.displayName || "Agente",
        photoURL: p.photoURL || null,
        isGM: isThisGM,
        isOnline,
        isRegistered: true
      });
    });

    // 2. Contas autorizadas que ainda não entraram ou não criaram perfil
    (authorizedUsers || []).forEach((auth) => {
      const authEmailLower = (auth.email || "").toLowerCase();
      if (registeredEmails.has(authEmailLower)) return;

      const isThisGM = auth.role === "gm";
      list.push({
        id: `auth_${authEmailLower}`,
        uid: null,
        displayName: auth.defaultDisplayName || "Agente Convocado",
        photoURL: null,
        isGM: isThisGM,
        isOnline: false,
        isRegistered: false
      });
    });

    // Ordena: Mestre primeiro, depois online primeiro, depois por nome
    list.sort((a, b) => {
      if (a.isGM !== b.isGM) return a.isGM ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    return list;
  }, [campaign, onlineUsers, authorizedUsers]);

  if (!campaign) return null;

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
            TERMINAL EPF
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

          {/* Seção: Agentes da Mesa */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontFamily: "var(--font-epf)",
                fontSize: "14px",
                color: "var(--epf-cyan-glow)",
                letterSpacing: "0.5px"
              }}
            >
              AGENTES DA MESA
            </span>

            {allAgentsList.map((agent) => {
              const isThisGM = agent.isGM;

              return (
                <div
                  key={agent.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: agent.isOnline
                      ? "rgba(0, 240, 255, 0.08)"
                      : "rgba(0, 27, 58, 0.4)",
                    border: agent.isOnline
                      ? "1px solid rgba(0, 240, 255, 0.3)"
                      : "1px solid rgba(100, 116, 139, 0.2)",
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
                        background: agent.isOnline
                          ? "var(--epf-green-radar)"
                          : "#64748b",
                        boxShadow: agent.isOnline
                          ? "0 0 6px var(--epf-green-radar)"
                          : "none"
                      }}
                      title={agent.isOnline ? "Online" : "Offline"}
                    />

                    {agent.photoURL ? (
                      <img
                        src={agent.photoURL}
                        alt=""
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: isThisGM
                            ? "2px solid #ffcc00"
                            : "2px solid var(--cp-blue-border)",
                          opacity: agent.isOnline ? 1 : 0.65
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: "18px",
                          opacity: agent.isOnline ? 1 : 0.6
                        }}
                      >
                        🐧
                      </span>
                    )}

                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          color: agent.isOnline ? "#ffffff" : "#94a3b8",
                          fontWeight: 700,
                          fontSize: "13px"
                        }}
                      >
                        {agent.displayName}
                      </span>
                      <span
                        style={{
                          color: agent.isOnline ? "var(--epf-green-radar)" : "#64748b",
                          fontSize: "10px",
                          fontWeight: 700,
                          letterSpacing: "0.5px"
                        }}
                      >
                        {agent.isOnline ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>

                    <span
                      className={`cp-badge ${
                        isThisGM ? "cp-badge-gm" : "cp-badge-player"
                      }`}
                      style={{
                        opacity: agent.isOnline ? 1 : 0.75,
                        fontSize: "9px"
                      }}
                    >
                      {isThisGM ? "MESTRE" : "PLAYER"}
                    </span>
                  </div>

                  {!isThisGM && isRealGM && agent.uid && (
                    <button
                      type="button"
                      className="cp-btn cp-btn-epf"
                      style={{ padding: "5px 12px", fontSize: "12px" }}
                      onClick={() => assignGM(agent.uid)}
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
