import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Warehouse, ChevronRight } from "lucide-react";
import { GRAIN_COLORS } from "../config/theme";
import { faseNome, culturaTexto } from "../config/culturas";
import { fmtBRL, unitPlural } from "../lib/format";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { ProgressBar, ErrorBanner, EmptyState, FilterChips, Loading, Button } from "../components/ui";
import { GrainThumb, InvestorLevelCard } from "../components/domain";

const STATUS_FILTERS = [
  { id: "todos", label: "Todos", match: () => true },
  { id: "ativos", label: "Em andamento", match: (s) => s === "ativo" },
  { id: "pagos", label: "Colhidos e pagos", match: (s) => s === "pago" },
];

export function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="stat">
      <p className="stat-label">{Icon && <Icon size={16} aria-hidden />} {label}</p>
      <p className={`stat-value ${tone === "success" ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

export default function Portfolio() {
  const [investments, setInvestments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [nivel, setNivel] = useState(null);

  useEffect(() => {
    api.myInvestments()
      .then((data) => { setInvestments(data.investments); setNivel(data.nivel || null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalInvestido = investments.reduce((s, i) => s + Number(i.valor_investido || 0), 0);
  const totalRecebido = investments.filter((i) => i.status === "pago").reduce((s, i) => s + Number(i.valor_liquido || 0), 0);
  const ativos = investments.filter((i) => i.status === "ativo").length;

  const active = STATUS_FILTERS.find((f) => f.id === statusFilter) || STATUS_FILTERS[0];
  const filtered = investments.filter((i) => active.match(i.status));

  return (
    <Page title="Meus investimentos" width="medium">
      <PageHeader title="Meus investimentos" subtitle="Acompanhe cada talhão até a colheita e o pagamento da sua parte." />
      <ErrorBanner message={error} />

      {nivel && <div style={{ marginBottom: 16 }}><InvestorLevelCard nivel={nivel} /></div>}
      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <Stat label="Total investido" value={fmtBRL(totalInvestido)} icon={Coins} />
        <Stat label="Recebido em colheitas" value={fmtBRL(totalRecebido)} icon={TrendingUp} tone="success" />
        <Stat label="Talhões em andamento" value={ativos} icon={Warehouse} />
      </div>

      {loading ? <Loading /> : investments.length === 0 ? (
        <EmptyState image="/icons/icon_plantando_meu_talhao.svg" title="Você ainda não investiu" action={<Button to="/">Ver talhões abertos</Button>}>
          Escolha um talhão, compre sua parte e acompanhe a lavoura por aqui.
        </EmptyState>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <FilterChips
              label="Filtrar investimentos"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label, count: investments.filter((i) => f.match(i.status)).length }))}
            />
          </div>
          {filtered.length === 0 && <p className="text-sm text-2">Nenhum investimento nesse filtro.</p>}
          <ul className="list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((inv) => (
              <li key={inv.id}>
                <Link to={`/talhao/${inv.plot_id}`} className="list-item">
                  <GrainThumb grao={inv.grao} />
                  <div className="list-item-body">
                    <p className="list-item-title truncate">{inv.plot_nome}</p>
                    <p className="list-item-sub">
                      {culturaTexto(inv)} · {inv.farm_name} · {inv.cotas} {unitPlural(inv.unidade, inv.cotas)} · {fmtBRL(inv.valor_investido)}
                    </p>
                    {inv.status !== "pago" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                        <div style={{ flex: 1, maxWidth: 220 }}><ProgressBar value={inv.progresso} color={GRAIN_COLORS[inv.grao]} label="Andamento da safra" /></div>
                        <span className="text-xs text-2">{faseNome(inv, inv.fase_atual)}</span>
                      </div>
                    )}
                  </div>
                  <div className="list-item-meta">
                    {inv.status === "pago" && <span className="text-sm text-success" style={{ fontWeight: 700 }}>Recebido {fmtBRL(inv.valor_liquido)}</span>}
                    <ChevronRight size={18} aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
