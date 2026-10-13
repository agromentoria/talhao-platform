import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, Download, Printer, ChevronLeft, ChevronRight, Users, Tractor, Warehouse, Landmark, Receipt, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { api } from "../lib/api";
import { downloadFromApi } from "../lib/download";
import { fmtBRL, fmtNumber, fmtPct, fmtDateTime, timeAgo } from "../lib/format";
import { culturaIcone, unidadeNome } from "../config/culturas";
import { Page, PageHeader } from "../components/layout/Page";
import { Tabs, Button, IconButton, Badge, ErrorBanner, Loading, EmptyState, TextField, SelectField, Dialog, Banner, useDialog, useToast } from "../components/ui";
import { Stars } from "../components/domain";
import { Stat } from "./Portfolio";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const dataBR = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const t = (v) => `${fmtNumber(Math.round(v || 0))} t`;

// Configuração de cada aba: situações, ordenações, colunas e resumo
const TIPOS = {
  investidores: {
    label: "Investidores", icon: Users,
    situacoes: [["ativo", "Ativos"], ["suspenso", "Suspensos"]],
    ordens: [["investido", "Quem mais investiu"], ["recebido", "Quem mais recebeu"], ["unidades", "Mais unidades compradas"], ["compras", "Mais compras"], ["recentes", "Cadastro mais recente"], ["acesso", "Último acesso"], ["nome", "Nome (A–Z)"]],
    metricaLabel: "Valor investido (R$)",
    fmtRanking: fmtBRL,
    colunas: [
      ["Investidor", (r) => <><strong>{r.nome}</strong><br /><span className="text-3">{r.email}</span></>],
      ["Local", (r) => [r.cidade, r.uf].filter(Boolean).join(" / ") || "—"],
      ["Investido", (r) => fmtBRL(r.investido), true],
      ["Em andamento", (r) => fmtBRL(r.em_andamento), true],
      ["Recebido", (r) => fmtBRL(r.recebido), true],
      ["Unidades", (r) => fmtNumber(r.unidades), true],
      ["Compras", (r) => fmtNumber(r.compras), true],
      ["Última compra", (r) => dataBR(r.ultima_compra)],
    ],
    resumo: (s) => [["Investidores", fmtNumber(s.quantidade)], ["Com investimento", fmtNumber(s.com_investimento)], ["Total investido", fmtBRL(s.investido)], ["Em andamento", fmtBRL(s.em_andamento)], ["Recebido em colheitas", fmtBRL(s.recebido)]],
    filtroFinanceiro: "user_id",
  },
  fazendas: {
    label: "Fazendas", icon: Tractor,
    situacoes: [["aprovada", "Aprovadas"], ["pendente", "Aguardando"], ["suspensa", "Suspensas"]],
    ordens: [["captado", "Mais captou"], ["talhoes", "Mais talhões"], ["area", "Maior área ativa"], ["investidores", "Mais investidores"], ["recebido", "Mais recebeu (comissão + performance)"], ["estrelas", "Melhor pontuação"], ["recentes", "Cadastro mais recente"], ["nome", "Nome (A–Z)"]],
    metricaLabel: "Captado (R$)",
    fmtRanking: null,
    colunas: [
      ["Fazenda", (r) => <><strong>{r.nome}</strong><br /><span className="text-3">{r.location}</span></>],
      ["Responsável", (r) => <>{r.responsavel || "—"}<br /><span className="text-3">{r.email}</span></>],
      ["Talhões", (r) => `${fmtNumber(r.talhoes)} (${fmtNumber(r.talhoes_ativos)} ativos)`, true],
      ["Área ativa", (r) => `${fmtNumber(r.area_ativa)} ha`, true],
      ["Captado", (r) => fmtBRL(r.captado), true],
      ["Investidores", (r) => fmtNumber(r.investidores), true],
      ["Recebeu", (r) => fmtBRL(r.recebido), true],
      ["Nota", (r) => (r.estrelas > 0 ? <Stars value={r.estrelas} size={12} /> : "—")],
    ],
    resumo: (s) => [["Fazendas", fmtNumber(s.quantidade)], ["Aguardando aprovação", fmtNumber(s.pendentes)], ["Talhões", fmtNumber(s.talhoes)], ["Área ativa", `${fmtNumber(s.area_ativa)} ha`], ["Captado", fmtBRL(s.captado)]],
    filtroFinanceiro: "farm_id",
  },
  armazens: {
    label: "Armazéns", icon: Warehouse,
    situacoes: [["aprovado", "Credenciados"], ["pendente", "Aguardando"], ["suspenso", "Suspensos"]],
    ordens: [["armazenado", "Mais armazena"], ["garantido", "Mais valor garantido"], ["custodias", "Mais custódias"], ["tarifas", "Mais tarifas recebidas"], ["capacidade", "Maior capacidade"], ["estrelas", "Melhor pontuação"], ["recentes", "Cadastro mais recente"], ["nome", "Nome (A–Z)"]],
    metricaLabel: "Armazenado (unidades)",
    fmtRanking: null,
    colunas: [
      ["Armazém", (r) => <><strong>{r.nome}</strong><br /><span className="text-3">{r.location}</span></>],
      ["Armazenado", (r) => <>{fmtNumber(r.armazenado)} un.<br /><span className="text-3">{t(r.armazenado_t)} em sacas</span></>, true],
      ["Ocupação", (r) => (r.ocupacao_pct != null ? fmtPct(r.ocupacao_pct, 1) : "—"), true],
      ["Custódias ativas", (r) => fmtNumber(r.custodias_ativas), true],
      ["Valor garantido", (r) => fmtBRL(r.valor_garantido), true],
      ["Tarifas", (r) => fmtBRL(r.tarifas), true],
      ["Nota", (r) => (r.estrelas > 0 ? <Stars value={r.estrelas} size={12} /> : "—")],
    ],
    resumo: (s) => [["Armazéns", fmtNumber(s.quantidade)], ["Aguardando credenciamento", fmtNumber(s.pendentes)], ["Armazenado", `${fmtNumber(s.armazenado)} un. · ${t(s.armazenado_t)}`], ["Capacidade total", t(s.capacidade_t)], ["Valor garantido", fmtBRL(s.valor_garantido)]],
    filtroFinanceiro: "warehouse_id",
  },
  fundo: {
    label: "Fundo", icon: Landmark,
    situacoes: [["ativo", "Ativos"], ["suspenso", "Suspensos"]],
    ordens: [["pagamentos", "Mais pagamentos aprovados"], ["talhoes", "Mais talhões aprovados"], ["valor", "Maior valor pago"], ["acesso", "Último acesso"], ["nome", "Nome (A–Z)"]],
    metricaLabel: "Valor pago (R$)",
    fmtRanking: null,
    colunas: [
      ["Membro", (r) => <><strong>{r.nome}</strong><br /><span className="text-3">{r.email}</span></>],
      ["Talhões aprovados", (r) => fmtNumber(r.talhoes_aprovados), true],
      ["Ajustes pedidos", (r) => fmtNumber(r.ajustes_pedidos), true],
      ["Pagamentos aprovados", (r) => fmtNumber(r.pagamentos_aprovados), true],
      ["Valor pago", (r) => fmtBRL(r.valor_pago), true],
      ["Último acesso", (r) => (r.last_login_at ? timeAgo(r.last_login_at) : "nunca")],
    ],
    resumo: (s) => [["Membros", fmtNumber(s.quantidade)], ["Talhões aprovados", fmtNumber(s.talhoes_aprovados)], ["Pagamentos aprovados", fmtNumber(s.pagamentos_aprovados)], ["Valor pago", fmtBRL(s.valor_pago)]],
    filtroFinanceiro: null,
  },
};
const ORDEM_BRL = new Set(["investido", "recebido", "captado", "garantido", "tarifas", "valor"]);
const SITUACAO_TONE = { ativo: "success", aprovada: "success", aprovado: "success", pendente: "warning", suspenso: "danger", suspensa: "danger" };
const SITUACAO_LABEL = { ativo: "Ativo", aprovada: "Aprovada", aprovado: "Credenciado", pendente: "Aguardando", suspenso: "Suspenso", suspensa: "Suspensa" };
const STATUS_TALHAO = { captacao: "em captação", em_andamento: "em andamento", aguardando_aprovacao: "aguardando pagamento", pago: "pago", arquivado: "arquivado" };
const STATUS_GERAL = { ativo: "ativo", pago: "pago", cancelado: "cancelado", aprovado: "aprovado", rejeitado: "recusado", aceita: "aceita", pendente: "pendente", recusada: "recusada" };
const FILTROS = ["q", "situacao", "uf", "desde", "ate", "ordem", "min", "max"];

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const tipo = TIPOS[params.get("tipo")] ? params.get("tipo") : "investidores";
  const cfg = TIPOS[tipo];
  const f = useMemo(() => Object.fromEntries(FILTROS.map((k) => [k, params.get(k) || ""])), [params]);
  const page = Number(params.get("page")) || 1;
  const qs = useMemo(() => new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(), [f]);
  const [contagem, setContagem] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState(f.q);
  const [mais, setMais] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [reload, setReload] = useState(0);

  const set = useCallback((patch, manterPagina = false) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    if (!manterPagina) n.delete("page");
    setParams(n, { replace: true });
  }, [params, setParams]);

  useEffect(() => { api.usuariosContagem().then(setContagem).catch(() => {}); }, [reload]);
  useEffect(() => { setBusca(f.q); }, [f.q]);
  useEffect(() => {
    if (busca === f.q) return;
    const tm = setTimeout(() => set({ q: busca.trim() }), 350);
    return () => clearTimeout(tm);
  }, [busca]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    api.usuarios(tipo, `${qs}&page=${page}&page_size=25`)
      .then((d) => ativo && setData(d))
      .catch((e) => ativo && setError(e.message))
      .finally(() => ativo && setLoading(false));
    return () => { ativo = false; };
  }, [tipo, qs, page, reload]);

  function trocarTipo(novo) { setBusca(""); setParams({ tipo: novo }, { replace: true }); }
  const ordemAtual = f.ordem || cfg.ordens[0][0];
  const ordemLabel = cfg.ordens.find(([k]) => k === ordemAtual)?.[1];
  const fmtRank = (v) => (ORDEM_BRL.has(ordemAtual) ? fmtBRL(v) : fmtNumber(v));
  const ativos = ["situacao", "uf", "desde", "ate", "min", "max"].filter((k) => f[k]).length;
  const paginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Page title="Usuários">
      <div className="print-only print-head"><strong>Meu Talhão — {cfg.label}</strong><span>{ordemLabel} · gerado em {new Date().toLocaleString("pt-BR")}</span></div>
      <PageHeader
        back="/admin" backLabel="Administração"
        title="Usuários"
        subtitle="Investidores, fazendas, armazéns e fundo: quem são, quanto movimentam e quem se destaca."
        actions={<>
          <Button variant="secondary" icon={Download} onClick={() => downloadFromApi(`/admin/users/${tipo}/export.csv?${qs}`, `${tipo}.csv`).catch((e) => setError(e.message))}>Exportar CSV</Button>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
        </>}
      />
      <ErrorBanner message={error} />

      <div className="no-print" style={{ marginBottom: 16 }}>
        <Tabs label="Tipo de usuário" value={tipo} onChange={trocarTipo}
          tabs={Object.entries(TIPOS).map(([id, c]) => ({ id, label: c.label, count: contagem ? contagem[id] : 0 }))} />
      </div>

      <section className="card no-print" style={{ marginBottom: 16 }} aria-label="Busca e filtros">
        <div className="fin-filters">
          <div className="input-group" style={{ flex: "1 1 260px" }}>
            <Search size={18} aria-hidden />
            <label htmlFor="us-busca" className="sr-only">Buscar</label>
            <input id="us-busca" className="input" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder={tipo === "investidores" || tipo === "fundo" ? "Buscar por nome, e-mail ou cidade" : "Buscar por nome, cidade, responsável, e-mail ou CNPJ"} />
          </div>
          <SelectField label="Ordenar por" value={ordemAtual} onChange={(v) => set({ ordem: v })} style={{ minWidth: 220 }}
            options={cfg.ordens.map(([v, l]) => ({ value: v, label: l }))} />
          <Button variant={mais || ativos ? "primary" : "secondary"} icon={SlidersHorizontal} onClick={() => setMais((x) => !x)} aria-expanded={mais}>
            Filtros{ativos ? ` (${ativos})` : ""}
          </Button>
        </div>
        <div className="chips" role="group" aria-label="Situação" style={{ marginTop: 12 }}>
          <button type="button" className="chip" aria-pressed={!f.situacao} onClick={() => set({ situacao: "" })}>Todos</button>
          {cfg.situacoes.map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={f.situacao === v} onClick={() => set({ situacao: v })}>{l}</button>)}
        </div>
        {mais && (
          <div className="form-grid" style={{ marginTop: 14 }}>
            {tipo !== "fundo" && (
              <SelectField label="Estado (UF)" value={f.uf} onChange={(v) => set({ uf: v })}
                options={[{ value: "", label: "Todos" }, ...UFS.map((u) => ({ value: u, label: u }))]} />
            )}
            <div className="row">
              <TextField label="Cadastro de" type="date" value={f.desde} onChange={(v) => set({ desde: v })} />
              <TextField label="até" type="date" value={f.ate} onChange={(v) => set({ ate: v })} />
            </div>
            <div className="row">
              <TextField label={`${cfg.metricaLabel} mínimo`} type="number" inputMode="decimal" value={f.min} onChange={(v) => set({ min: v })} />
              <TextField label="máximo" type="number" inputMode="decimal" value={f.max} onChange={(v) => set({ max: v })} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button variant="ghost" icon={X} onClick={() => { setBusca(""); setParams({ tipo }, { replace: true }); }}>Limpar filtros</Button>
            </div>
          </div>
        )}
      </section>

      {!data ? <Loading /> : (
        <>
          <div className="grid-stats" style={{ marginBottom: 16 }}>
            {cfg.resumo(data.resumo).map(([l, v]) => <Stat key={l} label={l} value={v} />)}
          </div>

          {data.ranking.some((r) => r.valor > 0) && (
            <section className="card" style={{ marginBottom: 16 }} aria-labelledby="rank-t">
              <h2 id="rank-t" className="card-title" style={{ marginBottom: 10 }}>Ranking · {ordemLabel}</h2>
              <div style={{ height: Math.max(140, data.ranking.length * 34), overflow: "hidden" }} aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ranking} layout="vertical" margin={{ top: 0, right: 130, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 12, fill: "#342525" }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [fmtRank(v), ordemLabel]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="valor" fill="#B26000" radius={[0, 6, 6, 0]}>
                      <LabelList dataKey="valor" position="right" formatter={fmtRank} style={{ fontSize: 12, fill: "#342525", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ol className="sr-only">{data.ranking.map((r) => <li key={r.id}>{r.nome}: {fmtRank(r.valor)}</li>)}</ol>
            </section>
          )}

          <p className="text-sm text-2 no-print" style={{ marginBottom: 8 }}>{fmtNumber(data.total)} resultado(s){loading ? " · atualizando…" : ""}. Toque numa linha para ver a ficha.</p>
          {data.linhas.length === 0 ? (
            <EmptyState title="Ninguém encontrado">Ajuste a busca ou os filtros.</EmptyState>
          ) : (
            <>
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead><tr><th>#</th>{cfg.colunas.map(([h, , num]) => <th key={h} className={num ? "num" : undefined}>{h}</th>)}<th>Situação</th></tr></thead>
                  <tbody>
                    {data.linhas.map((r, i) => (
                      <tr key={r.id} onClick={() => setDetalhe(r)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setDetalhe(r); }}>
                        <td className="text-3">{(page - 1) * data.pageSize + i + 1}</td>
                        {cfg.colunas.map(([h, fn, num]) => <td key={h} className={num ? "num" : undefined}>{fn(r)}</td>)}
                        <td><Badge tone={SITUACAO_TONE[r.situacao]}>{SITUACAO_LABEL[r.situacao] || r.situacao}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="list fin-cards" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {data.linhas.map((r, i) => (
                  <li key={r.id}>
                    <button type="button" className="list-item" onClick={() => setDetalhe(r)} style={{ alignItems: "flex-start" }}>
                      <span className="text-3" style={{ minWidth: 22 }}>{(page - 1) * data.pageSize + i + 1}</span>
                      <span className="list-item-body">
                        <span className="list-item-title" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{r.nome} <Badge tone={SITUACAO_TONE[r.situacao]}>{SITUACAO_LABEL[r.situacao]}</Badge></span>
                        <span className="entity-metrics" style={{ marginTop: 6 }}>
                          {cfg.colunas.slice(1, 5).map(([h, fn]) => <span key={h} style={{ display: "flex", flexDirection: "column-reverse", padding: "6px 10px", borderRadius: 8, background: "var(--surface-well)" }}><span className="text-xs text-2">{h}</span><strong className="text-sm">{fn(r)}</strong></span>)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {paginas > 1 && (
                <nav className="no-print" aria-label="Páginas" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <IconButton label="Página anterior" icon={ChevronLeft} variant="surface" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, true)} />
                  <span className="text-sm">Página {page} de {paginas}</span>
                  <IconButton label="Próxima página" icon={ChevronRight} variant="surface" disabled={page >= paginas} onClick={() => set({ page: String(page + 1) }, true)} />
                </nav>
              )}
            </>
          )}
        </>
      )}

      {detalhe && <Ficha tipo={tipo} linha={detalhe} onClose={() => setDetalhe(null)} onChanged={() => { setDetalhe(null); setReload((n) => n + 1); }} />}
    </Page>
  );
}

// ---------- ficha de cada usuário ----------
function Ficha({ tipo, linha, onClose, onChanged }) {
  const dialog = useDialog();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const cfg = TIPOS[tipo];
  useEffect(() => { api.usuarioDetalhe(tipo, linha.id).then(setD).catch((e) => setError(e.message)); }, [tipo, linha.id]);
  const r = d?.linha || linha;

  async function acao(fn, msg) {
    try { await fn(); toast(msg); onChanged(); } catch (e) { setError(e.message); }
  }
  async function suspender() {
    const motivo = await dialog.prompt({ title: `Suspender ${r.nome}?`, message: "A pessoa perde o acesso na hora. Investimentos e dados continuam guardados.", label: "Motivo (fica registrado)", confirmLabel: "Suspender", destructive: true });
    if (motivo === null || motivo === undefined) return;
    acao(() => api.suspenderConta(r.id, true, motivo), "Conta suspensa");
  }

  const metricas = {
    investidores: [["Investido", fmtBRL(r.investido)], ["Em andamento", fmtBRL(r.em_andamento)], ["Recebido", fmtBRL(r.recebido)], ["Lucro realizado", fmtBRL(r.lucro_realizado)], ["Ticket médio", fmtBRL(r.ticket_medio)], ["Compras / talhões / fazendas", `${r.compras} / ${r.talhoes} / ${r.fazendas}`], ["Cadastro", dataBR(r.created_at)], ["Último acesso", r.last_login_at ? fmtDateTime(r.last_login_at) : "nunca"]],
    fazendas: [["Responsável", `${r.responsavel || "—"} · ${r.email || ""}`], ["Talhões", `${r.talhoes} (${r.talhoes_ativos} ativos, ${r.talhoes_pagos} pagos)`], ["Área ativa", `${fmtNumber(r.area_ativa)} ha`], ["Captado", fmtBRL(r.captado)], ["Investidores", fmtNumber(r.investidores)], ["Comissão + performance recebidas", fmtBRL(r.recebido)], ["Custos lançados", fmtBRL(r.custos)], ["Comissão da fazenda", fmtPct(r.commission_pct)]],
    armazens: [["Responsável", `${r.responsavel || "—"} · ${r.email || ""}`], ["CNPJ", r.cnpj || "—"], ["Capacidade", r.capacidade_t ? t(r.capacidade_t) : "—"], ["Armazenado", `${fmtNumber(r.armazenado)} unidades · ${t(r.armazenado_t)} em sacas`], ["Ocupação", r.ocupacao_pct != null ? fmtPct(r.ocupacao_pct, 1) : "—"], ["Custódias", `${r.custodias} (${r.custodias_ativas} ativas, ${r.pedidos_pendentes} pedidos)`], ["Valor garantido", fmtBRL(r.valor_garantido)], ["Tarifas recebidas", fmtBRL(r.tarifas)]],
    fundo: [["E-mail", r.email], ["Talhões aprovados", fmtNumber(r.talhoes_aprovados)], ["Ajustes pedidos", fmtNumber(r.ajustes_pedidos)], ["Pagamentos aprovados", fmtNumber(r.pagamentos_aprovados)], ["Valor pago", fmtBRL(r.valor_pago)], ["Último acesso", r.last_login_at ? fmtDateTime(r.last_login_at) : "nunca"]],
  }[tipo];

  return (
    <Dialog open onClose={onClose} title={r.nome} width={640}>
      <div className="stack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Badge tone={SITUACAO_TONE[r.situacao]}>{SITUACAO_LABEL[r.situacao]}</Badge>
          {r.estrelas > 0 && <Stars value={r.estrelas} size={13} />}
          {r.location && <span className="text-sm text-2">{r.location}</span>}
        </div>
        <ErrorBanner message={error} />
        <dl className="kv" style={{ margin: 0 }}>{metricas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>

        <div className="row">
          {cfg.filtroFinanceiro && <Button size="sm" variant="secondary" icon={Receipt} to={`/admin/financeiro?${cfg.filtroFinanceiro}=${r.id}`}>Ver transações</Button>}
          {tipo === "fazendas" && r.situacao !== "aprovada" && <Button size="sm" variant="success" onClick={() => acao(() => api.setFarmStatus(r.id, "aprovada"), "Fazenda aprovada")}>{r.situacao === "suspensa" ? "Reativar" : "Aprovar"}</Button>}
          {tipo === "fazendas" && r.situacao === "aprovada" && <Button size="sm" variant="danger-ghost" onClick={() => acao(() => api.setFarmStatus(r.id, "suspensa"), "Fazenda suspensa")}>Suspender</Button>}
          {tipo === "armazens" && r.situacao !== "aprovado" && <Button size="sm" variant="success" onClick={() => acao(() => api.setWarehouseStatus(r.id, "aprovado"), "Armazém credenciado")}>{r.situacao === "suspenso" ? "Reativar" : "Credenciar"}</Button>}
          {tipo === "armazens" && r.situacao === "aprovado" && <Button size="sm" variant="danger-ghost" onClick={() => acao(() => api.setWarehouseStatus(r.id, "suspenso"), "Armazém suspenso")}>Suspender</Button>}
          {(tipo === "investidores" || tipo === "fundo") && r.situacao === "ativo" && <Button size="sm" variant="danger-ghost" onClick={suspender}>Suspender acesso</Button>}
          {(tipo === "investidores" || tipo === "fundo") && r.situacao === "suspenso" && <Button size="sm" variant="success" onClick={() => acao(() => api.suspenderConta(r.id, false), "Acesso reativado")}>Reativar acesso</Button>}
          {tipo === "fundo" && <Button size="sm" variant="ghost" to="/admin?aba=equipe">Gerenciar equipe do fundo</Button>}
        </div>

        <div>
          <p className="card-title" style={{ marginBottom: 8 }}>
            {{ investidores: "Compras", fazendas: "Talhões", armazens: "Custódias", fundo: "Pagamentos aprovados" }[tipo]}
          </p>
          {!d ? <Loading /> : d.itens.length === 0 ? <p className="text-sm text-2">Nada ainda.</p> : (
            <ul className="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {d.itens.slice(0, 15).map((it, i) => (
                <li key={i}>
                  <Link to={`/talhao/${it.plot_id}`} className="list-item" onClick={onClose}>
                    <img src={culturaIcone(it.grao)} alt="" style={{ width: 32, height: 32, objectFit: "contain" }} />
                    <span className="list-item-body">
                      <span className="list-item-title truncate" style={{ display: "block" }}>{it.plot_nome}</span>
                      <span className="list-item-sub" style={{ display: "block" }}>
                        {tipo === "investidores" && `${it.farm_name} · ${fmtNumber(it.cotas)} ${unidadeNome(it.unidade, it.cotas)} · ${fmtBRL(it.valor_investido)} · ${STATUS_GERAL[it.status] || it.status} · ${dataBR(it.created_at)}`}
                        {tipo === "fazendas" && `${it.safra} · ${fmtNumber(it.area_ha)} ha · captado ${fmtBRL(it.captado)} · ${STATUS_TALHAO[it.status] || it.status}`}
                        {tipo === "armazens" && `${it.farm_name} · custódia ${STATUS_GERAL[it.custodia_status] || "—"} · ${STATUS_TALHAO[it.status] || it.status}${it.armazenado ? ` · ${fmtNumber(it.armazenado)} ${unidadeNome(it.unidade, it.armazenado)} guardadas` : ""}`}
                        {tipo === "fundo" && `${it.farm_name} · ${STATUS_GERAL[it.status] || it.status} · ${dataBR(it.created_at)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {tipo === "investidores" && r.situacao === "suspenso" && <Banner tone="warning">Conta suspensa: a pessoa não entra no app até ser reativada.</Banner>}
      </div>
    </Dialog>
  );
}
