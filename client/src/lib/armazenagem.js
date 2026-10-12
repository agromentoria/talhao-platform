import { fmtBRL } from "./format";
import { unitPlural } from "./format";

// Mesmo cálculo de server/src/storageFees.js, para mostrar estimativas na tela.
// tarifas: { tarifa_recepcao, tarifa_quinzena, carencia_quinzenas, quebra_quinzena_pct }
export function despesaPorUnidade(tarifas, { quinzenas, precoVenda }) {
  if (!tarifas) return { recepcao: 0, armazenagem: 0, quebra: 0, total: 0, cobradas: 0 };
  const carencia = Number(tarifas.carencia_quinzenas ?? tarifas.arm_carencia ?? 1);
  const recepcao = Number(tarifas.tarifa_recepcao ?? tarifas.arm_tarifa_recepcao ?? 0);
  const quinzena = Number(tarifas.tarifa_quinzena ?? tarifas.arm_tarifa_quinzena ?? 0);
  const quebraPct = Number(tarifas.quebra_quinzena_pct ?? tarifas.arm_quebra_pct ?? 0);
  const cobradas = Math.max(0, quinzenas - carencia);
  const armazenagem = quinzena * cobradas;
  const quebra = (quebraPct / 100) * quinzenas * precoVenda;
  return { recepcao, armazenagem, quebra, total: recepcao + armazenagem + quebra, cobradas };
}

export function tarifasTexto(t, unidade = "saca") {
  if (!t) return "";
  const u = unitPlural(unidade, 1);
  const partes = [
    `recepção ${fmtBRL(t.tarifa_recepcao)}/${u}`,
    `${fmtBRL(t.tarifa_quinzena)}/${u} por quinzena`,
    `${t.carencia_quinzenas} quinzena(s) de carência`,
  ];
  if (Number(t.quebra_quinzena_pct) > 0) partes.push(`quebra técnica ${String(t.quebra_quinzena_pct).replace(".", ",")}%/quinzena`);
  return partes.join(" · ");
}

export function quinzenasTexto(q) {
  const meses = q / 2;
  return `${q} quinzena${q === 1 ? "" : "s"} (${meses % 1 === 0 ? meses : meses.toFixed(1).replace(".", ",")} ${meses === 1 ? "mês" : "meses"})`;
}

export const OPCOES_QUINZENAS = Array.from({ length: 24 }, (_, i) => i + 1);

// fração da despesa paga pelos investidores (0 a 1) — igual ao servidor
export function parteInvestidores(arm) {
  if (!arm || arm.pagador === "fazenda") return 0;
  if (arm.pagador === "dividido") return Math.min(1, Math.max(0, (Number(arm.investidorPct) || 0) / 100));
  return 1;
}

// a partir dos campos do talhão (arm_pagador / arm_investidor_pct)
export function armDoTalhao(plot) {
  return { pagador: plot?.arm_pagador || "investidores", investidorPct: plot?.arm_investidor_pct ?? 50, quinzenas: plot?.arm_quinzenas_previstas || 2 };
}

export function pagadorTexto(arm) {
  const p = parteInvestidores(arm);
  if (p === 1) return "pagos pelos investidores, descontados do resultado antes das comissões";
  if (p === 0) return "pagos pela fazenda";
  const inv = Math.round(p * 1000) / 10;
  const fmt = (n) => String(n).replace(".", ",");
  return `divididos: ${fmt(inv)}% descontados dos investidores e ${fmt(Math.round((100 - inv) * 10) / 10)}% pagos pela fazenda`;
}
