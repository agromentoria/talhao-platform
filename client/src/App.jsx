import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import Marketplace from "./pages/Marketplace";
import PlotDetail from "./pages/PlotDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Portfolio from "./pages/Portfolio";
import FarmDashboard from "./pages/FarmDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import Notifications from "./pages/Notifications";
import Conversations from "./pages/Conversations";
import PaymentMethods from "./pages/PaymentMethods";
import FarmWallet from "./pages/FarmWallet";
import { useAuth } from "./context/AuthContext";
import { COLORS } from "./theme";

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const { loading } = useAuth();

  // enquanto verifica se já existe uma sessão salva, mostra a tela de
  // carregamento cheia em vez do app — evita qualquer piscar de menu
  // errado (deslogado -> logado) na primeira renderização
  if (loading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <TopNav />
      <div className="page-content">
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<Marketplace />} />
            <Route path="/talhao/:id" element={<PlotDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/carteira" element={<RequireRole role="investidor"><Portfolio /></RequireRole>} />
            <Route path="/fazenda" element={<RequireRole role="fazenda"><FarmDashboard /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
            <Route path="/perfil" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/avisos" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="/conversas" element={<RequireAuth><Conversations /></RequireAuth>} />
            <Route path="/pagamentos" element={<RequireRole role="investidor"><PaymentMethods /></RequireRole>} />
            <Route path="/fazenda/carteira" element={<RequireRole role="fazenda"><FarmWallet /></RequireRole>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </div>
      <BottomNav />
    </div>
  );
}
