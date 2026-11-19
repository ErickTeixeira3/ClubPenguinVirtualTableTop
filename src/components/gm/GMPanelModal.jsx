import { useMemo, useState } from "react";
import { Z_LAYERS } from "../../constants/zLayers.js";
import { useCampaign } from "../../contexts/CampaignContext.jsx";
import { useMembers } from "../../contexts/MembersContext.js";
import { usePresence } from "../../contexts/PresenceContext.js";
import CPButton from "../ui/CPButton.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import WindowModal from "../ui/WindowModal.jsx";

export default function GMPanelModal({ onClose }) {
  const {
    campaign,
    gmId,
    isRealGM,
    assignGM,
    updateCampaignName
  } = useCampaign();
  const {
    members,
    invites,
    playersMap,
    inviteMember,
    revokeMember,
    revokeInvite
  } = useMembers();
  const { onlineUsers } = usePresence();

  const [campaignName, setCampaignName] = useState(campaign?.name || "");
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [addingInvite, setAddingInvite] = useState(false);
  const [panelError, setPanelError] = useState("");

  const [confirmState, setConfirmState] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const pendingInvites = useMemo(
    () =>
      (invites || [])
        .filter((inv) => !inv.acceptedBy)
        .sort((a, b) => a.email.localeCompare(b.email)),
    [invites]
  );

  const agentsList = useMemo(() => {
    const list = (members || []).map((member) => {
      const profile = playersMap?.[member.uid];
      const isOnline = Boolean(onlineUsers?.[member.uid]?.online);
      const isThisGM = Boolean(gmId && member.uid === gmId);
      return {
        uid: member.uid,
        displayName: member.displayName || profile?.displayName || "Agente",
        photoURL: profile?.photoURL || member.avatar?.url || null,
        isGM: isThisGM,
        isOnline
      };
    });

    list.sort((a, b) => {
      if (a.isGM !== b.isGM) return a.isGM ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
    return list;
  }, [members, playersMap, onlineUsers, gmId]);

  if (!campaign) return null;

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !isRealGM) return;
    setSaving(true);
    setPanelError("");
    try {
      await updateCampaignName(campaignName);
    } catch (err) {
      setPanelError(err?.message || "Erro ao salvar nome da campanha.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddInvite = async (e) => {
    e.preventDefault();
    if (!newEmail.trim() || !isRealGM) return;
    setAddingInvite(true);
    setPanelError("");
    try {
      await inviteMember({
        email: newEmail.trim(),
        defaultDisplayName: newName.trim()
      });
      setNewEmail("");
      setNewName("");
    } catch (err) {
      setPanelError(err?.message || "Erro ao enviar convite.");
    } finally {
      setAddingInvite(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    setPanelError("");
    try {
      if (confirmState.kind === "revoke-invite") {
        await revokeInvite(confirmState.email);
      } else if (confirmState.kind === "revoke-member") {
        await revokeMember(confirmState.uid);
      } else if (confirmState.kind === "assign-gm") {
        await assignGM(confirmState.uid);
      }
      setConfirmState(null);
    } catch (err) {
      setPanelError(err?.message || "Não foi possível concluir a ação.");
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <WindowModal
      variant="epf"
      maxWidth="560px"
      onClose={onClose}
      panelStyle={{
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column"
      }}
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
        <CPButton
          variant="orange"
          style={{ padding: "4px 12px", fontSize: "13px" }}
          onClick={onClose}
        >
          X
        </CPButton>
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
          <form onSubmit={handleSaveName} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              className="cp-input"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Nome da Campanha"
            />
            <CPButton type="submit" variant="gold" disabled={saving}>
              Salvar
            </CPButton>
          </form>
        )}

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
              CONVITES
            </span>

            <form
              onSubmit={handleAddInvite}
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
              <CPButton
                type="submit"
                variant="epf"
                disabled={addingInvite || !newEmail.trim()}
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                Convidar
              </CPButton>
            </form>

            {panelError && (
              <div
                style={{
                  color: "#ff5252",
                  fontSize: "12px",
                  fontWeight: 700
                }}
              >
                {panelError}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {pendingInvites.map((item) => (
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
                      <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                        ({item.defaultDisplayName})
                      </span>
                    )}
                  </div>

                  <CPButton
                    variant="orange"
                    style={{ padding: "3px 8px", fontSize: "11px" }}
                    onClick={() =>
                      setConfirmState({
                        kind: "revoke-invite",
                        email: item.email,
                        title: "Remover convite",
                        question: `Remover o convite de "${item.email}"?`,
                        confirmLabel: "Remover",
                        confirmVariant: "orange"
                      })
                    }
                  >
                    Remover
                  </CPButton>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {agentsList.map((agent) => (
            <div
              key={agent.uid}
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
                borderRadius: "8px",
                gap: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                      border: agent.isGM
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
                    agent.isGM ? "cp-badge-gm" : "cp-badge-player"
                  }`}
                  style={{
                    opacity: agent.isOnline ? 1 : 0.75,
                    fontSize: "9px"
                  }}
                >
                  {agent.isGM ? "MESTRE" : "PLAYER"}
                </span>
              </div>

              {!agent.isGM && isRealGM && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <CPButton
                    variant="epf"
                    style={{ padding: "5px 10px", fontSize: "12px" }}
                    onClick={() =>
                      setConfirmState({
                        kind: "assign-gm",
                        uid: agent.uid,
                        title: "Transferir Mestre",
                        question: `Definir "${agent.displayName}" como Mestre?`,
                        confirmLabel: "Definir Mestre",
                        confirmVariant: "epf"
                      })
                    }
                  >
                    Definir Mestre
                  </CPButton>
                  <CPButton
                    variant="orange"
                    style={{ padding: "5px 10px", fontSize: "12px" }}
                    onClick={() =>
                      setConfirmState({
                        kind: "revoke-member",
                        uid: agent.uid,
                        title: "Remover membro",
                        question: `Remover "${agent.displayName}" da campanha?`,
                        confirmLabel: "Remover",
                        confirmVariant: "orange"
                      })
                    }
                  >
                    Remover
                  </CPButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {confirmState && (
        <ConfirmDialog
          variant="cp"
          zIndex={Z_LAYERS.modalNested}
          title={confirmState.title}
          question={confirmState.question}
          confirmLabel={confirmState.confirmLabel}
          confirmVariant={confirmState.confirmVariant}
          disabled={confirmBusy}
          onConfirm={executeConfirmedAction}
          onCancel={() => {
            if (!confirmBusy) setConfirmState(null);
          }}
        />
      )}
    </WindowModal>
  );
}
