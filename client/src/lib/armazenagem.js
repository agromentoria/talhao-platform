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
