const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers } = require("../notify");
const { getAppCommissionPct } = require("../settings");
const { executeHarvestPayout } = require("../harvestPayout");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", asyncHandler(async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT hr.*, p.nome as plot_nome, p.grao, p.unidade, p.previsao_retorno, p.fase_atual,
           f.name as farm_name, f.location as farm_location, f.commission_pct,
           u.name as solicitado_por
    FROM harvest_requests hr
    JOIN plots p ON p.id = hr.plot_id
    JOIN farms f ON f.id = hr.farm_id
    LEFT JOIN users u ON u.id = hr.requested_by
  `;
  const params = [];
  if (status) {
    params.push(status);
    sql += ` WHERE hr.status = $${params.length}`;
  }
  sql += " ORDER BY hr.created_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json({ requests: rows });
}));

router.post("/:id/approve", asyncHandler(async (req, res) => {
  const { rows: reqRows } = await pool.query("SELECT * FROM harvest_requests WHERE id = $1", [req.params.id]);
  const request = reqRows[0];
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.status !== "pendente") {
    return res.status(409).json({ error: "Esta solicitação já foi revisada." });
  }

  const { rows: plotRows } = await pool.query("SELECT * FROM plots WHERE id = $1", [request.plot_id]);
  const plot = plotRows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const { rows: farmRows } = await pool.query("SELECT * FROM farms WHERE id = $1", [request.farm_id]);
  const farm = farmRows[0];

  const appCommissionPct = await getAppCommissionPct();
  const result = await executeHarvestPayout({ plot, farm, retorno: request.retorno_final, appCommissionPct });

  await pool.query(
    "UPDATE harvest_requests SET status = 'aprovado', reviewed_by = $1, reviewed_at = now() WHERE id = $2",
    [req.user.id, request.id]
  );

  res.json({ ok: true, ...result });
}));

router.post("/:id/reject", asyncHandler(async (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: "Explique o motivo da rejeição para a fazenda." });
  }

  const { rows: reqRows } = await pool.query("SELECT * FROM harvest_requests WHERE id = $1", [req.params.id]);
  const request = reqRows[0];
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.status !== "pendente") {
    return res.status(409).json({ error: "Esta solicitação já foi revisada." });
  }

  await pool.query(
    "UPDATE harvest_requests SET status = 'rejeitado', motivo_rejeicao = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3",
    [motivo.trim(), req.user.id, request.id]
  );
  await pool.query("UPDATE plots SET status = 'em_andamento' WHERE id = $1", [request.plot_id]);

  const { rows: plotRows } = await pool.query("SELECT nome FROM plots WHERE id = $1", [request.plot_id]);

  if (request.requested_by) {
    await notifyUsers(pool, [request.requested_by], {
      senderRole: "admin",
      farmId: request.farm_id,
      plotId: request.plot_id,
      type: "solicitacao_rejeitada",
      title: "Solicitação de colheita rejeitada",
      body: `Sua solicitação de finalização de ${plotRows[0]?.nome || "talhão"} foi rejeitada: ${motivo.trim()}`,
    });
  }

  res.json({ ok: true });
}));

module.exports = router;
