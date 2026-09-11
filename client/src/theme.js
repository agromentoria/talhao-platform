// Paleta oficial extraída diretamente das telas de referência (Figma → SVG)
export const COLORS = {
  bg: "#EADFCD",          // creme — fundo geral das telas internas
  headerGreen: "#5F8229", // verde escuro — cabeçalho e navegação
  leaf: "#668C2D",        // verde da marca — wordmark, toggles, confirmação final
  leafDark: "#445F1C",
  orange: "#DD8209",      // laranja — ação principal (botões, nav inferior)
  orangeDark: "#B96B07",
  orangeLight: "#ED9313",
  card: "#CFBEA6",        // areia — fundo dos cards
  cardLight: "#DED2BC",
  soil: "#342525",        // marrom escuro — texto principal sobre fundo claro
  soilLight: "#6A5B4C",   // marrom médio — texto secundário
  clay: "#928270",
  danger: "#A01916",
  line: "#CFBEA6",
  white: "#FFFFFF",
};

// mantido por compatibilidade com telas antigas que ainda referenciam COLORS.bgCard
COLORS.bgCard = COLORS.card;
COLORS.wheat = COLORS.orange;
COLORS.wheatDark = COLORS.orangeDark;
COLORS.wheatLight = COLORS.orangeLight;

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
  Milho: COLORS.orange,
  Algodão: COLORS.clay,
  Arroz: "#6B8CAE",
  Trigo: COLORS.orangeDark,
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

// Fundos ilustrados extraídos das telas de referência
export const BACKGROUNDS = {
  cream: "/bg-farm-cream.svg",
  green: "/bg-farm-green.svg",
};

// Unidade de comercialização de cada grão (usada em vez de "cota" genérica)
export const UNIT_LABEL = {
  saca: "saca",
  fardo: "fardo",
  arroba: "arroba",
};

export function unitPlural(unidade, n) {
  const label = UNIT_LABEL[unidade] || "cota";
  return n === 1 ? label : `${label}s`;
}

export function fmtBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}
