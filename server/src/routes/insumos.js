// Compra de insumos pelo fundo (v4.1): plano de compras do talhão, anexos,
// aprovação, pedidos aos fornecedores, recebimento pela fazenda e pagamento.
// Tudo fica desligado até a administração ligar "mp_insumos_ativo".
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { recordTransaction } = require("../ledger");
const { notifyUsers } = require("../notify");

const router = express.Router();
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const r2 = (v) => Math.round(v * 100) / 100;

async function config() {
  const { rows } = await pool.query("SELECT mp_cadastro_aberto, mp_insumos_ativo FROM platform_settings WHERE id = 1");
  return { cadastro_aberto: rows[0]?.mp_cadastro_aberto !== false, insumos_ativo: rows[0]?.mp_insumos_ativo === true };
}
const exigeAtivo = asyncHandler(async (req, res, next) => {
  if (!(await config()).insumos_ativo) return res.status(403).json({ error: "A compra de insumos pelo fundo ainda não está ativa." });
  next();
});
async function plotAcessivel(plotId, user) {
  const { rows } = await pool.query(
    `SELECT p.*, f.owner_user_id, f.name AS fazenda, f.location AS fazenda_local FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1`, [plotId]);
  const p = rows[0];
  if (!p) return { erro: [404, "Talhão não encontrado."] };
  if (!["admin", "fundo"].includes(user.role) && p.owner_user_id !== user.id) return { erro: [403, "Sem acesso a este talhão."] };
  p.uf = String(p.fazenda_local || "").split(",").pop().trim().toUpperCase();
  return { p };
}
async function avisarFundo(title, body, plotId, farmId) {
  const { rows } = await pool.query("SELECT id FROM users WHERE role IN ('admin','fundo') AND deleted_at IS NULL");
  await notifyUsers(pool, rows.map((r) => r.id), { senderRole: "sistema", plotId, farmId, type: "insumos", title, body }).catch(() => {});
}

// ---------------- chaves ----------------
router.get("/marketplace/config", asyncHandler(async (req, res) => res.json(await config())));
router.put("/admin/marketplace/config", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  await pool.query(
    "UPDATE platform_settings SET mp_cadastro_aberto = COALESCE($1, mp_cadastro_aberto), mp_insumos_ativo = COALESCE($2, mp_insumos_ativo) WHERE id = 1",
    [typeof b.cadastro_aberto === "boolean" ? b.cadastro_aberto : null, typeof b.insumos_ativo === "boolean" ? b.insumos_ativo : null]);
  res.json(await config());
}));

// ---------------- plano de compras (fazenda) ----------------
async function ofertasValidas(uf) {
  const { rows } = await pool.query(
    `SELECT o.*, s.razao_social AS fornecedor, s.comissao_pct FROM supplier_offers o JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.ativo AND s.status = 'aprovado' AND (o.validade_ate IS NULL OR o.validade_ate >= CURRENT_DATE) AND $1 = ANY(o.regioes)
      ORDER BY o.preco`, [uf]);
  return rows;
}
async function montarPlano(p) {
  const { rows: salvos } = await pool.query(
    `SELECT pi.*, c.nome, c.categoria, c.unidade_dose, c.exige_receita, o.supplier_id, s.razao_social AS fornecedor
       FROM plot_plan_items pi JOIN catalog_items c ON c.id = pi.catalog_item_id
       LEFT JOIN supplier_offers o ON o.id = pi.offer_id LEFT JOIN suppliers s ON s.id = o.supplier_id
      WHERE pi.plot_id = $1 ORDER BY array_position(ARRAY['corretivo','fertilizante','nutritivo','semente','defensivo','combustivel','servico']::text[], c.categoria), c.nome`, [p.id]);
  const { rows: refs } = await pool.query(
    `SELECT d.*, c.nome, c.categoria, c.unidade_dose, c.exige_receita FROM reference_doses d JOIN catalog_items c ON c.id = d.catalog_item_id
      WHERE d.cultura = $1 AND c.ativo AND d.uf IN ('BR', $2) ORDER BY array_position(ARRAY['corretivo','fertilizante','nutritivo','semente','defensivo','combustivel','servico']::text[], c.categoria), c.nome`, [p.grao, p.uf]);
  const ofertas = await ofertasValidas(p.uf);
  const porItem = (id) => ofertas.filter((o) => o.catalog_item_id === id);
  let itens = salvos, sugerido = false;
  if (!salvos.length) {
    sugerido = true;
    itens = refs.map((d) => {
      const melhor = porItem(d.catalog_item_id)[0];
      const quantidade = d.dose_ref * d.aplicacoes * Number(p.area_ha);
      const valor = melhor ? quantidade * melhor.preco : null;
      return { catalog_item_id: d.catalog_item_id, nome: d.nome, categoria: d.categoria, unidade_dose: d.unidade_dose, exige_receita: d.exige_receita,
        dose_ha: d.dose_ref, aplicacoes: d.aplicacoes, quantidade, offer_id: melhor?.id || null, preco_unit: melhor?.preco || null, fornecedor: melhor?.fornecedor || null,
        valor_total: valor, safras_efeito: d.safras_efeito, valor_safra: valor != null ? valor / d.safras_efeito : null };
    });
  }
  itens = itens.map((i) => {
    const ref = refs.find((d) => d.catalog_item_id === i.catalog_item_id);
    const fora = ref && (i.dose_ha < ref.dose_ref * 0.7 || i.dose_ha > ref.dose_ref * 1.3);
    return { ...i, dose_ref: ref?.dose_ref ?? null, alerta_dose: fora ? `Dose ${i.dose_ha} fora de ±30% da referência (${ref.dose_ref})` : null, ofertas: porItem(i.catalog_item_id).map((o) => ({ id: o.id, fornecedor: o.fornecedor, preco: o.preco, prazo_dias: o.prazo_dias, marca: o.marca })) };
  });
  const { rows: docs } = await pool.query("SELECT id, tipo, nome, created_at FROM plot_documents WHERE plot_id = $1 AND tipo IN ('analise_solo','receita') ORDER BY id DESC", [p.id]);
  const total = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
  const safra = itens.reduce((s, i) => s + (i.valor_safra || 0), 0);
  const producao = Number(p.area_ha) * Number(p.produtividade_ha || 0);
  return { plot: { id: p.id, nome: p.nome, grao: p.grao, area_ha: p.area_ha, uf: p.uf, financiamento: p.financiamento, plano_status: p.plano_status, plano_obs: p.plano_obs, produtividade_ha: p.produtividade_ha },
    sugerido, itens, documentos: docs, totais: { compras: r2(total), custo_safra: r2(safra), por_ha: r2(safra / Number(p.area_ha || 1)), por_saca: producao ? r2(safra / producao) : null },
    pendencias: [
      ...(itens.some((i) => !i.offer_id) ? ["Escolha um fornecedor para todos os itens."] : []),
      ...(itens.some((i) => ["corretivo", "fertilizante"].includes(i.categoria)) && !docs.some((d) => d.tipo === "analise_solo") ? ["Anexe a análise de solo (corretivos e adubos)."] : []),
      ...(itens.some((i) => i.exige_receita) && !docs.some((d) => d.tipo === "receita") ? ["Anexe a receita agronômica com ART (defensivos)."] : []),
    ] };
}
router.get("/plots/:id/plano", requireAuth, exigeAtivo, asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  res.json(await montarPlano(p));
}));
router.put("/plots/:id/plano", requireAuth, requireRole("fazenda", "admin"), exigeAtivo, asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  if (p.financiamento !== "insumos") return res.status(400).json({ error: "Este talhão recebe o financiamento em dinheiro." });
  if (["enviado", "aprovado"].includes(p.plano_status)) return res.status(409).json({ error: p.plano_status === "aprovado" ? "Plano já aprovado: os pedidos foram emitidos." : "Plano em análise pelo fundo." });
  const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
  if (!itens.length) return res.status(400).json({ error: "Inclua pelo menos um item no plano." });
  const ofertas = await ofertasValidas(p.uf);
  const { rows: cat } = await pool.query("SELECT id, nome, fator_t FROM catalog_items WHERE ativo");
  const { rows: refs } = await pool.query("SELECT catalog_item_id, safras_efeito FROM reference_doses WHERE cultura = $1 AND uf IN ('BR',$2)", [p.grao, p.uf]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM plot_plan_items WHERE plot_id = $1", [p.id]);
    let total = 0;
    for (const it of itens) {
      const c = cat.find((x) => x.id === Number(it.catalog_item_id));
      const dose = num(it.dose_ha), apl = Math.max(1, Math.round(num(it.aplicacoes) || 1));
      if (!c) throw Object.assign(new Error("Item fora do catálogo."), { status: 400 });
      if (!(dose > 0)) throw Object.assign(new Error(`Informe a dose de ${c.nome}.`), { status: 400 });
      const o = it.offer_id ? ofertas.find((x) => x.id === Number(it.offer_id) && x.catalog_item_id === c.id) : null;
      if (it.offer_id && !o) throw Object.assign(new Error(`A oferta escolhida para ${c.nome} não está mais disponível no seu estado.`), { status: 400 });
      const qtd = dose * apl * Number(p.area_ha), valor = o ? qtd * o.preco : null;
      const safras = refs.find((r) => r.catalog_item_id === c.id)?.safras_efeito || 1;
      if (valor) total += valor;
      await client.query(
        `INSERT INTO plot_plan_items (plot_id, catalog_item_id, dose_ha, aplicacoes, quantidade, dose_t_ha, offer_id, preco_unit, valor_total, safras_efeito, valor_safra)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [p.id, c.id, dose, apl, qtd, dose * apl * c.fator_t, o?.id || null, o?.preco || null, valor, safras, valor != null ? valor / safras : null]);
    }
    await client.query("UPDATE plots SET plano_custo = $1, plano_status = 'rascunho' WHERE id = $2", [r2(total), p.id]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); if (e.status) return res.status(e.status).json({ error: e.message }); throw e; } finally { client.release(); }
  const { p: atual } = await plotAcessivel(p.id, req.user);
  res.json(await montarPlano(atual));
}));
router.post("/plots/:id/documentos", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  const { tipo, nome, conteudo } = req.body || {};
  if (!["analise_solo", "receita"].includes(tipo)) return res.status(400).json({ error: "Tipo de documento inválido." });
  if (typeof conteudo !== "string" || !/^data:(application\/pdf|image\/[a-z+.-]+);base64,/.test(conteudo)) return res.status(400).json({ error: "Envie um PDF ou uma imagem." });
  if (conteudo.length > 2_100_000) return res.status(400).json({ error: "Arquivo muito grande: até 1,5 MB." });
  const { rows } = await pool.query("INSERT INTO plot_documents (plot_id, tipo, nome, conteudo, enviado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id, tipo, nome, created_at",
    [p.id, tipo, String(nome || tipo).slice(0, 120), conteudo, req.user.id]);
  res.status(201).json({ documento: rows[0] });
}));
router.get("/plots/:id/documentos/:docId", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT d.*, f.owner_user_id FROM plot_documents d JOIN plots p ON p.id = d.plot_id JOIN farms f ON f.id = p.farm_id WHERE d.id = $1 AND d.plot_id = $2", [req.params.docId, req.params.id]);
  const d = rows[0];
  if (!d) return res.status(404).json({ error: "Documento não encontrado." });
  let pode = ["admin", "fundo"].includes(req.user.role) || d.owner_user_id === req.user.id;
  if (!pode && req.user.role === "fornecedor" && d.tipo === "receita") {
    const { rows: o } = await pool.query("SELECT 1 FROM purchase_orders po JOIN users u ON u.supplier_id = po.supplier_id WHERE po.plot_id = $1 AND u.id = $2 LIMIT 1", [req.params.id, req.user.id]);
    pode = !!o[0];
  }
  if (!pode) return res.status(403).json({ error: "Sem permissão para este documento." });
  res.json({ nome: d.nome, conteudo: d.conteudo, tipo: d.tipo });
}));
router.post("/plots/:id/plano/enviar", requireAuth, requireRole("fazenda", "admin"), exigeAtivo, asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  const plano = await montarPlano(p);
  if (plano.sugerido) return res.status(400).json({ error: "Salve o plano antes de enviar." });
  if (plano.pendencias.length) return res.status(400).json({ error: plano.pendencias.join(" ") });
  await pool.query("UPDATE plots SET plano_status = 'enviado', plano_obs = NULL WHERE id = $1", [p.id]);
  await avisarFundo(`Plano de compras: ${p.nome}`, `${p.fazenda} enviou o plano (${plano.itens.length} itens, R$ ${plano.totais.compras.toLocaleString("pt-BR")}).`, p.id, p.farm_id);
  res.json({ ok: true });
}));

// ---------------- fundo: planos e pagamentos ----------------
router.get("/fundo/insumos", requireAuth, requireRole("admin", "fundo"), exigeAtivo, asyncHandler(async (req, res) => {
  const { rows: planos } = await pool.query(
    `SELECT p.id, p.nome, p.grao, p.area_ha, p.plano_status, p.plano_custo, f.name AS fazenda, f.location FROM plots p JOIN farms f ON f.id = p.farm_id
      WHERE p.financiamento = 'insumos' AND p.plano_status IN ('enviado','aprovado','devolvido') ORDER BY (p.plano_status = 'enviado') DESC, p.id DESC LIMIT 200`);
  const { rows: pedidos } = await pool.query(
    `SELECT po.*, s.razao_social AS fornecedor, p.nome AS talhao, f.name AS fazenda FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
       JOIN plots p ON p.id = po.plot_id JOIN farms f ON f.id = p.farm_id ORDER BY (po.status = 'recebido') DESC, po.id DESC LIMIT 300`);
  res.json({ planos, pedidos });
}));
router.post("/fundo/plots/:id/plano/aprovar", requireAuth, requireRole("admin", "fundo"), exigeAtivo, asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  if (p.plano_status !== "enviado") return res.status(409).json({ error: "O plano não está aguardando aprovação." });
  const { rows: itens } = await pool.query(
    `SELECT pi.*, o.supplier_id, s.comissao_pct, s.owner_user_id FROM plot_plan_items pi JOIN supplier_offers o ON o.id = pi.offer_id JOIN suppliers s ON s.id = o.supplier_id WHERE pi.plot_id = $1`, [p.id]);
  const grupos = {};
  for (const i of itens) (grupos[i.supplier_id] ||= []).push(i);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [sid, lista] of Object.entries(grupos)) {
      const total = r2(lista.reduce((s, i) => s + Number(i.valor_total), 0));
      const { rows: po } = await client.query("INSERT INTO purchase_orders (plot_id, supplier_id, valor_total, comissao_pct) VALUES ($1,$2,$3,$4) RETURNING id", [p.id, sid, total, lista[0].comissao_pct]);
      for (const i of lista) await client.query("INSERT INTO purchase_order_items (order_id, plan_item_id, catalog_item_id, quantidade, preco_unit, valor) VALUES ($1,$2,$3,$4,$5,$6)",
        [po[0].id, i.id, i.catalog_item_id, i.quantidade, i.preco_unit, i.valor_total]);
    }
    await client.query("UPDATE plots SET plano_status = 'aprovado' WHERE id = $1", [p.id]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  await notifyUsers(pool, [...new Set(itens.map((i) => i.owner_user_id))], { senderRole: "sistema", plotId: p.id, type: "pedido", title: "Novo pedido de compra", body: `${p.fazenda} · ${p.nome}. Confira e aceite em Meu catálogo › Pedidos.` }).catch(() => {});
  await notifyUsers(pool, [p.owner_user_id], { senderRole: "fundo", plotId: p.id, farmId: p.farm_id, type: "insumos", title: "Plano de compras aprovado", body: `Os pedidos de ${p.nome} foram enviados aos fornecedores. Confirme cada entrega no app.` }).catch(() => {});
  res.json({ ok: true, pedidos: Object.keys(grupos).length });
}));
router.post("/fundo/plots/:id/plano/devolver", requireAuth, requireRole("admin", "fundo"), exigeAtivo, asyncHandler(async (req, res) => {
  const motivo = String(req.body?.motivo || "").trim();
  if (motivo.length < 5) return res.status(400).json({ error: "Explique o que a fazenda precisa ajustar." });
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  await pool.query("UPDATE plots SET plano_status = 'devolvido', plano_obs = $1 WHERE id = $2", [motivo.slice(0, 500), p.id]);
  await notifyUsers(pool, [p.owner_user_id], { senderRole: "fundo", plotId: p.id, farmId: p.farm_id, type: "insumos", title: "Plano de compras devolvido", body: motivo }).catch(() => {});
  res.json({ ok: true });
}));
router.post("/fundo/orders/:id/pagar", requireAuth, requireRole("admin", "fundo"), exigeAtivo, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT po.*, p.farm_id, p.nome AS talhao, s.razao_social, s.owner_user_id FROM purchase_orders po JOIN plots p ON p.id = po.plot_id JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1", [req.params.id]);
  const o = rows[0];
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (o.status !== "recebido") return res.status(409).json({ error: "Só é possível pagar depois que a fazenda confirma o recebimento." });
  const comissao = r2(Number(o.valor_total) * Number(o.comissao_pct) / 100);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE purchase_orders SET status = 'pago', pago_em = now(), comissao_fundo = $1 WHERE id = $2", [comissao, o.id]);
    await recordTransaction(client, { type: "pagamento_fornecedor", userId: o.owner_user_id, farmId: o.farm_id, plotId: o.plot_id, amount: r2(Number(o.valor_total) - comissao),
      description: `Pedido #${o.id} · ${o.razao_social} · ${o.talhao}: pago pelo fundo (valor ${Number(o.valor_total).toFixed(2)}, comissão de ${o.comissao_pct}% retida)` });
    await recordTransaction(client, { type: "comissao_fundo_compra", userId: null, farmId: o.farm_id, plotId: o.plot_id, amount: comissao, description: `Comissão de ${o.comissao_pct}% do fundo sobre o pedido #${o.id} (${o.razao_social})` });
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  await notifyUsers(pool, [o.owner_user_id], { senderRole: "fundo", plotId: o.plot_id, type: "pedido", title: `Pedido #${o.id} pago`, body: `Valor líquido de R$ ${(Number(o.valor_total) - comissao).toFixed(2).replace(".", ",")} (comissão de ${o.comissao_pct}% retida).` }).catch(() => {});
  res.json({ ok: true, comissao });
}));

// ---------------- fornecedor: pedidos ----------------
router.get("/suppliers/me/orders", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT po.*, p.nome AS talhao, p.grao, p.area_ha, f.name AS fazenda, f.location AS fazenda_local,
            (SELECT d.id FROM plot_documents d WHERE d.plot_id = p.id AND d.tipo = 'receita' ORDER BY d.id DESC LIMIT 1) AS receita_id,
            COALESCE(json_agg(json_build_object('item', c.nome, 'unidade', c.unidade_dose, 'quantidade', poi.quantidade, 'preco', poi.preco_unit, 'valor', poi.valor, 'exige_receita', c.exige_receita)) FILTER (WHERE poi.id IS NOT NULL), '[]') AS itens
       FROM purchase_orders po JOIN users u ON u.supplier_id = po.supplier_id AND u.id = $1
       JOIN plots p ON p.id = po.plot_id JOIN farms f ON f.id = p.farm_id
       LEFT JOIN purchase_order_items poi ON poi.order_id = po.id LEFT JOIN catalog_items c ON c.id = poi.catalog_item_id
      GROUP BY po.id, p.id, f.id ORDER BY po.id DESC`, [req.user.id]);
  res.json({ pedidos: rows });
}));
async function pedidoDoFornecedor(id, userId) {
  const { rows } = await pool.query("SELECT po.*, p.nome AS talhao, p.farm_id, f.owner_user_id AS fazenda_user FROM purchase_orders po JOIN users u ON u.supplier_id = po.supplier_id AND u.id = $2 JOIN plots p ON p.id = po.plot_id JOIN farms f ON f.id = p.farm_id WHERE po.id = $1", [id, userId]);
  return rows[0];
}
router.post("/suppliers/me/orders/:id/aceitar", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const o = await pedidoDoFornecedor(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (o.status !== "emitido") return res.status(409).json({ error: "Este pedido já foi aceito." });
  await pool.query("UPDATE purchase_orders SET status = 'aceito', aceito_em = now() WHERE id = $1", [o.id]);
  res.json({ ok: true });
}));
router.post("/suppliers/me/orders/:id/entregar", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const o = await pedidoDoFornecedor(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (!["aceito", "recusado"].includes(o.status)) return res.status(409).json({ error: "Aceite o pedido antes de registrar a entrega." });
  const nf = String(req.body?.nf_numero || "").trim().replace(/^n\.?\s*f\.?(-?e)?\s*[:nº°#-]*\s*/i, "");
  if (nf.length < 3) return res.status(400).json({ error: "Informe o número da nota fiscal emitida em nome da fazenda." });
  await pool.query("UPDATE purchase_orders SET status = 'entregue', entregue_em = now(), nf_numero = $1, recusa_motivo = NULL WHERE id = $2", [nf.slice(0, 60), o.id]);
  await notifyUsers(pool, [o.fazenda_user], { senderRole: "sistema", plotId: o.plot_id, farmId: o.farm_id, type: "pedido", title: "Entrega registrada", body: `Pedido #${o.id} de ${o.talhao}: confira os itens e confirme o recebimento no app.` }).catch(() => {});
  res.json({ ok: true });
}));

// ---------------- fazenda: pedidos e recebimento ----------------
router.get("/plots/:id/pedidos", requireAuth, asyncHandler(async (req, res) => {
  const { p, erro } = await plotAcessivel(req.params.id, req.user);
  if (erro) return res.status(erro[0]).json({ error: erro[1] });
  const { rows } = await pool.query(
    `SELECT po.*, s.razao_social AS fornecedor,
            COALESCE(json_agg(json_build_object('item', c.nome, 'unidade', c.unidade_dose, 'quantidade', poi.quantidade, 'valor', poi.valor)) FILTER (WHERE poi.id IS NOT NULL), '[]') AS itens
       FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id LEFT JOIN purchase_order_items poi ON poi.order_id = po.id LEFT JOIN catalog_items c ON c.id = poi.catalog_item_id
      WHERE po.plot_id = $1 GROUP BY po.id, s.id ORDER BY po.id`, [p.id]);
  res.json({ pedidos: rows });
}));
router.post("/orders/:id/receber", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT po.*, f.owner_user_id, p.nome AS talhao, s.owner_user_id AS fornecedor_user FROM purchase_orders po JOIN plots p ON p.id = po.plot_id JOIN farms f ON f.id = p.farm_id JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = $1", [req.params.id]);
  const o = rows[0];
  if (!o) return res.status(404).json({ error: "Pedido não encontrado." });
  if (req.user.role !== "admin" && o.owner_user_id !== req.user.id) return res.status(403).json({ error: "Sem acesso a este pedido." });
  if (o.status !== "entregue") return res.status(409).json({ error: "O fornecedor ainda não registrou a entrega." });
  if (req.body?.aceito === false) {
    const motivo = String(req.body?.motivo || "").trim();
    if (motivo.length < 5) return res.status(400).json({ error: "Explique o problema (item faltando, avariado, errado)." });
    await pool.query("UPDATE purchase_orders SET status = 'recusado', recusa_motivo = $1 WHERE id = $2", [motivo.slice(0, 500), o.id]);
    await notifyUsers(pool, [o.fornecedor_user], { senderRole: "fazenda", plotId: o.plot_id, type: "pedido", title: `Entrega recusada · pedido #${o.id}`, body: motivo }).catch(() => {});
    return res.json({ ok: true, status: "recusado" });
  }
  await pool.query("UPDATE purchase_orders SET status = 'recebido', recebido_em = now() WHERE id = $1", [o.id]);
  await avisarFundo(`Pedido #${o.id} recebido`, `${o.talhao}: a fazenda confirmou o recebimento. Pronto para pagar.`, o.plot_id, null);
  res.json({ ok: true, status: "recebido" });
}));

module.exports = router;
module.exports.config = config;
