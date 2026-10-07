// Rótulos por tipo de produção e unidades de venda.
// A LISTA de culturas e variedades vem da API (GET /api/culturas, ver
// server/src/culturas.js). Os nomes de fases/etapas e as unidades ficam
// também aqui para exibir sem esperar a rede — mantenha os dois iguais.
import { GRAIN_ICONS, ICONS, FASE_ICONS } from "./theme";

export const UNIDADES = {
  saca: { singular: "saca", plural: "sacas" },
  arroba: { singular: "arroba", plural: "arrobas" },
  fardo: { singular: "fardo", plural: "fardos" },
  kg: { singular: "kg", plural: "kg" },
  tonelada: { singular: "tonelada", plural: "toneladas" },
  litro: { singular: "litro", plural: "litros" },
  duzia: { singular: "dúzia", plural: "dúzias" },
  caixa: { singular: "caixa", plural: "caixas" },
  cabeca: { singular: "cabeça", plural: "cabeças" },
};

export const TIPOS = {
  lavoura: {
    label: "Lavoura",
    fases: ["Preparo do solo", "Plantio", "Germinação", "Manejo e combate a pragas", "Ponto de colheita", "Colheita"],
    etapas: { plantio: "Plantio", colheita: "Colheita", armazenagem: "Armazenagem" },
    ciclo: { inicio: "Prazo do plantio", fim: "Colheita prevista" },
    ciclo_curto: "safra",
  },
  pecuaria: {
    label: "Pecuária de corte",
    fases: ["Preparo do pasto e instalações", "Entrada dos animais", "Adaptação", "Manejo e engorda", "Ponto de abate", "Abate e venda"],
    etapas: { plantio: "Entrada dos animais", colheita: "Abate ou venda", armazenagem: "Entrega ao comprador" },
    ciclo: { inicio: "Entrada dos animais até", fim: "Venda ou abate previsto" },
    ciclo_curto: "ciclo",
  },
  producao_animal: {
    label: "Produção animal (leite, ovos)",
    fases: ["Preparo das instalações", "Entrada do plantel", "Adaptação", "Manejo e sanidade", "Pico de produção", "Venda da produção"],
    etapas: { plantio: "Entrada do plantel", colheita: "Produção", armazenagem: "Entrega da produção" },
    ciclo: { inicio: "Entrada do plantel até", fim: "Fim do ciclo previsto" },
    ciclo_curto: "ciclo",
  },
};

const ETAPA_DESCRICAO = {
  plantio: (l) => `O armazém confirma: ${l.toLowerCase()}, na área declarada.`,
  colheita: (l) => `O armazém confirma: ${l.toLowerCase()} e a quantidade.`,
  armazenagem: () => "O armazém confirma a quantidade recebida. Libera o pagamento.",
};

export function tipoDe(plot) {
  return TIPOS[plot?.tipo_producao] ? plot.tipo_producao : "lavoura";
}
export function fasesDe(plot) {
  return TIPOS[tipoDe(plot)].fases;
}
export function faseNome(plot, i) {
  return fasesDe(plot)[i] || "";
}
// ícones ilustrados existem só para as fases da lavoura
export function faseIcone(plot, i) {
  return tipoDe(plot) === "lavoura" ? FASE_ICONS[i] : null;
}
export function cicloLabels(plot) {
  return TIPOS[tipoDe(plot)].ciclo;
}
export function etapasDe(plot) {
  const e = TIPOS[tipoDe(plot)].etapas;
  return ["plantio", "colheita", "armazenagem"].map((id) => ({ id, label: e[id], descricao: ETAPA_DESCRICAO[id](e[id]) }));
}

export function culturaIcone(nome) {
  // resolvido na chamada (não no carregamento do módulo) para evitar ordem de import
  const extras = { "Bovinos de corte": ICONS.touro, "Bovinos de leite": ICONS.vaca };
  return GRAIN_ICONS[nome] || extras[nome] || "/icons/icon_talhao_meu_talhao.svg";
}

export function unidadeNome(unidade, n = 1) {
  const u = UNIDADES[unidade] || { singular: "unidade", plural: "unidades" };
  return n === 1 ? u.singular : u.plural;
}

// "Soja · Intacta RR2 PRO"
export function culturaTexto(plot) {
  return plot?.variedade ? `${plot.grao} · ${plot.variedade}` : plot?.grao || "";
}

export function fmtData(iso, opts = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("pt-BR", opts);
}
