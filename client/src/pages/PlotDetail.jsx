import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { MapPin, QrCode, CreditCard, Plus, Minus, Award, ShieldCheck, ShieldAlert, Warehouse } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { GRAIN_COLORS } from "../config/theme";
import { quinzenasTexto, pagadorTexto } from "../lib/armazenagem";
import { DemonstrativoResumo } from "./Demonstrativo";
import { fasesDe, faseIcone, unidadeNome, cicloLabels, fmtData, culturaTexto, TIPOS, tipoDe } from "../config/culturas";
import { fmtBRL, fmtNumber, unitPlural, fmtPct } from "../lib/format";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, IconButton, ErrorBanner, Loading, Segmented, SelectField, Banner, useDialog, useToast, EmptyState } from "../components/ui";
import { ShareButton, PhotoGallery, GrainThumb, GuaranteeSeal, CustodyTimeline, Stars, RegrasTalhao, RegrasPiso, RegrasCusto, PilhaDeSacas, ListaDeEspera } from "../components/domain";
import { ehPiso, ehCusto, ganhoInvestidor, ganhoInvestidorCusto, prazoDias } from "../lib/piso";

export default function PlotDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dialog = useDialog();
  const toast = useToast();

  const [plot, setPlot] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [armazem, setArmazem] = useState(null);
  const [armazenagem, setArmazenagem] = useState(null);
  const [validacoes, setValidacoes] = useState([]);
  const [publico, setPublico] = useState(true);
  const [regras, setRegras] = useState(null);
  const [pendencias, setPendencias] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [historicoBruto, setHistoricoBruto] = useState([]);
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
      setArmazem(data.armazem || null);
      setArmazenagem(data.armazenagem || null);
      setValidacoes(data.validacoes || []);
      setHistoricoBruto(data.historico);
      setHistorico(data.historico.map((h) => ({ fase: fasesDe(data.plot)[h.fase_atual], v: h.progresso })));
      setPublico(data.publico !== false);
      setPendencias(data.pendencias || []);
      setAppCommission(data.app_commission_pct);
    }).catch((err) => setLoadError(err.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.regras().then(setRegras).catch(() => {}); }, []);
  // links como /talhao/12#diario rolam até a seção
  useEffect(() => {
    if (!plot || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }, [plot]);

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
  const unidade = unidadeNome(plot.unidade, 1);
  const fases = fasesDe(plot);
  const cicloNome = TIPOS[tipoDe(plot)].ciclo_curto;
  // "da safra" / "do ciclo"
  const fem = cicloNome === "safra";
  const doCiclo = `${fem ? "da" : "do"} ${cicloNome}`;
  const oCiclo = `${fem ? "a" : "o"} ${cicloNome}`;
  const ciclo = cicloLabels(plot);
  const maxCotas = Math.max(1, plot.cotas_disponiveis);
  const qtd = Math.min(Math.max(1, cotas), maxCotas);
  const custoTotal = qtd * plot.cota_valor;
  // mesmo cálculo do pagamento real no servidor (harvestPayout.js):
  // preço de venda projetado = preço de referência × (1 + retorno estimado)
  const custo = ehCusto(plot);
  const piso = ehPiso(plot) || custo;
  const ganhoPiso = custo ? ganhoInvestidorCusto({ custoSaca: Number(plot.custo_saca), precoPago: plot.cota_valor, minPct: Number(plot.piso_pct) || 0,
    precoEsperado: plot.preco_venda_estimado, dias: plot.piso_dias_restantes || 150 }, regras?.custo) : piso ? ganhoInvestidor({ precoReferencia: plot.preco_venda_estimado, precoPago: plot.cota_valor, piso: Number(plot.piso_pct) || 0,
    dias: plot.piso_dias_restantes || prazoDias(plot.colheita_prevista, regras?.piso) || 150 }, regras?.piso) : null;
  const precoVendaProjetado = piso ? ganhoPiso.minimo : plot.preco_venda_estimado * (1 + plot.previsao_retorno / 100);
  const margemPorUnidade = precoVendaProjetado - plot.cota_valor;
  const retornoBruto = qtd * precoVendaProjetado;
  // armazenagem prevista: só desconta do investidor quando ele é quem paga
  const parteArmazemInvestidor = armazenagem ? Number(armazenagem.parte_investidores ?? (armazenagem.pagador === "fazenda" ? 0 : 1)) : 0;
  const investidorPagaArmazem = parteArmazemInvestidor > 0;
  const despesaArmazem = qtd * (armazenagem?.porUnidade || 0) * parteArmazemInvestidor;
  const lucroBruto = retornoBruto - despesaArmazem - custoTotal;
  const comissaoFazenda = Math.max(0, lucroBruto) * (plot.commission_pct / 100);
  const comissaoApp = Math.max(0, lucroBruto) * (appCommission / 100);
  const recebimentoLiquido = retornoBruto - despesaArmazem - comissaoFazenda - comissaoApp;
  const perfPct = Number(plot.perf_excedente_pct) || 0;
  const lucroLiquido = recebimentoLiquido - custoTotal;
  const chartData = historico.length ? historico : [{ fase: fases[0], v: 0 }];
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
      title: "Confirmar compra das sacas",
      message: `${qtd} ${unitPlural(plot.unidade, qtd)} de ${plot.grao} em ${plot.nome} por ${fmtBRL(custoTotal)}, pagos ${paymentType === "pix" ? "via Pix" : `no cartão ${card?.brand} final ${card?.last4}`}. ${piso ? `Renda mínima garantida pela fazenda: ${fmtBRL(qtd * ganhoPiso.minimo)} (${fmtPct(ganhoPiso.minimoPct, 2)}), mais 30% da alta do preço.` : "Os valores de retorno são estimativas."}${Number(plot.perf_excedente_pct) > 0 ? ` Acima da meta de ${fmtPct(plot.previsao_retorno)}, a fazenda fica com ${plot.perf_excedente_pct}% do lucro excedente.` : ""}`,
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
      text={`Dá uma olhada nesse talhão de ${culturaTexto(plot)} na Meu Talhão — dá pra investir direto na produção e acompanhar até o fim do ciclo!`}
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
            {plot.farm_name}, {plot.farm_location} · {fmtNumber(plot.area_ha)} ha · {cicloNome} {plot.safra}
            <span style={{ display: "block", marginTop: 4 }}>
              <strong style={{ color: "var(--text)" }}>{culturaTexto(plot)}</strong>
              {plot.colheita_prevista && <> · {ciclo.inicio.toLowerCase()} {fmtData(plot.plantio_ate)} · {ciclo.fim.toLowerCase()} {fmtData(plot.colheita_prevista)}</>}
            </span>
            {plot.custodia_status === "aceita" && armazem && (
              <span style={{ display: "block", marginTop: 10 }}><GuaranteeSeal name={armazem.name} estrelas={armazem.estrelas} /></span>
            )}
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
            <h2 id="etapas-t" className="card-title" style={{ marginBottom: 16 }}>Etapas {doCiclo}</h2>
            <ol className="stepper" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {fases.map((f, i) => {
                const state = i < plot.fase_atual ? "is-done" : i === plot.fase_atual ? "is-current" : "is-todo";
                return (
                  <li key={f} className={`step ${state}`} aria-current={i === plot.fase_atual ? "step" : undefined}>
                    <span className="step-dot">{faseIcone(plot, i) ? <img src={faseIcone(plot, i)} alt="" /> : <span className="step-num" aria-hidden>{i + 1}</span>}</span>
                    <span className="step-label">{f}</span>
                  </li>
                );
              })}
            </ol>
          </section>

          <GuaranteeCard plot={plot} armazem={armazem} validacoes={validacoes} armazenagem={armazenagem} />

          <section className="card" aria-labelledby="preco-t">
            <h2 id="preco-t" className="card-title">Preço sobe conforme {oCiclo} avança</h2>
            <p className="card-desc" style={{ marginBottom: 16 }}>
              Quem entra mais cedo paga menos por {unidade} e tem mais espaço de lucro. Mais perto do fim do ciclo o preço se aproxima do valor de venda: menos risco, retorno menor.
            </p>
            <div className="grid-stats">
              <div>
                <p className="label-xs">Preço agora ({fases[plot.fase_atual]})</p>
                <p className="stat-value text-primary" style={{ marginTop: 2 }}>{fmtBRL(plot.cota_valor)}</p>
              </div>
              <div>
                <p className="label-xs">{piso ? "Renda mínima garantida" : "Meta de venda no fim do ciclo"}</p>
                <p className="stat-value" style={{ marginTop: 2 }}>{fmtBRL(precoVendaProjetado)}</p>
              </div>
              <div>
                <p className="label-xs">{piso ? `Ganho mínimo por ${unidade}` : `Margem bruta por ${unidade} (antes das comissões)`}</p>
                <p className={`stat-value ${margemPorUnidade >= 0 ? "text-success" : "text-danger"}`} style={{ marginTop: 2 }}>{fmtBRL(margemPorUnidade)}</p>
              </div>
            </div>
            <p className="text-xs text-3" style={{ marginTop: 12 }}>
              {piso
                ? custo ? <>Custo de produção: {fmtBRL(plot.custo_saca)} por {unidade} · venda esperada: {fmtBRL(plot.preco_venda_estimado)}. Você paga o custo, recebe no mínimo {fmtBRL(ganhoPiso.minimo)} e fica com 30% do lucro.</>
                : <>Preço de referência: {fmtBRL(plot.preco_venda_estimado)} por {unidade}. A fazenda garante no mínimo {fmtBRL(precoVendaProjetado)} por {unidade} (piso de {fmtPct(plot.piso_pct, 2)} na safra) e você ainda fica com 30% do que a venda passar disso.</>
                : <>Preço de referência: {fmtBRL(plot.preco_venda_estimado)} por {unidade}. A fazenda promete vender {fmtPct(plot.previsao_retorno)} acima dele (meta de {fmtBRL(precoVendaProjetado)}).</>}
            </p>
          </section>

          <section className="card" aria-labelledby="prog-t">
            <h2 id="prog-t" className="card-title">Progresso {doCiclo}</h2>
            <p className="card-desc" style={{ marginBottom: 10 }}>Atualizado pela fazenda conforme o andamento em campo. Hoje: {plot.progresso}%.</p>
            <div style={{ height: 170, overflow: "hidden" }} aria-hidden>
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
            <h2 id="com-t" className="card-title" style={{ marginBottom: 4 }}>Regras deste talhão: ganhos e comissões</h2>
            {custo ? (
              <>
                <p className="card-desc" style={{ marginBottom: 12 }}>Você financia o custo de produção e fica com 30% do lucro da safra, com mínimo garantido. Regras validadas pelo fundo.</p>
                <RegrasCusto custoHa={plot.custo_ha} produtividade={plot.produtividade_ha} precoEsperado={plot.preco_venda_estimado} piso={plot.piso_pct}
                  pisoDias={plot.piso_dias} publicadoEm={plot.publicado_em} colheitaPrevista={plot.colheita_prevista} unidade={plot.unidade}
                  indice={plot.indice_referencia || regras?.indices?.[plot.grao]} base={plot.base_regional} janelaDias={plot.janela_dias} janelaPregoes={plot.janela_pregoes}
                  seguro={{ seguradora: plot.seguro_seguradora, apolice: plot.seguro_apolice, cobertura: plot.seguro_cobertura_pct }} prorrogacao={plot.prorrogacao_motivo} />
                {(user?.role === "admin" || user?.role === "fundo") && plot.status !== "pago" && <ProrrogarSinistro plot={plot} onDone={load} />}
              </>
            ) : piso ? (
              <>
                <p className="card-desc" style={{ marginBottom: 12 }}>Renda mínima garantida pela fazenda mais parte da alta do preço. Regras validadas pelo fundo.</p>
                <RegrasPiso precoRef={plot.preco_venda_estimado} piso={plot.piso_pct} pisoDias={plot.piso_dias} publicadoEm={plot.publicado_em}
                  colheitaPrevista={plot.colheita_prevista} unidade={plot.unidade} />
              </>
            ) : (<>
            <p className="card-desc" style={{ marginBottom: 12 }}>
              A fazenda promete uma meta de venda. Até a meta, o lucro é dividido pelas comissões abaixo; acima dela vale a regra de performance{perfPct > 0 ? ` (${fmtPct(perfPct)} do excedente para a fazenda)` : ""}. Regras validadas pela administração.
            </p>
            <RegrasTalhao precoRef={plot.preco_venda_estimado} metaPct={plot.previsao_retorno} perfPct={perfPct} comissaoFazendaPct={plot.commission_pct}
              appPct={appCommission} multiplicadores={regras?.multiplicadores || {}} unidade={plot.unidade} tipoProducao={plot.tipo_producao}
              inicioCiclo={plot.plantio_ate} fimCiclo={plot.colheita_prevista} quinzenasArmazem={armazenagem?.quinzenas_previstas || 0}
              despesaInvestidorUnidade={(armazenagem?.porUnidade || 0) * parteArmazemInvestidor} faseAtual={plot.fase_atual} />
            </>)}
          </section>

          <DemonstrativoCard plotId={plot.id} />

          <DiarioDaRoca plot={plot} historico={historicoBruto} validacoes={validacoes} fotos={fotos} />

          <FarmProfileCard farmId={plot.farm_id} estrelas={plot.farm_estrelas} />
          <FarmTrackRecord farmId={plot.farm_id} farmName={plot.farm_name} />
        </div>

        <aside className="split-aside" id="investir" aria-labelledby="investir-t">
          <div className="card" style={{ background: "var(--surface-raised)", boxShadow: "var(--shadow-2)" }}>
            {!publico && !colhido ? (
              <>
                <h2 id="investir-t" className="card-title">Talhão em análise</h2>
                <p className="card-desc" style={{ marginBottom: 12 }}>
                  Este talhão ainda não está aberto para investimento. Falta: {pendencias.join(" e ") || "liberação da administração"}.
                </p>
                <p className="text-xs text-3">Talhões novos só vão ao ar depois de aprovados pela administração e com um armazém garantidor.</p>
                {["admin", "fundo"].includes(user?.role) && plot.aprovacao_status !== "aprovado" && (
                  <Button block style={{ marginTop: 14 }} to="/admin?aba=talhoes">Revisar e aprovar</Button>
                )}
              </>
            ) : colhido ? (
              <>
                <h2 id="investir-t" className="card-title">Talhão colhido</h2>
                <p className="card-desc" style={{ marginBottom: 14 }}>
                  Este talhão concluiu o ciclo{plot.status === "pago" ? " e os investidores já foram pagos" : ""}. Não aceita novos investimentos.
                </p>
                {plot.retorno_final != null && (
                  <dl className="kv"><div className="total"><dt>Retorno final {doCiclo}</dt><dd className="text-success">{fmtPct(plot.retorno_final)}</dd></div></dl>
                )}
              </>
            ) : (
              <>
                <h2 id="investir-t" className="card-title">Comprar sacas deste talhão</h2>
                <p className="card-desc" style={{ marginBottom: 16 }}>
                  {fmtNumber(plot.cotas_disponiveis)} de {fmtNumber(plot.cotas_totais)} {unitPlural(plot.unidade, plot.cotas_totais)} disponíveis{plot.modelo === "piso" || plot.modelo === "custo" ? "" : " nesta fase"}
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

                <div className="compra-rapida" role="group" aria-label="Compra rápida" style={{ marginBottom: 12 }}>
                  {[1, 5, 10].map((n) => (
                    <Button key={n} size="sm" variant="secondary" disabled={esgotado || qtd + n > maxCotas} onClick={() => setCotas(Math.min(maxCotas, (Number(cotas) || 0) + n))}>+{n}</Button>
                  ))}
                </div>
                <p className="text-sm text-2" style={{ marginBottom: 10 }}>1 {unidade} = <strong style={{ color: "var(--text)" }}>{fmtBRL(plot.cota_valor)}</strong></p>
                <div style={{ marginBottom: 14, minHeight: 30 }}><PilhaDeSacas quantidade={qtd} unidade={plot.unidade} grao={plot.grao} size={28} /></div>

                <dl className="kv" style={{ margin: "0 0 16px" }}>
                  <div><dt>Você paga agora</dt><dd>{fmtBRL(custoTotal)}</dd></div>
                  {custo ? (() => {
                    const C = Number(plot.custo_saca), mn = Number(plot.piso_pct) || 0;
                    const limiar = C * (1 + (mn / 100) / 0.30);
                    const exemplo = plot.preco_venda_estimado * 1.15;
                    const recebeEx = Math.max(C * (1 + mn / 100), C + 0.30 * (exemplo - C));
                    return (
                      <>
                        <div className="total"><dt>Recebe no mínimo, na colheita</dt><dd className="text-success">{fmtBRL(qtd * ganhoPiso.minimo)}</dd></div>
                        <div><dt>Recebe mais se a venda passar de {fmtBRL(limiar)} por {unidade}</dt><dd>30% do lucro</dd></div>
                        <div><dt>Exemplo: venda a {fmtBRL(exemplo)}</dt><dd>{fmtBRL(qtd * recebeEx)}</dd></div>
                      </>
                    );
                  })() : piso ? (
                    <>
                      <div><dt>Recebimento mínimo garantido</dt><dd>{fmtBRL(qtd * ganhoPiso.minimo)}</dd></div>
                      <div><dt>Esperado, com parte da alta</dt><dd>{fmtBRL(qtd * ganhoPiso.esperado)}</dd></div>
                      <div className="total"><dt>Lucro mínimo garantido</dt><dd className="text-success">{fmtBRL(qtd * ganhoPiso.minimo - custoTotal)} ({fmtPct(ganhoPiso.minimoPct, 2)})</dd></div>
                    </>
                  ) : (<>
                  {investidorPagaArmazem && despesaArmazem > 0 && (
                    <div><dt>Armazenagem estimada{parteArmazemInvestidor < 1 ? ` (sua parte: ${String(Math.round(parteArmazemInvestidor * 1000) / 10).replace(".", ",")}%)` : ""} · {quinzenasTexto(armazenagem.quinzenas_previstas)}</dt><dd>{"−\u00a0"}{fmtBRL(despesaArmazem)}</dd></div>
                  )}
                  <div><dt>Recebimento estimado</dt><dd>{fmtBRL(recebimentoLiquido)}</dd></div>
                  <div className="total"><dt>Lucro líquido estimado</dt><dd className={lucroLiquido >= 0 ? "text-success" : "text-danger"}>{fmtBRL(lucroLiquido)}</dd></div>
                  </>)}
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
                    {esgotado ? "Esgotado nesta fase" : !user ? "Entrar para comprar" : `Comprar ${fmtNumber(qtd)} ${unitPlural(plot.unidade, qtd)} · ${fmtBRL(custoTotal)}`}
                  </Button>
                )}
                {esgotado && <ListaDeEspera plot={plot} user={user} />}
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
      {!colhido && publico && (
        <MobileInvestBar price={fmtBRL(plot.cota_valor)} unidade={unidade} esgotado={plot.cotas_disponiveis === 0} />
      )}
    </Page>
  );
}

// O armazém é o garantidor físico da commodity: valida de forma independente
// que a fazenda plantou, colheu e guardou o que declarou.
function GuaranteeCard({ plot, armazem, validacoes, armazenagem }) {
  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  if (plot.custodia_status === "aceita" && armazem) {
    return (
      <section className="card" aria-labelledby="garantia-t" style={{ borderColor: "#c5d9a8" }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            <span className="thumb" style={{ background: "var(--success-soft)", color: "var(--success-text)" }}><ShieldCheck size={24} aria-hidden /></span>
            <div style={{ minWidth: 0 }}>
              <h2 id="garantia-t" className="card-title">Garantia do armazém</h2>
              <p className="text-sm text-2">{armazem.name} · {armazem.location}{armazem.capacidade_t ? ` · ${fmtNumber(armazem.capacidade_t)} t de capacidade` : ""}</p>
            </div>
          </div>
          {armazem.estrelas > 0 && <Stars value={armazem.estrelas} />}
        </div>
        <p className="card-desc" style={{ marginBottom: 16 }}>
          Um armazém credenciado acompanha este talhão e confirma, de forma independente da fazenda, cada etapa abaixo. O pagamento aos investidores só é liberado depois da armazenagem confirmada.
        </p>
        {armazem.descricao && <p className="text-sm" style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{armazem.descricao}</p>}
        {armazem.caracteristicas?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {armazem.caracteristicas.map((c) => <span key={c.key} className="badge">{c.label}</span>)}
          </div>
        )}
        <CustodyTimeline plot={plot} validacoes={validacoes} unidade={plot.unidade} declared={plot.cotas_totais} sold={vendidas} />
        {armazenagem && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <p className="card-title" style={{ marginBottom: 6 }}>Despesa de armazenagem</p>
            <p className="text-sm text-2">
              {armazenagem.tarifas.recepcao || armazenagem.tarifas.quinzena || armazenagem.tarifas.quebraPct
                ? <>Recepção {fmtBRL(armazenagem.tarifas.recepcao)} por {unidadeNome(plot.unidade, 1)}, {fmtBRL(armazenagem.tarifas.quinzena)} por quinzena após {armazenagem.tarifas.carencia} quinzena(s) de carência{armazenagem.tarifas.quebraPct ? `, quebra técnica de ${String(armazenagem.tarifas.quebraPct).replace(".", ",")}% por quinzena` : ""}. </>
                : "O armazém não cobra tarifa neste talhão. "}
              Previsão de {quinzenasTexto(armazenagem.quinzenas_previstas)} guardado: cerca de <strong style={{ color: "var(--text)" }}>{fmtBRL(armazenagem.porUnidade)} por {unidadeNome(plot.unidade, 1)}</strong>,
              {" "}{pagadorTexto({ pagador: armazenagem.pagador, investidorPct: armazenagem.parte_investidores * 100 })}.
            </p>
          </div>
        )}
      </section>
    );
  }
  if (plot.custodia_status === "pendente" && armazem) {
    return (
      <Banner tone="info" title="Garantia em análise">
        <span style={{ display: "flex", gap: 6 }}><Warehouse size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          A fazenda indicou o armazém {armazem.name} como garantidor. O selo aparece aqui quando ele aceitar a custódia.</span>
      </Banner>
    );
  }
  return (
    <Banner tone="warning" title="Sem armazém garantidor">
      <span style={{ display: "flex", gap: 6 }}><ShieldAlert size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        As etapas deste talhão são informadas só pela fazenda, sem validação independente de um armazém.</span>
    </Banner>
  );
}

function MobileInvestBar({ price, unidade, esgotado }) {
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
      <Button onClick={() => document.getElementById("investir")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{esgotado ? "Avise-me" : "Comprar"}</Button>
    </div>
  );
}


// Diário do talhão: tudo o que aconteceu no talhão, em linguagem simples e em
// ordem de data — avanços da fazenda (com recado) e confirmações do armazém
function DiarioDaRoca({ plot, historico = [], validacoes = [] }) {
  const fases = fasesDe(plot);
  const ICONE = ["🧑‍🌾", "🌱", "🌿", "🐛", "🌾", "🚜"];
  const itens = [
    ...historico.map((h) => ({ data: h.created_at, icone: ICONE[h.fase_atual] || "🌱",
      titulo: `${fases[h.fase_atual]} · ${h.progresso}%`, texto: h.nota || "A fazenda atualizou o andamento.", quem: plot.farm_name })),
    ...validacoes.map((v) => ({ data: v.created_at, icone: v.resultado === "confirmado" ? "✅" : "⚠️",
      titulo: `Armazém ${v.resultado === "confirmado" ? "confirmou" : "apontou divergência"}: ${v.etapa}`,
      texto: [v.quantidade ? `${fmtNumber(v.quantidade)} ${unitPlural(plot.unidade, v.quantidade)}` : "", v.observacao].filter(Boolean).join(" · ") || "Validação registrada.",
      quem: v.validado_por || "Armazém garantidor" })),
  ].sort((a, b) => new Date(b.data) - new Date(a.data));
  if (itens.length === 0) return null;
  return (
    <section className="card" id="diario" aria-labelledby="diario-t" style={{ scrollMarginTop: 80 }}>
      <h2 id="diario-t" className="card-title" style={{ marginBottom: 4 }}>Diário do talhão</h2>
      <p className="card-desc" style={{ marginBottom: 14 }}>O que aconteceu na lavoura, contado pela fazenda e confirmado pelo armazém.</p>
      <ul className="diario">
        {itens.slice(0, 12).map((it, i) => (
          <li key={i}>
            <span className="diario-icone" aria-hidden>{it.icone}</span>
            <div className="diario-texto">
              <p style={{ fontWeight: 700 }}>{it.titulo}</p>
              <p className="text-sm text-2" style={{ whiteSpace: "pre-wrap" }}>{it.texto}</p>
              <p className="text-xs text-3">{new Date(it.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {it.quem}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// resumo do demonstrativo financeiro (custos lançados pela fazenda)
function DemonstrativoCard({ plotId }) {
  const [d, setD] = useState(null);
  useEffect(() => { api.demonstrativo(plotId).then(setD).catch(() => {}); }, [plotId]);
  if (!d || (d.totais.captado === 0 && d.totais.realizado === 0 && d.totais.previsto === 0)) return null;
  return (
    <section className="card" aria-labelledby="dem-card-t">
      <div className="card-head" style={{ marginBottom: 10 }}>
        <div>
          <h2 id="dem-card-t" className="card-title">Demonstrativo financeiro</h2>
          <p className="card-desc">Onde a fazenda aplica o dinheiro dos investidores, etapa por etapa.</p>
        </div>
        <Button size="sm" variant="secondary" to={`/talhao/${plotId}/demonstrativo`}>Ver completo</Button>
      </div>
      <DemonstrativoResumo d={d} />
    </section>
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
                  <span className="text-2">prometeu {fmtPct(h.previsao_retorno)} · </span>
                  <strong className={h.cumpriu ? "text-success" : "text-danger"}>entregou {fmtPct(h.retorno_final)}</strong>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// QUEBRA DE SAFRA: o fundo prorroga o pagamento quando o sinistro é reconhecido pela seguradora
function ProrrogarSinistro({ plot, onDone }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState("");
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState("");
  async function enviar() {
    try { await api.prorrogarTalhao(plot.id, data, motivo); setMsg("Pagamento prorrogado e investidores avisados."); setAberto(false); onDone?.(); }
    catch (e) { setMsg(e.message); }
  }
  return (
    <div style={{ marginTop: 12 }}>
      {!aberto ? <Button variant="ghost" size="sm" onClick={() => setAberto(true)}>Prorrogar por sinistro reconhecido</Button> : (
        <div className="card card--well" style={{ padding: 12 }}>
          <p className="text-sm" style={{ marginBottom: 8 }}>Use só com sinistro reconhecido pela seguradora. O mínimo dos investidores continua correndo até a nova data.</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="text-sm">Nova colheita prevista<input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ display: "block", marginTop: 4 }} /></label>
            <label className="text-sm" style={{ flex: 1, minWidth: 200 }}>Sinistro (nº do aviso, laudo)<input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ display: "block", width: "100%", marginTop: 4 }} /></label>
            <Button size="sm" onClick={enviar}>Prorrogar</Button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm" style={{ marginTop: 6 }}>{msg}</p>}
    </div>
  );
}
