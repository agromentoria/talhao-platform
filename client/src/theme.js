// Paleta oficial da marca Meu Talhão (extraída de paleta_de_Cores_meutalhao.svg)
export const COLORS = {
  bg: "#EADFCD",        // creme — fundo geral
  bgCard: "#FFFFFF",
  soil: "#3A2E22",       // marrom escuro — títulos, texto principal
  soilLight: "#6A5B4C",  // marrom médio — texto secundário
  leaf: "#668C2D",       // verde principal da marca
  leafDark: "#445F1C",   // verde escuro — hover, ênfase
  leafLight: "#87B726",  // verde claro — destaques, badges
  wheat: "#F9B000",      // dourado — cor do grão/trigo na logo
  wheatDark: "#DD8209",  // laranja — sombra do grão
  wheatLight: "#FBD066",
  clay: "#928270",       // taupe — usado com moderação
  danger: "#B23B3B",
  line: "#CFBEA6",       // tan — bordas e divisores
};

// Ilustrações reais da marca para cada grão comercializado
export const GRAIN_ICONS = {
  Soja: "/icons/icon_soja_meu_talhao.svg",
  Milho: "/icons/icon_milho_meu_talhao.svg",
  Algodão: "/icons/icon_algodao_meu_talhao.svg",
  Arroz: "/icons/icon_arroz_meu_talhao.svg",
  Trigo: "/icons/icon_trigo_meu_talhao.svg",
  Feijão: "/icons/icon_feijao_meu_talhao.svg",
};

export const GRAIN_COLORS = {
  Soja: COLORS.leaf,
  Milho: COLORS.wheat,
  Algodão: COLORS.clay,
  Arroz: "#6B8CAE",
  Trigo: COLORS.wheatDark,
  Feijão: "#8B4A2B",
};

// Esteira completa da safra, cada etapa com sua ilustração
export const FASES = [
  "Preparo do solo",
  "Plantio",
  "Germinação",
  "Manejo e combate a pragas",
  "Ponto de colheita",
  "Colheita",
];

export const FASE_ICONS = [
  "/icons/icon_talhao_meu_talhao.svg",
  "/icons/icon_plantando_meu_talhao.svg",
  "/icons/icon_germinando_meu_talhao.svg",
  "/icons/icon_talhoes_combate_meu_talhao.svg",
  "/icons/icon_ponto_colheita_meu_talhao.svg",
  "/icons/icon_talhoes_colhendo_meu_talhao.svg",
];

// Outras ilustrações usadas na interface
export const ICONS = {
  fazendas: "/icons/icon_fazendas.svg",
  touro: "/icons/icon_touro_meu_talhao.svg",
  vaca: "/icons/icon_vaca_meu_talhao.svg",
};

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
