const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getFarmInvestorIds, getPlotInvestorIds } = require("../notify");
const { getAppCommissionPct, getFaseMultiplier } = require("../settings");

const router = express.Router();

const FASES = [
  "Preparo do solo",
  "Plantio",
  "Germinação",
  "Manejo e combate a pragas",
  "Ponto de colheita",
  "Colheita",
];

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
  const appCommissionPct = await getAppCommissionPct();
  let sql = `
    SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct,
           ROUND((
             COALESCE((SELECT SUM(c.pontos) FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key WHERE fc.farm_id = f.id), 0)::numeric
             / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5
           ), 1) as farm_estrelas
    FROM plots p
    JOIN farms f ON f.id = p.farm_id
    WHERE f.status = 'aprovada' AND p.status NOT IN ('pago', 'arquivado', 'aguardando_aprovacao')
  `;
  const params = [];
  if (grao) {
    params.push(grao);
    sql += ` AND p.grao = $${params.length}`;
  }
  sql += " ORDER BY p.created_at DESC";
  const { rows } = await pool.query(sql, params);
  res.json({ plots: rows, app_commission_pct: appCommissionPct });
}));

// fazenda: todos os seus talhões, em qualquer status (inclusive já colhidos,
// pagos e arquivados), para gestão — diferente da vitrine pública, que
// esconde os já colhidos
router.get("/farm/mine", requireAuth, requireRole("fazenda"), asyncHandler(async (req, res) => {
  const appCommissionPct = await getAppCommissionPct();
  const { rows } = await pool.query(
    `SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct
     FROM plots p JOIN farms f ON f.id = p.farm_id
     WHERE p.farm_id = $1
     ORDER BY p.created_at DESC`,
    [req.user.farm_id]
  );
  res.json({ plots: rows, app_commission_pct: appCommissionPct });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const appCommissionPct = await getAppCommissionPct();
  const { rows } = await pool.query(
    `SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct, f.status as farm_status,
            ROUND((
              COALESCE((SELECT SUM(c.pontos) FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key WHERE fc.farm_id = f.id), 0)::numeric
              / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5
            ), 1) as farm_estrelas
     FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1`,
    [req.params.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const historico = await pool.query(
    "SELECT * FROM progress_updates WHERE plot_id = $1 ORDER BY created_at",
    [req.params.id]
  );

  res.json({ plot, historico: historico.rows, app_commission_pct: appCommissionPct });
}));

router.post("/", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { farm_id, nome, grao, area_ha, safra, previsao_retorno } = req.body || {};
  let { preco_venda_estimado, cotas_totais, unidade } = req.body || {};

  if (!farm_id || !nome || !grao || !area_ha || !safra || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do talhão." });
  }

  const owned = await getFarmOwned(farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (owned.farm.status !== "aprovada") {
    return res.status(403).json({ error: "Sua fazenda ainda não foi aprovada pela administração do Talhão." });
  }

  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  // se o preço de venda estimado, a quantidade de unidades, ou a unidade
  // em si não vierem preenchidos, usa a referência de mercado do grão
  // (preço aproximado × produtividade média estimada × hectares do talhão)
  if (!preco_venda_estimado || !cotas_totais || !unidade) {
    const refResult = await pool.query("SELECT * FROM commodity_references WHERE grao = $1", [grao]);
    const ref = refResult.rows[0];
    if (!ref) {
      return res.status(400).json({ error: "Não há referência de mercado cadastrada para este grão. Informe preço e quantidade manualmente ou peça à administração para cadastrar." });
    }
    unidade = unidade || ref.unidade;
    preco_venda_estimado = preco_venda_estimado || ref.preco_unidade;
    cotas_totais = cotas_totais || Math.round(area * ref.produtividade_ha);
  }

  const cotas = Number(cotas_totais);
  const precoVenda = Number(preco_venda_estimado);
  if (Number.isNaN(cotas) || cotas <= 0 || Number.isNaN(precoVenda) || precoVenda <= 0) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }
  if (!["saca", "fardo", "arroba"].includes(unidade)) {
    return res.status(400).json({ error: "Unidade inválida. Use saca, fardo ou arroba." });
  }

  // preço inicial da cota (fase 0, "Preparo do solo") — o mais barato,
  // sobe automaticamente conforme a fase avança
  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = precoVenda * multiplicadorFase0;

  const { rows } = await pool.query(
    `INSERT INTO plots (farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno, unidade, preco_venda_estimado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10) RETURNING *`,
    [farm_id, nome, grao, area, safra, cotaValorInicial, cotas, retorno, unidade, precoVenda]
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

    // o preço da cota sobe conforme a fase avança, aproximando-se do
    // preço de venda estimado — quem compra mais cedo paga menos
    const multiplicador = await getFaseMultiplier(fase);
    const novoCotaValor = plot.preco_venda_estimado * multiplicador;

    await client.query(
      "UPDATE plots SET fase_atual = $1, progresso = $2, status = $3, cota_valor = $4 WHERE id = $5",
      [fase, prog, novoStatus, novoCotaValor, plot.id]
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
  const { retorno_final, comprovante_texto, comprovante_imagem } = req.body || {};
  const retorno = Number(retorno_final);
  if (Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Informe o retorno final da safra (%)." });
  }
  if (!comprovante_texto || comprovante_texto.trim().length < 15) {
    return res.status(400).json({
      error: "Descreva o comprovante da colheita (ex: número da nota fiscal, comprador, ou onde a fazenda pode ser conferida) com pelo menos 15 caracteres.",
    });
  }
  if (comprovante_imagem) {
    if (typeof comprovante_imagem !== "string" || !comprovante_imagem.startsWith("data:image/")) {
      return res.status(400).json({ error: "Comprovante em formato de imagem inválido." });
    }
    if (comprovante_imagem.length > 1_500_000) {
      return res.status(400).json({ error: "Imagem do comprovante muito grande. Escolha um arquivo menor." });
    }
  }

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (plot.status === "pago") {
    return res.status(409).json({ error: "Este talhão já foi pago aos investidores." });
  }
  if (plot.status === "aguardando_aprovacao") {
    return res.status(409).json({ error: "Já existe uma solicitação de finalização aguardando aprovação da administração para este talhão." });
  }
  if (plot.fase_atual !== FASES.length - 1) {
    return res.status(409).json({
      error: `Atualize a fase do talhão para "${FASES[FASES.length - 1]}" antes de solicitar a finalização da colheita.`,
    });
  }

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const client = await pool.connect();
  let request;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO harvest_requests (plot_id, farm_id, retorno_final, comprovante_texto, comprovante_imagem, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [plot.id, plot.farm_id, retorno, comprovante_texto.trim(), comprovante_imagem || null, req.user.id]
    );
    request = rows[0];
    await client.query("UPDATE plots SET status = 'aguardando_aprovacao' WHERE id = $1", [plot.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // avisa a administração que há uma solicitação para revisar
  try {
    const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    await notifyUsers(pool, admins.map((a) => a.id), {
      senderRole: "sistema",
      farmId: plot.farm_id,
      plotId: plot.id,
      type: "solicitacao_colheita",
      title: "Nova solicitação de finalização de colheita",
      body: `${owned.farm.name} pediu para finalizar a colheita de ${plot.nome} com retorno de ${retorno}%. Revise o comprovante antes de aprovar o pagamento.`,
    });
  } catch (notifyErr) {
    console.error("[aviso] falha ao notificar administração:", notifyErr);
  }

  const { rows: updatedPlot } = await pool.query("SELECT * FROM plots WHERE id = $1", [plot.id]);
  res.status(201).json({ ok: true, request, plot: updatedPlot[0] });
}));

// exclui um talhão. Se ele nunca teve cota vendida, remove de verdade.
// Se já foi colhido e pago, "excluir" arquiva o talhão (some da gestão
// ativa da fazenda) sem apagar o registro — o investidor precisa
// continuar vendo o talhão que teve e o quanto recebeu.
router.delete("/:id", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const nuncaVendido = plot.cotas_disponiveis === plot.cotas_totais;
  if (plot.status !== "pago" && !nuncaVendido) {
    return res.status(409).json({ error: "Só é possível excluir um talhão sem cotas vendidas ou que já tenha sido pago aos investidores." });
  }

  if (plot.status === "pago") {
    // arquiva em vez de apagar — preserva o histórico do investidor
    await pool.query("UPDATE plots SET status = 'arquivado' WHERE id = $1", [plot.id]);
    return res.json({ ok: true, arquivado: true });
  }

  // nunca vendido: nenhum investimento/pagamento depende deste talhão,
  // então é seguro remover de verdade
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM progress_updates WHERE plot_id = $1", [plot.id]);
    await client.query("UPDATE notifications SET plot_id = NULL WHERE plot_id = $1", [plot.id]);
    await client.query("DELETE FROM plots WHERE id = $1", [plot.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true, arquivado: false });
}));

// reinicia um talhão já colhido/pago (ou arquivado) para um novo ciclo,
// com uma nova commodity — reaproveita o mesmo talhão físico em vez de
// criar um novo, mantendo o histórico de pagamento anterior intacto
// para o investidor, e volta a aparecer na vitrine para investimento
router.patch("/:id/restart", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { nome, grao, area_ha, safra, previsao_retorno } = req.body || {};
  let { preco_venda_estimado, cotas_totais, unidade } = req.body || {};

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  if (!["pago", "arquivado"].includes(plot.status)) {
    return res.status(409).json({ error: "Só é possível reiniciar um talhão que já foi colhido e pago aos investidores." });
  }

  if (!nome || !grao || !area_ha || !safra || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do novo ciclo do talhão." });
  }

  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  if (!preco_venda_estimado || !cotas_totais || !unidade) {
    const refResult = await pool.query("SELECT * FROM commodity_references WHERE grao = $1", [grao]);
    const ref = refResult.rows[0];
    if (!ref) {
      return res.status(400).json({ error: "Não há referência de mercado cadastrada para este grão. Informe preço e quantidade manualmente." });
    }
    unidade = unidade || ref.unidade;
    preco_venda_estimado = preco_venda_estimado || ref.preco_unidade;
    cotas_totais = cotas_totais || Math.round(area * ref.produtividade_ha);
  }

  const cotas = Number(cotas_totais);
  const precoVenda = Number(preco_venda_estimado);
  if (Number.isNaN(cotas) || cotas <= 0 || Number.isNaN(precoVenda) || precoVenda <= 0) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }
  if (!["saca", "fardo", "arroba"].includes(unidade)) {
    return res.status(400).json({ error: "Unidade inválida. Use saca, fardo ou arroba." });
  }

  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = precoVenda * multiplicadorFase0;

  const { rows } = await pool.query(
    `UPDATE plots SET
       nome = $1, grao = $2, area_ha = $3, safra = $4, cota_valor = $5,
       cotas_totais = $6, cotas_disponiveis = $6, previsao_retorno = $7,
       retorno_final = NULL, fase_atual = 0, progresso = 0, status = 'captacao', unidade = $8,
       preco_venda_estimado = $9
     WHERE id = $10
     RETURNING *`,
    [nome, grao, area, safra, cotaValorInicial, cotas, retorno, unidade, precoVenda, plot.id]
  );

  res.json({ plot: rows[0] });
}));

// edita informações de um talhão já colhido/pago ou arquivado, sem
// reabri-lo para investimento — útil para corrigir nome, área, safra
// ou a previsão de retorno exibida no histórico, sem mexer nas cotas
// já vendidas nem no valor que os investidores já receberam
router.patch("/:id", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { nome, grao, area_ha, safra, previsao_retorno } = req.body || {};

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  if (!["pago", "arquivado"].includes(plot.status)) {
    return res.status(409).json({ error: "Só é possível editar um talhão já colhido/pago ou arquivado. Talhões em captação usam a atualização de safra." });
  }

  if (!nome || !grao || !area_ha || !safra) {
    return res.status(400).json({ error: "Preencha nome, grão, área e safra." });
  }

  const area = Number(area_ha);
  const retorno = previsao_retorno != null ? Number(previsao_retorno) : plot.previsao_retorno;
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  const { rows } = await pool.query(
    `UPDATE plots SET nome = $1, grao = $2, area_ha = $3, safra = $4, previsao_retorno = $5 WHERE id = $6 RETURNING *`,
    [nome, grao, area, safra, retorno, plot.id]
  );

  res.json({ plot: rows[0] });
}));

module.exports = router;
