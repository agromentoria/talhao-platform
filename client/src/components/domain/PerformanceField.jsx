import { TrendingUp } from "lucide-react";
import { TextField } from "../ui";
import { fmtBRL, fmtPct } from "../../lib/format";
import { unidadeNome } from "../../config/culturas";
import { dividirLucro, PERFORMANCE_MAX } from "../../lib/divisaoLucro";

// Participação da fazenda no lucro que passar da meta (retorno prometido).
// Mostra um exemplo com os números do próprio talhão.
export default function PerformanceField({ value, onChange, precoReferencia, retornoPct, comissaoFazendaPct = 0, comissaoAppPct = 5, unidade = "saca" }) {
  const p = Number(precoReferencia) || 0;
  const r = Number(retornoPct) || 0;
  const perf = Number(value) || 0;
  const u = unidadeNome(unidade, 1);
  const exemplo = p > 0 ? (() => {
    const precoVenda = p * (1 + (r + 10) / 100); // venda 10 pontos acima da meta
    const base = { cotas: 100, valorInvestido: 100 * p, precoReferencia: p, retornoPrometidoPct: r, precoVenda, comissaoFazendaPct, comissaoAppPct };
    return { precoVenda, sem: dividirLucro({ ...base, performancePct: 0 }), com: dividirLucro({ ...base, performancePct: perf }) };
  })() : null;

  return (
    <div className="span-all card card--well" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="card-title" style={{ display: "flex", gap: 6, alignItems: "center" }}><TrendingUp size={16} aria-hidden /> Performance acima da meta</p>
      <p className="text-sm text-2">
        Até o retorno prometido ({fmtPct(r)}), o lucro segue a divisão padrão. Se a venda passar da meta, a fazenda fica com o percentual abaixo do lucro excedente.
        A administração valida a regra e o investidor vê antes de comprar.
      </p>
      <TextField label="Sua participação no excedente (%)" type="number" inputMode="decimal" min={0} max={PERFORMANCE_MAX} step="1"
        value={value} onChange={onChange} hint={`De 0% (todo o excedente vai para os investidores) até ${PERFORMANCE_MAX}%.`} />
      {exemplo && perf > 0 && (
        <p className="text-sm">
          Exemplo com 100 {unidadeNome(unidade, 2)} vendidas a {fmtBRL(exemplo.precoVenda)} por {u} (10 pontos acima da meta):
          a fazenda recebe <strong>{fmtBRL(exemplo.com.comissaoFazenda)}</strong> em vez de {fmtBRL(exemplo.sem.comissaoFazenda)},
          e o investidor <strong>{fmtBRL(exemplo.com.valorLiquido - 100 * p)}</strong> de lucro em vez de {fmtBRL(exemplo.sem.valorLiquido - 100 * p)}.
        </p>
      )}
    </div>
  );
}
