const { fmtBRL } = require("./format");
const { pool } = require("./db");
const { notifyUsers } = require("./notify");
const { recordTransaction } = require("./ledger");
const { despesaReal } = require("./storageFees");

// Executa de fato o pagamento da colheita (só deve ser chamado depois que
// um admin aprova a solicitação). Usa o mesmo modelo de preço por unidade
// pago x preço real de venda, para que quem comprou mais cedo continue
// lucrando mais do que quem comprou mais perto da colheita.
async function executeHarvestPayout({ plot, farm, retorno, appCommissionPct }) {
  const client = await pool.connect();
  let investidoresPagos = 0;
  let totalComissaoFazenda = 0;
  let totalComissaoApp = 0;
  let totalDespesaArmazem = 0;
  let despesaInfo = null;
  const investorNotifications = [];

  try {
    await client.query("BEGIN");

    const { rows: investments } = await client.query(
      "SELECT * FROM investments WHERE plot_id = $1 AND status = 'ativo' FOR UPDATE",
      [plot.id]
    );

    const precoVendaReal = plot.preco_venda_estimado * (1 + retorno / 100);
    // despesa do armazém sobre a parte dos investidores, da entrada até hoje
    const investidoresPagam = plot.warehouse_id && plot.arm_pagador !== "fazenda";

    for (const inv of investments) {
      const precoUnitario = inv.preco_unitario || (inv.valor_investido / inv.cotas);
      const valorBruto = inv.cotas * precoVendaReal;
      const despesa = plot.warehouse_id ? despesaReal(plot, { unidades: inv.cotas, precoVenda: precoVendaReal }) : null;
      if (despesa && !despesaInfo) despesaInfo = despesa;
      const despesaArmazem = investidoresPagam && despesa ? despesa.total : 0;
      totalDespesaArmazem += despesa ? despesa.total : 0;
      const lucroBruto = valorBruto - despesaArmazem - inv.valor_investido;
      const comissaoFazenda = Math.max(0, lucroBruto) * (farm.commission_pct / 100);
      const comissaoApp = Math.max(0, lucroBruto) * (appCommissionPct / 100);
      const valorLiquido = valorBruto - despesaArmazem - comissaoFazenda - comissaoApp;

      await client.query(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido, despesa_armazem)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [inv.id, valorBruto, comissaoFazenda, comissaoApp, valorLiquido, despesaArmazem]
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
        description: `Pagamento da colheita de ${plot.nome} (comprou a ${fmtBRL(precoUnitario)}, vendido a ${fmtBRL(precoVendaReal)} por unidade${despesaArmazem > 0 ? `, armazenagem ${fmtBRL(despesaArmazem)}` : ""})`,
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

    // tarifa do armazém garantidor (recepção + quinzenas + quebra técnica)
    if (plot.warehouse_id && totalDespesaArmazem > 0) {
      const { rows: wh } = await client.query("SELECT owner_user_id, name FROM warehouses WHERE id = $1", [plot.warehouse_id]);
      await recordTransaction(client, {
        type: "tarifa_armazem",
        status: "aprovado",
        userId: wh[0]?.owner_user_id || null,
        farmId: plot.farm_id,
        plotId: plot.id,
        amount: totalDespesaArmazem,
        description: `Armazenagem de ${plot.nome} em ${wh[0]?.name || "armazém"}: ${despesaInfo.quinzenas} quinzena(s), ${despesaInfo.quinzenasCobradas} cobrada(s) — paga ${investidoresPagam ? "pelos investidores (descontada do resultado)" : "pela fazenda"}`,
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
        body: `A colheita de ${plot.nome} foi paga. Você recebeu ${fmtBRL(n.valorLiquido)}.`,
      });
    }

    if (farm.owner_user_id && totalComissaoFazenda > 0) {
      await notifyUsers(pool, [farm.owner_user_id], {
        senderRole: "sistema",
        farmId: plot.farm_id,
        plotId: plot.id,
        type: "repasse_recebido",
        title: "Repasse de comissão recebido",
        body: `Você recebeu ${fmtBRL(totalComissaoFazenda)} de comissão pela colheita de ${plot.nome}.`,
      });
    }

    const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    await notifyUsers(pool, admins.map((a) => a.id), {
      senderRole: "sistema",
      farmId: plot.farm_id,
      plotId: plot.id,
      type: "transacao_admin",
      title: "Colheita paga",
      body: `${plot.nome} (${farm.name}) foi paga: ${investidoresPagos} investidor(es), comissão da plataforma de ${fmtBRL(totalComissaoApp)}.`,
    });
  } catch (notifyErr) {
    console.error("[aviso] falha ao enviar notificações de pagamento:", notifyErr);
  }

  return { investidoresPagos, totalComissaoFazenda, totalComissaoApp, totalDespesaArmazem };
}

module.exports = { executeHarvestPayout };
