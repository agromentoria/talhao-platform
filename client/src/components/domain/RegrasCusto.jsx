import { Link } from "react-router-dom";
import { Sprout, Info } from "lucide-react";
import { fmtBRL, fmtPct, fmtNumber } from "../../lib/format";
import { unidadeNome } from "../../config/culturas";
import { useRegras, rendimentoNoPrazo, REFERENCIAS_PADRAO } from "../../lib/referencias";
import { prazoDias, diasDesde, precoNoDia, CUSTO_PADRAO, minimoPct as calcMin, ganhoInvestidorCusto, recebeCusto } from "../../lib/piso";

// Quadro do modelo "Custo + Lucro": o investidor paga o custo de produção e
// fica com 30% do lucro; a fazenda fica com 65% e com a boa safra.
export default function RegrasCusto({ custoHa, produtividade, precoEsperado, piso, pisoDias, publicadoEm, colheitaPrevista, unidade = "saca", area, paraFazenda = false }) {
  const regras = useRegras();
  const R = regras?.custo || CUSTO_PADRAO;
  const ref = regras?.referencias || REFERENCIAS_PADRAO;
  const ch = Number(custoHa) || 0, pr = Number(produtividade) || 0, M = Number(precoEsperado) || 0;
  if (!(ch > 0 && pr > 0 && M > 0)) return <p className="text-sm text-2">Informe o custo por hectare, a produtividade e o preço esperado de venda para ver a divisão.</p>;
  const u = unidadeNome(unidade, 1);
  const C = ch / pr;
  const total = Number(pisoDias) || prazoDias(colheitaPrevista) || 150;
  const mn = piso != null && piso !== "" ? Number(piso) : calcMin(total, ref.cdi_aa, R);
  const decorridos = diasDesde(publicadoEm), restantes = Math.max(1, Math.round(total - decorridos));
  const margem = (M / C - 1) * 100;
  const alt = rendimentoNoPrazo(restantes, ref);
  const precoHoje = precoNoDia(C, mn, total, decorridos);
  const g = ganhoInvestidorCusto({ custoSaca: C, precoPago: precoHoje, minPct: mn, precoEsperado: M, dias: restantes }, R);
  const insuficiente = M <= C * (1 + mn / 100);
  const cenarios = [-0.1, 0, 0.1, 0.2].map((d) => {
    const pv = M * (1 + d), inv = recebeCusto(C, mn, pv, R), lucro = Math.max(0, pv - C);
    const minimo = C * (1 + mn / 100), bruto = Math.max(minimo, C + lucro * R.lucro_investidor_pct / 100);
    const desempenho = Math.max(0, bruto - minimo) * (R.desempenho_pct ?? 0) / 100;
    const faz = pv - bruto - lucro * R.lucro_plataforma_pct / 100 - C * (R.estruturacao_pct + R.custodia_armazem_pct + R.gestao_fundo_pct) / 100;
    const app = C * R.estruturacao_pct / 100 + lucro * R.lucro_plataforma_pct / 100 + desempenho;
    return { pv, invPct: (inv / C - 1) * 100, fazHa: faz * pr, appPct: app / C * 100 };
  });
  return (
    <div className="regras">
      <div className="regras-meta">
        <span className="label-xs" style={{ display: "flex", gap: 6, alignItems: "center" }}><Sprout size={14} aria-hidden /> O investidor paga o custo de produção</span>
        <strong>{fmtBRL(C)} por {u}</strong>
        <span className="text-xs text-2">custo de {fmtBRL(ch)}/ha ÷ {fmtNumber(pr)} {unidadeNome(unidade, 2)}/ha · equivale a {fmtNumber(Math.round(ch / M * 10) / 10)} {unidadeNome(unidade, 2)}/ha a {fmtBRL(M)} · lucro esperado de {fmtPct(margem, 1)} por {u}</span>
      </div>
      {insuficiente && <p className="text-sm text-danger" style={{ fontWeight: 600 }}>Margem insuficiente: o preço esperado não cobre o custo mais o mínimo do investidor. O fundo não deve aprovar este talhão.</p>}
      <div className="regras-comparacao">
        <p className="label-xs">Quem compra hoje (R$ {precoHoje.toFixed(2).replace(".", ",")} por {u}) e recebe em ~{restantes} dias</p>
        <div className="regras-comparacao-linhas">
          <span><b className="text-success">{fmtPct(g.minimoPct, 2)}</b> mínimo garantido</span>
          <span><b className="text-success">{fmtPct(g.esperadoPct, 2)}</b> esperado</span>
          <span><b>{fmtPct(alt.lca, 2)}</b> LCA</span>
          <span><b>{fmtPct(alt.cdb, 2)}</b> CDB, após IR</span>
          <span><b>{fmtPct(alt.poupanca, 2)}</b> poupança</span>
        </div>
      </div>
      <p className="regras-sub">O lucro de cada {u} (venda − custo) é dividido</p>
      <div className="regras-divisao">
        <div><ul>
          <li><span>Fazenda</span><strong>{fmtPct(R.lucro_fazenda_pct)}</strong></li>
          <li><span>Investidor</span><strong className="text-success">{fmtPct(R.lucro_investidor_pct)}</strong></li>
          <li><span>Plataforma</span><strong>{fmtPct(R.lucro_plataforma_pct)}</strong></li>
        </ul></div>
        <div><p className="label-xs">Como o app ganha</p><ul>
          <li><span>Na entrada (paga pela fazenda)</span><strong>{fmtPct(R.estruturacao_pct)} do captado</strong></li>
          <li><span>Na saída</span><strong>{fmtPct(R.lucro_plataforma_pct)} do lucro</strong></li>
          <li><span>Custódia (armazém) · gestão (fundo)</span><strong>{fmtPct(R.custodia_armazem_pct + R.gestao_fundo_pct, 2)}</strong></li>
          <li><span>Toda saca além das financiadas</span><strong>é da fazenda</strong></li>
        </ul></div>
      </div>
      <div className="fin-table-wrap" style={{ display: "block" }}>
        <table className="fin-table regras-tabela">
          <thead><tr><th>Venda da {u}</th><th className="num">Investidor*</th><th className="num">Fazenda por ha</th>{area ? <th className="num hide-sm">Fazenda no talhão</th> : null}<th className="num hide-sm">Plataforma</th></tr></thead>
          <tbody>{cenarios.map((c) => (
            <tr key={c.pv} style={{ cursor: "default" }} className={c.pv === M ? "is-atual" : undefined}>
              <td>{fmtBRL(c.pv)}{c.pv === M && <span className="badge badge--info" style={{ marginLeft: 6 }}>esperado</span>}</td>
              <td className="num"><strong className="text-success">{fmtPct(c.invPct, 2)}</strong></td>
              <td className={`num ${c.fazHa >= 0 ? "" : "text-danger"}`}>{fmtBRL(c.fazHa)}</td>
              {area ? <td className={`num hide-sm ${c.fazHa >= 0 ? "" : "text-danger"}`}>{fmtBRL(c.fazHa * area)}</td> : null}
              <td className="num hide-sm">{fmtPct(c.appPct, 2)}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="text-xs text-3">* O investidor não paga taxa para entrar nem para sair.</p>
      {paraFazenda && <p className="text-xs text-3">Resultado da fazenda sobre as sacas financiadas, já descontados o mínimo do investidor (quando acionado), a parte do lucro e as taxas; a armazenagem também fica com a fazenda. Produzindo acima de {fmtNumber(pr)} {unidadeNome(unidade, 2)}/ha, o excedente é todo da fazenda.</p>}
      <p className="regras-nota"><Info size={14} aria-hidden /> O mínimo do investidor ({R.min_pct_cdi}% do CDI no prazo) é garantido pela fazenda e pelo grão no armazém; não é coberto pelo FGC. <Link to="/como-funciona">Como funciona</Link></p>
    </div>
  );
}
