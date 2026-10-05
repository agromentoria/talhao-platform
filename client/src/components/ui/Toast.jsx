import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle } from "lucide-react";

// Confirmações rápidas ("Salvo", "Compra confirmada"). Anunciadas por leitor
// de tela via aria-live, somem sozinhas em 4 s.
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const toast = useCallback((message, { tone = "success", duration = 4000 } = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div className="toast-region" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone === "error" ? "toast--error" : ""}`} role="status">
              {t.tone === "error" ? <AlertCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
