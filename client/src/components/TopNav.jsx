import { Link, useNavigate, useLocation } from "react-router-dom";
import { Bell, User, LayoutGrid, Wallet, Settings, ShieldCheck, LogOut } from "lucide-react";
import { COLORS } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = [{ to: "/", label: "Talhões", icon: LayoutGrid }];
  if (user?.role === "investidor") items.push({ to: "/carteira", label: "Meus investimentos", icon: Wallet });
  if (user?.role === "fazenda") items.push({ to: "/fazenda", label: "Painel da fazenda", icon: Settings });
  if (user?.role === "admin") items.push({ to: "/admin", label: "Administração", icon: ShieldCheck });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.bgCard, flexWrap: "wrap", gap: 10 }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
        <img src="/logo-horizontal.svg" alt="Meu Talhão" style={{ height: 40 }} />
      </Link>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {items.map((it) => {
          const Icon = it.icon;
          const active = location.pathname === it.to;
          return (
            <Link key={it.to} to={it.to} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
              background: active ? COLORS.leaf : "transparent",
              color: active ? "#fff" : COLORS.soilLight, fontSize: 13.5, fontWeight: 500, textDecoration: "none",
            }}>
              <Icon size={15} /> {it.label}
            </Link>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {user ? (
          <>
            <Bell size={18} color={COLORS.soilLight} />
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: COLORS.wheatLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={15} color={COLORS.soil} />
            </div>
            <span style={{ fontSize: 13, color: COLORS.soil, fontWeight: 500 }}>{user.name.split(" ")[0]}</span>
            <button onClick={() => { logout(); navigate("/"); }} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
              <LogOut size={17} />
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={{ fontSize: 13.5, color: COLORS.soilLight, textDecoration: "none", fontWeight: 500 }}>Entrar</Link>
            <Link to="/cadastro" style={{ fontSize: 13.5, padding: "7px 14px", borderRadius: 8, background: COLORS.leaf, color: "#fff", textDecoration: "none", fontWeight: 500 }}>Criar conta</Link>
          </>
        )}
      </div>
    </div>
  );
}
