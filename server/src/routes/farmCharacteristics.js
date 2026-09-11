const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM farm_characteristics_catalog ORDER BY categoria, label"
  );
  res.json({ catalog: rows });
}));

router.put("/:key", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { pontos } = req.body || {};
  const p = Number(pontos);
  if (Number.isNaN(p) || p < 0 || p > 10) {
    return res.status(400).json({ error: "Pontos devem ser um número entre 0 e 10." });
  }
  const { rows } = await pool.query(
    "UPDATE farm_characteristics_catalog SET pontos = $1 WHERE key = $2 RETURNING *",
    [p, req.params.key]
  );
  if (!rows.length) return res.status(404).json({ error: "Característica não encontrada." });
  res.json({ item: rows[0] });
}));

module.exports = router;
