// Formatação no padrão brasileiro para textos de avisos
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
function fmtBRL(n) {
  return brl.format(Number(n || 0));
}
function fmtNumber(n) {
  return num.format(Number(n || 0));
}
module.exports = { fmtBRL, fmtNumber };
