import { useEffect, useState } from "react";
import { culturaIcone } from "../config/culturas";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { FilterChips, ErrorBanner, EmptyState, Button } from "../components/ui";
import { PlotCard } from "../components/domain";

export default function Marketplace() {
  const [plots, setPlots] = useState([]);
  const [grao, setGrao] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  // carrega tudo uma vez e filtra aqui: os filtros mostram só culturas que
  // têm talhão aberto (sem botão que leva a lista vazia)
  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError("");
    api.listPlots(null)
      .then((data) => { if (ativo) setPlots(data.plots); })
      .catch((err) => { if (ativo) setError(err.message); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [reload]);

  const culturas = [...new Set(plots.map((p) => p.grao))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const options = [
    { id: "Todos", label: "Todos", count: plots.length },
    ...culturas.map((g) => ({ id: g, label: g, icon: culturaIcone(g), count: plots.filter((p) => p.grao === g).length })),
  ];
  const visiveis = grao === "Todos" ? plots : plots.filter((p) => p.grao === grao);

  return (
    <Page title="Talhões">
      <PageHeader
        title="Invista direto no talhão"
        subtitle="Escolha uma produção de fazenda verificada e garantida por armazém credenciado, compre sua parte na fase que preferir e acompanhe até o fim do ciclo."
      />

      <div style={{ marginBottom: 20 }}>
        <FilterChips label="Filtrar por cultura" options={options} value={grao} onChange={setGrao} />
      </div>

      {error && (
        <ErrorBanner message={<>{error} <button className="link-btn" onClick={() => setReload((n) => n + 1)}>Tentar de novo</button></>} />
      )}

      {loading ? (
        <div className="grid-cards" aria-busy="true" aria-label="Carregando talhões">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 290 }} />)}
        </div>
      ) : visiveis.length === 0 && !error ? (
        <EmptyState image="/icons/icon_talhao_meu_talhao.svg" title={grao === "Todos" ? "Nenhum talhão aberto agora" : `Nenhum talhão de ${grao} aberto`}>
          {grao === "Todos" ? "Novas lavouras entram assim que as fazendas publicam. Volte em breve." : "Veja as outras culturas disponíveis."}
          {grao !== "Todos" && <><br /><br /><Button variant="secondary" onClick={() => setGrao("Todos")}>Ver todos os grãos</Button></>}
        </EmptyState>
      ) : (
        <div className="grid-cards">
          {visiveis.map((p) => <PlotCard key={p.id} plot={p} />)}
        </div>
      )}
    </Page>
  );
}
