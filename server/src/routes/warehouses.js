const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getPlotInvestorIds } = require("../notify");
const { validatePhotoData } = require("../validators");
const { ETAPAS, FASE_MINIMA, etapaLabel, getValidations, getWarehouseCharacteristics, WAREHOUSE_STARS_SQL } = require("../custody");
const { fasesDe, unidadeTexto } = require("../culturas");
const { maybePublish } = require("../publication");
const { fmtNumber } = require("../format");

const router = express.Router();

// aviso não pode desfazer uma decisão já gravada: falha vira só registro no log
async function safeNotify(ids, payload) {
  try { await notifyUsers(pool, ids, payload); } catch (err) { console.error("[aviso não enviado]", err.message); }
}

const unidade = (u, n) => unidadeTexto(u, n);

async function myWarehouse(req) {
  if (!req.user.warehouse_id) return null;
  const { rows } = await pool.query("SELECT * FROM warehouses WHERE id = $1", [req.user.warehouse_id]);
  return rows[0] || null;
}

// ---------- fazenda/admin: armazéns credenciados para escolher ----------
router.get("/approved", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.cnpj, w.location, w.capacidade_t, ${WAREHOUSE_STARS_SQL} AS estrelas,
            w.tarifa_recepcao, w.tarifa_quinzena, w.carencia_quinzenas, w.quebra_quinzena_pct
     FROM warehouses w WHERE w.status = 'aprovado' ORDER BY estrelas DESC NULLS LAST, w.name`
  );
  res.json({ warehouses: rows });
}));

// ---------- armazém: painel ----------
router.get("/mine", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse) return res.status(404).json({ error: "Armazém não encontrado para esta conta." });

  const { rows: est } = await pool.query(`SELECT ${WAREHOUSE_STARS_SQL} AS estrelas FROM warehouses w WHERE w.id = $1`, [warehouse.id]);
  warehouse.estrelas = est[0].estrelas;
  warehouse.caracteristicas = (await getWarehouseCharacteristics(pool, warehouse.id)).map((c) => c.key);
  const { rows: rec } = await pool.query(
    "SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM transactions WHERE type = 'tarifa_armazem' AND user_id = $1",
    [req.user.id]
  );
  warehouse.tarifas_recebidas = rec[0].total;

  const { rows: plots } = await pool.query(
    `SELECT p.id, p.nome, p.grao, p.variedade, p.tipo_producao, p.plantio_ate, p.colheita_prevista, p.aprovacao_status, p.safra, p.area_ha, p.unidade, p.fase_atual, p.progresso, p.status,
            p.cotas_totais, p.cotas_disponiveis, p.custodia_status, p.custodia_motivo, p.custodia_em, p.created_at,
            f.id AS farm_id, f.name AS farm_name, f.location AS farm_location, f.owner_user_id AS farm_user_id
     FROM plots p JOIN farms f ON f.id = p.farm_id
     WHERE p.warehouse_id = $1 AND p.status <> 'arquivado'
     ORDER BY (p.custodia_status = 'pendente') DESC, p.created_at DESC`,
    [warehouse.id]
  );
  for (const p of plots) p.validacoes = await getValidations(pool, p.id);
  res.json({ warehouse, plots });
}));

router.patch("/mine", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse) return res.status(404).json({ error: "Armazém não encontrado." });
  const { name, location, capacidade_t, descricao } = req.body || {};
  if (!name || !String(name).trim() || !location) return res.status(400).json({ error: "Informe nome e localização do armazém." });
  const cap = capacidade_t === "" || capacidade_t == null ? null : Number(capacidade_t);
  if (cap !== null && (Number.isNaN(cap) || cap < 0)) return res.status(400).json({ error: "Capacidade inválida." });

  // tabela de tarifas (vale para custódias aceitas daqui em diante)
  const num = (v, d) => (v === "" || v == null ? d : Number(v));
  const tarifa_recepcao = num(req.body.tarifa_recepcao, warehouse.tarifa_recepcao);
  const tarifa_quinzena = num(req.body.tarifa_quinzena, warehouse.tarifa_quinzena);
  const carencia = num(req.body.carencia_quinzenas, warehouse.carencia_quinzenas);
  const quebra = num(req.body.quebra_quinzena_pct, warehouse.quebra_quinzena_pct);
  if ([tarifa_recepcao, tarifa_quinzena, carencia, quebra].some((v) => Number.isNaN(v) || v < 0)
      || tarifa_recepcao > 100 || tarifa_quinzena > 50 || carencia > 24 || quebra > 2) {
    return res.status(400).json({ error: "Confira a tabela de tarifas: valores negativos ou fora do normal." });
  }
  const { rows } = await pool.query(
    `UPDATE warehouses SET name = $1, location = $2, capacidade_t = $3, descricao = $4,
       tarifa_recepcao = $5, tarifa_quinzena = $6, carencia_quinzenas = $7, quebra_quinzena_pct = $8
     WHERE id = $9 RETURNING *`,
    [String(name).trim(), location, cap, descricao ? String(descricao).slice(0, 2000) : null,
     tarifa_recepcao, tarifa_quinzena, Math.round(carencia), quebra, warehouse.id]
  );
  res.json({ warehouse: rows[0] });
}));

// ---------- pontuação: catálogo e itens marcados pelo armazém ----------
router.get("/characteristics/catalog", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM warehouse_characteristics_catalog ORDER BY categoria, label");
  res.json({ catalog: rows, capacidade: [
    { minimo: 50000, pontos: 4 }, { minimo: 20000, pontos: 3 }, { minimo: 5000, pontos: 2 }, { minimo: 1, pontos: 1 },
  ] });
}));

router.put("/mine/characteristics", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse) return res.status(404).json({ error: "Armazém não encontrado." });
  const keys = Array.isArray(req.body?.keys) ? req.body.keys.map(String) : [];
  const { rows: valid } = await pool.query("SELECT key FROM warehouse_characteristics_catalog WHERE key = ANY($1)", [keys]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM warehouse_characteristics WHERE warehouse_id = $1", [warehouse.id]);
    for (const { key } of valid) {
      await client.query("INSERT INTO warehouse_characteristics (warehouse_id, characteristic_key) VALUES ($1, $2)", [warehouse.id, key]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  const { rows } = await pool.query(`SELECT ${WAREHOUSE_STARS_SQL} AS estrelas FROM warehouses w WHERE w.id = $1`, [warehouse.id]);
  res.json({ keys: valid.map((v) => v.key), estrelas: rows[0].estrelas });
}));

router.put("/characteristics/:key", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const p = Number(req.body?.pontos);
  if (Number.isNaN(p) || p < 0 || p > 10) return res.status(400).json({ error: "Pontos devem ser um número entre 0 e 10." });
  const { rows } = await pool.query("UPDATE warehouse_characteristics_catalog SET pontos = $1 WHERE key = $2 RETURNING *", [p, req.params.key]);
  if (!rows.length) return res.status(404).json({ error: "Item não encontrado." });
  res.json({ item: rows[0] });
}));

// ---------- armazém: aceitar ou recusar a custódia de um talhão ----------
router.post("/plots/:plotId/custody", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse || warehouse.status !== "aprovado") {
    return res.status(403).json({ error: "Seu armazém precisa estar credenciado pela administração para assumir custódias." });
  }
  const { decisao, motivo } = req.body || {};
  if (!["aceitar", "recusar"].includes(decisao)) return res.status(400).json({ error: "Decisão inválida." });
  if (decisao === "recusar" && (!motivo || String(motivo).trim().length < 5)) {
    return res.status(400).json({ error: "Explique o motivo da recusa para a fazenda." });
  }

  const { rows } = await pool.query(
    "SELECT p.*, f.owner_user_id, f.name AS farm_name FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1 AND p.warehouse_id = $2",
    [req.params.plotId, warehouse.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado entre as indicações do seu armazém." });
  if (plot.custodia_status !== "pendente") return res.status(409).json({ error: "Esta indicação já foi respondida." });

  const status = decisao === "aceitar" ? "aceita" : "recusada";
  const { rows: updated } = await pool.query(
    // no aceite, a tabela de tarifas do armazém fica gravada no talhão
    `UPDATE plots SET custodia_status = $1, custodia_motivo = $2, custodia_em = now(),
       arm_tarifa_recepcao = CASE WHEN $1 = 'aceita' THEN $4::real ELSE arm_tarifa_recepcao END,
       arm_tarifa_quinzena = CASE WHEN $1 = 'aceita' THEN $5::real ELSE arm_tarifa_quinzena END,
       arm_carencia = CASE WHEN $1 = 'aceita' THEN $6::int ELSE arm_carencia END,
       arm_quebra_pct = CASE WHEN $1 = 'aceita' THEN $7::real ELSE arm_quebra_pct END
     WHERE id = $3 RETURNING id, custodia_status, custodia_motivo, custodia_em`,
    [status, status === "recusada" ? String(motivo).trim() : null, plot.id, warehouse.tarifa_recepcao, warehouse.tarifa_quinzena, warehouse.carencia_quinzenas, warehouse.quebra_quinzena_pct]
  );

  await safeNotify([plot.owner_user_id], {
    senderRole: "armazem",
    farmId: plot.farm_id,
    plotId: plot.id,
    type: "custodia_armazem",
    title: status === "aceita" ? `${warehouse.name} aceitou a custódia` : `${warehouse.name} recusou a custódia`,
    body: status === "aceita"
      ? `${plot.nome} agora tem garantia do armazém ${warehouse.name}, que vai validar plantio, colheita e armazenagem.`
      : `${warehouse.name} recusou a custódia de ${plot.nome}: ${String(motivo).trim()}. Escolha outro armazém no painel da fazenda.`,
  });
  if (status === "aceita") {
    // aprovado pela administração + custódia aceita = talhão vai ao ar
    await maybePublish(plot.id);
    const investors = await getPlotInvestorIds(pool, plot.id);
    await safeNotify(investors, {
      senderRole: "armazem", farmId: plot.farm_id, plotId: plot.id, type: "custodia_armazem",
      title: `${plot.nome} tem armazém garantidor`,
      body: `${warehouse.name} assumiu a custódia e vai validar cada etapa da safra.`,
    });
  }

  res.json({ plot: updated[0] });
}));

// ---------- armazém: validar uma etapa ----------
router.post("/plots/:plotId/validations", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse || warehouse.status !== "aprovado") {
    return res.status(403).json({ error: "Seu armazém precisa estar credenciado para registrar validações." });
  }
  const { etapa, resultado, quantidade, observacao, foto } = req.body || {};
  if (!ETAPAS.includes(etapa)) return res.status(400).json({ error: "Etapa inválida." });
  if (!["confirmado", "divergente"].includes(resultado)) return res.status(400).json({ error: "Resultado inválido." });
  if (resultado === "divergente" && (!observacao || String(observacao).trim().length < 10)) {
    return res.status(400).json({ error: "Descreva a divergência encontrada (mínimo 10 caracteres)." });
  }
  if (foto) {
    const err = validatePhotoData(foto);
    if (err) return res.status(400).json({ error: err });
  }

  const { rows } = await pool.query(
    "SELECT p.*, f.owner_user_id FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1 AND p.warehouse_id = $2",
    [req.params.plotId, warehouse.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado entre as custódias do seu armazém." });
  if (plot.custodia_status !== "aceita") return res.status(409).json({ error: "Aceite a custódia antes de validar etapas." });
  if (["pago", "arquivado"].includes(plot.status)) return res.status(409).json({ error: "Este talhão já foi encerrado." });
  if (plot.fase_atual < FASE_MINIMA[etapa]) {
    return res.status(409).json({ error: `A fazenda ainda não registrou a fase "${fasesDe(plot)[FASE_MINIMA[etapa]]}" neste talhão.` });
  }

  let qtd = null;
  if (etapa === "armazenagem" || etapa === "colheita") {
    if (quantidade !== undefined && quantidade !== null && quantidade !== "") {
      qtd = Number(quantidade);
      if (Number.isNaN(qtd) || qtd < 0) return res.status(400).json({ error: "Quantidade inválida." });
    }
    if (etapa === "armazenagem" && qtd === null) {
      return res.status(400).json({ error: `Informe a quantidade em ${unidade(plot.unidade, 2)}.` });
    }
  }
  if (etapa === "armazenagem") {
    const { rows: col } = await pool.query("SELECT resultado FROM plot_validations WHERE plot_id = $1 AND etapa = 'colheita'", [plot.id]);
    if (!col.length) return res.status(409).json({ error: "Valide a colheita antes de registrar a armazenagem." });
  }

  const { rows: saved } = await pool.query(
    `INSERT INTO plot_validations (plot_id, warehouse_id, etapa, resultado, quantidade, observacao, foto, validated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (plot_id, etapa) DO UPDATE SET resultado = $4, quantidade = $5, observacao = $6, foto = $7, validated_by = $8, created_at = now()
     RETURNING *`,
    [plot.id, warehouse.id, etapa, resultado, qtd, observacao ? String(observacao).trim().slice(0, 2000) : null, foto || null, req.user.id]
  );

  // armazenagem confirmada = grãos entraram no armazém: começa a contar a tarifa por quinzena
  if (etapa === "armazenagem" && resultado === "confirmado") {
    await pool.query("UPDATE plots SET arm_entrada_em = COALESCE(arm_entrada_em, now()) WHERE id = $1", [plot.id]);
  }

  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  const qtdTexto = qtd !== null ? ` ${fmtNumber(qtd)} ${unidade(plot.unidade, qtd)}` : "";
  const ok = resultado === "confirmado";
  const label = etapaLabel(plot, etapa);
  const title = ok ? `Armazém validou: ${label.toLowerCase()}` : `Divergência em ${label.toLowerCase()} · ${plot.nome}`;
  let body = ok
    ? `${warehouse.name} confirmou a etapa "${label}" de ${plot.nome}.${etapa !== "plantio" && qtd !== null ? ` Quantidade:${qtdTexto}.` : ""}`
    : `${warehouse.name} registrou divergência na etapa "${label}" de ${plot.nome}: ${String(observacao).trim()}`;
  if (etapa === "armazenagem" && qtd !== null && qtd < vendidas) {
    body += ` Atenção: abaixo das ${fmtNumber(vendidas)} ${unidade(plot.unidade, vendidas)} vendidas aos investidores.`;
  }
  const investors = await getPlotInvestorIds(pool, plot.id);
  const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL");
  await safeNotify([plot.owner_user_id, ...investors, ...(ok ? [] : admins.map((a) => a.id))], {
    senderRole: "armazem", farmId: plot.farm_id, plotId: plot.id, type: "validacao_armazem", title, body,
  });

  res.status(201).json({ validation: saved[0] });
}));

// ---------- administração ----------
router.get("/", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, u.name AS responsavel, u.email AS responsavel_email, ${WAREHOUSE_STARS_SQL} AS estrelas,
            (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita'
               AND p.status NOT IN ('pago', 'arquivado')) AS custodias,
            (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'pendente') AS custodias_pendentes
     FROM warehouses w LEFT JOIN users u ON u.id = w.owner_user_id
     ORDER BY (w.status = 'pendente') DESC, w.created_at DESC`
  );
  res.json({ warehouses: rows });
}));

router.patch("/:id/status", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["aprovado", "suspenso", "pendente"].includes(status)) return res.status(400).json({ error: "Status inválido." });
  const { rows } = await pool.query("UPDATE warehouses SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  const w = rows[0];
  if (!w) return res.status(404).json({ error: "Armazém não encontrado." });
  if (w.owner_user_id) {
    await safeNotify([w.owner_user_id], {
      senderRole: "admin", type: "status_armazem",
      title: status === "aprovado" ? "Armazém credenciado" : status === "suspenso" ? "Armazém suspenso" : "Credenciamento em análise",
      body: status === "aprovado"
        ? "Seu armazém foi credenciado. As fazendas já podem indicá-lo como garantidor dos talhões."
        : status === "suspenso"
          ? "Seu armazém foi suspenso pela administração e não pode assumir novas custódias."
          : "Seu credenciamento voltou para análise.",
    });
  }
  res.json({ warehouse: w });
}));

module.exports = router;
