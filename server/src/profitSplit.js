// Divisão do lucro de um investimento na colheita.
//
// 1) Lucro até a meta: a meta é o retorno prometido pela fazenda no talhão
//    (preço de referência × (1 + retorno prometido)). Esse lucro segue a
//    regra padrão: comissão da fazenda + comissão do app, o resto ao investidor.
// 2) Excedente: o lucro que passar do lucro da meta (já descontada a
//    armazenagem, quando o investidor paga). A fazenda fica com o
//    percentual de performance que ela definiu no talhão (validado pela
//    administração e mostrado ao investidor antes da compra); o app mantém a
//    comissão dele; o resto é do investidor.
//
// Mesma conta em client/src/lib/divisaoLucro.js (prévia na tela).
function dividirLucro({ cotas, valorInvestido, precoReferencia, retornoPrometidoPct, precoVenda, despesa = 0,
  comissaoFazendaPct, comissaoAppPct, performancePct = 0 }) {
  const valorBruto = cotas * precoVenda;
  const lucro = valorBruto - despesa - valorInvestido;
  const valorMeta = cotas * precoReferencia * (1 + retornoPrometidoPct / 100);
  // lucro que o investidor teria se a venda saísse exatamente na meta; só o
  // que passar disso (já descontada a armazenagem) é excedente
  const lucroMeta = Math.max(0, valorMeta - valorInvestido);
  const excedente = performancePct > 0 ? Math.max(0, lucro - lucroMeta) : 0;
  const lucroBase = Math.max(0, lucro - excedente);

  const comissaoFazendaBase = lucroBase * (comissaoFazendaPct / 100);
  const performanceFazenda = excedente * (performancePct / 100);
  const comissaoApp = (lucroBase + excedente) * (comissaoAppPct / 100);
  const comissaoFazenda = comissaoFazendaBase + performanceFazenda;
  const valorLiquido = valorBruto - despesa - comissaoFazenda - comissaoApp;

  return { valorBruto, lucro, valorMeta, lucroMeta, excedente, lucroBase, comissaoFazendaBase, performanceFazenda, comissaoFazenda, comissaoApp, valorLiquido };
}

const PERFORMANCE_MAX = 70;

module.exports = { dividirLucro, PERFORMANCE_MAX };
