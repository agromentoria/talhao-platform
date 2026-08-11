const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getFarmInvestorIds, getPlotInvestorIds } = require("../notify");
const { recordTransaction } = require("../ledger");

const router = express.Router();

const FASES = [
  "Preparo do solo",
  "Plantio",
  "Germinação",
  "Manejo e combate a pragas",
  "Ponto de colheita",
  "Colheita",
];
const APP_COMMISSION_PCT = Number(process.env.APP_COMMISSION_PCT || 5);

async function getFarmOwned(farmId, user) {
  const { rows } = await pool.query("SELECT * FROM farms WHERE id = $1", [farmId]);
  const farm = rows[0];
  if (!farm) return { error: "Fazenda não encontrada." };
  const isOwner = user.role === "fazenda" && user.farm_id === farm.id;
  if (!isOwner && user.role !== "admin") return { error: "Você não administra esta fazenda." };
  return { farm };
}

router.get("/", asyncHandler(async (req, res) => {
  const { grao } = req.query;
  let sql = `
    SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct
    FROM plots p
    JOIN farms f ON f.id = p.farm_id
    WHERE f.status = 'aprovada'
  `;
  const params = [];
  if (grao) {
    params.push(grao);
    sql += ` AND p.grao = $${params.length}`;
  }
  sql += " ORDER BY p.created_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json({ plots: rows, app_commission_pct: APP_COMMISSION_PCT });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct, f.status as farm_status
     FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1`,
    [req.params.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const historico = await pool.query(
    "SELECT * FROM progress_updates WHERE plot_id = $1 ORDER BY created_at",
    [req.params.id]
  );

  res.json({ plot, historico: historico.rows, app_commission_pct: APP_COMMISSION_PCT });
}));

router.post("/", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, previsao_retorno } = req.body || {};

  if (!farm_id || !nome || !grao || !area_ha || !safra || !cota_valor || !cotas_totais || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do talhão." });
  }

  const owned = await getFarmOwned(farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (owned.farm.status !== "aprovada") {
    return res.status(403).json({ error: "Sua fazenda ainda não foi aprovada pela administração do Talhão." });
  }

  const cotas = Number(cotas_totais);
  const valor = Number(cota_valor);
  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);

  if ([cotas, valor, area, retorno].some((n) => Number.isNaN(n)) || cotas <= 0 || valor <= 0 || area <= 0) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  const { rows } = await pool.query(
    `INSERT INTO plots (farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8) RETURNING *`,
    [farm_id, nome, grao, area, safra, valor, cotas, retorno]
  );
  const plot = rows[0];

  // avisa quem já investiu nessa fazenda sobre a novidade
  const investorIds = await getFarmInvestorIds(pool, farm_id);
  await notifyUsers(pool, investorIds, {
    senderRole: "sistema",
    farmId: farm_id,
    plotId: plot.id,
    type: "novo_talhao",
    title: `Novo talhão em ${owned.farm.name}`,
    body: `A fazenda ${owned.farm.name} publicou um novo talhão de ${grao} (${plot.nome}) disponível para investimento.`,
  });

  res.status(201).json({ plot });
}));

router.patch("/:id/progress", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { fase_atual, progresso, nota } = req.body || {};
  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const fase = Number(fase_atual);
  const prog = Number(progresso);
  if (Number.isNaN(fase) || fase < 0 || fase >= FASES.length) {
    return res.status(400).json({ error: "Fase inválida." });
  }
  if (Number.isNaN(prog) || prog < 0 || prog > 100) {
    return res.status(400).json({ error: "Progresso deve ser um número entre 0 e 100." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const novoStatus = plot.status === "captacao" ? "em_andamento" : plot.status;
    await client.query(
      "UPDATE plots SET fase_atual = $1, progresso = $2, status = $3 WHERE id = $4",
      [fase, prog, novoStatus, plot.id]
    );
    await client.query(
      "INSERT INTO progress_updates (plot_id, fase_atual, progresso, nota) VALUES ($1, $2, $3, $4)",
      [plot.id, fase, prog, nota || null]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await pool.query("SELECT * FROM plots WHERE id = $1", [plot.id]);

  const investorIds = await getPlotInvestorIds(pool, plot.id);
  await notifyUsers(pool, investorIds, {
    senderRole: "sistema",
    farmId: plot.farm_id,
    plotId: plot.id,
    type: "atualizacao_safra",
    title: `Atualização em ${plot.nome}`,
    body: nota
      ? `${FASES[fase]} · ${prog}% da safra. ${nota}`
      : `O talhão avançou para a fase "${FASES[fase]}" (${prog}% da safra).`,
  });

  res.json({ plot: rows[0] });
}));

router.post("/:id/finalize", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { retorno_final } = req.body || {};
  const retorno = Number(retorno_final);
  if (Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Informe o retorno final da safra (%)." });
  }

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (plot.status === "pago") {
    return res.status(409).json({ error: "Este talhão já foi pago aos investidores." });
  }

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  const farm = owned.farm;

  const client = await pool.connect();
  let investidoresPagos = 0;
  let totalComissaoFazenda = 0;
  let totalComissaoApp = 0;
  const investorNotifications = []; // { userId, valorLiquido }

  try {
    await client.query("BEGIN");

    const { rows: investments } = await client.query(
      "SELECT * FROM investments WHERE plot_id = $1 AND status = 'ativo' FOR UPDATE",
      [plot.id]
    );

    for (const inv of investments) {
      const valorBruto = inv.valor_investido * (1 + retorno / 100);
      const lucroBruto = valorBruto - inv.valor_investido;
      const comissaoFazenda = Math.max(0, lucroBruto) * (farm.commission_pct / 100);
      const comissaoApp = Math.max(0, lucroBruto) * (APP_COMMISSION_PCT / 100);
      const valorLiquido = valorBruto - comissaoFazenda - comissaoApp;

      await client.query(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido)
         VALUES ($1, $2, $3, $4, $5)`,
        [inv.id, valorBruto, comissaoFazenda, comissaoApp, valorLiquido]
      );
      await client.query("UPDATE investments SET status = 'pago' WHERE id = $1", [inv.id]);

      // pagamento SIMULADO ao investidor — sem gateway conectado ainda,
      // o valor é registrado no livro-razão como aprovado automaticamente
      await recordTransaction(client, {
        type: "pagamento_investidor",
        status: "aprovado",
        userId: inv.user_id,
        farmId: plot.farm_id,
        plotId: plot.id,
        investmentId: inv.id,
        amount: valorLiquido,
        description: `Pagamento da colheita de ${plot.nome} (retorno de ${retorno}%)`,
      });

      totalComissaoFazenda += comissaoFazenda;
      totalComissaoApp += comissaoApp;
      investorNotifications.push({ userId: inv.user_id, valorLiquido });
    }
    investidoresPagos = investments.length;

    // repasse da comissão para a fazenda
    if (farm.owner_user_id && totalComissaoFazenda > 0) {
      await recordTransaction(client, {
        type: "repasse_fazenda",
        status: "aprovado",
        userId: farm.owner_user_id,
        farmId: plot.farm_id,
        plotId: plot.id,
        amount: totalComissaoFazenda,
        description: `Comissão da colheita de ${plot.nome} (${farm.commission_pct}%)`,
      });
    }

    // comissão da plataforma (registrada sem um usuário específico — receita da Meu Talhão)
    if (totalComissaoApp > 0) {
      await recordTransaction(client, {
        type: "comissao_plataforma",
        status: "aprovado",
        userId: null,
        farmId: plot.farm_id,
        plotId: plot.id,
        amount: totalComissaoApp,
        description: `Comissão da plataforma sobre a colheita de ${plot.nome}`,
      });
    }

    await client.query(
      "UPDATE plots SET status = 'pago', retorno_final = $1, fase_atual = 5, progresso = 100 WHERE id = $2",
      [retorno, plot.id]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // notificações (fora da transação)
  try {
    for (const n of investorNotifications) {
      await notifyUsers(pool, [n.userId], {
        senderRole: "sistema",
        farmId: plot.farm_id,
        plotId: plot.id,
        type: "pagamento_recebido",
        title: "Você recebeu um pagamento",
        body: `A colheita de ${plot.nome} foi paga. Você recebeu R$ ${n.valorLiquido.toFixed(2)}.`,
      });
    }

    if (farm.owner_user_id && totalComissaoFazenda > 0) {
      await notifyUsers(pool, [farm.owner_user_id], {
        senderRole: "sistema",
        farmId: plot.farm_id,
        plotId: plot.id,
        type: "repasse_recebido",
        title: "Repasse de comissão recebido",
        body: `Você recebeu R$ ${totalComissaoFazenda.toFixed(2)} de comissão pela colheita de ${plot.nome}.`,
      });
    }

    const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    await notifyUsers(pool, admins.map((a) => a.id), {
      senderRole: "sistema",
      farmId: plot.farm_id,
      plotId: plot.id,
      type: "transacao_admin",
      title: "Colheita paga",
      body: `${plot.nome} (${farm.name}) foi paga: ${investidoresPagos} investidor(es), comissão da plataforma de R$ ${totalComissaoApp.toFixed(2)}.`,
    });
  } catch (notifyErr) {
    console.error("[aviso] falha ao enviar notificações de pagamento:", notifyErr);
  }

  const { rows } = await pool.query("SELECT * FROM plots WHERE id = $1", [plot.id]);
  res.json({ ok: true, investidoresPagos, plot: rows[0] });
}));

module.exports = router;
