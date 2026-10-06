import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Warehouse, ShieldCheck, Check, X, ClipboardCheck, Inbox, PackageCheck, Pencil, Camera, MapPin } from "lucide-react";
import { FASES, ETAPAS_CUSTODIA, FASE_MINIMA_CUSTODIA } from "../config/theme";
import { fmtNumber, unitPlural } from "../lib/format";
import { maskCNPJ } from "../lib/validators";
import { readImageFile } from "../lib/files";
import { api } from "../lib/api";
import { Page, PageHeader } from "../components/layout/Page";
import { Button, Banner, ErrorBanner, Loading, EmptyState, Tabs, Dialog, Segmented, TextField, TextAreaField, ProgressBar, useDialog, useToast } from "../components/ui";
import { GrainThumb, CityStateSelect, CustodyTimeline, CustodyStatusBadge } from "../components/domain";
import { Stat } from "./Portfolio";

const TABS = [
  { id: "pedidos", label: "Pedidos", match: (p) => p.custodia_status === "pendente" },
  { id: "acompanhamento", label: "Em acompanhamento", match: (p) => p.custodia_status === "aceita" && p.status !== "pago" },
  { id: "concluidos", label: "Concluídos", match: (p) => p.custodia_status === "aceita" && p.status === "pago" },
  { id: "recusados", label: "Recusados", match: (p) => p.custodia_status === "recusada" },
];

export default function WarehouseDashboard() {
  const dialog = useDialog();
  const toast = useToast();
  const [warehouse, setWarehouse] = useState(null);
  const [plots, setPlots] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pedidos");
  const [validating, setValidating] = useState(null); // { plot, etapa }
  const [editing, setEditing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(() => {
    return api.myWarehouse()
      .then((data) => {
        setWarehouse(data.warehouse);
        setPlots(data.plots);
        // primeira abertura: vai direto para onde há trabalho
        if (firstLoad.current) {
          firstLoad.current = false;
          if (!data.plots.some(TABS[0].match) && data.plots.some(TABS[1].match)) setTab("acompanhamento");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(plot, decisao) {
    let motivo;
    if (decisao === "recusar") {
      motivo = await dialog.prompt({
        title: `Recusar ${plot.nome}?`,
        message: "A fazenda recebe o motivo e pode indicar outro armazém.",
        label: "Motivo da recusa", required: true, minLength: 5, confirmLabel: "Recusar custódia", destructive: true,
      });
      if (!motivo) return;
    } else {
      const ok = await dialog.confirm({
        title: `Aceitar a custódia de ${plot.nome}?`,
        message: `Seu armazém passa a ser o garantidor deste talhão para os investidores e deverá validar o plantio, a colheita e a armazenagem de ${fmtNumber(plot.cotas_totais)} ${unitPlural(plot.unidade, plot.cotas_totais)} declaradas.`,
        confirmLabel: "Aceitar custódia",
      });
      if (!ok) return;
    }
    try {
      await api.decideCustody(plot.id, decisao, motivo);
      toast(decisao === "aceitar" ? "Custódia aceita" : "Custódia recusada");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <Page title="Meu armazém" width="medium"><Loading /></Page>;
  if (!warehouse) return <Page title="Meu armazém" width="medium"><ErrorBanner message={error || "Armazém não encontrado."} /></Page>;

  const counts = Object.fromEntries(TABS.map((t) => [t.id, plots.filter(t.match).length]));
  const active = TABS.find((t) => t.id === tab) || TABS[0];
  const list = plots.filter(active.match);
  const aprovado = warehouse.status === "aprovado";

  return (
    <Page title="Meu armazém" width="medium">
      <PageHeader
        leading={<span className="thumb thumb--lg" style={{ background: "var(--success-soft)", color: "var(--success-text)" }}><Warehouse size={30} aria-hidden /></span>}
        title={warehouse.name}
        subtitle={`Armazém garantidor · ${warehouse.location} · CNPJ ${maskCNPJ(warehouse.cnpj)}`}
        actions={<Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Dados do armazém</Button>}
      />

      {warehouse.status === "pendente" && (
        <Banner tone="warning" title="Credenciamento em análise" style={{ marginBottom: 20 }}>
          A administração está conferindo os dados do armazém. Depois do credenciamento, as fazendas podem indicar você como garantidor.
        </Banner>
      )}
      {warehouse.status === "suspenso" && (
        <Banner tone="error" title="Armazém suspenso" style={{ marginBottom: 20 }}>
          Novas custódias e validações estão bloqueadas. Fale com a administração em Conversas.
        </Banner>
      )}
      <ErrorBanner message={error} />

      <div className="grid-stats" style={{ marginBottom: 24 }}>
        <Stat label="Pedidos de custódia" value={counts.pedidos} icon={Inbox} />
        <Stat label="Em acompanhamento" value={counts.acompanhamento} icon={ClipboardCheck} />
        <Stat label="Safras concluídas" value={counts.concluidos} icon={PackageCheck} tone="success" />
      </div>

      <Tabs label="Talhões do armazém" value={tab} onChange={setTab} tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))} />

      {list.length === 0 ? (
        <EmptyState image="/icons/icon_ponto_colheita_meu_talhao.svg" title={{
          pedidos: "Nenhum pedido de custódia", acompanhamento: "Nenhum talhão em acompanhamento",
          concluidos: "Nenhuma safra concluída ainda", recusados: "Nenhuma custódia recusada",
        }[tab]}>
          {tab === "pedidos" ? (aprovado ? "Quando uma fazenda indicar seu armazém como garantidor de um talhão, o pedido aparece aqui." : "Os pedidos chegam depois do credenciamento.") : null}
        </EmptyState>
      ) : (
        <div className="stack">
          {list.map((p) => (
            <WarehousePlotCard key={p.id} plot={p} canAct={aprovado} onDecide={decide} onValidate={(etapa) => setValidating({ plot: p, etapa })} />
          ))}
        </div>
      )}

      <ValidationDialog
        target={validating}
        onClose={() => setValidating(null)}
        onSaved={() => { setValidating(null); toast("Validação registrada"); load(); }}
      />
      <WarehouseEditDialog open={editing} warehouse={warehouse} onClose={() => setEditing(false)} onSaved={(w) => { setWarehouse(w); setEditing(false); toast("Dados do armazém salvos"); }} />
    </Page>
  );
}

function WarehousePlotCard({ plot, canAct, onDecide, onValidate }) {
  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  const byEtapa = Object.fromEntries((plot.validacoes || []).map((v) => [v.etapa, v]));
  // próxima etapa a validar: a primeira ainda não confirmada
  const next = ETAPAS_CUSTODIA.find((e) => byEtapa[e.id]?.resultado !== "confirmado");
  const liberada = next && plot.fase_atual >= FASE_MINIMA_CUSTODIA[next.id] && (next.id !== "armazenagem" || byEtapa.colheita);
  const encerrado = plot.status === "pago";

  return (
    <article className="card" aria-labelledby={`wp-${plot.id}`}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <GrainThumb grao={plot.grao} size="lg" />
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <h3 id={`wp-${plot.id}`} className="card-title" style={{ fontSize: "var(--fs-lg)" }}>{plot.nome} · {plot.grao}</h3>
          <p className="text-sm text-2" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <MapPin size={13} aria-hidden /> {plot.farm_name}, {plot.farm_location}
          </p>
          <p className="text-sm text-2">
            {fmtNumber(plot.area_ha)} ha · safra {plot.safra} · {fmtNumber(plot.cotas_totais)} {unitPlural(plot.unidade, plot.cotas_totais)} declaradas · {fmtNumber(vendidas)} vendidas
          </p>
        </div>
        <CustodyStatusBadge status={plot.custodia_status} />
      </div>

      {plot.custodia_status === "pendente" && (
        <>
          <p className="text-sm" style={{ margin: "14px 0" }}>
            A fazenda indicou seu armazém para garantir este talhão. Ao aceitar, você valida o plantio, a colheita e a quantidade armazenada.
          </p>
          <div className="row" style={{ maxWidth: 460 }}>
            <Button variant="secondary" icon={X} onClick={() => onDecide(plot, "recusar")} disabled={!canAct}>Recusar</Button>
            <Button variant="success" icon={Check} onClick={() => onDecide(plot, "aceitar")} disabled={!canAct}>Aceitar custódia</Button>
          </div>
        </>
      )}

      {plot.custodia_status === "recusada" && plot.custodia_motivo && (
        <p className="text-sm text-2" style={{ marginTop: 12 }}>Motivo informado: {plot.custodia_motivo}</p>
      )}

      {plot.custodia_status === "aceita" && (
        <>
          <div style={{ margin: "16px 0 6px", display: "flex", justifyContent: "space-between", fontSize: "var(--fs-sm)" }} className="text-2">
            <span>Fase informada pela fazenda: <strong style={{ color: "var(--text)" }}>{FASES[plot.fase_atual]}</strong></span>
            <span>{plot.progresso}%</span>
          </div>
          <ProgressBar value={plot.progresso} label="Andamento da safra" />
          <div style={{ marginTop: 18 }}>
            <CustodyTimeline validacoes={plot.validacoes} unidade={plot.unidade} declared={plot.cotas_totais} sold={vendidas} />
          </div>
          {!encerrado && next && (
            <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <Button icon={ShieldCheck} onClick={() => onValidate(next.id)} disabled={!liberada || !canAct}>
                {byEtapa[next.id] ? `Refazer validação: ${next.label.toLowerCase()}` : `Validar ${next.label.toLowerCase()}`}
              </Button>
              {!liberada && (
                <span className="text-sm text-2">
                  Disponível quando a fazenda registrar a fase “{FASES[FASE_MINIMA_CUSTODIA[next.id]]}”.
                </span>
              )}
            </div>
          )}
          {!encerrado && !next && <Banner tone="success" style={{ marginTop: 16 }}>Todas as etapas validadas. O pagamento aos investidores fica liberado para a administração.</Banner>}
          {encerrado && <p className="text-sm text-success" style={{ marginTop: 14, fontWeight: 600 }}>Safra concluída e investidores pagos.</p>}
        </>
      )}

      <p style={{ marginTop: 14 }}><Link to={`/talhao/${plot.id}`} className="text-sm" style={{ fontWeight: 600 }}>Ver página pública do talhão</Link></p>
    </article>
  );
}

function ValidationDialog({ target, onClose, onSaved }) {
  const [resultado, setResultado] = useState("confirmado");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!target) return;
    setResultado("confirmado"); setObservacao(""); setFoto(null); setError("");
    setQuantidade(target.etapa === "plantio" ? "" : String(target.plot.cotas_totais));
  }, [target]);

  if (!target) return null;
  const { plot, etapa } = target;
  const info = ETAPAS_CUSTODIA.find((e) => e.id === etapa);
  const unidades = unitPlural(plot.unidade, 2);

  async function onFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { setFoto(await readImageFile(file)); } catch (err) { setError(err.message); }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.validatePlot(plot.id, { etapa, resultado, quantidade: etapa === "plantio" ? null : quantidade, observacao, foto });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Validar ${info.label.toLowerCase()}`} width={560}>
      <form onSubmit={submit} className="stack">
        <p>{plot.nome} · {plot.farm_name}. {info.descricao}</p>
        <ErrorBanner message={error} />
        <Segmented label="Resultado da verificação" value={resultado} onChange={setResultado}
          options={[{ id: "confirmado", label: "Confere" }, { id: "divergente", label: "Divergência" }]} />
        {etapa !== "plantio" && (
          <TextField
            label={etapa === "armazenagem" ? `Quantidade armazenada (${unidades})` : `Quantidade colhida (${unidades})`}
            hint={`Declarado pela fazenda: ${fmtNumber(plot.cotas_totais)} ${unidades}.`}
            type="number" inputMode="decimal" step="any" min={0}
            value={quantidade} onChange={setQuantidade} required={etapa === "armazenagem"}
          />
        )}
        <TextAreaField
          label={resultado === "divergente" ? "O que não confere" : "Observações (opcional)"}
          hint={resultado === "divergente" ? "Mínimo de 10 caracteres. Fazenda, investidores e administração recebem este texto." : "Ex.: número do romaneio, data da visita, umidade."}
          value={observacao} onChange={setObservacao} rows={3} required={resultado === "divergente"} minLength={resultado === "divergente" ? 10 : undefined}
        />
        <div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFoto} />
          {foto ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <img src={foto} alt="Foto anexada" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 8 }} />
              <Button variant="ghost" onClick={() => setFoto(null)}>Remover foto</Button>
            </div>
          ) : (
            <Button variant="secondary" icon={Camera} onClick={() => fileRef.current?.click()}>Anexar foto (opcional)</Button>
          )}
        </div>
        <div className="dialog-actions" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={resultado === "divergente" ? "danger" : "success"} loading={saving}>
            {resultado === "divergente" ? "Registrar divergência" : "Confirmar validação"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function WarehouseEditDialog({ open, warehouse, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF({ name: warehouse.name, location: warehouse.location, capacidade_t: warehouse.capacidade_t ?? "", descricao: warehouse.descricao || "" });
  }, [open, warehouse]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await api.updateMyWarehouse(f);
      onSaved(data.warehouse);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Dados do armazém" width={560}>
      <form onSubmit={submit} className="stack">
        <ErrorBanner message={error} />
        <TextField label="Nome do armazém" value={f.name} onChange={set("name")} required />
        <CityStateSelect key={open ? "aberto" : "fechado"} value={f.location} onChange={set("location")} required />
        <TextField label="Capacidade estática (toneladas)" type="number" inputMode="decimal" min={0} value={f.capacidade_t} onChange={set("capacidade_t")} />
        <TextAreaField label="Apresentação" hint="Aparece para o investidor na página do talhão: estrutura, certificações, tempo de mercado." value={f.descricao} onChange={set("descricao")} rows={4} maxLength={2000} />
        <div className="dialog-actions" style={{ marginTop: 4 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={saving}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}
