import { useEffect, useState } from "react";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS } from "../theme";
import { PlotCard } from "../components/Shared";
import { api } from "../api";

export default function Marketplace() {
  const [plots, setPlots] = useState([]);
  const [grao, setGrao] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .listPlots(grao === "Todos" ? null : grao)
      .then((data) => setPlots(data.plots))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [grao]);

  const grainList = ["Todos", ...Object.keys(GRAIN_COLORS)];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 28, fontWeight: 600, color: COLORS.soil, margin: 0 }}>
          Invista direto no talhão
        </h1>
        <p style={{ fontSize: 14, color: COLORS.soilLight, margin: "6px 0 0" }}>
          Compre cotas de fazendas cadastradas em qualquer fase do plantio e acompanhe a safra até a colheita.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        {grainList.map((g) => (
          <button key={g} onClick={() => setGrao(g)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px 6px 8px", borderRadius: 20, fontSize: 13, cursor: "pointer",
            border: `1px solid ${grao === g ? COLORS.leaf : COLORS.line}`,
            background: grao === g ? COLORS.leaf : "#fff",
            color: grao === g ? "#fff" : COLORS.soilLight, fontWeight: 500,
          }}>
            {GRAIN_ICONS[g] && (
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src={GRAIN_ICONS[g]} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} />
              </span>
            )}
            {g}
          </button>
        ))}
      </div>

      {error && <p style={{ color: COLORS.danger, fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ color: COLORS.soilLight, fontSize: 13 }}>Carregando talhões...</p>}
      {!loading && plots.length === 0 && <p style={{ color: COLORS.soilLight, fontSize: 13 }}>Nenhum talhão disponível no momento.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        {plots.map((p) => <PlotCard key={p.id} plot={p} />)}
      </div>
    </div>
  );
}
