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
const { despesaPrevista, parteInvestidores } = require("../storageFees");
const { PERFORMANCE_MAX } = require("../profitSplit");

function parsePerformance(body) {
  const v = body.perf_excedente_pct === undefined || body.perf_excedente_pct === "" ? 0 : Number(body.perf_excedente_pct);
  if (Number.isNaN(v) || v < 0 || v > PERFORMANCE_MAX) {
    return { error: `A participação da fazenda no excedente deve ficar entre 0% e ${PERFORMANCE_MAX}%.` };
  }
  return { pct: Math.round(v * 10) / 10 };
}

// quem paga a armazenagem e por quanto tempo a produção deve ficar guardada
function parseArmazenagem(body) {
  const pagador = ["fazenda", "dividido"].includes(body.arm_pagador) ? body.arm_pagador : "investidores";
  let investidorPct = null;
  if (pagador === "dividido") {
    investidorPct = Number(body.arm_investidor_pct);
    if (Number.isNaN(investidorPct) || investidorPct <= 0 || investidorPct >= 100) {
      return { error: "Na divisão da armazenagem, a parte dos investidores deve ficar entre 1% e 99%." };
    }
    investidorPct = Math.round(investidorPct * 10) / 10;
  }
  const q = body.arm_quinzenas_previstas === undefined || body.arm_quinzenas_previstas === "" ? 2 : Math.round(Number(body.arm_quinzenas_previstas));
  if (Number.isNaN(q) || q < 1 || q > 24) return { error: "Período de armazenagem previsto deve ficar entre 1 e 24 quinzenas." };
  return { pagador, quinzenas: q, investidorPct };
}

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

async function notifyAdminsNewPlot(plot, farmName, reinicio = false, extra = "") {
  const { rows } = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'fundo') AND deleted_at IS NULL");
  await safeNotify(rows.map((r) => r.id), {
    senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "talhao_para_aprovar",
    title: extra ? `Regra alterada, revisar: ${plot.nome}` : reinicio ? `Novo ciclo para aprovar: ${plot.nome}` : `Talhão para aprovar: ${plot.nome}`,
    body: extra
      ? `${farmName} alterou ${plot.nome}. ${extra} Revise em Administração › Aprovar talhões.`
      : `${farmName} cadastrou ${plot.grao}${plot.variedade ? ` (${plot.variedade})` : ""}, safra ${plot.safra}${Number(plot.perf_excedente_pct) > 0 ? `, com ${plot.perf_excedente_pct}% do excedente para a fazenda` : ""}. Revise em Administração › Aprovar talhões.`,
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

// A vitrine é a página mais acessada e muda pouco: guarda a resposta por 10 s.
// A disponibilidade de sacas é sempre conferida de novo na hora da compra.
const cacheVitrine = new Map();
const VITRINE_MS = 10_000;

router.get("/", asyncHandler(async (req, res, next) => {
  const chave = String(req.query.grao || "");
  const c = cacheVitrine.get(chave);
  // guarda o JSON já serializado: a vitrine pode ter centenas de talhões
  if (c && Date.now() - c.t < VITRINE_MS) return res.type("application/json").send(c.texto);
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) return json(body);
    const texto = JSON.stringify(body);
    cacheVitrine.set(chave, { t: Date.now(), texto });
    return res.type("application/json").send(texto);
  };
  return listarVitrine(req, res, next);
}));

const listarVitrine = asyncHandler(async (req, res) => {
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
  res.json({ plots: rows.map(require("../piso").comPrecoDoDia), app_commission_pct: appCommissionPct });
});

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
  res.json({ plots: rows.map(require("../piso").comPrecoDoDia), app_commission_pct: appCommissionPct });
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

  // despesa de armazenagem prevista por unidade (usa a tabela do talhão ou, antes
  // do aceite, a tabela atual do armazém indicado)
  let armazenagem = null;
  if (armazem) {
    const ref = plot.arm_tarifa_recepcao != null ? plot : {
      ...plot,
      arm_tarifa_recepcao: armazem.tarifa_recepcao, arm_tarifa_quinzena: armazem.tarifa_quinzena,
      arm_carencia: armazem.carencia_quinzenas, arm_quebra_pct: armazem.quebra_quinzena_pct,
    };
    const precoProjetado = plot.preco_venda_estimado * (1 + plot.previsao_retorno / 100);
    const d = despesaPrevista(ref, { unidades: 1, precoVenda: precoProjetado });
    armazenagem = { ...d, pagador: plot.arm_pagador, parte_investidores: parteInvestidores(plot), quinzenas_previstas: plot.arm_quinzenas_previstas, entrada_em: plot.arm_entrada_em };
  }
  res.json({
    plot: require("../piso").comPrecoDoDia(plot), historico: historico.rows, app_commission_pct: appCommissionPct, fotos: fotos.rows, armazem, validacoes,
    publico: isPublic(plot), pendencias: pendencias(plot), armazenagem,
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
  const { farm_id, nome, area_ha, safra, warehouse_id } = req.body || {};
  // talhões novos usam o produto com piso; 'meta' só se pedido explicitamente
  const custoHa = Number(req.body?.custo_ha), prodHa = Number(req.body?.produtividade_ha);
  // v3: com custo por hectare e produtividade, o talhão nasce no modelo "Custo + Lucro"
  const modelo = req.body?.modelo === "meta" ? "meta" : req.body?.modelo === "piso" ? "piso" : custoHa > 0 && prodHa > 0 ? "custo" : "piso";
  const previsao_retorno = modelo === "meta" ? req.body?.previsao_retorno : 0;

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
  // no produto com piso a armazenagem é sempre da fazenda e não há performance
  const arm = parseArmazenagem(modelo !== "meta" ? { ...req.body, arm_pagador: "fazenda" } : req.body);
  if (arm.error) return res.status(400).json({ error: arm.error });
  const perf = modelo !== "meta" ? { pct: 0 } : parsePerformance(req.body);
  if (perf.error) return res.status(400).json({ error: perf.error });
  const { prazoDias, pisoPct, minimoPct } = require("../piso");
  const dias = modelo !== "meta" ? prazoDias(c.colheita_prevista) : null;
  const piso = modelo === "piso" ? pisoPct(dias) : modelo === "custo" ? minimoPct(dias) : null;
  const custoSaca = modelo === "custo" ? Math.round((custoHa / prodHa) * 100) / 100 : null;

  // limites do talhão (tamanho livre: a fazenda declara a área e a cultura)
  const { LIMITES, indiceDe } = require("../culturas");
  if (modelo === "custo") {
    const producao = area * prodHa;
    if (c.cotas > producao * LIMITES.sacas_pct_producao + 0.5) {
      return res.status(400).json({ error: `Este talhão pode oferecer até ${Math.floor(producao * LIMITES.sacas_pct_producao).toLocaleString("pt-BR")} ${c.unidade}s (80% da produção esperada de ${Math.round(producao).toLocaleString("pt-BR")}). O restante fica como margem de segurança para quebra de safra.` });
    }
    const valor = c.cotas * custoSaca;
    if (valor > LIMITES.teto_talhao) {
      return res.status(400).json({ error: `O valor do talhão (R$ ${Math.round(valor).toLocaleString("pt-BR")}) passa do teto de R$ 2,5 mi por talhão. Divida em talhões menores ou ofereça menos ${c.unidade}s.` });
    }
    const { rows: fz } = await pool.query("SELECT tipo_pessoa FROM farms WHERE id = $1", [farm_id]);
    if ((fz[0]?.tipo_pessoa || "pf") === "pf") {
      const { rows: soma } = await pool.query(
        "SELECT COALESCE(SUM(cotas_totais * custo_saca), 0)::float8 AS total FROM plots WHERE farm_id = $1 AND safra = $2 AND modelo = 'custo' AND status <> 'cancelado'",
        [farm_id, safra]);
      if (soma[0].total + valor > LIMITES.teto_pf_safra) {
        return res.status(400).json({ error: `Produtor pessoa física pode captar até R$ 2,5 mi por safra. Nesta safra a fazenda já tem R$ ${Math.round(soma[0].total).toLocaleString("pt-BR")} em talhões.` });
      }
    }
  }
  const seguroCob = Number(req.body?.seguro_cobertura_pct) || null;
  if (seguroCob != null && (seguroCob < LIMITES.cobertura_min_seguro || seguroCob > 100)) {
    return res.status(400).json({ error: "A cobertura do seguro agrícola deve ficar entre 65% e 100% da produtividade esperada." });
  }
  // apólice anexada: obrigatória quando o seguro é informado
  const arquivo = req.body?.seguro_arquivo;
  if ((req.body?.seguro_seguradora || req.body?.seguro_apolice) && !arquivo) {
    return res.status(400).json({ error: "Anexe a apólice (PDF ou foto) para o fundo conferir o seguro." });
  }
  if (arquivo && (typeof arquivo !== "string" || !/^data:(application\/pdf|image\/[a-z+.-]+);base64,/.test(arquivo))) {
    return res.status(400).json({ error: "A apólice precisa ser um PDF ou uma imagem." });
  }
  if (arquivo && arquivo.length > 2_100_000) {
    return res.status(400).json({ error: "Apólice muito grande: envie um arquivo de até 1,5 MB." });
  }
  const contrato = {
    indice: String(req.body?.indice_referencia || indiceDe(c.grao)).slice(0, 120),
    base: Number(req.body?.base_regional) || 0,
    seguradora: req.body?.seguro_seguradora ? String(req.body.seguro_seguradora).slice(0, 120) : null,
    apolice: req.body?.seguro_apolice ? String(req.body.seguro_apolice).slice(0, 60) : null,
    cobertura: seguroCob,
  };

  // preço inicial (fase 0) — o mais barato, sobe conforme a fase avança
  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = c.precoVenda * multiplicadorFase0;

  const { rows } = await pool.query(
    `INSERT INTO plots (farm_id, nome, grao, variedade, tipo_producao, plantio_ate, colheita_prevista, area_ha, safra,
                        cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno, unidade, preco_venda_estimado,
                        warehouse_id, custodia_status, aprovacao_status, exige_garantia, arm_pagador, arm_quinzenas_previstas, perf_excedente_pct, arm_investidor_pct,
                        modelo, piso_pct, piso_dias, custo_ha, produtividade_ha, custo_saca,
                        indice_referencia, base_regional, seguro_seguradora, seguro_apolice, seguro_cobertura_pct, seguro_anexado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, 'pendente', 'pendente', true, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25,
             $26, $27, $28, $29, $30, $31) RETURNING *`,
    [farm_id, String(nome).trim(), c.grao, c.variedade, c.tipo, c.plantio_ate, c.colheita_prevista, area, safra,
     modelo === "custo" ? custoSaca : cotaValorInicial, c.cotas, modelo === "meta" ? retorno : piso, c.unidade, c.precoVenda, wh.warehouse.id, arm.pagador, arm.quinzenas, perf.pct, arm.investidorPct,
     modelo, piso, dias, modelo === "custo" ? custoHa : null, modelo === "custo" ? prodHa : null, custoSaca,
     contrato.indice, contrato.base, contrato.seguradora, contrato.apolice, contrato.cobertura, !!arquivo]
  );
  const plot = rows[0];
  if (arquivo) {
    await pool.query("INSERT INTO plot_documents (plot_id, tipo, nome, conteudo, enviado_por) VALUES ($1, 'apolice', $2, $3, $4)",
      [plot.id, String(req.body?.seguro_arquivo_nome || "apolice").slice(0, 120), arquivo, req.user.id]);
  }
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
    // no produto com piso o preço não muda por fase: sobe com o tempo (preço do dia)
    const novoCotaValor = plot.modelo === "piso" ? plot.cota_valor : plot.preco_venda_estimado * multiplicador;

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

// apólice de seguro: só a fazenda dona, o armazém do talhão, o fundo e a administração abrem
router.get("/:id/apolice", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.id, f.owner_user_id, w.owner_user_id AS armazem_user FROM plots p JOIN farms f ON f.id = p.farm_id
     LEFT JOIN warehouses w ON w.id = p.warehouse_id WHERE p.id = $1`, [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).json({ error: "Talhão não encontrado." });
  const pode = ["admin", "fundo"].includes(req.user.role) || p.owner_user_id === req.user.id || p.armazem_user === req.user.id;
  if (!pode) return res.status(403).json({ error: "Sem permissão para ver a apólice." });
  const { rows: d } = await pool.query("SELECT nome, conteudo, created_at FROM plot_documents WHERE plot_id = $1 AND tipo = 'apolice' ORDER BY id DESC LIMIT 1", [p.id]);
  if (!d[0]) return res.status(404).json({ error: "Nenhuma apólice anexada." });
  res.json(d[0]);
}));

// QUEBRA DE SAFRA: com sinistro reconhecido pela seguradora, o fundo pode
// prorrogar o pagamento para a safra seguinte; o mínimo do investidor continua correndo.
router.patch("/:id/prorrogar", requireAuth, requireRole("admin", "fundo"), asyncHandler(async (req, res) => {
  const { nova_colheita, motivo } = req.body || {};
  if (!nova_colheita || !/^\d{4}-\d{2}-\d{2}$/.test(nova_colheita)) return res.status(400).json({ error: "Informe a nova data prevista de colheita (AAAA-MM-DD)." });
  if (!motivo || String(motivo).trim().length < 10) return res.status(400).json({ error: "Descreva o sinistro reconhecido pela seguradora (nº do aviso, laudo)." });
  const { rows } = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (plot.status === "pago") return res.status(409).json({ error: "Talhão já pago." });
  const anterior = new Date(plot.colheita_prevista);
  const nova = new Date(nova_colheita + "T12:00:00Z");
  const delta = Math.round((nova - anterior) / 86400000);
  if (delta <= 0) return res.status(400).json({ error: "A nova data precisa ser depois da colheita prevista atual." });
  const { minimoPct, pisoPct } = require("../piso");
  const dias = (Number(plot.piso_dias) || 0) + delta;
  const minimo = plot.modelo === "custo" ? minimoPct(dias) : plot.modelo === "piso" ? pisoPct(dias) : plot.piso_pct;
  await pool.query(
    `UPDATE plots SET colheita_prevista = $1, piso_dias = $2, piso_pct = $3, previsao_retorno = COALESCE($3, previsao_retorno),
       prorrogado_em = now(), prorrogacao_motivo = $4 WHERE id = $5`,
    [nova_colheita, dias, minimo, String(motivo).trim().slice(0, 500), plot.id]);
  await pool.query("INSERT INTO progress_updates (plot_id, fase_atual, progresso, nota) VALUES ($1, $2, $3, $4)",
    [plot.id, plot.fase_atual, plot.progresso, `Pagamento prorrogado para depois de ${nova.toLocaleDateString("pt-BR")} por sinistro reconhecido: ${String(motivo).trim().slice(0, 200)}. O mínimo do investidor continua correndo (${minimo}% no novo prazo).`]);
  try {
    const { rows: invs } = await pool.query("SELECT DISTINCT user_id FROM investments WHERE plot_id = $1 AND status = 'ativo'", [plot.id]);
    const { notifyUsers } = require("../notify");
    await notifyUsers(pool, invs.map((i) => i.user_id), { senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "prorrogacao",
      title: `Pagamento de ${plot.nome} prorrogado`, body: `A lavoura teve sinistro reconhecido pela seguradora. O pagamento passa para a próxima janela, e o seu mínimo continua rendendo: agora ${minimo}% no prazo total.` });
  } catch (e) { console.error("[aviso] prorrogação:", e.message); }
  res.json({ ok: true, colheita_prevista: nova_colheita, piso_dias: dias, piso_pct: minimo });
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
    const { rows: admins } = await pool.query("SELECT id FROM users WHERE role IN ('admin', 'fundo') AND deleted_at IS NULL");
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
  const { nome, area_ha, safra } = req.body || {};
  // todo novo ciclo já nasce no produto com piso
  const previsao_retorno = 0;

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
  const arm = parseArmazenagem({ ...req.body, arm_pagador: "fazenda" });
  if (arm.error) return res.status(400).json({ error: arm.error });
  const perf = { pct: 0 };
  const { prazoDias, pisoPct } = require("../piso");
  const dias = prazoDias(c.colheita_prevista);
  const piso = pisoPct(dias);

  const multiplicadorFase0 = await getFaseMultiplier(0);
  const cotaValorInicial = c.precoVenda * multiplicadorFase0;

  // novo ciclo volta a exigir aprovação da administração e aceite do armazém
  const { rows } = await pool.query(
    `UPDATE plots SET
       nome = $1, grao = $2, variedade = $3, tipo_producao = $4, plantio_ate = $5, colheita_prevista = $6,
       area_ha = $7, safra = $8, cota_valor = $9, cotas_totais = $10, cotas_disponiveis = $10, previsao_retorno = $11,
       retorno_final = NULL, fase_atual = 0, progresso = 0, status = 'captacao', unidade = $12, preco_venda_estimado = $13,
       custodia_status = 'pendente', custodia_motivo = NULL, custodia_em = NULL,
       aprovacao_status = 'pendente', aprovacao_motivo = NULL, aprovacao_em = NULL, exige_garantia = true, publicado_em = NULL,
       arm_pagador = $15, arm_quinzenas_previstas = $16, arm_entrada_em = NULL, perf_excedente_pct = $17, arm_investidor_pct = $18,
       arm_tarifa_recepcao = NULL, arm_tarifa_quinzena = NULL, arm_carencia = NULL, arm_quebra_pct = NULL,
       modelo = 'piso', piso_pct = $19, piso_dias = $20
     WHERE id = $14
     RETURNING *`,
    [String(nome).trim(), c.grao, c.variedade, c.tipo, c.plantio_ate, c.colheita_prevista, area, safra,
     cotaValorInicial, c.cotas, piso, c.unidade, c.precoVenda, plot.id, arm.pagador, arm.quinzenas, perf.pct, arm.investidorPct, piso, dias]
  );
  await pool.query("DELETE FROM plot_validations WHERE plot_id = $1", [plot.id]);
  const { rows: w } = await pool.query("SELECT * FROM warehouses WHERE id = $1", [rows[0].warehouse_id]);
  await notifyWarehouseIndication(w[0], rows[0], owned.farm.name);
  await notifyAdminsNewPlot(rows[0], owned.farm.name, true);

  res.json({ plot: rows[0], pendencias: pendencias(rows[0]) });
}));

// fazenda ajusta quem paga a armazenagem e o período previsto
// (só antes de ir ao ar: depois disso faz parte do combinado com os investidores)
router.patch("/:id/armazenagem", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM plots WHERE id = $1", [req.params.id]);
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (plot.publicado_em && plot.cotas_disponiveis < plot.cotas_totais) {
    return res.status(409).json({ error: "O talhão já tem investidores: as condições de armazenagem não podem mudar." });
  }
  const arm = parseArmazenagem(req.body || {});
  if (arm.error) return res.status(400).json({ error: arm.error });
  const { rows: up } = await pool.query(
    "UPDATE plots SET arm_pagador = $1, arm_quinzenas_previstas = $2, arm_investidor_pct = $3 WHERE id = $4 RETURNING *",
    [arm.pagador, arm.quinzenas, arm.investidorPct, plot.id]
  );
  res.json({ plot: up[0] });
}));

// fazenda muda a participação no excedente. Só antes de ter investidores,
// e a mudança volta para validação da administração (o talhão sai do ar até lá)
router.patch("/:id/performance", requireAuth, requireRole("fazenda", "admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT p.*, f.name AS farm_name FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1", [req.params.id]);
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  const owned = await getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (plot.cotas_disponiveis < plot.cotas_totais) {
    return res.status(409).json({ error: "O talhão já tem investidores: a regra de divisão do lucro não pode mudar." });
  }
  const perf = parsePerformance(req.body || {});
  if (perf.error) return res.status(400).json({ error: perf.error });
  if (Number(plot.perf_excedente_pct) === perf.pct) return res.json({ plot });

  const revalidar = req.user.role !== "admin" && plot.aprovacao_status === "aprovado";
  const { rows: up } = await pool.query(
    `UPDATE plots SET perf_excedente_pct = $1,
       aprovacao_status = CASE WHEN $2 THEN 'pendente' ELSE aprovacao_status END,
       aprovacao_em = CASE WHEN $2 THEN NULL ELSE aprovacao_em END,
       publicado_em = CASE WHEN $2 THEN NULL ELSE publicado_em END
     WHERE id = $3 RETURNING *`,
    [perf.pct, revalidar, plot.id]
  );
  if (revalidar || plot.aprovacao_status === "pendente") await notifyAdminsNewPlot(up[0], plot.farm_name, false, `Nova regra de performance: ${perf.pct}% do excedente para a fazenda.`);
  res.json({ plot: up[0], revalidar });
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
