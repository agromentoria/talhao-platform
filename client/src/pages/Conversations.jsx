import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Send, User } from "lucide-react";
import { COLORS, ICONS, GRAIN_ICONS } from "../theme";
import { ErrorBanner } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

function timeShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Conversations() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.myConversations()
      .then((data) => setList(data.conversations))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function openConversation(item) {
    setError("");
    if (item.conversation_id) {
      setActive({ id: item.conversation_id, name: item.farm_name || item.investor_name });
      return;
    }
    try {
      const data = await api.startConversation(item.farm_id);
      setActive({ id: data.conversation.id, name: item.farm_name });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (active) {
    return <ChatView conversationId={active.id} name={active.name} onBack={() => setActive(null)} />;
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Conversas</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px" }}>
        {user?.role === "fazenda" ? "Fale com seus investidores." : "Fale diretamente com as fazendas onde você investiu."}
      </p>

      <ErrorBanner message={error} />
      {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
      {!loading && list.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.soilLight }}>
          {user?.role === "fazenda" ? "Nenhum investidor iniciou conversa ainda." : "Invista em um talhão para poder conversar com a fazenda."}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((item, i) => {
          const name = item.farm_name || item.investor_name;
          const subtitle = item.farm_location || null;
          const graos = (item.graos || []).filter(Boolean);
          return (
            <button key={i} onClick={() => openConversation(item)} style={{
              display: "flex", alignItems: "center", gap: 12, textAlign: "left", background: COLORS.bgCard,
              border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer",
            }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                {item.farm_name ? (
                  <img src={ICONS.fazendas} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
                ) : item.investor_avatar ? (
                  <img src={item.investor_avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <User size={17} color={COLORS.leaf} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{name}</p>
                <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.ultima_mensagem || subtitle || "Toque para iniciar a conversa"}
                </p>
              </div>
              {graos.length > 0 && (
                <div style={{ display: "flex", flexShrink: 0 }}>
                  {graos.slice(0, 3).map((g, gi) => (
                    <div key={g} title={g} style={{
                      width: 24, height: 24, borderRadius: "50%", background: "#fff", display: "flex",
                      alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(58,46,34,0.12)",
                      marginLeft: gi > 0 ? -8 : 0, border: `1px solid ${COLORS.line}`,
                    }}>
                      <img src={GRAIN_ICONS[g]} alt={g} style={{ width: 15, height: 15, objectFit: "contain" }} />
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
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
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(58,46,34,0.1)" }}>
          {user.role === "investidor" ? (
            <img src={ICONS.fazendas} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
          ) : (
            <User size={16} color={COLORS.leaf} />
          )}
        </div>
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
