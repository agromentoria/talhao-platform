import { useEffect, useState } from "react";
import { TrendingUp, Tractor, Warehouse, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { fmtBRL, fmtPct } from "../lib/format";
import { Page, PageHeader } from "../components/layout/Page";
import { TextField, Banner } from "../components/ui";
import { RegrasPiso } from "../components/domain";
import { rendimentoNoPrazo, REFERENCIAS_PADRAO } from "../lib/referencias";
import { PISO_PADRAO, pisoPct, dividirPiso, taxasFazendaPct } from "../lib/piso";

// Regras do produto com renda mínima (piso) explicadas para todos, com simulador.
export default function ComoFunciona() {
  const [regras, setRegras] = useState(null);
  const [s, setS] = useState({ preco: "120", qtd: "1000", venda: "140", dias: "150" });
  useEffect(() => { api.regras().then(setRegras).catch(() => {}); }, []);
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const R = regras?.piso || PISO_PADRAO;
  const n = (k) => Number(String(s[k]).replace(",", ".")) || 0;
  const qtd = n("qtd"), preco = n("preco"), dias = Math.max(1, n("dias"));
  const piso = pisoPct(dias, R);
  const r = preco > 0 ? dividirPiso({ cotas: qtd, precoReferencia: preco, pisoPct: piso, precoVenda: n("venda") }, R) : null;
  const inv = qtd * preco;
  const alt = rendimentoNoPrazo(dias, regras?.referencias || REFERENCIAS_PADRAO);
  const colheita = new Date(Date.now() + Math.max(1, dias - R.dias_pos_colheita) * 86400000).toISOString().slice(0, 10);
  const taxas = inv * taxasFazendaPct(R) / 100;

  return (
    <Page title="Como funciona" back="/" width="medium">
      <PageHeader back="/" backLabel="Voltar" title="Como funciona" subtitle="Renda mínima garantida pela fazenda, mais parte da alta do preço. Tudo contado por safra." />

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Quem participa</h2>
        <div className="regras-divisao">
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><TrendingUp size={16} aria-hidden /> Investidor</p><p className="text-sm text-2">Compra sacas de um talhão, a partir de 1. Recebe no mínimo o piso da safra e uma parte da alta.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><Tractor size={16} aria-hidden /> Fazenda</p><p className="text-sm text-2">Recebe o dinheiro antes do plantio, garante o piso e fica com a maior parte da alta.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><Warehouse size={16} aria-hidden /> Armazém</p><p className="text-sm text-2">Guarda o grão e confirma plantio, colheita e quantidade. Recebe custódia e tarifas.</p></div>
          <div><p className="card-title" style={{ display: "flex", gap: 6 }}><ShieldCheck size={16} aria-hidden /> Fundo e plataforma</p><p className="text-sm text-2">O fundo aprova talhões e pagamentos; a plataforma cobra estruturação e uma parte da alta.</p></div>
        </div>
      </section>

      <section className="card legal" style={{ marginBottom: 16 }}>
        <h2 className="card-title">As regras de um talhão</h2>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>1. Renda mínima (piso)</h3>
        <p>O investidor recebe no mínimo {R.piso_pct_cdi}% do CDI no prazo da safra, mesmo que o preço caia. Numa safra de soja de ~150 dias, isso dá cerca de {fmtPct(pisoPct(150, R), 2)}. A fazenda paga esse mínimo como num título prefixado (CPR financeira).</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>2. Parte da alta</h3>
        <p>Se a venda passar do preço-piso, o que passar é dividido: {R.excedente_investidor_pct}% para o investidor, {R.excedente_fazenda_pct}% para a fazenda e {R.excedente_plataforma_pct}% para a plataforma.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>3. Preço que sobe com o tempo</h3>
        <p>A saca custa o preço de referência no dia em que o talhão abre e sobe um pouco a cada dia, na taxa do piso — como um título que rende. Quem compra mais tarde paga mais caro e recebe antes, mas o mínimo continua sendo {R.piso_pct_cdi}% do CDI pelo prazo que falta: ninguém entra pior que a LCA.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>4. O que a fazenda paga</h3>
        <p>Sobre o valor captado: {fmtPct(R.estruturacao_pct)} de estruturação (plataforma), {fmtPct(R.custodia_armazem_pct)} de custódia (armazém) e {fmtPct(R.gestao_fundo_pct)} de gestão (fundo). A armazenagem também fica com a fazenda — o investidor recebe sem desconto.</p>
        <h3 style={{ fontSize: "var(--fs-md)", margin: "14px 0 4px" }}>5. Pagamento</h3>
        <p>Depois da colheita, o armazém confirma a quantidade guardada, a fazenda informa o preço de venda com comprovante e o fundo confere a prévia exata e aprova. Todos recebem ao mesmo tempo.</p>
      </section>

      <section className="card" style={{ marginBottom: 16 }} aria-labelledby="sim-t">
        <h2 id="sim-t" className="card-title">Simulador</h2>
        <p className="card-desc" style={{ marginBottom: 12 }}>Mude os números e veja quanto cada participante recebe numa safra (compra na primeira fase).</p>
        <div className="form-grid">
          <TextField label="Preço de referência (R$ por unidade)" type="number" inputMode="decimal" value={s.preco} onChange={set("preco")} />
          <TextField label="Quantidade comprada (unidades)" type="number" inputMode="numeric" value={s.qtd} onChange={set("qtd")} />
          <TextField label="Preço real de venda (R$ por unidade)" type="number" inputMode="decimal" value={s.venda} onChange={set("venda")} />
          <TextField label="Prazo da compra ao pagamento (dias)" type="number" inputMode="numeric" min={1} value={s.dias} onChange={set("dias")}
            hint="Ex.: soja ~150 dias; feijão ~120; frango ~75" />
        </div>
        {r && (
          <div style={{ marginTop: 14 }}>
            <dl className="kv" style={{ margin: 0 }}>
              <div><dt>Investido</dt><dd>{fmtBRL(inv)}</dd></div>
              <div><dt>Piso da safra ({R.piso_pct_cdi}% do CDI em {dias} dias)</dt><dd>{fmtPct(piso, 2)} · {fmtBRL(r.valorPiso)}</dd></div>
              <div><dt>Valor da venda</dt><dd>{fmtBRL(r.valorVenda)}</dd></div>
              <div><dt>Alta acima do piso</dt><dd>{fmtBRL(r.excedente)}</dd></div>
              <div><dt>Plataforma (estruturação + {R.excedente_plataforma_pct}% da alta)</dt><dd>{fmtBRL(inv * R.estruturacao_pct / 100 + r.plataforma)}</dd></div>
              <div><dt>{r.aporteFazenda > 0 ? "Fazenda completa o piso" : `Fazenda fica com ${R.excedente_fazenda_pct}% da alta`}</dt><dd>{fmtBRL(r.aporteFazenda > 0 ? r.aporteFazenda : r.fazendaExcedente)} <span className="text-3">(paga ainda {fmtBRL(taxas)} de taxas + armazenagem)</span></dd></div>
              <div className="total"><dt>Investidor recebe</dt><dd className="text-success">{fmtBRL(r.investidor)} (ganho de {fmtPct(inv ? (r.investidor / inv - 1) * 100 : 0, 2)})</dd></div>
            </dl>
            <div className="regras-comparacao" style={{ marginTop: 12 }}>
              <p className="label-xs">O mesmo valor, nos mesmos {dias} dias, renderia</p>
              <div className="regras-comparacao-linhas">
                <span><b className="text-success">{fmtBRL(r.investidor - inv)}</b> no Meu Talhão</span>
                <span><b>{fmtBRL(inv * alt.lca / 100)}</b> na LCA</span>
                <span><b>{fmtBRL(inv * alt.cdb / 100)}</b> no CDB, após IR</span>
                <span><b>{fmtBRL(inv * alt.poupanca / 100)}</b> na poupança</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 10 }}>Ganho do investidor na safra, por fase de compra</h2>
        <RegrasPiso precoRef={preco} colheitaPrevista={colheita} paraFazenda />
      </section>

      <Banner tone="warning" title="Riscos">
        A renda mínima é uma obrigação da fazenda, garantida pela safra guardada no armazém, seguro agrícola e análise do fundo — não é coberta pelo FGC. Se a fazenda não pagar, o investidor pode perder. A alta do preço é uma estimativa, não uma promessa.
      </Banner>
    </Page>
  );
}
