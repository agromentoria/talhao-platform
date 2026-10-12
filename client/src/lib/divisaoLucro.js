// Mesma conta de server/src/profitSplit.js, para prévias na tela.
export function dividirLucro({ cotas, valorInvestido, precoReferencia, retornoPrometidoPct, precoVenda, despesa = 0,
  comissaoFazendaPct, comissaoAppPct, performancePct = 0 }) {
  const valorBruto = cotas * precoVenda;
  const lucro = valorBruto - despesa - valorInvestido;
  const valorMeta = cotas * precoReferencia * (1 + retornoPrometidoPct / 100);
  const lucroMeta = Math.max(0, valorMeta - valorInvestido);
  const excedente = performancePct > 0 ? Math.max(0, lucro - lucroMeta) : 0;
  const lucroBase = Math.max(0, lucro - excedente);
  const performanceFazenda = excedente * (performancePct / 100);
  const comissaoFazenda = lucroBase * (comissaoFazendaPct / 100) + performanceFazenda;
  const comissaoApp = (lucroBase + excedente) * (comissaoAppPct / 100);
  const valorLiquido = valorBruto - despesa - comissaoFazenda - comissaoApp;
  return { valorBruto, lucro, valorMeta, lucroMeta, excedente, lucroBase, performanceFazenda, comissaoFazenda, comissaoApp, valorLiquido };
}
export const PERFORMANCE_MAX = 70;
