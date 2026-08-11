import { useEffect, useState } from "react";
import { Percent, Plus, Trash2, RotateCcw, Pencil, Info } from "lucide-react";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS, ICONS, FASES, UNIT_LABEL, unitPlural, fmtBRL } from "../theme";
import { ProgressBar, ErrorBanner } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

export default function FarmDashboard() {
  const { user } = useAuth();
  const [farm, setFarm] = useState(null);
  const [plots, setPlots] = useState([]);
  const [references, setReferences] = useState([]);
  const [fasePricing, setFasePricing] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.getFarm(user.farm_id).then((data) => setFarm(data.farm)).catch((err) => setError(err.message));
    api.myFarmPlots().then((data) => setPlots(data.plots)).catch((err) => setError(err.message));
    api.commodityReferences().then((data) => setReferences(data.references)).catch(() => {});
    api.fasePricing().then((data) => setFasePricing(data.multiplicadores)).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  if (!farm) return <div style={{ padding: 32 }}><ErrorBanner message={error} />{!error && <p style={{ color: COLORS.soilLight, fontSize: 13 }}>Carregando painel...</p>}</div>;

  async function updateCommission(pct) {
    try {
      await api.setCommission(farm.id, pct);
      setFarm((f) => ({ ...f, commission_pct: pct }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
        <img src={ICONS.fazendas} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
        <div>
          <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: 0 }}>Painel da fazenda</h1>
          <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "2px 0 0" }}>{farm.name} · {farm.location}</p>
        </div>
      </div>
      <div style={{ marginBottom: 16 }} />

      <ErrorBanner message={error} />
      {notice && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 14 }}>{notice}</p>}

      {farm.status === "pendente" && (
        <div style={{ background: "#FBF3E1", border: "1px solid #E8C97A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: COLORS.soil, marginBottom: 20 }}>
          Sua fazenda está em análise pela administração do Talhão. Você poderá publicar talhões assim que ela for aprovada.
        </div>
      )}

      <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: COLORS.soilLight, display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <Percent size={12} /> sua comissão sobre o lucro de cada colheita
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="range" min={0} max={30} value={farm.commission_pct} onChange={(e) => updateCommission(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.leaf, minWidth: 40 }}>{farm.commission_pct}%</span>
        </div>
        <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "10px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
          <Info size={12} /> Quanto menor sua comissão, maior o repasse ao investidor — fazendas com melhor retorno atraem mais investimento.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: 0 }}>Seus talhões</p>
        <button onClick={() => setShowForm((s) => !s)} disabled={farm.status !== "aprovada"} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none",
          background: farm.status === "aprovada" ? COLORS.leaf : COLORS.line, color: farm.status === "aprovada" ? "#fff" : COLORS.soilLight,
          fontSize: 13, fontWeight: 500, cursor: farm.status === "aprovada" ? "pointer" : "not-allowed",
        }}>
          <Plus size={15} /> Novo talhão
        </button>
      </div>

      {showForm && <NewPlotForm farmId={farm.id} references={references} fasePricing={fasePricing} onCreated={() => { setShowForm(false); load(); }} setError={setError} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
        {plots.map((p) => (
          <PlotAdminCard key={p.id} plot={p} references={references} onChanged={load} setNotice={setNotice} setError={setError} />
        ))}
        {plots.length === 0 && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhum talhão cadastrado ainda.</p>}
      </div>
    </div>
  );
}

function NewPlotForm({ farmId, references, fasePricing, onCreated, setError }) {
  const [form, setForm] = useState({ nome: "", grao: "Soja", area_ha: "", safra: "", previsao_retorno: "" });
  const [precoVenda, setPrecoVenda] = useState("");
  const [cotasTotais, setCotasTotais] = useState("");
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const ref = references.find((r) => r.grao === form.grao);
  const unidade = ref?.unidade || "saca";
  const multiplicadorFase0 = fasePricing?.[0] ?? 1;
  const precoInicial = precoVenda ? Number(precoVenda) * multiplicadorFase0 : 0;

  useEffect(() => {
    if (manual || !ref || !form.area_ha) return;
    const area = Number(form.area_ha);
    if (Number.isNaN(area) || area <= 0) return;
    setPrecoVenda(String(ref.preco_unidade));
    setCotasTotais(String(Math.round(area * ref.produtividade_ha)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.grao, form.area_ha, references]);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createPlot({ farm_id: farmId, ...form, preco_venda_estimado: precoVenda, cotas_totais: cotasTotais, unidade });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const producaoTotal = cotasTotais ? Number(cotasTotais) : 0;
  const captacaoTotal = precoInicial && cotasTotais ? precoInicial * Number(cotasTotais) : 0;

  return (
    <form onSubmit={submit} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select value={form.grao} onChange={(e) => update("grao", e.target.value)} style={inputStyle}>
          {Object.keys(GRAIN_COLORS).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Safra (ex: 2026/27)" value={form.safra} onChange={(v) => update("safra", v)} required />

      <div style={{ gridColumn: "1 / -1", background: COLORS.bg, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <Info size={13} /> Calculado com base na referência de mercado — pode ajustar se souber a produtividade real do seu talhão.
          </p>
          <button type="button" onClick={() => setManual((m) => !m)} style={{ fontSize: 11.5, color: COLORS.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
            {manual ? "usar cálculo automático" : "editar manualmente"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field
            label={`Preço estimado de venda por ${UNIT_LABEL[unidade]} na colheita (R$)`}
            type="number" value={precoVenda}
            onChange={setPrecoVenda}
            required
            readOnly={!manual}
            style={manual ? {} : { opacity: 0.75, background: COLORS.line }}
          />
          <Field
            label={`Total de ${unitPlural(unidade, 2)} previstas`}
            type="number" value={cotasTotais}
            onChange={setCotasTotais}
            required
            readOnly={!manual}
            style={manual ? {} : { opacity: 0.75, background: COLORS.line }}
          />
        </div>
        {producaoTotal > 0 && (
          <p style={{ fontSize: 12, color: COLORS.soil, margin: 0 }}>
            Produção estimada: <strong>{producaoTotal.toLocaleString("pt-BR")} {unitPlural(unidade, producaoTotal)}</strong> · Preço inicial (fase 0): <strong>{fmtBRL(precoInicial)}</strong>/{UNIT_LABEL[unidade]} · Captação inicial: <strong>{fmtBRL(captacaoTotal)}</strong>
          </p>
        )}
      </div>

      <Field label="Retorno estimado ao investidor (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div style={{ gridColumn: "1 / -1" }}>
        <button type="submit" disabled={saving} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: COLORS.orange, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Publicando..." : "Publicar talhão"}
        </button>
      </div>
    </form>
  );
}

const STATUS_LABEL = {
  captacao: "captação",
  em_andamento: "em andamento",
  colhido: "colhido",
  pago: "colhido e pago",
  arquivado: "arquivado",
};

function PlotAdminCard({ plot, references, onChanged, setNotice, setError }) {
  const color = GRAIN_COLORS[plot.grao] || COLORS.leaf;
  const [fase, setFase] = useState(plot.fase_atual);
  const [progresso, setProgresso] = useState(plot.progresso);
  const [retornoFinal, setRetornoFinal] = useState(plot.previsao_retorno);
  const [saving, setSaving] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const nuncaVendido = plot.cotas_disponiveis === plot.cotas_totais;
  const podeExcluir = plot.status === "pago" || nuncaVendido;
  const finalizado = plot.status === "pago" || plot.status === "arquivado";

  async function saveProgress() {
    setSaving(true);
    try {
      await api.updateProgress(plot.id, { fase_atual: fase, progresso });
      setNotice("Progresso da safra atualizado.");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function finalize() {
    if (!confirm(`Finalizar a colheita do ${plot.nome} com retorno de ${retornoFinal}%? Isso paga todos os investidores imediatamente.`)) return;
    setSaving(true);
    try {
      const data = await api.finalizeHarvest(plot.id, retornoFinal);
      setNotice(`Colheita finalizada. ${data.investidoresPagos} investidor(es) pago(s).`);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const aviso = plot.status === "pago"
      ? `Excluir ${plot.nome}? O histórico de pagamento dos investidores continua preservado, mas o talhão sai da sua lista de gestão.`
      : `Excluir ${plot.nome}? Como nenhuma cota foi vendida, ele será removido definitivamente.`;
    if (!confirm(aviso)) return;
    setSaving(true);
    try {
      await api.deletePlot(plot.id);
      setNotice("Talhão excluído.");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", boxShadow: "0 2px 6px rgba(58,46,34,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={GRAIN_ICONS[plot.grao]} alt={plot.grao} style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div>
            <p style={{ fontWeight: 500, fontSize: 14, color: COLORS.soil, margin: 0 }}>{plot.nome} · {plot.grao}</p>
            <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>
              {(plot.cotas_totais - plot.cotas_disponiveis).toLocaleString("pt-BR")}/{plot.cotas_totais.toLocaleString("pt-BR")} {unitPlural(plot.unidade, plot.cotas_totais)} vendidas · {fmtBRL((plot.cotas_totais - plot.cotas_disponiveis) * plot.cota_valor)} captados
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, padding: "3px 10px", borderRadius: 20, background: plot.status === "arquivado" ? COLORS.line : plot.status === "pago" ? "#E1F0DE" : COLORS.wheatLight, color: plot.status === "pago" ? COLORS.leafDark : COLORS.soil, fontWeight: 500 }}>
            {STATUS_LABEL[plot.status] || plot.status}
          </span>
          {finalizado && (
            <button onClick={() => setShowEdit((s) => !s)} title="Editar informações" disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
              <Pencil size={16} />
            </button>
          )}
          {finalizado && (
            <button onClick={() => setShowRestart((s) => !s)} title="Reiniciar com nova commodity" disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.leaf, display: "flex" }}>
              <RotateCcw size={16} />
            </button>
          )}
          {podeExcluir && (
            <button onClick={handleDelete} title="Excluir talhão" disabled={saving} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, display: "flex" }}>
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <ProgressBar value={progresso} color={color} />

      {!finalizado ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Fase atual</label>
            <select value={fase} onChange={(e) => setFase(Number(e.target.value))} style={{ ...inputStyle, marginTop: 4 }}>
              {FASES.map((f, i) => <option key={f} value={i}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Progresso (%)</label>
            <input type="number" min={0} max={100} value={progresso} onChange={(e) => setProgresso(Number(e.target.value))} style={{ ...inputStyle, marginTop: 4, width: 90 }} />
          </div>
          <button onClick={saveProgress} disabled={saving} style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 13, cursor: "pointer" }}>
            Salvar andamento
          </button>

          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Retorno final (%)</label>
                <input type="number" value={retornoFinal} onChange={(e) => setRetornoFinal(Number(e.target.value))} style={{ ...inputStyle, marginTop: 4, width: 90 }} />
              </div>
              <button
                onClick={finalize}
                disabled={saving || plot.fase_atual !== FASES.length - 1}
                title={plot.fase_atual !== FASES.length - 1 ? `Atualize e salve a fase para "${FASES[FASES.length - 1]}" antes de finalizar` : ""}
                style={{
                  padding: "9px 14px", borderRadius: 8, border: "none",
                  background: plot.fase_atual !== FASES.length - 1 ? COLORS.line : COLORS.clay,
                  color: plot.fase_atual !== FASES.length - 1 ? COLORS.soilLight : "#fff",
                  fontSize: 13, fontWeight: 500, cursor: plot.fase_atual !== FASES.length - 1 ? "not-allowed" : "pointer",
                }}
              >
                Finalizar colheita e pagar
              </button>
            </div>
            {plot.fase_atual !== FASES.length - 1 && (
              <p style={{ fontSize: 10.5, color: COLORS.orangeDark, margin: 0, maxWidth: 220, textAlign: "right" }}>
                Mude a fase para "{FASES[FASES.length - 1]}" e clique em "Salvar andamento" para liberar o pagamento.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: plot.status === "arquivado" ? COLORS.soilLight : COLORS.leaf, marginTop: 12 }}>
            {plot.status === "arquivado"
              ? "Talhão arquivado — não aparece mais na vitrine. O histórico dos investidores continua preservado."
              : `Colheita finalizada com retorno de ${plot.retorno_final}% — investidores já pagos. Este talhão não aparece mais para venda.`}
          </p>
          {showEdit && (
            <EditPlotForm plot={plot} onDone={() => { setShowEdit(false); onChanged(); }} setError={setError} />
          )}
          {showRestart && (
            <RestartPlotForm plot={plot} references={references} onDone={() => { setShowRestart(false); onChanged(); }} setError={setError} />
          )}
        </>
      )}
    </div>
  );
}

function EditPlotForm({ plot, onDone, setError }) {
  const [form, setForm] = useState({ nome: plot.nome, grao: plot.grao, area_ha: plot.area_ha, safra: plot.safra, previsao_retorno: plot.previsao_retorno });
  const [saving, setSaving] = useState(false);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.editPlot(plot.id, form);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <p style={{ gridColumn: "1 / -1", fontSize: 12.5, color: COLORS.soilLight, margin: 0 }}>
        Corrigir informações deste talhão, sem reabrir para novos investimentos.
      </p>
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select value={form.grao} onChange={(e) => update("grao", e.target.value)} style={inputStyle}>
          {Object.keys(GRAIN_COLORS).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Safra" value={form.safra} onChange={(v) => update("safra", v)} required />
      <Field label="Retorno estimado (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div style={{ gridColumn: "1 / -1" }}>
        <button type="submit" disabled={saving} style={{ padding: "10px 16px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.soil, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function RestartPlotForm({ plot, references, onDone, setError }) {
  const [form, setForm] = useState({ nome: plot.nome, grao: plot.grao, area_ha: plot.area_ha, safra: "", previsao_retorno: plot.previsao_retorno });
  const [precoVenda, setPrecoVenda] = useState(String(plot.preco_venda_estimado || plot.cota_valor));
  const [cotasTotais, setCotasTotais] = useState(String(plot.cotas_totais));
  const [manual, setManual] = useState(false);
  const [saving, setSaving] = useState(false);

  const ref = references.find((r) => r.grao === form.grao);
  const unidade = ref?.unidade || plot.unidade || "saca";

  useEffect(() => {
    if (manual || !ref || !form.area_ha) return;
    const area = Number(form.area_ha);
    if (Number.isNaN(area) || area <= 0) return;
    setPrecoVenda(String(ref.preco_unidade));
    setCotasTotais(String(Math.round(area * ref.produtividade_ha)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.grao, form.area_ha, references]);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.restartPlot(plot.id, { ...form, preco_venda_estimado: precoVenda, cotas_totais: cotasTotais, unidade });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <p style={{ gridColumn: "1 / -1", fontSize: 12.5, color: COLORS.soilLight, margin: 0 }}>
        Reiniciar este talhão para um novo ciclo de investimento, com uma nova commodity se quiser.
      </p>
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select value={form.grao} onChange={(e) => update("grao", e.target.value)} style={inputStyle}>
          {Object.keys(GRAIN_COLORS).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Nova safra (ex: 2027/28)" value={form.safra} onChange={(v) => update("safra", v)} required />

      <div style={{ gridColumn: "1 / -1", background: COLORS.bg, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0 }}>Calculado com base na referência de mercado.</p>
          <button type="button" onClick={() => setManual((m) => !m)} style={{ fontSize: 11.5, color: COLORS.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
            {manual ? "usar cálculo automático" : "editar manualmente"}
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label={`Preço estimado de venda por ${UNIT_LABEL[unidade]} na colheita (R$)`} type="number" value={precoVenda} onChange={setPrecoVenda} required readOnly={!manual} style={manual ? {} : { opacity: 0.75, background: COLORS.line }} />
          <Field label={`Total de ${unitPlural(unidade, 2)} previstas`} type="number" value={cotasTotais} onChange={setCotasTotais} required readOnly={!manual} style={manual ? {} : { opacity: 0.75, background: COLORS.line }} />
        </div>
      </div>

      <Field label="Retorno estimado ao investidor (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div style={{ gridColumn: "1 / -1" }}>
        <button type="submit" disabled={saving} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: COLORS.leaf, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          {saving ? "Reiniciando..." : "Reiniciar talhão com esses dados"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text", required, style, readOnly }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: COLORS.soilLight }}>{label}</label>
      <input
        type={type} required={required} value={value} readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, marginTop: 5, ...style }}
      />
    </div>
  );
}

const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13.5 };
