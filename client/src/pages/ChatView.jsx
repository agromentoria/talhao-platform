import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import { api } from "../lib/api";
import { fmtTime, fmtDayLabel } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { ErrorBanner, Loading } from "../components/ui";

const POLL_MS = 10_000;
const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

// Conversa em rota própria (/conversas/:id): o botão voltar do Android e do
// navegador volta para a lista, em vez de sair da tela de conversas.
export default function ChatView() {
  const { id } = useParams();
  const location = useLocation();
  const { user, refreshUnreadMessages } = useAuth();
  const [name, setName] = useState(location.state?.name || "");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastCount = useRef(0);

  const load = useCallback(() => {
    return api.conversationMessages(id)
      .then((data) => { setMessages(data.messages); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load().then(() => refreshUnreadMessages?.());
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load, refreshUnreadMessages]);

  // nome do contato quando a pessoa abre o link direto
  useEffect(() => {
    if (name) return;
    api.myConversations().then((data) => {
      const c = data.conversations.find((x) => String(x.conversation_id) === String(id));
      if (c) setName(c.other_name);
    }).catch(() => {});
  }, [id, name]);

  // rola para a última mensagem só quando chega mensagem nova
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      await api.sendMessage(id, body);
      setText("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e) {
    // no computador Enter envia (Shift+Enter quebra linha); no celular Enter quebra linha
    if (e.key === "Enter" && !e.shiftKey && !isTouch) { e.preventDefault(); handleSend(); }
  }

  let lastDay = null;

  return (
    <Page title={name || "Conversa"} back="/conversas" hideTabBar fill width="narrow">
      <PageHeader title={name || "Conversa"} back="/conversas" backLabel="Conversas" />
      <ErrorBanner message={error} />
      <div className="chat-messages" ref={listRef} role="log" aria-live="polite" aria-label={`Mensagens com ${name}`}>
        {loading && <Loading />}
        {!loading && messages.length === 0 && <p className="text-sm text-2" style={{ textAlign: "center", marginTop: 20 }}>Envie a primeira mensagem.</p>}
        {messages.map((m) => {
          const mine = m.sender_user_id === user.id;
          const day = new Date(m.created_at).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {showDay && <p className="chat-day">{fmtDayLabel(m.created_at)}</p>}
              <div className={`bubble ${mine ? "bubble--mine" : "bubble--theirs"}`}>
                {!mine && <p className="bubble-author">{m.sender_name}</p>}
                <p className="bubble-text">{m.body}</p>
                <p className="bubble-time"><time dateTime={m.created_at}>{fmtTime(m.created_at)}</time></p>
              </div>
            </Fragment>
          );
        })}
      </div>
      <form className="composer" onSubmit={handleSend}>
        <label htmlFor="chat-input" className="sr-only">Mensagem</label>
        <textarea
          id="chat-input"
          className="textarea"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escreva uma mensagem"
          enterKeyHint={isTouch ? "enter" : "send"}
          maxLength={2000}
        />
        <button type="submit" className="icon-btn" disabled={sending || !text.trim()} aria-label="Enviar mensagem"
          style={{ background: "var(--primary)", color: "#fff", opacity: sending || !text.trim() ? 0.5 : 1 }}>
          <Send size={18} aria-hidden />
        </button>
      </form>
    </Page>
  );
}
