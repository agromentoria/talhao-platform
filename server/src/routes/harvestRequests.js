const express = require("express");
const { despesaReal, parteInvestidores, pagadorTexto } = require("../storageFees");
const { dividirLucro } = require("../profitSplit");
const { getAppCommissionPct } = require("../settings");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers } = require("../notify");
const { executeHarvestPayout } = require("../harvestPayout");
const { harvestBlockReason } = require("../custody");

const router = express.Router();

router.use(requireAuth, requireRole("admin", "fundo"));

router.get("/", asyncHandler(async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT hr.*, p.nome as plot_nome, p.grao, p.variedade, p.tipo_producao, p.unidade, p.previsao_retorno, p.fase_atual,
           p.cotas_totais, p.cotas_disponiveis, p.custodia_status,
           f.name as farm_name, f.location as farm_location, f.commission_pct,
           u.name as solicitado_por,
           w.name as warehouse_name,
           va.resultado as armazenagem_resultado, va.quantidade as armazenagem_quantidade, va.observacao as armazenagem_observacao
    FROM harvest_requests hr
    JOIN plots p ON p.id = hr.plot_id
    JOIN farms f ON f.id = hr.farm_id
    LEFT JOIN users u ON u.id = hr.requested_by
    LEFT JOIN warehouses w ON w.id = p.warehouse_id
    LEFT JOIN plot_validations va ON va.plot_id = p.id AND va.etapa = 'armazenagem'
  `;
  const params = [];
  if (status) {
    params.push(status);
    sql += ` WHERE hr.status = $${params.length}`;
  }
  sql += " ORDER BY hr.created_at DESC";
  const { rows } = await pool.query(sql, params);
  // despesa de armazenagem até hoje, para a administração conferir antes de aprovar
  const { rows: plots } = rows.length
    ? await pool.query("SELECT * FROM plots WHERE id = ANY($1)", [rows.map((r) => r.plot_id)])
    : { rows: [] };
  const byId = Object.fromEntries(plots.map((p) => [p.id, p]));
  const appPct = await getAppCommissionPct();
  const enriched = [];
  for (const r of rows) {
    const p = byId[r.plot_id];
    if (!p) { enriched.push(r); continue; }
    // custo + lucro: o preço vem da referência pública informada pelo fundo; antes disso, prévia estimada
    const custoSemIndice = p.modelo === "custo" && r.preco_liquidacao == null;
    const precoVenda = p.modelo === "custo"
      ? Number(r.preco_liquidacao ?? (Number(p.preco_venda_estimado) + Number(p.base_regional || 0)))
      : p.preco_venda_estimado * (1 + Number(r.retorno_final ?? p.previsao_retorno) / 100);
    const out = { ...r, preco_estimado: custoSemIndice, indice_referencia: p.indice_referencia, base_regional: Number(p.base_regional || 0),
      janela_dias: p.janela_dias, janela_pregoes: p.janela_pregoes, colheita_prevista: p.colheita_prevista,
      seguro_apolice: p.seguro_apolice, seguro_seguradora: p.seguro_seguradora, seguro_cobertura_pct: p.seguro_cobertura_pct,
      preco_venda_declarado: precoVenda, preco_meta: p.preco_venda_estimado * (1 + p.previsao_retorno / 100), perf_excedente_pct: p.perf_excedente_pct };
    const parteInv = p.warehouse_id ? parteInvestidores(p) : 0;
    if (p.warehouse_id) {
      const vendidas = p.cotas_totais - p.cotas_disponiveis;
      const d = despesaReal(p, { unidades: vendidas, precoVenda });
      out.armazenagem = { ...d, pagador: p.arm_pagador, parte_investidores: parteInv, pagador_texto: pagadorTexto(p), entrada_em: p.arm_entrada_em };
    }
    // prévia exata do pagamento (mesma conta do harvestPayout), para conferir antes de aprovar
    const { rows: invs } = await pool.query("SELECT cotas, valor_investido FROM investments WHERE plot_id = $1 AND status = 'ativo'", [p.id]);
    if (p.modelo === "piso" || p.modelo === "custo") {
      const { calcularPagamentoPiso: cp, calcularPagamentoCusto } = require("../piso");
      const calcularPagamentoPiso = p.modelo === "custo" ? calcularPagamentoCusto : cp;
      const unidades = invs.reduce((s, i) => s + Number(i.cotas), 0);
      const desp = p.warehouse_id ? despesaReal(p, { unidades, precoVenda }).total : 0;
      const x = calcularPagamentoPiso(p, invs, precoVenda, { despesaArmazenagem: desp });
      delete x.linhas;
      out.modelo = p.modelo; out.piso_pct = p.piso_pct; out.custo_saca = p.custo_saca;
      out.preco_piso = (p.modelo === "custo" ? Number(p.custo_saca) : p.preco_venda_estimado) * (1 + (p.piso_pct || 0) / 100);
      out.previa = { ...x, fazenda: x.fazendaLiquido, performance: 0, app: x.plataforma };
      enriched.push(out);
      continue;
    }
    const { rows: fr } = await pool.query("SELECT commission_pct FROM farms WHERE id = $1", [p.farm_id]);
    const prev = { investidores: 0, fazenda: 0, performance: 0, app: 0, armazem: 0 };
    for (const i of invs) {
      const desp = p.warehouse_id ? despesaReal(p, { unidades: i.cotas, precoVenda }).total : 0;
      const x = dividirLucro({ cotas: i.cotas, valorInvestido: i.valor_investido, precoReferencia: p.preco_venda_estimado,
        retornoPrometidoPct: p.previsao_retorno, precoVenda, despesa: desp * parteInv, comissaoFazendaPct: fr[0]?.commission_pct || 0,
        comissaoAppPct: appPct, performancePct: Number(p.perf_excedente_pct) || 0 });
      prev.investidores += x.valorLiquido; prev.fazenda += x.comissaoFazenda; prev.performance += x.performanceFazenda;
      prev.app += x.comissaoApp; prev.armazem += desp;
    }
    out.previa = prev;
    enriched.push(out);
  }
  res.json({ requests: enriched });
}));

// o fundo informa a média do índice de referência na janela do contrato;
// o app soma a base regional e calcula o preço de liquidação
router.patch("/:id/indice", asyncHandler(async (req, res) => {
  const media = Number(String(req.body?.preco_indice ?? "").replace(",", "."));
  if (!(media > 0)) return res.status(400).json({ error: "Informe a média do índice na janela (R$ por unidade)." });
  const fonte = req.body?.fonte ? String(req.body.fonte).slice(0, 300) : null;
  const { rows } = await pool.query(
    "SELECT hr.*, p.preco_venda_estimado, p.base_regional, p.modelo, p.indice_referencia FROM harvest_requests hr JOIN plots p ON p.id = hr.plot_id WHERE hr.id = $1", [req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (r.status !== "pendente") return res.status(409).json({ error: "Esta solicitação já foi revisada." });
  const liquidacao = Math.round((media + Number(r.base_regional || 0)) * 100) / 100;
  const retorno = (liquidacao / Number(r.preco_venda_estimado) - 1) * 100;
  await pool.query("UPDATE harvest_requests SET preco_indice = $1, preco_liquidacao = $2, fonte_indice = $3, retorno_final = $4 WHERE id = $5",
    [media, liquidacao, fonte || r.indice_referencia, retorno, r.id]);
  res.json({ preco_indice: media, preco_liquidacao: liquidacao, retorno_final: retorno });
}));

router.post("/:id/approve", asyncHandler(async (req, res) => {
  const { rows: reqRows } = await pool.query("SELECT * FROM harvest_requests WHERE id = $1", [req.params.id]);
  const request = reqRows[0];
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.status !== "pendente") {
    return res.status(409).json({ error: "Esta solicitação já foi revisada." });
  }

  const { rows: plotRows } = await pool.query("SELECT * FROM plots WHERE id = $1", [request.plot_id]);
  const plot = plotRows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  if (plot.modelo === "custo" && request.preco_liquidacao == null) {
    return res.status(409).json({ error: "Informe antes a média do índice de referência na janela do contrato: o pagamento usa o preço público, não o declarado pela fazenda." });
  }
  // com armazém garantidor, o pagamento só sai depois da armazenagem confirmada
  const bloqueio = await harvestBlockReason(pool, plot);
  if (bloqueio) return res.status(409).json({ error: bloqueio });

  const { rows: farmRows } = await pool.query("SELECT * FROM farms WHERE id = $1", [request.farm_id]);
  const farm = farmRows[0];

  const appCommissionPct = await getAppCommissionPct();
  const result = await executeHarvestPayout({ plot, farm, retorno: request.retorno_final, appCommissionPct });

  await pool.query(
    "UPDATE harvest_requests SET status = 'aprovado', reviewed_by = $1, reviewed_at = now() WHERE id = $2",
    [req.user.id, request.id]
  );

  res.json({ ok: true, ...result });
}));

router.post("/:id/reject", asyncHandler(async (req, res) => {
  const { motivo } = req.body || {};
  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ error: "Explique o motivo da rejeição para a fazenda." });
  }

  const { rows: reqRows } = await pool.query("SELECT * FROM harvest_requests WHERE id = $1", [req.params.id]);
  const request = reqRows[0];
  if (!request) return res.status(404).json({ error: "Solicitação não encontrada." });
  if (request.status !== "pendente") {
    return res.status(409).json({ error: "Esta solicitação já foi revisada." });
  }

  await pool.query(
    "UPDATE harvest_requests SET status = 'rejeitado', motivo_rejeicao = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3",
    [motivo.trim(), req.user.id, request.id]
  );
  await pool.query("UPDATE plots SET status = 'em_andamento' WHERE id = $1", [request.plot_id]);

  const { rows: plotRows } = await pool.query("SELECT nome FROM plots WHERE id = $1", [request.plot_id]);

  if (request.requested_by) {
    await notifyUsers(pool, [request.requested_by], {
      senderRole: "admin",
      farmId: request.farm_id,
      plotId: request.plot_id,
      type: "solicitacao_rejeitada",
      title: "Solicitação de colheita rejeitada",
      body: `Sua solicitação de finalização de ${plotRows[0]?.nome || "talhão"} foi rejeitada: ${motivo.trim()}`,
    });
  }

  res.json({ ok: true });
}));

module.exports = router;
