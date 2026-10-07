const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getFarmInvestorIds, getPlotInvestorIds } = require("../notify");
const { getAppCommissionPct, getFaseMultiplier } = require("../settings");
const { validatePhotoData } = require("../validators");
const { getValidations, getPublicWarehouse, WAREHOUSE_STARS_SQL } = require("../custody");
const { UNIDADES, TIPOS, getCultura, fasesDe } = require("../culturas");
const { PUBLIC_SQL, isPublic, pendencias, maybePublish } = require("../publication");

const router = express.Router();

const MAX_PLOT_PHOTOS = 6;
const NUM_FASES = 6;

async function safeNotify(ids, payload) {
  try { await notifyUsers(pool, ids, payload); } catch (err) { console.error("[aviso não enviado]", err.message); }
}

function parseDate(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : String(v);
}

// Valida cultura, variedade, tipo de produção, unidade, ciclo e quantidades
// (usado no cadastro e no reinício de um talhão). Cultura e variedade podem
// ser da lista do catálogo ou digitadas pela fazenda.
async function parseCultivo(body, area) {
  const grao = String(body.grao || body.cultura || "").trim().slice(0, 60);
  const variedade = String(body.variedade || "").trim().slice(0, 80);
  if (!grao) return { error: "Escolha a cultura do talhão." };
  if (!variedade) return { error: "Informe a variedade da cultura." };

  const catalogo = getCultura(grao);
  const tipo = catalogo ? catalogo.tipo : String(body.tipo_producao || "");
  if (!TIPOS[tipo]) return { error: "Escolha o tipo de produção (lavoura, pecuária ou produção animal)." };

  const plantio_ate = parseDate(body.plantio_ate);
  const colheita_prevista = parseDate(body.colheita_prevista);
  const nomes = TIPOS[tipo].ciclo;
  if (!plantio_ate) return { error: `Informe a data: ${nomes.inicio.toLowerCase()}.` };
  if (!colheita_prevista) return { error: `Informe a data: ${nomes.fim.toLowerCase()}.` };
  if (colheita_prevista <= plantio_ate) return { error: `A data "${nomes.fim}" precisa ser depois de "${nomes.inicio}".` };

  let { preco_venda_estimado, cotas_totais, unidade } = body;
  unidade = unidade || catalogo?.unidade;
  if (!preco_venda_estimado || !cotas_totais) {
    const { rows } = await pool.query("SELECT * FROM commodity_references WHERE grao = $1", [catalogo?.nome || grao]);
    const ref = rows[0];
    if (!ref) return { error: "Não há referência de mercado para esta cultura. Informe o preço e a quantidade prevista." };
    unidade = unidade || ref.unidade;
    preco_venda_estimado = preco_venda_estimado || ref.preco_unidade;
    if (!cotas_totais) {
      if (!ref.produtividade_ha) return { error: `Informe a quantidade prevista de ${UNIDADES[unidade]?.plural || "unidades"}.` };
      cotas_totais = Math.round(area * ref.produtividade_ha);
    }
  }
  if (!UNIDADES[unidade]) return { error: "Unidade de venda inválida." };
  const cotas = Math.round(Number(cotas_totais));
  const precoVenda = Number(preco_venda_estimado);
  if (Number.isNaN(cotas) || cotas <= 0 || Number.isNaN(precoVenda) || precoVenda <= 0) {
    return { error: "Preço e quantidade precisam ser maiores que zero." };
  }
  return { grao: catalogo?.nome || grao, variedade, tipo, unidade, cotas, precoVenda, plantio_ate, colheita_prevista };
}

async function notifyAdminsNewPlot(plot, farmName, reinicio = false) {
  const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL");
  await safeNotify(rows.map((r) => r.id), {
    senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "talhao_para_aprovar",
    title: reinicio ? `Novo ciclo para aprovar: ${plot.nome}` : `Talhão para aprovar: ${plot.nome}`,
    body: `${farmName} cadastrou ${plot.grao}${plot.variedade ? ` (${plot.variedade})` : ""}, safra ${plot.safra}. Revise em Administração › Talhões.`,
  });
}

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
           w.name as warehouse_name, ${WAREHOUSE_STARS_SQL} as warehouse_estrelas,
           ROUND((
             COALESCE((SELECT SUM(c.pontos) FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key WHERE fc.farm_id = f.id), 0)::numeric
             / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5
           ), 1)::float8 as farm_estrelas
    FROM plots p
    JOIN farms f ON f.id = p.farm_id
    LEFT JOIN warehouses w ON w.id = p.warehouse_id
    WHERE f.status = 'aprovada' AND p.status NOT IN ('pago', 'arquivado', 'aguardando_aprovacao')
      AND ${PUBLIC_SQL}
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
    `SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct,
            w.name as warehouse_name,
            COALESCE((SELECT json_agg(json_build_object('etapa', v.etapa, 'resultado', v.resultado, 'quantidade', v.quantidade, 'observacao', v.observacao, 'created_at', v.created_at))
                      FROM plot_validations v WHERE v.plot_id = p.id), '[]') as validacoes
     FROM plots p JOIN farms f ON f.id = p.farm_id
     LEFT JOIN warehouses w ON w.id = p.warehouse_id
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
            ), 1)::float8 as farm_estrelas
     FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1`,
    [req.params.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const historico = await pool.query(
    "SELECT * FROM progress_updates WHERE plot_id = $1 ORDER BY created_at",
    [req.params.id]
  );

  const fotos = await pool.query(
    "SELECT id, data, position FROM photos WHERE plot_id = $1 ORDER BY position, id",
    [req.params.id]
  );

  // armazém garantidor e validações: base da confiança do investidor
  const armazem = plot.custodia_status === "aceita" || plot.custodia_status === "pendente"
    ? await getPublicWarehouse(pool, plot.warehouse_id) : null;
  const validacoes = plot.custodia_status === "aceita" ? await getValidations(pool, plot.id) : [];

  res.json({
    plot, historico: historico.rows, app_commission_pct: appCommissionPct, fotos: fotos.rows, armazem, validacoes,
    publico: isPublic(plot), pendencias: pendencias(plot),
  });
}));

// confere se o armazém indicado existe e está credenciado
async function getApprovedWarehouse(warehouseId) {
  if (!warehouseId) return { warehouse: null };
  const { rows } = await pool.query("SELECT * FROM warehouses WHERE id = $1", [warehouseId]);
  const w = rows[0];
  if (!w || w.status !== "aprovado") return { error: "Escolha um armazém credenciado pela administração." };
  return { warehouse: w };
}

async function notifyWarehouseIndication(warehouse, plot, farmName) {
  if (!warehouse?.owner_user_id) return;
  await notifyUsers(pool, [warehouse.owner_user_id], {
    senderRole: "fazenda",
    farmId: plot.farm_id,
    plotId: plot.id,
    type: "indicacao_armazem",
    title: "Nova indicação de custódia",
    body: `${farmName} indicou seu armazém como garantidor de ${plot.nome} (${plot.grao}, safra ${plot.safra}). Aceite ou recuse no painel.`,
  });
}

router.post("/", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { farm_id, nome, area_ha, safra, previsao_retorno, warehouse_id } = req.body || {};

  if (!farm_id || !nome || !area_ha || !safra || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do talhão." });
  }

  const owned = await getFarmOwned(farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (owned.farm.status !== "aprovada") {
    return res.status(403).json({ error: "Sua fazenda ainda não foi aprovada pela administração do Talhão." });
  }

  // todo talhão novo precisa de armazém garantidor credenciado
  const wh = await getApprovedWarehouse(warehouse_id);
  if (wh.error) return res.status(400).json({ error: wh.error });
  if (!wh.warehouse) {
    const { rows: anyApproved } = await pool.query("SELECT 1 FROM warehouses WHERE status = 'aprovado' LIMIT 1");
    return res.status(400).json({
      error: anyApproved.length
        ? "Escolha o armazém que vai garantir este talhão."
        : "Ainda não há armazém credenciado na plataforma. Fale com a administração antes de cadastrar talhões.",
    });
  }

  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  const c = await parseCultivo(req.body, area);
  if (c.error) return res.status(400).json({ error: c.error });

  // preço inicial (fase 0) — o mais barato, sobe conforme a fase avança
  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = c.precoVenda * multiplicadorFase0;

  const { rows } = await pool.query(
    `INSERT INTO plots (farm_id, nome, grao, variedade, tipo_producao, plantio_ate, colheita_prevista, area_ha, safra,
                        cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno, unidade, preco_venda_estimado,
                        warehouse_id, custodia_status, aprovacao_status, exige_garantia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, 'pendente', 'pendente', true) RETURNING *`,
    [farm_id, String(nome).trim(), c.grao, c.variedade, c.tipo, c.plantio_ate, c.colheita_prevista, area, safra,
     cotaValorInicial, c.cotas, retorno, c.unidade, c.precoVenda, wh.warehouse.id]
  );
  const plot = rows[0];
  await notifyWarehouseIndication(wh.warehouse, plot, owned.farm.name);
  await notifyAdminsNewPlot(plot, owned.farm.name);

  res.status(201).json({ plot, pendencias: pendencias(plot) });
}));

// Fotos do talhão: fotos da lavoura/safra daquele ciclo específico, exibidas
// na página pública do talhão. Mesmo padrão de armazenamento das fotos da
// fazenda — base64 direto no banco, sem serviço de storage externo.
router.post("/:id/photos", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { data } = req.body || {};

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const photoError = validatePhotoData(data);
  if (photoError) return res.status(400).json({ error: photoError });

  const { rows: countRows } = await pool.query("SELECT COUNT(*)::int as total FROM photos WHERE plot_id = $1", [plot.id]);
  if (countRows[0].total >= MAX_PLOT_PHOTOS) {
    return res.status(409).json({ error: `Limite de ${MAX_PLOT_PHOTOS} fotos por talhão atingido. Exclua alguma foto antes de adicionar outra.` });
  }

  const { rows } = await pool.query(
    "INSERT INTO photos (plot_id, data, position) VALUES ($1, $2, $3) RETURNING id, data, position",
    [plot.id, data, countRows[0].total]
  );

  res.status(201).json({ photo: rows[0] });
}));

router.delete("/:id/photos/:photoId", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const { rowCount } = await pool.query("DELETE FROM photos WHERE id = $1 AND plot_id = $2", [req.params.photoId, plot.id]);
  if (!rowCount) return res.status(404).json({ error: "Foto não encontrada." });

  res.json({ ok: true });
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
  if (Number.isNaN(fase) || fase < 0 || fase >= NUM_FASES) {
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
      ? `${fasesDe(plot)[fase]} · ${prog}% do ciclo. ${nota}`
      : `O talhão avançou para a fase "${fasesDe(plot)[fase]}" (${prog}% do ciclo).`,
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
  if (plot.fase_atual !== NUM_FASES - 1) {
    return res.status(409).json({
      error: `Atualize a fase do talhão para "${fasesDe(plot)[NUM_FASES - 1]}" antes de solicitar a finalização.`,
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
  const { nome, area_ha, safra, previsao_retorno } = req.body || {};

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  if (!["pago", "arquivado"].includes(plot.status)) {
    return res.status(409).json({ error: "Só é possível reiniciar um talhão que já foi colhido e pago aos investidores." });
  }
  if (!nome || !area_ha || !safra || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do novo ciclo do talhão." });
  }
  if (!plot.warehouse_id) {
    return res.status(400).json({ error: "Indique um armazém garantidor no talhão antes de iniciar um novo ciclo." });
  }

  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }
  const c = await parseCultivo(req.body, area);
  if (c.error) return res.status(400).json({ error: c.error });

  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = c.precoVenda * multiplicadorFase0;

  // novo ciclo volta a exigir aprovação da administração e aceite do armazém
  const { rows } = await pool.query(
    `UPDATE plots SET
       nome = $1, grao = $2, variedade = $3, tipo_producao = $4, plantio_ate = $5, colheita_prevista = $6,
       area_ha = $7, safra = $8, cota_valor = $9, cotas_totais = $10, cotas_disponiveis = $10, previsao_retorno = $11,
       retorno_final = NULL, fase_atual = 0, progresso = 0, status = 'captacao', unidade = $12, preco_venda_estimado = $13,
       custodia_status = 'pendente', custodia_motivo = NULL, custodia_em = NULL,
       aprovacao_status = 'pendente', aprovacao_motivo = NULL, aprovacao_em = NULL, exige_garantia = true, publicado_em = NULL
     WHERE id = $14
     RETURNING *`,
    [String(nome).trim(), c.grao, c.variedade, c.tipo, c.plantio_ate, c.colheita_prevista, area, safra,
     cotaValorInicial, c.cotas, retorno, c.unidade, c.precoVenda, plot.id]
  );
  await pool.query("DELETE FROM plot_validations WHERE plot_id = $1", [plot.id]);
  const { rows: w } = await pool.query("SELECT * FROM warehouses WHERE id = $1", [rows[0].warehouse_id]);
  await notifyWarehouseIndication(w[0], rows[0], owned.farm.name);
  await notifyAdminsNewPlot(rows[0], owned.farm.name, true);

  res.json({ plot: rows[0], pendencias: pendencias(rows[0]) });
}));

// fazenda indica (ou troca) o armazém garantidor — só enquanto a custódia
// não foi aceita; depois de aceita, o garantidor não muda
router.patch("/:id/warehouse", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { warehouse_id } = req.body || {};
  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (plot.custodia_status === "aceita") {
    return res.status(409).json({ error: "O armazém já aceitou a custódia deste talhão. Para trocar, fale com a administração." });
  }
  if (["pago", "arquivado"].includes(plot.status)) return res.status(409).json({ error: "Este talhão já foi encerrado." });
  const wh = await getApprovedWarehouse(warehouse_id);
  if (wh.error || !wh.warehouse) return res.status(400).json({ error: wh.error || "Escolha um armazém." });

  const { rows } = await pool.query(
    "UPDATE plots SET warehouse_id = $1, custodia_status = 'pendente', custodia_motivo = NULL, custodia_em = NULL WHERE id = $2 RETURNING *",
    [wh.warehouse.id, plot.id]
  );
  await notifyWarehouseIndication(wh.warehouse, rows[0], owned.farm.name);
  res.json({ plot: { ...rows[0], warehouse_name: wh.warehouse.name } });
}));

// edita informações de um talhão já colhido/pago ou arquivado, sem
// reabri-lo para investimento — útil para corrigir nome, área, safra
// ou a previsão de retorno exibida no histórico, sem mexer nas cotas
// já vendidas nem no valor que os investidores já receberam
router.patch("/:id", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { nome, grao, area_ha, safra, previsao_retorno } = req.body || {};
  const variedade = req.body?.variedade != null ? String(req.body.variedade).trim().slice(0, 80) : undefined;

  const existing = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = existing.rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  if (!["pago", "arquivado"].includes(plot.status)) {
    return res.status(409).json({ error: "Só é possível editar um talhão já colhido/pago ou arquivado. Talhões em captação usam a atualização de safra." });
  }

  if (!nome || !grao || !area_ha || !safra) {
    return res.status(400).json({ error: "Preencha nome, cultura, área e safra." });
  }

  const area = Number(area_ha);
  const retorno = previsao_retorno != null ? Number(previsao_retorno) : plot.previsao_retorno;
  if (Number.isNaN(area) || area <= 0 || Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  const { rows } = await pool.query(
    `UPDATE plots SET nome = $1, grao = $2, area_ha = $3, safra = $4, previsao_retorno = $5, variedade = COALESCE($6, variedade) WHERE id = $7 RETURNING *`,
    [nome, grao, area, safra, retorno, variedade, plot.id]
  );

  res.json({ plot: rows[0] });
}));

module.exports = router;
