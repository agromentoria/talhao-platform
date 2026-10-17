import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Printer, ClipboardList, ArrowDownCircle, Receipt, Wallet, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { fmtBRL, fmtNumber, fmtPct } from "../lib/format";
import { culturaTexto, fmtData, unidadeNome } from "../config/culturas";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, IconButton, Banner, ErrorBanner, Loading, EmptyState, Dialog, TextField, SelectField, ProgressBar, useDialog, useToast } from "../components/ui";
import { GrainThumb } from "../components/domain";
import { Stat } from "./Portfolio";

// Demonstrativo financeiro do talhão: quanto entrou dos investidores, onde foi
// gasto (por categoria, previsto × realizado) e como o resultado é dividido.
export default function Demonstrativo() {
  const { id } = useParams();
  const { user } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [custoEdit, setCustoEdit] = useState(null); // {} novo | custo existente
  const [orcOpen, setOrcOpen] = useState(false);

  const load = useCallback(() => api.demonstrativo(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (!d) return <Page title="Demonstrativo" back={`/talhao/${id}`} width="medium">{error ? <ErrorBanner message={error} /> : <Loading />}</Page>;

  const t = d.talhao;
  const podeEditar = user && (user.role === "admin" || (user.role === "fazenda" && user.farm_id === t.farm_id));
  const u = unidadeNome(t.unidade, 1);
  const dist = d.distribuicao;
  const tot = d.totais;
  const maxCat = Math.max(1, ...d.porCategoria.map((c) => Math.max(c.previsto, c.realizado)));
  const lucroInvestidores = dist.investidores - tot.captado;
  const recebidoFazenda = dist.comissaoFazenda + dist.performanceFazenda;

  async function excluir(c) {
    const ok = await dialog.confirm({ title: "Excluir este custo?", message: `${c.descricao} · ${fmtBRL(c.valor)}`, confirmLabel: "Excluir", destructive: true });
    if (!ok) return;
    try { await api.deleteCusto(t.id, c.id); toast("Custo excluído"); load(); } catch (e) { setError(e.message); }
  }

  return (
    <Page title={`Demonstrativo · ${t.nome}`} back={`/talhao/${id}`} width="medium">
      <div className="print-only print-head">
        <strong>Meu Talhão — demonstrativo financeiro</strong>
        <span>{t.nome} · {t.farm_name} · gerado em {new Date().toLocaleString("pt-BR")}</span>
      </div>
      <PageHeader
        back={`/talhao/${id}`}
        backLabel="Talhão"
        leading={<GrainThumb grao={t.grao} size="lg" />}
        title="Demonstrativo financeiro"
        subtitle={`${t.nome} · ${culturaTexto(t)} · ${t.farm_name}, ${t.farm_location} · ${fmtNumber(t.area_ha)} ha · ${t.safra}`}
        actions={
          <>
            {podeEditar && <Button icon={Plus} onClick={() => setCustoEdit({})}>Lançar custo</Button>}
            {podeEditar && <Button variant="secondary" icon={ClipboardList} onClick={() => setOrcOpen(true)}>Orçamento</Button>}
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button>
          </>
        }
      />
      <ErrorBanner message={error} />

      <p className="text-sm text-2" style={{ marginBottom: 16, maxWidth: "70ch" }}>
        Os investidores compram a produção antes do plantio: esse dinheiro financia a lavoura. Aqui a fazenda mostra onde ele foi aplicado e como o resultado da venda é dividido entre todos.
      </p>

      <div className="grid-stats" style={{ marginBottom: 20 }}>
        <Stat label="Recebido dos investidores" value={fmtBRL(tot.captado)} icon={ArrowDownCircle} tone="success" />
        <Stat label={`Custos lançados (${fmtPct(tot.percentualAplicado)} do recebido)`} value={fmtBRL(tot.realizado)} icon={Receipt} />
        <Stat label="Saldo da captação" value={fmtBRL(tot.saldoCaptacao)} icon={Wallet} />
        <Stat label={`Resultado da fazenda ${dist.tipo === "previsto" ? "(previsto)" : ""}`} value={fmtBRL(d.resultadoFazenda)} icon={TrendingUp} tone="success" />
      </div>

      {/* ---------- custos por categoria ---------- */}
      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="dem-cat">
        <div className="card-head" style={{ marginBottom: 10 }}>
          <div>
            <h2 id="dem-cat" className="card-title">Custos da operação por etapa</h2>
            <p className="card-desc">Previsto no orçamento × realizado (lançado pela fazenda com descrição e data).</p>
          </div>
          <div className="text-sm" style={{ textAlign: "right" }}>
            <div>Previsto: <strong>{fmtBRL(tot.previsto)}</strong></div>
            <div>Realizado: <strong>{fmtBRL(tot.realizado)}</strong></div>
          </div>
        </div>
        <div className="dem-cats">
          {d.porCategoria.filter((c) => c.previsto > 0 || c.realizado > 0).map((c) => {
            const acima = c.previsto > 0 && c.realizado > c.previsto;
            return (
              <div key={c.id} className="dem-cat">
                <div className="dem-cat-head">
                  <span>{c.label}</span>
                  <span className="money"><strong className={acima ? "text-danger" : ""}>{fmtBRL(c.realizado)}</strong>{c.previsto > 0 && <span className="text-3"> de {fmtBRL(c.previsto)}</span>}</span>
                </div>
                <div className="dem-bar" aria-hidden>
                  <span className="dem-bar-prev" style={{ width: `${(c.previsto / maxCat) * 100}%` }} />
                  <span className={`dem-bar-real ${acima ? "is-over" : ""}`} style={{ width: `${(c.realizado / maxCat) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {d.porCategoria.every((c) => !c.previsto && !c.realizado) && (
            <p className="text-sm text-2">A fazenda ainda não informou orçamento nem custos.</p>
          )}
        </div>
        <dl className="kv" style={{ marginTop: 14 }}>
          <div><dt>Custo por hectare</dt><dd>{fmtBRL(tot.custoPorHa)}</dd></div>
          <div><dt>Custo por {u} prevista</dt><dd>{fmtBRL(tot.custoPorUnidade)}</dd></div>
          <div><dt>Preço de referência por {u}</dt><dd>{fmtBRL(t.preco_venda_estimado)}</dd></div>
        </dl>
      </section>

      {/* ---------- lançamentos ---------- */}
      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="dem-lanc">
        <div className="card-head" style={{ marginBottom: 10 }}>
          <h2 id="dem-lanc" className="card-title">Lançamentos ({d.custos.length})</h2>
          {podeEditar && <Button size="sm" variant="secondary" icon={Plus} onClick={() => setCustoEdit({})} className="no-print">Lançar custo</Button>}
        </div>
        {d.custos.length === 0 ? (
          <EmptyState title="Nenhum custo lançado">{podeEditar ? "Lance cada gasto da safra: sementes, adubo, defensivos, operações. O investidor acompanha por aqui." : "A fazenda ainda não lançou os custos desta safra."}</EmptyState>
        ) : (
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table" style={{ cursor: "default" }}>
              <thead><tr><th>Data</th><th>Etapa</th><th>Descrição</th><th className="num">Valor</th>{podeEditar && <th className="no-print" />}</tr></thead>
              <tbody>
                {d.custos.map((c) => (
                  <tr key={c.id} style={{ cursor: "default" }}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtData(c.data, { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
                    <td>{d.categorias.find((x) => x.id === c.categoria)?.label || c.categoria}</td>
                    <td>{c.descricao}</td>
                    <td className="num">{fmtBRL(c.valor)}</td>
                    {podeEditar && (
                      <td className="no-print" style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <IconButton label="Editar custo" icon={Pencil} size={16} onClick={() => setCustoEdit(c)} />
                        <IconButton label="Excluir custo" icon={Trash2} size={16} onClick={() => excluir(c)} style={{ color: "var(--danger)" }} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>Total</td><td className="num">{fmtBRL(tot.realizado)}</td>{podeEditar && <td className="no-print" />}</tr></tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ---------- distribuição do resultado ---------- */}
      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="dem-dist">
        <h2 id="dem-dist" className="card-title">{dist.tipo === "realizado" ? "Como o resultado foi dividido" : t.modelo === "piso" ? "Como o resultado será dividido (se o preço não subir)" : "Como o resultado será dividido (se a venda sair na meta)"}</h2>
        <p className="card-desc" style={{ marginBottom: 12 }}>
          {dist.tipo === "realizado"
            ? `Venda a ${fmtBRL(dist.precoVenda)} por ${u} (retorno de ${fmtPct(t.retorno_final, 2)}).`
            : t.modelo === "piso"
              ? `Simulação conservadora com venda a ${fmtBRL(dist.precoVenda)} por ${u} (preço de referência): os investidores recebem o piso de ${fmtPct(t.piso_pct, 2)} e a fazenda paga o piso, as taxas e a armazenagem. Se o preço subir, a fazenda fica com 60% da alta.`
              : `Simulação com venda a ${fmtBRL(dist.precoVenda)} por ${u}, a meta prometida (${fmtPct(t.previsao_retorno)}). Acima disso entra a performance da fazenda.`}
        </p>
        {tot.vendidas === 0 ? <p className="text-sm text-2">Ainda não há investimentos neste talhão.</p> : (
          <>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Valor da venda ({fmtNumber(tot.vendidas)} {unidadeNome(t.unidade, tot.vendidas)} dos investidores)</dt><dd>{fmtBRL(dist.valorVenda)}</dd></div>
              <div><dt>Investidores (capital + lucro)</dt><dd className="text-success">{fmtBRL(dist.investidores)}</dd></div>
              {t.modelo === "piso" ? (
                <div><dt>{dist.comissaoFazenda >= 0 ? "Fazenda · 60% da alta, menos taxas e armazenagem" : "Fazenda · paga para garantir o piso (+ taxas e armazenagem)"}</dt><dd className={dist.comissaoFazenda >= 0 ? undefined : "text-danger"}>{dist.comissaoFazenda < 0 ? "−\u00a0" : ""}{fmtBRL(Math.abs(dist.comissaoFazenda))}</dd></div>
              ) : (<>
              <div><dt>Fazenda · comissão até a meta</dt><dd>{fmtBRL(dist.comissaoFazenda)}</dd></div>
              <div><dt>Fazenda · performance acima da meta</dt><dd>{fmtBRL(dist.performanceFazenda)}</dd></div>
              </>)}
              {dist.fundo > 0 && <div><dt>Fundo gestor</dt><dd>{fmtBRL(dist.fundo)}</dd></div>}
              <div><dt>Armazém garantidor{t.warehouse_name ? ` (${t.warehouse_name})` : ""}</dt><dd>{fmtBRL(dist.armazem)}</dd></div>
              <div><dt>Plataforma Meu Talhão</dt><dd>{fmtBRL(dist.plataforma)}</dd></div>
            </dl>
            <div className="dem-split" aria-hidden style={{ marginTop: 14 }}>
              {[["investidores", dist.investidores, "var(--success)"], ["fazenda", Math.max(0, recebidoFazenda), "var(--brand-orange)"], ["armazem", dist.armazem, "#6B8CAE"], ["plataforma", dist.plataforma, "#C9A227"]]
                .map(([k, v, cor]) => <span key={k} style={{ flexGrow: Math.max(v, 0.0001), background: cor }} />)}
            </div>
            <div className="grid-stats" style={{ marginTop: 14 }}>
              <div><p className="label-xs">Lucro dos investidores</p><p className="stat-value text-success" style={{ marginTop: 2 }}>{fmtBRL(lucroInvestidores)}</p><p className="text-xs text-3">{fmtPct(tot.captado ? (lucroInvestidores / tot.captado) * 100 : 0, 2)} sobre o investido</p></div>
              <div><p className="label-xs">Recebido pela fazenda na colheita</p><p className="stat-value" style={{ marginTop: 2 }}>{fmtBRL(recebidoFazenda)}</p><p className="text-xs text-3">{t.modelo === "piso" ? "parte da alta, já descontados piso e taxas" : "comissão + performance"}</p></div>
            </div>
          </>
        )}
      </section>

      {/* ---------- resultado da fazenda ---------- */}
      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="dem-res">
        <h2 id="dem-res" className="card-title">Resultado da fazenda neste talhão</h2>
        <dl className="kv" style={{ marginTop: 10 }}>
          <div><dt>Recebido dos investidores (venda antecipada da produção)</dt><dd>{fmtBRL(tot.captado)}</dd></div>
          <div><dt>(−) Custos da operação lançados</dt><dd>{"−\u00a0"}{fmtBRL(tot.realizado)}</dd></div>
          <div><dt>(+) Comissão e performance na colheita</dt><dd>{fmtBRL(recebidoFazenda)}</dd></div>
          {t.arm_pagador !== "investidores" && <div><dt>(−) Armazenagem paga pela fazenda</dt><dd>{"−\u00a0"}{fmtBRL(tot.captado - tot.realizado + recebidoFazenda - d.resultadoFazenda)}</dd></div>}
          <div className="total"><dt>Resultado {dist.tipo === "previsto" ? "previsto" : ""}</dt><dd className="text-success">{fmtBRL(d.resultadoFazenda)}</dd></div>
        </dl>
        <p className="text-xs text-3" style={{ marginTop: 10 }}>
          Não inclui a produção que a fazenda vende por conta própria fora da plataforma.
        </p>
      </section>

      {podeEditar && <CustoDialog custo={custoEdit} plotId={t.id} categorias={d.categorias} onClose={() => setCustoEdit(null)} onSaved={() => { setCustoEdit(null); toast("Custo salvo"); load(); }} />}
      {podeEditar && <OrcamentoDialog open={orcOpen} plotId={t.id} itens={d.porCategoria} area={t.area_ha} onClose={() => setOrcOpen(false)} onSaved={() => { setOrcOpen(false); toast("Orçamento salvo"); load(); }} />}
    </Page>
  );
}

function CustoDialog({ custo, plotId, categorias, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!custo) return;
    setError("");
    setF({ categoria: custo.categoria || "", descricao: custo.descricao || "", valor: custo.valor ?? "", data: custo.data ? String(custo.data).slice(0, 10) : new Date().toISOString().slice(0, 10) });
  }, [custo]);
  if (!custo) return null;
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      if (custo.id) await api.editCusto(plotId, custo.id, f); else await api.addCusto(plotId, f);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onClose={onClose} title={custo.id ? "Editar custo" : "Lançar custo"} width={520}>
      <form onSubmit={submit} className="stack">
        <ErrorBanner message={error} />
        <SelectField label="Etapa / categoria" value={f.categoria} onChange={set("categoria")} required
          options={[{ value: "", label: "Escolha" }, ...categorias.map((c) => ({ value: c.id, label: c.label }))]} />
        <TextField label="Descrição" value={f.descricao} onChange={set("descricao")} required maxLength={200} placeholder="Ex.: Sementes Intacta RR2 PRO, 2.850 sacos" />
        <div className="row">
          <TextField label="Valor (R$)" type="number" inputMode="decimal" step="0.01" min={0.01} value={f.valor} onChange={set("valor")} required />
          <TextField label="Data" type="date" value={f.data} onChange={set("data")} required />
        </div>
        <div className="dialog-actions" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}

function OrcamentoDialog({ open, plotId, itens, area, onClose, onSaved }) {
  const [vals, setVals] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setError(""); setVals(Object.fromEntries(itens.map((c) => [c.id, c.previsto ? String(c.previsto) : ""]))); }
  }, [open, itens]);
  const total = Object.values(vals).reduce((s, v) => s + (Number(v) || 0), 0);

  async function save() {
    setSaving(true); setError("");
    try { await api.setOrcamento(plotId, vals); onSaved(); } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Orçamento previsto da safra" width={600}
      actions={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving}>Salvar orçamento</Button></>}>
      <p style={{ marginBottom: 12 }}>Quanto a fazenda planeja gastar em cada etapa. O investidor compara com o que for lançado ao longo da safra.</p>
      <ErrorBanner message={error} />
      <div className="form-grid">
        {itens.filter((c) => !c.id.startsWith("_")).map((c) => (
          <TextField key={c.id} label={c.label} type="number" inputMode="decimal" min={0} step="0.01" value={vals[c.id] ?? ""}
            onChange={(v) => setVals((s) => ({ ...s, [c.id]: v }))}
            hint={Number(vals[c.id]) > 0 && area ? `${fmtBRL(Number(vals[c.id]) / area)} por ha` : undefined} />
        ))}
      </div>
      <Banner tone="info" style={{ marginTop: 12 }}>Total previsto: <strong>{fmtBRL(total)}</strong>{area ? ` · ${fmtBRL(total / area)} por hectare` : ""}</Banner>
    </Dialog>
  );
}

// barra simples reaproveitada no resumo da página do talhão
export function DemonstrativoResumo({ d }) {
  if (!d) return null;
  const tot = d.totais;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <dl className="kv" style={{ margin: 0 }}>
        <div><dt>Recebido dos investidores</dt><dd>{fmtBRL(tot.captado)}</dd></div>
        <div><dt>Custos lançados até agora</dt><dd>{fmtBRL(tot.realizado)}{tot.previsto ? ` de ${fmtBRL(tot.previsto)} previstos` : ""}</dd></div>
      </dl>
      {tot.previsto > 0 && <ProgressBar value={(tot.realizado / tot.previsto) * 100} label="Custos realizados sobre o orçamento" />}
    </div>
  );
}
