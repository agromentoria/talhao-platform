import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

const BANNER_ICONS = { error: AlertCircle, success: CheckCircle2, warning: TriangleAlert, info: Info };

// Mensagem em linha. Erros são anunciados por leitores de tela (role="alert").
export function Banner({ tone = "info", title, children, className = "", style }) {
  if (!children && !title) return null;
  const Icon = BANNER_ICONS[tone] || Info;
  return (
    <div className={`banner banner--${tone} ${className}`} role={tone === "error" ? "alert" : "status"} style={style}>
      <Icon size={18} aria-hidden />
      <div>
        {title && <p className="banner-title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function ErrorBanner({ message, style }) {
  if (!message) return null;
  return <Banner tone="error" style={{ marginBottom: 14, ...style }}>{message}</Banner>;
}

export function SuccessBanner({ message, style }) {
  if (!message) return null;
  return <Banner tone="success" style={{ marginBottom: 14, ...style }}>{message}</Banner>;
}

export function EmptyState({ image, title, children, action }) {
  return (
    <div className="empty">
      {image && <img src={image} alt="" />}
      {title && <p className="empty-title">{title}</p>}
      {children && <p className="empty-text">{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = "Carregando…" }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <span className="spinner" aria-hidden /> {label}
    </div>
  );
}

export function Badge({ tone, children }) {
  return <span className={`badge ${tone ? `badge--${tone}` : ""}`}>{children}</span>;
}

export function ProgressBar({ value, color, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${v}%`, "--bar": color }} />
    </div>
  );
}
