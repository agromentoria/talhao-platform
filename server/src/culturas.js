// Catálogo de culturas da plataforma — fonte única para servidor e app
// (o app busca em GET /api/culturas).
//
// "Cultura" é o que o talhão produz: um grão, uma fibra, um rebanho, aves…
// Cada cultura tem um TIPO DE PRODUÇÃO, que define os nomes das 6 fases do
// ciclo e das 3 etapas validadas pelo armazém garantidor. As 6 fases são
// sempre 6 (índices 0–5) porque a precificação por fase e a custódia
// dependem dessa posição — só os nomes mudam.
//
// Para adicionar uma cultura ou variedade, edite este arquivo. A fazenda
// também pode digitar uma cultura/variedade que não esteja na lista.

const UNIDADES = {
  saca: { singular: "saca", plural: "sacas", descricao: "saca de 60 kg" },
  arroba: { singular: "arroba", plural: "arrobas", descricao: "arroba de 15 kg" },
  fardo: { singular: "fardo", plural: "fardos", descricao: "fardo" },
  kg: { singular: "kg", plural: "kg", descricao: "quilograma" },
  tonelada: { singular: "tonelada", plural: "toneladas", descricao: "tonelada" },
  litro: { singular: "litro", plural: "litros", descricao: "litro" },
  duzia: { singular: "dúzia", plural: "dúzias", descricao: "dúzia de ovos" },
  caixa: { singular: "caixa", plural: "caixas", descricao: "caixa" },
  cabeca: { singular: "cabeça", plural: "cabeças", descricao: "animal (cabeça)" },
};

const TIPOS = {
  lavoura: {
    label: "Lavoura",
    fases: ["Preparo do solo", "Plantio", "Germinação", "Manejo e combate a pragas", "Ponto de colheita", "Colheita"],
    etapas: { plantio: "Plantio", colheita: "Colheita", armazenagem: "Armazenagem" },
    ciclo: { inicio: "Prazo do plantio", fim: "Colheita prevista" },
  },
  pecuaria: {
    label: "Pecuária de corte",
    fases: ["Preparo do pasto e instalações", "Entrada dos animais", "Adaptação", "Manejo e engorda", "Ponto de abate", "Abate e venda"],
    etapas: { plantio: "Entrada dos animais", colheita: "Abate ou venda", armazenagem: "Entrega ao comprador" },
    ciclo: { inicio: "Entrada dos animais até", fim: "Venda ou abate previsto" },
  },
  producao_animal: {
    label: "Produção animal (leite, ovos)",
    fases: ["Preparo das instalações", "Entrada do plantel", "Adaptação", "Manejo e sanidade", "Pico de produção", "Venda da produção"],
    etapas: { plantio: "Entrada do plantel", colheita: "Produção", armazenagem: "Entrega da produção" },
    ciclo: { inicio: "Entrada do plantel até", fim: "Fim do ciclo previsto" },
  },
};

const CULTURAS = [
  // ---- grãos ----
  { nome: "Soja", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Convencional", "Transgênica (RR)", "Intacta RR2 PRO", "Não transgênica certificada", "Orgânica"] },
  { nome: "Milho", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Grão amarelo (comum)", "Milho branco", "Milho pipoca", "Milho doce / verde", "Milho para silagem"] },
  { nome: "Feijão", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Carioca", "Preto", "Fradinho / caupi", "Rajado", "Branco", "Vermelho", "Jalo", "Bolinha"] },
  { nome: "Arroz", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Agulhinha (longo fino)", "Cateto", "Arbóreo", "Japonês (oriental)", "Arroz preto", "Arroz vermelho"] },
  { nome: "Trigo", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Pão", "Melhorador", "Doméstico", "Básico", "Durum"] },
  { nome: "Sorgo", grupo: "Grãos", tipo: "lavoura", unidade: "saca",
    variedades: ["Granífero", "Forrageiro / silagem", "Sacarino"] },
  { nome: "Café", grupo: "Café", tipo: "lavoura", unidade: "saca",
    variedades: ["Arábica", "Conilon / robusta", "Arábica especial (cafés finos)"] },
  // ---- fibras ----
  { nome: "Algodão", grupo: "Fibras", tipo: "lavoura", unidade: "arroba",
    variedades: ["Pluma convencional", "Transgênico", "Colorido", "Orgânico"] },
  // ---- pecuária ----
  { nome: "Bovinos de corte", grupo: "Pecuária", tipo: "pecuaria", unidade: "arroba", icone: "touro",
    variedades: ["Nelore", "Angus", "Brangus", "Senepol", "Cruzamento industrial", "Novilha precoce", "Bezerros (cria)"] },
  { nome: "Bovinos de leite", grupo: "Pecuária", tipo: "producao_animal", unidade: "litro", icone: "vaca",
    variedades: ["Holandesa", "Girolando", "Gir leiteiro", "Jersey", "Pardo-suíço"] },
  { nome: "Suínos", grupo: "Pecuária", tipo: "pecuaria", unidade: "kg",
    variedades: ["Terminação industrial", "Leitões (creche)", "Suíno caipira"] },
  // ---- aves ----
  { nome: "Galinhas poedeiras", grupo: "Aves", tipo: "producao_animal", unidade: "duzia",
    variedades: ["Ovos brancos", "Ovos vermelhos", "Caipira", "Orgânico"] },
  { nome: "Frango de corte", grupo: "Aves", tipo: "pecuaria", unidade: "kg",
    variedades: ["Linhagem industrial", "Frango caipira", "Orgânico"] },
];

// preço de referência por unidade e produtividade média por hectare.
// produtividade 0 = a fazenda informa a quantidade manualmente
// (comum na produção animal, que não se mede por hectare)
const REFERENCIAS = [
  // cultura, unidade, preço (R$), produtividade por ha
  ["Soja", "saca", 130, 60],
  ["Milho", "saca", 60, 100],
  ["Trigo", "saca", 75, 50],
  ["Arroz", "saca", 95, 110],
  ["Feijão", "saca", 220, 27],
  ["Algodão", "arroba", 140, 280],
  ["Sorgo", "saca", 50, 70],
  ["Café", "saca", 1500, 30],
  ["Bovinos de corte", "arroba", 310, 0],
  ["Bovinos de leite", "litro", 2.5, 0],
  ["Suínos", "kg", 8, 0],
  ["Galinhas poedeiras", "duzia", 9, 0],
  ["Frango de corte", "kg", 6, 0],
];

function getCultura(nome) {
  return CULTURAS.find((c) => c.nome.toLowerCase() === String(nome || "").trim().toLowerCase()) || null;
}

function tipoDe(plot) {
  return TIPOS[plot?.tipo_producao] ? plot.tipo_producao : "lavoura";
}

function fasesDe(plot) {
  return TIPOS[tipoDe(plot)].fases;
}

function etapaLabel(plot, etapa) {
  return TIPOS[tipoDe(plot)].etapas[etapa] || etapa;
}

function unidadeTexto(unidade, n) {
  const u = UNIDADES[unidade] || { singular: "unidade", plural: "unidades" };
  return n === 1 ? u.singular : u.plural;
}

module.exports = { UNIDADES, TIPOS, CULTURAS, REFERENCIAS, getCultura, tipoDe, fasesDe, etapaLabel, unidadeTexto };
