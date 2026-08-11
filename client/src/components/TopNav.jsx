import { Link, useNavigate, useLocation } from "react-router-dom";
import { Bell, User, LayoutGrid, Wallet, Settings, ShieldCheck, LogOut } from "lucide-react";
import { COLORS, BACKGROUNDS } from "../theme";
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
    <div style={{
      position: "relative", overflow: "hidden",
      background: `${COLORS.headerGreen} url(${BACKGROUNDS.green}) top center / cover no-repeat`,
      borderRadius: "0 0 26px 26px", boxShadow: "0 4px 16px rgba(52,37,25,0.18)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", flexWrap: "wrap", gap: 10 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <img src="/logo-header.svg" alt="Meu Talhão" style={{ height: 42 }} />
        </Link>

        <div className="desktop-nav-links" style={{ gap: 4, flexWrap: "wrap" }}>
          {items.map((it) => {
            const Icon = it.icon;
            const active = location.pathname === it.to;
            return (
              <Link key={it.to} to={it.to} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 20,
                background: active ? COLORS.orange : "rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 13.5, fontWeight: 500, textDecoration: "none",
              }}>
                <Icon size={15} /> {it.label}
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user ? (
            <>
              <Bell size={18} color="#fff" />
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: COLORS.orange, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {user.avatar_data ? (
                  <img src={user.avatar_data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <User size={15} color="#fff" />
                )}
              </div>
              <span style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{user.name.split(" ")[0]}</span>
              <button onClick={() => { logout(); navigate("/"); }} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "#fff", display: "flex" }}>
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ fontSize: 13.5, color: "#fff", textDecoration: "none", fontWeight: 500 }}>Entrar</Link>
              <Link to="/cadastro" style={{ fontSize: 13.5, padding: "7px 14px", borderRadius: 20, background: COLORS.orange, color: "#fff", textDecoration: "none", fontWeight: 600 }}>Criar conta</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
