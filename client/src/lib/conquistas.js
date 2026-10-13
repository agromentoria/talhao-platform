// Conquistas do investidor, calculadas a partir das sacas compradas.
// Simples e visíveis: incentivam a acompanhar a safra, sem alterar regras.
export const CONQUISTAS = [
  { id: "primeira", emoji: "🌱", titulo: "Primeira saca", desc: "Comprou a primeira saca", ok: (s) => s.sacas >= 1 },
  { id: "dez", emoji: "🧺", titulo: "10 sacas", desc: "Juntou 10 sacas", ok: (s) => s.sacas >= 10 },
  { id: "cem", emoji: "🚜", titulo: "100 sacas", desc: "Juntou 100 sacas", ok: (s) => s.sacas >= 100 },
  { id: "plantio", emoji: "🌾", titulo: "Viu plantar", desc: "Acompanhou um talhão desde o plantio", ok: (s) => s.acompanhouPlantio },
  { id: "colheita", emoji: "🏆", titulo: "Primeira colheita", desc: "Recebeu o pagamento de uma colheita", ok: (s) => s.colheitas >= 1 },
  { id: "culturas", emoji: "🎨", titulo: "3 culturas", desc: "Tem sacas de 3 culturas diferentes", ok: (s) => s.culturas >= 3 },
  { id: "fazendas", emoji: "🏡", titulo: "Amigo do campo", desc: "Investe em 2 fazendas ou mais", ok: (s) => s.fazendas >= 2 },
];

export function resumoInvestidor(investments = []) {
  const ativos = investments.filter((i) => ["ativo", "pago"].includes(i.status));
  return {
    sacas: ativos.reduce((s, i) => s + Number(i.cotas || 0), 0),
    culturas: new Set(ativos.map((i) => i.grao)).size,
    fazendas: new Set(ativos.map((i) => i.farm_name)).size,
    colheitas: ativos.filter((i) => i.status === "pago").length,
    // comprou antes da fase "Plantio" terminar e o talhão já avançou além dela
    acompanhouPlantio: ativos.some((i) => Number(i.fase_atual) >= 2),
  };
}

export function conquistasDo(investments) {
  const r = resumoInvestidor(investments);
  return CONQUISTAS.map((c) => ({ ...c, conquistada: c.ok(r) }));
}
