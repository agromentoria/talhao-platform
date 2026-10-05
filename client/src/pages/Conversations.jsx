import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserRound, Plus } from "lucide-react";
import { ICONS, GRAIN_ICONS } from "../config/theme";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, ErrorBanner, EmptyState, Loading, Dialog } from "../components/ui";

export function ContactAvatar({ role, avatar, size = 44 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: "#fff", color: "var(--success-text)", boxShadow: "var(--shadow-1)" }}>
      {role === "fazenda" ? <img src={ICONS.fazendas} alt="" style={{ width: "70%", height: "70%", objectFit: "contain" }} />
        : avatar ? <img src={avatar} alt="" /> : <UserRound size={Math.round(size * 0.45)} aria-hidden />}
    </span>
  );
}

export default function Conversations() {
  const { user, refreshUnreadMessages } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [startable, setStartable] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myConversations()
      .then((data) => { setConversations(data.conversations); setStartable(data.startable); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    refreshUnreadMessages?.();
  }, [refreshUnreadMessages]);

  async function startWith(contact) {
    setError("");
    try {
      const data = await api.startConversation(contact.user_id);
      setShowNew(false);
      navigate(`/conversas/${data.conversation.id}`, { state: { name: contact.name } });
    } catch (err) {
      setError(err.message);
    }
  }

  const subtitle = {
    fazenda: "Fale com seus investidores.",
    investidor: "Fale direto com as fazendas onde você investiu.",
    admin: "Fale com fazendas e investidores da plataforma.",
  }[user?.role];

  const emptyText = {
    investidor: "Depois de investir em um talhão, você pode conversar com a fazenda por aqui.",
    fazenda: "Quando um investidor mandar mensagem, ela aparece aqui. Você também pode começar uma conversa.",
    admin: "Nenhuma conversa iniciada ainda.",
  }[user?.role];

  return (
    <Page title="Conversas" width="narrow">
      <PageHeader
        title="Conversas"
        subtitle={subtitle}
        actions={startable.length > 0 && <Button icon={Plus} onClick={() => setShowNew(true)}>Nova conversa</Button>}
      />
      <ErrorBanner message={error} />

      {loading ? <Loading /> : conversations.length === 0 ? (
        <EmptyState image={ICONS.fazendas} title="Nenhuma conversa ainda">{emptyText}</EmptyState>
      ) : (
        <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {conversations.map((c) => (
            <li key={c.conversation_id}>
              <Link
                to={`/conversas/${c.conversation_id}`}
                state={{ name: c.other_name }}
                className={`list-item ${c.nao_lidas > 0 ? "list-item--unread" : ""}`}
                aria-label={c.nao_lidas > 0 ? `${c.other_name}, ${c.nao_lidas} mensagens não lidas` : undefined}
              >
                <ContactAvatar role={c.other_role} avatar={c.other_avatar} />
                <div className="list-item-body">
                  <p className="list-item-title truncate" style={{ fontWeight: c.nao_lidas > 0 ? 800 : 600 }}>{c.other_name}</p>
                  <p className="list-item-sub truncate">{c.ultima_mensagem || c.farm_location || "Toque para conversar"}</p>
                </div>
                <div className="list-item-meta">
                  <span style={{ display: "flex" }} aria-hidden>
                    {(c.graos || []).slice(0, 2).map((g, i) => (
                      <span key={g} className="thumb thumb--round" style={{ width: 26, height: 26, marginLeft: i ? -8 : 0, border: "1px solid var(--border)" }}>
                        <img src={GRAIN_ICONS[g]} alt="" style={{ width: 16, height: 16 }} />
                      </span>
                    ))}
                  </span>
                  {c.nao_lidas > 0 && <span className="nav-count" aria-hidden>{c.nao_lidas > 9 ? "9+" : c.nao_lidas}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={showNew} onClose={() => setShowNew(false)} title="Nova conversa">
        <ContactPicker contacts={startable} onSelect={startWith} />
      </Dialog>
    </Page>
  );
}

function ContactPicker({ contacts, onSelect }) {
  const groups = [
    { label: "Fazendas", items: contacts.filter((c) => c.role === "fazenda") },
    { label: "Investidores", items: contacts.filter((c) => c.role === "investidor") },
  ].filter((g) => g.items.length);

  if (!groups.length) return <p>Nenhum contato disponível no momento.</p>;
  return groups.map((g) => (
    <section key={g.label} style={{ marginBottom: 16 }}>
      <h3 className="text-sm" style={{ fontFamily: "var(--font-body)", fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>{g.label}</h3>
      <div className="list">
        {g.items.map((c) => (
          <button key={c.user_id} type="button" className="list-item" onClick={() => onSelect(c)}>
            <ContactAvatar role={c.role} avatar={c.avatar} size={40} />
            <div className="list-item-body">
              <p className="list-item-title">{c.name}</p>
              {c.farm_location && <p className="list-item-sub">{c.farm_location}</p>}
            </div>
          </button>
        ))}
      </div>
    </section>
  ));
}
