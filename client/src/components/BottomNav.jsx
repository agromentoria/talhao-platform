import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, Wallet, Settings, ShieldCheck, Bell, User } from "lucide-react";
import { COLORS } from "../theme";
import { useAuth } from "../context/AuthContext";

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const items = [{ to: "/", label: "início", icon: LayoutGrid }];
  if (user?.role === "investidor") items.push({ to: "/carteira", label: "carteira", icon: Wallet });
  if (user?.role === "fazenda") items.push({ to: "/fazenda", label: "fazenda", icon: Settings });
  if (user?.role === "admin") items.push({ to: "/admin", label: "admin", icon: ShieldCheck });
  items.push({ to: null, label: "avisos", icon: Bell });
  items.push({ to: user ? "/perfil" : "/login", label: user ? "perfil" : "entrar", icon: User });

  return (
    <div className="bottom-nav" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      background: COLORS.orange, padding: "10px 6px 14px", justifyContent: "space-around",
      boxShadow: "0 -4px 14px rgba(52,37,25,0.18)",
    }}>
      {items.map((it, i) => {
        const Icon = it.icon;
        const active = it.to && location.pathname === it.to;
        const handleClick = () => {
          if (it.to) navigate(it.to);
        };
        return (
          <button key={i} onClick={handleClick} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: it.to ? "pointer" : "default",
            color: "#fff", opacity: active ? 1 : 0.85, padding: "2px 4px", minWidth: 54,
          }}>
            <Icon size={19} strokeWidth={active ? 2.5 : 2} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
