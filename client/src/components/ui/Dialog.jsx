import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button, IconButton } from "./Button";
import { TextAreaField } from "./Field";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogo modal: folha inferior (bottom sheet) no celular e janela central no
// tablet/desktop. Prende o foco, fecha com Esc, com toque fora e com o botão
// voltar do Android (via data-dialog-close, ver lib/native.js).
export function Dialog({ open, onClose, title, children, actions, width, dismissible = true }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const lastFocus = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Esc no documento todo: se o foco sair do diálogo (ex.: botão que ficou
  // desabilitado durante o envio), Esc continua fechando
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e) => { if (e.key === "Escape") onCloseRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismissible]);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector("[autofocus], [data-autofocus]") || panelRef.current?.querySelector(FOCUSABLE);
      (el || panelRef.current)?.focus();
    });
    return () => {
      document.body.style.overflow = overflow;
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  function onKeyDown(e) {
    if (e.key !== "Tab") return;
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && dismissible) onClose?.(); }} onKeyDown={onKeyDown}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={width ? { "--dialog-w": `${width}px` } : undefined}
      >
        <div className="dialog-grabber" aria-hidden />
        {(title || dismissible) && (
          <div className="dialog-head">
            {title ? <h2 id={titleId} className="dialog-title">{title}</h2> : <span />}
            {dismissible && <IconButton label="Fechar" icon={X} onClick={onClose} data-dialog-close />}
          </div>
        )}
        <div className="dialog-body">{children}</div>
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>,
    document.body
  );
}

// ---------- confirm()/prompt() com a cara do app ----------
// window.confirm/prompt aparecem como alerta do navegador (com o endereço do
// site no título) — fora do padrão visual exigido para apps nas lojas.
const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [state, setState] = useState(null);
  const [text, setText] = useState("");

  const close = useCallback((result) => {
    setState((s) => { s?.resolve(result); return null; });
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({ kind: "confirm", resolve, ...(typeof opts === "string" ? { message: opts } : opts) });
  }), []);

  const prompt = useCallback((opts) => new Promise((resolve) => {
    setText(opts.defaultValue || "");
    setState({ kind: "prompt", resolve, ...opts });
  }), []);

  const isPrompt = state?.kind === "prompt";
  const promptInvalid = isPrompt && state.required && text.trim().length < (state.minLength || 1);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      <Dialog
        open={!!state}
        onClose={() => close(isPrompt ? null : false)}
        title={state?.title || (isPrompt ? "Informe" : "Confirmar")}
        actions={
          <>
            <Button variant="secondary" onClick={() => close(isPrompt ? null : false)}>{state?.cancelLabel || "Cancelar"}</Button>
            <Button
              variant={state?.destructive ? "danger" : "primary"}
              disabled={promptInvalid}
              onClick={() => close(isPrompt ? text.trim() : true)}
              data-autofocus={!isPrompt || undefined}
            >
              {state?.confirmLabel || "Confirmar"}
            </Button>
          </>
        }
      >
        {state?.message && <p style={{ marginBottom: isPrompt ? 14 : 0 }}>{state.message}</p>}
        {isPrompt && (
          <TextAreaField
            label={state.label}
            value={text}
            onChange={setText}
            placeholder={state.placeholder}
            rows={3}
            data-autofocus
            hint={state.minLength ? `Mínimo de ${state.minLength} caracteres.` : undefined}
          />
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}
