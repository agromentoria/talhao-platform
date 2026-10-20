const { fmtBRL } = require("./format");
const { pool } = require("./db");
const { notifyUsers } = require("./notify");
const { recordTransaction, centavos } = require("./ledger");
const { despesaReal, parteInvestidores, pagadorTexto } = require("./storageFees");
const { dividirLucro } = require("./profitSplit");

// Executa de fato o pagamento da colheita (só deve ser chamado depois que
// um admin aprova a solicitação). Usa o mesmo modelo de preço por unidade
// pago x preço real de venda, para que quem comprou mais cedo continue
// lucrando mais do que quem comprou mais perto da colheita.
async function executeHarvestPayout({ plot, farm, retorno, appCommissionPct }) {
  if (plot.modelo === "piso" || plot.modelo === "custo") return executePisoPayout({ plot, farm, retorno });
  const client = await pool.connect();
  let investidoresPagos = 0;
  let totalComissaoFazenda = 0;
  let totalComissaoApp = 0;
  let totalDespesaArmazem = 0;
  let totalPerformance = 0;
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
    const parteInv = plot.warehouse_id ? parteInvestidores(plot) : 0;

    for (const inv of investments) {
      const precoUnitario = inv.preco_unitario || (inv.valor_investido / inv.cotas);
      const valorBruto = inv.cotas * precoVendaReal;
      const despesa = plot.warehouse_id ? despesaReal(plot, { unidades: inv.cotas, precoVenda: precoVendaReal }) : null;
      if (despesa && !despesaInfo) despesaInfo = despesa;
      const despesaArmazem = despesa ? despesa.total * parteInv : 0;
      totalDespesaArmazem += despesa ? despesa.total : 0;
      const d = dividirLucro({
        cotas: inv.cotas, valorInvestido: inv.valor_investido, precoReferencia: plot.preco_venda_estimado,
        retornoPrometidoPct: plot.previsao_retorno, precoVenda: precoVendaReal, despesa: despesaArmazem,
        comissaoFazendaPct: farm.commission_pct, comissaoAppPct: appCommissionPct, performancePct: Number(plot.perf_excedente_pct) || 0,
      });
      const { comissaoFazenda, comissaoApp, valorLiquido } = d;
      totalPerformance += d.performanceFazenda;

      await client.query(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido, despesa_armazem, perf_fazenda)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [inv.id, centavos(valorBruto), centavos(comissaoFazenda), centavos(comissaoApp), centavos(valorLiquido), centavos(despesaArmazem), centavos(d.performanceFazenda)]
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
        description: `Pagamento da colheita de ${plot.nome} (comprou a ${fmtBRL(precoUnitario)}, vendido a ${fmtBRL(precoVendaReal)} por unidade${despesaArmazem > 0 ? `, armazenagem ${fmtBRL(despesaArmazem)}` : ""}${d.performanceFazenda > 0 ? `, performance da fazenda ${fmtBRL(d.performanceFazenda)} sobre o excedente da meta` : ""})`,
      });

      totalComissaoFazenda += comissaoFazenda;
      totalComissaoApp += comissaoApp;
      investorNotifications.push({ userId: inv.user_id, valorLiquido });
    }
    investidoresPagos = investments.length;

    // comissão até a meta e performance acima da meta ficam em lançamentos
    // separados, para aparecerem distintos no financeiro e nos relatórios
    const comissaoBase = totalComissaoFazenda - totalPerformance;
    if (farm.owner_user_id && comissaoBase > 0.004) {
      await recordTransaction(client, {
        type: "repasse_fazenda",
        status: "aprovado",
        userId: farm.owner_user_id,
        farmId: plot.farm_id,
        plotId: plot.id,
        amount: comissaoBase,
        description: `Comissão da colheita de ${plot.nome} (${farm.commission_pct}% do lucro até a meta de ${plot.previsao_retorno}%)`,
      });
    }
    if (farm.owner_user_id && totalPerformance > 0.004) {
      await recordTransaction(client, {
        type: "performance_fazenda",
        status: "aprovado",
        userId: farm.owner_user_id,
        farmId: plot.farm_id,
        plotId: plot.id,
        amount: totalPerformance,
        description: `Performance acima da meta em ${plot.nome} (${plot.perf_excedente_pct}% do lucro excedente)`,
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
        description: `Armazenagem de ${plot.nome} em ${wh[0]?.name || "armazém"}: ${despesaInfo.quinzenas} quinzena(s), ${despesaInfo.quinzenasCobradas} cobrada(s) — ${pagadorTexto(plot)}`,
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
        body: `Você recebeu ${fmtBRL(totalComissaoFazenda)} pela colheita de ${plot.nome}${totalPerformance > 0 ? `, dos quais ${fmtBRL(totalPerformance)} de performance acima da meta` : ""}.`,
      });
    }

    const { rows: admins } = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'fundo') AND deleted_at IS NULL");
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

  return { investidoresPagos, totalComissaoFazenda, totalComissaoApp, totalDespesaArmazem, totalPerformance };
}

// ---------- produto com piso (v2) ----------
async function executePisoPayout({ plot, farm, retorno }) {
  const { calcularPagamentoPiso: calcPiso, calcularPagamentoCusto, REGRAS } = require("./piso");
  const calcularPagamentoPiso = plot.modelo === "custo" ? calcularPagamentoCusto : calcPiso;
  const client = await pool.connect();
  let r;
  try {
    await client.query("BEGIN");
    const { rows: investments } = await client.query("SELECT * FROM investments WHERE plot_id = $1 AND status = 'ativo' FOR UPDATE", [plot.id]);
    const precoVenda = plot.preco_venda_estimado * (1 + retorno / 100);
    const unidades = investments.reduce((s, i) => s + Number(i.cotas), 0);
    const desp = plot.warehouse_id ? despesaReal(plot, { unidades, precoVenda }) : null;
    r = calcularPagamentoPiso(plot, investments, precoVenda, { despesaArmazenagem: desp ? desp.total : 0 });
    const tx = (o) => recordTransaction(client, { status: "aprovado", farmId: plot.farm_id, plotId: plot.id, ...o });

    for (const l of r.linhas) {
      await client.query(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido, despesa_armazem, perf_fazenda, valor_piso, aporte_fazenda)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)`,
        [l.inv.id, centavos(l.valorVenda), centavos(l.fazendaExcedente), centavos(l.plataforma), centavos(l.investidor), centavos(l.valorPiso), centavos(l.aporteFazenda)]
      );
      await client.query("UPDATE investments SET status = 'pago' WHERE id = $1", [l.inv.id]);
      await tx({ type: "pagamento_investidor", userId: l.inv.user_id, investmentId: l.inv.id, amount: l.investidor,
        description: `Pagamento da colheita de ${plot.nome}: mínimo garantido de ${fmtBRL(l.valorPiso)} (piso de ${plot.piso_pct}%)${l.excedente > 0 ? ` + ${REGRAS.excedente_investidor_pct}% da alta (${fmtBRL(l.investidor - l.valorPiso)})` : ""}` });
    }
    if (farm.owner_user_id && r.fazendaLiquido > 0.004) {
      await tx({ type: "repasse_fazenda", userId: farm.owner_user_id, amount: r.fazendaLiquido,
        description: `${plot.nome}: ${REGRAS.excedente_fazenda_pct}% da alta (${fmtBRL(r.fazendaExcedente)}) menos taxas e armazenagem` });
    }
    if (r.fazendaLiquido < -0.004) {
      await tx({ type: "aporte_fazenda", userId: farm.owner_user_id, amount: -r.fazendaLiquido,
        description: `${plot.nome}: aporte da fazenda para garantir o piso${r.aportePiso > 0 ? ` (${fmtBRL(r.aportePiso)} de complemento)` : ""}, taxas e armazenagem` });
    }
    if (r.plataforma > 0.004) {
      await tx({ type: "comissao_plataforma", userId: null, amount: r.plataforma,
        description: `${plot.nome}: estruturação de ${REGRAS.estruturacao_pct}% (${fmtBRL(r.estruturacao)})${r.plataformaExcedente > 0 ? ` + ${REGRAS.excedente_plataforma_pct}% da alta (${fmtBRL(r.plataformaExcedente)})` : ""}` });
    }
    if (plot.warehouse_id && r.armazem > 0.004) {
      const { rows: wh } = await client.query("SELECT owner_user_id, name FROM warehouses WHERE id = $1", [plot.warehouse_id]);
      await tx({ type: "tarifa_armazem", userId: wh[0]?.owner_user_id || null, amount: r.armazem,
        description: `${plot.nome} em ${wh[0]?.name || "armazém"}: custódia de ${REGRAS.custodia_armazem_pct}% (${fmtBRL(r.custodia)}) + armazenagem (${fmtBRL(r.armazenagem)}), pagas pela fazenda` });
    }
    if (r.fundo > 0.004) {
      await tx({ type: "gestao_fundo", userId: null, amount: r.fundo, description: `${plot.nome}: gestão do fundo de ${REGRAS.gestao_fundo_pct}% do captado` });
    }
    await client.query("UPDATE plots SET status = 'pago', retorno_final = $1, fase_atual = 5, progresso = 100 WHERE id = $2", [retorno, plot.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  try {
    for (const l of r.linhas) {
      await notifyUsers(pool, [l.inv.user_id], { senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "pagamento_recebido",
        title: "Você recebeu um pagamento", body: `A colheita de ${plot.nome} foi paga. Você recebeu ${fmtBRL(l.investidor)}${l.excedente > 0 ? ", com parte da alta do preço" : " (mínimo garantido)"}.` });
    }
    if (farm.owner_user_id) {
      await notifyUsers(pool, [farm.owner_user_id], { senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "repasse_recebido",
        title: r.fazendaLiquido >= 0 ? "Resultado da colheita" : "Aporte para o piso",
        body: r.fazendaLiquido >= 0 ? `Você ficou com ${fmtBRL(r.fazendaLiquido)} da alta de ${plot.nome}, já descontadas taxas e armazenagem.` : `Para garantir o piso dos investidores de ${plot.nome}, o aporte da fazenda foi de ${fmtBRL(-r.fazendaLiquido)}.` });
    }
  } catch (e) { console.error("[aviso] pagamento com piso:", e.message); }
  return { investidoresPagos: r.linhas.length, totalComissaoFazenda: Math.max(0, r.fazendaLiquido), totalComissaoApp: r.plataforma, totalDespesaArmazem: r.armazem, totalPerformance: 0, piso: r };
}

module.exports = { executeHarvestPayout };
