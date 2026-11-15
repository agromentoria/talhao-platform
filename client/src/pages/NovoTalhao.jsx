import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { api } from "../lib/api";
import { fmtBRL, fmtNumber } from "../lib/format";
import { Button, Banner, ErrorBanner, TextField, MoneyField, SelectField } from "../components/ui";
import { RegrasCusto } from "../components/domain";

// Assistente de cadastro do talhão (4 passos). Cada passo valida antes de avançar,
// os números vêm sugeridos pelas referências da cultura e o rascunho fica salvo
// no aparelho. Os erros do servidor aparecem no passo a que pertencem.

const PASSOS = ["Talhão", "Produção e custo", "Armazém e seguro", "Revisão"];
// custo operacional efetivo por ha (Imea 2026/27; feijão: faixa Conab) — só sugestão
const CUSTO_REF = { Soja: 6122, Milho: 5508, "Feijão": 11500 };
// base regional (R$ por saca) por estado, para soja/milho/feijão — sugestão; o fundo confere
const BASE_REF = { Soja: { MT: -9, GO: -5, MS: -6, PR: -2, MG: -4 }, Milho: { MT: -12, GO: -6, MS: -7, PR: -3, MG: -5 }, "Feijão": { MT: -10, GO: -5, MS: -8, PR: -5, MG: -3 } };
const PRINCIPAIS = ["Soja", "Milho", "Feijão"];
const LIMITE_VENDA = 0.8, TETO_TALHAO = 2_500_000, COBERTURA_MIN = 65;

const iso = (d) => d.toISOString().slice(0, 10);
const somaDias = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };

// safras oferecidas a partir de hoje: verão (plantio de out a dez) e safrinha (plantio em fev)
function opcoesSafra(hoje = new Date()) {
  const a = hoje.getFullYear(), m = hoje.getMonth() + 1;
  const lista = [];
  const add = (rotulo, plantio, tipo) => lista.push({ rotulo, plantio, tipo });
  if (m >= 6) add(`${a}/${String(a + 1).slice(2)}`, `${a}-10-15`, "verao");   // verão do ano, até dezembro
  if (m <= 2) add(`${a} safrinha`, `${a}-02-10`, "safrinha");
  add(`${a + 1} safrinha`, `${a + 1}-02-10`, "safrinha");
  if (m < 6) add(`${a}/${String(a + 1).slice(2)}`, `${a}-10-15`, "verao");
  add(`${a + 1}/${String(a + 2).slice(2)}`, `${a + 1}-10-15`, "verao");
  return lista;
}
const SAFRINHA = ["Milho", "Feijão", "Sorgo", "Trigo"]; // culturas plantadas normalmente na safrinha

export default function NovoTalhao({ farm, warehouses: todos = [], references = [], onCreated }) {
  const chave = `talhao_rascunho_${farm.id}`;
  const uf = String(farm.location || "").split(",").pop().trim().toUpperCase();
  // armazéns do mesmo estado primeiro; o primeiro deles já vem escolhido
  const ufDe = (w) => String(w.location || "").split(",").pop().trim().toUpperCase();
  const warehouses = useMemo(() => [...todos].sort((x, y) => (ufDe(y) === uf) - (ufDe(x) === uf) || String(x.name).localeCompare(y.name)), [todos, uf]);
  const safras = useMemo(() => opcoesSafra(), []);
  const vazio = { nome: "", area_ha: "", cultura: "Soja", variedade: "", safra: safras[0]?.rotulo || "", plantio_ate: "", colheita_prevista: "",
    produtividade_ha: "", custo_ha: "", preco: "", pct_venda: 80, warehouse_id: warehouses[0] && (warehouses.length === 1 || ufDe(warehouses[0]) === uf) ? String(warehouses[0].id) : "",
    base_regional: "", tem_seguro: "nao", seguro_seguradora: "", seguro_apolice: "", seguro_cobertura_pct: "70", seguro_arquivo: "", seguro_arquivo_nome: "" };
  const [catalogo, setCatalogo] = useState([]);
  const [f, setF] = useState(vazio);
  const [passo, setPasso] = useState(0);
  const [tentou, setTentou] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const [erroServidor, setErroServidor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const topo = useRef(null);

  useEffect(() => { api.culturas().then((d) => setCatalogo(d.culturas || d || [])).catch(() => setCatalogo([])); }, []);
  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(chave) || "null"); if (r?.f?.area_ha || r?.f?.nome) setRascunho(r); } catch { /* sem rascunho */ } }, [chave]);
  useEffect(() => { try { if (f.area_ha || f.nome) localStorage.setItem(chave, JSON.stringify({ f: { ...f, seguro_arquivo: "" }, passo })); } catch { /* armazenamento indisponível */ } }, [f, passo, chave]);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start" }); }, [passo]);

  const cult = catalogo.find((c) => c.nome === f.cultura) || { nome: f.cultura, unidade: "saca", tipo: "lavoura", ciclo_dias: 120, variedades: [] };
  const ref = references.find((r) => r.grao === f.cultura) || {};
  const u = cult.unidade === "arroba" ? "arroba" : cult.unidade || "saca";
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  // ao trocar cultura ou safra: sugere variedade, datas e números (sem apagar o que a pessoa já digitou)
  function escolherCultura(nome) {
    const c = catalogo.find((x) => x.nome === nome) || {};
    const r = references.find((x) => x.grao === nome) || {};
    const tipicaSafra = safras.find((x) => x.tipo === (SAFRINHA.includes(nome) ? "safrinha" : "verao"));
    if (tipicaSafra) setTimeout(() => escolherSafra(tipicaSafra.rotulo, c.ciclo_dias), 0);
    setF((x) => ({ ...x, cultura: nome, variedade: c.variedades?.[0] || "",
      produtividade_ha: r.produtividade_ha ? String(r.produtividade_ha) : "", custo_ha: CUSTO_REF[nome] ? String(CUSTO_REF[nome]) : "",
      preco: r.preco_unidade ? String(r.preco_unidade) : "", base_regional: BASE_REF[nome]?.[uf] != null ? String(BASE_REF[nome][uf]) : "0",
      colheita_prevista: x.plantio_ate ? somaDias(x.plantio_ate, c.ciclo_dias || 120) : x.colheita_prevista }));
  }
  function escolherSafra(rotulo, ciclo) {
    const s = safras.find((x) => x.rotulo === rotulo);
    const hoje = iso(new Date());
    const plantio = s && s.plantio > hoje ? s.plantio : somaDias(hoje, 15);
    setF((x) => ({ ...x, safra: rotulo, plantio_ate: plantio, colheita_prevista: somaDias(plantio, ciclo || cult.ciclo_dias || 120) }));
  }
  useEffect(() => { if (catalogo.length && !f.variedade && !rascunho) escolherCultura(f.cultura); }, [catalogo.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!f.plantio_ate && f.safra && catalogo.length && !rascunho) escolherSafra(f.safra); }, [catalogo.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // contas ao vivo
  const area = n(f.area_ha), prod = n(f.produtividade_ha), custoHa = n(f.custo_ha), preco = n(f.preco);
  const producao = area * prod;
  const sacas = Math.floor(producao * Math.min(LIMITE_VENDA, n(f.pct_venda) / 100));
  const custoSaca = prod > 0 ? custoHa / prod : 0;
  const captacao = sacas * custoSaca;
  const margem = custoSaca > 0 ? (preco / custoSaca - 1) * 100 : 0;

  // validação por passo (mesmas regras do servidor)
  const erros = [
    {
      nome: !f.nome.trim() && "Dê um nome ao talhão (ex.: Talhão 7).",
      area_ha: !(area > 0) ? "Informe a área em hectares." : area > 5000 ? "Confira a área: mais de 5.000 ha num talhão." : null,
      variedade: !f.variedade && "Escolha a variedade.",
      safra: !f.safra && "Escolha a safra.",
      plantio_ate: !f.plantio_ate && "Informe a data de plantio.",
      colheita_prevista: !f.colheita_prevista ? "Informe a colheita prevista." : f.colheita_prevista <= f.plantio_ate ? "A colheita precisa ser depois do plantio." : null,
    },
    {
      produtividade_ha: !(prod > 0) && `Informe a produtividade esperada (${u}s por ha).`,
      custo_ha: !(custoHa > 0) && "Informe o custo de produção por hectare.",
      preco: !(preco > 0) && `Informe o preço esperado de venda por ${u}.`,
      pct_venda: !(sacas > 0) ? `Ofereça pelo menos 1 ${u}.` : captacao > TETO_TALHAO ? `A captação (${fmtBRL(captacao)}) passa do teto de R$ 2,5 mi por talhão: diminua o percentual ou divida o talhão.` : null,
    },
    {
      warehouse_id: !f.warehouse_id && "Escolha o armazém que vai guardar a produção.",
      seguro_seguradora: f.tem_seguro === "sim" && !f.seguro_seguradora.trim() && "Informe a seguradora.",
      seguro_apolice: f.tem_seguro === "sim" && !f.seguro_apolice.trim() && "Informe o número da apólice ou proposta.",
      seguro_cobertura_pct: f.tem_seguro === "sim" && (n(f.seguro_cobertura_pct) < COBERTURA_MIN || n(f.seguro_cobertura_pct) > 100) && "A cobertura precisa ficar entre 65% e 100%.",
      seguro_arquivo: f.tem_seguro === "sim" && !f.seguro_arquivo && "Anexe a apólice (PDF ou foto).",
    },
    {},
  ].map((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v)));
  const errosDoPasso = erros[passo];
  const msg = (k) => (tentou ? errosDoPasso[k] : undefined);

  function avancar() {
    setTentou(true);
    if (Object.keys(errosDoPasso).length) return;
    setTentou(false); setErroServidor(""); setPasso((p) => Math.min(3, p + 1));
  }
  function passoDoErro(m) {
    const t = m.toLowerCase();
    if (/armaz|seguro|apólice|cobertura|base/.test(t)) return 2;
    if (/saca|80%|teto|produtividade|custo|preço|r\$ 2,5/.test(t)) return 1;
    if (/data|plantio|colheita|cultura|variedade|nome|área|safra/.test(t)) return 0;
    return 3;
  }
  async function enviar() {
    for (let i = 0; i < 3; i++) if (Object.keys(erros[i]).length) { setPasso(i); setTentou(true); return; }
    setEnviando(true); setErroServidor("");
    try {
      await api.createPlot({
        farm_id: farm.id, nome: f.nome.trim(), area_ha: area, safra: f.safra,
        grao: f.cultura, variedade: f.variedade, tipo_producao: cult.tipo || "lavoura", unidade: u,
        plantio_ate: f.plantio_ate, colheita_prevista: f.colheita_prevista, preco_venda_estimado: preco, cotas_totais: sacas,
        custo_ha: custoHa, produtividade_ha: prod, base_regional: n(f.base_regional), warehouse_id: Number(f.warehouse_id),
        arm_pagador: "fazenda", arm_quinzenas_previstas: 2, arm_investidor_pct: 0, perf_excedente_pct: 0,
        ...(f.tem_seguro === "sim" ? { seguro_seguradora: f.seguro_seguradora.trim(), seguro_apolice: f.seguro_apolice.trim(), seguro_cobertura_pct: n(f.seguro_cobertura_pct),
          seguro_arquivo: f.seguro_arquivo, seguro_arquivo_nome: f.seguro_arquivo_nome } : {}),
      });
      try { localStorage.removeItem(chave); } catch { /* ok */ }
      onCreated?.();
    } catch (e) {
      setErroServidor(e.message); setPasso(passoDoErro(e.message));
    } finally { setEnviando(false); }
  }

  if (farm.status !== "aprovada") {
    return <Banner tone="warning" title="Sua fazenda ainda está em análise">O cadastro de talhões libera assim que a administração aprovar a fazenda (documentos, CAR e matrícula em Minha fazenda). Se já enviou tudo, fale com a administração em Conversas.</Banner>;
  }
  if (!warehouses.length) {
    return <Banner tone="warning" title="Nenhum armazém credenciado ainda">Todo talhão precisa de um armazém garantidor. Assim que um armazém da sua região for credenciado, o cadastro libera. Fale com a administração em Conversas.</Banner>;
  }

  return (
    <div ref={topo} className="stack" style={{ gap: 16 }}>
      {rascunho && (
        <Banner tone="info" title="Você tem um rascunho salvo">
          <span>{rascunho.f.nome || "Talhão sem nome"} · {rascunho.f.area_ha || "?"} ha · {rascunho.f.cultura}. </span>
          <span className="row" style={{ gap: 8, marginTop: 8, display: "flex" }}>
            <Button size="sm" onClick={() => { setF({ ...vazio, ...rascunho.f }); setPasso(rascunho.passo || 0); setRascunho(null); }}>Continuar de onde parei</Button>
            <Button size="sm" variant="ghost" onClick={() => { localStorage.removeItem(chave); setRascunho(null); escolherCultura(f.cultura); escolherSafra(f.safra); }}>Começar do zero</Button>
          </span>
        </Banner>
      )}

      <ol className="row" aria-label="Passos" style={{ display: "flex", gap: 6, listStyle: "none", padding: 0, margin: 0, flexWrap: "wrap" }}>
        {PASSOS.map((p, i) => (
          <li key={p} style={{ flex: "1 1 120px" }}>
            <button type="button" onClick={() => i < passo && setPasso(i)} disabled={i > passo} aria-current={i === passo ? "step" : undefined}
              style={{ width: "100%", textAlign: "left", border: 0, borderTop: `4px solid ${i <= passo ? "var(--brand, #4E6E20)" : "var(--border, #ddd)"}`, background: "none", padding: "6px 2px", cursor: i < passo ? "pointer" : "default", color: "inherit" }}>
              <span className="text-xs text-3">Passo {i + 1}</span><br />
              <strong className="text-sm">{i < passo ? <Check size={13} aria-hidden /> : null} {p}</strong>
            </button>
          </li>
        ))}
      </ol>

      {erroServidor && <ErrorBanner message={`Não foi possível enviar: ${erroServidor}`} />}

      {passo === 0 && (
        <div className="form-grid">
          <TextField label="Nome do talhão" value={f.nome} onChange={set("nome")} error={msg("nome")} placeholder="Talhão 7 – Soja" autoFocus />
          <TextField label="Área do talhão (ha)" type="number" inputMode="decimal" value={f.area_ha} onChange={set("area_ha")} error={msg("area_ha")} hint="Como a fazenda divide a lavoura (ex.: 62 ha)." />
          <div className="span-all">
            <p className="field-label">Cultura</p>
            <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRINCIPAIS.map((c) => (
                <Button key={c} type="button" variant={f.cultura === c ? "primary" : "secondary"} onClick={() => escolherCultura(c)} aria-pressed={f.cultura === c}>{c}</Button>
              ))}
              <SelectField label="" aria-label="Outra cultura" value={PRINCIPAIS.includes(f.cultura) ? "" : f.cultura} onChange={(v) => v && escolherCultura(v)}
                options={[{ value: "", label: "Outra cultura…" }, ...catalogo.filter((c) => !PRINCIPAIS.includes(c.nome) && c.tipo === "lavoura").map((c) => ({ value: c.nome, label: c.nome }))]} style={{ minWidth: 180 }} />
            </div>
          </div>
          <SelectField label="Variedade" value={f.variedade} onChange={set("variedade")} error={msg("variedade")}
            options={[{ value: "", label: "Escolha" }, ...(cult.variedades || []).map((v) => ({ value: v, label: v }))]} />
          <SelectField label="Safra" value={f.safra} onChange={(v) => escolherSafra(v)} error={msg("safra")} options={safras.map((s) => ({ value: s.rotulo, label: s.rotulo }))} />
          <TextField label="Plantio até" type="date" value={f.plantio_ate} onChange={(v) => setF((x) => ({ ...x, plantio_ate: v, colheita_prevista: v ? somaDias(v, cult.ciclo_dias || 120) : x.colheita_prevista }))} error={msg("plantio_ate")} />
          <TextField label="Colheita prevista" type="date" value={f.colheita_prevista} onChange={set("colheita_prevista")} error={msg("colheita_prevista")}
            hint={`Sugerida pelo ciclo de ${cult.ciclo_dias || 120} dias da cultura. Ajuste se precisar.`} />
        </div>
      )}

      {passo === 1 && (
        <div className="form-grid">
          <TextField label={`Produtividade esperada (${u}s por ha)`} type="number" inputMode="decimal" value={f.produtividade_ha} onChange={set("produtividade_ha")} error={msg("produtividade_ha")}
            hint={ref.produtividade_ha ? `Referência: ${fmtNumber(ref.produtividade_ha)} ${u}s/ha. Use a média das últimas safras do talhão.` : "Média das últimas safras do talhão."} />
          <MoneyField label="Custo de produção por hectare" value={f.custo_ha} onChange={set("custo_ha")} error={msg("custo_ha")}
            hint={CUSTO_REF[f.cultura] ? `Referência Imea/Conab: ${fmtBRL(CUSTO_REF[f.cultura])}/ha. Insumos, operações e mão de obra.` : "Insumos, operações e mão de obra."} />
          <MoneyField label={`Preço esperado de venda por ${u}`} value={f.preco} onChange={set("preco")} error={msg("preco")}
            hint={ref.preco_unidade ? `Referência de mercado: ${fmtBRL(ref.preco_unidade)}.` : undefined} />
          <div>
            <label className="field-label" htmlFor="pct-venda">Quanto da produção oferecer aos investidores: <strong>{f.pct_venda}%</strong></label>
            <input id="pct-venda" type="range" min="10" max="80" step="5" value={f.pct_venda} onChange={(e) => set("pct_venda")(Number(e.target.value))} style={{ width: "100%" }} />
            <p className="field-hint">Até 80%: o restante é margem de segurança para quebra de safra e continua seu.</p>
            {msg("pct_venda") && <p className="text-sm text-danger">{msg("pct_venda")}</p>}
          </div>
          <div className="span-all card card--well" style={{ padding: 14 }}>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Produção esperada</dt><dd>{fmtNumber(Math.round(producao))} {u}s</dd></div>
              <div><dt>{u === "arroba" ? "Arrobas" : "Sacas"} à venda</dt><dd><strong>{fmtNumber(sacas)}</strong></dd></div>
              <div><dt>Custo por {u} (preço para o investidor)</dt><dd>{custoSaca ? fmtBRL(custoSaca) : "—"}</dd></div>
              <div className="total"><dt>Você recebe antes do plantio</dt><dd className="text-success">{captacao ? fmtBRL(captacao) : "—"}</dd></div>
              <div><dt>Margem esperada por {u}</dt><dd className={margem < 8 ? "text-danger" : ""}>{custoSaca ? `${fmtNumber(Math.round(margem * 10) / 10)}%` : "—"}</dd></div>
            </dl>
            {custoSaca > 0 && margem < 8 && <p className="text-sm text-danger" style={{ marginTop: 8 }}><Info size={14} aria-hidden /> Margem baixa: o preço esperado mal cobre o custo mais o mínimo do investidor. O fundo pode não aprovar.</p>}
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="form-grid">
          <SelectField label="Armazém que vai guardar a produção" value={f.warehouse_id} onChange={set("warehouse_id")} error={msg("warehouse_id")} className="span-all"
            options={[{ value: "", label: "Escolha o armazém" }, ...warehouses.map((w) => ({ value: String(w.id), label: `${w.name}${w.location ? ` · ${w.location}` : ""}${ufDe(w) === uf ? " (seu estado)" : ""}` }))]}
            hint="O armazém confirma plantio e colheita e guarda o grão até o pagamento." />
          <MoneyField label={`Base regional por ${u}`} allowNegative value={f.base_regional} onChange={set("base_regional")}
            hint={`Diferença da sua praça para o preço de referência da cultura (B3/Cepea). Sugerida para ${uf || "o seu estado"}; o fundo confere. Na dúvida, mantenha a sugestão.`} />
          <div className="span-all">
            <p className="field-label">Seguro agrícola</p>
            <div className="row" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button type="button" variant={f.tem_seguro === "sim" ? "primary" : "secondary"} onClick={() => set("tem_seguro")("sim")}>Já tenho seguro contratado</Button>
              <Button type="button" variant={f.tem_seguro === "nao" ? "primary" : "secondary"} onClick={() => set("tem_seguro")("nao")}>Vou contratar e enviar depois</Button>
            </div>
            <p className="field-hint">{f.tem_seguro === "nao" ? "Tudo bem: o talhão vai para análise e o fundo pede a apólice antes de publicar aos investidores." : "Informe os dados e anexe a apólice para o fundo conferir."}</p>
          </div>
          {f.tem_seguro === "sim" && (<>
            <TextField label="Seguradora" value={f.seguro_seguradora} onChange={set("seguro_seguradora")} error={msg("seguro_seguradora")} />
            <TextField label="Nº da apólice ou proposta" value={f.seguro_apolice} onChange={set("seguro_apolice")} error={msg("seguro_apolice")} />
            <TextField label="Cobertura (% da produtividade)" type="number" value={f.seguro_cobertura_pct} onChange={set("seguro_cobertura_pct")} error={msg("seguro_cobertura_pct")} hint="Mínimo de 65%." />
            <div>
              <p className="field-label">Apólice (PDF ou foto, até 1,5 MB)</p>
              <label className="btn btn--secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
                {f.seguro_arquivo_nome ? "Trocar arquivo" : "Escolher arquivo"}
                <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 1_500_000) { setErroServidor("Apólice muito grande: envie um arquivo de até 1,5 MB."); e.target.value = ""; return; }
                  const r = new FileReader(); r.onload = () => setF((x) => ({ ...x, seguro_arquivo: r.result, seguro_arquivo_nome: file.name })); r.readAsDataURL(file);
                }} />
              </label>
              <p className={`field-hint ${msg("seguro_arquivo") ? "text-danger" : ""}`}>{f.seguro_arquivo_nome ? `Anexado: ${f.seguro_arquivo_nome}` : msg("seguro_arquivo") || "Nenhum arquivo ainda."}</p>
            </div>
          </>)}
        </div>
      )}

      {passo === 3 && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card card--well" style={{ padding: 14 }}>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Talhão</dt><dd>{f.nome} · {fmtNumber(area)} ha</dd></div>
              <div><dt>Cultura</dt><dd>{f.cultura} · {f.variedade}</dd></div>
              <div><dt>Safra</dt><dd>{f.safra} · plantio até {new Date(`${f.plantio_ate}T12:00:00`).toLocaleDateString("pt-BR")} · colheita {new Date(`${f.colheita_prevista}T12:00:00`).toLocaleDateString("pt-BR")}</dd></div>
              <div><dt>{u === "arroba" ? "Arrobas" : "Sacas"} à venda</dt><dd>{fmtNumber(sacas)} de {fmtNumber(Math.round(producao))} ({f.pct_venda}%)</dd></div>
              <div><dt>Custo por {u}</dt><dd>{fmtBRL(custoSaca)}</dd></div>
              <div><dt>Armazém</dt><dd>{warehouses.find((w) => String(w.id) === f.warehouse_id)?.name}</dd></div>
              <div><dt>Seguro</dt><dd>{f.tem_seguro === "sim" ? `${f.seguro_seguradora} · ${f.seguro_cobertura_pct}% · apólice anexada` : "a enviar depois"}</dd></div>
              <div className="total"><dt>Você recebe antes do plantio</dt><dd className="text-success">{fmtBRL(captacao)}</dd></div>
            </dl>
          </div>
          <details>
            <summary className="text-sm" style={{ cursor: "pointer", fontWeight: 600 }}>Ver como fica a divisão do lucro e os cenários de preço</summary>
            <div style={{ marginTop: 10 }}>
              <RegrasCusto custoHa={custoHa} produtividade={prod} precoEsperado={preco} colheitaPrevista={f.colheita_prevista} unidade={u} area={area} paraFazenda base={f.base_regional}
                seguro={f.tem_seguro === "sim" ? { seguradora: f.seguro_seguradora, cobertura: f.seguro_cobertura_pct } : undefined} />
            </div>
          </details>
          <p className="text-sm text-2">Depois de enviar, o talhão passa pela análise do fundo e pelo aceite do armazém. Ele só aparece para os investidores quando os dois confirmarem.</p>
        </div>
      )}

      <div className="row" style={{ display: "flex", justifyContent: "space-between", gap: 8, borderTop: "1px solid var(--border, #e5dccb)", paddingTop: 12 }}>
        {passo > 0 ? <Button variant="ghost" icon={ChevronLeft} onClick={() => { setTentou(false); setPasso(passo - 1); }}>Voltar</Button> : <span />}
        {passo < 3
          ? <Button onClick={avancar}>Continuar <ChevronRight size={16} aria-hidden /></Button>
          : <Button variant="success" onClick={enviar} loading={enviando}>Enviar para aprovação</Button>}
      </div>
      {tentou && Object.keys(errosDoPasso).length > 0 && <p className="text-sm text-danger" role="alert" style={{ textAlign: "right", marginTop: -6 }}>Corrija {Object.keys(errosDoPasso).length === 1 ? "o campo destacado" : `os ${Object.keys(errosDoPasso).length} campos destacados`} para continuar.</p>}
    </div>
  );
}
