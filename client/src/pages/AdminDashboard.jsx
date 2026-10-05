import { useCallback, useEffect, useRef, useState, useId } from "react";
import { Coins, Percent, Warehouse, Building2, Users, Clock, Receipt, ArrowDownCircle, ArrowUpCircle, TrendingUp, LayoutGrid, Wheat, ClipboardCheck, Check, X, FileText, Star } from "lucide-react";
import { COLORS, GRAIN_ICONS, UNIT_LABEL, FASES } from "../config/theme";
import { fmtBRL } from "../lib/format";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, ErrorBanner, Tabs, SelectField, EmptyState, Badge, useDialog, useToast } from "../components/ui";

const TYPE_LABEL = {
  compra_cota: "Compra de cota",
  pagamento_investidor: "Pagamento a investidor",
  repasse_fazenda: "Repasse à fazenda",
  comissao_plataforma: "Comissão da plataforma",
};

const TABS = [
  { id: "geral", label: "Visão geral", icon: LayoutGrid },
  { id: "colheitas", label: "Colheitas", icon: ClipboardCheck },
  { id: "fazendas", label: "Fazendas", icon: Building2 },
  { id: "fases", label: "Preço por fase", icon: TrendingUp },
  { id: "mercado", label: "Referência de mercado", icon: Wheat },
  { id: "destaques", label: "Destaques da fazenda", icon: Star },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("geral");
  const [overview, setOverview] = useState(null);
  const [farms, setFarms] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({});
  const [typeFilter, setTypeFilter] = useState("");
  const [appCommission, setAppCommission] = useState(null);
  const [references, setReferences] = useState([]);
  const [fasePricing, setFasePricing] = useState({});
  const [harvestRequests, setHarvestRequests] = useState([]);
  const [characteristics, setCharacteristics] = useState([]);
  const [error, setError] = useState("");
  const dialog = useDialog();
  const toast = useToast();
  const setNotice = useCallback((msg) => { if (msg) toast(msg); }, [toast]);

  const load = useCallback(() => {
    api.overview().then(setOverview).catch((err) => setError(err.message));
    api.adminFarms().then((data) => setFarms(data.farms)).catch((err) => setError(err.message));
    api.platformSettings().then((data) => { setAppCommission(data.app_commission_pct); savedCommission.current = data.app_commission_pct; }).catch((err) => setError(err.message));
    api.commodityReferences().then((data) => setReferences(data.references)).catch((err) => setError(err.message));
    api.fasePricing().then((data) => setFasePricing(data.multiplicadores)).catch((err) => setError(err.message));
    api.pendingHarvestRequests("pendente").then((data) => setHarvestRequests(data.requests)).catch((err) => setError(err.message));
    api.farmCharacteristicsCatalog().then((data) => setCharacteristics(data.catalog)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.adminTransactions(typeFilter || undefined)
      .then((data) => { setTransactions(data.transactions); setTotals(data.totals); })
      .catch((err) => setError(err.message));
  }, [typeFilter]);


  async function setStatus(id, status) {
    if (status === "suspensa") {
      const ok = await dialog.confirm({ title: "Suspender fazenda?", message: "Ela deixa de aparecer na vitrine e não pode publicar novos talhões até ser aprovada de novo.", confirmLabel: "Suspender", destructive: true });
      if (!ok) return;
    }
    try {
      await api.setFarmStatus(id, status);
      setNotice(status === "aprovada" ? "Fazenda aprovada." : "Fazenda suspensa.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // salva só ao soltar o controle (antes cada movimento disparava uma requisição)
  const savedCommission = useRef(null);
  async function commitAppCommission() {
    if (appCommission == null || appCommission === savedCommission.current) return;
    try {
      await api.updatePlatformSettings(appCommission);
      savedCommission.current = appCommission;
      toast(`Comissão da plataforma: ${appCommission}%`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveReference(grao, payload) {
    try {
      const data = await api.updateCommodityReference(grao, payload);
      setReferences((refs) => refs.map((r) => (r.grao === grao ? data.reference : r)));
      setNotice(`Referência de ${grao} atualizada.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveFaseMultiplier(fase, multiplicador) {
    try {
      await api.updateFasePricing(fase, multiplicador);
      setFasePricing((f) => ({ ...f, [fase]: multiplicador }));
      setNotice(`Multiplicador da fase "${FASES[fase]}" atualizado.`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function approveHarvest(id) {
    const ok = await dialog.confirm({ title: "Aprovar e pagar?", message: "Os investidores serão pagos imediatamente. Esta ação não pode ser desfeita.", confirmLabel: "Aprovar e pagar" });
    if (!ok) return;
    try {
      const data = await api.approveHarvestRequest(id);
      setNotice(`Colheita aprovada e paga: ${data.investidoresPagos} investidor(es).`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rejectHarvest(id) {
    const motivo = await dialog.prompt({ title: "Rejeitar solicitação", message: "A fazenda recebe este texto e pode reenviar a solicitação corrigida.", label: "Motivo da rejeição", required: true, minLength: 5, confirmLabel: "Rejeitar", destructive: true });
    if (!motivo) return;
    try {
      await api.rejectHarvestRequest(id, motivo);
      setNotice("Solicitação rejeitada. A fazenda foi avisada.");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveCharacteristicPoints(key, pontos) {
    try {
      await api.updateFarmCharacteristicPoints(key, pontos);
      setCharacteristics((list) => list.map((c) => (c.key === key ? { ...c, pontos } : c)));
      setNotice("Pontuação atualizada.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Page title="Administração" width="medium">
      <PageHeader title="Administração" subtitle="Visão geral da plataforma, fazendas, colheitas e transações." />

      <Tabs
        label="Seções da administração"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: t.id === "colheitas" ? harvestRequests.length : 0 }))}
      />

      <ErrorBanner message={error} />

      {tab === "geral" && (
        <>
          {overview && (
            <div className="grid-stats" style={{ marginBottom: 22 }}>
              <Stat label="Total captado" value={fmtBRL(overview.totalCaptado)} icon={Coins} />
              <Stat label="Comissão do app acumulada" value={fmtBRL(overview.comissaoAppAcumulada)} icon={Percent} />
              <Stat label="Talhões ativos" value={overview.talhoesAtivos} icon={Warehouse} />
              <Stat label="Fazendas aprovadas" value={overview.fazendasAtivas} icon={Building2} />
              <Stat label="Fazendas pendentes" value={overview.fazendasPendentes} icon={Clock} />
              <Stat label="Investidores" value={overview.investidores} icon={Users} />
            </div>
          )}

          {appCommission != null && (
            <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, marginBottom: 22 }}>
              <label style={{ fontSize: 12, color: COLORS.soilLight, display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                <Percent size={12} /> comissão da Meu Talhão sobre o lucro de cada colheita
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="range" min={0} max={30} step={0.5} value={appCommission} onChange={(e) => setAppCommission(Number(e.target.value))} onPointerUp={commitAppCommission} onKeyUp={commitAppCommission} onBlur={commitAppCommission} aria-valuetext={`${appCommission}%`} style={{ flex: 1 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: COLORS.leaf, minWidth: 40 }}>{appCommission}%</span>
              </div>
              <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "8px 0 0" }}>
                Aplicada automaticamente sobre o lucro de toda colheita finalizada, além da comissão que cada fazenda define para si.
              </p>
            </div>
          )}

          <p style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
            <Receipt size={15} /> Transações
          </p>
          <SelectField label="Tipo de transação" value={typeFilter} onChange={setTypeFilter} style={{ marginBottom: 14, maxWidth: 360 }}
            options={[{ value: "", label: "Todos os tipos" }, { value: "compra_cota", label: "Compras" }, { value: "pagamento_investidor", label: "Pagamentos a investidores" }, { value: "repasse_fazenda", label: "Repasses a fazendas" }, { value: "comissao_plataforma", label: "Comissão da plataforma" }]} />

          <div className="grid-stats" style={{ marginBottom: 16 }}>
            {Object.entries(totals).map(([type, t]) => (
              <div key={type} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12 }}>
                <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "0 0 4px" }}>{TYPE_LABEL[type] || type}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.soil, margin: 0, fontFamily: "'Baloo 2', cursive" }}>{fmtBRL(t.total)}</p>
                <p style={{ fontSize: 12, color: COLORS.clay, margin: 0 }}>{t.count} transação(ões)</p>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {transactions.map((t) => {
              const isIncoming = t.type === "compra_cota";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "10px 12px", flexWrap: "wrap" }}>
                  {isIncoming ? <ArrowDownCircle size={18} color={COLORS.leaf} /> : <ArrowUpCircle size={18} color={COLORS.orange} />}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: COLORS.soil, margin: 0 }}>
                      {TYPE_LABEL[t.type] || t.type} {t.user_name ? `· ${t.user_name}` : ""}
                    </p>
                    <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "2px 0 0" }}>{t.description}</p>
                  </div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.soil, margin: 0, whiteSpace: "nowrap" }}>{fmtBRL(t.amount)}</p>
                </div>
              );
            })}
            {transactions.length === 0 && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhuma transação registrada ainda.</p>}
          </div>
        </>
      )}

      {tab === "colheitas" && (
        <div>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
            Solicitações de finalização de colheita enviadas pelas fazendas. Confira o comprovante antes de aprovar — a aprovação paga os investidores imediatamente e não pode ser desfeita.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {harvestRequests.map((r) => (
              <div key={r.id} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <img src={GRAIN_ICONS[r.grao]} alt="" style={{ width: 30, height: 30, objectFit: "contain", background: COLORS.bg, borderRadius: 8, padding: 4 }} />
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil, margin: 0 }}>{r.plot_nome} · {r.farm_name}</p>
                    <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "2px 0 0" }}>{r.farm_location} · solicitado por {r.solicitado_por || "—"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 12, color: COLORS.soilLight, margin: 0 }}>prometido {r.previsao_retorno}% · declarado</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: r.retorno_final >= r.previsao_retorno ? COLORS.leaf : COLORS.danger, margin: 0, fontFamily: "'Baloo 2', cursive" }}>
                      {r.retorno_final}%
                    </p>
                  </div>
                </div>

                <div style={{ background: COLORS.bg, borderRadius: 10, padding: 12, display: "flex", gap: 10, marginBottom: 12 }}>
                  <FileText size={16} color={COLORS.soilLight} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, color: COLORS.soil, margin: 0, whiteSpace: "pre-wrap" }}>{r.comprovante_texto}</p>
                    {r.comprovante_imagem && (
                      <img src={r.comprovante_imagem} alt="comprovante" style={{ marginTop: 8, maxWidth: 200, borderRadius: 8, display: "block" }} />
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="danger-ghost" icon={X} onClick={() => rejectHarvest(r.id)} style={{ flex: 1, border: "1px solid var(--danger)" }}>Rejeitar</Button>
                  <Button variant="success" icon={Check} onClick={() => approveHarvest(r.id)} style={{ flex: 2 }}>Aprovar e pagar</Button>
                </div>
              </div>
            ))}
            {harvestRequests.length === 0 && (
              <EmptyState image="/icons/icon_talhoes_colhendo_meu_talhao.svg" title="Nenhuma colheita aguardando">Quando uma fazenda pedir a finalização, a solicitação aparece aqui.</EmptyState>
            )}
          </div>
        </div>
      )}

      {tab === "fazendas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {farms.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontWeight: 500, fontSize: 14, color: COLORS.soil, margin: 0 }}>{f.name}</p>
                <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "2px 0 0" }}>{f.location} · comissão {f.commission_pct}%</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusBadge status={f.status} />
                {f.status !== "aprovada" && (
                  <Button size="sm" variant="success" onClick={() => setStatus(f.id, "aprovada")}>Aprovar</Button>
                )}
                {f.status !== "suspensa" && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus(f.id, "suspensa")}>Suspender</Button>
                )}
              </div>
            </div>
          ))}
          {farms.length === 0 && <p style={{ fontSize: 13, color: COLORS.soilLight }}>Nenhuma fazenda cadastrada ainda.</p>}
        </div>
      )}

      {tab === "fases" && (
        <div>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
            Multiplicador aplicado sobre o preço estimado de venda conforme a fase atual do talhão. 1.00 = preço cheio de venda; valores menores dão desconto a quem compra mais cedo. Cuidado: multiplicadores muito altos na última fase podem deixar quem compra por último no prejuízo mesmo em colheitas normais.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2, 3, 4].map((fase) => (
              <FasePricingRow key={fase} fase={fase} label={FASES[fase]} multiplicador={fasePricing[fase]} onSave={saveFaseMultiplier} />
            ))}
          </div>
        </div>
      )}

      {tab === "destaques" && (
        <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20 }}>
          <p style={{ fontSize: 12.5, color: COLORS.soil, fontWeight: 600, margin: "0 0 4px" }}>Catálogo de destaques da fazenda</p>
          <p style={{ fontSize: 12.5, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
            Cada item que a fazenda marca no perfil dela vale esses pontos. A nota em estrelas exibida ao investidor é a soma dos pontos marcados dividida pelo total possível deste catálogo. Ajuste os pesos conforme o que for mais relevante para a plataforma.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {characteristics.map((c) => (
              <CharacteristicRow key={c.key} item={c} onSave={saveCharacteristicPoints} />
            ))}
          </div>
        </div>
      )}

      {tab === "mercado" && (
        <div>
          <p style={{ fontSize: 12, color: COLORS.soilLight, margin: "0 0 16px", lineHeight: 1.5 }}>
            Usada para calcular automaticamente o preço por unidade e a quantidade disponível ao publicar um talhão (área × produtividade estimada). Não é uma cotação em tempo real — atualize periodicamente conforme o mercado.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {references.map((ref) => (
              <CommodityReferenceRow key={ref.grao} reference={ref} onSave={saveReference} />
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

function FasePricingRow({ fase, label, multiplicador, onSave }) {
  const [value, setValue] = useState(String(multiplicador ?? 1));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(String(multiplicador ?? 1)); }, [multiplicador]);

  const dirty = value !== String(multiplicador ?? 1);
  const percentual = value ? Math.round((Number(value) - 1) * 100) : 0;

  async function save() {
    setSaving(true);
    try {
      await onSave(fase, Number(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.soil }}>{label}</span>
        <span style={{ fontSize: 12, color: "#fff", background: percentual > 0 ? COLORS.orange : COLORS.leaf, borderRadius: 12, padding: "2px 9px", fontWeight: 600, whiteSpace: "nowrap" }}>
          {percentual >= 0 ? `+${percentual}%` : `${percentual}%`}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="number" step="0.01" min="1" max="3" value={value} onChange={(e) => setValue(e.target.value)} style={{
          flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 13, fontFamily: "inherit",
        }} />
        <button onClick={save} disabled={!dirty || saving} style={{
          flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 600,
          cursor: dirty ? "pointer" : "default", background: dirty ? COLORS.orange : COLORS.line, color: dirty ? "#fff" : COLORS.soilLight,
        }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function CharacteristicRow({ item, onSave }) {
  const [value, setValue] = useState(String(item.pontos));
  const [saving, setSaving] = useState(false);
  const dirty = value !== String(item.pontos);

  async function save() {
    setSaving(true);
    try {
      await onSave(item.key, Number(value));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${COLORS.line}`, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: COLORS.soilLight, minWidth: 130, textTransform: "uppercase", fontWeight: 700 }}>{item.categoria}</span>
      <span style={{ fontSize: 12.5, color: COLORS.soil, flex: 1, minWidth: 200 }}>{item.label}</span>
      <input type="number" min="0" max="10" value={value} onChange={(e) => setValue(e.target.value)} style={{
        width: 60, padding: "6px 8px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12.5, fontFamily: "inherit",
      }} />
      <span style={{ fontSize: 12, color: COLORS.soilLight }}>pts</span>
      <button onClick={save} disabled={!dirty || saving} style={{
        padding: "6px 12px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 600,
        cursor: dirty ? "pointer" : "default", background: dirty ? COLORS.orange : COLORS.line, color: dirty ? "#fff" : COLORS.soilLight,
      }}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

function CommodityReferenceRow({ reference, onSave }) {
  const uid = useId();
  const [unidade, setUnidade] = useState(reference.unidade);
  const [preco, setPreco] = useState(String(reference.preco_unidade));
  const [produtividade, setProdutividade] = useState(String(reference.produtividade_ha));
  const [saving, setSaving] = useState(false);
  const dirty = unidade !== reference.unidade || preco !== String(reference.preco_unidade) || produtividade !== String(reference.produtividade_ha);

  async function save() {
    setSaving(true);
    try {
      await onSave(reference.grao, { unidade, preco_unidade: Number(preco), produtividade_ha: Number(produtividade) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <img src={GRAIN_ICONS[reference.grao]} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.soil }}>{reference.grao}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: "1 1 90px" }}>
          <label htmlFor={`f1-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Unidade</label>
          <select id={`f1-${uid}`} value={unidade} onChange={(e) => setUnidade(e.target.value)} style={miniInputStyle}>
            <option value="saca">saca</option>
            <option value="fardo">fardo</option>
            <option value="arroba">arroba</option>
          </select>
        </div>
        <div style={{ flex: "1 1 110px" }}>
          <label htmlFor={`f2-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Preço (R$/{UNIT_LABEL[unidade]})</label>
          <input id={`f2-${uid}`} type="number" value={preco} onChange={(e) => setPreco(e.target.value)} style={miniInputStyle} />
        </div>
        <div style={{ flex: "1 1 130px" }}>
          <label htmlFor={`f3-${uid}`} style={{ fontSize: 12, color: COLORS.soilLight }}>Produtividade ({UNIT_LABEL[unidade]}/ha)</label>
          <input id={`f3-${uid}`} type="number" value={produtividade} onChange={(e) => setProdutividade(e.target.value)} style={miniInputStyle} />
        </div>
      </div>
      <button onClick={save} disabled={!dirty || saving} style={{
        width: "100%", padding: "9px 0", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 600, cursor: dirty ? "pointer" : "default",
        background: dirty ? COLORS.orange : COLORS.line, color: dirty ? "#fff" : COLORS.soilLight,
      }}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

const miniInputStyle = { width: "100%", marginTop: 3, padding: "7px 8px", borderRadius: 7, border: `1px solid ${COLORS.line}`, fontSize: 12.5, background: "#fff", fontFamily: "inherit" };

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="stat">
      <p className="stat-label"><Icon size={16} aria-hidden /> {label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = { aprovada: "success", pendente: "warning", suspensa: "danger" }[status] || "warning";
  return <Badge tone={tone}>{status}</Badge>;
}
