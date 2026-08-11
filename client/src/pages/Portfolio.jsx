import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins, TrendingUp, Warehouse, ChevronRight } from "lucide-react";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS, FASES, unitPlural, fmtBRL } from "../theme";
import { ProgressBar, ErrorBanner } from "../components/Shared";
import { api } from "../api";

export default function Portfolio() {
  const [investments, setInvestments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myInvestments()
      .then((data) => setInvestments(data.investments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalInvestido = investments.reduce((s, i) => s + i.valor_investido, 0);
  const totalRecebido = investments.filter(i => i.status === "pago").reduce((s, i) => s + (i.valor_liquido || 0), 0);
  const ativos = investments.filter((i) => i.status === "ativo").length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: "0 0 4px" }}>Meus investimentos</h1>
      <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "0 0 20px" }}>Acompanhe cada talhão até a colheita e o pagamento da sua parte.</p>

      <ErrorBanner message={error} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total investido", value: fmtBRL(totalInvestido), icon: Coins },
          { label: "Recebido em colheitas pagas", value: fmtBRL(totalRecebido), icon: TrendingUp },
          { label: "Talhões ativos", value: ativos, icon: Warehouse },
        ].map((c) => (
          <div key={c.label} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.soilLight, marginBottom: 8 }}>
              <c.icon size={15} /><span style={{ fontSize: 12 }}>{c.label}</span>
            </div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Carregando...</p>}
      {!loading && investments.length === 0 && (
        <p style={{ fontSize: 13, color: COLORS.soilLight }}>
          Você ainda não investiu em nenhum talhão. <Link to="/" style={{ color: COLORS.leaf }}>Ver talhões disponíveis</Link>
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {investments.map((inv) => {
          const color = GRAIN_COLORS[inv.grao] || COLORS.leaf;
          return (
            <Link key={inv.id} to={`/talhao/${inv.plot_id}`} style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: "#fff", boxShadow: "0 2px 6px rgba(58,46,34,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={GRAIN_ICONS[inv.grao]} alt={inv.grao} style={{ width: 28, height: 28, objectFit: "contain" }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: 14, color: COLORS.soil, margin: 0 }}>{inv.plot_nome} · {inv.farm_name}</p>
                    <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>
                      {inv.cotas} {unitPlural(inv.unidade, inv.cotas)} · {fmtBRL(inv.valor_investido)} investidos · {FASES[inv.fase_atual]}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  {inv.status === "pago" ? (
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.leaf }}>Pago: {fmtBRL(inv.valor_liquido)}</span>
                  ) : (
                    <div style={{ width: 100 }}><ProgressBar value={inv.progresso} color={color} /></div>
                  )}
                  <ChevronRight size={16} color={COLORS.soilLight} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
