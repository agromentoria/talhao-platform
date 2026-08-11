import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, QrCode, CreditCard, Plus } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS, FASES, FASE_ICONS, fmtBRL } from "../theme";
import { ErrorBanner, ShareButton } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function PlotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plot, setPlot] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [appCommission, setAppCommission] = useState(5);
  const [cotas, setCotas] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [buying, setBuying] = useState(false);

  const [cards, setCards] = useState([]);
  const [paymentType, setPaymentType] = useState("pix");
  const [selectedCardId, setSelectedCardId] = useState(null);

  function load() {
    api.getPlot(id).then((data) => {
      setPlot(data.plot);
      setHistorico(data.historico.map((h) => ({ dia: FASES[h.fase_atual], v: h.progresso })));
      setAppCommission(data.app_commission_pct);
    }).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (user?.role === "investidor") {
      api.paymentMethods().then((data) => {
        setCards(data.methods);
        const defaultCard = data.methods.find((m) => m.is_default);
        if (defaultCard) {
          setPaymentType(defaultCard.type === "credito" ? "cartao_credito" : "cartao_debito");
          setSelectedCardId(defaultCard.id);
        }
      }).catch(() => {});
    }
  }, [user]);

  if (error && !plot) return <div style={{ padding: 32 }}><ErrorBanner message={error} /></div>;
  if (!plot) return <div style={{ padding: 32, color: COLORS.soilLight, fontSize: 13 }}>Carregando...</div>;

  const grainColor = GRAIN_COLORS[plot.grao] || COLORS.leaf;
  const custoTotal = cotas * plot.cota_valor;
  const retornoBruto = custoTotal * (1 + plot.previsao_retorno / 100);
  const lucroBruto = retornoBruto - custoTotal;
  const comissaoFazenda = lucroBruto * (plot.commission_pct / 100);
  const comissaoApp = lucroBruto * (appCommission / 100);
  const lucroLiquido = lucroBruto - comissaoFazenda - comissaoApp;
  const chartData = historico.length ? historico : FASES.map((f) => ({ dia: f, v: 0 }));

  async function handleBuy() {
    setError(""); setSuccess("");
    if (!user) { navigate("/login"); return; }
    if (user.role !== "investidor") {
      setError("Apenas contas de investidor podem comprar cotas.");
      return;
    }
    if (paymentType !== "pix" && !selectedCardId) {
      setError("Selecione um cartão ou adicione um novo para continuar.");
      return;
    }
    setBuying(true);
    try {
      await api.invest(plot.id, cotas, paymentType, paymentType === "pix" ? null : selectedCardId);
      setSuccess(`Compra confirmada: ${cotas} cota(s) por ${fmtBRL(custoTotal)}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuying(false);
    }
  }

  return (
    <div className="plot-detail-container" style={{ padding: "24px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.soilLight, fontSize: 13, textDecoration: "none", marginBottom: 18, width: "fit-content" }}>
        <ArrowLeft size={15} /> Voltar aos talhões
      </Link>

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 6px rgba(58,46,34,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={GRAIN_ICONS[plot.grao]} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: grainColor }}>{plot.grao}</span>
        </div>
        <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: 0 }}>{plot.nome} · {plot.farm_name}</h1>
        <p style={{ fontSize: 13, color: COLORS.soilLight, margin: "4px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={13} /> {plot.farm_location} · {plot.area_ha} ha · safra {plot.safra}
        </p>
      </div>

      <div className="plot-detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          <div className="fase-stepper" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 16px" }}>Etapas da safra</p>
            <div className="fase-stepper-track" style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", gap: 0 }}>
              {FASES.map((f, i) => {
                const done = i < plot.fase_atual;
                const current = i === plot.fase_atual;
                return (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", flex: i < FASES.length - 1 ? 1 : "none", minWidth: 0 }}>
                    <div className="fase-step" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 76 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: current ? "#fff" : done ? `${COLORS.leaf}22` : COLORS.bg,
                        border: current ? `2px solid ${COLORS.wheat}` : done ? `2px solid ${COLORS.leaf}` : `2px solid ${COLORS.line}`,
                        opacity: done || current ? 1 : 0.5,
                      }}>
                        <img src={FASE_ICONS[i]} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
                      </div>
                      <span style={{ fontSize: 10.5, color: done || current ? COLORS.soil : COLORS.soilLight, textAlign: "center", lineHeight: 1.3, fontWeight: current ? 600 : 400 }}>{f}</span>
                    </div>
                    {i < FASES.length - 1 && <div style={{ flex: 1, height: 2, background: i < plot.fase_atual ? COLORS.leaf : COLORS.line, marginTop: 22 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 6px" }}>Progresso da safra</p>
            <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "0 0 10px" }}>Atualizado pela fazenda conforme o andamento em campo.</p>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={grainColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={grainColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: COLORS.soilLight }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.soilLight }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${COLORS.line}` }} formatter={(v) => [`${v}%`, "progresso"]} />
                  <Area type="monotone" dataKey="v" stroke={grainColor} strokeWidth={2} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 12px" }}>Como a comissão funciona</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: COLORS.soilLight }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Comissão da fazenda ({plot.farm_name})</span><span style={{ color: COLORS.soil, fontWeight: 500 }}>{plot.commission_pct}%</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Comissão do Talhão (plataforma)</span><span style={{ color: COLORS.soil, fontWeight: 500 }}>{appCommission}%</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLORS.line}`, paddingTop: 8 }}><span>Sua parte do lucro na venda do grão</span><span style={{ color: COLORS.leaf, fontWeight: 600 }}>{100 - plot.commission_pct - appCommission}%</span></div>
            </div>
          </div>
        </div>

        <div>
          <div className="invest-panel" style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, position: "sticky", top: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 4px" }}>Investir neste talhão</p>
            <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "0 0 14px" }}>{plot.cotas_disponiveis} de {plot.cotas_totais} cotas disponíveis nesta fase</p>

            <ErrorBanner message={error} />
            {success && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 10 }}>{success}</p>}

            <label style={{ fontSize: 12, color: COLORS.soilLight }}>Quantidade de cotas</label>
            <input type="number" min={1} max={plot.cotas_disponiveis} value={cotas}
              onChange={(e) => setCotas(Math.max(1, Math.min(plot.cotas_disponiveis, Number(e.target.value) || 1)))}
              style={{ width: "100%", marginTop: 6, marginBottom: 14, padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.soilLight }}>Valor investido</span><span style={{ fontWeight: 600, color: COLORS.soil }}>{fmtBRL(custoTotal)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.soilLight }}>Retorno bruto estimado</span><span style={{ fontWeight: 600, color: COLORS.soil }}>{fmtBRL(retornoBruto)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: COLORS.soilLight }}>Lucro líquido estimado</span><span style={{ fontWeight: 600, color: COLORS.leaf }}>{fmtBRL(lucroLiquido)}</span></div>
            </div>

            {(!user || user.role === "investidor") && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, color: COLORS.soilLight, display: "block", marginBottom: 6 }}>Forma de pagamento</label>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <button type="button" onClick={() => setPaymentType("pix")} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0",
                    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
                    border: `1px solid ${paymentType === "pix" ? COLORS.leaf : COLORS.line}`,
                    background: paymentType === "pix" ? COLORS.leaf : "#fff",
                    color: paymentType === "pix" ? "#fff" : COLORS.soilLight,
                  }}><QrCode size={13} /> Pix</button>
                  <button type="button" onClick={() => { setPaymentType(cards[0] ? (cards[0].type === "credito" ? "cartao_credito" : "cartao_debito") : "cartao_credito"); setSelectedCardId(cards[0]?.id || null); }} style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 0",
                    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
                    border: `1px solid ${paymentType !== "pix" ? COLORS.leaf : COLORS.line}`,
                    background: paymentType !== "pix" ? COLORS.leaf : "#fff",
                    color: paymentType !== "pix" ? "#fff" : COLORS.soilLight,
                  }}><CreditCard size={13} /> Cartão</button>
                </div>

                {paymentType === "pix" && (
                  <p style={{ fontSize: 11, color: COLORS.soilLight, margin: 0, lineHeight: 1.4 }}>
                    Pagamento via Pix processado na confirmação da compra.
                  </p>
                )}

                {paymentType !== "pix" && (
                  cards.length > 0 ? (
                    <select value={selectedCardId || ""} onChange={(e) => setSelectedCardId(Number(e.target.value))} style={{
                      width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13, fontFamily: "inherit",
                    }}>
                      {cards.map((c) => (
                        <option key={c.id} value={c.id}>{c.brand} •••• {c.last4} ({c.type === "credito" ? "crédito" : "débito"})</option>
                      ))}
                    </select>
                  ) : (
                    <Link to="/pagamentos" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.orange, fontWeight: 600, textDecoration: "none" }}>
                      <Plus size={13} /> Adicionar um cartão para pagar
                    </Link>
                  )
                )}
              </div>
            )}

            <button onClick={handleBuy} disabled={buying || plot.cotas_disponiveis === 0} style={{
              width: "100%", padding: "11px 0", borderRadius: 9, border: "none",
              background: plot.cotas_disponiveis === 0 ? COLORS.line : COLORS.orange,
              color: plot.cotas_disponiveis === 0 ? COLORS.soilLight : "#fff", fontSize: 14, fontWeight: 500,
              cursor: plot.cotas_disponiveis === 0 ? "not-allowed" : "pointer",
            }}>
              {plot.cotas_disponiveis === 0 ? "Cotas esgotadas" : buying ? "Processando..." : `Comprar ${cotas} cota${cotas > 1 ? "s" : ""} — ${fmtBRL(custoTotal)}`}
            </button>
            <p style={{ fontSize: 10.5, color: COLORS.soilLight, marginTop: 10, lineHeight: 1.5 }}>
              Valores e retornos são estimativas e variam conforme a fase da safra e o preço do grão na colheita.
            </p>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
              <ShareButton
                title={`${plot.nome} · ${plot.grao} — Meu Talhão`}
                text={`Dá uma olhada nesse talhão de ${plot.grao} na Meu Talhão — dá pra investir direto na safra e acompanhar até a colheita!`}
              />
              <p style={{ fontSize: 10.5, color: COLORS.soilLight, marginTop: 8, textAlign: "center" }}>
                Indique para amigos investirem com você
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
