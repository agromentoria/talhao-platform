const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers } = require("../notify");
const { recordTransaction } = require("../ledger");

const router = express.Router();

class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

router.post("/", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { plot_id, cotas, payment_method_type, payment_method_id } = req.body || {};
  const qtd = Number(cotas);

  if (!plot_id || Number.isNaN(qtd) || qtd <= 0 || !Number.isInteger(qtd)) {
    return res.status(400).json({ error: "Informe uma quantidade válida de cotas." });
  }
  if (!["pix", "cartao_credito", "cartao_debito"].includes(payment_method_type)) {
    return res.status(400).json({ error: "Escolha uma forma de pagamento." });
  }

  let paymentMethod = null;
  if (payment_method_type !== "pix") {
    if (!payment_method_id) {
      return res.status(400).json({ error: "Selecione o cartão que deseja usar." });
    }
    const { rows } = await pool.query(
      "SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2",
      [payment_method_id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Cartão não encontrado." });
    paymentMethod = rows[0];
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // trava a linha do talhão até o fim da transação, impedindo que duas
    // compras simultâneas vendam a mesma cota (overselling)
    const { rows: plotRows } = await client.query(
      "SELECT * FROM plots WHERE id = $1 FOR UPDATE",
      [plot_id]
    );
    const plot = plotRows[0];
    if (!plot) throw new AppError(404, "Talhão não encontrado.");

    const { rows: farmRows } = await client.query("SELECT * FROM farms WHERE id = $1", [plot.farm_id]);
    const farm = farmRows[0];
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

    await client.query(
      "UPDATE plots SET cotas_disponiveis = cotas_disponiveis - $1 WHERE id = $2",
      [qtd, plot.id]
    );

    const { rows: invRows } = await client.query(
      "INSERT INTO investments (user_id, plot_id, cotas, valor_investido) VALUES ($1, $2, $3, $4) RETURNING *",
      [req.user.id, plot.id, qtd, valorInvestido]
    );
    const investment = invRows[0];

    // Pagamento SIMULADO: sem gateway conectado ainda, toda cobrança é
    // aprovada automaticamente. Quando um gateway real for integrado, essa
    // etapa passa a chamar a API dele antes de confirmar a compra.
    await recordTransaction(client, {
      type: "compra_cota",
      status: "aprovado",
      userId: req.user.id,
      farmId: plot.farm_id,
      plotId: plot.id,
      investmentId: investment.id,
      amount: valorInvestido,
      paymentMethodType: payment_method_type,
      paymentMethodId: paymentMethod ? paymentMethod.id : null,
      description: `Compra de ${qtd} cota(s) em ${plot.nome}`,
    });

    await client.query("COMMIT");

    // notificações (fora da transação — não devem derrubar a compra se falharem)
    try {
      await notifyUsers(pool, [req.user.id], {
        senderRole: "sistema",
        farmId: plot.farm_id,
        plotId: plot.id,
        type: "compra_confirmada",
        title: "Compra confirmada",
        body: `Sua compra de ${qtd} cota(s) em ${plot.nome} foi confirmada. Valor: R$ ${valorInvestido.toFixed(2)}.`,
      });

      if (farm.owner_user_id) {
        await notifyUsers(pool, [farm.owner_user_id], {
          senderRole: "sistema",
          farmId: plot.farm_id,
          plotId: plot.id,
          type: "novo_investimento",
          title: "Novo investimento recebido",
          body: `${req.user.name} comprou ${qtd} cota(s) em ${plot.nome} (R$ ${valorInvestido.toFixed(2)}).`,
        });
      }

      const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      await notifyUsers(pool, admins.map((a) => a.id), {
        senderRole: "sistema",
        farmId: plot.farm_id,
        plotId: plot.id,
        type: "transacao_admin",
        title: "Nova compra de cotas",
        body: `${req.user.name} investiu R$ ${valorInvestido.toFixed(2)} em ${plot.nome} (${farm.name}).`,
      });
    } catch (notifyErr) {
      console.error("[aviso] falha ao enviar notificações de compra:", notifyErr);
    }

    res.status(201).json({ investment });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    throw err;
  } finally {
    client.release();
  }
}));

router.get("/me", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.*, p.nome as plot_nome, p.grao, p.fase_atual, p.progresso, p.safra, p.status as plot_status,
            f.name as farm_name,
            po.valor_bruto, po.comissao_fazenda, po.comissao_app, po.valor_liquido
     FROM investments i
     JOIN plots p ON p.id = i.plot_id
     JOIN farms f ON f.id = p.farm_id
     LEFT JOIN payouts po ON po.investment_id = i.id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC`,
    [req.user.id]
  );
  res.json({ investments: rows });
}));

router.get("/plot/:plotId", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { rows: plotRows } = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.plotId]);
  const plot = plotRows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const { rows: farmRows } = await pool.query("SELECT * FROM farms WHERE id = $1", [plot.farm_id]);
  const farm = farmRows[0];
  const isOwner = req.user.role === "fazenda" && req.user.farm_id === farm.id;
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não administra este talhão." });
  }

  const { rows } = await pool.query(
    `SELECT i.id, i.cotas, i.valor_investido, i.status, i.created_at, u.name as investidor_nome
     FROM investments i JOIN users u ON u.id = i.user_id
     WHERE i.plot_id = $1 ORDER BY i.created_at DESC`,
    [req.params.plotId]
  );
  res.json({ investments: rows });
}));

module.exports = router;
