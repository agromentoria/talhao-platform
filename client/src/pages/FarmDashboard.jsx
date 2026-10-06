import { useCallback, useEffect, useRef, useState, useId } from "react";
import { Warehouse, Percent, Plus, Trash2, RotateCcw, Pencil, Info, ChevronDown, ChevronUp, Star, UserCircle2, FileText, Image as ImageIcon } from "lucide-react";
import { COLORS, GRAIN_COLORS, GRAINS, ICONS, FASES, UNIT_LABEL } from "../config/theme";
import { fmtBRL, unitPlural } from "../lib/format";
import { api } from "../lib/api";
import { readImageFile } from "../lib/files";
import { useAuth } from "../context/AuthContext";
import { maskCNPJ, isValidCNPJ, maskCEP, buscarEnderecoPorCEP, onlyDigits } from "../lib/validators";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, SelectField, ProgressBar, ErrorBanner, SuccessBanner, Banner, FilterChips, Loading, EmptyState, TextField, Badge, Dialog, useDialog, useToast } from "../components/ui";
import { PhotoGallery, GrainThumb, CustodyTimeline, CustodyStatusBadge } from "../components/domain";

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
  const toast = useToast();
  const [farm, setFarm] = useState(null);
  const [plots, setPlots] = useState([]);
  const [references, setReferences] = useState([]);
  const [fasePricing, setFasePricing] = useState({});
  const [warehouses, setWarehouses] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNoticeState] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLegalInfo, setShowLegalInfo] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ativos");

  // avisos de sucesso viram toast (somem sozinhos); erros ficam na tela
  const setNotice = useCallback((msg) => { setNoticeState(""); if (msg) toast(msg); }, [toast]);

  const load = useCallback(() => {
    api.getFarm(user.farm_id).then((data) => setFarm(data.farm)).catch((err) => setError(err.message));
    api.myFarmPlots().then((data) => setPlots(data.plots)).catch((err) => setError(err.message));
    api.commodityReferences().then((data) => setReferences(data.references)).catch(() => {});
    api.fasePricing().then((data) => setFasePricing(data.multiplicadores)).catch(() => {});
    api.approvedWarehouses().then((data) => setWarehouses(data.warehouses)).catch(() => {});
  }, [user.farm_id]);

  useEffect(() => { load(); }, [load]);

  if (!farm) {
    return <Page title="Minha fazenda" width="medium">{error ? <ErrorBanner message={error} /> : <Loading label="Carregando painel…" />}</Page>;
  }

  const activeFilter = STATUS_FILTERS.find((f) => f.id === statusFilter) || STATUS_FILTERS[0];
  const filteredPlots = plots.filter((p) => activeFilter.match(p.status));
  const aprovada = farm.status === "aprovada";

  return (
    <Page title="Minha fazenda" width="medium">
      <PageHeader
        leading={<img src={ICONS.fazendas} alt="" width={52} height={52} style={{ objectFit: "contain" }} />}
        title={farm.name}
        subtitle={`Painel da fazenda · ${farm.location}`}
        actions={
          <>
            <Button variant="secondary" icon={UserCircle2} onClick={() => setShowProfile(true)}>Perfil e destaques</Button>
            <Button variant="secondary" icon={FileText} onClick={() => setShowLegalInfo(true)}>Dados legais</Button>
          </>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={notice} />

      <Dialog open={showProfile} onClose={() => setShowProfile(false)} title="Perfil e destaques da fazenda" width={640}>
        <FarmProfileEditor farmId={farm.id} onClose={() => setShowProfile(false)} setNotice={setNotice} setError={setError} />
      </Dialog>
      <Dialog open={showLegalInfo} onClose={() => setShowLegalInfo(false)} title="Dados legais da propriedade" width={640}>
        <FarmLegalInfoEditor farmId={farm.id} onClose={() => setShowLegalInfo(false)} setNotice={setNotice} setError={setError} />
      </Dialog>

      {farm.status === "pendente" && (
        <Banner tone="warning" title="Fazenda em análise" style={{ marginBottom: 20 }}>
          A administração está revisando seu cadastro. Você poderá publicar talhões assim que ele for aprovado.
        </Banner>
      )}
      {farm.status === "suspensa" && (
        <Banner tone="error" title="Fazenda suspensa" style={{ marginBottom: 20 }}>
          Novos talhões estão bloqueados. Fale com a administração pelas Conversas.
        </Banner>
      )}

      <CommissionCard farm={farm} onSaved={(pct) => { setFarm((f) => ({ ...f, commission_pct: pct })); toast(`Comissão definida em ${pct}%`); }} onError={setError} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "28px 0 12px" }}>
        <h2 className="section-title">Seus talhões</h2>
        <Button icon={Plus} variant="success" onClick={() => setShowForm(true)} disabled={!aprovada} title={aprovada ? undefined : "Disponível depois da aprovação da fazenda"}>
          Novo talhão
        </Button>
      </div>

      <Dialog open={showForm} onClose={() => setShowForm(false)} title="Publicar novo talhão" width={680}>
        <NewPlotForm farmId={farm.id} references={references} fasePricing={fasePricing} warehouses={warehouses}
          onCreated={() => { setShowForm(false); toast("Talhão publicado"); load(); }} setError={setError} />
      </Dialog>

      <div style={{ marginBottom: 14 }}>
        <FilterChips label="Filtrar talhões" value={statusFilter} onChange={setStatusFilter}
          options={STATUS_FILTERS.map((f) => ({ id: f.id, label: f.label, count: plots.filter((p) => f.match(p.status)).length }))} />
      </div>

      {filteredPlots.length === 0 ? (
        <EmptyState image="/icons/icon_talhao_meu_talhao.svg" title={plots.length === 0 ? "Nenhum talhão cadastrado" : "Nada neste filtro"}
          action={plots.length === 0 && aprovada && <Button icon={Plus} onClick={() => setShowForm(true)}>Publicar o primeiro talhão</Button>}>
          {plots.length === 0 ? "Publique um talhão para começar a receber investimentos." : "Escolha outro filtro para ver mais talhões."}
        </EmptyState>
      ) : (
        <div className="list">
          {filteredPlots.map((p) => (
            <PlotAdminCard key={p.id} plot={p} references={references} warehouses={warehouses} onChanged={load} setNotice={setNotice} setError={setError} />
          ))}
        </div>
      )}
    </Page>
  );
}

// A comissão só é salva quando a pessoa solta o controle (antes cada pixel
// arrastado disparava uma requisição e estourava o limite da API).
function CommissionCard({ farm, onSaved, onError }) {
  const [value, setValue] = useState(farm.commission_pct);
  const [saving, setSaving] = useState(false);
  const saved = useRef(farm.commission_pct);
  useEffect(() => { setValue(farm.commission_pct); saved.current = farm.commission_pct; }, [farm.commission_pct]);

  async function commit() {
    if (value === saved.current) return;
    setSaving(true);
    try {
      await api.setCommission(farm.id, value);
      saved.current = value;
      onSaved(value);
    } catch (err) {
      setValue(saved.current);
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <label htmlFor="commission" className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Percent size={16} aria-hidden /> Sua comissão sobre o lucro de cada colheita
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <input
          id="commission" type="range" min={0} max={30} step={0.5} value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={commit} onKeyUp={commit} onBlur={commit}
          aria-valuetext={`${value}%`} style={{ flex: 1 }}
        />
        <span className="stat-value text-success" style={{ marginTop: 0, minWidth: 64, textAlign: "right" }}>{value}%</span>
      </div>
      <p className="card-desc" style={{ display: "flex", gap: 6 }}>
        <Info size={14} aria-hidden style={{ flexShrink: 0, marginTop: 3 }} />
        {saving ? "Salvando…" : "Comissão menor significa repasse maior ao investidor, o que atrai mais investimento."}
      </p>
    </section>
  );
}

function NewPlotForm({ farmId, references, fasePricing, warehouses = [], onCreated, setError }) {
  const [warehouseId, setWarehouseId] = useState("");
  const uid = useId();
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
      await api.createPlot({ farm_id: farmId, ...form, preco_venda_estimado: precoVenda, cotas_totais: cotasTotais, unidade, warehouse_id: warehouseId ? Number(warehouseId) : null });
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
    <form onSubmit={submit} className="form-grid">
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label htmlFor={`f1-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select id={`f1-${uid}`} value={form.grao} onChange={(e) => update("grao", e.target.value)} className="select">
          {GRAINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Safra (ex: 2026/27)" value={form.safra} onChange={(v) => update("safra", v)} required />

      <div style={{ background: COLORS.bg, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <Info size={13} /> Calculado com base na referência de mercado — pode ajustar se souber a produtividade real do seu talhão.
          </p>
          <button type="button" onClick={() => setManual((m) => !m)} className="btn btn--ghost btn--sm">
            {manual ? "usar cálculo automático" : "editar manualmente"}
          </button>
        </div>
        <div className="form-grid">
          <Field
            label={`Preço estimado de venda por ${UNIT_LABEL[unidade]} na colheita (R$)`}
            type="number" value={precoVenda}
            onChange={setPrecoVenda}
            required
            readOnly={!manual}
          />
          <Field
            label={`Total de ${unitPlural(unidade, 2)} previstas`}
            type="number" value={cotasTotais}
            onChange={setCotasTotais}
            required
            readOnly={!manual}
          />
        </div>
        {producaoTotal > 0 && (
          <p style={{ fontSize: 12, color: COLORS.soil, margin: 0 }}>
            Produção estimada: <strong>{producaoTotal.toLocaleString("pt-BR")} {unitPlural(unidade, producaoTotal)}</strong> · Preço inicial (fase 0): <strong>{fmtBRL(precoInicial)}</strong>/{UNIT_LABEL[unidade]} · Captação inicial: <strong>{fmtBRL(captacaoTotal)}</strong>
          </p>
        )}
      </div>

      <Field label="Retorno estimado ao investidor (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div className="span-all">
        <WarehousePicker warehouses={warehouses} value={warehouseId} onChange={setWarehouseId} />
      </div>
      <div className="span-all">
        <button type="submit" disabled={saving} className="btn btn--primary">
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

const MAX_PLOT_PHOTOS = 6;

function PlotAdminCard({ plot, references, warehouses = [], onChanged, setNotice, setError }) {
  const uid = useId();
  const dialog = useDialog();
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

  const [fotos, setFotos] = useState([]);
  const [fotosLoaded, setFotosLoaded] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!expanded || fotosLoaded) return;
    api.getPlot(plot.id)
      .then((data) => { setFotos(data.fotos || []); setFotosLoaded(true); })
      .catch(() => setFotosLoaded(true));
  }, [expanded, fotosLoaded, plot.id]);

  async function handleAddPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const dataUrl = await readImageFile(file);
      const { photo } = await api.addPlotPhoto(plot.id, dataUrl);
      setFotos((f) => [...f, photo]);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId) {
    setPhotoError("");
    try {
      await api.deletePlotPhoto(plot.id, photoId);
      setFotos((f) => f.filter((p) => p.id !== photoId));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

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
      await api.finalizeHarvest(plot.id, retornoFinal, comprovanteTexto, comprovanteImagem);
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
      ? "O histórico de pagamento dos investidores continua preservado, mas o talhão sai da sua lista de gestão."
      : `Como nenhuma cota foi vendida, ${plot.nome} será removido definitivamente.`;
    if (!(await dialog.confirm({ title: `Excluir ${plot.nome}?`, message: aviso, confirmLabel: "Excluir", destructive: true }))) return;
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
    <div className="card" style={{ padding: 0 }}>
      <button
        type="button"
        className="list-item"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={`plot-${plot.id}-panel`}
        style={{ border: "none", background: "transparent", borderRadius: "var(--r-lg)" }}
      >
        <GrainThumb grao={plot.grao} />
        <span className="list-item-body">
          <span className="list-item-title truncate" style={{ display: "block" }}>{plot.nome} · {plot.grao}</span>
          <span className="list-item-sub" style={{ display: "block" }}>
            {(plot.cotas_totais - plot.cotas_disponiveis).toLocaleString("pt-BR")} de {plot.cotas_totais.toLocaleString("pt-BR")} {unitPlural(plot.unidade, plot.cotas_totais)} vendidas · {fmtBRL((plot.cotas_totais - plot.cotas_disponiveis) * plot.cota_valor)}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}><Badge tone={plot.status === "pago" ? "success" : plot.status === "arquivado" ? undefined : plot.status === "aguardando_aprovacao" ? "warning" : "info"}>
            {STATUS_LABEL[plot.status] || plot.status}
          </Badge>{" "}<CustodyStatusBadge status={plot.warehouse_id ? plot.custodia_status : null} /></span>
        </span>
        <span className="list-item-meta">
          {expanded ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
        </span>
      </button>
      <div id={`plot-${plot.id}-panel`} style={{ padding: expanded ? "0 16px 16px" : 0 }}>

      {expanded && (
        <>
          <CustodySection plot={plot} warehouses={warehouses} onChanged={onChanged} setNotice={setNotice} setError={setError} />
          <div style={{ marginTop: 14 }}><ProgressBar value={progresso} color={color} /></div>

          <div style={{ marginTop: 14 }}>
            <label htmlFor={`f2-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight, display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
              <ImageIcon size={13} /> Fotos do talhão ({fotos.length}/{MAX_PLOT_PHOTOS})
            </label>
            <input id={`f2-${uid}`} ref={photoInputRef} type="file" accept="image/*" onChange={handleAddPhoto} style={{ display: "none" }} />
            <PhotoGallery
              photos={fotos}
              onDelete={handleDeletePhoto}
              onAdd={() => photoInputRef.current?.click()}
              adding={uploadingPhoto}
              maxReached={fotos.length >= MAX_PLOT_PHOTOS}
              emptyLabel="Nenhuma foto deste talhão ainda."
            />
            {photoError && <p style={{ fontSize: 12, color: COLORS.danger, margin: "6px 0 0" }}>{photoError}</p>}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 10 }}>
            {finalizado && (
              <button onClick={() => setShowEdit((s) => !s)} disabled={saving} className="btn btn--ghost btn--sm" style={{ color: "var(--text-2)" }}>
                <Pencil size={14} /> Editar
              </button>
            )}
            {finalizado && (
              <button onClick={() => setShowRestart((s) => !s)} disabled={saving} className="btn btn--ghost btn--sm" style={{ color: "var(--success-text)" }}>
                <RotateCcw size={14} /> Reiniciar
              </button>
            )}
            {podeExcluir && (
              <button onClick={handleDelete} disabled={saving} className="btn btn--danger-ghost btn--sm">
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </div>

          {!finalizado && !aguardandoAprovacao ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14, alignItems: "flex-end" }}>
          <div>
            <label htmlFor={`f3-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight }}>Fase atual</label>
            <select id={`f3-${uid}`} value={fase} onChange={(e) => setFase(Number(e.target.value))} className="select" style={{ marginTop: 4 }}>
              {FASES.map((f, i) => <option key={f} value={i}>{f}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`f4-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight }}>Progresso (%)</label>
            <input id={`f4-${uid}`} type="number" min={0} max={100} value={progresso} onChange={(e) => setProgresso(Number(e.target.value))} className="input" inputMode="numeric" style={{ marginTop: 4, width: 110 }} />
          </div>
          <button onClick={saveProgress} disabled={saving} className="btn btn--secondary">
            Salvar andamento
          </button>

          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setShowFinalizeForm((s) => !s)}
              disabled={saving || plot.fase_atual !== FASES.length - 1}
              title={plot.fase_atual !== FASES.length - 1 ? `Atualize e salve a fase para "${FASES[FASES.length - 1]}" antes de finalizar` : ""}
              className="btn btn--primary"
            >
              Solicitar finalização da colheita
            </button>
            {plot.fase_atual !== FASES.length - 1 && (
              <p style={{ fontSize: 12, color: COLORS.orangeDark, margin: "6px 0 0", maxWidth: 240, textAlign: "right" }}>
                Mude a fase para "{FASES[FASES.length - 1]}" e clique em "Salvar andamento" para liberar a solicitação.
              </p>
            )}
          </div>

          {showFinalizeForm && (
            <form onSubmit={submitFinalize} style={{ width: "100%", background: COLORS.bg, borderRadius: 10, padding: 16, marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: COLORS.soil, margin: 0, fontWeight: 600 }}>Solicitar finalização e pagamento</p>
              <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0, lineHeight: 1.5 }}>
                O pagamento só é liberado depois que a administração revisar o comprovante. Isso protege os investidores contra informações incorretas.
              </p>
              <div>
                <label htmlFor={`f5-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight }}>Retorno final da safra (%)</label>
                <input id={`f5-${uid}`} type="number" required value={retornoFinal} onChange={(e) => setRetornoFinal(Number(e.target.value))} className="input" inputMode="decimal" style={{ marginTop: 4, width: 140 }} />
              </div>
              <div>
                <label htmlFor={`f6-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight }}>Comprovante (nota fiscal, comprador, silo, etc.) — mínimo 15 caracteres</label>
                <textarea id={`f6-${uid}`} required minLength={15} rows={3} value={comprovanteTexto} onChange={(e) => setComprovanteTexto(e.target.value)}
                  placeholder="Ex: Nota fiscal nº 12345, venda para Cargill em 20/09, 6.480 sacas entregues no armazém X."
                  className="textarea" style={{ marginTop: 4 }} />
              </div>
              <div>
                <label htmlFor={`f7-${uid}`} style={{ fontSize: 12.5, color: COLORS.soilLight }}>Foto do comprovante (opcional)</label>
                <input id={`f7-${uid}`} type="file" accept="image/*" onChange={handleComprovanteImagem} style={{ marginTop: 4, fontSize: 12 }} />
                {comprovanteImagem && <img src={comprovanteImagem} alt="" style={{ marginTop: 8, maxWidth: 160, borderRadius: 8 }} />}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setShowFinalizeForm(false)} className="btn btn--secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn--primary" style={{ flex: 2 }}>
                  {saving ? "Enviando..." : "Enviar solicitação"}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : aguardandoAprovacao ? (
        <div style={{ background: "#FBF3E1", border: "1px solid #E8C97A", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
          <p style={{ fontSize: 12.5, color: COLORS.soil, margin: 0, fontWeight: 600 }}>Aguardando aprovação da administração</p>
          <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "4px 0 0" }}>
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
    </div>
  );
}

function EditPlotForm({ plot, onDone, setError }) {
  const uid = useId();
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
    <form onSubmit={submit} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}`, }} className="form-grid">
      <p className="span-all text-sm text-2">
        Corrigir informações deste talhão, sem reabrir para novos investimentos.
      </p>
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label htmlFor={`f8-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select id={`f8-${uid}`} value={form.grao} onChange={(e) => update("grao", e.target.value)} className="select">
          {GRAINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Safra" value={form.safra} onChange={(v) => update("safra", v)} required />
      <Field label="Retorno estimado (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div className="span-all">
        <button type="submit" disabled={saving} className="btn btn--secondary">
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function RestartPlotForm({ plot, references, onDone, setError }) {
  const uid = useId();
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
    <form onSubmit={submit} style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.line}`, }} className="form-grid">
      <p className="span-all text-sm text-2">
        Reiniciar este talhão para um novo ciclo de investimento, com uma nova commodity se quiser.
      </p>
      <Field label="Nome do talhão" value={form.nome} onChange={(v) => update("nome", v)} required />
      <div>
        <label htmlFor={`f9-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Grão</label>
        <select id={`f9-${uid}`} value={form.grao} onChange={(e) => update("grao", e.target.value)} className="select">
          {GRAINS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <Field label="Área (hectares)" type="number" value={form.area_ha} onChange={(v) => update("area_ha", v)} required />
      <Field label="Nova safra (ex: 2027/28)" value={form.safra} onChange={(v) => update("safra", v)} required />

      <div style={{ background: COLORS.bg, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0 }}>Calculado com base na referência de mercado.</p>
          <button type="button" onClick={() => setManual((m) => !m)} className="btn btn--ghost btn--sm">
            {manual ? "usar cálculo automático" : "editar manualmente"}
          </button>
        </div>
        <div className="form-grid">
          <Field label={`Preço estimado de venda por ${UNIT_LABEL[unidade]} na colheita (R$)`} type="number" value={precoVenda} onChange={setPrecoVenda} required readOnly={!manual} />
          <Field label={`Total de ${unitPlural(unidade, 2)} previstas`} type="number" value={cotasTotais} onChange={setCotasTotais} required readOnly={!manual} />
        </div>
      </div>

      <Field label="Retorno estimado ao investidor (%)" type="number" value={form.previsao_retorno} onChange={(v) => update("previsao_retorno", v)} required />
      <div className="span-all">
        <button type="submit" disabled={saving} className="btn btn--success">
          {saving ? "Reiniciando..." : "Reiniciar talhão com esses dados"}
        </button>
      </div>
    </form>
  );
}

// Armazém garantidor: obrigatório quando há armazéns credenciados
function WarehousePicker({ warehouses, value, onChange, label = "Armazém garantidor" }) {
  if (warehouses.length === 0) {
    return <p className="text-sm text-2">Ainda não há armazéns credenciados. O talhão será publicado sem garantidor e você poderá indicar um depois.</p>;
  }
  return (
    <SelectField label={label} value={value} onChange={onChange} required
      hint="O armazém valida plantio, colheita e armazenagem. Para o investidor, é a garantia de que a commodity existe.">
      <option value="">Escolha o armazém</option>
      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.location}</option>)}
    </SelectField>
  );
}

function CustodySection({ plot, warehouses, onChanged, setNotice, setError }) {
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const validacoes = typeof plot.validacoes === "string" ? JSON.parse(plot.validacoes) : plot.validacoes || [];
  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  const podeIndicar = plot.custodia_status !== "aceita" && !["pago", "arquivado"].includes(plot.status);

  async function indicar() {
    if (!choice) return;
    setSaving(true);
    try {
      await api.setPlotWarehouse(plot.id, Number(choice));
      setNotice("Armazém indicado. Ele vai receber o pedido de custódia.");
      setChoice("");
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card card--well" style={{ marginTop: 4, padding: 16 }} aria-label="Armazém garantidor">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <p className="card-title" style={{ display: "flex", gap: 6, alignItems: "center" }}><Warehouse size={16} aria-hidden /> {plot.warehouse_name || "Armazém garantidor"}</p>
        <CustodyStatusBadge status={plot.warehouse_id ? plot.custodia_status : null} />
      </div>
      {plot.custodia_status === "recusada" && plot.custodia_motivo && <p className="text-sm text-danger" style={{ marginBottom: 10 }}>Motivo da recusa: {plot.custodia_motivo}</p>}
      {plot.custodia_status === "pendente" && <p className="text-sm text-2" style={{ marginBottom: 10 }}>O armazém ainda não respondeu. Investidores veem que a garantia está em análise.</p>}
      {plot.custodia_status === "aceita" && (
        <CustodyTimeline validacoes={validacoes} unidade={plot.unidade} declared={plot.cotas_totais} sold={vendidas} />
      )}
      {podeIndicar && warehouses.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginTop: 8 }}>
          <div style={{ flex: "1 1 220px" }}>
            <WarehousePicker warehouses={warehouses.filter((w) => w.id !== plot.warehouse_id || plot.custodia_status !== "pendente")} value={choice} onChange={setChoice}
              label={plot.warehouse_id ? "Trocar armazém" : "Indicar armazém"} />
          </div>
          <Button variant="secondary" onClick={indicar} loading={saving} disabled={!choice}>Enviar pedido</Button>
        </div>
      )}
    </section>
  );
}

// campos somente leitura ganham o visual de .input:read-only (tokens), sem estilo embutido
function Field({ label, value, onChange, type = "text", required, readOnly }) {
  return (
    <TextField label={label} type={type} required={required} value={value} readOnly={readOnly} onChange={onChange}
      inputMode={type === "number" ? "decimal" : undefined} step={type === "number" ? "any" : undefined} />
  );
}


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

const MAX_FARM_PHOTOS = 8;

function FarmProfileEditor({ farmId, onClose, setNotice, setError }) {
  const uid = useId();
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [descricao, setDescricao] = useState("");
  const [premiacoes, setPremiacoes] = useState("");
  const [fotos, setFotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.farmCharacteristicsCatalog(), api.getFarmProfile(farmId)])
      .then(([catData, profileData]) => {
        setCatalog(catData.catalog);
        setDescricao(profileData.farm.descricao || "");
        setPremiacoes(profileData.farm.premiacoes || "");
        setSelected(profileData.caracteristicas.map((c) => c.key));
        setFotos(profileData.fotos || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [farmId, setError]);

  async function handleAddPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const dataUrl = await readImageFile(file);
      const { photo } = await api.addFarmPhoto(farmId, dataUrl);
      setFotos((f) => [...f, photo]);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId) {
    setPhotoError("");
    try {
      await api.deleteFarmPhoto(farmId, photoId);
      setFotos((f) => f.filter((p) => p.id !== photoId));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

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

  if (loading) return <Loading label="Carregando perfil…" />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>Perfil e destaques da fazenda</p>
        <StarRating value={estrelasPreview} />
      </div>
      <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
        Quanto mais itens de tecnologia e infraestrutura você marcar, maior sua nota em estrelas — isso aparece pros investidores na hora de escolher onde investir.
      </p>

      <label htmlFor={`f10-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Descrição da fazenda</label>
      <textarea id={`f10-${uid}`}
        value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={3000} rows={4}
        placeholder="Conte a história da fazenda, tipo de plantio, região, o que torna sua operação diferenciada..."
        className="textarea" style={{ marginTop: 5, marginBottom: 14 }}
      />

      <label htmlFor={`f11-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Prêmios e reconhecimentos</label>
      <textarea id={`f11-${uid}`}
        value={premiacoes} onChange={(e) => setPremiacoes(e.target.value)} maxLength={1500} rows={2}
        placeholder="Ex: Prêmio Produtor Sustentável 2024, certificação X, reconhecimento Y..."
        className="textarea" style={{ marginTop: 5, marginBottom: 18 }}
      />

      <label style={{ fontSize: 12, color: COLORS.soilLight, display: "flex", alignItems: "center", gap: 5 }}>
        <ImageIcon size={13} /> Fotos da fazenda ({fotos.length}/{MAX_FARM_PHOTOS})
      </label>
      <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "4px 0 8px", lineHeight: 1.5 }}>
        Fotos da propriedade que aparecem para o investidor em "Sobre a fazenda".
      </p>
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handleAddPhoto} style={{ display: "none" }} />
      <div style={{ marginBottom: 8 }}>
        <PhotoGallery
          photos={fotos}
          onDelete={handleDeletePhoto}
          onAdd={() => photoInputRef.current?.click()}
          adding={uploadingPhoto}
          maxReached={fotos.length >= MAX_FARM_PHOTOS}
        />
      </div>
      {photoError && <p style={{ fontSize: 12.5, color: COLORS.danger, margin: "0 0 14px" }}>{photoError}</p>}
      {!photoError && <div style={{ marginBottom: 18 }} />}

      {categorias.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.soilLight, textTransform: "uppercase", margin: "0 0 8px" }}>{cat}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {catalog.filter((c) => c.categoria === cat).map((c) => (
              <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.soil, cursor: "pointer" }}>
                <input type="checkbox" checked={selected.includes(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
                <span style={{ fontSize: 12, color: COLORS.orange, fontWeight: 600 }}>+{c.pontos}pt</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" className="btn btn--secondary" onClick={onClose} style={{ flex: 1 }}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving} style={{ flex: 2 }}>
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

function FarmLegalInfoEditor({ farmId, onClose, setNotice, setError }) {
  const [tipoPessoa, setTipoPessoa] = useState("fisica");
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [carNumero, setCarNumero] = useState("");
  const [matricula, setMatricula] = useState("");
  const [areaTotal, setAreaTotal] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getFarmLegalInfo(farmId)
      .then((data) => {
        const info = data.legalInfo;
        if (!info) return;
        setTipoPessoa(info.tipo_pessoa || "fisica");
        if (info.cnpj) setCnpj(maskCNPJ(info.cnpj));
        setRazaoSocial(info.razao_social || "");
        setCarNumero(info.car_numero || "");
        setMatricula(info.matricula_imovel || "");
        setAreaTotal(info.area_total_ha != null ? String(info.area_total_ha) : "");
        if (info.endereco_cep) setCep(maskCEP(info.endereco_cep));
        setLogradouro(info.endereco_logradouro || "");
        setNumero(info.endereco_numero || "");
        setComplemento(info.endereco_complemento || "");
        setBairro(info.endereco_bairro || "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [farmId, setError]);

  async function handleCepChange(value) {
    const masked = maskCEP(value);
    setCep(masked);
    if (onlyDigits(masked).length === 8) {
      setBuscandoCep(true);
      try {
        const endereco = await buscarEnderecoPorCEP(masked);
        if (endereco) {
          setLogradouro(endereco.logradouro);
          setBairro(endereco.bairro);
        }
      } catch {
        // segue permitindo preenchimento manual
      } finally {
        setBuscandoCep(false);
      }
    }
  }

  async function save() {
    if (tipoPessoa === "juridica" && !isValidCNPJ(cnpj)) {
      setError("CNPJ inválido. Confira os números digitados.");
      return;
    }
    setSaving(true);
    try {
      await api.updateFarmLegalInfo(farmId, {
        tipo_pessoa: tipoPessoa,
        cnpj: tipoPessoa === "juridica" ? onlyDigits(cnpj) : null,
        razao_social: tipoPessoa === "juridica" ? razaoSocial : null,
        car_numero: carNumero, matricula_imovel: matricula,
        area_total_ha: areaTotal ? Number(areaTotal) : null,
        endereco_cep: onlyDigits(cep), endereco_logradouro: logradouro, endereco_numero: numero,
        endereco_complemento: complemento, endereco_bairro: bairro,
      });
      setNotice("Dados legais da propriedade atualizados.");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: "0 0 4px" }}>Dados legais da propriedade</p>
      <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
        Usados para compor contratos futuros. O CNPJ e a razão social (quando pessoa jurídica) aparecem no perfil público como selo de confiança; os demais dados ficam sempre privados.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[{ id: "fisica", label: "Produtor pessoa física (CPF)" }, { id: "juridica", label: "Empresa (CNPJ)" }].map((opt) => (
          <button key={opt.id} type="button" onClick={() => setTipoPessoa(opt.id)} style={{
            flex: 1, padding: "9px 0", borderRadius: 9, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
            border: `1px solid ${tipoPessoa === opt.id ? COLORS.leaf : COLORS.line}`,
            background: tipoPessoa === opt.id ? COLORS.leaf : "#fff",
            color: tipoPessoa === opt.id ? "#fff" : COLORS.soilLight,
          }}>{opt.label}</button>
        ))}
      </div>

      {tipoPessoa === "juridica" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <Field label="CNPJ" value={cnpj} onChange={(v) => setCnpj(maskCNPJ(v))} required style={{ width: 200 }} />
          <div style={{ flex: 1 }}><Field label="Razão social" value={razaoSocial} onChange={setRazaoSocial} required /></div>
        </div>
      )}
      {tipoPessoa === "fisica" && (
        <p style={{ fontSize: 12.5, color: COLORS.soilLight, marginBottom: 12 }}>
          O CPF do produtor já está cadastrado na aba "Documentos" do perfil pessoal.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}><Field label="CAR (Cadastro Ambiental Rural)" value={carNumero} onChange={setCarNumero} placeholder="Opcional" /></div>
        <div style={{ flex: 1 }}><Field label="Matrícula do imóvel" value={matricula} onChange={setMatricula} placeholder="Opcional" /></div>
        <Field label="Área total (ha)" type="number" value={areaTotal} onChange={setAreaTotal} placeholder="Opcional" style={{ width: 140 }} />
      </div>

      <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.soil, margin: "8px 0 8px" }}>Endereço da propriedade</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <Field label={buscandoCep ? "CEP (buscando...)" : "CEP"} value={cep} onChange={handleCepChange} placeholder="00000-000" required style={{ width: 140 }} />
        <div style={{ flex: 1 }}><Field label="Logradouro / estrada / rodovia" value={logradouro} onChange={setLogradouro} required /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Field label="Número / km" value={numero} onChange={setNumero} required style={{ width: 120 }} />
        <div style={{ flex: 1 }}><Field label="Complemento" value={complemento} onChange={setComplemento} placeholder="Opcional" /></div>
        <div style={{ flex: 1 }}><Field label="Bairro / zona rural" value={bairro} onChange={setBairro} required /></div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn--secondary" onClick={onClose} style={{ flex: 1 }}>
          Cancelar
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving} style={{ flex: 2 }}>
          {saving ? "Salvando..." : "Salvar dados legais"}
        </button>
      </div>
    </div>
  );
}
