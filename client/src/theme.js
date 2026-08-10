// Paleta oficial da marca Meu Talhão (extraída de paleta_de_Cores_meutalhao.svg)
export const COLORS = {
  bg: "#EADFCD",        // creme — fundo geral
  bgCard: "#FFFFFF",
  soil: "#3A2E22",       // marrom escuro — títulos, texto principal (aprox. do contorno da logo)
  soilLight: "#6A5B4C",  // marrom médio — texto secundário
  leaf: "#668C2D",       // verde principal da marca (usado no wordmark "talhão")
  leafDark: "#445F1C",   // verde escuro — hover, ênfase
  leafLight: "#87B726",  // verde claro — destaques, badges
  wheat: "#F9B000",      // dourado — cor do grão/trigo na logo
  wheatDark: "#DD8209",  // laranja — sombra do grão
  wheatLight: "#FBD066",
  clay: "#928270",       // taupe — usado com moderação
  danger: "#B23B3B",
  line: "#CFBEA6",       // tan — bordas e divisores
};

export const GRAIN_COLORS = {
  Soja: COLORS.leaf,
  Milho: COLORS.wheat,
  Algodão: COLORS.clay,
  Arroz: "#6B8CAE",
  Trigo: COLORS.wheatDark,
  Feijão: "#8B4A2B",
};

export const FASES = ["Preparo do solo", "Plantio", "Crescimento", "Colheita"];

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
