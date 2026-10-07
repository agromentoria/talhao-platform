const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getAppCommissionPct, setAppCommissionPct } = require("../settings");
const { notifyUsers } = require("../notify");
const { maybePublish, pendencias } = require("../publication");
const { WAREHOUSE_STARS_SQL } = require("../custody");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/settings", asyncHandler(async (req, res) => {
  const app_commission_pct = await getAppCommissionPct();
  res.json({ app_commission_pct });
}));

router.put("/settings", asyncHandler(async (req, res) => {
  const pct = Number(req.body?.app_commission_pct);
  if (Number.isNaN(pct) || pct < 0 || pct > 30) {
    return res.status(400).json({ error: "A comissão da plataforma deve ser um número entre 0 e 30." });
  }
  const settings = await setAppCommissionPct(pct);
  res.json({ app_commission_pct: settings.app_commission_pct });
}));

router.get("/overview", asyncHandler(async (req, res) => {
  const totalCaptado = (await pool.query("SELECT COALESCE(SUM(valor_investido), 0) as total FROM investments")).rows[0].total;
  const comissaoAppAcumulada = (await pool.query("SELECT COALESCE(SUM(comissao_app), 0) as total FROM payouts")).rows[0].total;
  const fazendasAtivas = (await pool.query("SELECT COUNT(*) as n FROM farms WHERE status = 'aprovada'")).rows[0].n;
  const fazendasPendentes = (await pool.query("SELECT COUNT(*) as n FROM farms WHERE status = 'pendente'")).rows[0].n;
  const talhoesAtivos = (await pool.query("SELECT COUNT(*) as n FROM plots WHERE status IN ('captacao','em_andamento')")).rows[0].n;
  const investidores = (await pool.query("SELECT COUNT(*) as n FROM users WHERE role = 'investidor' AND deleted_at IS NULL")).rows[0].n;
  const armazensAtivos = (await pool.query("SELECT COUNT(*) as n FROM warehouses WHERE status = 'aprovado'")).rows[0].n;
  const armazensPendentes = (await pool.query("SELECT COUNT(*) as n FROM warehouses WHERE status = 'pendente'")).rows[0].n;
  const talhoesParaAprovar = (await pool.query("SELECT COUNT(*) as n FROM plots WHERE aprovacao_status = 'pendente'")).rows[0].n;
  const talhoesGarantidos = (await pool.query("SELECT COUNT(*) as n FROM plots WHERE custodia_status = 'aceita' AND status IN ('captacao','em_andamento','aguardando_aprovacao')")).rows[0].n;

  res.json({
    totalCaptado: Number(totalCaptado),
    comissaoAppAcumulada: Number(comissaoAppAcumulada),
    fazendasAtivas: Number(fazendasAtivas),
    fazendasPendentes: Number(fazendasPendentes),
    talhoesAtivos: Number(talhoesAtivos),
    investidores: Number(investidores),
    armazensAtivos: Number(armazensAtivos),
    armazensPendentes: Number(armazensPendentes),
    talhoesGarantidos: Number(talhoesGarantidos),
    talhoesParaAprovar: Number(talhoesParaAprovar),
  });
}));

// lista de fazendas com os mesmos dados de resumo da lista de armazéns:
// responsável, nota em estrelas, talhões ativos e valor captado
router.get("/farms", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT f.*, u.name AS responsavel, u.email AS responsavel_email,
            ROUND((
              COALESCE((SELECT SUM(c.pontos) FROM farm_characteristics fc
                        JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key
                        WHERE fc.farm_id = f.id), 0)::numeric
              / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5
            ), 1)::float8 AS estrelas,
            (SELECT COUNT(*)::int FROM plots p WHERE p.farm_id = f.id AND p.status IN ('captacao', 'em_andamento')) AS talhoes_ativos,
            (SELECT COALESCE(SUM(i.valor_investido), 0)::float8 FROM investments i JOIN plots p ON p.id = i.plot_id
              WHERE p.farm_id = f.id) AS total_captado
     FROM farms f LEFT JOIN users u ON u.id = f.owner_user_id
     ORDER BY (f.status = 'pendente') DESC, f.created_at DESC`
  );
  res.json({ farms: rows });
}));

router.get("/plots", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT p.*, f.name as farm_name FROM plots p JOIN farms f ON f.id = p.farm_id ORDER BY p.created_at DESC"
  );
  res.json({ plots: rows });
}));

router.get("/transactions", asyncHandler(async (req, res) => {
  const { type } = req.query;
  let sql = `
    SELECT t.*, u.name as user_name, f.name as farm_name, p.nome as plot_nome
    FROM transactions t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN farms f ON f.id = t.farm_id
    LEFT JOIN plots p ON p.id = t.plot_id
  `;
  const params = [];
  if (type) {
    params.push(type);
    sql += ` WHERE t.type = $${params.length}`;
  }
  sql += " ORDER BY t.created_at DESC LIMIT 300";

  const { rows } = await pool.query(sql, params);

  const totals = await pool.query(
    `SELECT type, COUNT(*) as n, COALESCE(SUM(amount), 0) as total FROM transactions GROUP BY type`
  );

  res.json({
    transactions: rows,
    totals: totals.rows.reduce((acc, r) => {
      acc[r.type] = { count: Number(r.n), total: Number(r.total) };
      return acc;
    }, {}),
  });
}));

// ---------- aprovação de talhões ----------
// Todo talhão novo (ou novo ciclo) passa pela administração antes de ir ao
// ar. Junto com o aceite do armazém, evita talhão sem garantia na vitrine.
router.get("/plot-approvals", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, f.name AS farm_name, f.location AS farm_location, f.status AS farm_status,
            w.name AS warehouse_name, ${WAREHOUSE_STARS_SQL} AS warehouse_estrelas
     FROM plots p JOIN farms f ON f.id = p.farm_id LEFT JOIN warehouses w ON w.id = p.warehouse_id
     WHERE p.aprovacao_status IN ('pendente', 'rejeitado') AND p.status = 'captacao'
     ORDER BY (p.aprovacao_status = 'pendente') DESC, p.created_at DESC`
  );
  res.json({ plots: rows.map((p) => ({ ...p, pendencias: pendencias(p) })) });
}));

router.post("/plot-approvals/:id/approve", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE plots p SET aprovacao_status = 'aprovado', aprovacao_motivo = NULL, aprovacao_em = now()
     FROM farms f WHERE p.id = $1 AND f.id = p.farm_id AND p.aprovacao_status IN ('pendente','rejeitado')
     RETURNING p.*, f.owner_user_id, f.name AS farm_name`,
    [req.params.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado ou já aprovado." });
  const publicado = await maybePublish(plot.id);
  if (!publicado) {
    await notifyUsers(pool, [plot.owner_user_id], {
      senderRole: "admin", farmId: plot.farm_id, plotId: plot.id, type: "talhao_aprovado",
      title: `${plot.nome} aprovado pela administração`,
      body: plot.custodia_status === "aceita" ? "O talhão já pode receber investimentos." : "Falta o armazém garantidor aceitar a custódia para o talhão ir ao ar.",
    });
  }
  res.json({ ok: true, publicado });
}));

router.post("/plot-approvals/:id/reject", asyncHandler(async (req, res) => {
  const motivo = String(req.body?.motivo || "").trim();
  if (motivo.length < 5) return res.status(400).json({ error: "Explique o que a fazenda precisa corrigir." });
  const { rows } = await pool.query(
    `UPDATE plots p SET aprovacao_status = 'rejeitado', aprovacao_motivo = $2, aprovacao_em = now()
     FROM farms f WHERE p.id = $1 AND f.id = p.farm_id AND p.publicado_em IS NULL
     RETURNING p.*, f.owner_user_id`,
    [req.params.id, motivo]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado ou já publicado." });
  await notifyUsers(pool, [plot.owner_user_id], {
    senderRole: "admin", farmId: plot.farm_id, plotId: plot.id, type: "talhao_rejeitado",
    title: `${plot.nome} precisa de ajustes`,
    body: `A administração não aprovou o talhão: ${motivo}. Exclua e cadastre de novo com os dados corrigidos, ou responda pelas Conversas.`,
  });
  res.json({ ok: true });
}));

module.exports = router;
