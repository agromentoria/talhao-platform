// Regras compartilhadas da custódia pelo armazém (usadas em várias rotas)
const { pool } = require("./db");

const { etapaLabel } = require("./culturas");

const ETAPAS = ["plantio", "colheita", "armazenagem"];
const ETAPA_LABEL = { plantio: "Plantio", colheita: "Colheita", armazenagem: "Armazenagem" };
// com artigo, para frases ("o plantio", "a colheita")
const ETAPA_ARTIGO = { plantio: "o plantio", colheita: "a colheita", armazenagem: "a armazenagem" };
const ETAPA_CONFIRMADA = { plantio: "Plantio confirmado", colheita: "Colheita confirmada", armazenagem: "Armazenagem confirmada" };

// fase mínima do talhão para cada validação (índices de FASES)
// 1 = Plantio, 5 = Colheita
const FASE_MINIMA = { plantio: 1, colheita: 5, armazenagem: 5 };

async function getValidations(db, plotId) {
  const { rows } = await db.query(
    `SELECT v.id, v.etapa, v.resultado, v.quantidade, v.observacao, v.foto, v.created_at, u.name AS validado_por
     FROM plot_validations v LEFT JOIN users u ON u.id = v.validated_by
     WHERE v.plot_id = $1 ORDER BY array_position(ARRAY['plantio','colheita','armazenagem'], v.etapa)`,
    [plotId]
  );
  return rows;
}

// Nota do armazém (0–5 estrelas): pontos das características marcadas +
// pontos da capacidade estática por faixa, sobre o máximo possível.
// Use em consultas com a tabela warehouses apelidada de "w".
const CAPACIDADE_PONTOS_SQL = `CASE WHEN w.capacidade_t >= 50000 THEN 4 WHEN w.capacidade_t >= 20000 THEN 3
  WHEN w.capacidade_t >= 5000 THEN 2 WHEN w.capacidade_t > 0 THEN 1 ELSE 0 END`;
const WAREHOUSE_STARS_SQL = `ROUND((
  (COALESCE((SELECT SUM(c.pontos) FROM warehouse_characteristics wc
             JOIN warehouse_characteristics_catalog c ON c.key = wc.characteristic_key
             WHERE wc.warehouse_id = w.id), 0) + ${CAPACIDADE_PONTOS_SQL})::numeric
  / NULLIF((SELECT SUM(pontos) FROM warehouse_characteristics_catalog) + 4, 0) * 5
), 1)::float8`;

async function getWarehouseCharacteristics(db, warehouseId) {
  const { rows } = await db.query(
    `SELECT c.key, c.label, c.categoria, c.pontos FROM warehouse_characteristics wc
     JOIN warehouse_characteristics_catalog c ON c.key = wc.characteristic_key
     WHERE wc.warehouse_id = $1 ORDER BY c.categoria, c.label`,
    [warehouseId]
  );
  return rows;
}

// resumo público do armazém para a página do talhão
async function getPublicWarehouse(db, warehouseId) {
  if (!warehouseId) return null;
  const { rows } = await db.query(
    `SELECT w.id, w.name, w.cnpj, w.location, w.capacidade_t, w.descricao, w.status, ${WAREHOUSE_STARS_SQL} AS estrelas,
            w.tarifa_recepcao, w.tarifa_quinzena, w.carencia_quinzenas, w.quebra_quinzena_pct
     FROM warehouses w WHERE w.id = $1`,
    [warehouseId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], caracteristicas: await getWarehouseCharacteristics(db, warehouseId) };
}

// a liberação do pagamento exige armazenagem confirmada quando há custódia aceita
async function harvestBlockReason(db, plot) {
  if (!plot.warehouse_id || plot.custodia_status !== "aceita") return null;
  const { rows } = await db.query(
    "SELECT resultado, quantidade FROM plot_validations WHERE plot_id = $1 AND etapa = 'armazenagem'",
    [plot.id]
  );
  const v = rows[0];
  if (!v) return "O armazém garantidor ainda não confirmou a armazenagem desta colheita.";
  if (v.resultado !== "confirmado") return "O armazém registrou divergência na armazenagem. Rejeite a solicitação ou peça nova validação.";
  return null;
}

module.exports = {
  pool, ETAPAS, ETAPA_LABEL, ETAPA_ARTIGO, ETAPA_CONFIRMADA, FASE_MINIMA, etapaLabel,
  getValidations, getPublicWarehouse, getWarehouseCharacteristics, harvestBlockReason, WAREHOUSE_STARS_SQL,
};
