const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getFasePricingMap, setFaseMultiplier } = require("../settings");

const router = express.Router();

router.get("/", asyncHandler(async (req, res) => {
  const map = await getFasePricingMap();
  res.json({ multiplicadores: map });
}));

router.put("/:fase", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const fase = Number(req.params.fase);
  const multiplicador = Number(req.body?.multiplicador);

  if (Number.isNaN(fase) || fase < 0 || fase > 4) {
    return res.status(400).json({ error: "Fase inválida. Use um número de 0 a 4 (fase 5, Colheita, não é vendável)." });
  }
  if (Number.isNaN(multiplicador) || multiplicador < 1 || multiplicador > 3) {
    return res.status(400).json({ error: "O multiplicador deve ser um número entre 1 e 3." });
  }

  const row = await setFaseMultiplier(fase, multiplicador);
  res.json({ pricing: row });
}));

module.exports = router;
