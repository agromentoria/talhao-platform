import { useEffect, useState } from "react";
import { GRAINS, GRAIN_ICONS } from "../config/theme";
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

  useEffect(() => {
    let ativo = true; // ignora respostas antigas se o filtro mudar rápido
    setLoading(true);
    setError("");
    api.listPlots(grao === "Todos" ? null : grao)
      .then((data) => { if (ativo) setPlots(data.plots); })
      .catch((err) => { if (ativo) setError(err.message); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [grao, reload]);

  const options = [{ id: "Todos", label: "Todos" }, ...GRAINS.map((g) => ({ id: g, label: g, icon: GRAIN_ICONS[g] }))];

  return (
    <Page title="Talhões">
      <PageHeader
        title="Invista direto no talhão"
        subtitle="Escolha uma lavoura de fazenda verificada, compre sua parte na fase que preferir e acompanhe a safra até a colheita."
      />

      <div style={{ marginBottom: 20 }}>
        <FilterChips label="Filtrar por grão" options={options} value={grao} onChange={setGrao} />
      </div>

      {error && (
        <ErrorBanner message={<>{error} <button className="link-btn" onClick={() => setReload((n) => n + 1)}>Tentar de novo</button></>} />
      )}

      {loading ? (
        <div className="grid-cards" aria-busy="true" aria-label="Carregando talhões">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" style={{ height: 290 }} />)}
        </div>
      ) : plots.length === 0 && !error ? (
        <EmptyState image="/icons/icon_talhao_meu_talhao.svg" title={grao === "Todos" ? "Nenhum talhão aberto agora" : `Nenhum talhão de ${grao} aberto`}>
          {grao === "Todos" ? "Novas lavouras entram assim que as fazendas publicam. Volte em breve." : "Veja as outras culturas disponíveis."}
          {grao !== "Todos" && <><br /><br /><Button variant="secondary" onClick={() => setGrao("Todos")}>Ver todos os grãos</Button></>}
        </EmptyState>
      ) : (
        <div className="grid-cards">
          {plots.map((p) => <PlotCard key={p.id} plot={p} />)}
        </div>
      )}
    </Page>
  );
}
