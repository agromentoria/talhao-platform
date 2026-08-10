import { Link } from "react-router-dom";
import { MapPin, TrendingUp, Sprout, Wheat, TreeDeciduous } from "lucide-react";
import { COLORS, GRAIN_COLORS, FASES, fmtBRL } from "../theme";

export function ProgressBar({ value, color = COLORS.leaf, height = 6 }) {
  return (
    <div style={{ width: "100%", height, borderRadius: height, background: COLORS.line, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: height }} />
    </div>
  );
}

export function grainIcon(grao) {
  if (grao === "Milho" || grao === "Trigo") return Wheat;
  if (grao === "Algodão") return TreeDeciduous;
  return Sprout;
}

export function PlotCard({ plot }) {
  const color = GRAIN_COLORS[plot.grao] || COLORS.leaf;
  const Icon = grainIcon(plot.grao);
  const pctVendido = Math.round(((plot.cotas_totais - plot.cotas_disponiveis) / plot.cotas_totais) * 100);

  return (
    <Link to={`/talhao/${plot.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: COLORS.bgCard, borderRadius: 14, border: `1px solid ${COLORS.line}`, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "16px 18px", background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={18} color={color} />
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{plot.grao}</span>
          </div>
          <span style={{ fontSize: 11.5, color: COLORS.soilLight }}>Safra {plot.safra}</span>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          <div>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{plot.nome}</p>
            <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "3px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} /> {plot.farm_name} · {plot.farm_location}
            </p>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.soilLight, marginBottom: 4 }}>
              <span>{FASES[plot.fase_atual]}</span>
              <span>{plot.progresso}% da safra</span>
            </div>
            <ProgressBar value={plot.progresso} color={color} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto", paddingTop: 6 }}>
            <div>
              <p style={{ fontSize: 11, color: COLORS.soilLight, margin: 0 }}>cota a partir de</p>
              <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.soil, margin: 0, fontFamily: "'Fraunces', serif" }}>{fmtBRL(plot.cota_valor)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: COLORS.soilLight, margin: 0 }}>retorno estimado</p>
              <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.leaf, margin: 0, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                <TrendingUp size={13} /> {plot.previsao_retorno}%
              </p>
            </div>
          </div>
          <div style={{ fontSize: 11, color: COLORS.soilLight }}>{pctVendido}% das cotas já captadas</div>
        </div>
      </div>
    </Link>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{ background: "#FBEAEA", border: "1px solid #E9B9B9", color: COLORS.danger, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
      {message}
    </div>
  );
}
