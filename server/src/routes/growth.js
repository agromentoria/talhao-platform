// Crescimento: lista de espera dos talhões esgotados e programa de indicação.
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
const BONUS_INDICADOR = Number(process.env.BONUS_INDICADOR) || 20; // R$ em crédito
const BONUS_INDICADO = Number(process.env.BONUS_INDICADO) || 20;

async function resumoEspera(plotId, userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS pessoas, COALESCE(SUM(cotas), 0)::int AS cotas,
            (SELECT cotas FROM plot_waitlist WHERE plot_id = $1 AND user_id = $2) AS minhas,
            (SELECT COUNT(*)::int + 1 FROM plot_waitlist w2 WHERE w2.plot_id = $1
               AND w2.created_at < (SELECT created_at FROM plot_waitlist WHERE plot_id = $1 AND user_id = $2)) AS posicao
     FROM plot_waitlist WHERE plot_id = $1`,
    [plotId, userId || 0]
  );
  const r = rows[0];
  return { pessoas: r.pessoas, cotas: r.cotas, na_lista: r.minhas != null, minhas_cotas: r.minhas, posicao: r.minhas != null ? r.posicao : null };
}

router.get("/waitlist/:plotId", requireAuth, asyncHandler(async (req, res) => {
  res.json(await resumoEspera(req.params.plotId, req.user.id));
}));

router.post("/waitlist/:plotId", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const cotas = Math.max(1, Math.min(100000, Math.floor(Number(req.body?.cotas) || 1)));
  const { rows } = await pool.query("SELECT id, cotas_disponiveis, status FROM plots WHERE id = $1", [req.params.plotId]);
  if (!rows[0]) return res.status(404).json({ error: "Talhão não encontrado." });
  if (Number(rows[0].cotas_disponiveis) > 0) {
    return res.status(400).json({ error: "Ainda há sacas disponíveis neste talhão: compre direto." });
  }
  await pool.query(
    `INSERT INTO plot_waitlist (plot_id, user_id, cotas) VALUES ($1, $2, $3)
     ON CONFLICT (plot_id, user_id) DO UPDATE SET cotas = EXCLUDED.cotas`,
    [req.params.plotId, req.user.id, cotas]
  );
  res.status(201).json(await resumoEspera(req.params.plotId, req.user.id));
}));

router.delete("/waitlist/:plotId", requireAuth, asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM plot_waitlist WHERE plot_id = $1 AND user_id = $2", [req.params.plotId, req.user.id]);
  res.json(await resumoEspera(req.params.plotId, req.user.id));
}));

// demanda reprimida: para fundo e administração saberem onde falta talhão
router.get("/waitlist", requireAuth, requireRole("admin", "fundo"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id AS plot_id, p.nome, p.grao, p.unidade, f.name AS farm_name, COUNT(w.id)::int AS pessoas, SUM(w.cotas)::int AS cotas
     FROM plot_waitlist w JOIN plots p ON p.id = w.plot_id JOIN farms f ON f.id = p.farm_id
     WHERE w.notified_at IS NULL GROUP BY p.id, f.name ORDER BY cotas DESC LIMIT 50`
  );
  res.json({ talhoes: rows, pessoas: rows.reduce((s, r) => s + r.pessoas, 0) });
}));

// ---------- indicação ----------
router.get("/indicacao/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.codigo_indicacao,
            (SELECT COUNT(*)::int FROM users x WHERE x.indicado_por = u.id) AS indicados,
            (SELECT COUNT(*)::int FROM referral_rewards r WHERE r.referrer_id = u.id) AS compraram,
            COALESCE((SELECT SUM(valor_indicador) FROM referral_rewards r WHERE r.referrer_id = u.id), 0)
              + COALESCE((SELECT SUM(valor_indicado) FROM referral_rewards r WHERE r.referred_id = u.id), 0) AS credito
     FROM users u WHERE u.id = $1`,
    [req.user.id]
  );
  res.json({ ...rows[0], credito: Number(rows[0]?.credito || 0), bonus_indicador: BONUS_INDICADOR, bonus_indicado: BONUS_INDICADO });
}));

// chamada depois de cada compra: a 1ª compra de quem foi indicado gera os bônus
async function registrarIndicacao(userId, investmentId) {
  const { rows } = await pool.query(
    `INSERT INTO referral_rewards (referrer_id, referred_id, investment_id, valor_indicador, valor_indicado)
     SELECT u.indicado_por, u.id, $2, $3, $4 FROM users u WHERE u.id = $1 AND u.indicado_por IS NOT NULL
     ON CONFLICT (referred_id) DO NOTHING RETURNING referrer_id`,
    [userId, investmentId, BONUS_INDICADOR, BONUS_INDICADO]
  );
  return rows[0]?.referrer_id || null;
}

module.exports = { router, registrarIndicacao, BONUS_INDICADOR };
