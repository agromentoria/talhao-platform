import { useEffect, useState } from "react";
import { Percent, Plus, Trash2, RotateCcw, Pencil, Info, ChevronDown, ChevronUp, Star, UserCircle2 } from "lucide-react";
import { COLORS, GRAIN_COLORS, GRAIN_ICONS, ICONS, FASES, UNIT_LABEL, unitPlural, fmtBRL } from "../theme";
import { ProgressBar, ErrorBanner } from "../components/Shared";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";

const STATUS_FILTERS = [
  { id: "ativos", label: "Ativos", match: (s) => s === "captacao" || s === "em_andamento" || s === "aguardando_aprovacao" },
  { id: "captacao", label: "Em captação", match: (s) => s === "captacao" },
  { id: "andamento", label: "Em andamento", match: (s) => s === "em_andamento" },
  { id: "aprovacao", label: "Aguardando aprovação", match: (s) => s === "aguardando_aprovacao" },
  { id: "finalizados", label: "Colhidos e pagos", match: (s) => s === "pago" || s === "colhido" },
  { id: "arquivados", label: "Arquivados", match: (s) => s === "arquivado" },
  { id: "todos", label: "Todos", match: () => true },
];

export default function FarmDashboard() {
  const { user } = useAuth();
  const [farm, setFarm] = useState(null);
  const [plots, setPlots] = useState([]);
  const [references, setReferences] = useState([]);
  const [fasePricing, setFasePricing] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ativos");

  function load() {
    api.getFarm(user.farm_id).then((data) => setFarm(data.farm)).catch((err) => setError(err.message));
    api.myFarmPlots().then((data) => setPlots(data.plots)).catch((err) => setError(err.message));
    api.commodityReferences().then((data) => setReferences(data.references)).catch(() => {});
    api.fasePricing().then((data) => setFasePricing(data.multiplicadores)).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  if (!farm) return <div style={{ padding: 32 }}><ErrorBanner message={error} />{!error && <p style={{ color: COLORS.soilLight, fontSize: 13 }}>Carregando painel...</p>}</div>;

  const activeFilter = STATUS_FILTERS.find((f) => f.id === statusFilter) || STATUS_FILTERS[0];
  const filteredPlots = plots.filter((p) => activeFilter.match(p.status));

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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={ICONS.fazendas} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
          <div>
            <h1 style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, color: COLORS.soil, margin: 0 }}>Painel da fazenda</h1>
            <p style={{ fontSize: 13.5, color: COLORS.soilLight, margin: "2px 0 0" }}>{farm.name} · {farm.location}</p>
          </div>
        </div>
        <button onClick={() => setShowProfile((s) => !s)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 20, border: `1px solid ${COLORS.line}`,
          background: "#fff", color: COLORS.soil, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <UserCircle2 size={16} /> Editar perfil e destaques
        </button>
      </div>
      <div style={{ marginBottom: 16 }} />

      <ErrorBanner message={error} />
      {notice && <p style={{ fontSize: 12.5, color: COLORS.leaf, marginBottom: 14 }}>{notice}</p>}

      {showProfile && (
        <FarmProfileEditor farmId={farm.id} onClose={() => setShowProfile(false)} setNotice={setNotice} setError={setError} />
      )}

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
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

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginTop: 14, WebkitOverflowScrolling: "touch" }}>
        {STATUS_FILTERS.map((f) => {
          const count = plots.filter((p) => f.match(p.status)).length;
          const active = statusFilter === f.id;
          return (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 20, whiteSpace: "nowrap",
              border: `1px solid ${active ? COLORS.leaf : COLORS.line}`, background: active ? COLORS.leaf : "#fff",
              color: active ? "#fff" : COLORS.soilLight, fontSize: 12.5, fontWeight: 600, cursor: "pointer", flexShrink: 0,
            }}>
              {f.label} <span style={{ opacity: 0.8 }}>({count})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {filteredPlots.map((p) => (
          <PlotAdminCard key={p.id} plot={p} references={references} onChanged={load} setNotice={setNotice} setError={setError} />
        ))}
        {filteredPlots.length === 0 && (
          <p style={{ fontSize: 13, color: COLORS.soilLight }}>
            {plots.length === 0 ? "Nenhum talhão cadastrado ainda." : "Nenhum talhão nesse filtro."}
          </p>
        )}
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
  aguardando_aprovacao: "aguardando aprovação",
};

function PlotAdminCard({ plot, references, onChanged, setNotice, setError }) {
  const color = GRAIN_COLORS[plot.grao] || COLORS.leaf;
  const [fase, setFase] = useState(plot.fase_atual);
  const [progresso, setProgresso] = useState(plot.progresso);
  const [retornoFinal, setRetornoFinal] = useState(plot.previsao_retorno);
  const [comprovanteTexto, setComprovanteTexto] = useState("");
  const [comprovanteImagem, setComprovanteImagem] = useState(null);
  const [showFinalizeForm, setShowFinalizeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const nuncaVendido = plot.cotas_disponiveis === plot.cotas_totais;
  const podeExcluir = plot.status === "pago" || nuncaVendido;
  const finalizado = plot.status === "pago" || plot.status === "arquivado";
  const aguardandoAprovacao = plot.status === "aguardando_aprovacao";

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

  function handleComprovanteImagem(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem para o comprovante.");
      return;
    }
    if (file.size > 1_200_000) {
      setError("Imagem muito grande. Escolha um arquivo de até 1,2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setComprovanteImagem(reader.result);
    reader.readAsDataURL(file);
  }

  async function submitFinalize(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await api.finalizeHarvest(plot.id, retornoFinal, comprovanteTexto, comprovanteImagem);
      setNotice("Solicitação enviada! A administração vai revisar o comprovante antes de liberar o pagamento aos investidores.");
      setShowFinalizeForm(false);
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
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.bg, boxShadow: "0 2px 6px rgba(58,46,34,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src={GRAIN_ICONS[plot.grao]} alt={plot.grao} style={{ width: 26, height: 26, objectFit: "contain" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 500, fontSize: 14, color: COLORS.soil, margin: 0 }}>{plot.nome} · {plot.grao}</p>
            <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "2px 0 0" }}>
              {(plot.cotas_totais - plot.cotas_disponiveis).toLocaleString("pt-BR")}/{plot.cotas_totais.toLocaleString("pt-BR")} {unitPlural(plot.unidade, plot.cotas_totais)} · {fmtBRL((plot.cotas_totais - plot.cotas_disponiveis) * plot.cota_valor)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: plot.status === "arquivado" ? COLORS.line : plot.status === "pago" ? "#E1F0DE" : COLORS.wheatLight, color: plot.status === "pago" ? COLORS.leafDark : COLORS.soil, fontWeight: 500, whiteSpace: "nowrap" }}>
            {STATUS_LABEL[plot.status] || plot.status}
          </span>
          <button onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }} title={expanded ? "Recolher" : "Expandir"} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, display: "flex" }}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{ marginTop: 14 }}><ProgressBar value={progresso} color={color} /></div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 10 }}>
            {finalizado && (
              <button onClick={() => setShowEdit((s) => !s)} title="Editar informações" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.soilLight, fontSize: 12 }}>
                <Pencil size={14} /> Editar
              </button>
            )}
            {finalizado && (
              <button onClick={() => setShowRestart((s) => !s)} title="Reiniciar com nova commodity" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.leaf, fontSize: 12 }}>
                <RotateCcw size={14} /> Reiniciar
              </button>
            )}
            {podeExcluir && (
              <button onClick={handleDelete} title="Excluir talhão" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: COLORS.danger, fontSize: 12 }}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </div>

          {!finalizado && !aguardandoAprovacao ? (
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

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowFinalizeForm((s) => !s)}
              disabled={saving || plot.fase_atual !== FASES.length - 1}
              title={plot.fase_atual !== FASES.length - 1 ? `Atualize e salve a fase para "${FASES[FASES.length - 1]}" antes de finalizar` : ""}
              style={{
                padding: "9px 14px", borderRadius: 8, border: "none",
                background: plot.fase_atual !== FASES.length - 1 ? COLORS.line : COLORS.clay,
                color: plot.fase_atual !== FASES.length - 1 ? COLORS.soilLight : "#fff",
                fontSize: 13, fontWeight: 500, cursor: plot.fase_atual !== FASES.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              Solicitar finalização da colheita
            </button>
            {plot.fase_atual !== FASES.length - 1 && (
              <p style={{ fontSize: 10.5, color: COLORS.orangeDark, margin: "6px 0 0", maxWidth: 240, textAlign: "right" }}>
                Mude a fase para "{FASES[FASES.length - 1]}" e clique em "Salvar andamento" para liberar a solicitação.
              </p>
            )}
          </div>

          {showFinalizeForm && (
            <form onSubmit={submitFinalize} style={{ width: "100%", background: COLORS.bg, borderRadius: 10, padding: 16, marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: COLORS.soil, margin: 0, fontWeight: 600 }}>Solicitar finalização e pagamento</p>
              <p style={{ fontSize: 11, color: COLORS.soilLight, margin: 0, lineHeight: 1.5 }}>
                O pagamento só é liberado depois que a administração revisar o comprovante. Isso protege os investidores contra informações incorretas.
              </p>
              <div>
                <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Retorno final da safra (%)</label>
                <input type="number" required value={retornoFinal} onChange={(e) => setRetornoFinal(Number(e.target.value))} style={{ ...inputStyle, marginTop: 4, width: 120 }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Comprovante (nota fiscal, comprador, silo, etc.) — mínimo 15 caracteres</label>
                <textarea required minLength={15} rows={3} value={comprovanteTexto} onChange={(e) => setComprovanteTexto(e.target.value)}
                  placeholder="Ex: Nota fiscal nº 12345, venda para Cargill em 20/09, 6.480 sacas entregues no armazém X."
                  style={{ ...inputStyle, marginTop: 4, resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, color: COLORS.soilLight }}>Foto do comprovante (opcional)</label>
                <input type="file" accept="image/*" onChange={handleComprovanteImagem} style={{ marginTop: 4, fontSize: 12 }} />
                {comprovanteImagem && <img src={comprovanteImagem} alt="" style={{ marginTop: 8, maxWidth: 160, borderRadius: 8 }} />}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setShowFinalizeForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: "9px 0", borderRadius: 8, border: "none", background: COLORS.clay, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {saving ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : aguardandoAprovacao ? (
        <div style={{ background: "#FBF3E1", border: "1px solid #E8C97A", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
          <p style={{ fontSize: 12.5, color: COLORS.soil, margin: 0, fontWeight: 600 }}>Aguardando aprovação da administração</p>
          <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "4px 0 0" }}>
            Sua solicitação de finalização foi enviada e está em análise. Os investidores serão pagos assim que for aprovada.
          </p>
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

function StarRating({ value }) {
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full || (i === full && hasHalf);
        return <Star key={i} size={16} fill={filled ? COLORS.orange : "none"} color={filled ? COLORS.orange : COLORS.line} />;
      })}
      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, marginLeft: 4 }}>{value.toFixed(1)}</span>
    </div>
  );
}

function FarmProfileEditor({ farmId, onClose, setNotice, setError }) {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [premiacoes, setPremiacoes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.farmCharacteristicsCatalog(), api.getFarmProfile(farmId)])
      .then(([catData, profileData]) => {
        setCatalog(catData.catalog);
        setDescricao(profileData.farm.descricao || "");
        setPremiacoes(profileData.farm.premiacoes || "");
        setSelected(profileData.caracteristicas.map((c) => c.key));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [farmId]);

  const totalPontos = catalog.reduce((s, c) => s + c.pontos, 0) || 1;
  const pontosSelecionados = catalog.filter((c) => selected.includes(c.key)).reduce((s, c) => s + c.pontos, 0);
  const estrelasPreview = Math.min(5, Math.round((pontosSelecionados / totalPontos) * 5 * 10) / 10);

  const categorias = [...new Set(catalog.map((c) => c.categoria))];

  function toggle(key) {
    setSelected((sel) => (sel.includes(key) ? sel.filter((k) => k !== key) : [...sel, key]));
  }

  async function save() {
    setSaving(true);
    try {
      await api.updateFarmProfile(farmId, { descricao, premiacoes, caracteristicas: selected });
      setNotice("Perfil da fazenda atualizado.");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={{ fontSize: 13, color: COLORS.soilLight, marginBottom: 20 }}>Carregando perfil...</p>;

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>Perfil e destaques da fazenda</p>
        <StarRating value={estrelasPreview} />
      </div>
      <p style={{ fontSize: 11.5, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
        Quanto mais itens de tecnologia e infraestrutura você marcar, maior sua nota em estrelas — isso aparece pros investidores na hora de escolher onde investir.
      </p>

      <label style={{ fontSize: 12, color: COLORS.soilLight }}>Descrição da fazenda</label>
      <textarea
        value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={3000} rows={4}
        placeholder="Conte a história da fazenda, tipo de plantio, região, o que torna sua operação diferenciada..."
        style={{ ...inputStyle, marginTop: 5, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
      />

      <label style={{ fontSize: 12, color: COLORS.soilLight }}>Prêmios e reconhecimentos</label>
      <textarea
        value={premiacoes} onChange={(e) => setPremiacoes(e.target.value)} maxLength={1500} rows={2}
        placeholder="Ex: Prêmio Produtor Sustentável 2024, certificação X, reconhecimento Y..."
        style={{ ...inputStyle, marginTop: 5, marginBottom: 18, resize: "vertical", fontFamily: "inherit" }}
      />

      {categorias.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.soilLight, textTransform: "uppercase", margin: "0 0 8px" }}>{cat}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {catalog.filter((c) => c.categoria === cat).map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.soil, cursor: "pointer" }}>
                <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
                <span style={{ fontSize: 11, color: COLORS.orange, fontWeight: 600 }}>+{c.pontos}pt</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.soilLight, fontSize: 13.5, cursor: "pointer" }}>
          Cancelar
        </button>
        <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: COLORS.orange, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}
