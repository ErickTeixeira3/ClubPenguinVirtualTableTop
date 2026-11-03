import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CampaignProvider, useCampaign } from "./contexts/CampaignContext";
import LoginScreen from "./components/auth/LoginScreen";
import VTTLayout from "./components/layout/VTTLayout";

function AppContent() {
  const { user, loading } = useAuth();
  const { campaignLoading } = useCampaign();

  if (loading || (user && campaignLoading)) {
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

  if (!user) {
    return <LoginScreen />;
  }

  return <VTTLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <CampaignProvider>
        <AppContent />
      </CampaignProvider>
    </AuthProvider>
  );
}
