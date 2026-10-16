import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ChevronRight, Award, BookOpen, ShoppingBasket } from "lucide-react";
import { GRAIN_COLORS } from "../config/theme";
import { faseNome, unidadeNome } from "../config/culturas";
import { fmtBRL, fmtNumber, fmtPct } from "../lib/format";
import { api } from "../lib/api";
import { conquistasDo } from "../lib/conquistas";
import { compartilharCertificado } from "../lib/certificado";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { ProgressBar, ErrorBanner, EmptyState, FilterChips, Loading, Button, useToast } from "../components/ui";
import { GrainThumb, InvestorLevelCard, PilhaDeSacas, IndiqueEGanhe } from "../components/domain";

const STATUS_FILTERS = [
  { id: "todos", label: "Todas", match: () => true },
  { id: "ativos", label: "No armazém", match: (s) => s === "ativo" },
  { id: "pagos", label: "Vendidas e pagas", match: (s) => s === "pago" },
];

export function Stat({ label, value, icon: Icon, tone }) {
  return (
    <div className="stat">
      <p className="stat-label">{Icon && <Icon size={16} aria-hidden />} {label}</p>
      <p className={`stat-value ${tone === "success" ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}

// junta as compras do mesmo talhão: o investidor pensa em "as sacas de soja
// da Fazenda X no meu armazém", não em cada compra separada
function agrupar(investments) {
  const porTalhao = new Map();
  for (const i of investments) {
    const g = porTalhao.get(i.plot_id) || { ...i, cotas: 0, valor_investido: 0, valor_liquido: 0, compras: [] };
    g.cotas += Number(i.cotas); g.valor_investido += Number(i.valor_investido); g.valor_liquido += Number(i.valor_liquido || 0);
    g.compras.push(i);
    if (i.status === "ativo") g.status = "ativo";
    porTalhao.set(i.plot_id, g);
  }
  return [...porTalhao.values()].map((g) => ({
    ...g,
    valorHoje: g.status === "pago" ? g.valor_liquido : g.cotas * Number(g.cota_valor || 0),
  }));
}

export default function Portfolio() {
  const { user } = useAuth();
  const toast = useToast();
  const [investments, setInvestments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [nivel, setNivel] = useState(null);
  const [gerando, setGerando] = useState(null);

  useEffect(() => {
    api.myInvestments()
      .then((data) => { setInvestments(data.investments); setNivel(data.nivel || null); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const grupos = useMemo(() => agrupar(investments), [investments]);
  const conquistas = useMemo(() => conquistasDo(investments), [investments]);
  const naRoca = grupos.filter((g) => g.status === "ativo");
  // totais por unidade (sacas, arrobas, litros…) — não dá para somar boi com soja
  const porUnidade = Object.entries(naRoca.reduce((acc, g) => { acc[g.unidade] = (acc[g.unidade] || 0) + g.cotas; return acc; }, {}));
  const pagoNaRoca = naRoca.reduce((s, g) => s + g.valor_investido, 0);
  const valeHoje = naRoca.reduce((s, g) => s + g.valorHoje, 0);
  const variacao = pagoNaRoca ? ((valeHoje - pagoNaRoca) / pagoNaRoca) * 100 : 0;
  const recebido = grupos.filter((g) => g.status === "pago").reduce((s, g) => s + g.valor_liquido, 0);
  const active = STATUS_FILTERS.find((f) => f.id === statusFilter) || STATUS_FILTERS[0];
  const filtrados = grupos.filter((g) => active.match(g.status));

  async function certificado(g) {
    setGerando(g.plot_id);
    try { await compartilharCertificado({ nome: user?.name || "Investidor", inv: g }); toast("Certificado pronto"); }
    catch { toast("Não foi possível gerar o certificado", { tone: "error" }); }
    finally { setGerando(null); }
  }

  return (
    <Page title="Meu armazém" width="medium">
      <PageHeader title="Meu armazém" subtitle="As commodities que você comprou das fazendas — grãos, fibras e animais — guardadas aqui até a venda na colheita." />
      <ErrorBanner message={error} />

      {loading ? <Loading /> : grupos.length === 0 ? (
        <EmptyState image="/icons/icon_plantando_meu_talhao.svg" title="Seu armazém ainda está vazio"
          action={<Button to="/" icon={ShoppingBasket}>Comprar minha primeira saca</Button>}>
          Seu armazém está vazio. Dá para começar com 1 saca: você escolhe a fazenda, compra a sua parte e ela fica guardada aqui até a venda na colheita.
        </EmptyState>
      ) : (
        <>
          <section className="saldo-sacas" aria-label="Resumo das suas sacas" style={{ marginBottom: 16 }}>
            <span className="label-xs">Guardado no seu armazém</span>
            <strong>{porUnidade.map(([u, n]) => `${fmtNumber(n)} ${unidadeNome(u, n)}`).join(" · ") || "0 sacas"}</strong>
            <span>Valem hoje cerca de <b>{fmtBRL(valeHoje)}</b> · você pagou {fmtBRL(pagoNaRoca)}</span>
            {pagoNaRoca > 0 && (
              <span className="saldo-variacao">
                {variacao >= 0 ? <TrendingUp size={15} aria-hidden /> : <TrendingDown size={15} aria-hidden />}
                {variacao >= 0 ? "+" : ""}{fmtPct(variacao, 1)} desde a compra
              </span>
            )}
            {recebido > 0 && <span className="text-sm">Já recebido em colheitas: <b>{fmtBRL(recebido)}</b></span>}
          </section>

          <section aria-label="Conquistas" style={{ marginBottom: 16 }}>
            <p className="card-title" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}><Award size={16} aria-hidden /> Suas conquistas</p>
            <div className="conquistas">
              {conquistas.map((c) => (
                <div key={c.id} className={`conquista ${c.conquistada ? "" : "is-off"}`} title={c.desc}>
                  <img className="conquista-img" src={c.img} alt="" />
                  <span className="conquista-titulo">{c.titulo}</span>
                  <span className="sr-only">{c.conquistada ? "conquistada" : "ainda não"}</span>
                </div>
              ))}
            </div>
          </section>

          <div style={{ marginBottom: 16 }}><IndiqueEGanhe /></div>

          {nivel && <div style={{ marginBottom: 16 }}><InvestorLevelCard nivel={nivel} /></div>}

          <div style={{ marginBottom: 12 }}>
            <FilterChips label="Filtrar" value={statusFilter} onChange={setStatusFilter}
              options={STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label, count: grupos.filter((g) => f.match(g.status)).length }))} />
          </div>
          {filtrados.length === 0 && <p className="text-sm text-2">Nada neste filtro.</p>}
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filtrados.map((g) => {
              const u = unidadeNome(g.unidade, g.cotas);
              const ganho = g.valorHoje - g.valor_investido;
              return (
                <li key={g.plot_id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <GrainThumb grao={g.grao} size="lg" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-lg)", lineHeight: 1.2 }}>
                        {fmtNumber(g.cotas)} {u} de {g.grao.toLowerCase()}
                      </p>
                      <p className="text-sm text-2">{g.farm_name} · {g.plot_nome}</p>
                    </div>
                  </div>
                  <div style={{ margin: "12px 0" }}><PilhaDeSacas quantidade={g.cotas} unidade={g.unidade} grao={g.grao} /></div>
                  {g.status !== "pago" ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)", marginBottom: 6 }} className="text-2">
                        <span>O talhão está em: <strong style={{ color: "var(--text)" }}>{faseNome(g, g.fase_atual)}</strong></span>
                        <span>{g.progresso}%</span>
                      </div>
                      <ProgressBar value={g.progresso} color={GRAIN_COLORS[g.grao]} label="Andamento da safra" />
                      <p className="text-sm" style={{ marginTop: 10 }}>
                        Valem hoje <strong>{fmtBRL(g.valorHoje)}</strong>
                        <span className={ganho >= 0 ? "text-success" : "text-danger"}> ({ganho >= 0 ? "+" : ""}{fmtBRL(ganho)})</span>
                        <span className="text-3"> · você pagou {fmtBRL(g.valor_investido)}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">Colhido e pago: você recebeu <strong className="text-success">{fmtBRL(g.valor_liquido)}</strong> (pagou {fmtBRL(g.valor_investido)}).</p>
                  )}
                  <div className="row" style={{ marginTop: 12 }}>
                    <Button size="sm" variant="secondary" icon={BookOpen} to={`/talhao/${g.plot_id}#diario`}>Diário do talhão</Button>
                    <Button size="sm" variant="secondary" icon={Award} onClick={() => certificado(g)} loading={gerando === g.plot_id}>Certificado</Button>
                    {g.status !== "pago" && <Button size="sm" variant="ghost" to={`/talhao/${g.plot_id}`}>Comprar mais <ChevronRight size={14} aria-hidden /></Button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-3" style={{ marginTop: 14 }}>
            "Valem hoje" usa o preço atual da saca neste talhão (o que um novo comprador pagaria). O valor final depende da venda na colheita. <Link to="/como-funciona">Como funciona</Link>
          </p>
        </>
      )}
    </Page>
  );
}
