const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// lista pública: só fazendas aprovadas aparecem na vitrine
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id, name, location, commission_pct, status FROM farms WHERE status = 'aprovada' ORDER BY name")
    .all();
  res.json({ farms: rows });
});

// dono da fazenda ou admin: ver detalhes completos, incluindo pendentes
router.get("/:id", requireAuth, (req, res) => {
  const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(req.params.id);
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não tem acesso a esta fazenda." });
  }
  res.json({ farm });
});

// admin: lista fazendas pendentes de aprovação
router.get("/status/pendentes", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db.prepare("SELECT * FROM farms WHERE status = 'pendente' ORDER BY created_at").all();
  res.json({ farms: rows });
});

// admin aprova ou suspende uma fazenda
router.patch("/:id/status", requireAuth, requireRole("admin"), (req, res) => {
  const { status } = req.body || {};
  if (!["aprovada", "suspensa", "pendente"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(req.params.id);
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  db.prepare("UPDATE farms SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ farm: db.prepare("SELECT * FROM farms WHERE id = ?").get(req.params.id) });
});

// dono da fazenda (ou admin) define a própria comissão sobre o lucro da colheita
router.patch("/:id/commission", requireAuth, requireRole("fazenda", "admin"), (req, res) => {
  const { commission_pct } = req.body || {};
  const pct = Number(commission_pct);

  if (Number.isNaN(pct) || pct < 0 || pct > 50) {
    return res.status(400).json({ error: "A comissão deve ser um número entre 0 e 50." });
  }

  const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(req.params.id);
  if (!farm) return res.status(404).json({ error: "Fazenda não encontrada." });

  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você só pode alterar a comissão da sua própria fazenda." });
  }

  db.prepare("UPDATE farms SET commission_pct = ? WHERE id = ?").run(pct, req.params.id);
  res.json({ farm: db.prepare("SELECT * FROM farms WHERE id = ?").get(req.params.id) });
});

module.exports = router;
