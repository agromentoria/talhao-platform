// Valores em reais no padrão brasileiro (R$ 70.224,00) para textos de avisos
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmtBRL(n) {
  return brl.format(Number(n || 0));
}
module.exports = { fmtBRL };
