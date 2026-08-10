import { Routes, Route, Navigate } from "react-router-dom";
import TopNav from "./components/TopNav";
import Marketplace from "./pages/Marketplace";
import PlotDetail from "./pages/PlotDetail";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Portfolio from "./pages/Portfolio";
import FarmDashboard from "./pages/FarmDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { useAuth } from "./context/AuthContext";
import { COLORS } from "./theme";

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 32, color: COLORS.soilLight, fontSize: 13 }}>Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <TopNav />
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/talhao/:id" element={<PlotDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/carteira" element={<RequireRole role="investidor"><Portfolio /></RequireRole>} />
        <Route path="/fazenda" element={<RequireRole role="fazenda"><FarmDashboard /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
