// Constantes visuais e de domínio usadas em JS (gráficos, ícones, rótulos).
// As cores de interface vivem em styles/tokens.css; COLORS espelha esses
// tokens para os poucos lugares que ainda precisam da cor em JavaScript
// (ex.: gráficos do recharts e estilos dinâmicos).
export const COLORS = {
  bg: "#EADFCD",
  headerGreen: "#5F8229",
  leaf: "#557A22",        // verde de ação/selecionado — contraste AA com branco
  leafDark: "#445F1C",
  leafText: "#4E6E20",    // verde para texto sobre fundo claro
  orange: "#B26000",      // laranja de ação — contraste AA com branco
  orangeDark: "#964F00",
  orangeLight: "#FBE9CF",
  brandOrange: "#DD8209", // laranja original da marca (só decorativo)
  card: "#F7F1E7",
  cardLight: "#EFE5D4",
  soil: "#342525",
  soilLight: "#584A3C",
  clay: "#7A6A58",
  danger: "#A01916",
  line: "#DDCDB4",
  sand: "#CFBEA6",
  white: "#FFFFFF",
};
// nomes antigos ainda referenciados em algumas telas
COLORS.bgCard = COLORS.card;
COLORS.wheat = COLORS.brandOrange;
COLORS.wheatDark = COLORS.orangeDark;
COLORS.wheatLight = COLORS.orangeLight;

export const GRAINS = ["Soja", "Milho", "Algodão", "Arroz", "Trigo", "Feijão"];

export const GRAIN_ICONS = {
  Soja: "/icons/icon_soja_meu_talhao.svg",
  Milho: "/icons/icon_milho_meu_talhao.svg",
  Algodão: "/icons/icon_algodao_meu_talhao.svg",
  Arroz: "/icons/icon_arroz_meu_talhao.svg",
  Trigo: "/icons/icon_trigo_meu_talhao.svg",
  Feijão: "/icons/icon_feijao_meu_talhao.svg",
};

// cor de destaque de cada grão (barras de progresso e gráficos)
export const GRAIN_COLORS = {
  Soja: "#668C2D",
  Milho: "#DD8209",
  Algodão: "#928270",
  Arroz: "#6B8CAE",
  Trigo: "#B96B07",
  Feijão: "#8B4A2B",
};

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

export const ICONS = {
  fazendas: "/icons/icon_fazendas.svg",
  touro: "/icons/icon_touro_meu_talhao.svg",
  vaca: "/icons/icon_vaca_meu_talhao.svg",
};

export const BACKGROUNDS = {
  cream: "/bg-farm-cream.svg",
  green: "/bg-farm-green.svg",
};

export const UNIT_LABEL = { saca: "saca", fardo: "fardo", arroba: "arroba" };

export const ROLE_LABEL = { admin: "Administração", fazenda: "Fazenda", investidor: "Investidor", armazem: "Armazém" };

// custódia pelo armazém garantidor
export const ETAPAS_CUSTODIA = [
  { id: "plantio", label: "Plantio", descricao: "O armazém confirma que a lavoura foi plantada na área declarada." },
  { id: "colheita", label: "Colheita", descricao: "O armazém confirma a colheita e a quantidade colhida." },
  { id: "armazenagem", label: "Armazenagem", descricao: "O armazém confirma a quantidade recebida e guardada. Libera o pagamento." },
];
export const FASE_MINIMA_CUSTODIA = { plantio: 1, colheita: 5, armazenagem: 5 };

// reexportados para compatibilidade com imports antigos
export { fmtBRL, unitPlural } from "../lib/format";
