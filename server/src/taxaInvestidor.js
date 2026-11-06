// Taxa de entrada do investidor em degraus (plano v9). Lê os marcos do banco:
// hectares contratados (dos talhões com compras), retenção de investidores
// (automática, com ajuste manual da administração) e margem positiva medida.
const { pool } = require("./db");
const { TAXA_INVESTIDOR, taxaInvestidorVigente } = require("./piso");

// hectares contratados = área dos talhões do modelo Custo + Lucro com pelo
// menos uma compra ativa ou paga
async function hectaresContratados(db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(p.area_ha), 0)::float8 AS ha
       FROM plots p
      WHERE p.modelo = 'custo' AND p.status <> 'arquivado'
        AND EXISTS (SELECT 1 FROM investments i WHERE i.plot_id = p.id AND i.status IN ('ativo','pago'))`
  );
  return rows[0].ha;
}

// retenção automática: entre os investidores que já tiveram uma safra paga,
// a parcela que comprou de novo (em outro talhão)
async function retencaoAutomatica(db = pool) {
  const { rows } = await db.query(
    `WITH base AS (
       SELECT DISTINCT i.user_id FROM investments i WHERE i.status = 'pago'
     )
     SELECT COUNT(*)::int AS base,
            COUNT(*) FILTER (WHERE (SELECT COUNT(DISTINCT i2.plot_id) FROM investments i2 WHERE i2.user_id = b.user_id AND i2.status IN ('ativo','pago')) >= 2)::int AS recompraram
       FROM base b`
  );
  const { base, recompraram } = rows[0];
  return base > 0 ? Math.round((recompraram / base) * 1000) / 10 : 0;
}

async function marcosTaxaInvestidor(db = pool) {
  const [ha, auto, cfg] = await Promise.all([
    hectaresContratados(db),
    retencaoAutomatica(db),
    db.query("SELECT retencao_pct_manual, margem_positiva_medida, taxa_investidor_forcada_pct FROM platform_settings WHERE id = 1"),
  ]);
  const c = cfg.rows[0] || {};
  const retencaoPct = c.retencao_pct_manual !== null && c.retencao_pct_manual !== undefined ? Number(c.retencao_pct_manual) : auto;
  const margemPositiva = !!c.margem_positiva_medida;
  const forcadaPct = c.taxa_investidor_forcada_pct !== null && c.taxa_investidor_forcada_pct !== undefined ? Number(c.taxa_investidor_forcada_pct) : null;
  return { haContratados: ha, retencaoPct, retencaoAutomaticaPct: auto, retencaoManualPct: c.retencao_pct_manual ?? null, margemPositiva, forcadaPct };
}

// degrau vigente + marcos (para a compra, para /api/regras e para o painel do admin)
async function taxaInvestidorAtual(db = pool) {
  const m = await marcosTaxaInvestidor(db);
  const v = taxaInvestidorVigente(m);
  return { ...v, ...m, degraus: TAXA_INVESTIDOR };
}

module.exports = { hectaresContratados, retencaoAutomatica, marcosTaxaInvestidor, taxaInvestidorAtual };
