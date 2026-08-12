import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Send, User, Plus, X } from "lucide-react";
import { COLORS, ICONS, GRAIN_ICONS } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

function timeShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Conversations() {
  const { user, refreshUnreadMessages } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [startable, setStartable] = useState([]);
  const [active, setActive] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.myConversations()
      .then((data) => { setConversations(data.conversations); setStartable(data.startable); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function openConversation(conversationId, name) {
    setActive({ id: conversationId, name });
  }

  async function startWith(contact) {
    setError("");
    try {
      const data = await api.startConversation(contact.user_id);
      setShowNew(false);
      setActive({ id: data.conversation.id, name: contact.name });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleCloseChat() {
    setActive(null);
    load();
    refreshUnreadMessages?.();
  }

  if (active) {
    return <ChatView conversationId={active.id} name={active.name} onBack={handleCloseChat} />;
  }

  const emptyLabel = {
    investidor: "Invista em um talhão para poder conversar com a fazenda.",
    fazenda: "Nenhum investidor iniciou conversa ainda — você também pode começar uma.",
    admin: "Nenhuma conversa iniciada ainda.",
  }[user?.role];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Conversas</h1>
          <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: 0 }}>
            {user?.role === "fazenda" && "Fale com seus investidores."}
            {user?.role === "investidor" && "Fale diretamente com as fazendas onde você investiu."}
            {user?.role === "admin" && "Fale com fazendas e investidores da plataforma."}
          </p>
        </div>
        {startable.length > 0 && (
          <button onClick={() => setShowNew(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 20, border: "none",
            background: COLORS.orange, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
          }}>
            <Plus size={15} /> Nova
          </button>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <ErrorBanner message={error} />
        {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
        {!loading && conversations.length === 0 && (
          <p style={{ fontSize: 13, color: COLORS.soilLight }}>{emptyLabel}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {conversations.map((c) => (
            <button key={c.conversation_id} onClick={() => openConversation(c.conversation_id, c.other_name)} style={{
              display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: COLORS.bgCard,
              border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", width: "100%",
            }}>
              <ContactAvatar contact={{ role: c.other_role, avatar: c.other_avatar }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: c.nao_lidas > 0 ? 700 : 600, color: COLORS.soil, margin: 0 }}>{c.other_name}</p>
                <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.ultima_mensagem || c.farm_location || "Toque para conversar"}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {(c.graos || []).slice(0, 2).map((g, gi) => (
                  <div key={g} title={g} style={{
                    width: 22, height: 22, borderRadius: "50%", background: COLORS.bg, display: "flex",
                    alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(58,46,34,0.12)",
                    marginLeft: gi > 0 ? -8 : 0, border: `1px solid ${COLORS.line}`,
                  }}>
                    <img src={GRAIN_ICONS[g]} alt={g} style={{ width: 14, height: 14, objectFit: "contain" }} />
                  </div>
                ))}
                {c.nao_lidas > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: 10, background: COLORS.danger, color: "#fff",
                    fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px",
                  }}>{c.nao_lidas > 9 ? "9+" : c.nao_lidas}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {showNew && (
        <NewConversationModal
          contacts={startable}
          onSelect={startWith}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function ContactAvatar({ contact }) {
  return (
    <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
      {contact.role === "fazenda" ? (
        <img src={ICONS.fazendas} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
      ) : contact.avatar ? (
        <img src={contact.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <User size={17} color={COLORS.leaf} />
      )}
    </div>
  );
}

function NewConversationModal({ contacts, onSelect, onClose }) {
  const farms = contacts.filter((c) => c.role === "fazenda");
  const investors = contacts.filter((c) => c.role === "investidor");

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(52,37,25,0.4)", zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 480,
        maxHeight: "70vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, color: COLORS.soil, margin: 0 }}>Iniciar conversa</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        {farms.length > 0 && (
          <>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.soilLight, textTransform: "uppercase", margin: "0 0 8px" }}>Fazendas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {farms.map((c) => (
                <button key={c.user_id} onClick={() => onSelect(c)} style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: COLORS.bg,
                  border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                }}>
                  <ContactAvatar contact={c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{c.name}</p>
                    <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "1px 0 0" }}>{c.farm_location}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {investors.length > 0 && (
          <>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.soilLight, textTransform: "uppercase", margin: "0 0 8px" }}>Investidores</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {investors.map((c) => (
                <button key={c.user_id} onClick={() => onSelect(c)} style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: COLORS.bg,
                  border: "none", borderRadius: 10, padding: "10px 12px", cursor: "pointer",
                }}>
                  <ContactAvatar contact={c} />
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{c.name}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {farms.length === 0 && investors.length === 0 && (
          <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhum contato disponível no momento.</p>
        )}
      </div>
    </div>
  );
}

function ChatView({ conversationId, name, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  function load() {
    api.conversationMessages(conversationId)
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [conversationId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.sendMessage(conversationId, text.trim());
      setText("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: "20px 20px 0", maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 110px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
          <ArrowLeft size={18} />
        </button>
        <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, color: COLORS.soil, margin: 0 }}>{name}</p>
      </div>

      <ErrorBanner message={error} />

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingBottom: 12 }}>
        {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
        {!loading && messages.length === 0 && (
          <p style={{ fontSize: 13, color: COLORS.soilLight, textAlign: "center", marginTop: 20 }}>Envie a primeira mensagem.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_user_id === user.id;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "75%", padding: "9px 13px", borderRadius: 14,
                background: mine ? COLORS.orange : "#fff", color: mine ? "#fff" : COLORS.soil,
                borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
                boxShadow: "0 1px 4px rgba(58,46,34,0.08)",
              }}>
                {!mine && <p style={{ fontSize: 10.5, fontWeight: 700, margin: "0 0 2px", opacity: 0.7 }}>{m.sender_name}</p>}
                <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{m.body}</p>
                <p style={{ fontSize: 9.5, margin: "3px 0 0", opacity: 0.7, textAlign: "right" }}>{timeShort(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: "flex", gap: 8, padding: "12px 0 20px", borderTop: `1px solid ${COLORS.line}` }}>
        <input
          value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem..."
          style={{ flex: 1, padding: "11px 14px", borderRadius: 20, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
        />
        <button type="submit" disabled={sending || !text.trim()} style={{
          width: 44, height: 44, borderRadius: "50%", border: "none", background: COLORS.orange, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
          opacity: sending || !text.trim() ? 0.6 : 1,
        }}>
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
