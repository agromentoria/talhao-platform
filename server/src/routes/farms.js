const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, location, commission_pct, status FROM farms WHERE status = 'aprovada' ORDER BY name"
  );
  res.json({ farms: rows });
}));

router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM farms WHERE id = $1", [req.params.id]);
  const farm = rows[0];
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não tem acesso a esta fazenda." });
  }
  res.json({ farm });
}));

router.get("/status/pendentes", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM farms WHERE status = 'pendente' ORDER BY created_at");
  res.json({ farms: rows });
}));

router.patch("/:id/status", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["aprovada", "suspensa", "pendente"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  const existing = await pool.query("SELECT * FROM farms WHERE id = $1", [req.params.id]);
  if (!existing.rows.length) return res.status(404).json({ error: "Fazenda não encontrada." });

  const { rows } = await pool.query(
    "UPDATE farms SET status = $1 WHERE id = $2 RETURNING *",
    [status, req.params.id]
  );
  res.json({ farm: rows[0] });
}));

router.patch("/:id/commission", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { commission_pct } = req.body || {};
  const pct = Number(commission_pct);

  if (Number.isNaN(pct) || pct < 0 || pct > 50) {
    return res.status(400).json({ error: "A comissão deve ser um número entre 0 e 50." });
  }

  const existing = await pool.query("SELECT * FROM farms WHERE id = $1", [req.params.id]);
  const farm = existing.rows[0];
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você só pode alterar a comissão da sua própria fazenda." });
  }

  const { rows } = await pool.query(
    "UPDATE farms SET commission_pct = $1 WHERE id = $2 RETURNING *",
    [pct, req.params.id]
  );
  res.json({ farm: rows[0] });
}));

module.exports = router;
