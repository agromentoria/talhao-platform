// Limites de compra por investidor: no máximo X% das sacas de cada talhão e,
// para quem não é investidor qualificado, até R$ Y por ano-calendário somando
// todas as compras (regra de investimento participativo da CVM).
const { pool } = require("./db");

async function limitesConfig(db = pool) {
  const { rows } = await db.query("SELECT limite_pct_talhao, limite_anual_investidor FROM platform_settings WHERE id = 1");
  return { pct_talhao: Number(rows[0]?.limite_pct_talhao ?? 10), anual: Number(rows[0]?.limite_anual_investidor ?? 20000) };
}

// quanto este investidor ainda pode comprar (sacas no talhão e R$ no ano)
async function situacao(db, userId, plot) {
  const cfg = await limitesConfig(db);
  const { rows: u } = await db.query("SELECT investidor_qualificado FROM users WHERE id = $1", [userId]);
  const qualificado = !!u[0]?.investidor_qualificado;
  const { rows: t } = await db.query(
    "SELECT COALESCE(SUM(cotas), 0)::float8 AS sacas FROM investments WHERE user_id = $1 AND plot_id = $2 AND status <> 'cancelado'", [userId, plot.id]);
  const { rows: a } = await db.query(
    `SELECT COALESCE(SUM(COALESCE(total_pago, valor_investido)), 0)::float8 AS valor FROM investments
      WHERE user_id = $1 AND status <> 'cancelado' AND date_trunc('year', created_at) = date_trunc('year', now())`, [userId]);
  const maxTalhao = Math.max(1, Math.floor(Number(plot.cotas_totais) * cfg.pct_talhao / 100));
  return {
    pct_talhao: cfg.pct_talhao, max_sacas_talhao: maxTalhao, sacas_no_talhao: t[0].sacas, disponivel_talhao: Math.max(0, maxTalhao - t[0].sacas),
    qualificado, limite_anual: qualificado ? null : cfg.anual, usado_ano: a[0].valor, disponivel_ano: qualificado ? null : Math.max(0, cfg.anual - a[0].valor),
  };
}

// valida uma compra; devolve a mensagem de erro ou null
function validar(sit, qtd, valorTotal) {
  if (qtd > sit.disponivel_talhao) {
    return sit.disponivel_talhao <= 0
      ? `Você já tem o máximo permitido neste talhão (${sit.max_sacas_talhao} sacas, ${sit.pct_talhao}% do total). O limite protege todos os investidores contra concentração.`
      : `Cada investidor pode ter até ${sit.max_sacas_talhao} sacas neste talhão (${sit.pct_talhao}% do total). Você ainda pode comprar ${sit.disponivel_talhao}.`;
  }
  if (sit.limite_anual != null && valorTotal > sit.disponivel_ano + 0.005) {
    const fmt = (v) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `O limite para investidor não qualificado é de ${fmt(sit.limite_anual)} por ano somando todas as compras. Você ainda pode investir ${fmt(sit.disponivel_ano)} este ano.`;
  }
  return null;
}
module.exports = { limitesConfig, situacao, validar };
