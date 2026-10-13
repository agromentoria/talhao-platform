// Conquistas do investidor, calculadas a partir das sacas do armazém dele.
export const CONQUISTAS = [
  { id: "primeira", img: "/icons/icon_saca_graos_meu_talhao.png", titulo: "Primeira saca", desc: "Guardou a primeira saca no seu armazém", ok: (s) => s.sacas >= 1 },
  { id: "dez", img: "/icons/icon_bag_meu_talhao.png", titulo: "10 sacas", desc: "Encheu um bag: 10 sacas no armazém", ok: (s) => s.sacas >= 10 },
  { id: "cem", img: "/icons/icon_armazem_meu_talhao.png", titulo: "100 sacas", desc: "Já tem um armazém de verdade: 100 sacas", ok: (s) => s.sacas >= 100 },
  { id: "plantio", img: "/icons/icon_cuidando_terra_meu_talhao.png", titulo: "Acompanhou o plantio", desc: "Estava junto enquanto a fazenda cuidava da terra e plantava", ok: (s) => s.acompanhouPlantio },
  { id: "colheita", img: "/icons/icon_colhendo_meu_talhao.png", titulo: "Primeira colheita", desc: "Recebeu o pagamento de uma colheita", ok: (s) => s.colheitas >= 1 },
  { id: "culturas", img: "/icons/icon_produtor_meu_talhao.png", titulo: "3 culturas", desc: "Tem commodities de 3 culturas diferentes", ok: (s) => s.culturas >= 3 },
  { id: "fazendas", img: "/icons/icon_produtor_fazenda_meu_talhao.png", titulo: "Amigo do campo", desc: "Investe em 2 fazendas ou mais", ok: (s) => s.fazendas >= 2 },
];

export function resumoInvestidor(investments = []) {
  const ativos = investments.filter((i) => ["ativo", "pago"].includes(i.status));
  return {
    sacas: ativos.reduce((s, i) => s + Number(i.cotas || 0), 0),
    culturas: new Set(ativos.map((i) => i.grao)).size,
    fazendas: new Set(ativos.map((i) => i.farm_name)).size,
    colheitas: ativos.filter((i) => i.status === "pago").length,
    // o talhão já passou da germinação com o investidor dentro
    acompanhouPlantio: ativos.some((i) => Number(i.fase_atual) >= 2),
  };
}

export function conquistasDo(investments) {
  const r = resumoInvestidor(investments);
  return CONQUISTAS.map((c) => ({ ...c, conquistada: c.ok(r) }));
}
