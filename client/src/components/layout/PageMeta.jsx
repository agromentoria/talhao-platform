import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Cada página informa seu título (aba do navegador + barra superior do
// celular) e se tem "voltar". No celular o voltar fica na barra superior,
// como no iOS (navigation bar) e no Android (top app bar).
const PageMetaContext = createContext({ meta: {}, setMeta: () => {} });

export function PageMetaProvider({ children }) {
  const [meta, setMetaState] = useState({});
  const setMeta = useCallback((m) => setMetaState(m), []);
  return <PageMetaContext.Provider value={{ meta, setMeta }}>{children}</PageMetaContext.Provider>;
}

export function usePageMetaState() {
  return useContext(PageMetaContext).meta;
}

export function usePageMeta({ title, back, hideTabBar = false }) {
  const { setMeta } = useContext(PageMetaContext);
  useEffect(() => {
    document.title = title ? `${title} · Meu Talhão` : "Meu Talhão — Investindo no agro";
    setMeta({ title, back, hideTabBar });
  }, [title, back, hideTabBar, setMeta]);
}

// volta uma tela; se a pessoa chegou direto por um link, vai para o destino padrão
export function useBack(fallback = "/") {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = window.history.state?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(typeof fallback === "string" ? fallback : "/", { replace: true });
  }, [navigate, fallback]);
}
