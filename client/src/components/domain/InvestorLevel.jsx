import { Sprout, Wheat, Trophy } from "lucide-react";
import { fmtBRL } from "../../lib/format";
import { ProgressBar } from "../ui";

// Selo de nível do investidor: sobe conforme o total investido
// (faixas definidas no servidor, em server/src/investorLevel.js)
const VISUAL = {
  iniciante: { icon: Sprout, cls: "level--iniciante" },
  intermediario: { icon: Wheat, cls: "level--intermediario" },
  profissional: { icon: Trophy, cls: "level--profissional" },
};

export function InvestorLevelBadge({ nivel, size = "md" }) {
  if (!nivel) return null;
  const v = VISUAL[nivel.id] || VISUAL.iniciante;
  const Icon = v.icon;
  return (
    <span className={`level ${v.cls} ${size === "sm" ? "level--sm" : ""}`} title={`Investidor ${nivel.label}`}>
      <Icon size={size === "sm" ? 12 : 15} aria-hidden /> {nivel.label}
    </span>
  );
}

export function InvestorLevelCard({ nivel }) {
  if (!nivel) return null;
  const prox = nivel.proximo;
  const atualMin = nivel.niveis.find((n) => n.id === nivel.id)?.minimo || 0;
  const pct = prox ? ((nivel.total_investido - atualMin) / (prox.minimo - atualMin)) * 100 : 100;
  return (
    <section className="card" aria-label="Seu nível de investidor" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <p className="card-title">Seu nível</p>
        <InvestorLevelBadge nivel={nivel} />
      </div>
      <ProgressBar value={pct} color="var(--brand-orange)" label="Progresso até o próximo nível" />
      <p className="text-sm text-2">
        {prox
          ? <>Faltam <strong style={{ color: "var(--text)" }}>{fmtBRL(prox.falta)}</strong> investidos para chegar a <strong style={{ color: "var(--text)" }}>{prox.label}</strong>.</>
          : "Você está no nível mais alto. Obrigado por acreditar no campo!"}
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap" }} aria-label="Níveis">
        {nivel.niveis.map((n) => (
          <li key={n.id} className="text-xs text-2" style={{ opacity: nivel.total_investido >= n.minimo ? 1 : 0.6 }}>
            <InvestorLevelBadge nivel={n} size="sm" /> {n.minimo > 0 ? `a partir de ${fmtBRL(n.minimo)}` : "início"}
          </li>
        ))}
      </ol>
    </section>
  );
}
