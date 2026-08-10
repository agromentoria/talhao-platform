const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/overview", (req, res) => {
  const totalCaptado = db
    .prepare("SELECT COALESCE(SUM(valor_investido), 0) as total FROM investments")
    .get().total;

  const comissaoAppAcumulada = db
    .prepare("SELECT COALESCE(SUM(comissao_app), 0) as total FROM payouts")
    .get().total;

  const fazendasAtivas = db
    .prepare("SELECT COUNT(*) as n FROM farms WHERE status = 'aprovada'")
    .get().n;

  const fazendasPendentes = db
    .prepare("SELECT COUNT(*) as n FROM farms WHERE status = 'pendente'")
    .get().n;

  const talhoesAtivos = db
    .prepare("SELECT COUNT(*) as n FROM plots WHERE status IN ('captacao','em_andamento')")
    .get().n;

  const investidores = db
    .prepare("SELECT COUNT(*) as n FROM users WHERE role = 'investidor'")
    .get().n;

  res.json({
    totalCaptado,
    comissaoAppAcumulada,
    fazendasAtivas,
    fazendasPendentes,
    talhoesAtivos,
    investidores,
  });
});

router.get("/farms", (req, res) => {
  const rows = db.prepare("SELECT * FROM farms ORDER BY created_at DESC").all();
  res.json({ farms: rows });
});

router.get("/plots", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, f.name as farm_name FROM plots p JOIN farms f ON f.id = p.farm_id ORDER BY p.created_at DESC`
    )
    .all();
  res.json({ plots: rows });
});

module.exports = router;
