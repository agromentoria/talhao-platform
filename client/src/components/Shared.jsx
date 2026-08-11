import { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, TrendingUp, Share2 } from "lucide-react";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS, FASES, FASE_ICONS, fmtBRL } from "../theme";

export function ProgressBar({ value, color = COLORS.leaf, height = 6 }) {
  return (
    <div style={{ width: "100%", height, borderRadius: height, background: COLORS.line, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: height, transition: "width 0.3s ease" }} />
    </div>
  );
}

// mantido por compatibilidade: retorna o caminho da ilustração do grão
export function grainIconSrc(grao) {
  return GRAIN_ICONS[grao] || GRAIN_ICONS.Soja;
}

export function PlotCard({ plot }) {
  const color = GRAIN_COLORS[plot.grao] || COLORS.leaf;
  const pctVendido = Math.round(((plot.cotas_totais - plot.cotas_disponiveis) / plot.cotas_totais) * 100);

  return (
    <Link to={`/talhao/${plot.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.line}`, overflow: "hidden",
        display: "flex", flexDirection: "column", height: "100%", transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(58,46,34,0.10)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <div style={{
          position: "relative", padding: "14px 18px", background: `linear-gradient(135deg, ${color}22, ${color}0A)`,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(58,46,34,0.08)", flexShrink: 0 }}>
            <img src={GRAIN_ICONS[plot.grao]} alt={plot.grao} style={{ width: 38, height: 38, objectFit: "contain" }} />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: COLORS.soil }}>{plot.grao}</span>
            <p style={{ fontSize: 11, color: COLORS.soilLight, margin: "2px 0 0" }}>Safra {plot.safra}</p>
          </div>
          <div title={FASES[plot.fase_atual]} style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(58,46,34,0.08)" }}>
            <img src={FASE_ICONS[plot.fase_atual]} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
          </div>
          <ShareButton
            compact
            title={`${plot.nome} · ${plot.grao} — Meu Talhão`}
            text={`Dá uma olhada nesse talhão de ${plot.grao} na Meu Talhão — dá pra investir direto na safra!`}
            url={`${window.location.origin}/talhao/${plot.id}`}
          />
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          <div>
            <p style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{plot.nome}</p>
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
              <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.soil, margin: 0, fontFamily: "'Baloo 2', cursive" }}>{fmtBRL(plot.cota_valor)}</p>
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

export function ShareButton({ title, text, url, style, compact }) {
  const [copied, setCopied] = useState(false);

  async function handleShare(e) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = url || window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // pessoa cancelou o compartilhamento — não faz nada
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível; sem fallback adicional
    }
  }

  if (compact) {
    return (
      <button onClick={handleShare} title="Compartilhar com amigos" style={{
        width: 32, height: 32, borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(58,46,34,0.12)", ...style,
      }}>
        <Share2 size={15} color={COLORS.soilLight} />
      </button>
    );
  }

  return (
    <button onClick={handleShare} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
      padding: "11px 0", borderRadius: 12, border: `1px solid ${COLORS.line}`, background: "#fff",
      color: COLORS.soil, fontSize: 13.5, fontWeight: 600, cursor: "pointer", ...style,
    }}>
      <Share2 size={15} />
      {copied ? "Link copiado!" : "Compartilhar com amigos"}
    </button>
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
