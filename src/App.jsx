import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import LoginScreen from "./components/auth/LoginScreen.jsx";
import VerifyEmailScreen from "./components/auth/VerifyEmailScreen.jsx";
import VTTLayout from "./components/layout/VTTLayout.jsx";
import CPButton from "./components/ui/CPButton.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import Toast from "./components/ui/Toast.jsx";
import WindowModal from "./components/ui/WindowModal.jsx";
import { Z_LAYERS } from "./constants/zLayers.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { CampaignProvider, useCampaign } from "./contexts/CampaignContext.jsx";
import MembersProvider from "./contexts/MembersProvider.jsx";
import PresenceProvider from "./contexts/PresenceProvider.jsx";
import { useRuntimeConfig } from "./contexts/RuntimeConfigContext.js";
import RuntimeConfigProvider from "./contexts/RuntimeConfigProvider.jsx";
import {
  DEFAULT_CAMPAIGN_ID,
  resolveInitialCampaignId,
  saveActiveCampaignId
} from "./services/campaignService.js";
import { notifyError } from "./services/notificationService.js";

function FullscreenLoading() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <div className="cp-window">
        <h2 className="cp-title" style={{ fontSize: "22px", padding: "8px 20px" }}>
          CARREGANDO ILHA...
        </h2>
      </div>
    </div>
  );
}

function CreateCampaignCard({ campaignId, onCreateCampaign, onRetry, onLogout }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreateCampaign({ name: name.trim(), targetCampaignId: campaignId });
    } catch {
      // Erro exibido via Toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 50%, #004b94 0%, #001f44 100%)",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "28px",
          background:
            "radial-gradient(ellipse at 50% 30%, #0589de 0%, #0070bb 55%, #005098 100%)",
          boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxSizing: "border-box"
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#ffffff",
            fontFamily: "'Fredoka', sans-serif",
            fontSize: "22px",
            textAlign: "center"
          }}
        >
          NOVA CAMPANHA
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <input
            type="text"
            className="cp-input"
            placeholder="Nome da Campanha"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <CPButton
            type="submit"
            variant="green"
            disabled={submitting || !name.trim()}
            style={{ padding: "10px 16px", fontSize: "14px" }}
          >
            {submitting ? "Criando..." : "Criar Campanha"}
          </CPButton>
          {typeof onRetry === "function" && (
            <CPButton
              variant="gold"
              disabled={submitting}
              onClick={onRetry}
              style={{ padding: "10px 16px", fontSize: "14px" }}
            >
              Tentar novamente
            </CPButton>
          )}
          <CPButton
            variant="orange"
            disabled={submitting}
            onClick={onLogout}
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Sair
          </CPButton>
        </form>
      </div>
    </div>
  );
}

function AccessDeniedScreen({ message, onRetry, onLogout }) {
  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at 50% 50%, #004b94 0%, #001f44 100%)",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          borderRadius: "28px",
          background:
            "radial-gradient(ellipse at 50% 30%, #0589de 0%, #0070bb 55%, #005098 100%)",
          boxShadow: "0 18px 42px rgba(0, 0, 0, 0.45)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
          boxSizing: "border-box"
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#ffffff",
            fontFamily: "'Fredoka', sans-serif",
            fontSize: "22px",
            textAlign: "center"
          }}
        >
          ACESSO RESTRITO
        </h2>

        <div
          role="alert"
          style={{
            background: "#ffebee",
            border: "2px solid #c62828",
            color: "#b71c1c",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "13px",
            fontWeight: 700,
            textAlign: "center",
            width: "100%"
          }}
        >
          {message || "Você não possui acesso a esta campanha."}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            width: "100%"
          }}
        >
          <CPButton
            variant="gold"
            onClick={onRetry}
            style={{ padding: "10px 16px", fontSize: "14px" }}
          >
            Tentar novamente
          </CPButton>
          <CPButton
            variant="orange"
            onClick={onLogout}
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Sair
          </CPButton>
        </div>
      </div>
    </div>
  );
}

function RuntimeReloadGate() {
  const { updateRequired, runtimeConfig, clientVersion, requestReload } =
    useRuntimeConfig();
  const [confirmUnsavedOpen, setConfirmUnsavedOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const confirmResolverRef = useRef(null);

  useEffect(() => {
    return () => {
      confirmResolverRef.current?.(false);
      confirmResolverRef.current = null;
    };
  }, []);

  if (!updateRequired) return null;

  const confirmDiscard = () =>
    new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmUnsavedOpen(true);
    });

  const handleReloadClick = async () => {
    if (confirmUnsavedOpen || reloading) return;
    setReloading(true);
    try {
      await requestReload({ confirmDiscard });
    } catch (err) {
      notifyError(err?.message || "Não foi possível recarregar o aplicativo.");
    } finally {
      setReloading(false);
    }
  };

  return (
    <>
      <WindowModal
        variant="cp"
        maxWidth="400px"
        closeOnOverlayClick={false}
        zIndex={Z_LAYERS.portalTooltip}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            alignItems: "center",
            textAlign: "center"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "18px", margin: 0 }}>
            ATUALIZAÇÃO NECESSÁRIA
          </h2>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>
            v{clientVersion} → v{runtimeConfig?.minClientVersion}
          </div>
          <CPButton
            variant="green"
            disabled={reloading || confirmUnsavedOpen}
            onClick={handleReloadClick}
            style={{ width: "100%", padding: "10px 16px", fontSize: "14px" }}
          >
            Recarregar
          </CPButton>
        </div>
      </WindowModal>

      {confirmUnsavedOpen && (
        <ConfirmDialog
          variant="cp"
          zIndex={Z_LAYERS.portalTooltip}
          title="Alterações não salvas"
          question="Descartar alterações não salvas e recarregar?"
          confirmLabel="Recarregar"
          cancelLabel="Cancelar"
          confirmVariant="orange"
          onConfirm={() => {
            setConfirmUnsavedOpen(false);
            confirmResolverRef.current?.(true);
            confirmResolverRef.current = null;
          }}
          onCancel={() => {
            setConfirmUnsavedOpen(false);
            confirmResolverRef.current?.(false);
            confirmResolverRef.current = null;
          }}
        />
      )}
    </>
  );
}

function CampaignSessionGate() {
  const { logout } = useAuth();
  const {
    campaignId,
    campaign,
    campaignLoading,
    firestoreError,
    membershipDenied,
    canCreateCampaign,
    createCampaign,
    retryMembership
  } = useCampaign();

  if (campaignLoading) {
    return <FullscreenLoading />;
  }

  if (canCreateCampaign) {
    return (
      <CreateCampaignCard
        campaignId={campaignId}
        onCreateCampaign={createCampaign}
        onRetry={retryMembership}
        onLogout={logout}
      />
    );
  }

  if (membershipDenied || !campaign) {
    return (
      <AccessDeniedScreen
        message={firestoreError}
        onRetry={retryMembership}
        onLogout={logout}
      />
    );
  }

  return <VTTLayout />;
}

export function AppContent({ campaignId, onSwitchCampaign }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullscreenLoading />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!user.emailVerified) {
    return (
      <>
        <VerifyEmailScreen />
        <RuntimeReloadGate />
      </>
    );
  }

  const sessionKey = `${user.uid}:${campaignId}`;

  return (
    <>
      <CampaignProvider
        key={sessionKey}
        campaignId={campaignId}
        onSwitchCampaign={onSwitchCampaign}
      >
        <MembersProvider key={sessionKey}>
          <PresenceProvider key={sessionKey}>
            <CampaignSessionGate />
          </PresenceProvider>
        </MembersProvider>
      </CampaignProvider>
      <RuntimeReloadGate />
    </>
  );
}

export default function App() {
  const [campaignId, setCampaignId] = useState(resolveInitialCampaignId);

  const handleSwitchCampaign = useCallback((nextCampaignId) => {
    const cleanId = String(nextCampaignId || DEFAULT_CAMPAIGN_ID).trim();
    if (!cleanId) return;
    saveActiveCampaignId(cleanId);
    setCampaignId(cleanId);
  }, []);

  return (
    <AuthProvider>
      <RuntimeConfigProvider>
        <AppContent
          campaignId={campaignId}
          onSwitchCampaign={handleSwitchCampaign}
        />
        <Toast />
      </RuntimeConfigProvider>
    </AuthProvider>
  );
}
