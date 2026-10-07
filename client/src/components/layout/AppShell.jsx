import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, LogIn, LogOut, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getNavigation } from "../../config/navigation";
import { ROLE_LABEL } from "../../config/theme";
import { firstName } from "../../lib/format";
import { IconButton, Button, useDialog } from "../ui";
import { InvestorLevelBadge } from "../domain/InvestorLevel";
import { usePageMetaState, useBack } from "./PageMeta";

function useBadges() {
  const { unreadCount, unreadMessages } = useAuth();
  return { notifications: unreadCount, messages: unreadMessages };
}

function Count({ n }) {
  if (!n) return null;
  return <span className="nav-count" aria-hidden>{n > 9 ? "9+" : n}</span>;
}

function a11yName(item, badges) {
  const n = item.badge ? badges[item.badge] : 0;
  return n ? `${item.label}, ${n} não lidos` : undefined;
}

export function Avatar({ user, size = 32 }) {
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {user?.avatar_data ? <img src={user.avatar_data} alt="" /> : <UserRound size={Math.round(size * 0.55)} aria-hidden />}
    </span>
  );
}

// ---------- celular: barra superior ----------
function TopBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const onAuthPage = pathname === "/login" || pathname === "/cadastro";
  const { title, back } = usePageMetaState();
  const badges = useBadges();
  const goBack = useBack(typeof back === "string" ? back : "/");

  return (
    <header className="topbar">
      <div className="topbar-inner">
        {back ? (
          <>
            <IconButton label="Voltar" icon={ChevronLeft} size={26} onClick={goBack} />
            <span className="topbar-title">{title}</span>
          </>
        ) : (
          <>
            <Link to="/" className="topbar-logo" aria-label="Meu Talhão — início">
              <img src="/logo-header.svg" alt="" />
            </Link>
            <span className="topbar-spacer" />
          </>
        )}
        <div className="topbar-actions">
          {user ? (
            <IconButton label="Avisos" icon={Bell} to="/avisos" badge={badges.notifications} />
          ) : !onAuthPage ? (
            <Button variant="on-dark" size="sm" to="/login">Entrar</Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// ---------- celular: barra de abas ----------
function TabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const badges = useBadges();
  const { tab } = getNavigation(user);
  const items = user ? tab : [...tab, { key: "entrar", to: "/login", label: "Entrar", icon: LogIn, match: (p) => p === "/login" || p === "/cadastro" }];

  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.match(pathname);
        return (
          <Link key={it.key} to={it.to} className="tab" aria-current={active ? "page" : undefined} aria-label={a11yName(it, badges)}>
            <span className="tab-indicator">
              <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden />
              <Count n={it.badge && badges[it.badge]} />
            </span>
            <span className="tab-label">{it.short || it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------- tablet: trilho ----------
function NavRail() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const badges = useBadges();
  const { side } = getNavigation(user);
  const items = side.filter((i) => i.key !== "perfil");

  return (
    <nav className="rail" aria-label="Navegação principal">
      <Link to="/" className="rail-logo" aria-label="Meu Talhão — início">
        <img src="/logo-icon.svg" alt="" />
      </Link>
      <div className="rail-items">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.match(pathname);
          return (
            <Link key={it.key} to={it.to} className="rail-item" aria-current={active ? "page" : undefined} aria-label={a11yName(it, badges)}>
              <span className="tab-indicator">
                <Icon size={22} aria-hidden />
                <Count n={it.badge && badges[it.badge]} />
              </span>
              {it.short || it.label}
            </Link>
          );
        })}
      </div>
      <div className="rail-bottom">
        {user ? (
          <Link to="/perfil" className="rail-item" aria-current={pathname === "/perfil" ? "page" : undefined}>
            <span className="tab-indicator"><Avatar user={user} size={30} /></span>
            Perfil
          </Link>
        ) : (
          <>
            <Link to="/login" className="rail-item" aria-current={pathname === "/login" ? "page" : undefined}>
              <span className="tab-indicator"><LogIn size={22} aria-hidden /></span>Entrar
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ---------- desktop: barra lateral ----------
function Sidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const badges = useBadges();
  const dialog = useDialog();
  const { side } = getNavigation(user);

  async function handleLogout() {
    const ok = await dialog.confirm({ title: "Sair da conta?", message: "Você precisará entrar de novo para acessar seus dados.", confirmLabel: "Sair" });
    if (!ok) return;
    logout();
    navigate("/", { replace: true });
  }

  return (
    <aside className="sidebar">
      <Link to="/" className="sidebar-logo" aria-label="Meu Talhão — início">
        <img src="/logo-header.svg" alt="" />
      </Link>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {side.map((it) => {
          const Icon = it.icon;
          const active = it.match(pathname);
          return (
            <Link key={it.key} to={it.to} className="sidebar-item" aria-current={active ? "page" : undefined} aria-label={a11yName(it, badges)}>
              <Icon size={20} aria-hidden /> {it.label}
              <Count n={it.badge && badges[it.badge]} />
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        {user ? (
          <>
            <Link to="/perfil" className="sidebar-user">
              <Avatar user={user} size={40} />
              <span style={{ minWidth: 0 }}>
                <span className="sidebar-user-name truncate" style={{ display: "block" }}>{firstName(user.name)}</span>
                {user.nivel ? <InvestorLevelBadge nivel={user.nivel} size="sm" /> : <span className="sidebar-user-role">{ROLE_LABEL[user.role]}</span>}
              </span>
            </Link>
            <Button variant="on-dark" icon={LogOut} onClick={handleLogout}>Sair</Button>
          </>
        ) : (
          <div className="sidebar-cta">
            <Button variant="primary" to="/cadastro" block>Criar conta</Button>
            <Button variant="on-dark" to="/login" block>Entrar</Button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function AppShell({ children }) {
  const { hideTabBar } = usePageMetaState();
  return (
    <div className="shell" data-tabbar={hideTabBar ? "hidden" : undefined}>
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <TopBar />
      <NavRail />
      <Sidebar />
      <main id="conteudo" className="shell-main" tabIndex={-1}>
        {children}
      </main>
      <TabBar />
    </div>
  );
}
