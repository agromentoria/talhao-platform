import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, Badge, Banner, ErrorBanner, Loading, Segmented, useToast } from "../components/ui";
import { fmtBRL, fmtNumber } from "../lib/format";

const NOME_CAT = { corretivo: "Corretivos", fertilizante: "Adubos e fertilizantes", nutritivo: "Nutritivos", defensivo: "Defensivos", semente: "Sementes e tratamento", combustivel: "Combustível", servico: "Serviços" };
const TOM = { aprovado: "success", pendente: "warning", suspenso: "danger" };

// Administração do marketplace: aprovar fornecedores e tradings; catálogo e doses de referência
export default function AdminMarketplace({ isAdmin }) {
  const [aba, setAba] = useState("cadastros");
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api.configMarketplace().then(setCfg).catch(() => {}); }, []);
  return (
    <div className="stack">
      <Chaves cfg={cfg} setCfg={setCfg} podeEditar={isAdmin} />
      <Segmented label="Marketplace" value={aba} onChange={setAba} options={[{ id: "cadastros", label: "Fornecedores e tradings" }, { id: "catalogo", label: "Catálogo e doses" }, ...(cfg?.insumos_ativo ? [{ id: "planos", label: "Planos e pagamentos" }] : [])]} />
      {aba === "cadastros" ? <Cadastros /> : aba === "catalogo" ? <Catalogo podeEditar={isAdmin} /> : <PlanosPagamentos />}
    </div>
  );
}

function Cadastros() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => api.cadastrosMarketplace().then(setD).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  async function mudar(tipo, id, status) {
    try { await api.statusMarketplace(tipo, id, status); toast(status === "aprovado" ? "Cadastro aprovado" : "Cadastro atualizado"); carregar(); } catch (e) { setErro(e.message); }
  }
  if (!d) return erro ? <ErrorBanner message={erro} /> : <Loading />;
  const bloco = (titulo, tipo, lista, extra) => (
    <section className="card">
      <h2 className="card-title">{titulo} <span className="text-sm text-3">({lista.length})</span></h2>
      {!lista.length ? <p className="text-sm text-2">Nenhum cadastro ainda.</p> : (
        <div className="fin-table-wrap" style={{ display: "block" }}>
          <table className="fin-table">
            <thead><tr><th>Empresa</th><th className="hide-sm">CNPJ</th><th className="hide-sm">Responsável</th><th>{tipo === "fornecedor" ? "Entrega em" : "Compra em"}</th><th className="hide-sm">{tipo === "fornecedor" ? "Ofertas" : "Culturas"}</th><th>Situação</th><th></th></tr></thead>
            <tbody>{lista.map((c) => (
              <tr key={c.id} style={{ cursor: "default" }}>
                <td><strong>{c.razao_social}</strong><div className="text-xs text-3">{c.cidade}{c.uf ? `, ${c.uf}` : ""}</div></td>
                <td className="hide-sm text-sm">{c.cnpj}</td>
                <td className="hide-sm text-sm">{c.responsavel}<div className="text-xs text-3">{c.email}</div></td>
                <td className="text-sm">{(tipo === "fornecedor" ? c.regioes : c.pracas || []).join(", ") || "—"}</td>
                <td className="hide-sm text-sm">{extra(c)}</td>
                <td><Badge tone={TOM[c.status]}>{c.status}</Badge></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {c.status !== "aprovado" && <Button size="sm" onClick={() => mudar(tipo, c.id, "aprovado")}>Aprovar</Button>}
                  {c.status === "aprovado" && <Button size="sm" variant="ghost" onClick={() => mudar(tipo, c.id, "suspenso")}>Suspender</Button>}
                </td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
  return (
    <>
      <ErrorBanner message={erro} />
      {bloco("Fornecedores", "fornecedor", d.fornecedores, (c) => `${c.ofertas} oferta(s) · ${(c.categorias || []).map((x) => NOME_CAT[x] || x).join(", ")}`)}
      {bloco("Tradings", "trading", d.tradings, (c) => (c.culturas || []).join(", ") || "—")}
    </>
  );
}

function Catalogo({ podeEditar }) {
  const toast = useToast();
  const [cultura, setCultura] = useState("Soja");
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => api.catalogo(cultura).then((d) => setItens(d.itens)).catch((e) => setErro(e.message)), [cultura]);
  useEffect(() => { carregar(); }, [carregar]);
  async function salvarDose(item, campo, valor, dose) {
    const atual = dose || { dose_min: null, dose_ref: null, dose_max: null, aplicacoes: 1, safras_efeito: 1 };
    const novo = { ...atual, [campo]: valor };
    if (!(Number(novo.dose_ref) > 0)) return;
    try { await api.salvarDose({ catalog_item_id: item.id, cultura, uf: "BR", ...novo }); toast("Dose salva"); carregar(); } catch (e) { setErro(e.message); }
  }
  if (!itens) return erro ? <ErrorBanner message={erro} /> : <Loading />;
  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 className="card-title">Itens e doses de referência por hectare</h2>
        <Segmented label="Cultura" value={cultura} onChange={setCultura} options={["Soja", "Milho", "Feijão"].map((c) => ({ id: c, label: c }))} />
      </div>
      <p className="card-desc">Referências para avisar quando a dose do plano foge mais de 30%. A dose real vem da análise de solo e da recomendação do agrônomo. {podeEditar ? "Clique num número para editar." : ""}</p>
      <div className="fin-table-wrap" style={{ display: "block" }}>
        <table className="fin-table">
          <thead><tr><th>Item</th><th className="hide-sm">Unidade</th><th className="num">Mín.</th><th className="num">Ref.</th><th className="num">Máx.</th><th className="num hide-sm">Aplicações</th><th className="num hide-sm">Safras de efeito</th></tr></thead>
          <tbody>{itens.map((i) => {
            const d = i.doses.find((x) => x.cultura === cultura);
            const celula = (campo, cls = "num") => (
              <td className={cls}>
                {podeEditar ? (
                  <input className="input" style={{ width: 72, padding: "2px 6px", textAlign: "right" }} defaultValue={d?.[campo] ?? ""} key={`${i.id}-${campo}-${d?.[campo]}`}
                    inputMode="decimal" onBlur={(e) => { const v = e.target.value.replace(",", "."); if (String(d?.[campo] ?? "") !== v && v !== "") salvarDose(i, campo, Number(v), d); }} />
                ) : (d?.[campo] ?? "—")}
              </td>
            );
            return (
              <tr key={i.id} style={{ cursor: "default" }}>
                <td>{i.nome}{i.exige_receita && <Badge tone="warning">receita</Badge>}<div className="text-xs text-3">{NOME_CAT[i.categoria]}</div></td>
                <td className="hide-sm text-sm">{i.unidade_dose}/ha</td>
                {celula("dose_min")}{celula("dose_ref")}{celula("dose_max")}{celula("aplicacoes", "num hide-sm")}{celula("safras_efeito", "num hide-sm")}
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </section>
  );
}

function Chaves({ cfg, setCfg, podeEditar }) {
  const toast = useToast();
  const [erro, setErro] = useState("");
  if (!cfg) return null;
  async function mudar(campo, valor) {
    if (campo === "insumos_ativo" && valor && !window.confirm("Ligar a compra de insumos pelo fundo? As fazendas passam a poder escolher \"o fundo compra os insumos\" ao cadastrar talhões.")) return;
    try { setCfg(await api.salvarConfigMarketplace({ [campo]: valor })); toast("Configuração salva"); } catch (e) { setErro(e.message); }
  }
  const linha = (campo, titulo, desc) => (
    <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 320px" }}><strong className="text-sm">{titulo}</strong> <Badge tone={cfg[campo] ? "success" : "warning"}>{cfg[campo] ? "ligado" : "desligado"}</Badge><br /><span className="text-xs text-3">{desc}</span></span>
      {podeEditar && <Button size="sm" variant={cfg[campo] ? "secondary" : "primary"} onClick={() => mudar(campo, !cfg[campo])}>{cfg[campo] ? "Desligar" : "Ligar"}</Button>}
    </div>
  );
  return (
    <section className="card">
      <h2 className="card-title">Funções do marketplace</h2>
      <ErrorBanner message={erro} />
      {linha("cadastro_aberto", "Cadastro de fornecedores e tradings", "Mostra os perfis Fornecedor e Trading na tela de cadastro.")}
      {linha("insumos_ativo", "Compra de insumos pelo fundo", "Desligado: a fazenda recebe a captação em dinheiro (como hoje). Ligado: a fazenda pode escolher que o fundo compre os insumos do plano de compras e pague os fornecedores.")}
      {!podeEditar && <p className="text-xs text-3">Só a administração da plataforma liga ou desliga.</p>}
    </section>
  );
}

const ST_PLANO = { enviado: ["Aguardando aprovação", "warning"], aprovado: ["Aprovado", "success"], devolvido: ["Devolvido", "danger"] };
const ST_PED = { emitido: "Com o fornecedor", aceito: "Aceito", entregue: "Entregue · fazenda confere", recebido: "Recebido · pagar", recusado: "Recusado pela fazenda", pago: "Pago" };
function PlanosPagamentos() {
  const toast = useToast();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);
  const [plano, setPlano] = useState(null);
  const carregar = useCallback(() => api.insumosFundo().then(setD).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  async function verPlano(id) { setAberto(id); setPlano(null); try { setPlano(await api.plano(id)); } catch (e) { setErro(e.message); } }
  async function aprovar(id) { try { const r = await api.aprovarPlano(id); toast(`Plano aprovado: ${r.pedidos} pedido(s) enviados`); setAberto(null); carregar(); } catch (e) { setErro(e.message); } }
  async function devolver(id) { const m = window.prompt("O que a fazenda precisa ajustar?"); if (!m) return; try { await api.devolverPlano(id, m); toast("Plano devolvido"); setAberto(null); carregar(); } catch (e) { setErro(e.message); } }
  async function pagar(o) { if (!window.confirm(`Pagar ${fmtBRL(o.valor_total)} a ${o.fornecedor}, retendo ${o.comissao_pct}%?`)) return; try { await api.pagarPedido(o.id); toast("Pagamento registrado"); carregar(); } catch (e) { setErro(e.message); } }
  if (!d) return erro ? <ErrorBanner message={erro} /> : <Loading />;
  const aPagar = d.pedidos.filter((p) => p.status === "recebido");
  return (
    <>
      <ErrorBanner message={erro} />
      <section className="card">
        <h2 className="card-title">Planos de compras</h2>
        {!d.planos.length ? <p className="text-sm text-2">Nenhum plano enviado ainda.</p> : d.planos.map((p) => {
          const [rot, tom] = ST_PLANO[p.plano_status] || [p.plano_status, "info"];
          return (
            <div key={p.id} style={{ borderTop: "1px solid var(--border, #e5dccb)", padding: "10px 0" }}>
              <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="text-sm"><strong>{p.fazenda}</strong> · {p.nome} · {p.grao} · {fmtNumber(p.area_ha)} ha · {fmtBRL(p.plano_custo)}</span>
                <span className="row" style={{ display: "flex", gap: 6, alignItems: "center" }}><Badge tone={tom}>{rot}</Badge><Button size="sm" variant="ghost" onClick={() => (aberto === p.id ? setAberto(null) : verPlano(p.id))}>{aberto === p.id ? "Fechar" : "Ver plano"}</Button></span>
              </div>
              {aberto === p.id && (plano ? (
                <div style={{ marginTop: 8 }}>
                  {plano.pendencias.length > 0 && <Banner tone="warning">{plano.pendencias.join(" ")}</Banner>}
                  <div className="fin-table-wrap" style={{ display: "block" }}>
                    <table className="fin-table"><thead><tr><th>Item</th><th className="num">Dose/ha</th><th className="hide-sm">Fornecedor</th><th className="num">Valor</th></tr></thead>
                      <tbody>{plano.itens.map((i) => (<tr key={i.catalog_item_id} style={{ cursor: "default" }}><td>{i.nome}{i.alerta_dose && <div className="text-xs text-danger">{i.alerta_dose}</div>}</td><td className="num">{i.dose_ha} {i.unidade_dose}{i.aplicacoes > 1 ? ` × ${i.aplicacoes}` : ""}</td><td className="hide-sm text-sm">{i.fornecedor}</td><td className="num">{fmtBRL(i.valor_total)}</td></tr>))}</tbody></table>
                  </div>
                  <p className="text-sm">Compras {fmtBRL(plano.totais.compras)} · custo da safra {fmtBRL(plano.totais.custo_safra)} · {plano.totais.por_saca ? `${fmtBRL(plano.totais.por_saca)} por saca` : ""} · documentos: {plano.documentos.map((x) => x.tipo === "receita" ? "receita" : "análise de solo").join(", ") || "nenhum"}</p>
                  {p.plano_status === "enviado" && <span className="row" style={{ display: "flex", gap: 6 }}><Button size="sm" variant="success" onClick={() => aprovar(p.id)}>Aprovar e emitir pedidos</Button><Button size="sm" variant="ghost" onClick={() => devolver(p.id)}>Devolver para ajuste</Button></span>}
                </div>) : <Loading />)}
            </div>
          );
        })}
      </section>
      <section className="card">
        <h2 className="card-title">Pedidos aos fornecedores {aPagar.length > 0 && <Badge tone="warning">{aPagar.length} a pagar</Badge>}</h2>
        {!d.pedidos.length ? <p className="text-sm text-2">Nenhum pedido ainda.</p> : (
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table"><thead><tr><th>Pedido</th><th>Fornecedor</th><th className="hide-sm">Fazenda · talhão</th><th className="num">Valor</th><th>Situação</th><th></th></tr></thead>
              <tbody>{d.pedidos.map((o) => (
                <tr key={o.id} style={{ cursor: "default" }}><td>#{o.id}</td><td className="text-sm">{o.fornecedor}</td><td className="hide-sm text-sm">{o.fazenda} · {o.talhao}</td>
                  <td className="num">{fmtBRL(o.valor_total)}{o.comissao_fundo ? <div className="text-xs text-3">comissão {fmtBRL(o.comissao_fundo)}</div> : null}</td>
                  <td className="text-sm">{ST_PED[o.status]}</td><td>{o.status === "recebido" && <Button size="sm" variant="success" onClick={() => pagar(o)}>Pagar</Button>}</td></tr>))}</tbody></table>
          </div>
        )}
      </section>
    </>
  );
}
