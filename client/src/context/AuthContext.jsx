import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, saveToken, clearToken } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(() => {
    api.myNotifications()
      .then((data) => setUnreadCount(data.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("talhao_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    refreshUnread();
    const interval = setInterval(refreshUnread, 60000); // atualiza a cada minuto
    return () => clearInterval(interval);
  }, [user, refreshUnread]);

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
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateSession, unreadCount, refreshUnread }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
