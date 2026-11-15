import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmtNumber } from "../lib/format";
import { Page, PageHeader } from "../components/layout/Page";
import { Banner, ErrorBanner, Loading, EmptyState, TextField, Button, useToast } from "../components/ui";

// Trading: produção em andamento por cultura e estado (prévia da mesa de vendas)
export default function TradingDashboard() {
  const toast = useToast();
  const [t, setT] = useState(null);
  const [producao, setProducao] = useState(null);
  const [erro, setErro] = useState("");
  const [pracas, setPracas] = useState("");
  useEffect(() => {
    api.minhaTrading().then((d) => { setT(d.trading); setPracas((d.trading.pracas || []).join(", ")); }).catch((e) => setErro(e.message));
    api.producaoTrading().then((d) => setProducao(d.producao)).catch((e) => setProducao({ erro: e.message }));
  }, []);
  if (!t) return <Page title="Produção" width="medium">{erro ? <ErrorBanner message={erro} /> : <Loading label="Carregando…" />}</Page>;
  async function salvar() {
    try { const d = await api.salvarTrading({ pracas }); setT(d.trading); toast("Praças de compra salvas"); } catch (e) { setErro(e.message); }
  }
  const lista = Array.isArray(producao) ? producao : [];
  return (
    <Page title="Produção" width="medium">
      <PageHeader title={t.razao_social} subtitle={`Trading · ${t.cidade || ""}${t.uf ? `, ${t.uf}` : ""}`} />
      <ErrorBanner message={erro} />
      {t.status !== "aprovado" && <Banner tone="warning" title="Cadastro em análise">A produção em andamento aparece depois que a administração conferir o CNPJ.</Banner>}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Onde você compra</h2>
        <div className="row" style={{ gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <TextField label="Estados (siglas)" value={pracas} onChange={(v) => setPracas(v.toUpperCase())} style={{ flex: 1, minWidth: 200 }} />
          <Button variant="secondary" onClick={salvar}>Salvar</Button>
        </div>
        <p className="text-xs text-3" style={{ marginTop: 8 }}>Em breve: ofertas de compra direto pelo app, com o grão garantido por armazém credenciado. Comissão do app de {t.comissao_pct}% sobre o valor comprado.</p>
      </section>
      <section className="card">
        <h2 className="card-title">Produção em andamento</h2>
        {producao?.erro ? <p className="text-sm text-2">{producao.erro}</p> : producao === null ? <Loading /> : !lista.length ? (
          <EmptyState title="Nenhum talhão em andamento agora">Quando as fazendas publicarem talhões, a produção prevista aparece aqui por cultura e estado.</EmptyState>
        ) : (
          <div className="fin-table-wrap" style={{ display: "block" }}>
            <table className="fin-table">
              <thead><tr><th>Cultura</th><th>Estado</th><th className="num">Talhões</th><th className="num hide-sm">Área (ha)</th><th className="num">Sacas previstas</th><th className="hide-sm">Colheita</th></tr></thead>
              <tbody>{lista.map((p) => (
                <tr key={`${p.cultura}-${p.uf}`} style={{ cursor: "default" }}>
                  <td>{p.cultura}</td><td>{p.uf || "—"}</td><td className="num">{p.talhoes}</td><td className="num hide-sm">{fmtNumber(p.area_ha)}</td>
                  <td className="num"><strong>{fmtNumber(p.sacas_previstas)}</strong></td>
                  <td className="hide-sm text-sm">{new Date(p.primeira_colheita).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}{p.ultima_colheita !== p.primeira_colheita ? ` a ${new Date(p.ultima_colheita).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : ""}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </section>
    </Page>
  );
}
