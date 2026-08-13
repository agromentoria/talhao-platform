const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// calcula a nota em estrelas (0 a 5, uma casa decimal) a partir dos
// pontos das características que a fazenda marcou, em relação ao total
// possível do catálogo inteiro
async function calcularEstrelas(farmId) {
  const totalResult = await pool.query("SELECT COALESCE(SUM(pontos), 0) as total FROM farm_characteristics_catalog");
  const totalPontos = Number(totalResult.rows[0].total) || 1;

  const farmResult = await pool.query(
    `SELECT COALESCE(SUM(c.pontos), 0) as pontos
     FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key
     WHERE fc.farm_id = $1`,
    [farmId]
  );
  const pontosFarm = Number(farmResult.rows[0].pontos) || 0;

  const estrelas = Math.round((pontosFarm / totalPontos) * 5 * 10) / 10;
  return { estrelas: Math.min(5, Math.max(0, estrelas)), pontosFarm, totalPontos };
}

router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, location, commission_pct, status FROM farms WHERE status = 'aprovada' ORDER BY name"
  );
  res.json({ farms: rows });
}));

// perfil público da fazenda — qualquer investidor pode ver, sem precisar
// ser dono nem admin (diferente do GET /:id, que traz dados de gestão)
router.get("/:id/profile", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, location, descricao, premiacoes, status FROM farms WHERE id = $1",
    [req.params.id]
  );
  const farm = rows[0];
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const { rows: caracteristicas } = await pool.query(
    `SELECT c.key, c.label, c.categoria, c.pontos
     FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key
     WHERE fc.farm_id = $1
     ORDER BY c.categoria, c.label`,
    [req.params.id]
  );

  const { estrelas } = await calcularEstrelas(farm.id);

  res.json({ farm, caracteristicas, estrelas });
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

// fazenda edita sua própria descrição, prêmios e quais características
// técnicas ela tem — isso recalcula a nota em estrelas automaticamente
router.patch("/:id/profile", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { descricao, premiacoes, caracteristicas } = req.body || {};

  const existing = await pool.query("SELECT * FROM farms WHERE id = $1", [req.params.id]);
  const farm = existing.rows[0];
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você só pode editar o perfil da sua própria fazenda." });
  }

  if (descricao != null && descricao.length > 3000) {
    return res.status(400).json({ error: "Descrição muito longa (máximo 3000 caracteres)." });
  }
  if (premiacoes != null && premiacoes.length > 1500) {
    return res.status(400).json({ error: "Texto de prêmios muito longo (máximo 1500 caracteres)." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "UPDATE farms SET descricao = COALESCE($1, descricao), premiacoes = COALESCE($2, premiacoes) WHERE id = $3",
      [descricao, premiacoes, farm.id]
    );

    if (Array.isArray(caracteristicas)) {
      await client.query("DELETE FROM farm_characteristics WHERE farm_id = $1", [farm.id]);
      for (const key of caracteristicas) {
        await client.query(
          "INSERT INTO farm_characteristics (farm_id, characteristic_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [farm.id, key]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { estrelas } = await calcularEstrelas(farm.id);
  res.json({ ok: true, estrelas });
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
