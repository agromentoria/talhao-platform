// Regras compartilhadas da custódia pelo armazém (usadas em várias rotas)
const { pool } = require("./db");

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

// resumo público do armazém para a página do talhão
async function getPublicWarehouse(db, warehouseId) {
  if (!warehouseId) return null;
  const { rows } = await db.query(
    "SELECT id, name, cnpj, location, capacidade_t, descricao, status FROM warehouses WHERE id = $1",
    [warehouseId]
  );
  return rows[0] || null;
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

module.exports = { pool, ETAPAS, ETAPA_LABEL, ETAPA_ARTIGO, ETAPA_CONFIRMADA, FASE_MINIMA, getValidations, getPublicWarehouse, harvestBlockReason };
