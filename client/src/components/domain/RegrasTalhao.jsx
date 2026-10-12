import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { fmtBRL, fmtPct } from "../../lib/format";
import { dividirLucro } from "../../lib/divisaoLucro";
import { unidadeNome, fasesDe } from "../../config/culturas";

// meses entre duas datas (mínimo de 1)
function meses(de, ate) {
  if (!de || !ate) return null;
  const a = new Date(String(de).slice(0, 10) + "T12:00:00"), b = new Date(String(ate).slice(0, 10) + "T12:00:00");
  const m = (b - a) / (1000 * 60 * 60 * 24 * 30.44);
  return m > 0 ? Math.max(1, m) : null;
}
const aoAno = (pct, m) => (m ? (Math.pow(1 + pct / 100, 12 / m) - 1) * 100 : null);

/**
 * Quadro único com as regras de um talhão, calculado com os números dele:
 * meta de venda, ganho do investidor por fase, divisão do lucro até e acima
 * da meta e efeito da armazenagem. Usado no cadastro (fazenda), na página do
 * talhão (investidor) e na aprovação (administração).
 */
export default function RegrasTalhao({
  precoRef, metaPct, perfPct = 0, comissaoFazendaPct = 0, appPct = 5, multiplicadores = {}, despesaInvestidorUnidade = 0,
  unidade = "saca", tipoProducao, inicioCiclo, fimCiclo, quinzenasArmazem = 0, faseAtual = null, compact = false,
}) {
  const p = Number(precoRef) || 0;
  const r = Number(metaPct) || 0;
  if (!(p > 0)) return null;
  const u = unidadeNome(unidade, 1);
  const meta = p * (1 + r / 100);
  const fases = fasesDe({ tipo_producao: tipoProducao });
  const hoje = new Date().toISOString().slice(0, 10);
  const fimRecebimento = fimCiclo ? new Date(new Date(String(fimCiclo).slice(0, 10)).getTime() + (quinzenasArmazem * 15 + 15) * 86400000).toISOString().slice(0, 10) : null;

  // data provável de compra em cada fase: hoje (preparo), início do ciclo
  // (plantio) e pontos ao longo do ciclo para as fases seguintes
  const dataCompra = (f) => {
    if (f === 0 || !inicioCiclo || !fimCiclo) return hoje;
    const ini = new Date(String(inicioCiclo).slice(0, 10)).getTime();
    const fim = new Date(String(fimCiclo).slice(0, 10)).getTime();
    const frac = { 1: 0, 2: 0.25, 3: 0.5, 4: 0.85 }[f] ?? 0;
    const d = new Date(ini + (fim - ini) * frac).toISOString().slice(0, 10);
    return d < hoje ? hoje : d;
  };

  // ganho líquido do investidor comprando em cada fase, com venda na meta
  const linhas = [0, 1, 2, 3, 4].map((f) => {
    const m = Number(multiplicadores[f] ?? 1);
    const pago = p * m;
    const x = dividirLucro({ cotas: 1, valorInvestido: pago, precoReferencia: p, retornoPrometidoPct: r, precoVenda: meta,
      despesa: despesaInvestidorUnidade, comissaoFazendaPct, comissaoAppPct: appPct, performancePct: perfPct });
    const liquidoPct = ((x.valorLiquido - pago) / pago) * 100;
    // prazo: da data provável da compra em cada fase até o recebimento
    const prazo = meses(dataCompra(f), fimRecebimento);
    return { f, nome: fases[f], m, pago, recebe: x.valorLiquido, liquidoPct, prazo, anual: aoAno(liquidoPct, prazo) };
  });
  const ex = dividirLucro({ cotas: 100, valorInvestido: 100 * p, precoReferencia: p, retornoPrometidoPct: r, precoVenda: p * (1 + (r + 10) / 100),
    despesa: 100 * despesaInvestidorUnidade, comissaoFazendaPct, comissaoAppPct: appPct, performancePct: perfPct });
  const exMeta = dividirLucro({ cotas: 100, valorInvestido: 100 * p, precoReferencia: p, retornoPrometidoPct: r, precoVenda: meta,
    despesa: 100 * despesaInvestidorUnidade, comissaoFazendaPct, comissaoAppPct: appPct, performancePct: perfPct });
  const invAteMeta = 100 - comissaoFazendaPct - appPct;
  const invAcima = Math.max(0, 100 - (perfPct > 0 ? perfPct : comissaoFazendaPct) - appPct);
  const visiveis = compact ? linhas.filter((l) => l.f === (faseAtual ?? 0)) : linhas;

  return (
    <div className="regras">
      <div className="regras-meta">
        <span className="label-xs">Meta de venda</span>
        <strong>{fmtBRL(meta)} por {u}</strong>
        <span className="text-xs text-2">preço de referência {fmtBRL(p)} + retorno prometido de {fmtPct(r)}</span>
      </div>

      <p className="regras-sub">Se a venda sair na meta, quem compra em cada fase recebe:</p>
      <div className="fin-table-wrap" style={{ display: "block" }}>
        <table className="fin-table regras-tabela">
          <thead><tr>
            <th><span className="hide-sm">Fase da compra</span><span className="show-sm">Fase</span></th>
            <th className="num"><span className="hide-sm">Paga por {u}</span><span className="show-sm">Paga</span></th>
            <th className="num hide-sm">Recebe</th>
            <th className="num"><span className="hide-sm">Ganho líquido</span><span className="show-sm">Ganho</span></th>
            <th className="num">Ao ano*</th>
          </tr></thead>
          <tbody>
            {visiveis.map((l) => (
              <tr key={l.f} className={faseAtual === l.f ? "is-atual" : undefined} style={{ cursor: "default" }}>
                <td>{l.nome}{faseAtual === l.f && <span className="badge badge--info" style={{ marginLeft: 6 }}>agora</span>}</td>
                <td className="num">{fmtBRL(l.pago)}</td>
                <td className="num hide-sm">{fmtBRL(l.recebe)}</td>
                <td className={`num ${l.liquidoPct >= 0 ? "text-success" : "text-danger"}`}><strong>{fmtPct(l.liquidoPct, 2)}</strong></td>
                <td className="num">{l.anual != null ? `${fmtPct(l.anual, 1)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-3" style={{ marginTop: 6 }}>
        Já descontadas as comissões{despesaInvestidorUnidade > 0 ? ` e a armazenagem do investidor (${fmtBRL(despesaInvestidorUnidade)} por ${u})` : ""}.
        {" "}* Taxa equivalente ao ano, considerando o recebimento cerca de {quinzenasArmazem ? `${quinzenasArmazem * 15 + 15} dias` : "15 dias"} após o fim do ciclo{fimCiclo ? "" : " (informe as datas do ciclo para calcular)"}.
      </p>

      <p className="regras-sub">Quem fica com o lucro</p>
      <div className="regras-divisao">
        <div>
          <p className="label-xs">Até a meta ({fmtBRL(meta)})</p>
          <ul>
            <li><span>Investidor</span><strong className="text-success">{fmtPct(invAteMeta)}</strong></li>
            <li><span>Fazenda (comissão)</span><strong>{fmtPct(comissaoFazendaPct)}</strong></li>
            <li><span>Plataforma</span><strong>{fmtPct(appPct)}</strong></li>
          </ul>
        </div>
        <div>
          <p className="label-xs">Acima da meta</p>
          <ul>
            <li><span>Investidor</span><strong className="text-success">{fmtPct(invAcima)}</strong></li>
            <li><span>Fazenda ({perfPct > 0 ? "performance" : "comissão"})</span><strong>{fmtPct(perfPct > 0 ? perfPct : comissaoFazendaPct)}</strong></li>
            <li><span>Plataforma</span><strong>{fmtPct(appPct)}</strong></li>
          </ul>
        </div>
      </div>

      {!compact && (
        <div className="regras-exemplo">
          <p className="label-xs">Exemplo com 100 {unidadeNome(unidade, 2)} compradas a {fmtBRL(p)} ({fmtBRL(100 * p)})</p>
          <dl className="kv" style={{ margin: "6px 0 0" }}>
            <div><dt>Venda na meta ({fmtBRL(meta)})</dt><dd>investidor lucra {fmtBRL(exMeta.valorLiquido - 100 * p)} · fazenda {fmtBRL(exMeta.comissaoFazenda)}</dd></div>
            <div><dt>Venda 10 pontos acima ({fmtBRL(p * (1 + (r + 10) / 100))})</dt><dd>investidor lucra {fmtBRL(ex.valorLiquido - 100 * p)} · fazenda {fmtBRL(ex.comissaoFazenda)}</dd></div>
          </dl>
        </div>
      )}

      <p className="regras-nota">
        <Info size={14} aria-hidden /> As comissões incidem só sobre o lucro, nunca sobre o valor investido. Se a venda sair abaixo do que o investidor pagou, não há comissão.{" "}
        <Link to="/como-funciona">Como funciona</Link>
      </p>
    </div>
  );
}
