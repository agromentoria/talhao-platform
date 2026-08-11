const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getFarmInvestorIds, getPlotInvestorIds } = require("../notify");

const router = express.Router();

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.*, f.name as farm_name, p.nome as plot_nome, p.grao as plot_grao
     FROM notifications n
     LEFT JOIN farms f ON f.id = n.farm_id
     LEFT JOIN plots p ON p.id = n.plot_id
     WHERE n.recipient_user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [req.user.id]
  );
  const unread = rows.filter((n) => !n.read_at).length;
  res.json({ notifications: rows, unread });
}));

router.patch("/:id/read", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "UPDATE notifications SET read_at = now() WHERE id = $1 AND recipient_user_id = $2 RETURNING *",
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Aviso não encontrado." });
  res.json({ notification: rows[0] });
}));

router.patch("/read-all", requireAuth, asyncHandler(async (req, res) => {
  await pool.query(
    "UPDATE notifications SET read_at = now() WHERE recipient_user_id = $1 AND read_at IS NULL",
    [req.user.id]
  );
  res.json({ ok: true });
}));

// fazenda (ou admin em nome dela) manda um aviso manual para os investidores
router.post("/farm-broadcast", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { farm_id, plot_id, title, body } = req.body || {};

  if (!farm_id || !title || !body) {
    return res.status(400).json({ error: "Preencha o título e a mensagem do aviso." });
  }

  const farmResult = await pool.query("SELECT * FROM farms WHERE id = $1", [farm_id]);
  const farm = farmResult.rows[0];
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não administra esta fazenda." });
  }

  let recipientIds;
  if (plot_id) {
    const plotResult = await pool.query("SELECT * FROM plots WHERE id = $1 AND farm_id = $2", [plot_id, farm_id]);
    if (!plotResult.rows.length) return res.status(404).json({ error: "Talhão não encontrado nesta fazenda." });
    recipientIds = await getPlotInvestorIds(pool, plot_id);
  } else {
    recipientIds = await getFarmInvestorIds(pool, farm_id);
  }

  const sent = await notifyUsers(pool, recipientIds, {
    senderRole: "fazenda",
    farmId: farm_id,
    plotId: plot_id || null,
    type: "aviso_fazenda",
    title,
    body,
  });

  res.json({ ok: true, enviados: sent });
}));

// admin manda aviso para fazendas, investidores, ou todos
router.post("/admin-broadcast", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { target, title, body } = req.body || {};

  if (!["fazendas", "investidores", "todos"].includes(target)) {
    return res.status(400).json({ error: "Escolha o público do aviso." });
  }
  if (!title || !body) {
    return res.status(400).json({ error: "Preencha o título e a mensagem do aviso." });
  }

  let roleFilter = [];
  if (target === "fazendas") roleFilter = ["fazenda"];
  else if (target === "investidores") roleFilter = ["investidor"];
  else roleFilter = ["fazenda", "investidor"];

  const { rows } = await pool.query(
    `SELECT id FROM users WHERE role = ANY($1)`,
    [roleFilter]
  );
  const recipientIds = rows.map((r) => r.id);

  const sent = await notifyUsers(pool, recipientIds, {
    senderRole: "admin",
    type: "aviso_admin",
    title,
    body,
  });

  res.json({ ok: true, enviados: sent });
}));

module.exports = router;
