import { Link } from "react-router-dom";
import { ShieldCheck, Info } from "lucide-react";
import { fmtBRL, fmtPct } from "../../lib/format";
import { unidadeNome } from "../../config/culturas";
import { useRegras, rendimentoNoPrazo, REFERENCIAS_PADRAO } from "../../lib/referencias";
import { PISO_PADRAO, prazoDias, pisoPct as calcPiso, ganhoInvestidor, taxasFazendaPct, precoNoDia, diasDesde } from "../../lib/piso";

// Quadro de regras do produto com piso: renda mínima garantida + parte da alta.
// Usado no cadastro (fazenda), na página do talhão (investidor) e na aprovação (fundo).
export default function RegrasPiso({ precoRef, piso, pisoDias, publicadoEm, colheitaPrevista, unidade = "saca", compact = false, paraFazenda = false }) {
  const regras = useRegras();
  const R = regras?.piso || PISO_PADRAO;
  const ref = regras?.referencias || REFERENCIAS_PADRAO;
  const p = Number(precoRef) || 0;
  if (!(p > 0)) return null;
  const total = Number(pisoDias) || prazoDias(colheitaPrevista, R) || 150;
  const pp = piso != null && piso !== "" ? Number(piso) : calcPiso(total, R);
  const decorridos = diasDesde(publicadoEm);
  const restantes = Math.max(1, Math.round(total - decorridos));
  const u = unidadeNome(unidade, 1);
  const precoPiso = p * (1 + pp / 100);
  const dias = restantes;
  const alt = rendimentoNoPrazo(dias, ref);
  // quem compra hoje e nos próximos meses: o preço sobe com o tempo na taxa do piso
  const momentos = [0, 30, 60, 90].filter((k) => k === 0 || decorridos + k < total - 15);
  const linhas = momentos.map((k) => {
    const t = decorridos + k;
    const pago = precoNoDia(p, pp, total, t);
    const falta = Math.max(1, Math.round(total - t));
    return { k, nome: k === 0 ? "Hoje" : `Daqui a ${k} dias`, pago, falta, ...ganhoInvestidor({ precoReferencia: p, precoPago: pago, piso: pp, dias: falta }, R) };
  });
  const visiveis = compact ? linhas.slice(0, 1) : linhas;
  const base = linhas[0];
  const custoFazenda = pp + taxasFazendaPct(R);
  const bancoLo = (Math.pow(1.17, total / 365) - 1) * 100, bancoHi = (Math.pow(1.20, total / 365) - 1) * 100;

  return (
    <div className="regras">
      <div className="regras-meta">
        <span className="label-xs" style={{ display: "flex", gap: 6, alignItems: "center" }}><ShieldCheck size={14} aria-hidden /> Renda mínima garantida</span>
        <strong>{fmtBRL(precoPiso)} por {u}</strong>
        <span className="text-xs text-2">piso de {fmtPct(pp, 2)} na safra ({R.piso_pct_cdi}% do CDI em ~{total} dias), pago pela fazenda mesmo se o preço cair</span>
      </div>

      <p className="regras-sub">O preço da {u} sobe com o tempo, na taxa do piso. Quem compra em qualquer dia recebe:</p>
      <div className="fin-table-wrap" style={{ display: "block" }}>
        <table className="fin-table regras-tabela">
          <thead><tr>
            <th>Compra</th>
            <th className="num"><span className="hide-sm">Paga por {u}</span><span className="show-sm">Paga</span></th>
            <th className="num">Mínimo</th>
            <th className="num"><span className="hide-sm">Esperado*</span><span className="show-sm">Esperado*</span></th>
          </tr></thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.k} className={l.k === 0 ? "is-atual" : undefined} style={{ cursor: "default" }}>
                <td>{l.nome}<br /><span className="text-xs text-3">recebe em ~{l.falta} dias</span></td>
                <td className="num">{fmtBRL(l.pago)}</td>
                <td className="num"><strong className="text-success">{fmtPct(l.minimoPct, 2)}</strong></td>
                <td className="num">{fmtPct(l.esperadoPct, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-3">* Esperado: mínimo + {R.excedente_investidor_pct}% da alta média do preço (estimativa, não garantia). Quem compra mais tarde paga mais caro e recebe antes: o mínimo continua sendo {R.piso_pct_cdi}% do CDI pelo prazo que falta.</p>

      <div className="regras-comparacao">
        <p className="label-xs">No mesmo prazo de ~{dias} dias, o mesmo dinheiro renderia</p>
        <div className="regras-comparacao-linhas">
          <span><b className="text-success">{fmtPct(base.minimoPct, 2)} a {fmtPct(base.esperadoPct, 2)}</b> Meu Talhão</span>
          <span><b>{fmtPct(alt.lca, 2)}</b> LCA ({ref.lca_pct_cdi}% do CDI, isenta)</span>
          <span><b>{fmtPct(alt.cdb, 2)}</b> CDB, após IR</span>
          <span><b>{fmtPct(alt.poupanca, 2)}</b> poupança</span>
        </div>
      </div>

      <p className="regras-sub">Se a venda passar de {fmtBRL(precoPiso)} por {u}</p>
      <div className="regras-divisao">
        <div>
          <p className="label-xs">A alta é dividida</p>
          <ul>
            <li><span>Investidor</span><strong className="text-success">{fmtPct(R.excedente_investidor_pct)}</strong></li>
            <li><span>Fazenda</span><strong>{fmtPct(R.excedente_fazenda_pct)}</strong></li>
            <li><span>Plataforma</span><strong>{fmtPct(R.excedente_plataforma_pct)}</strong></li>
          </ul>
        </div>
        <div>
          <p className="label-xs">A fazenda paga sobre o captado</p>
          <ul>
            <li><span>Estruturação (plataforma)</span><strong>{fmtPct(R.estruturacao_pct)}</strong></li>
            <li><span>Custódia (armazém)</span><strong>{fmtPct(R.custodia_armazem_pct)}</strong></li>
            <li><span>Gestão (fundo)</span><strong>{fmtPct(R.gestao_fundo_pct)}</strong></li>
          </ul>
        </div>
      </div>

      {paraFazenda && (
        <div className="regras-exemplo">
          <p className="label-xs">Custo do dinheiro para a fazenda na safra</p>
          <p className="text-sm" style={{ marginTop: 4 }}>
            <strong>{fmtPct(custoFazenda, 2)}</strong> se o preço não subir (piso + taxas, sem contar a armazenagem, que também fica com a fazenda) ·
            crédito bancário livre no mesmo prazo: {fmtPct(bancoLo, 2)} a {fmtPct(bancoHi, 2)} · e a fazenda fica com {fmtPct(R.excedente_fazenda_pct)} de toda alta.
          </p>
        </div>
      )}

      <p className="regras-nota">
        <Info size={14} aria-hidden /> A fazenda garante o mínimo como num título prefixado (CPR financeira); o grão fica no armazém credenciado. O risco que continua existindo é o de crédito da fazenda.{" "}
        <Link to="/como-funciona">Como funciona</Link>
      </p>
    </div>
  );
}
