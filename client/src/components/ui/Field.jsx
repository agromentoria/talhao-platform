import { useId } from "react";

// Campos com rótulo associado (htmlFor/id), dica e erro — necessário para
// VoiceOver/TalkBack lerem o nome do campo e para o toque no rótulo focar o campo.
function FieldShell({ id, label, icon: Icon, hint, error, className = "", style, children }) {
  return (
    <div className={`field ${className}`} style={style}>
      {label && (
        <label htmlFor={id} className="field-label">
          {Icon && <Icon size={14} aria-hidden />} {label}
        </label>
      )}
      {children}
      {error ? <span id={`${id}-error`} className="field-error">{error}</span> : hint ? <span id={`${id}-hint`} className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, icon, hint, error, onChange, className, style, inputClassName = "", value, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} icon={icon} hint={hint} error={error} className={className} style={style}>
      <input
        id={id}
        className={`input ${inputClassName}`}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value, e)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({ label, icon, hint, error, onChange, options, children, className, style, value, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} icon={icon} hint={hint} error={error} className={className} style={style}>
      <select
        id={id}
        className="select"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value, e)}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {options
          ? options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>))
          : children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, icon, hint, error, onChange, className, style, value, ...props }) {
  const autoId = useId();
  const id = props.id || autoId;
  return (
    <FieldShell id={id} label={label} icon={icon} hint={hint} error={error} className={className} style={style}>
      <textarea
        id={id}
        className="textarea"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value, e)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
    </FieldShell>
  );
}
