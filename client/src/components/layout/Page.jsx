import { ChevronLeft } from "lucide-react";
import { usePageMeta, useBack } from "./PageMeta";

// Container padrão de página: largura máxima, margens responsivas e áreas seguras.
// width: "narrow" (formulários, listas) | "medium" | padrão (grades largas)
export function Page({ title, back, hideTabBar, width, fill, className = "", children }) {
  usePageMeta({ title, back, hideTabBar });
  const cls = ["page", width && `page--${width}`, fill && "page--fill", className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}

// Cabeçalho visível da página. No celular o botão voltar some daqui e vai
// para a barra superior.
export function PageHeader({ title, subtitle, back, backLabel = "Voltar", actions, leading }) {
  const goBack = useBack(typeof back === "string" ? back : "/");
  return (
    <>
      {back && (
        <button type="button" className="page-back" onClick={goBack}>
          <ChevronLeft size={18} aria-hidden /> {backLabel}
        </button>
      )}
      <header className="page-header">
        <div className="page-header-text" style={leading ? { display: "flex", gap: 14, alignItems: "center" } : undefined}>
          {leading}
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
    </>
  );
}
