const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { notifyUsers, getPlotInvestorIds } = require("../notify");
const { validatePhotoData } = require("../validators");
const { ETAPAS, ETAPA_LABEL, ETAPA_ARTIGO, ETAPA_CONFIRMADA, FASE_MINIMA, getValidations } = require("../custody");
const { fmtNumber } = require("../format");

const router = express.Router();

// aviso não pode desfazer uma decisão já gravada: falha vira só registro no log
async function safeNotify(ids, payload) {
  try { await notifyUsers(pool, ids, payload); } catch (err) { console.error("[aviso não enviado]", err.message); }
}

const UNIT = { saca: ["saca", "sacas"], fardo: ["fardo", "fardos"], arroba: ["arroba", "arrobas"] };
const unidade = (u, n) => (UNIT[u] || ["unidade", "unidades"])[n === 1 ? 0 : 1];

async function myWarehouse(req) {
  if (!req.user.warehouse_id) return null;
  const { rows } = await pool.query("SELECT * FROM warehouses WHERE id = $1", [req.user.warehouse_id]);
  return rows[0] || null;
}

// ---------- fazenda/admin: armazéns credenciados para escolher ----------
router.get("/approved", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, cnpj, location, capacidade_t FROM warehouses WHERE status = 'aprovado' ORDER BY name"
  );
  res.json({ warehouses: rows });
}));

// ---------- armazém: painel ----------
router.get("/mine", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse) return res.status(404).json({ error: "Armazém não encontrado para esta conta." });

  const { rows: plots } = await pool.query(
    `SELECT p.id, p.nome, p.grao, p.safra, p.area_ha, p.unidade, p.fase_atual, p.progresso, p.status,
            p.cotas_totais, p.cotas_disponiveis, p.custodia_status, p.custodia_motivo, p.custodia_em, p.created_at,
            f.id AS farm_id, f.name AS farm_name, f.location AS farm_location, f.owner_user_id AS farm_user_id
     FROM plots p JOIN farms f ON f.id = p.farm_id
     WHERE p.warehouse_id = $1 AND p.status <> 'arquivado'
     ORDER BY (p.custodia_status = 'pendente') DESC, p.created_at DESC`,
    [warehouse.id]
  );
  for (const p of plots) p.validacoes = await getValidations(pool, p.id);
  res.json({ warehouse, plots });
}));

router.patch("/mine", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse) return res.status(404).json({ error: "Armazém não encontrado." });
  const { name, location, capacidade_t, descricao } = req.body || {};
  if (!name || !String(name).trim() || !location) return res.status(400).json({ error: "Informe nome e localização do armazém." });
  const cap = capacidade_t === "" || capacidade_t == null ? null : Number(capacidade_t);
  if (cap !== null && (Number.isNaN(cap) || cap < 0)) return res.status(400).json({ error: "Capacidade inválida." });
  const { rows } = await pool.query(
    "UPDATE warehouses SET name = $1, location = $2, capacidade_t = $3, descricao = $4 WHERE id = $5 RETURNING *",
    [String(name).trim(), location, cap, descricao ? String(descricao).slice(0, 2000) : null, warehouse.id]
  );
  res.json({ warehouse: rows[0] });
}));

// ---------- armazém: aceitar ou recusar a custódia de um talhão ----------
router.post("/plots/:plotId/custody", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse || warehouse.status !== "aprovado") {
    return res.status(403).json({ error: "Seu armazém precisa estar credenciado pela administração para assumir custódias." });
  }
  const { decisao, motivo } = req.body || {};
  if (!["aceitar", "recusar"].includes(decisao)) return res.status(400).json({ error: "Decisão inválida." });
  if (decisao === "recusar" && (!motivo || String(motivo).trim().length < 5)) {
    return res.status(400).json({ error: "Explique o motivo da recusa para a fazenda." });
  }

  const { rows } = await pool.query(
    "SELECT p.*, f.owner_user_id, f.name AS farm_name FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1 AND p.warehouse_id = $2",
    [req.params.plotId, warehouse.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado entre as indicações do seu armazém." });
  if (plot.custodia_status !== "pendente") return res.status(409).json({ error: "Esta indicação já foi respondida." });

  const status = decisao === "aceitar" ? "aceita" : "recusada";
  const { rows: updated } = await pool.query(
    "UPDATE plots SET custodia_status = $1, custodia_motivo = $2, custodia_em = now() WHERE id = $3 RETURNING id, custodia_status, custodia_motivo, custodia_em",
    [status, status === "recusada" ? String(motivo).trim() : null, plot.id]
  );

  await safeNotify([plot.owner_user_id], {
    senderRole: "armazem",
    farmId: plot.farm_id,
    plotId: plot.id,
    type: "custodia_armazem",
    title: status === "aceita" ? `${warehouse.name} aceitou a custódia` : `${warehouse.name} recusou a custódia`,
    body: status === "aceita"
      ? `${plot.nome} agora tem garantia do armazém ${warehouse.name}, que vai validar plantio, colheita e armazenagem.`
      : `${warehouse.name} recusou a custódia de ${plot.nome}: ${String(motivo).trim()}. Escolha outro armazém no painel da fazenda.`,
  });
  if (status === "aceita") {
    const investors = await getPlotInvestorIds(pool, plot.id);
    await safeNotify(investors, {
      senderRole: "armazem", farmId: plot.farm_id, plotId: plot.id, type: "custodia_armazem",
      title: `${plot.nome} tem armazém garantidor`,
      body: `${warehouse.name} assumiu a custódia e vai validar cada etapa da safra.`,
    });
  }

  res.json({ plot: updated[0] });
}));

// ---------- armazém: validar uma etapa ----------
router.post("/plots/:plotId/validations", requireAuth, requireRole("armazem"), asyncHandler(async (req, res) => {
  const warehouse = await myWarehouse(req);
  if (!warehouse || warehouse.status !== "aprovado") {
    return res.status(403).json({ error: "Seu armazém precisa estar credenciado para registrar validações." });
  }
  const { etapa, resultado, quantidade, observacao, foto } = req.body || {};
  if (!ETAPAS.includes(etapa)) return res.status(400).json({ error: "Etapa inválida." });
  if (!["confirmado", "divergente"].includes(resultado)) return res.status(400).json({ error: "Resultado inválido." });
  if (resultado === "divergente" && (!observacao || String(observacao).trim().length < 10)) {
    return res.status(400).json({ error: "Descreva a divergência encontrada (mínimo 10 caracteres)." });
  }
  if (foto) {
    const err = validatePhotoData(foto);
    if (err) return res.status(400).json({ error: err });
  }

  const { rows } = await pool.query(
    "SELECT p.*, f.owner_user_id FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1 AND p.warehouse_id = $2",
    [req.params.plotId, warehouse.id]
  );
  const plot = rows[0];
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado entre as custódias do seu armazém." });
  if (plot.custodia_status !== "aceita") return res.status(409).json({ error: "Aceite a custódia antes de validar etapas." });
  if (["pago", "arquivado"].includes(plot.status)) return res.status(409).json({ error: "Este talhão já foi encerrado." });
  if (plot.fase_atual < FASE_MINIMA[etapa]) {
    return res.status(409).json({ error: `A fazenda ainda não registrou a fase de ${etapa === "plantio" ? "plantio" : "colheita"} neste talhão.` });
  }

  let qtd = null;
  if (etapa === "armazenagem" || etapa === "colheita") {
    if (quantidade !== undefined && quantidade !== null && quantidade !== "") {
      qtd = Number(quantidade);
      if (Number.isNaN(qtd) || qtd < 0) return res.status(400).json({ error: "Quantidade inválida." });
    }
    if (etapa === "armazenagem" && qtd === null) {
      return res.status(400).json({ error: `Informe a quantidade armazenada em ${unidade(plot.unidade, 2)}.` });
    }
  }
  if (etapa === "armazenagem") {
    const { rows: col } = await pool.query("SELECT resultado FROM plot_validations WHERE plot_id = $1 AND etapa = 'colheita'", [plot.id]);
    if (!col.length) return res.status(409).json({ error: "Valide a colheita antes de registrar a armazenagem." });
  }

  const { rows: saved } = await pool.query(
    `INSERT INTO plot_validations (plot_id, warehouse_id, etapa, resultado, quantidade, observacao, foto, validated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (plot_id, etapa) DO UPDATE SET resultado = $4, quantidade = $5, observacao = $6, foto = $7, validated_by = $8, created_at = now()
     RETURNING *`,
    [plot.id, warehouse.id, etapa, resultado, qtd, observacao ? String(observacao).trim().slice(0, 2000) : null, foto || null, req.user.id]
  );

  const vendidas = plot.cotas_totais - plot.cotas_disponiveis;
  const qtdTexto = qtd !== null ? ` ${fmtNumber(qtd)} ${unidade(plot.unidade, qtd)}` : "";
  const ok = resultado === "confirmado";
  const title = ok ? `${ETAPA_CONFIRMADA[etapa]} pelo armazém` : `Divergência: ${ETAPA_LABEL[etapa].toLowerCase()} de ${plot.nome}`;
  let body = ok
    ? `${warehouse.name} confirmou ${ETAPA_ARTIGO[etapa]} de ${plot.nome}.${etapa !== "plantio" && qtd !== null ? ` Quantidade:${qtdTexto}.` : ""}`
    : `${warehouse.name} registrou divergência n${ETAPA_ARTIGO[etapa]} de ${plot.nome}: ${String(observacao).trim()}`;
  if (etapa === "armazenagem" && qtd !== null && qtd < vendidas) {
    body += ` Atenção: abaixo das ${fmtNumber(vendidas)} ${unidade(plot.unidade, vendidas)} vendidas aos investidores.`;
  }
  const investors = await getPlotInvestorIds(pool, plot.id);
  const { rows: admins } = await pool.query("SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL");
  await safeNotify([plot.owner_user_id, ...investors, ...(ok ? [] : admins.map((a) => a.id))], {
    senderRole: "armazem", farmId: plot.farm_id, plotId: plot.id, type: "validacao_armazem", title, body,
  });

  res.status(201).json({ validation: saved[0] });
}));

// ---------- administração ----------
router.get("/", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT w.*, u.name AS responsavel, u.email AS responsavel_email,
            (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita') AS custodias
     FROM warehouses w LEFT JOIN users u ON u.id = w.owner_user_id
     ORDER BY (w.status = 'pendente') DESC, w.created_at DESC`
  );
  res.json({ warehouses: rows });
}));

router.patch("/:id/status", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["aprovado", "suspenso", "pendente"].includes(status)) return res.status(400).json({ error: "Status inválido." });
  const { rows } = await pool.query("UPDATE warehouses SET status = $1 WHERE id = $2 RETURNING *", [status, req.params.id]);
  const w = rows[0];
  if (!w) return res.status(404).json({ error: "Armazém não encontrado." });
  if (w.owner_user_id) {
    await safeNotify([w.owner_user_id], {
      senderRole: "admin", type: "status_armazem",
      title: status === "aprovado" ? "Armazém credenciado" : status === "suspenso" ? "Armazém suspenso" : "Credenciamento em análise",
      body: status === "aprovado"
        ? "Seu armazém foi credenciado. As fazendas já podem indicá-lo como garantidor dos talhões."
        : status === "suspenso"
          ? "Seu armazém foi suspenso pela administração e não pode assumir novas custódias."
          : "Seu credenciamento voltou para análise.",
    });
  }
  res.json({ warehouse: w });
}));

module.exports = router;
