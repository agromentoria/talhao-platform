import { useEffect, useState } from "react";
import { TrendingUp, Tractor, Warehouse, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { fmtBRL, fmtPct } from "../lib/format";
import { dividirLucro } from "../lib/divisaoLucro";
import { TIPOS } from "../config/culturas";
import { Page, PageHeader } from "../components/layout/Page";
import { TextField, SelectField, Banner } from "../components/ui";
import { RegrasTalhao } from "../components/domain";
import { rendimentoNoPrazo, REFERENCIAS_PADRAO } from "../lib/referencias";

// Explica as regras da plataforma para todos (investidor, fazenda, armazém)
// e deixa simular a divisão do resultado com qualquer número.
export default function ComoFunciona() {
  const [regras, setRegras] = useState(null);
  const [s, setS] = useState({ preco: "120", meta: "7.5", comissao: "15", perf: "50", venda: "145.61", qtd: "1000", armazem: "2.19", pagaArmazem: "investidores", dias: "150" });
  useEffect(() => { api.regras().then(setRegras).catch(() => {}); }, []);
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));

  const app = regras?.app_commission_pct ?? 5;
  const mult = regras?.multiplicadores || {};
  const n = (k) => Number(String(s[k]).replace(",", ".")) || 0;
  const qtd = n("qtd"), preco = n("preco");
  const despesaTotal = qtd * n("armazem");
  const parteInv = s.pagaArmazem === "investidores" ? 1 : s.pagaArmazem === "dividido" ? 0.5 : 0;
  const r = preco > 0 ? dividirLucro({ cotas: qtd, valorInvestido: qtd * preco, precoReferencia: preco, retornoPrometidoPct: n("meta"),
    precoVenda: n("venda"), despesa: despesaTotal * parteInv, comissaoFazendaPct: n("comissao"), comissaoAppPct: app, performancePct: n("perf") }) : null;

  return (
    <Page title="Como funciona" back="/" width="medium">
      <PageHeader back="/" backLabel="Voltar" title="Como funciona" subtitle="As regras de ganhos, percentuais e comissões do Meu Talhão, explicadas para investidores, fazendas e armazéns." />

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Quem participa</h2>
        <div className="regras-divisao">
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><TrendingUp size={16} aria-hidden /> Investidor</p><p className="text-sm text-2">Compra parte da produção antes da colheita. Esse dinheiro financia a lavoura ou a criação.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><Tractor size={16} aria-hidden /> Fazenda</p><p className="text-sm text-2">Produz, lança os custos no demonstrativo, vende na colheita e recebe comissão sobre o lucro.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><Warehouse size={16} aria-hidden /> Armazém</p><p className="text-sm text-2">Garante a produção: confirma plantio, colheita e quantidade guardada. Cobra tarifa de armazenagem.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><ShieldCheck size={16} aria-hidden /> Plataforma</p><p className="text-sm text-2">Aprova fazendas, armazéns e talhões e libera os pagamentos. Cobra {fmtPct(app)} sobre o lucro.</p></div>
        </div>
      </section>

      <section className="card legal" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Os números de um talhão</h2>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>1. Preço de referência</h3>
        <p>O preço de mercado esperado para a unidade (saca, arroba…) na colheita, informado pela fazenda. Ex.: R$ 120 por saca de soja.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>2. Retorno prometido (meta)</h3>
        <p>Quanto acima do preço de referência a fazenda se compromete a vender. Ex.: 7,5% sobre R$ 120 = <strong>meta de R$ 129 por saca</strong>. Não é o ganho líquido do investidor: dele ainda saem as comissões e, se for o caso, a armazenagem. O histórico "prometido × entregue" de cada fazenda fica público.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>3. Preço de compra por fase</h3>
        <p>Quem entra mais cedo paga menos e corre mais risco. O preço da unidade é o preço de referência multiplicado pelo fator da fase:</p>
        <div className="fin-table-wrap" style={{ display: "block", margin: "8px 0" }}>
          <table className="fin-table"><thead><tr><th>Fase (lavoura)</th><th className="num">Fator</th><th className="num">Com referência de R$ 120</th></tr></thead>
            <tbody>{TIPOS.lavoura.fases.slice(0, 5).map((f, i) => (
              <tr key={f} style={{ cursor: "default" }}><td>{f}</td><td className="num">{(Number(mult[i] ?? 1)).toFixed(3).replace(".", ",")}</td><td className="num">{fmtBRL(120 * Number(mult[i] ?? 1))}</td></tr>
            ))}</tbody></table>
        </div>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>4. Comissões (sempre sobre o lucro)</h3>
        <ul>
          <li><strong>Fazenda:</strong> percentual definido por ela no painel, sobre o lucro até a meta.</li>
          <li><strong>Plataforma:</strong> {fmtPct(app)} sobre todo o lucro.</li>
          <li><strong>Investidor:</strong> o restante. Se não houver lucro, não há comissão.</li>
        </ul>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>5. Performance acima da meta</h3>
        <p>Se a venda passar da meta, a fazenda fica com um percentual do valor que passou (de 0% a {fmtPct(regras?.performance_max ?? 70)}), definido no cadastro do talhão, validado pela administração e mostrado antes da compra. Exemplo: meta de R$ 144, venda a R$ 145, 60.000 sacas e performance de 40% → excedente de R$ 60.000 e R$ 24.000 para a fazenda. O excedente nunca passa do lucro do investidor.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>6. Armazenagem</h3>
        <p>O armazém cobra recepção, um valor por quinzena após a carência e a quebra técnica. Em cada talhão aparece quem paga: os investidores (descontado do resultado antes das comissões), a fazenda, ou os dois em partes.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>7. Pagamento</h3>
        <p>Depois da colheita, o armazém confirma a quantidade guardada, a fazenda informa o preço de venda com comprovante e a administração confere a prévia e aprova. O pagamento sai para todos ao mesmo tempo.</p>
      </section>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="sim-t">
        <h2 id="sim-t" className="card-title">Simulador</h2>
        <p className="card-desc" style={{ marginBottom: 12 }}>Mude os números e veja quanto cada participante recebe. Compra simulada na primeira fase, ao preço de referência.</p>
        <div className="form-grid">
          <TextField label="Preço de referência (R$ por unidade)" type="number" inputMode="decimal" value={s.preco} onChange={set("preco")} />
          <TextField label="Retorno prometido — meta (%)" type="number" inputMode="decimal" value={s.meta} onChange={set("meta")} />
          <TextField label="Comissão da fazenda (%)" type="number" inputMode="decimal" value={s.comissao} onChange={set("comissao")} />
          <TextField label="Performance da fazenda acima da meta (%)" type="number" inputMode="decimal" value={s.perf} onChange={set("perf")} />
          <TextField label="Quantidade comprada (unidades)" type="number" inputMode="numeric" value={s.qtd} onChange={set("qtd")} />
          <TextField label="Preço real de venda (R$ por unidade)" type="number" inputMode="decimal" value={s.venda} onChange={set("venda")} />
          <TextField label="Armazenagem por unidade (R$)" type="number" inputMode="decimal" value={s.armazem} onChange={set("armazem")} />
          <TextField label="Duração da safra até o pagamento (dias)" type="number" inputMode="numeric" min={1} value={s.dias} onChange={set("dias")}
            hint="Ex.: soja ~120 dias de lavoura + colheita e venda; frango ~45 dias" />
          <SelectField label="Quem paga a armazenagem" value={s.pagaArmazem} onChange={set("pagaArmazem")}
            options={[{ value: "investidores", label: "Investidores" }, { value: "dividido", label: "Dividido (50%)" }, { value: "fazenda", label: "Fazenda" }]} />
        </div>
        {r && (
          <div style={{ marginTop: 14 }}>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Investido</dt><dd>{fmtBRL(qtd * preco)}</dd></div>
              <div><dt>Valor da venda</dt><dd>{fmtBRL(r.valorBruto)}</dd></div>
              <div><dt>Armazenagem total (armazém recebe)</dt><dd>{fmtBRL(despesaTotal)}</dd></div>
              <div><dt>Lucro até a meta / excedente</dt><dd>{fmtBRL(r.lucroBase)} / {fmtBRL(r.excedente)}</dd></div>
              <div><dt>Fazenda: comissão + performance</dt><dd>{fmtBRL(r.comissaoFazenda - r.performanceFazenda)} + {fmtBRL(r.performanceFazenda)}</dd></div>
              <div><dt>Plataforma</dt><dd>{fmtBRL(r.comissaoApp)}</dd></div>
              <div className="total"><dt>Investidor recebe</dt><dd className="text-success">{fmtBRL(r.valorLiquido)} (lucro de {fmtPct(qtd * preco ? ((r.valorLiquido - qtd * preco) / (qtd * preco)) * 100 : 0, 2)})</dd></div>
            </dl>
            {(() => {
              const alt = rendimentoNoPrazo(n("dias"), regras?.referencias || REFERENCIAS_PADRAO);
              const inv = qtd * preco;
              return (
                <div className="regras-comparacao" style={{ marginTop: 12 }}>
                  <p className="label-xs">O mesmo valor, nos mesmos {alt.dias} dias, renderia</p>
                  <div className="regras-comparacao-linhas">
                    <span><b className={r.valorLiquido >= inv ? "text-success" : "text-danger"}>{fmtBRL(r.valorLiquido - inv)}</b> no Meu Talhão</span>
                    <span><b>{fmtBRL(inv * alt.lca / 100)}</b> na LCA</span>
                    <span><b>{fmtBRL(inv * alt.cdb / 100)}</b> no CDB, após IR</span>
                    <span><b>{fmtBRL(inv * alt.poupanca / 100)}</b> na poupança</span>
                  </div>
                </div>
              );
            })()}
            {r.valorLiquido < qtd * preco && <Banner tone="warning" style={{ marginTop: 10 }}>Neste cenário o investidor tem prejuízo: a venda não cobriu o valor pago.</Banner>}
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Ganho do investidor na safra, por fase de compra (venda na meta)</h2>
        <RegrasTalhao precoRef={preco} metaPct={n("meta")} perfPct={n("perf")} comissaoFazendaPct={n("comissao")} appPct={app} multiplicadores={mult}
          despesaInvestidorUnidade={n("armazem") * parteInv} compact={false}
          inicioCiclo={new Date().toISOString().slice(0, 10)}
          fimCiclo={new Date(Date.now() + Math.max(1, n("dias") - 15) * 86400000).toISOString().slice(0, 10)} />
      </section>

      <Banner tone="warning" title="Riscos">
        Retornos são estimativas. Clima, pragas, produtividade e preço de mercado podem reduzir o resultado ou gerar prejuízo. O armazém garante que a produção existe e foi guardada, mas não garante o preço de venda.
      </Banner>
    </Page>
  );
}
