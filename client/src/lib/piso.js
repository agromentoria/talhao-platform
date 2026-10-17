// Espelho no app da regra do piso (server/src/piso.js) — mesma conta.
export const PISO_PADRAO = {
  cdi_aa: 13.65, piso_pct_cdi: 95, estruturacao_pct: 1.0, custodia_armazem_pct: 0.15, gestao_fundo_pct: 0.15,
  excedente_investidor_pct: 30, excedente_fazenda_pct: 60, excedente_plataforma_pct: 10, dias_pos_colheita: 30,
};
const VOL_AA = 0.20; // volatilidade de preço usada só para o valor ESPERADO da alta

export const ehPiso = (plot) => plot?.modelo === "piso";

export function prazoDias(colheitaPrevista, regras = PISO_PADRAO, desde = new Date()) {
  if (!colheitaPrevista) return null;
  const fim = new Date(String(colheitaPrevista).slice(0, 10) + "T12:00:00Z").getTime() + regras.dias_pos_colheita * 86400000;
  return Math.max(30, Math.round((fim - desde.getTime()) / 86400000));
}

export function pisoPct(dias, regras = PISO_PADRAO) {
  const taxa = (regras.piso_pct_cdi / 100) * regras.cdi_aa;
  return Math.round(((Math.pow(1 + taxa / 100, dias / 365) - 1) * 100) * 100) / 100;
}

export const taxasFazendaPct = (regras = PISO_PADRAO) => regras.estruturacao_pct + regras.custodia_armazem_pct + regras.gestao_fundo_pct;

export function dividirPiso({ cotas, precoReferencia, pisoPct: piso, precoVenda }, regras = PISO_PADRAO) {
  const valorPiso = cotas * precoReferencia * (1 + piso / 100);
  const valorVenda = cotas * precoVenda;
  const excedente = Math.max(0, valorVenda - valorPiso);
  return {
    valorPiso, valorVenda, excedente,
    investidor: valorPiso + excedente * regras.excedente_investidor_pct / 100,
    plataforma: excedente * regras.excedente_plataforma_pct / 100,
    fazendaExcedente: excedente * regras.excedente_fazenda_pct / 100,
    aporteFazenda: Math.max(0, valorPiso - valorVenda),
  };
}

// alta esperada acima do preço-piso (% do preço de referência), supondo que o
// preço futuro não tem viés e oscila com volatilidade de 20% ao ano
function N(x) { const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
export function altaEsperadaPct(piso, dias) {
  const s = VOL_AA * Math.sqrt(Math.max(1, dias) / 365), K = 1 + piso / 100;
  const d1 = (Math.log(1 / K) + 0.5 * s * s) / s, d2 = d1 - s;
  return (N(d1) - K * N(d2)) * 100;
}

// ganho do investidor que compra a `precoPago` (fase em que entrou)
export function ganhoInvestidor({ precoReferencia, precoPago, piso, dias }, regras = PISO_PADRAO) {
  const minimo = precoReferencia * (1 + piso / 100);
  const esperado = minimo + precoReferencia * altaEsperadaPct(piso, dias) / 100 * regras.excedente_investidor_pct / 100;
  return { minimo, esperado, minimoPct: (minimo / precoPago - 1) * 100, esperadoPct: (esperado / precoPago - 1) * 100 };
}

// preço da saca no dia `t` (dias desde a abertura): sobe na taxa do piso
export function precoNoDia(precoReferencia, piso, diasTotal, t) {
  const frac = diasTotal ? Math.min(1, Math.max(0, t) / diasTotal) : 0;
  return precoReferencia * Math.pow(1 + piso / 100, frac);
}
export function diasDesde(data) {
  return data ? Math.max(0, (Date.now() - new Date(data).getTime()) / 86400000) : 0;
}
