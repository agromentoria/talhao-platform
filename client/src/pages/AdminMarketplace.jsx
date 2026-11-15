import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, Badge, ErrorBanner, Loading, Segmented, useToast } from "../components/ui";

const NOME_CAT = { corretivo: "Corretivos", fertilizante: "Adubos e fertilizantes", nutritivo: "Nutritivos", defensivo: "Defensivos", semente: "Sementes e tratamento", combustivel: "Combustível", servico: "Serviços" };
const TOM = { aprovado: "success", pendente: "warning", suspenso: "danger" };

// Administração do marketplace: aprovar fornecedores e tradings; catálogo e doses de referência
export default function AdminMarketplace({ isAdmin }) {
  const [aba, setAba] = useState("cadastros");
  return (
    <div className="stack">
      <Segmented label="Marketplace" value={aba} onChange={setAba} options={[{ id: "cadastros", label: "Fornecedores e tradings" }, { id: "catalogo", label: "Catálogo e doses" }]} />
      {aba === "cadastros" ? <Cadastros /> : <Catalogo podeEditar={isAdmin} />}
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
