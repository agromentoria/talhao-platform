import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtBRL, fmtNumber } from "../lib/format";
import { abrirDataUrl, lerArquivo } from "../lib/arquivo";
import { Button, Banner, ErrorBanner, Loading, Badge, useToast } from "../components/ui";

const NOME_CAT = { corretivo: "Corretivos", fertilizante: "Adubos e fertilizantes", nutritivo: "Nutritivos", defensivo: "Defensivos", semente: "Sementes e tratamento", combustivel: "Combustível", servico: "Serviços" };
const STATUS = { rascunho: ["Rascunho", "warning"], enviado: ["Em análise pelo fundo", "info"], aprovado: ["Aprovado · pedidos emitidos", "success"], devolvido: ["Devolvido para ajuste", "danger"] };
const ST_PEDIDO = { emitido: "Aguardando o fornecedor", aceito: "Aceito pelo fornecedor", entregue: "Entregue · confirme", recebido: "Recebido · aguardando pagamento", recusado: "Recusado por você", pago: "Pago pelo fundo" };

// Plano de compras do talhão: a fazenda ajusta as doses por ha, escolhe o
// fornecedor de cada item, anexa análise de solo e receita e envia ao fundo.
export default function PlanoCompras({ plotId }) {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const carregar = useCallback(() => {
    api.plano(plotId).then((x) => { setD(x); setItens(x.itens.map((i) => ({ ...i }))); }).catch((e) => setErro(e.message));
    api.pedidosTalhao(plotId).then((x) => setPedidos(x.pedidos)).catch(() => {});
  }, [plotId]);
  useEffect(carregar, [carregar]);
  if (!d) return erro ? <ErrorBanner message={erro} /> : <Loading label="Montando o plano…" />;

  const editavel = !["enviado", "aprovado"].includes(d.plot.plano_status);
  const area = Number(d.plot.area_ha);
  const calc = (i) => {
    const o = i.ofertas.find((x) => String(x.id) === String(i.offer_id));
    const qtd = Number(i.dose_ha || 0) * Number(i.aplicacoes || 1) * area;
    const total = o ? qtd * o.preco : 0;
    return { qtd, total, safra: total / (i.safras_efeito || 1), preco: o?.preco };
  };
  const totalCompras = itens.reduce((s, i) => s + calc(i).total, 0);
  const totalSafra = itens.reduce((s, i) => s + calc(i).safra, 0);
  const producao = area * Number(d.plot.produtividade_ha || 0);
  const mudar = (idx, campo, valor) => setItens((l) => l.map((x, j) => (j === idx ? { ...x, [campo]: valor } : x)));
  const grupos = itens.reduce((g, i, idx) => { (g[i.categoria] ||= []).push([i, idx]); return g; }, {});

  async function salvar() {
    setSalvando(true); setErro("");
    try {
      const x = await api.salvarPlano(plotId, itens.filter((i) => Number(i.dose_ha) > 0).map((i) => ({ catalog_item_id: i.catalog_item_id, dose_ha: i.dose_ha, aplicacoes: i.aplicacoes, offer_id: i.offer_id || null })));
      setD(x); setItens(x.itens); toast("Plano salvo");
      return x;
    } catch (e) { setErro(e.message); return null; } finally { setSalvando(false); }
  }
  async function enviar() {
    const x = await salvar(); if (!x) return;
    if (x.pendencias.length) { setErro(x.pendencias.join(" ")); return; }
    try { await api.enviarPlano(plotId); toast("Plano enviado ao fundo"); carregar(); } catch (e) { setErro(e.message); }
  }
  async function anexar(tipo, file) {
    try { const c = await lerArquivo(file); await api.anexarDocumento(plotId, tipo, file.name, c); toast("Documento anexado"); carregar(); } catch (e) { setErro(e.message); }
  }
  async function receber(p, aceito) {
    const motivo = aceito ? undefined : window.prompt("O que houve com a entrega? (item faltando, avariado, errado)");
    if (!aceito && !motivo) return;
    try { await api.receberPedido(p.id, aceito, motivo); toast(aceito ? "Recebimento confirmado" : "Entrega recusada"); carregar(); } catch (e) { setErro(e.message); }
  }
  const temDoc = (t) => d.documentos.find((x) => x.tipo === t);
  const [rotulo, tom] = STATUS[d.plot.plano_status] || STATUS.rascunho;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span className="text-sm">{d.plot.nome} · {fmtNumber(area)} ha · {d.plot.grao} · ofertas para {d.plot.uf}</span>
        <Badge tone={tom}>{rotulo}</Badge>
      </div>
      {d.plot.plano_status === "devolvido" && d.plot.plano_obs && <Banner tone="danger" title="O fundo pediu ajustes">{d.plot.plano_obs}</Banner>}
      {d.sugerido && <Banner tone="info" title="Plano sugerido">Montamos os itens com as doses de referência da cultura e a oferta mais barata do seu estado. Ajuste conforme a análise de solo e a recomendação do agrônomo e salve.</Banner>}
      <ErrorBanner message={erro} />

      {Object.entries(grupos).map(([cat, lista]) => (
        <section key={cat}>
          <p className="label-xs" style={{ marginBottom: 6 }}>{NOME_CAT[cat] || cat}</p>
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table">
              <thead><tr><th>Item</th><th className="num">Dose/ha</th><th className="num hide-sm">Aplic.</th><th className="num hide-sm">Total</th><th>Fornecedor</th><th className="num">Valor</th></tr></thead>
              <tbody>{lista.map(([i, idx]) => { const c = calc(i); return (
                <tr key={i.catalog_item_id} style={{ cursor: "default" }}>
                  <td>{i.nome}{i.exige_receita && <Badge tone="warning">receita</Badge>}
                    {i.safras_efeito > 1 && <div className="text-xs text-3">custo dividido em {i.safras_efeito} safras</div>}
                    {i.alerta_dose && <div className="text-xs text-danger">{i.alerta_dose}</div>}</td>
                  <td className="num">{editavel ? <input className="input" inputMode="decimal" style={{ width: 70, padding: "2px 6px", textAlign: "right" }} value={i.dose_ha} onChange={(e) => mudar(idx, "dose_ha", e.target.value.replace(",", "."))} aria-label={`Dose de ${i.nome}`} /> : i.dose_ha}
                    <span className="text-xs text-3"> {i.unidade_dose}</span></td>
                  <td className="num hide-sm">{editavel ? <input className="input" inputMode="numeric" style={{ width: 44, padding: "2px 6px", textAlign: "right" }} value={i.aplicacoes} onChange={(e) => mudar(idx, "aplicacoes", e.target.value)} aria-label={`Aplicações de ${i.nome}`} /> : i.aplicacoes}</td>
                  <td className="num hide-sm text-sm">{fmtNumber(Math.round(c.qtd * 100) / 100)} {i.unidade_dose}</td>
                  <td>{editavel ? (
                    <select className="select" value={i.offer_id || ""} onChange={(e) => mudar(idx, "offer_id", e.target.value)} aria-label={`Fornecedor de ${i.nome}`} style={{ minWidth: 170 }}>
                      <option value="">{i.ofertas.length ? "Escolha" : "Sem oferta no seu estado"}</option>
                      {i.ofertas.map((o, k) => <option key={o.id} value={o.id}>{o.fornecedor} · {fmtBRL(o.preco)}/{i.unidade_dose}{k === 0 ? " (menor preço)" : ""}</option>)}
                    </select>) : <span className="text-sm">{i.fornecedor || "—"}</span>}</td>
                  <td className="num"><strong>{c.total ? fmtBRL(c.total) : "—"}</strong></td>
                </tr>); })}</tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="card card--well" style={{ padding: 14 }}>
        <dl className="kv" style={{ margin: 0 }}>
          <div><dt>Total das compras (o fundo paga)</dt><dd><strong>{fmtBRL(totalCompras)}</strong></dd></div>
          <div><dt>Custo desta safra (corretivos divididos)</dt><dd>{fmtBRL(totalSafra)}</dd></div>
          <div><dt>Por hectare</dt><dd>{fmtBRL(totalSafra / (area || 1))}</dd></div>
          <div className="total"><dt>Por saca</dt><dd>{producao ? fmtBRL(totalSafra / producao) : "—"}</dd></div>
        </dl>
      </div>

      <section className="card" style={{ padding: 14 }}>
        <p className="card-title" style={{ marginBottom: 8 }}>Documentos obrigatórios</p>
        {[["analise_solo", "Análise de solo", "Justifica corretivos e adubos."], ["receita", "Receita agronômica com ART", "Exigida por lei para comprar defensivos."]].map(([t, nome, dica]) => (
          <div key={t} className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0" }}>
            <span className="text-sm"><strong>{nome}</strong> · {temDoc(t) ? <span className="text-success">anexada ({temDoc(t).nome})</span> : <span className="text-danger">pendente</span>}<br /><span className="text-xs text-3">{dica}</span></span>
            <span className="row" style={{ display: "flex", gap: 6 }}>
              {temDoc(t) && <Button size="sm" variant="ghost" onClick={async () => abrirDataUrl((await api.documento(plotId, temDoc(t).id)).conteudo)}>Ver</Button>}
              {editavel && <label className="btn btn--secondary btn--sm" style={{ cursor: "pointer" }}>{temDoc(t) ? "Trocar" : "Anexar"}
                <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && anexar(t, e.target.files[0])} /></label>}
            </span>
          </div>
        ))}
      </section>

      {editavel && (
        <div className="row" style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={salvar} loading={salvando}>Salvar rascunho</Button>
          <Button variant="success" onClick={enviar} loading={salvando}>Enviar ao fundo</Button>
        </div>
      )}

      {pedidos.length > 0 && (
        <section className="card" style={{ padding: 14 }}>
          <p className="card-title" style={{ marginBottom: 8 }}>Pedidos e recebimentos</p>
          {pedidos.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--border, #e5dccb)", padding: "8px 0" }}>
              <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <span className="text-sm"><strong>#{p.id} · {p.fornecedor}</strong> · {fmtBRL(p.valor_total)}{p.nf_numero ? ` · NF ${p.nf_numero}` : ""}</span>
                <Badge tone={p.status === "pago" || p.status === "recebido" ? "success" : p.status === "entregue" ? "warning" : p.status === "recusado" ? "danger" : "info"}>{ST_PEDIDO[p.status]}</Badge>
              </div>
              <p className="text-xs text-3" style={{ margin: "4px 0" }}>{p.itens.map((x) => `${x.item}: ${fmtNumber(Math.round(x.quantidade * 100) / 100)} ${x.unidade}`).join(" · ")}</p>
              {p.status === "entregue" && (
                <span className="row" style={{ display: "flex", gap: 6 }}>
                  <Button size="sm" variant="success" onClick={() => receber(p, true)}>Confirmar recebimento</Button>
                  <Button size="sm" variant="ghost" onClick={() => receber(p, false)}>Recusar entrega</Button>
                </span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
