import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MapPin, QrCode, CreditCard, Plus, Minus, Star, Award } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GRAIN_COLORS, FASES, FASE_ICONS, UNIT_LABEL } from "../config/theme";
import { fmtBRL, fmtNumber, unitPlural } from "../lib/format";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, IconButton, ErrorBanner, Loading, Segmented, SelectField, Banner, useDialog, useToast, EmptyState } from "../components/ui";
import { ShareButton, PhotoGallery, GrainThumb } from "../components/domain";

export default function PlotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const toast = useToast();

  const [plot, setPlot] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [appCommission, setAppCommission] = useState(5);
  const [loadError, setLoadError] = useState("");
  const [cotas, setCotas] = useState(1);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);

  const [cards, setCards] = useState([]);
  const [paymentType, setPaymentType] = useState("pix");
  const [selectedCardId, setSelectedCardId] = useState(null);

  const load = useCallback(() => {
    return api.getPlot(id).then((data) => {
      setPlot(data.plot);
      // a API devolve as fotos fora do objeto do talhão (antes elas nunca apareciam)
      setFotos(data.fotos || []);
      setHistorico(data.historico.map((h) => ({ fase: FASES[h.fase_atual], v: h.progresso })));
      setAppCommission(data.app_commission_pct);
    }).catch((err) => setLoadError(err.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user?.role !== "investidor") return;
    api.paymentMethods().then((data) => {
      setCards(data.methods);
      const def = data.methods.find((m) => m.is_default);
      if (def) setSelectedCardId(def.id);
    }).catch(() => {});
  }, [user]);

  if (loadError && !plot) {
    return (
      <Page title="Talhão" back="/">
        <EmptyState image="/icons/icon_talhao_meu_talhao.svg" title="Talhão não encontrado" action={<Button to="/">Ver talhões abertos</Button>}>{loadError}</EmptyState>
      </Page>
    );
  }
  if (!plot) return <Page title="Talhão" back="/"><Loading /></Page>;

  const grainColor = GRAIN_COLORS[plot.grao] || GRAIN_COLORS.Soja;
  const unidade = UNIT_LABEL[plot.unidade] || "cota";
  const maxCotas = Math.max(1, plot.cotas_disponiveis);
  const qtd = Math.min(Math.max(1, cotas), maxCotas);
  const custoTotal = qtd * plot.cota_valor;
  // mesmo cálculo do pagamento real no servidor (harvestPayout.js):
  // preço de venda projetado = preço de referência × (1 + retorno estimado)
  const precoVendaProjetado = plot.preco_venda_estimado * (1 + plot.previsao_retorno / 100);
  const margemPorUnidade = precoVendaProjetado - plot.cota_valor;
  const retornoBruto = qtd * precoVendaProjetado;
  const lucroBruto = retornoBruto - custoTotal;
  const comissaoFazenda = Math.max(0, lucroBruto) * (plot.commission_pct / 100);
  const comissaoApp = Math.max(0, lucroBruto) * (appCommission / 100);
  const recebimentoLiquido = retornoBruto - comissaoFazenda - comissaoApp;
  const lucroLiquido = recebimentoLiquido - custoTotal;
  const chartData = historico.length ? historico : [{ fase: FASES[0], v: 0 }];
  const colhido = ["pago", "colhido", "arquivado", "aguardando_aprovacao"].includes(plot.status);
  const esgotado = plot.cotas_disponiveis === 0;
  const isInvestor = !user || user.role === "investidor";

  async function handleBuy() {
    setError("");
    if (!user) { navigate("/login", { state: { from: location.pathname } }); return; }
    if (user.role !== "investidor") { setError("Apenas contas de investidor podem comprar."); return; }
    if (paymentType === "cartao" && !selectedCardId) { setError("Escolha um cartão ou cadastre um novo."); return; }

    const card = cards.find((c) => c.id === selectedCardId);
    const ok = await dialog.confirm({
      title: "Confirmar investimento",
      message: `${qtd} ${unitPlural(plot.unidade, qtd)} de ${plot.grao} em ${plot.nome} por ${fmtBRL(custoTotal)}, pagos ${paymentType === "pix" ? "via Pix" : `no cartão ${card?.brand} final ${card?.last4}`}. Os valores de retorno são estimativas.`,
      confirmLabel: `Pagar ${fmtBRL(custoTotal)}`,
    });
    if (!ok) return;

    setBuying(true);
    try {
      const tipo = paymentType === "pix" ? "pix" : card?.type === "debito" ? "cartao_debito" : "cartao_credito";
      await api.invest(plot.id, qtd, tipo, paymentType === "pix" ? null : selectedCardId);
      toast(`Compra confirmada: ${qtd} ${unitPlural(plot.unidade, qtd)} por ${fmtBRL(custoTotal)}`);
      setCotas(1);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBuying(false);
    }
  }

  const share = (
    <ShareButton
      title={`${plot.nome} · ${plot.grao} — Meu Talhão`}
      text={`Dá uma olhada nesse talhão de ${plot.grao} na Meu Talhão — dá pra investir direto na safra e acompanhar até a colheita!`}
    />
  );

  return (
    <Page title={plot.nome} back="/" width="medium">
      <PageHeader
        back="/"
        backLabel="Talhões"
        leading={<GrainThumb grao={plot.grao} size="lg" />}
        title={plot.nome}
        subtitle={
          <>
            <MapPin size={14} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
            {plot.farm_name}, {plot.farm_location} · {fmtNumber(plot.area_ha)} ha · safra {plot.safra}
          </>
        }
      />

      <div className="split">
        <div className="stack-lg">
          {fotos.length > 0 && (
            <section className="card" aria-labelledby="fotos-t">
              <h2 id="fotos-t" className="card-title" style={{ marginBottom: 10 }}>Fotos do talhão</h2>
              <PhotoGallery photos={fotos} />
            </section>
          )}

          <section className="card" aria-labelledby="etapas-t">
            <h2 id="etapas-t" className="card-title" style={{ marginBottom: 16 }}>Etapas da safra</h2>
            <ol className="stepper" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {FASES.map((f, i) => {
                const state = i < plot.fase_atual ? "is-done" : i === plot.fase_atual ? "is-current" : "is-todo";
                return (
                  <li key={f} className={`step ${state}`} aria-current={i === plot.fase_atual ? "step" : undefined}>
                    <span className="step-dot"><img src={FASE_ICONS[i]} alt="" /></span>
                    <span className="step-label">{f}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card" aria-labelledby="preco-t">
            <h2 id="preco-t" className="card-title">Preço sobe conforme a safra avança</h2>
            <p className="card-desc" style={{ marginBottom: 16 }}>
              Quem entra mais cedo paga menos por {unidade} e tem mais espaço de lucro. Mais perto da colheita o preço se aproxima do valor de venda: menos risco, retorno menor.
            </p>
            <div className="grid-stats">
              <div>
                <p className="label-xs">Preço agora ({FASES[plot.fase_atual]})</p>
                <p className="stat-value text-primary" style={{ marginTop: 2 }}>{fmtBRL(plot.cota_valor)}</p>
              </div>
              <div>
                <p className="label-xs">Venda projetada na colheita</p>
                <p className="stat-value" style={{ marginTop: 2 }}>{fmtBRL(precoVendaProjetado)}</p>
              </div>
              <div>
                <p className="label-xs">Margem bruta por {unidade}</p>
                <p className={`stat-value ${margemPorUnidade >= 0 ? "text-success" : "text-danger"}`} style={{ marginTop: 2 }}>{fmtBRL(margemPorUnidade)}</p>
              </div>
            </div>
            <p className="text-xs text-3" style={{ marginTop: 12 }}>
              Referência de mercado: {fmtBRL(plot.preco_venda_estimado)} por {unidade}, com retorno estimado de {plot.previsao_retorno}% informado pela fazenda.
            </p>
          </section>

          <section className="card" aria-labelledby="prog-t">
            <h2 id="prog-t" className="card-title">Progresso da safra</h2>
            <p className="card-desc" style={{ marginBottom: 10 }}>Atualizado pela fazenda conforme o andamento em campo. Hoje: {plot.progresso}%.</p>
            <div style={{ height: 170 }} aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={grainColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={grainColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="fase" tick={{ fontSize: 11, fill: "#584A3C" }} axisLine={{ stroke: "#DDCDB4" }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#584A3C" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${v}%`} ticks={[0, 25, 50, 75, 100]} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DDCDB4" }} formatter={(v) => [`${v}%`, "progresso"]} />
                  <Area type="monotone" dataKey="v" stroke={grainColor} strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="card" aria-labelledby="com-t">
            <h2 id="com-t" className="card-title" style={{ marginBottom: 12 }}>Como a comissão funciona</h2>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Comissão da fazenda ({plot.farm_name})</dt><dd>{plot.commission_pct}% do lucro</dd></div>
              <div><dt>Comissão do Meu Talhão</dt><dd>{appCommission}% do lucro</dd></div>
              <div className="total"><dt>Sua parte do lucro</dt><dd className="text-success">{100 - plot.commission_pct - appCommission}%</dd></div>
            </dl>
            <p className="text-xs text-3" style={{ marginTop: 10 }}>As comissões incidem só sobre o lucro, nunca sobre o valor investido.</p>
          </section>

          <FarmProfileCard farmId={plot.farm_id} estrelas={plot.farm_estrelas} />
          <FarmTrackRecord farmId={plot.farm_id} farmName={plot.farm_name} />
        </div>

        <aside className="split-aside" id="investir" aria-labelledby="investir-t">
          <div className="card" style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-2)" }}>
            {colhido ? (
              <>
                <h2 id="investir-t" className="card-title">Talhão colhido</h2>
                <p className="card-desc" style={{ marginBottom: 14 }}>
                  Este talhão concluiu o ciclo{plot.status === "pago" ? " e os investidores já foram pagos" : ""}. Não aceita novos investimentos.
                </p>
                {plot.retorno_final != null && (
                  <dl className="kv"><div className="total"><dt>Retorno final da safra</dt><dd className="text-success">{plot.retorno_final}%</dd></div></dl>
                )}
              </>
            ) : (
              <>
                <h2 id="investir-t" className="card-title">Investir neste talhão</h2>
                <p className="card-desc" style={{ marginBottom: 16 }}>
                  {fmtNumber(plot.cotas_disponiveis)} de {fmtNumber(plot.cotas_totais)} {unitPlural(plot.unidade, plot.cotas_totais)} disponíveis nesta fase
                </p>

                <ErrorBanner message={error} />

                <p className="field-label" id="qtd-label" style={{ marginBottom: 6 }}>Quantidade de {unitPlural(plot.unidade, 2)}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }} role="group" aria-labelledby="qtd-label">
                  <IconButton label="Diminuir" icon={Minus} variant="surface" onClick={() => setCotas(Math.max(1, qtd - 1))} disabled={qtd <= 1 || esgotado} />
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    aria-labelledby="qtd-label"
                    min={1}
                    max={maxCotas}
                    value={cotas}
                    disabled={esgotado}
                    onChange={(e) => setCotas(e.target.value === "" ? "" : Math.max(1, Math.min(maxCotas, Math.floor(Number(e.target.value) || 1))))}
                    onBlur={() => setCotas(qtd)}
                    style={{ textAlign: "center", fontWeight: 700, flex: 1 }}
                  />
                  <IconButton label="Aumentar" icon={Plus} variant="surface" onClick={() => setCotas(Math.min(maxCotas, qtd + 1))} disabled={qtd >= maxCotas || esgotado} />
                </div>

                <dl className="kv" style={{ margin: "0 0 16px" }}>
                  <div><dt>Você paga agora</dt><dd>{fmtBRL(custoTotal)}</dd></div>
                  <div><dt>Recebimento estimado</dt><dd>{fmtBRL(recebimentoLiquido)}</dd></div>
                  <div className="total"><dt>Lucro líquido estimado</dt><dd className={lucroLiquido >= 0 ? "text-success" : "text-danger"}>{fmtBRL(lucroLiquido)}</dd></div>
                </dl>

                {isInvestor && (
                  <div style={{ marginBottom: 16 }}>
                    <p className="field-label" style={{ marginBottom: 6 }}>Forma de pagamento</p>
                    <Segmented label="Forma de pagamento" value={paymentType} onChange={setPaymentType}
                      options={[{ id: "pix", label: "Pix", icon: QrCode }, { id: "cartao", label: "Cartão", icon: CreditCard }]} />
                    <div style={{ marginTop: 10 }}>
                      {paymentType === "pix" ? (
                        <p className="text-xs text-2">O Pix é gerado na confirmação da compra.</p>
                      ) : cards.length > 0 ? (
                        <SelectField label="Cartão" value={selectedCardId || ""} onChange={(v) => setSelectedCardId(Number(v))}>
                          {cards.map((c) => <option key={c.id} value={c.id}>{c.brand} final {c.last4} ({c.type === "credito" ? "crédito" : "débito"})</option>)}
                        </SelectField>
                      ) : user ? (
                        <Button variant="ghost" icon={Plus} to="/pagamentos">Cadastrar um cartão</Button>
                      ) : (
                        <p className="text-xs text-2">Entre na sua conta para escolher um cartão.</p>
                      )}
                    </div>
                  </div>
                )}

                {user && !isInvestor ? (
                  <Banner tone="info">Somente contas de investidor podem comprar talhões.</Banner>
                ) : (
                  <Button size="lg" block onClick={handleBuy} loading={buying} disabled={esgotado}>
                    {esgotado ? "Esgotado nesta fase" : !user ? "Entrar para investir" : `Investir ${fmtBRL(custoTotal)}`}
                  </Button>
                )}
                <p className="text-xs text-3" style={{ marginTop: 10, lineHeight: 1.5 }}>
                  Retornos são estimativas e dependem da produção e do preço do grão na colheita. Investimentos no agro têm risco.
                </p>
              </>
            )}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>{share}</div>
          </div>
        </aside>
      </div>

      {/* atalho fixo no celular: o painel de compra fica no fim da página */}
      {!colhido && (
        <MobileInvestBar price={fmtBRL(plot.cota_valor)} unidade={unidade} />
      )}
    </Page>
  );
}

function MobileInvestBar({ price, unidade }) {
  const [panelVisible, setPanelVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById("investir");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  if (panelVisible) return null;
  return (
    <div className="mobile-invest-bar">
      <div>
        <p className="label-xs">{unidade} por</p>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--fs-lg)", lineHeight: 1.1 }}>{price}</p>
      </div>
      <Button onClick={() => document.getElementById("investir")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Investir</Button>
    </div>
  );
}

function Stars({ value }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="rating" aria-label={`Nota ${value.toFixed(1)} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const on = i < full || (i === full && half);
        return <Star key={i} size={15} fill={on ? "var(--brand-orange)" : "none"} color={on ? "var(--brand-orange)" : "var(--border-strong)"} aria-hidden />;
      })}
      <span style={{ marginLeft: 3 }}>{value.toFixed(1)}</span>
    </span>
  );
}

function FarmProfileCard({ farmId, estrelas }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.getFarmProfile(farmId).then(setData).catch(() => {}); }, [farmId]);
  if (!data) return null;
  const { farm, caracteristicas = [], fotos = [] } = data;
  if (!farm.descricao && !farm.premiacoes && caracteristicas.length === 0 && fotos.length === 0) return null;
  const nota = Number(estrelas) || 0;
  const categorias = [...new Set(caracteristicas.map((c) => c.categoria))];

  return (
    <section className="card" aria-labelledby="sobre-t">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <h2 id="sobre-t" className="card-title">Sobre {farm.name}</h2>
        {nota > 0 && <Stars value={nota} />}
      </div>
      {fotos.length > 0 && <div style={{ margin: "8px 0 12px" }}><PhotoGallery photos={fotos} /></div>}
      {farm.descricao && <p className="text-sm" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>{farm.descricao}</p>}
      {farm.premiacoes && (
        <Banner tone="warning" style={{ marginBottom: 12 }}>
          <span style={{ display: "flex", gap: 6, whiteSpace: "pre-wrap" }}><Award size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />{farm.premiacoes}</span>
        </Banner>
      )}
      {categorias.map((cat) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <h3 className="text-xs text-2" style={{ fontFamily: "var(--font-body)", fontWeight: 700, marginBottom: 6 }}>{cat}</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {caracteristicas.filter((c) => c.categoria === cat).map((c) => <span key={c.key} className="badge">{c.label}</span>)}
          </div>
        </div>
      ))}
    </section>
  );
}

function FarmTrackRecord({ farmId, farmName }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.farmTrackRecord(farmId).then(setData).catch(() => {}); }, [farmId]);
  if (!data) return null;
  const { resumo, historico } = data;

  return (
    <section className="card" aria-labelledby="hist-t">
      <h2 id="hist-t" className="card-title">Histórico de {farmName}</h2>
      <p className="card-desc" style={{ marginBottom: 14 }}>Retorno prometido comparado ao entregue nas colheitas anteriores.</p>
      {resumo.totalColhidos === 0 ? (
        <p className="text-sm text-2">Esta fazenda ainda não concluiu colheitas na plataforma.</p>
      ) : (
        <>
          <div className="grid-stats" style={{ marginBottom: 14 }}>
            <div><p className="label-xs">Colheitas concluídas</p><p className="stat-value" style={{ marginTop: 2 }}>{resumo.totalColhidos}</p></div>
            <div><p className="label-xs">Cumpriu o prometido</p><p className={`stat-value ${resumo.cumpriuPromessaPct >= 50 ? "text-success" : "text-danger"}`} style={{ marginTop: 2 }}>{resumo.cumpriuPromessaPct}%</p></div>
            <div><p className="label-xs">Desvio médio</p><p className={`stat-value ${resumo.desvioMedio >= 0 ? "text-success" : "text-danger"}`} style={{ marginTop: 2 }}>{resumo.desvioMedio >= 0 ? "+" : ""}{resumo.desvioMedio} p.p.</p></div>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {historico.slice(0, 5).map((h) => (
              <li key={h.id} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: "var(--fs-sm)", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <span className="text-2">{h.nome} · {h.grao} · {h.safra}</span>
                <span>
                  <span className="text-2">prometeu {h.previsao_retorno}% · </span>
                  <strong className={h.cumpriu ? "text-success" : "text-danger"}>entregou {h.retorno_final}%</strong>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
