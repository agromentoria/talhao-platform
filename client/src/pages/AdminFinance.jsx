import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Download, Printer, SlidersHorizontal, X, ArrowDownCircle, ArrowUpCircle, Coins, Receipt, Trash2, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "../lib/api";
import { downloadFromApi } from "../lib/download";
import { fmtBRL, fmtDateTime, fmtNumber } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, IconButton, Banner, ErrorBanner, Loading, EmptyState, Segmented, TextField, SelectField, Dialog, Badge, useToast } from "../components/ui";
import { Stat } from "./Portfolio";

const TIPOS = {
  compra_cota: { label: "Compra de cotas", curto: "Compras", cor: "#557A22", tone: "success" },
  pagamento_investidor: { label: "Pagamento a investidor", curto: "Pagamentos", cor: "#B26000", tone: "info" },
  repasse_fazenda: { label: "Repasse à fazenda", curto: "Repasses", cor: "#8B5A2B", tone: undefined },
  tarifa_armazem: { label: "Tarifa de armazenagem", curto: "Armazenagem", cor: "#6B8CAE", tone: undefined },
  comissao_plataforma: { label: "Comissão da plataforma", curto: "Comissão", cor: "#C9A227", tone: "warning" },
};
const PERFIL = { investidor: "Investidor", fazenda: "Fazenda", armazem: "Armazém", admin: "Administração" };
const PAGAMENTO = { pix: "Pix", cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito" };
const FILTER_KEYS = ["q", "type", "from", "to", "user_id", "farm_id", "warehouse_id", "plot_id", "payment", "min", "max"];

const hoje = () => new Date().toISOString().slice(0, 10);
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const PERIODOS = [
  { id: "tudo", label: "Tudo", from: "", to: "" },
  { id: "7", label: "7 dias", from: () => diasAtras(7), to: hoje },
  { id: "30", label: "30 dias", from: () => diasAtras(30), to: hoje },
  { id: "mes", label: "Este mês", from: () => hoje().slice(0, 8) + "01", to: hoje },
  { id: "ano", label: "Este ano", from: () => hoje().slice(0, 4) + "-01-01", to: hoje },
];

export default function AdminFinance() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const view = params.get("ver") === "relatorios" ? "relatorios" : "transacoes";
  const filtros = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])), [params]);
  const filtroQs = useMemo(() => new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString(), [filtros]);
  const ativos = FILTER_KEYS.filter((k) => filtros[k]).length;

  const [opcoes, setOpcoes] = useState(null);
  const [busca, setBusca] = useState(filtros.q);
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [serie, setSerie] = useState([]);
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);

  const setFiltro = useCallback((patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete("page");
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => { api.financeFilterOptions().then(setOpcoes).catch((e) => setError(e.message)); }, []);
  useEffect(() => { setBusca(filtros.q); }, [filtros.q]);
  // busca com pequena espera para não consultar a cada letra
  useEffect(() => {
    if (busca === filtros.q) return;
    const t = setTimeout(() => setFiltro({ q: busca.trim() }), 350);
    return () => clearTimeout(t);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let ativo = true;
    api.financeSeries(filtroQs).then((d) => ativo && setSerie(d.series)).catch(() => {});
    return () => { ativo = false; };
  }, [filtroQs, reload]);

  const tiposSel = filtros.type ? filtros.type.split(",") : [];
  function toggleTipo(t) {
    const s = new Set(tiposSel);
    if (s.has(t)) s.delete(t); else s.add(t);
    setFiltro({ type: [...s].join(",") });
  }
  const periodoAtual = PERIODOS.find((p) => {
    const f = typeof p.from === "function" ? p.from() : p.from; const t = typeof p.to === "function" ? p.to() : p.to;
    return f === filtros.from && t === filtros.to;
  })?.id;

  async function exportar() {
    setExporting(true);
    try {
      const path = view === "relatorios"
        ? `/admin/finance/export/report.csv?group=${params.get("grupo") || "fazenda"}&${filtroQs}`
        : `/admin/finance/export/transactions.csv?${filtroQs}`;
      await downloadFromApi(path, view === "relatorios" ? `relatorio-${params.get("grupo") || "fazenda"}.csv` : "transacoes.csv");
      toast("Arquivo gerado");
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  const nomeFiltro = (k, v) => {
    if (!opcoes) return v;
    if (k === "user_id") return opcoes.investidores.find((x) => String(x.id) === v)?.name;
    if (k === "farm_id") return opcoes.fazendas.find((x) => String(x.id) === v)?.name;
    if (k === "warehouse_id") return opcoes.armazens.find((x) => String(x.id) === v)?.name;
    if (k === "plot_id") return opcoes.talhoes.find((x) => String(x.id) === v)?.nome;
    return v;
  };
  const etiquetas = [
    filtros.user_id && ["user_id", `Investidor: ${nomeFiltro("user_id", filtros.user_id)}`],
    filtros.farm_id && ["farm_id", `Fazenda: ${nomeFiltro("farm_id", filtros.farm_id)}`],
    filtros.warehouse_id && ["warehouse_id", `Armazém: ${nomeFiltro("warehouse_id", filtros.warehouse_id)}`],
    filtros.plot_id && ["plot_id", `Talhão: ${nomeFiltro("plot_id", filtros.plot_id)}`],
    filtros.payment && ["payment", `Pagamento: ${PAGAMENTO[filtros.payment]}`],
    filtros.min && ["min", `A partir de ${fmtBRL(filtros.min)}`],
    filtros.max && ["max", `Até ${fmtBRL(filtros.max)}`],
  ].filter(Boolean);

  return (
    <Page title="Financeiro" width="medium">
      <div className="print-only print-head">
        <span>
          <strong>Meu Talhão — relatório financeiro</strong>
          {(etiquetas.length > 0 || tiposSel.length > 0 || filtros.q) && (
            <span style={{ display: "block", fontWeight: 400 }}>
              Filtros: {[filtros.q && `busca “${filtros.q}”`, tiposSel.length && tiposSel.map((t) => TIPOS[t]?.curto).join(", "), ...etiquetas.map((e) => e[1])].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
        <span>Gerado em {new Date().toLocaleString("pt-BR")}{periodoAtual && periodoAtual !== "tudo" ? ` · período: ${PERIODOS.find((p) => p.id === periodoAtual).label}` : filtros.from || filtros.to ? ` · de ${filtros.from || "início"} até ${filtros.to || "hoje"}` : ""}</span>
      </div>
      <PageHeader
        back="/admin"
        backLabel="Administração"
        title="Financeiro"
        subtitle="Todas as movimentações da plataforma, com filtros, relatórios e exportação."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportar} loading={exporting}>Exportar CSV</Button>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
            <Button variant="danger-ghost" icon={Trash2} onClick={() => setResetOpen(true)}>Zerar dados</Button>
          </>
        }
      />
      <ErrorBanner message={error} />

      {/* ---------- filtros ---------- */}
      <section className="card no-print" style={{ marginBottom: 16 }} aria-label="Filtros">
        <div className="fin-filters">
          <div className="input-group" style={{ flex: "1 1 260px" }}>
            <Search size={18} aria-hidden />
            <label htmlFor="fin-busca" className="sr-only">Buscar</label>
            <input id="fin-busca" className="input" type="search" placeholder="Buscar por nome, e-mail, fazenda, talhão, armazém, descrição ou #número"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Button variant={maisFiltros || etiquetas.length ? "primary" : "secondary"} icon={SlidersHorizontal} onClick={() => setMaisFiltros((v) => !v)} aria-expanded={maisFiltros}>
            Filtros{etiquetas.length ? ` (${etiquetas.length})` : ""}
          </Button>
        </div>

        <div className="chips" role="group" aria-label="Período" style={{ marginTop: 12 }}>
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={(periodoAtual || (!filtros.from && !filtros.to ? "tudo" : "")) === p.id}
              onClick={() => setFiltro({ from: typeof p.from === "function" ? p.from() : p.from, to: typeof p.to === "function" ? p.to() : p.to })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Tipos de transação" style={{ marginTop: 8 }}>
          {Object.entries(TIPOS).map(([k, t]) => (
            <button key={k} type="button" className="chip" aria-pressed={tiposSel.includes(k)} onClick={() => toggleTipo(k)}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: t.cor }} /> {t.curto}
            </button>
          ))}
        </div>

        {maisFiltros && opcoes && (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <TextField label="De" type="date" value={filtros.from} onChange={(v) => setFiltro({ from: v })} />
            <TextField label="Até" type="date" value={filtros.to} onChange={(v) => setFiltro({ to: v })} min={filtros.from || undefined} />
            <SelectField label="Investidor" value={filtros.user_id} onChange={(v) => setFiltro({ user_id: v })}
              options={[{ value: "", label: "Todos" }, ...opcoes.investidores.map((i) => ({ value: String(i.id), label: `${i.name} · ${i.email}` }))]} />
            <SelectField label="Fazenda" value={filtros.farm_id} onChange={(v) => setFiltro({ farm_id: v })}
              options={[{ value: "", label: "Todas" }, ...opcoes.fazendas.map((f) => ({ value: String(f.id), label: `${f.name} · ${f.location}` }))]} />
            <SelectField label="Armazém" value={filtros.warehouse_id} onChange={(v) => setFiltro({ warehouse_id: v })}
              options={[{ value: "", label: "Todos" }, ...opcoes.armazens.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.location}` }))]} />
            <SelectField label="Talhão" value={filtros.plot_id} onChange={(v) => setFiltro({ plot_id: v })}
              options={[{ value: "", label: "Todos" }, ...opcoes.talhoes.map((p) => ({ value: String(p.id), label: `${p.nome} · ${p.farm_name}` }))]} />
            <SelectField label="Forma de pagamento" value={filtros.payment} onChange={(v) => setFiltro({ payment: v })}
              options={[{ value: "", label: "Todas" }, ...Object.entries(PAGAMENTO).map(([v, l]) => ({ value: v, label: l }))]} />
            <div className="row">
              <TextField label="Valor mínimo (R$)" type="number" inputMode="decimal" min={0} value={filtros.min} onChange={(v) => setFiltro({ min: v })} />
              <TextField label="Valor máximo (R$)" type="number" inputMode="decimal" min={0} value={filtros.max} onChange={(v) => setFiltro({ max: v })} />
            </div>
          </div>
        )}

        {(etiquetas.length > 0 || ativos > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
            {etiquetas.map(([k, label]) => (
              <span key={k} className="badge" style={{ paddingRight: 4 }}>
                {label}
                <button type="button" className="unstyled-size" onClick={() => setFiltro({ [k]: "" })} aria-label={`Remover filtro ${label}`}
                  style={{ border: "none", background: "none", padding: "0 2px", display: "inline-flex" }}><X size={13} aria-hidden /></button>
              </span>
            ))}
            <button type="button" className="link-btn" onClick={() => { setBusca(""); setParams(view === "relatorios" ? { ver: "relatorios" } : {}, { replace: true }); }}>Limpar tudo</button>
          </div>
        )}
      </section>

      {/* ---------- resumo ---------- */}
      {resumo && (
        <div className="grid-stats" style={{ marginBottom: 16 }}>
          <Stat label="Entradas (compras)" value={fmtBRL(resumo.entradas)} icon={ArrowDownCircle} tone="success" />
          <Stat label="Saídas (pagamentos, repasses, tarifas)" value={fmtBRL(resumo.saidas)} icon={ArrowUpCircle} />
          <Stat label="Receita da plataforma" value={fmtBRL(resumo.receitaPlataforma)} icon={Coins} tone="success" />
          <Stat label="Transações" value={fmtNumber(resumo.quantidade)} icon={Receipt} />
        </div>
      )}

      {serie.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }} aria-labelledby="fin-graf">
          <h2 id="fin-graf" className="card-title" style={{ marginBottom: 10 }}>Movimentação por mês</h2>
          <div style={{ height: 220, overflow: "hidden" }} aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie.map((s) => ({ ...s, mesLabel: `${s.mes.slice(5, 7)}/${s.mes.slice(2, 4)}` }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: "#584A3C" }} axisLine={{ stroke: "#DDCDB4" }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#584A3C" }} axisLine={false} tickLine={false} width={64}
                  tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : v)} />
                <Tooltip formatter={(v, k) => [fmtBRL(v), TIPOS[k]?.curto || k]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend formatter={(k) => TIPOS[k]?.curto || k} wrapperStyle={{ fontSize: 12 }} />
                {Object.entries(TIPOS).map(([k, t]) => <Bar key={k} dataKey={k} stackId="a" fill={t.cor} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="no-print" style={{ marginBottom: 14, maxWidth: 420 }}>
        <Segmented label="Visualização" value={view}
          onChange={(v) => { const n = new URLSearchParams(params); if (v === "relatorios") n.set("ver", "relatorios"); else n.delete("ver"); setParams(n, { replace: true }); }}
          options={[{ id: "transacoes", label: "Transações" }, { id: "relatorios", label: "Relatórios" }]} />
      </div>

      {view === "transacoes"
        ? <TransactionsList filtroQs={filtroQs} onResumo={setResumo} reload={reload} onError={setError} />
        : <Reports filtroQs={filtroQs} onResumo={setResumo} onApply={setFiltro} onError={setError} />}

      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onDone={() => { setResetOpen(false); setReload((n) => n + 1); api.financeFilterOptions().then(setOpcoes).catch(() => {}); }} />
    </Page>
  );
}

// ---------- lista de transações ----------
function TransactionsList({ filtroQs, onResumo, reload, onError }) {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page")) || 1;
  const sort = params.get("ordem") || "recentes";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    api.financeTransactions(`${filtroQs}&page=${page}&page_size=25&sort=${sort}`)
      .then((d) => { if (!ativo) return; setData(d); onResumo(d.resumo); })
      .catch((e) => ativo && onError(e.message))
      .finally(() => ativo && setLoading(false));
    return () => { ativo = false; };
  }, [filtroQs, page, sort, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const paginas = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section aria-label="Transações">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <p className="text-sm text-2">{fmtNumber(data.total)} transação(ões){loading ? " · atualizando…" : ""}</p>
        <SelectField label="Ordenar" value={sort} onChange={(v) => setParam("ordem", v === "recentes" ? "" : v)} style={{ minWidth: 200 }}
          options={[{ value: "recentes", label: "Mais recentes" }, { value: "antigas", label: "Mais antigas" }, { value: "maior", label: "Maior valor" }, { value: "menor", label: "Menor valor" }]} />
      </div>

      {data.transactions.length === 0 ? (
        <EmptyState title="Nenhuma transação encontrada">Ajuste a busca ou os filtros.</EmptyState>
      ) : (
        <>
          <div className="fin-table-wrap">
            <table className="fin-table">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Pessoa</th><th>Fazenda / talhão</th><th>Armazém</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {data.transactions.map((t) => (
                  <tr key={t.id} onClick={() => setDetalhe(t.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setDetalhe(t.id); }} aria-label={`Ver transação ${t.id}`}>
                    <td><span className="text-3">#{t.id}</span><br />{fmtDateTime(t.created_at)}</td>
                    <td><span className="fin-dot" style={{ background: TIPOS[t.type]?.cor }} aria-hidden />{TIPOS[t.type]?.label || t.type}</td>
                    <td>{t.user_name ? <>{t.user_name}<br /><span className="text-3">{PERFIL[t.user_role] || ""}</span></> : <span className="text-3">Plataforma</span>}</td>
                    <td>{t.farm_name || "—"}{t.plot_nome && <><br /><span className="text-3">{t.plot_nome}</span></>}</td>
                    <td>{t.warehouse_name || "—"}</td>
                    <td className="num"><strong>{fmtBRL(t.amount)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="list fin-cards" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.transactions.map((t) => (
              <li key={t.id}>
                <button type="button" className="list-item" onClick={() => setDetalhe(t.id)} style={{ alignItems: "flex-start" }}>
                  <span className="fin-dot" style={{ background: TIPOS[t.type]?.cor, marginTop: 6 }} aria-hidden />
                  <span className="list-item-body">
                    <span className="list-item-title" style={{ display: "block" }}>{TIPOS[t.type]?.label}</span>
                    <span className="list-item-sub" style={{ display: "block" }}>{t.user_name || "Plataforma"}{t.farm_name ? ` · ${t.farm_name}` : ""}</span>
                    <span className="text-xs text-3" style={{ display: "block" }}>#{t.id} · {fmtDateTime(t.created_at)}{t.plot_nome ? ` · ${t.plot_nome}` : ""}</span>
                  </span>
                  <strong className="money" style={{ whiteSpace: "nowrap" }}>{fmtBRL(t.amount)}</strong>
                </button>
              </li>
            ))}
          </ul>

          {paginas > 1 && (
            <nav className="no-print" aria-label="Páginas" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 14 }}>
              <IconButton label="Página anterior" icon={ChevronLeft} variant="surface" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))} />
              <span className="text-sm">Página {page} de {paginas}</span>
              <IconButton label="Próxima página" icon={ChevronRight} variant="surface" disabled={page >= paginas} onClick={() => setParam("page", String(page + 1))} />
            </nav>
          )}
        </>
      )}
      <TransactionDetail id={detalhe} onClose={() => setDetalhe(null)} />
    </section>
  );
}

function TransactionDetail({ id, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id) return;
    setD(null); setError("");
    api.financeTransaction(id).then(setD).catch((e) => setError(e.message));
  }, [id]);
  if (!id) return null;
  const t = d?.transaction;
  const inv = d?.investimento;
  return (
    <Dialog open onClose={onClose} title={`Transação #${id}`} width={560}>
      <ErrorBanner message={error} />
      {!t ? <Loading /> : (
        <div className="stack">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Badge tone={TIPOS[t.type]?.tone}>{TIPOS[t.type]?.label}</Badge>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", color: "var(--text)" }}>{fmtBRL(t.amount)}</strong>
          </div>
          <dl className="kv" style={{ margin: 0 }}>
            <div><dt>Data</dt><dd>{fmtDateTime(t.created_at)}</dd></div>
            <div><dt>Situação</dt><dd>{t.status}</dd></div>
            <div><dt>Pessoa</dt><dd>{t.user_name ? `${t.user_name} (${PERFIL[t.user_role] || t.user_role})` : "Plataforma"}</dd></div>
            {t.user_email && <div><dt>E-mail</dt><dd>{t.user_email}</dd></div>}
            <div><dt>Fazenda</dt><dd>{t.farm_name || "—"}</dd></div>
            <div><dt>Talhão</dt><dd>{t.plot_nome ? <Link to={`/talhao/${t.plot_id}`}>{t.plot_nome}</Link> : "—"}</dd></div>
            <div><dt>Armazém</dt><dd>{t.warehouse_name || "—"}</dd></div>
            {t.payment_method_type && <div><dt>Forma de pagamento</dt><dd>{PAGAMENTO[t.payment_method_type] || t.payment_method_type}</dd></div>}
          </dl>
          {t.description && <p className="text-sm" style={{ color: "var(--text)" }}>{t.description}</p>}
          {inv && (
            <div className="card card--well" style={{ padding: 14 }}>
              <p className="card-title" style={{ marginBottom: 8 }}>Investimento ligado</p>
              <dl className="kv" style={{ margin: 0 }}>
                <div><dt>Cotas</dt><dd>{fmtNumber(inv.cotas)} a {fmtBRL(inv.preco_unitario)}</dd></div>
                <div><dt>Valor investido</dt><dd>{fmtBRL(inv.valor_investido)}</dd></div>
                <div><dt>Situação</dt><dd>{inv.status}</dd></div>
                {inv.valor_bruto != null && (
                  <>
                    <div><dt>Valor bruto da venda</dt><dd>{fmtBRL(inv.valor_bruto)}</dd></div>
                    {inv.despesa_armazem > 0 && <div><dt>Armazenagem</dt><dd>− {fmtBRL(inv.despesa_armazem)}</dd></div>}
                    <div><dt>Comissão da fazenda</dt><dd>− {fmtBRL(inv.comissao_fazenda)}</dd></div>
                    <div><dt>Comissão da plataforma</dt><dd>− {fmtBRL(inv.comissao_app)}</dd></div>
                    <div className="total"><dt>Valor líquido pago</dt><dd className="text-success">{fmtBRL(inv.valor_liquido)}</dd></div>
                  </>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ---------- relatórios agrupados ----------
const GRUPOS = [
  { id: "fazenda", label: "Fazendas", filtro: "farm_id" },
  { id: "investidor", label: "Investidores", filtro: "user_id" },
  { id: "armazem", label: "Armazéns", filtro: "warehouse_id" },
  { id: "talhao", label: "Talhões", filtro: "plot_id" },
  { id: "mes", label: "Meses", filtro: null },
];

function Reports({ filtroQs, onResumo, onApply, onError }) {
  const [params, setParams] = useSearchParams();
  const grupo = GRUPOS.find((g) => g.id === params.get("grupo"))?.id || "fazenda";
  const [rel, setRel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    Promise.all([api.financeReport(`group=${grupo}&${filtroQs}`), api.financeTransactions(`${filtroQs}&page_size=10`)])
      .then(([r, t]) => { if (!ativo) return; setRel(r); onResumo(t.resumo); })
      .catch((e) => ativo && onError(e.message))
      .finally(() => ativo && setLoading(false));
    return () => { ativo = false; };
  }, [grupo, filtroQs]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = GRUPOS.find((x) => x.id === grupo);
  function abrir(linha) {
    if (grupo === "mes") {
      const [ano, mes] = String(linha.chave).split("-");
      const fim = new Date(Number(ano), Number(mes), 0).getDate();
      onApply({ from: `${ano}-${mes}-01`, to: `${ano}-${mes}-${String(fim).padStart(2, "0")}`, ver: "" });
    } else {
      onApply({ [g.filtro]: String(linha.chave), ver: "" });
    }
  }

  return (
    <section aria-label="Relatórios">
      <div className="chips no-print" role="group" aria-label="Agrupar por" style={{ marginBottom: 12 }}>
        {GRUPOS.map((x) => (
          <button key={x.id} type="button" className="chip" aria-pressed={grupo === x.id}
            onClick={() => { const n = new URLSearchParams(params); n.set("grupo", x.id); setParams(n, { replace: true }); }}>
            {x.label}
          </button>
        ))}
      </div>
      {loading && !rel ? <Loading /> : !rel || rel.linhas.length === 0 ? (
        <EmptyState title="Nada para mostrar">Não há movimentação com os filtros escolhidos.</EmptyState>
      ) : (
        <>
          <p className="print-only" style={{ fontWeight: 700, margin: "8px 0" }}>Relatório por {g.label.toLowerCase()}</p>
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table fin-table--report">
              <thead>
                <tr>
                  <th>{g.label.replace(/s$/, "")}</th>
                  {rel.colunas.map((c) => <th key={c} className="num">{rel.rotulos[c] || c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rel.linhas.map((l) => (
                  <tr key={l.chave} onClick={() => abrir(l)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") abrir(l); }}
                    title="Ver as transações deste item">
                    <td><strong>{l.nome}</strong>{l.detalhe && <><br /><span className="text-3">{l.detalhe}</span></>}</td>
                    {rel.colunas.map((c) => <td key={c} className="num">{c === "quantidade" ? fmtNumber(l[c]) : fmtBRL(l[c])}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {rel.colunas.map((c) => <td key={c} className="num">{c === "quantidade" ? fmtNumber(rel.totais[c]) : fmtBRL(rel.totais[c])}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-3 no-print" style={{ marginTop: 8 }}>Toque numa linha para ver as transações dela.</p>
        </>
      )}
    </section>
  );
}

// ---------- zerar dados ----------
function ResetDialog({ open, onClose, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [escopo, setEscopo] = useState("financeiro");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSenha(""); setConfirmacao(""); setError(""); setEscopo("financeiro");
    api.resetInfo().then(setInfo).catch((e) => setError(e.message));
  }, [open]);

  async function zerar(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await api.resetData({ escopo, senha, confirmacao });
      const total = Object.values(r.removidos).reduce((s, n) => s + n, 0);
      toast(`Dados zerados: ${fmtNumber(total)} registro(s) removido(s)`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const nomes = { financeiro: "Só a movimentação financeira", talhoes: "Financeiro e talhões", tudo: "Tudo, menos a administração" };
  return (
    <Dialog open={open} onClose={onClose} title="Zerar dados" width={600}>
      {!info ? <Loading /> : !info.habilitado ? (
        <Banner tone="info">O zerar dados está desligado neste servidor. Para ligar, remova a variável DISABLE_DATA_RESET.</Banner>
      ) : (
        <form onSubmit={zerar} className="stack">
          <Banner tone="warning" title="Ação definitiva">
            Use para limpar os testes antes de começar a operar. Não há como desfazer. Exporte as transações antes, se quiser guardar uma cópia.
          </Banner>
          <p className="text-sm">
            Hoje: {fmtNumber(info.contagem.transacoes)} transações · {fmtNumber(info.contagem.investimentos)} investimentos · {fmtNumber(info.contagem.talhoes)} talhões ·
            {" "}{fmtNumber(info.contagem.fazendas)} fazendas · {fmtNumber(info.contagem.armazens)} armazéns · {fmtNumber(info.contagem.usuarios)} contas (sem contar a administração).
          </p>
          <fieldset style={{ border: "none", padding: 0, margin: 0 }} className="stack">
            <legend className="field-label" style={{ marginBottom: 6 }}>O que zerar</legend>
            {Object.entries(info.escopos).map(([id, desc]) => (
              <label key={id} className="list-item" style={{ cursor: "pointer", alignItems: "flex-start", borderColor: escopo === id ? "var(--primary)" : undefined }}>
                <input type="radio" name="escopo" value={id} checked={escopo === id} onChange={() => setEscopo(id)} style={{ marginTop: 3 }} />
                <span className="list-item-body">
                  <span className="list-item-title" style={{ display: "block" }}>{nomes[id]}</span>
                  <span className="list-item-sub" style={{ display: "block" }}>{desc}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {escopo === "tudo" && (
            <Banner tone="error"><span style={{ display: "flex", gap: 6 }}><TriangleAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />Todas as contas de investidores, fazendas e armazéns serão apagadas. Só as contas de administração continuam.</span></Banner>
          )}
          <ErrorBanner message={error} />
          <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
          <TextField label="Sua senha de administrador" type="password" value={senha} onChange={setSenha} required autoComplete="current-password" />
          <TextField label='Digite ZERAR para confirmar' value={confirmacao} onChange={setConfirmacao} required autoCapitalize="characters" autoComplete="off" />
          {info.historico.length > 0 && (
            <p className="text-xs text-3">
              Último: {fmtDateTime(info.historico[0].created_at)} · {nomes[info.historico[0].escopo] || info.historico[0].escopo} · por {info.historico[0].admin || "administrador"}
            </p>
          )}
          <div className="dialog-actions" style={{ marginTop: 4 }}>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={loading} disabled={!senha || confirmacao.trim().toUpperCase() !== "ZERAR"}>Zerar dados</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
