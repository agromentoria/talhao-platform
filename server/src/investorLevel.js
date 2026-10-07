// Nível do investidor (selo no perfil). Sobe conforme o total investido em
// talhões (investimentos ativos e já pagos). Para mudar as faixas, edite
// NIVEIS — o app mostra o que vier daqui.
const NIVEIS = [
  { id: "iniciante", label: "Iniciante", minimo: 0, descricao: "Primeiros passos no agro." },
  { id: "intermediario", label: "Intermediário", minimo: 5000, descricao: "Já tem uma carteira no campo." },
  { id: "profissional", label: "Profissional", minimo: 50000, descricao: "Investidor experiente do agro." },
];

async function getInvestorLevel(db, userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(valor_investido), 0)::float8 AS total, COUNT(DISTINCT plot_id)::int AS talhoes
     FROM investments WHERE user_id = $1 AND status IN ('ativo', 'pago')`,
    [userId]
  );
  const { total, talhoes } = rows[0];
  let idx = 0;
  NIVEIS.forEach((n, i) => { if (total >= n.minimo) idx = i; });
  const atual = NIVEIS[idx];
  const proximo = NIVEIS[idx + 1] || null;
  return {
    ...atual,
    total_investido: total,
    talhoes,
    proximo: proximo ? { id: proximo.id, label: proximo.label, minimo: proximo.minimo, falta: Math.max(0, proximo.minimo - total) } : null,
    niveis: NIVEIS.map(({ id, label, minimo }) => ({ id, label, minimo })),
  };
}

module.exports = { NIVEIS, getInvestorLevel };
