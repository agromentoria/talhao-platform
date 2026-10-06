import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import ErrorBoundary from "../components/ErrorBoundary";
import LoadingScreen from "../components/LoadingScreen";
import { Loading } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { RequireAuth, GuestOnly } from "./guards";
import { setupNative } from "../lib/native";
import Marketplace from "../pages/Marketplace";

// Cada tela é carregada sob demanda: o investidor não baixa o código do
// painel administrativo, e a primeira abertura fica bem mais leve.
const PlotDetail = lazy(() => import("../pages/PlotDetail"));
const Login = lazy(() => import("../pages/Login"));
const Register = lazy(() => import("../pages/Register"));
const Portfolio = lazy(() => import("../pages/Portfolio"));
const FarmDashboard = lazy(() => import("../pages/FarmDashboard"));
const FarmWallet = lazy(() => import("../pages/FarmWallet"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const WarehouseDashboard = lazy(() => import("../pages/WarehouseDashboard"));
const Profile = lazy(() => import("../pages/Profile"));
const Notifications = lazy(() => import("../pages/Notifications"));
const Conversations = lazy(() => import("../pages/Conversations"));
const ChatView = lazy(() => import("../pages/ChatView"));
const PaymentMethods = lazy(() => import("../pages/PaymentMethods"));
const Privacy = lazy(() => import("../pages/legal/Privacy"));
const Terms = lazy(() => import("../pages/legal/Terms"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let cleanup = () => {};
    setupNative({ navigate, getPath: () => window.location.pathname }).then((fn) => { cleanup = fn; });
    return () => cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  void location;
  return null;
}

export default function App() {
  const location = useLocation();
  const { loading } = useAuth();

  // enquanto confere se existe sessão salva, mostra a tela de carregamento
  // cheia — evita piscar o menu de visitante antes do menu logado
  if (loading) return <LoadingScreen />;

  return (
    <AppShell>
      <ScrollToTop />
      <NativeBridge />
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Marketplace />} />
            <Route path="/talhao/:id" element={<PlotDetail />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/cadastro" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/termos" element={<Terms />} />

            <Route path="/carteira" element={<RequireAuth role="investidor"><Portfolio /></RequireAuth>} />
            <Route path="/pagamentos" element={<RequireAuth role="investidor"><PaymentMethods /></RequireAuth>} />
            <Route path="/fazenda" element={<RequireAuth role="fazenda"><FarmDashboard /></RequireAuth>} />
            <Route path="/fazenda/carteira" element={<RequireAuth role="fazenda"><FarmWallet /></RequireAuth>} />
            <Route path="/armazem" element={<RequireAuth role="armazem"><WarehouseDashboard /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth role="admin"><AdminDashboard /></RequireAuth>} />
            <Route path="/perfil" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/avisos" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/conversas" element={<RequireAuth><Conversations /></RequireAuth>} />
            <Route path="/conversas/:id" element={<RequireAuth><ChatView /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
