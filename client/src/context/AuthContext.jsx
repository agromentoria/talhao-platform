import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, saveToken, clearToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const refreshUnread = useCallback(() => {
    api.myNotifications()
      .then((data) => setUnreadCount(data.unread))
      .catch(() => {});
  }, []);

  const refreshUnreadMessages = useCallback(() => {
    api.unreadMessagesCount()
      .then((data) => setUnreadMessages(data.count))
      .catch(() => {});
  }, []);

  // tempo mínimo que a tela de carregamento fica visível — sem isso, quando
  // não há sessão salva a verificação termina instantaneamente e a tela
  // pisca por uma fração de segundo, praticamente invisível
  const TEMPO_MINIMO_CARREGAMENTO = 700;

  useEffect(() => {
    const inicio = Date.now();
    function finalizarCarregamento() {
      const decorrido = Date.now() - inicio;
      const faltam = TEMPO_MINIMO_CARREGAMENTO - decorrido;
      if (faltam > 0) {
        setTimeout(() => setLoading(false), faltam);
      } else {
        setLoading(false);
      }
    }

    const token = localStorage.getItem("talhao_token");
    if (!token) {
      finalizarCarregamento();
      return;
    }
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(finalizarCarregamento);
  }, []);

  useEffect(() => {
    if (!user) { setUnreadCount(0); setUnreadMessages(0); return; }
    refreshUnread();
    refreshUnreadMessages();
    const interval = setInterval(() => { refreshUnread(); refreshUnreadMessages(); }, 60000); // a cada minuto
    return () => clearInterval(interval);
  }, [user, refreshUnread, refreshUnreadMessages]);

  async function login(email, password) {
    const data = await api.login(email, password);
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

  function logout() {
    clearToken();
    setUser(null);
  }

  // usado pela página de perfil após trocar avatar/dados/senha
  function updateSession(data) {
    if (data.token) saveToken(data.token);
    if (data.user) setUser(data.user);
  }

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateSession,
      unreadCount, refreshUnread, unreadMessages, refreshUnreadMessages,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
