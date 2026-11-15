import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { fmtBRL } from "../lib/format";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, Banner, ErrorBanner, Loading, EmptyState, Dialog, TextField, MoneyField, SelectField, Badge, useToast } from "../components/ui";

const NOME_CAT = { corretivo: "Corretivos", fertilizante: "Adubos e fertilizantes", nutritivo: "Nutritivos", defensivo: "Defensivos", semente: "Sementes e tratamento", combustivel: "Combustível", servico: "Serviços" };
const POR = { t: "t", kg: "kg", L: "L", ha: "ha", saca: "saca", un: "unidade" };

// Fornecedor: catálogo de ofertas (preço por unidade da dose, estados de entrega, prazo, validade)
export default function SupplierDashboard() {
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null); // null | {} (nova) | oferta
  const [regioes, setRegioes] = useState("");

  const carregar = useCallback(() => {
    Promise.all([api.minhasOfertas(), api.catalogo()]).then(([o, c]) => {
      setDados(o); setItens(c.itens); setRegioes((o.fornecedor.regioes || []).join(", "));
    }).catch((e) => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  const grupos = useMemo(() => {
    const g = {};
    for (const o of dados?.ofertas || []) (g[o.categoria] ||= []).push(o);
    return g;
  }, [dados]);

  if (!dados) return <Page title="Meu catálogo" width="medium">{erro ? <ErrorBanner message={erro} /> : <Loading label="Carregando catálogo…" />}</Page>;
  const f = dados.fornecedor;

  async function salvarRegioes() {
    try { await api.salvarFornecedor({ regioes }); toast("Estados de entrega salvos"); carregar(); } catch (e) { setErro(e.message); }
  }
  async function remover(o) {
    if (!window.confirm(`Remover a oferta de ${o.item}?`)) return;
    try { await api.removerOferta(o.id); toast("Oferta removida"); carregar(); } catch (e) { setErro(e.message); }
  }

  return (
    <Page title="Meu catálogo" width="medium">
      <PageHeader title={f.razao_social} subtitle={`Fornecedor · ${f.cidade || ""}${f.uf ? `, ${f.uf}` : ""}`}
        actions={<Button icon={Plus} onClick={() => setEditando({})}>Nova oferta</Button>} />
      <ErrorBanner message={erro} />
      {f.status !== "aprovado" && (
        <Banner tone="warning" title={f.status === "suspenso" ? "Cadastro suspenso" : "Cadastro em análise"}>
          {f.status === "suspenso" ? "Suas ofertas não aparecem para as fazendas. Fale com a administração." : "Você já pode montar o catálogo. As ofertas aparecem para as fazendas depois que a administração conferir o CNPJ."}
        </Banner>
      )}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Onde você entrega</h2>
        <p className="card-desc">Estados atendidos por padrão. Cada oferta pode ter os seus.</p>
        <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField label="Estados (siglas)" value={regioes} onChange={(v) => setRegioes(v.toUpperCase())} style={{ flex: 1, minWidth: 200 }} />
          <Button variant="secondary" onClick={salvarRegioes}>Salvar</Button>
        </div>
        <p className="text-xs text-3" style={{ marginTop: 8 }}>O fundo paga cada pedido depois que a fazenda confirma o recebimento, retendo a comissão de {f.comissao_pct}% sobre o valor.</p>
      </section>

      {!dados.ofertas.length ? (
        <EmptyState title="Nenhuma oferta ainda" action={<Button icon={Plus} onClick={() => setEditando({})}>Cadastrar a primeira oferta</Button>}>
          Escolha um item do catálogo (calcário, adubo, semente, diesel…) e informe preço, embalagem e prazo de entrega.
        </EmptyState>
      ) : Object.entries(grupos).map(([cat, lista]) => (
        <section key={cat} className="card" style={{ marginBottom: 12 }}>
          <h2 className="card-title">{NOME_CAT[cat] || cat}</h2>
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table">
              <thead><tr><th>Item</th><th>Marca · embalagem</th><th className="num">Preço</th><th className="hide-sm">Estados</th><th className="num hide-sm">Prazo</th><th className="hide-sm">Validade</th><th></th></tr></thead>
              <tbody>{lista.map((o) => (
                <tr key={o.id} style={{ cursor: "default" }}>
                  <td>{o.item}{o.exige_receita && <Badge tone="warning">receita</Badge>}</td>
                  <td className="text-sm">{[o.marca, o.embalagem].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="num"><strong>{fmtBRL(o.preco)}</strong><span className="text-xs text-3"> /{POR[o.unidade_dose] || o.unidade_dose}</span></td>
                  <td className="hide-sm text-sm">{(o.regioes || []).join(", ")}</td>
                  <td className="num hide-sm">{o.prazo_dias} d</td>
                  <td className="hide-sm text-sm">{o.validade_ate ? new Date(o.validade_ate).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <Button size="sm" variant="ghost" icon={Pencil} aria-label="Editar" onClick={() => setEditando(o)} />
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remover" onClick={() => remover(o)} />
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
      ))}

      <Dialog open={!!editando} onClose={() => setEditando(null)} title={editando?.id ? "Editar oferta" : "Nova oferta"} width={560}>
        {editando && <FormOferta oferta={editando} itens={itens} regioesPadrao={f.regioes || []} onSalvo={() => { setEditando(null); toast("Oferta salva"); carregar(); }} />}
      </Dialog>
    </Page>
  );
}

function FormOferta({ oferta, itens, regioesPadrao, onSalvo }) {
  const [form, setForm] = useState({
    catalog_item_id: oferta.catalog_item_id || "", marca: oferta.marca || "", embalagem: oferta.embalagem || "", preco: oferta.preco ? String(oferta.preco) : "",
    regioes: (oferta.regioes || regioesPadrao).join(", "), prazo_dias: oferta.prazo_dias ?? 7, validade_ate: oferta.validade_ate ? String(oferta.validade_ate).slice(0, 10) : "", estoque: oferta.estoque ?? "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const item = itens.find((i) => String(i.id) === String(form.catalog_item_id));
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  async function salvar(e) {
    e.preventDefault(); setErro(""); setSalvando(true);
    try {
      const corpo = { ...form, regioes: form.regioes.split(/[,\s]+/).filter(Boolean) };
      if (oferta.id) await api.editarOferta(oferta.id, corpo); else await api.criarOferta(corpo);
      onSalvo();
    } catch (err) { setErro(err.message); } finally { setSalvando(false); }
  }
  return (
    <form onSubmit={salvar} className="form-grid">
      <SelectField label="Item do catálogo" value={form.catalog_item_id} onChange={set("catalog_item_id")} required disabled={!!oferta.id}
        options={[{ value: "", label: "Escolha o item" }, ...itens.map((i) => ({ value: i.id, label: `${NOME_CAT[i.categoria]} · ${i.nome}` }))]} />
      {item && <p className="text-xs text-3 span-all" style={{ marginTop: -6 }}>{item.detalhe} · as fazendas lançam a dose em {POR[item.unidade_dose]}/ha{item.exige_receita ? " · exige receita agronômica para entregar" : ""}.</p>}
      <TextField label="Marca" value={form.marca} onChange={set("marca")} />
      <TextField label="Embalagem" value={form.embalagem} onChange={set("embalagem")} placeholder={item?.unidade_compra || "big bag 1 t, galão 20 L…"} />
      <MoneyField label={`Preço por ${item ? POR[item.unidade_dose] : "unidade"}`} value={form.preco} onChange={set("preco")} required
        hint={item ? `Preço por ${POR[item.unidade_dose]} entregue na fazenda. O app multiplica pela dose e pela área do talhão.` : undefined} />
      <TextField label="Estados de entrega (siglas)" value={form.regioes} onChange={(v) => set("regioes")(v.toUpperCase())} />
      <TextField label="Prazo de entrega (dias)" type="number" value={form.prazo_dias} onChange={set("prazo_dias")} />
      <TextField label="Válida até" type="date" value={form.validade_ate} onChange={set("validade_ate")} />
      <TextField label={`Estoque disponível (${item ? POR[item.unidade_dose] : "unidades"})`} type="number" value={form.estoque} onChange={set("estoque")} hint="Opcional" />
      {erro && <div className="span-all"><ErrorBanner message={erro} /></div>}
      <div className="span-all"><Button type="submit" loading={salvando}>Salvar oferta</Button></div>
    </form>
  );
}
