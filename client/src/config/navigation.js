import { LayoutGrid, Wallet, Tractor, ShieldCheck, MessageCircle, Bell, UserRound, Coins } from "lucide-react";

// Fonte única da navegação. Antes os menus de cima e de baixo tinham listas
// próprias (e divergiam). Cada item diz em quais superfícies aparece:
//   tab   → barra de abas do celular (máx. 5 — Apple HIG e Material 3)
//   side  → trilho do tablet e barra lateral do desktop
// "match" define quais rotas deixam o item ativo.
const ITEMS = {
  talhoes:   { to: "/", label: "Talhões", icon: LayoutGrid, match: (p) => p === "/" || p.startsWith("/talhao/") },
  carteira:  { to: "/carteira", label: "Meus investimentos", short: "Investimentos", icon: Wallet, match: (p) => p === "/carteira" },
  fazenda:   { to: "/fazenda", label: "Minha fazenda", short: "Fazenda", icon: Tractor, match: (p) => p === "/fazenda" },
  carteiraFazenda: { to: "/fazenda/carteira", label: "Carteira", icon: Coins, match: (p) => p === "/fazenda/carteira" },
  admin:     { to: "/admin", label: "Administração", short: "Admin", icon: ShieldCheck, match: (p) => p.startsWith("/admin") },
  conversas: { to: "/conversas", label: "Conversas", icon: MessageCircle, badge: "messages", match: (p) => p.startsWith("/conversas") },
  avisos:    { to: "/avisos", label: "Avisos", icon: Bell, badge: "notifications", match: (p) => p === "/avisos" },
  perfil:    { to: "/perfil", label: "Perfil", icon: UserRound, match: (p) => p === "/perfil" || p === "/pagamentos" },
};

const BY_ROLE = {
  visitante:  { tab: ["talhoes"], side: ["talhoes"] },
  investidor: { tab: ["talhoes", "carteira", "conversas", "perfil"], side: ["talhoes", "carteira", "conversas", "avisos", "perfil"] },
  fazenda:    { tab: ["talhoes", "fazenda", "carteiraFazenda", "conversas", "perfil"], side: ["talhoes", "fazenda", "carteiraFazenda", "conversas", "avisos", "perfil"] },
  admin:      { tab: ["talhoes", "admin", "conversas", "perfil"], side: ["talhoes", "admin", "conversas", "avisos", "perfil"] },
};

export function getNavigation(user) {
  const cfg = BY_ROLE[user?.role] || BY_ROLE.visitante;
  return {
    tab: cfg.tab.map((k) => ({ key: k, ...ITEMS[k] })),
    side: cfg.side.map((k) => ({ key: k, ...ITEMS[k] })),
  };
}

// rota inicial de cada perfil depois do login
export function homeFor(user) {
  return { admin: "/admin", fazenda: "/fazenda", investidor: "/carteira" }[user?.role] || "/";
}
