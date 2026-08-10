const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// investidor compra cotas de um talhão.
// Toda a checagem de disponibilidade e o débito de cotas acontece dentro
// de uma única transação para evitar overselling em compras simultâneas.
router.post("/", requireAuth, requireRole("investidor"), (req, res) => {
  const { plot_id, cotas } = req.body || {};
  const qtd = Number(cotas);

  if (!plot_id || Number.isNaN(qtd) || qtd <= 0 || !Number.isInteger(qtd)) {
    return res.status(400).json({ error: "Informe uma quantidade válida de cotas." });
  }

  try {
    const result = db.transaction(() => {
      const plot = db.prepare("SELECT * FROM plots WHERE id = ?").get(plot_id);
      if (!plot) throw new AppError(404, "Talhão não encontrado.");

      const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(plot.farm_id);
      if (!farm || farm.status !== "aprovada") {
        throw new AppError(403, "Este talhão não está disponível para investimento.");
      }
      if (plot.status === "colhido" || plot.status === "pago") {
        throw new AppError(409, "Este talhão já encerrou o ciclo de captação.");
      }
      if (plot.cotas_disponiveis < qtd) {
        throw new AppError(409, `Só restam ${plot.cotas_disponiveis} cotas disponíveis.`);
      }

      const valorInvestido = qtd * plot.cota_valor;

      db.prepare("UPDATE plots SET cotas_disponiveis = cotas_disponiveis - ? WHERE id = ?").run(qtd, plot.id);

      const info = db
        .prepare(
          "INSERT INTO investments (user_id, plot_id, cotas, valor_investido) VALUES (?, ?, ?, ?)"
        )
        .run(req.user.id, plot.id, qtd, valorInvestido);

      return db.prepare("SELECT * FROM investments WHERE id = ?").get(info.lastInsertRowid);
    })();

    res.status(201).json({ investment: result });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Não foi possível concluir o investimento. Tente novamente." });
  }
});

// carteira do investidor logado, com dados do talhão e do payout (se já pago)
router.get("/me", requireAuth, requireRole("investidor"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT i.*, p.nome as plot_nome, p.grao, p.fase_atual, p.progresso, p.safra, p.status as plot_status,
              f.name as farm_name,
              po.valor_bruto, po.comissao_fazenda, po.comissao_app, po.valor_liquido
       FROM investments i
       JOIN plots p ON p.id = i.plot_id
       JOIN farms f ON f.id = p.farm_id
       LEFT JOIN payouts po ON po.investment_id = i.id
       WHERE i.user_id = ?
       ORDER BY i.created_at DESC`
    )
    .all(req.user.id);

  res.json({ investments: rows });
});

// fazenda ou admin: quem investiu em determinado talhão (sem expor e-mail/senha)
router.get("/plot/:plotId", requireAuth, requireRole("fazenda", "admin"), (req, res) => {
  const plot = db.prepare("SELECT * FROM plots WHERE id = ?").get(req.params.plotId);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(plot.farm_id);
  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não administra este talhão." });
  }

  const rows = db
    .prepare(
      `SELECT i.id, i.cotas, i.valor_investido, i.status, i.created_at, u.name as investidor_nome
       FROM investments i JOIN users u ON u.id = i.user_id
       WHERE i.plot_id = ? ORDER BY i.created_at DESC`
    )
    .all(req.params.plotId);

  res.json({ investments: rows });
});

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = router;
