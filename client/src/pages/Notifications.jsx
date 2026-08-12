import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Megaphone, CheckCircle2, TrendingUp, Wallet, Receipt, ClipboardCheck, XCircle } from "lucide-react";
import { COLORS, ICONS, GRAIN_ICONS } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

// ícone padrão (lucide) para avisos sem talhão associado
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
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} dia(s) atrás`;
}

export default function Notifications() {
  const { user, refreshUnread } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.myNotifications()
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

  async function handleClick(n) {
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

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Avisos</h1>
          <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: 0 }}>Novidades de talhões, safras e comunicados.</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 12.5, color: COLORS.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
            Marcar todos como lidos
          </button>
        )}
      </div>

      <ErrorBanner message={error} />

      {(user?.role === "fazenda" || user?.role === "admin") && <SendBroadcast onSent={load} />}

      {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
      {!loading && notifications.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhum aviso por aqui ainda.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {notifications.map((n) => {
          const commodityIcon = (n.type === "novo_talhao" || n.type === "atualizacao_safra") && n.plot_grao
            ? GRAIN_ICONS[n.plot_grao]
            : null;
          const imageIcon = commodityIcon || (typeof TYPE_ICON[n.type] === "string" ? TYPE_ICON[n.type] : null);
          const LucideIcon = !imageIcon ? (TYPE_ICON[n.type] || Megaphone) : null;
          const unread = !n.read_at;
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                display: "flex", gap: 12, textAlign: "left", padding: "14px 16px", borderRadius: 12,
                background: unread ? "#fff" : COLORS.bgCard, border: `1px solid ${COLORS.line}`,
                cursor: unread || n.plot_id ? "pointer" : "default",
                boxShadow: unread ? "0 2px 8px rgba(58,46,34,0.08)" : "none",
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: imageIcon ? COLORS.bg : (unread ? `${COLORS.orange}18` : COLORS.line), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: imageIcon ? "0 1px 4px rgba(58,46,34,0.1)" : "none" }}>
                {imageIcon ? (
                  <img src={imageIcon} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                ) : (
                  <LucideIcon size={16} color={unread ? COLORS.orange : COLORS.soilLight} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: 13.5, fontWeight: unread ? 700 : 500, color: COLORS.soil, margin: 0 }}>{n.title}</p>
                  {unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.orange, marginTop: 4, flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "3px 0 0", lineHeight: 1.4 }}>{n.body}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                  <p style={{ fontSize: 11, color: COLORS.clay, margin: 0 }}>{timeAgo(n.created_at)}</p>
                  {n.plot_id && <span style={{ fontSize: 11, color: COLORS.orange, fontWeight: 600 }}>Ver talhão →</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SendBroadcast({ onSent }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("investidores");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    setSending(true);
    try {
      let data;
      if (user.role === "admin") {
        data = await api.adminBroadcast({ target, title, body });
      } else {
        data = await api.farmBroadcast({ farm_id: user.farm_id, title, body });
      }
      setSuccess(`Aviso enviado para ${data.enviados} pessoa(s).`);
      setTitle(""); setBody("");
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer",
        fontSize: 13.5, fontWeight: 600, color: COLORS.soil, padding: 0, width: "100%",
      }}>
        <Megaphone size={16} color={COLORS.orange} />
        {user.role === "admin" ? "Enviar aviso da administração" : "Enviar aviso aos seus investidores"}
        <span style={{ marginLeft: "auto", fontSize: 18, color: COLORS.soilLight }}>{open ? "–" : "+"}</span>
      </button>

      {open && (
        <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <ErrorBanner message={error} />
          {success && <p style={{ fontSize: 12.5, color: COLORS.leaf, margin: 0 }}>{success}</p>}

          {user.role === "admin" && (
            <div>
              <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Enviar para</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
                <option value="investidores">Investidores</option>
                <option value="fazendas">Fazendas</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} placeholder="Ex: Atualização importante" />
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Mensagem</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="Escreva o aviso..." />
          </div>
          <button type="submit" disabled={sending} style={{
            padding: "10px 0", borderRadius: 10, border: "none", background: COLORS.orange, color: "#fff",
            fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: sending ? 0.7 : 1,
          }}>
            {sending ? "Enviando..." : "Enviar aviso"}
          </button>
        </form>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 13.5, background: "#fff", fontFamily: "inherit" };
