// Produto com PISO (v2): o investidor recebe no mínimo o preço-piso
// (referência × (1 + piso)), pago pela fazenda como num título prefixado, e
// o que a venda passar do preço-piso é dividido entre investidor, fazenda e
// plataforma. A fazenda paga as taxas sobre o valor captado e a armazenagem.
const num = (k, d) => (process.env[k] !== undefined && !Number.isNaN(Number(process.env[k])) ? Number(process.env[k]) : d);

const REGRAS = {
  cdi_aa: num("REF_CDI_AA", 13.65),
  piso_pct_cdi: num("PISO_PCT_CDI", 95),
  estruturacao_pct: num("PISO_ESTRUTURACAO_PCT", 1.0),
  custodia_armazem_pct: num("PISO_CUSTODIA_ARMAZEM_PCT", 0.15),
  gestao_fundo_pct: num("PISO_GESTAO_FUNDO_PCT", 0.15),
  excedente_investidor_pct: num("PISO_EXC_INVESTIDOR_PCT", 30),
  excedente_fazenda_pct: num("PISO_EXC_FAZENDA_PCT", 60),
  excedente_plataforma_pct: num("PISO_EXC_PLATAFORMA_PCT", 10),
  dias_pos_colheita: num("PISO_DIAS_POS_COLHEITA", 30), // colheita + venda até o pagamento
};

// aceita "2027-03-20" ou um Date vindo do banco (coluna DATE)
const dia = (d) => new Date((d instanceof Date ? d.toISOString() : String(d)).slice(0, 10) + "T12:00:00Z");

// prazo da safra em dias: da abertura da captação até o pagamento previsto
function prazoDias(colheitaPrevista, desde = new Date()) {
  if (!colheitaPrevista) return null;
  const fim = dia(colheitaPrevista).getTime() + REGRAS.dias_pos_colheita * 86400000;
  return Math.max(30, Math.round((fim - dia(desde).getTime()) / 86400000));
}

// piso = X% do CDI, composto no prazo da safra
function pisoPct(dias) {
  const taxa = (REGRAS.piso_pct_cdi / 100) * REGRAS.cdi_aa;
  return Math.round(((Math.pow(1 + taxa / 100, dias / 365) - 1) * 100) * 100) / 100;
}

const taxasFazendaPct = () => REGRAS.estruturacao_pct + REGRAS.custodia_armazem_pct + REGRAS.gestao_fundo_pct;

// divisão de uma venda: unidades de um investidor, preço de referência,
// piso (%), preço real de venda
function dividirPiso({ cotas, precoReferencia, pisoPct: piso, precoVenda }) {
  const valorPiso = cotas * precoReferencia * (1 + piso / 100);
  const valorVenda = cotas * precoVenda;
  const excedente = Math.max(0, valorVenda - valorPiso);
  const investidor = valorPiso + excedente * REGRAS.excedente_investidor_pct / 100;
  const plataforma = excedente * REGRAS.excedente_plataforma_pct / 100;
  const fazendaExcedente = excedente * REGRAS.excedente_fazenda_pct / 100;
  const aporteFazenda = Math.max(0, valorPiso - valorVenda); // a fazenda cobre o piso quando a venda não chega
  return { valorPiso, valorVenda, excedente, investidor, plataforma, fazendaExcedente, aporteFazenda };
}

module.exports = { REGRAS, prazoDias, pisoPct, taxasFazendaPct, dividirPiso };

// Pagamento completo de uma colheita no modelo com piso — a MESMA conta é
// usada na prévia do fundo e no pagamento real. Fecha com o valor de venda:
// investidores + plataforma + armazém + fundo + fazenda (líquido) = venda.
function calcularPagamentoPiso(plot, investments, precoVenda, { despesaArmazenagem = 0 } = {}) {
  const linhas = investments.map((inv) => ({ inv, ...dividirPiso({ cotas: Number(inv.cotas), precoReferencia: Number(plot.preco_venda_estimado), pisoPct: Number(plot.piso_pct) || 0, precoVenda }) }));
  const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
  const captado = investments.reduce((s, i) => s + Number(i.valor_investido), 0);
  const estruturacao = captado * REGRAS.estruturacao_pct / 100;
  const custodia = captado * REGRAS.custodia_armazem_pct / 100;
  const gestao = captado * REGRAS.gestao_fundo_pct / 100;
  const investidores = soma("investidor");
  const plataformaExcedente = soma("plataforma");
  const fazendaExcedente = soma("fazendaExcedente");
  const aportePiso = soma("aporteFazenda");
  const fazendaLiquido = fazendaExcedente - estruturacao - custodia - gestao - despesaArmazenagem - aportePiso;
  return {
    modelo: "piso", linhas, captado, valorVenda: soma("valorVenda"), valorPiso: soma("valorPiso"), excedente: soma("excedente"),
    investidores, plataforma: plataformaExcedente + estruturacao, plataformaExcedente, estruturacao,
    armazem: custodia + despesaArmazenagem, custodia, armazenagem: despesaArmazenagem, fundo: gestao,
    fazendaExcedente, aportePiso, fazendaLiquido,
  };
}

module.exports.calcularPagamentoPiso = calcularPagamentoPiso;

// Preço da saca no produto com piso: sobe com o TEMPO na taxa do piso (como
// um título que rende dia a dia), e não por fase. Assim quem compra em
// qualquer dia tem o mesmo piso de X% do CDI pelo prazo que falta.
function diasDecorridos(plot, agora = new Date()) {
  if (!plot.publicado_em) return 0;
  return Math.max(0, (agora.getTime() - new Date(plot.publicado_em).getTime()) / 86400000);
}
function precoAtualPiso(plot, agora = new Date()) {
  const P = plot.modelo === "custo" ? Number(plot.custo_saca) : Number(plot.preco_venda_estimado);
  const dias = Number(plot.piso_dias) || 0;
  if (!dias || !plot.publicado_em) return P;
  const frac = Math.min(1, diasDecorridos(plot, agora) / dias);
  return Math.round(P * Math.pow(1 + (Number(plot.piso_pct) || 0) / 100, frac) * 100) / 100;
}
function diasRestantes(plot, agora = new Date()) {
  return Math.max(1, Math.round((Number(plot.piso_dias) || 0) - diasDecorridos(plot, agora)));
}
// aplica o preço do dia nas respostas da API (vitrine, página do talhão)
function comPrecoDoDia(plot) {
  if (!plot || (plot.modelo !== "piso" && plot.modelo !== "custo")) return plot;
  return { ...plot, cota_valor: precoAtualPiso(plot), piso_dias_restantes: diasRestantes(plot) };
}
Object.assign(module.exports, { precoAtualPiso, diasRestantes, comPrecoDoDia });

// =====================================================================
// Modelo "Custo + Lucro" (v3): o investidor paga o CUSTO de produção por
// saca; na venda, o lucro (preço − custo) é dividido 30% investidor ·
// 65% fazenda · 5% plataforma. Mínimo do investidor = 90% do CDI no prazo
// (equivalente à LCA), garantido pela fazenda. A fazenda paga 0,5% de
// estruturação, 0,15% de custódia e 0,15% de gestão sobre o captado.
// =====================================================================
const CUSTO = {
  min_pct_cdi: num("CUSTO_MIN_PCT_CDI", 90),
  lucro_investidor_pct: num("CUSTO_LUCRO_INVESTIDOR_PCT", 30),
  lucro_fazenda_pct: num("CUSTO_LUCRO_FAZENDA_PCT", 65),
  lucro_plataforma_pct: num("CUSTO_LUCRO_PLATAFORMA_PCT", 5),
  // ENTRADA: taxa de sucesso sobre o captado, paga pela fazenda a cada compra (como no mercado de crowdfunding)
  estruturacao_pct: num("CUSTO_ESTRUTURACAO_PCT", 1.0),
  // SAÍDA: o app fica com 5% do lucro (lucro_plataforma_pct). Taxa de desempenho
  // sobre o ganho do investidor desligada por padrão, para manter só duas taxas.
  desempenho_pct: num("CUSTO_DESEMPENHO_PCT", 0),
  custodia_armazem_pct: num("CUSTO_CUSTODIA_ARMAZEM_PCT", 0.15),
  gestao_fundo_pct: num("CUSTO_GESTAO_FUNDO_PCT", 0.15),
};
function minimoPct(dias) {
  const taxa = (CUSTO.min_pct_cdi / 100) * REGRAS.cdi_aa;
  return Math.round(((Math.pow(1 + taxa / 100, dias / 365) - 1) * 100) * 100) / 100;
}
function dividirCusto({ cotas, custoSaca, minimoPct: mn, precoVenda }) {
  const base = cotas * custoSaca;
  const valorMinimo = base * (1 + mn / 100);
  const valorVenda = cotas * precoVenda;
  const lucro = Math.max(0, valorVenda - base);
  const porLucro = base + lucro * CUSTO.lucro_investidor_pct / 100;
  const bruto = Math.max(valorMinimo, porLucro);
  const desempenho = Math.max(0, bruto - valorMinimo) * CUSTO.desempenho_pct / 100; // só acima do mínimo
  const investidor = bruto - desempenho;
  const plataforma = lucro * CUSTO.lucro_plataforma_pct / 100 + desempenho;
  return { base, valorMinimo, valorVenda, lucro, investidor, plataforma, desempenho, plataformaLucro: lucro * CUSTO.lucro_plataforma_pct / 100, minimoAtivo: valorMinimo >= porLucro };
}
function calcularPagamentoCusto(plot, investments, precoVenda, { despesaArmazenagem = 0 } = {}) {
  const custoSaca = Number(plot.custo_saca) || Number(plot.preco_venda_estimado);
  const linhas = investments.map((inv) => ({ inv, ...dividirCusto({ cotas: Number(inv.cotas), custoSaca, minimoPct: Number(plot.piso_pct) || 0, precoVenda }) }));
  const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
  const captado = investments.reduce((s, i) => s + Number(i.valor_investido), 0);
  // a estruturação (entrada) já foi cobrada nas compras; aqui só o que acontece na saída
  const estruturacao = 0, estruturacaoEntrada = captado * CUSTO.estruturacao_pct / 100;
  const custodia = captado * CUSTO.custodia_armazem_pct / 100;
  const gestao = captado * CUSTO.gestao_fundo_pct / 100;
  const investidores = soma("investidor"), plataformaLucro = soma("plataforma"), valorVenda = soma("valorVenda");
  const fazendaLiquido = valorVenda - investidores - plataformaLucro - custodia - gestao - despesaArmazenagem;
  // compatível com a forma do pagamento com piso (mesmas chaves)
  for (const l of linhas) { l.valorPiso = l.valorMinimo; l.excedente = l.lucro; l.fazendaExcedente = l.lucro * CUSTO.lucro_fazenda_pct / 100; l.aporteFazenda = 0; }
  return {
    modelo: "custo", linhas, captado, valorVenda, valorPiso: soma("valorMinimo"), excedente: soma("lucro"),
    investidores, plataforma: plataformaLucro, plataformaExcedente: soma("plataformaLucro"), desempenho: soma("desempenho"), estruturacao, estruturacaoEntrada,
    armazem: custodia + despesaArmazenagem, custodia, armazenagem: despesaArmazenagem, fundo: gestao,
    fazendaExcedente: soma("lucro") * CUSTO.lucro_fazenda_pct / 100, aportePiso: Math.max(0, -fazendaLiquido), fazendaLiquido,
  };
}
Object.assign(module.exports, { CUSTO, minimoPct, dividirCusto, calcularPagamentoCusto });
