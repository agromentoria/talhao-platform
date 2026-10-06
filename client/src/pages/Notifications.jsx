import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Warehouse, ShieldCheck, Megaphone, CheckCircle2, TrendingUp, Wallet, Receipt, ClipboardCheck, XCircle, ChevronRight, Send } from "lucide-react";
import { ICONS, GRAIN_ICONS } from "../config/theme";
import { timeAgo } from "../lib/format";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, ErrorBanner, EmptyState, Loading, FilterChips, Dialog, TextField, TextAreaField, SelectField, useToast } from "../components/ui";

const TYPE_ICON = {
  aviso_fazenda: ICONS.fazendas,
  aviso_admin: ShieldCheck,
  compra_confirmada: CheckCircle2,
  novo_investimento: TrendingUp,
  pagamento_recebido: Wallet,
  repasse_recebido: Wallet,
  transacao_admin: Receipt,
  solicitacao_colheita: ClipboardCheck,
  solicitacao_rejeitada: XCircle,
  custodia_armazem: ShieldCheck,
  validacao_armazem: ShieldCheck,
  indicacao_armazem: Warehouse,
  status_armazem: Warehouse,
};

const CATEGORY_FILTERS = [
  { id: "todos", label: "Todos", match: () => true },
  { id: "nao_lidos", label: "Não lidos", match: (n) => !n.read_at },
  { id: "financeiro", label: "Financeiro", match: (n) => ["compra_confirmada", "novo_investimento", "pagamento_recebido", "repasse_recebido", "transacao_admin"].includes(n.type) },
  { id: "talhoes", label: "Talhões", match: (n) => ["novo_talhao", "atualizacao_safra", "lembrete_fase", "solicitacao_colheita", "solicitacao_rejeitada", "indicacao_armazem"].includes(n.type) },
  { id: "armazem", label: "Armazém", match: (n) => ["custodia_armazem", "validacao_armazem", "indicacao_armazem", "status_armazem"].includes(n.type) },
  { id: "avisos", label: "Comunicados", match: (n) => ["aviso_fazenda", "aviso_admin"].includes(n.type) },
];

export default function Notifications() {
  const { user, refreshUnread } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("todos");
  const [composeOpen, setComposeOpen] = useState(false);

  function load() {
    return api.myNotifications()
      .then((data) => setNotifications(data.notifications))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
      refreshUnread();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleOpen(n) {
    if (!n.read_at) await markRead(n.id);
    if (n.plot_id) navigate(`/talhao/${n.plot_id}`);
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((list) => list.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      refreshUnread();
    } catch (err) {
      setError(err.message);
    }
  }

  const unread = notifications.filter((n) => !n.read_at).length;
  const active = CATEGORY_FILTERS.find((f) => f.id === filter) || CATEGORY_FILTERS[0];
  const filtered = notifications.filter(active.match);
  const canBroadcast = user?.role === "fazenda" || user?.role === "admin";

  return (
    <Page title="Avisos" width="narrow">
      <PageHeader
        title="Avisos"
        subtitle="Novidades dos talhões, da safra e comunicados."
        actions={
          <>
            {canBroadcast && <Button variant="secondary" icon={Megaphone} onClick={() => setComposeOpen(true)}>Enviar aviso</Button>}
            {unread > 0 && <Button variant="ghost" onClick={markAllRead}>Marcar todos como lidos</Button>}
          </>
        }
      />
      <ErrorBanner message={error} />

      <div style={{ marginBottom: 14 }}>
        <FilterChips label="Filtrar avisos" value={filter} onChange={setFilter}
          options={CATEGORY_FILTERS.map((f) => ({ id: f.id, label: f.label, count: notifications.filter(f.match).length }))} />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState image="/icons/icon_germinando_meu_talhao.svg" title={notifications.length ? "Nada neste filtro" : "Nenhum aviso ainda"}>
          {notifications.length ? "Escolha outro filtro para ver mais avisos." : "Quando a safra avançar ou houver um pagamento, você fica sabendo por aqui."}
        </EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {filtered.map((n) => {
            const grainIcon = (n.type === "novo_talhao" || n.type === "atualizacao_safra") && n.plot_grao ? GRAIN_ICONS[n.plot_grao] : null;
            const imageIcon = grainIcon || (typeof TYPE_ICON[n.type] === "string" ? TYPE_ICON[n.type] : null);
            const Icon = !imageIcon ? TYPE_ICON[n.type] || Megaphone : null;
            const isUnread = !n.read_at;
            return (
              <li key={n.id}>
                <button type="button" className={`list-item ${isUnread ? "list-item--unread" : ""}`} onClick={() => handleOpen(n)} style={{ alignItems: "flex-start" }}>
                  <span className="thumb thumb--round" style={{ width: 40, height: 40, background: imageIcon ? "var(--bg)" : isUnread ? "var(--primary-soft)" : "var(--surface-well)" }}>
                    {imageIcon ? <img src={imageIcon} alt="" style={{ width: 24, height: 24 }} /> : <Icon size={18} color={isUnread ? "var(--primary)" : "var(--text-2)"} aria-hidden />}
                  </span>
                  <span className="list-item-body">
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span className="list-item-title" style={{ fontWeight: isUnread ? 700 : 500 }}>
                        {isUnread && <span className="sr-only">Não lido: </span>}{n.title}
                      </span>
                      {isUnread && <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--brand-orange)", marginTop: 6, flexShrink: 0 }} />}
                    </span>
                    <span className="list-item-sub" style={{ display: "block", lineHeight: 1.45 }}>{n.body}</span>
                    <span className="text-xs text-3" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>
                      {n.plot_id && <span style={{ color: "var(--link)", fontWeight: 700, display: "inline-flex", alignItems: "center" }}>Ver talhão <ChevronRight size={14} aria-hidden /></span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canBroadcast && <BroadcastDialog open={composeOpen} onClose={() => setComposeOpen(false)} onSent={load} />}
    </Page>
  );
}

function BroadcastDialog({ open, onClose, onSent }) {
  const { user } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("investidores");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const data = user.role === "admin"
        ? await api.adminBroadcast({ target, title, body })
        : await api.farmBroadcast({ farm_id: user.farm_id, title, body });
      toast(`Aviso enviado para ${data.enviados} pessoa(s)`);
      setTitle(""); setBody("");
      onSent();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={user.role === "admin" ? "Aviso da administração" : "Aviso aos seus investidores"}>
      <form onSubmit={handleSend} className="stack">
        <ErrorBanner message={error} />
        {user.role === "admin" && (
          <SelectField label="Enviar para" value={target} onChange={setTarget}
            options={[{ value: "investidores", label: "Investidores" }, { value: "fazendas", label: "Fazendas" }, { value: "todos", label: "Todos" }]} />
        )}
        <TextField label="Título" value={title} onChange={setTitle} required maxLength={120} placeholder="Ex.: Plantio concluído no talhão 04" />
        <TextAreaField label="Mensagem" value={body} onChange={setBody} required rows={4} maxLength={1000} />
        <div className="dialog-actions" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" icon={Send} loading={sending}>Enviar aviso</Button>
        </div>
      </form>
    </Dialog>
  );
}
