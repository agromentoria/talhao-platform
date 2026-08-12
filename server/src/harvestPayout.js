const { pool } = require("./db");
const { notifyUsers } = require("./notify");
const { recordTransaction } = require("./ledger");

// Executa de fato o pagamento da colheita (só deve ser chamado depois que
// um admin aprova a solicitação). Usa o mesmo modelo de preço por unidade
// pago x preço real de venda, para que quem comprou mais cedo continue
// lucrando mais do que quem comprou mais perto da colheita.
async function executeHarvestPayout({ plot, farm, retorno, appCommissionPct }) {
  const client = await pool.connect();
  let investidoresPagos = 0;
  let totalComissaoFazenda = 0;
  let totalComissaoApp = 0;
  const investorNotifications = [];

  try {
    await client.query("BEGIN");

    const { rows: investments } = await client.query(
      "SELECT * FROM investments WHERE plot_id = $1 AND status = 'ativo' FOR UPDATE",
      [plot.id]
    );

    const precoVendaReal = plot.preco_venda_estimado * (1 + retorno / 100);

    for (const inv of investments) {
      const precoUnitario = inv.preco_unitario || (inv.valor_investido / inv.cotas);
      const valorBruto = inv.cotas * precoVendaReal;
      const lucroBruto = valorBruto - inv.valor_investido;
      const comissaoFazenda = Math.max(0, lucroBruto) * (farm.commission_pct / 100);
      const comissaoApp = Math.max(0, lucroBruto) * (appCommissionPct / 100);
      const valorLiquido = valorBruto - comissaoFazenda - comissaoApp;

      await client.query(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido)
         VALUES ($1, $2, $3, $4, $5)`,
        [inv.id, valorBruto, comissaoFazenda, comissaoApp, valorLiquido]
      );
      await client.query("UPDATE investments SET status = 'pago' WHERE id = $1", [inv.id]);

      await recordTransaction(client, {
        type: "pagamento_investidor",
        status: "aprovado",
        userId: inv.user_id,
        farmId: plot.farm_id,
        plotId: plot.id,
        investmentId: inv.id,
        amount: valorLiquido,
        description: `Pagamento da colheita de ${plot.nome} (comprou a R$ ${precoUnitario.toFixed(2)}, vendido a R$ ${precoVendaReal.toFixed(2)} por unidade)`,
      });

      totalComissaoFazenda += comissaoFazenda;
      totalComissaoApp += comissaoApp;
      investorNotifications.push({ userId: inv.user_id, valorLiquido });
    }
    investidoresPagos = investments.length;

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

  return { investidoresPagos, totalComissaoFazenda, totalComissaoApp };
}

module.exports = { executeHarvestPayout };
