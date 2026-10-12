// Demonstrativo financeiro do talhão: orçamento previsto, custos lançados pela
// fazenda e o resultado de cada lado (investidores, fazenda, armazém, app).
// A leitura é pública (transparência para quem investe); só a fazenda dona
// do talhão (ou a administração) lança e edita custos.
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { categoriasCusto, unidadeTexto, fasesDe } = require("../culturas");
const { dividirLucro } = require("../profitSplit");
const { despesaPrevista, parteInvestidores } = require("../storageFees");
const { getAppCommissionPct } = require("../settings");
const { centavos } = require("../ledger");

const router = express.Router();

async function loadPlot(id) {
  const { rows } = await pool.query(
    `SELECT p.*, f.name AS farm_name, f.location AS farm_location, f.commission_pct, w.name AS warehouse_name,
            w.tarifa_recepcao, w.tarifa_quinzena, w.carencia_quinzenas, w.quebra_quinzena_pct
     FROM plots p JOIN farms f ON f.id = p.farm_id LEFT JOIN warehouses w ON w.id = p.warehouse_id WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

function podeEditar(plot, user) {
  return user && (user.role === "admin" || (user.role === "fazenda" && user.farm_id === plot.farm_id));
}

// ---------- demonstrativo ----------
router.get("/:id/demonstrativo", asyncHandler(async (req, res) => {
  const plot = await loadPlot(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  const categorias = categoriasCusto(plot);

  const [{ rows: orc }, { rows: custos }, { rows: invs }, { rows: tx }, appPct] = await Promise.all([
    pool.query("SELECT categoria, valor FROM plot_budget WHERE plot_id = $1", [plot.id]),
    pool.query("SELECT id, categoria, descricao, valor, data, created_at FROM plot_costs WHERE plot_id = $1 ORDER BY data, id", [plot.id]),
    pool.query("SELECT cotas, valor_investido, status FROM investments WHERE plot_id = $1 AND status IN ('ativo', 'pago')", [plot.id]),
    pool.query("SELECT type, COALESCE(SUM(amount), 0)::float8 AS total FROM transactions WHERE plot_id = $1 GROUP BY type", [plot.id]),
    getAppCommissionPct(),
  ]);

  const previsto = Object.fromEntries(orc.map((o) => [o.categoria, Number(o.valor)]));
  const realizado = {};
  for (const c of custos) realizado[c.categoria] = (realizado[c.categoria] || 0) + Number(c.valor);
  const porCategoria = categorias.map((c) => ({ ...c, previsto: previsto[c.id] || 0, realizado: realizado[c.id] || 0 }))
    .concat(Object.keys(realizado).filter((k) => !categorias.some((c) => c.id === k)).map((k) => ({ id: k, label: k, previsto: 0, realizado: realizado[k] })));
  const totalPrevisto = porCategoria.reduce((s, c) => s + c.previsto, 0);
  const totalRealizado = porCategoria.reduce((s, c) => s + c.realizado, 0);

  const captado = invs.reduce((s, i) => s + Number(i.valor_investido), 0);
  const vendidas = invs.reduce((s, i) => s + Number(i.cotas), 0);
  const t = Object.fromEntries(tx.map((r) => [r.type, Number(r.total)]));

  // distribuição: real (colheita paga) ou prevista (venda exatamente na meta)
  let distribuicao;
  if (plot.status === "pago") {
    const { rows: po } = await pool.query(
      "SELECT COALESCE(SUM(po.valor_bruto), 0)::float8 AS bruto FROM payouts po JOIN investments i ON i.id = po.investment_id WHERE i.plot_id = $1",
      [plot.id]
    );
    distribuicao = {
      tipo: "realizado",
      precoVenda: plot.preco_venda_estimado * (1 + Number(plot.retorno_final || 0) / 100),
      valorVenda: Number(po[0].bruto),
      investidores: t.pagamento_investidor || 0,
      comissaoFazenda: t.repasse_fazenda || 0,
      performanceFazenda: t.performance_fazenda || 0,
      armazem: t.tarifa_armazem || 0,
      plataforma: t.comissao_plataforma || 0,
    };
  } else {
    const precoMeta = plot.preco_venda_estimado * (1 + plot.previsao_retorno / 100);
    const tabela = plot.arm_tarifa_recepcao != null ? plot : { ...plot, arm_tarifa_recepcao: plot.tarifa_recepcao, arm_tarifa_quinzena: plot.tarifa_quinzena, arm_carencia: plot.carencia_quinzenas, arm_quebra_pct: plot.quebra_quinzena_pct };
    const despUn = plot.warehouse_id ? despesaPrevista(tabela, { unidades: 1, precoVenda: precoMeta }).total : 0;
    const parteInv = plot.warehouse_id ? parteInvestidores(plot) : 0;
    const d = { investidores: 0, comissaoFazenda: 0, performanceFazenda: 0, armazem: 0, plataforma: 0, valorVenda: 0 };
    for (const i of invs) {
      const x = dividirLucro({ cotas: i.cotas, valorInvestido: i.valor_investido, precoReferencia: plot.preco_venda_estimado,
        retornoPrometidoPct: plot.previsao_retorno, precoVenda: precoMeta, despesa: despUn * i.cotas * parteInv,
        comissaoFazendaPct: plot.commission_pct, comissaoAppPct: appPct, performancePct: Number(plot.perf_excedente_pct) || 0 });
      d.valorVenda += x.valorBruto; d.investidores += x.valorLiquido; d.comissaoFazenda += x.comissaoFazenda - x.performanceFazenda;
      d.performanceFazenda += x.performanceFazenda; d.plataforma += x.comissaoApp; d.armazem += despUn * i.cotas;
    }
    distribuicao = { tipo: "previsto", precoVenda: precoMeta, ...d };
  }

  const recebidoFazenda = distribuicao.comissaoFazenda + distribuicao.performanceFazenda;
  const resultadoFazenda = captado - totalRealizado + recebidoFazenda
    - (plot.arm_pagador === "fazenda" ? distribuicao.armazem : plot.arm_pagador === "dividido" ? distribuicao.armazem * (1 - parteInvestidores(plot)) : 0);

  res.json({
    talhao: {
      id: plot.id, nome: plot.nome, grao: plot.grao, variedade: plot.variedade, tipo_producao: plot.tipo_producao, safra: plot.safra,
      area_ha: plot.area_ha, unidade: plot.unidade, unidade_plural: unidadeTexto(plot.unidade, 2), cotas_totais: plot.cotas_totais,
      status: plot.status, fase: fasesDe(plot)[plot.fase_atual], farm_id: plot.farm_id, farm_name: plot.farm_name, farm_location: plot.farm_location,
      warehouse_name: plot.warehouse_name, previsao_retorno: plot.previsao_retorno, retorno_final: plot.retorno_final,
      preco_venda_estimado: plot.preco_venda_estimado, arm_pagador: plot.arm_pagador, arm_investidor_pct: plot.arm_investidor_pct,
    },
    categorias,
    porCategoria,
    custos,
    totais: {
      previsto: totalPrevisto,
      realizado: totalRealizado,
      captado,
      vendidas,
      saldoCaptacao: captado - totalRealizado,
      custoPorHa: plot.area_ha ? totalRealizado / plot.area_ha : 0,
      custoPorUnidade: plot.cotas_totais ? totalRealizado / plot.cotas_totais : 0,
      percentualAplicado: captado ? (totalRealizado / captado) * 100 : 0,
    },
    distribuicao,
    resultadoFazenda,
    podeEditar: false,
  });
}));

// ---------- edição (fazenda dona ou administração) ----------
router.put("/:id/orcamento", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const plot = await loadPlot(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (!podeEditar(plot, req.user)) return res.status(403).json({ error: "Só a fazenda dona do talhão edita o orçamento." });
  const validas = new Set(categoriasCusto(plot).map((c) => c.id));
  const itens = req.body?.itens || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM plot_budget WHERE plot_id = $1", [plot.id]);
    for (const [cat, v] of Object.entries(itens)) {
      const valor = Number(v);
      if (!validas.has(cat) || Number.isNaN(valor) || valor <= 0) continue;
      await client.query("INSERT INTO plot_budget (plot_id, categoria, valor) VALUES ($1, $2, $3)", [plot.id, cat, centavos(valor)]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

function parseCusto(body, plot) {
  const categoria = String(body?.categoria || "");
  if (!categoriasCusto(plot).some((c) => c.id === categoria)) return { error: "Escolha a categoria do custo." };
  const descricao = String(body?.descricao || "").trim().slice(0, 200);
  if (descricao.length < 3) return { error: "Descreva o custo (ex.: \"Sementes Intacta, 380 sacos\")." };
  const valor = Number(body?.valor);
  if (Number.isNaN(valor) || valor <= 0) return { error: "Informe um valor maior que zero." };
  const data = body?.data && /^\d{4}-\d{2}-\d{2}$/.test(body.data) ? body.data : new Date().toISOString().slice(0, 10);
  return { categoria, descricao, valor: centavos(valor), data };
}

router.post("/:id/custos", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const plot = await loadPlot(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (!podeEditar(plot, req.user)) return res.status(403).json({ error: "Só a fazenda dona do talhão lança custos." });
  const c = parseCusto(req.body, plot);
  if (c.error) return res.status(400).json({ error: c.error });
  const { rows } = await pool.query(
    "INSERT INTO plot_costs (plot_id, categoria, descricao, valor, data, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [plot.id, c.categoria, c.descricao, c.valor, c.data, req.user.id]
  );
  res.status(201).json({ custo: rows[0] });
}));

router.patch("/:id/custos/:costId", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const plot = await loadPlot(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (!podeEditar(plot, req.user)) return res.status(403).json({ error: "Só a fazenda dona do talhão edita custos." });
  const c = parseCusto(req.body, plot);
  if (c.error) return res.status(400).json({ error: c.error });
  const { rows } = await pool.query(
    "UPDATE plot_costs SET categoria = $1, descricao = $2, valor = $3, data = $4, updated_at = now() WHERE id = $5 AND plot_id = $6 RETURNING *",
    [c.categoria, c.descricao, c.valor, c.data, req.params.costId, plot.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Custo não encontrado." });
  res.json({ custo: rows[0] });
}));

router.delete("/:id/custos/:costId", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const plot = await loadPlot(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (!podeEditar(plot, req.user)) return res.status(403).json({ error: "Só a fazenda dona do talhão exclui custos." });
  const { rowCount } = await pool.query("DELETE FROM plot_costs WHERE id = $1 AND plot_id = $2", [req.params.costId, plot.id]);
  if (!rowCount) return res.status(404).json({ error: "Custo não encontrado." });
  res.json({ ok: true });
}));

module.exports = router;
