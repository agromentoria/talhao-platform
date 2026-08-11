const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// pública — qualquer tela que precise saber a unidade/preço/produtividade
// de referência de cada grão (ex: formulário de novo talhão)
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM commodity_references ORDER BY grao");
  res.json({ references: rows });
}));

router.put("/:grao", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { unidade, preco_unidade, produtividade_ha } = req.body || {};

  if (!["saca", "fardo", "arroba"].includes(unidade)) {
    return res.status(400).json({ error: "Unidade inválida. Use saca, fardo ou arroba." });
  }
  const preco = Number(preco_unidade);
  const produtividade = Number(produtividade_ha);
  if (Number.isNaN(preco) || preco <= 0 || Number.isNaN(produtividade) || produtividade <= 0) {
    return res.status(400).json({ error: "Preço e produtividade devem ser números maiores que zero." });
  }

  const { rows } = await pool.query(
    `INSERT INTO commodity_references (grao, unidade, preco_unidade, produtividade_ha, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (grao) DO UPDATE SET unidade = $2, preco_unidade = $3, produtividade_ha = $4, updated_at = now()
     RETURNING *`,
    [req.params.grao, unidade, preco, produtividade]
  );
  res.json({ reference: rows[0] });
}));

module.exports = router;
