import { Link } from "react-router-dom";
import { MapPin, TrendingUp, Star } from "lucide-react";
import { GRAIN_COLORS } from "../../config/theme";
import { culturaIcone, faseNome, faseIcone, unidadeNome, cicloLabels, fmtData } from "../../config/culturas";
import { fmtBRL } from "../../lib/format";
import { ProgressBar } from "../ui";
import { ShareButton } from "./ShareButton";
import { GuaranteeSeal } from "./Custody";

export function GrainThumb({ grao, size = "md", round }) {
  return (
    <span className={`thumb ${size === "lg" ? "thumb--lg" : ""} ${round ? "thumb--round" : ""}`}>
      <img src={culturaIcone(grao)} alt="" />
    </span>
  );
}

export function PlotCard({ plot }) {
  const color = GRAIN_COLORS[plot.grao] || "#668C2D";
  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  const pctVendido = plot.cotas_totais ? Math.round((vendidas / plot.cotas_totais) * 100) : 0;
  const unidade = unidadeNome(plot.unidade, 1);
  const unidades = unidadeNome(plot.unidade, 2);
  const icone = faseIcone(plot, plot.fase_atual);

  return (
    <article style={{ position: "relative", height: "100%" }}>
      <Link to={`/talhao/${plot.id}`} className="plot-card" style={{ "--grain": color }}>
        <div className="plot-card-head">
          <GrainThumb grao={plot.grao} size="lg" />
          <div className="plot-card-grain">
            <strong className="truncate" style={{ display: "block" }}>{plot.grao}</strong>
            <span className="truncate" style={{ display: "block" }}>{plot.variedade ? `${plot.variedade} · ` : ""}{plot.safra}</span>
          </div>
          {icone && (
            <span className="thumb thumb--round" title={faseNome(plot, plot.fase_atual)} style={{ width: 36, height: 36, background: "#fff" }}>
              <img src={icone} alt="" style={{ width: 24, height: 24 }} />
            </span>
          )}
          {/* espaço reservado para o botão de compartilhar (fica fora do link) */}
          <span style={{ width: 44 }} aria-hidden />
        </div>

        <div className="plot-card-body">
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3 className="plot-card-name">{plot.nome}</h3>
              {plot.farm_estrelas > 0 && (
                <span className="rating" aria-label={`Nota da fazenda: ${Number(plot.farm_estrelas).toFixed(1)} de 5`}>
                  <Star size={14} fill="var(--brand-orange)" color="var(--brand-orange)" aria-hidden />
                  {Number(plot.farm_estrelas).toFixed(1)}
                </span>
              )}
            </div>
            <p className="plot-card-farm"><MapPin size={13} aria-hidden /> <span className="truncate">{plot.farm_name}, {plot.farm_location}</span></p>
          </div>

          <div>
            <div className="plot-card-phase">
              <span>{faseNome(plot, plot.fase_atual)}</span>
              <span>{plot.progresso}%</span>
            </div>
            <ProgressBar value={plot.progresso} color={color} label="Andamento da safra" />
          </div>

          <div className="plot-card-foot">
            <div>
              <p className="label-xs">{unidade} a partir de</p>
              <p className="plot-card-price">{fmtBRL(plot.cota_valor)}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="label-xs">retorno estimado</p>
              <p className="plot-card-return"><TrendingUp size={15} aria-hidden /> {plot.previsao_retorno}%</p>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p className="label-xs">{pctVendido}% das {unidades} já captadas{plot.colheita_prevista ? ` · ${cicloLabels(plot).fim.toLowerCase()}: ${fmtData(plot.colheita_prevista, { month: "short", year: "numeric" })}` : ""}</p>
            {plot.custodia_status === "aceita" && plot.warehouse_name && <GuaranteeSeal name={plot.warehouse_name} estrelas={plot.warehouse_estrelas} compact />}
          </div>
        </div>
      </Link>
      {/* botão fora do <a> — elemento interativo dentro de link é inválido e confunde leitores de tela */}
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <ShareButton
          compact
          title={`${plot.nome} · ${plot.grao} — Meu Talhão`}
          text={`Dá uma olhada nesse talhão de ${plot.grao} na Meu Talhão — dá pra investir direto na safra!`}
          url={`${window.location.origin}/talhao/${plot.id}`}
        />
      </div>
    </article>
  );
}
