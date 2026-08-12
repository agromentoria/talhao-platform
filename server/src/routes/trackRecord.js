const express = require("express");
const { pool } = require("../db");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// histórico público: como a fazenda se saiu nas colheitas já pagas,
// comparando o que prometeu (previsao_retorno) com o que entregou
// (retorno_final) — ajuda o investidor a avaliar a confiabilidade da
// fazenda antes de investir, com base em resultados passados reais
router.get("/:farmId", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, nome, grao, safra, previsao_retorno, retorno_final
     FROM plots
     WHERE farm_id = $1 AND status = 'pago' AND retorno_final IS NOT NULL
     ORDER BY created_at DESC`,
    [req.params.farmId]
  );

  const historico = rows.map((p) => ({
    ...p,
    desvio: Number((p.retorno_final - p.previsao_retorno).toFixed(2)),
    cumpriu: p.retorno_final >= p.previsao_retorno,
  }));

  const totalColhidos = historico.length;
  const cumpriuCount = historico.filter((h) => h.cumpriu).length;
  const desvioMedio = totalColhidos
    ? Number((historico.reduce((s, h) => s + h.desvio, 0) / totalColhidos).toFixed(2))
    : null;

  res.json({
    historico,
    resumo: {
      totalColhidos,
      cumpriuPromessaPct: totalColhidos ? Math.round((cumpriuCount / totalColhidos) * 100) : null,
      desvioMedio,
    },
  });
}));

module.exports = router;
