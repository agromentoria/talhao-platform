// Seleções: chips de filtro, controle segmentado e abas.

// Chips de filtro (rolam lateralmente no celular). options: [{ id, label, count?, icon? }]
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.icon && <span className="chip-icon"><img src={o.icon} alt="" /></span>}
          {o.label}
          {o.count != null && <span className="chip-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// Controle segmentado (2–4 opções mutuamente exclusivas)
export function Segmented({ options, value, onChange, label, className = "" }) {
  return (
    <div className={`segmented ${className}`} role="group" aria-label={label}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
            {Icon && <Icon size={16} aria-hidden />} {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Abas de página com navegação por setas (padrão WAI-ARIA)
export function Tabs({ tabs, value, onChange, label }) {
  function onKeyDown(e) {
    const i = tabs.findIndex((t) => t.id === value);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
      onChange(next.id);
      requestAnimationFrame(() => document.getElementById(`tab-${next.id}`)?.focus());
    }
  }
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}{t.count ? ` (${t.count})` : ""}
        </button>
      ))}
    </div>
  );
}
