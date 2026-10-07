const express = require("express");
const { despesaReal } = require("../storageFees");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers } = require("../notify");
const { getAppCommissionPct } = require("../settings");
const { executeHarvestPayout } = require("../harvestPayout");
const { harvestBlockReason } = require("../custody");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", asyncHandler(async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT hr.*, p.nome as plot_nome, p.grao, p.variedade, p.tipo_producao, p.unidade, p.previsao_retorno, p.fase_atual,
           p.cotas_totais, p.cotas_disponiveis, p.custodia_status,
           f.name as farm_name, f.location as farm_location, f.commission_pct,
           u.name as solicitado_por,
           w.name as warehouse_name,
           va.resultado as armazenagem_resultado, va.quantidade as armazenagem_quantidade, va.observacao as armazenagem_observacao
    FROM harvest_requests hr
    JOIN plots p ON p.id = hr.plot_id
    JOIN farms f ON f.id = hr.farm_id
    LEFT JOIN users u ON u.id = hr.requested_by
    LEFT JOIN warehouses w ON w.id = p.warehouse_id
    LEFT JOIN plot_validations va ON va.plot_id = p.id AND va.etapa = 'armazenagem'
  `;
  const params = [];
  if (status) {
    params.push(status);
    sql += ` WHERE hr.status = $${params.length}`;
  }
  sql += " ORDER BY hr.created_at DESC";
  const { rows } = await pool.query(sql, params);
  // despesa de armazenagem até hoje, para a administração conferir antes de aprovar
  const { rows: plots } = rows.length
    ? await pool.query("SELECT * FROM plots WHERE id = ANY($1)", [rows.map((r) => r.plot_id)])
    : { rows: [] };
  const byId = Object.fromEntries(plots.map((p) => [p.id, p]));
  const enriched = rows.map((r) => {
    const p = byId[r.plot_id];
    if (!p || !p.warehouse_id) return r;
    const vendidas = p.cotas_totais - p.cotas_disponiveis;
    const precoVenda = p.preco_venda_estimado * (1 + Number(r.retorno_final ?? p.previsao_retorno) / 100);
    const d = despesaReal(p, { unidades: vendidas, precoVenda });
    return { ...r, armazenagem: { ...d, pagador: p.arm_pagador, entrada_em: p.arm_entrada_em } };
  });
  res.json({ requests: enriched });
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

  // com armazém garantidor, o pagamento só sai depois da armazenagem confirmada
  const bloqueio = await harvestBlockReason(pool, plot);
  if (bloqueio) return res.status(409).json({ error: bloqueio });

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
