const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const FASES = ["Preparo do solo", "Plantio", "Crescimento", "Colheita"];
const APP_COMMISSION_PCT = Number(process.env.APP_COMMISSION_PCT || 5);

function getFarmOwned(farmId, user) {
  const farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(farmId);
  if (!farm) return { error: "Fazenda não encontrada." };
  const isOwner = user.role === "fazenda" && user.farm_id === farm.id;
  if (!isOwner && user.role !== "admin") return { error: "Você não administra esta fazenda." };
  return { farm };
}

// vitrine pública: apenas talhões de fazendas aprovadas
router.get("/", (req, res) => {
  const { grao } = req.query;
  let sql = `
    SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct
    FROM plots p
    JOIN farms f ON f.id = p.farm_id
    WHERE f.status = 'aprovada'
  `;
  const params = [];
  if (grao) {
    sql += " AND p.grao = ?";
    params.push(grao);
  }
  sql += " ORDER BY p.created_at DESC";
  const rows = db.prepare(sql).all(...params);
  res.json({ plots: rows, app_commission_pct: APP_COMMISSION_PCT });
});

router.get("/:id", (req, res) => {
  const plot = db
    .prepare(
      `SELECT p.*, f.name as farm_name, f.location as farm_location, f.commission_pct, f.status as farm_status
       FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const historico = db
    .prepare("SELECT * FROM progress_updates WHERE plot_id = ? ORDER BY created_at")
    .all(req.params.id);

  res.json({ plot, historico, app_commission_pct: APP_COMMISSION_PCT });
});

// fazenda cria um novo talhão (só se a fazenda já estiver aprovada)
router.post("/", requireAuth, requireRole("fazenda", "admin"), (req, res) => {
  const { farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, previsao_retorno } = req.body || {};

  if (!farm_id || !nome || !grao || !area_ha || !safra || !cota_valor || !cotas_totais || previsao_retorno == null) {
    return res.status(400).json({ error: "Preencha todos os campos do talhão." });
  }

  const owned = getFarmOwned(farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  if (owned.farm.status !== "aprovada") {
    return res.status(403).json({ error: "Sua fazenda ainda não foi aprovada pela administração do Talhão." });
  }

  const cotas = Number(cotas_totais);
  const valor = Number(cota_valor);
  const area = Number(area_ha);
  const retorno = Number(previsao_retorno);

  if ([cotas, valor, area, retorno].some((n) => Number.isNaN(n)) || cotas <= 0 || valor <= 0 || area <= 0) {
    return res.status(400).json({ error: "Valores numéricos inválidos." });
  }

  const info = db
    .prepare(
      `INSERT INTO plots (farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(farm_id, nome, grao, area, safra, valor, cotas, cotas, retorno);

  const plot = db.prepare("SELECT * FROM plots WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ plot });
});

// fazenda atualiza o andamento da safra (fase + progresso)
router.patch("/:id/progress", requireAuth, requireRole("fazenda", "admin"), (req, res) => {
  const { fase_atual, progresso, nota } = req.body || {};
  const plot = db.prepare("SELECT * FROM plots WHERE id = ?").get(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });

  const owned = getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });

  const fase = Number(fase_atual);
  const prog = Number(progresso);
  if (Number.isNaN(fase) || fase < 0 || fase >= FASES.length) {
    return res.status(400).json({ error: "Fase inválida." });
  }
  if (Number.isNaN(prog) || prog < 0 || prog > 100) {
    return res.status(400).json({ error: "Progresso deve ser um número entre 0 e 100." });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE plots SET fase_atual = ?, progresso = ?, status = ? WHERE id = ?").run(
      fase,
      prog,
      plot.status === "captacao" ? "em_andamento" : plot.status,
      plot.id
    );
    db.prepare(
      "INSERT INTO progress_updates (plot_id, fase_atual, progresso, nota) VALUES (?, ?, ?, ?)"
    ).run(plot.id, fase, prog, nota || null);
  });
  tx();

  res.json({ plot: db.prepare("SELECT * FROM plots WHERE id = ?").get(plot.id) });
});

// fazenda (ou admin) finaliza a colheita: informa o retorno final e dispara o pagamento
// proporcional de cada investidor, descontando a comissão da fazenda e da plataforma.
router.post("/:id/finalize", requireAuth, requireRole("fazenda", "admin"), (req, res) => {
  const { retorno_final } = req.body || {};
  const retorno = Number(retorno_final);
  if (Number.isNaN(retorno)) {
    return res.status(400).json({ error: "Informe o retorno final da safra (%)." });
  }

  const plot = db.prepare("SELECT * FROM plots WHERE id = ?").get(req.params.id);
  if (!plot) return res.status(404).json({ error: "Talhão não encontrado." });
  if (plot.status === "pago") {
    return res.status(409).json({ error: "Este talhão já foi pago aos investidores." });
  }

  const owned = getFarmOwned(plot.farm_id, req.user);
  if (owned.error) return res.status(403).json({ error: owned.error });
  const farm = owned.farm;

  const investments = db
    .prepare("SELECT * FROM investments WHERE plot_id = ? AND status = 'ativo'")
    .all(plot.id);

  const tx = db.transaction(() => {
    for (const inv of investments) {
      const valorBruto = inv.valor_investido * (1 + retorno / 100);
      const lucroBruto = valorBruto - inv.valor_investido;
      const comissaoFazenda = Math.max(0, lucroBruto) * (farm.commission_pct / 100);
      const comissaoApp = Math.max(0, lucroBruto) * (APP_COMMISSION_PCT / 100);
      const valorLiquido = valorBruto - comissaoFazenda - comissaoApp;

      db.prepare(
        `INSERT INTO payouts (investment_id, valor_bruto, comissao_fazenda, comissao_app, valor_liquido)
         VALUES (?, ?, ?, ?, ?)`
      ).run(inv.id, valorBruto, comissaoFazenda, comissaoApp, valorLiquido);

      db.prepare("UPDATE investments SET status = 'pago' WHERE id = ?").run(inv.id);
    }

    db.prepare("UPDATE plots SET status = 'pago', retorno_final = ?, fase_atual = 3, progresso = 100 WHERE id = ?").run(
      retorno,
      plot.id
    );
  });
  tx();

  res.json({
    ok: true,
    investidoresPagos: investments.length,
    plot: db.prepare("SELECT * FROM plots WHERE id = ?").get(plot.id),
  });
});

module.exports = router;
