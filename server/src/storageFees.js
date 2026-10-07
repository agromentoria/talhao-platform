// Despesa de armazenagem de um talhão.
//
// Segue a forma de cobrança dos armazéns gerais:
//   recepção        = unidades × tarifa de recepção (cobrada uma vez)
//   armazenagem     = unidades × tarifa por quinzena × quinzenas cobradas
//                     (quinzenas guardadas − carência)
//   quebra técnica  = unidades × % por quinzena × quinzenas guardadas × preço de venda
//
// Quem paga é definido no talhão (arm_pagador):
//   "investidores" → a despesa sai do valor de venda antes de calcular o lucro
//                    (e as comissões incidem sobre o lucro já sem a despesa)
//   "fazenda"      → a fazenda assume; o investidor não tem desconto
const DIA = 86400000;

function tarifasDoTalhao(plot) {
  return {
    recepcao: Number(plot.arm_tarifa_recepcao) || 0,
    quinzena: Number(plot.arm_tarifa_quinzena) || 0,
    carencia: Number.isFinite(Number(plot.arm_carencia)) && plot.arm_carencia !== null ? Number(plot.arm_carencia) : 1,
    quebraPct: Number(plot.arm_quebra_pct) || 0,
  };
}

function quinzenasEntre(inicio, fim) {
  if (!inicio) return 0;
  const dias = Math.max(0, (new Date(fim).getTime() - new Date(inicio).getTime()) / DIA);
  // a quinzena da entrada já conta; 1 hora de tolerância evita cobrar uma
  // quinzena a mais por segundos de diferença
  return Math.max(1, Math.ceil(Math.max(0, dias - 1 / 24) / 15));
}

// unidades: quantidade sobre a qual a despesa incide
// quinzenas: período guardado (real ou previsto)
function calcularDespesa(plot, { unidades, precoVenda, quinzenas }) {
  const t = tarifasDoTalhao(plot);
  const cobradas = Math.max(0, quinzenas - t.carencia);
  const recepcao = unidades * t.recepcao;
  const armazenagem = unidades * t.quinzena * cobradas;
  const quebra = unidades * (t.quebraPct / 100) * quinzenas * precoVenda;
  const total = recepcao + armazenagem + quebra;
  return {
    recepcao, armazenagem, quebra, total,
    porUnidade: unidades > 0 ? total / unidades : 0,
    quinzenas, quinzenasCobradas: cobradas, tarifas: t,
  };
}

// despesa real: da confirmação da armazenagem até hoje (ou até a data informada)
function despesaReal(plot, { unidades, precoVenda, ate = new Date() }) {
  const quinzenas = plot.arm_entrada_em ? quinzenasEntre(plot.arm_entrada_em, ate) : Number(plot.arm_quinzenas_previstas) || 0;
  return calcularDespesa(plot, { unidades, precoVenda, quinzenas });
}

// despesa prevista: usa o período de armazenagem que a fazenda informou
function despesaPrevista(plot, { unidades, precoVenda }) {
  return calcularDespesa(plot, { unidades, precoVenda, quinzenas: Number(plot.arm_quinzenas_previstas) || 0 });
}

module.exports = { calcularDespesa, despesaReal, despesaPrevista, tarifasDoTalhao, quinzenasEntre };
