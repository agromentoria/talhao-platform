import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Sem login → vai para /login e volta para a página pedida depois de entrar.
export function RequireAuth({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (role && (Array.isArray(role) ? !role.includes(user.role) : user.role !== role)) return <Navigate to="/" replace />;
  return children;
}

// Telas de login/cadastro não fazem sentido para quem já entrou
export function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return children;
}
