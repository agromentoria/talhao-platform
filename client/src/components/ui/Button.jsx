import { forwardRef } from "react";
import { Link } from "react-router-dom";

// Botão único do app. variant: primary | secondary | success | ghost | danger | danger-ghost | on-dark
// Passe `to` para virar um link de navegação com a mesma aparência.
export const Button = forwardRef(function Button(
  { variant = "primary", size, block, loading, icon: Icon, children, className = "", to, type = "button", disabled, ...rest },
  ref
) {
  const cls = ["btn", `btn--${variant}`, size && `btn--${size}`, block && "btn--block", className].filter(Boolean).join(" ");
  const content = (
    <>
      {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: "currentColor" }} aria-hidden /> : Icon && <Icon size={size === "sm" ? 16 : 18} aria-hidden />}
      {children}
    </>
  );
  if (to) {
    return <Link ref={ref} to={to} className={cls} {...rest}>{content}</Link>;
  }
  return (
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

// Botão só com ícone — sempre com rótulo acessível (VoiceOver/TalkBack)
export const IconButton = forwardRef(function IconButton({ label, icon: Icon, size = 22, className = "", badge, variant, to, ...rest }, ref) {
  const cls = ["icon-btn", variant && `icon-btn--${variant}`, className].filter(Boolean).join(" ");
  const inner = (
    <>
      <Icon size={size} aria-hidden />
      {badge > 0 && <span className="nav-count" aria-hidden>{badge > 9 ? "9+" : badge}</span>}
    </>
  );
  const a11yLabel = badge > 0 ? `${label} (${badge} não lidos)` : label;
  if (to) return <Link ref={ref} to={to} className={cls} aria-label={a11yLabel} title={label} {...rest}>{inner}</Link>;
  return (
    <button ref={ref} type="button" className={cls} aria-label={a11yLabel} title={label} {...rest}>
      {inner}
    </button>
  );
});
