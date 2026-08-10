const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", asyncHandler(async (req, res) => {
  const totalCaptado = (await pool.query("SELECT COALESCE(SUM(valor_investido), 0) as total FROM investments")).rows[0].total;
  const comissaoAppAcumulada = (await pool.query("SELECT COALESCE(SUM(comissao_app), 0) as total FROM payouts")).rows[0].total;
  const fazendasAtivas = (await pool.query("SELECT COUNT(*) as n FROM farms WHERE status = 'aprovada'")).rows[0].n;
  const fazendasPendentes = (await pool.query("SELECT COUNT(*) as n FROM farms WHERE status = 'pendente'")).rows[0].n;
  const talhoesAtivos = (await pool.query("SELECT COUNT(*) as n FROM plots WHERE status IN ('captacao','em_andamento')")).rows[0].n;
  const investidores = (await pool.query("SELECT COUNT(*) as n FROM users WHERE role = 'investidor'")).rows[0].n;

  res.json({
    totalCaptado: Number(totalCaptado),
    comissaoAppAcumulada: Number(comissaoAppAcumulada),
    fazendasAtivas: Number(fazendasAtivas),
    fazendasPendentes: Number(fazendasPendentes),
    talhoesAtivos: Number(talhoesAtivos),
    investidores: Number(investidores),
  });
}));

router.get("/farms", asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM farms ORDER BY created_at DESC");
  res.json({ farms: rows });
}));

router.get("/plots", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT p.*, f.name as farm_name FROM plots p JOIN farms f ON f.id = p.farm_id ORDER BY p.created_at DESC"
  );
  res.json({ plots: rows });
}));

module.exports = router;
