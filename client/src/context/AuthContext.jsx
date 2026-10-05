import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api, saveToken, clearToken, setUnauthorizedHandler } from "../lib/api";
import { tokenStorage } from "../lib/storage";

const AuthContext = createContext(null);

// tempo mínimo da tela de carregamento — evita um "pisca" quase invisível
const TEMPO_MINIMO_CARREGAMENTO = 600;
const INTERVALO_CONTADORES = 60_000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const userRef = useRef(null);
  userRef.current = user;

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // sessão expirada em qualquer chamada da API → desloga e volta ao login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (userRef.current) logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const refreshUnread = useCallback(() => {
    api.myNotifications().then((data) => setUnreadCount(data.unread)).catch(() => {});
  }, []);

  const refreshUnreadMessages = useCallback(() => {
    api.unreadMessagesCount().then((data) => setUnreadMessages(data.count)).catch(() => {});
  }, []);

  useEffect(() => {
    const inicio = Date.now();
    const finalizar = () => {
      const faltam = TEMPO_MINIMO_CARREGAMENTO - (Date.now() - inicio);
      if (faltam > 0) setTimeout(() => setLoading(false), faltam);
      else setLoading(false);
    };
    if (!tokenStorage.get()) { finalizar(); return; }
    api.me()
      .then((data) => setUser(data.user))
      .catch((err) => { if (err.status === 401 || err.status === 404) clearToken(); })
      .finally(finalizar);
  }, []);

  // contadores de não lidos: a cada minuto e sempre que o app volta ao
  // primeiro plano (trocar de app no celular, voltar à aba no desktop)
  useEffect(() => {
    if (!user) { setUnreadCount(0); setUnreadMessages(0); return; }
    const refreshAll = () => { refreshUnread(); refreshUnreadMessages(); };
    refreshAll();
    const interval = setInterval(() => { if (document.visibilityState === "visible") refreshAll(); }, INTERVALO_CONTADORES);
    const onVisible = () => { if (document.visibilityState === "visible") refreshAll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [user?.id, refreshUnread, refreshUnreadMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(email, password) {
    const data = await api.login(email.trim(), password);
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    const data = await api.register(payload);
    saveToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function deleteAccount(password) {
    await api.deleteAccount(password);
    logout();
  }

  // usado pelo perfil após trocar avatar/dados/senha
  function updateSession(data) {
    if (data.token) saveToken(data.token);
    if (data.user) setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, deleteAccount, updateSession,
      unreadCount, refreshUnread, unreadMessages, refreshUnreadMessages,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
