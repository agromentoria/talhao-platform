// Gestão de usuários da administração: investidores, fazendas, armazéns e
// fundo, com busca, filtros, ordenação por volume (rankings), resumo,
// ficha detalhada, suspensão de acesso e exportação CSV.
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole, limparCacheSuspensao } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { WAREHOUSE_STARS_SQL } = require("../custody");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

const FARM_STARS_SQL = `ROUND((COALESCE((SELECT SUM(c.pontos) FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key WHERE fc.farm_id = f.id), 0)::numeric
  / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5), 1)::float8`;

// Cada tipo: consulta base (uma linha por usuário/entidade com as métricas),
// colunas de busca, filtro de situação e chaves de ordenação.
const TIPOS = {
  investidores: {
    // agregações feitas uma vez por tabela (antes: uma subconsulta por usuário)
    base: `
      WITH inv AS (
        SELECT i.user_id,
               SUM(i.valor_investido) FILTER (WHERE i.status IN ('ativo','pago')) AS investido,
               SUM(i.valor_investido) FILTER (WHERE i.status = 'ativo') AS em_andamento,
               SUM(i.valor_investido) FILTER (WHERE i.status = 'pago') AS investido_pago,
               SUM(i.cotas) FILTER (WHERE i.status IN ('ativo','pago')) AS unidades,
               COUNT(*) FILTER (WHERE i.status IN ('ativo','pago')) AS compras,
               COUNT(DISTINCT i.plot_id) FILTER (WHERE i.status IN ('ativo','pago')) AS talhoes,
               COUNT(DISTINCT p.farm_id) FILTER (WHERE i.status IN ('ativo','pago')) AS fazendas,
               MAX(i.created_at) AS ultima_compra
        FROM investments i JOIN plots p ON p.id = i.plot_id GROUP BY i.user_id
      ), rec AS (
        SELECT user_id, SUM(amount) AS recebido FROM transactions WHERE type = 'pagamento_investidor' GROUP BY user_id
      )
      SELECT u.id, u.name AS nome, u.email, u.phone, u.created_at, u.last_login_at, u.suspended_at,
             u.endereco_cidade AS cidade, u.endereco_uf AS uf,
             CASE WHEN u.suspended_at IS NOT NULL THEN 'suspenso' ELSE 'ativo' END AS situacao,
             COALESCE(inv.investido, 0)::float8 AS investido, COALESCE(inv.em_andamento, 0)::float8 AS em_andamento,
             COALESCE(inv.unidades, 0)::float8 AS unidades, COALESCE(inv.compras, 0)::int AS compras,
             COALESCE(inv.talhoes, 0)::int AS talhoes, COALESCE(inv.fazendas, 0)::int AS fazendas,
             COALESCE(rec.recebido, 0)::float8 AS recebido, COALESCE(inv.investido_pago, 0)::float8 AS investido_pago,
             inv.ultima_compra
      FROM users u LEFT JOIN inv ON inv.user_id = u.id LEFT JOIN rec ON rec.user_id = u.id
      WHERE u.role = 'investidor' AND u.deleted_at IS NULL`,
    busca: ["nome", "email", "cidade"],
    ordens: { investido: "investido", recebido: "recebido", unidades: "unidades", compras: "compras", recentes: "created_at", acesso: "last_login_at", nome: "nome" },
    ordemPadrao: "investido",
    metrica: "investido",
    extras: (r) => ({ ...r, lucro_realizado: r.recebido - r.investido_pago, ticket_medio: r.compras ? r.investido / r.compras : 0 }),
  },
  fazendas: {
    base: `
      WITH pl AS (
        SELECT farm_id, COUNT(*) AS talhoes,
               COUNT(*) FILTER (WHERE status IN ('captacao','em_andamento')) AS talhoes_ativos,
               COUNT(*) FILTER (WHERE status = 'pago') AS talhoes_pagos,
               SUM(area_ha) FILTER (WHERE status IN ('captacao','em_andamento')) AS area_ativa
        FROM plots GROUP BY farm_id
      ), inv AS (
        SELECT p.farm_id, SUM(i.valor_investido) AS captado, COUNT(DISTINCT i.user_id) AS investidores, SUM(i.cotas) AS unidades_vendidas
        FROM investments i JOIN plots p ON p.id = i.plot_id WHERE i.status IN ('ativo','pago') GROUP BY p.farm_id
      ), tx AS (
        SELECT farm_id, SUM(amount) AS recebido FROM transactions WHERE type IN ('repasse_fazenda','performance_fazenda') GROUP BY farm_id
      ), ct AS (
        SELECT p.farm_id, SUM(c.valor) AS custos FROM plot_costs c JOIN plots p ON p.id = c.plot_id GROUP BY p.farm_id
      ), est AS (
        SELECT fc.farm_id, SUM(c.pontos) AS pontos FROM farm_characteristics fc JOIN farm_characteristics_catalog c ON c.key = fc.characteristic_key GROUP BY fc.farm_id
      )
      SELECT f.id, f.name AS nome, f.location, split_part(f.location, ', ', 1) AS cidade, right(f.location, 2) AS uf,
             f.status AS situacao, f.created_at, f.commission_pct,
             ROUND((COALESCE(est.pontos, 0)::numeric / NULLIF((SELECT SUM(pontos) FROM farm_characteristics_catalog), 0) * 5), 1)::float8 AS estrelas,
             u.id AS user_id, u.name AS responsavel, u.email, u.phone, u.last_login_at,
             COALESCE(pl.talhoes, 0)::int AS talhoes, COALESCE(pl.talhoes_ativos, 0)::int AS talhoes_ativos, COALESCE(pl.talhoes_pagos, 0)::int AS talhoes_pagos,
             COALESCE(pl.area_ativa, 0)::float8 AS area_ativa, COALESCE(inv.captado, 0)::float8 AS captado,
             COALESCE(inv.investidores, 0)::int AS investidores, COALESCE(inv.unidades_vendidas, 0)::float8 AS unidades_vendidas,
             COALESCE(tx.recebido, 0)::float8 AS recebido, COALESCE(ct.custos, 0)::float8 AS custos
      FROM farms f LEFT JOIN users u ON u.id = f.owner_user_id
      LEFT JOIN pl ON pl.farm_id = f.id LEFT JOIN inv ON inv.farm_id = f.id LEFT JOIN tx ON tx.farm_id = f.id
      LEFT JOIN ct ON ct.farm_id = f.id LEFT JOIN est ON est.farm_id = f.id`,
    busca: ["nome", "location", "responsavel", "email", "cnpj"],
    ordens: { captado: "captado", talhoes: "talhoes", area: "area_ativa", investidores: "investidores", recebido: "recebido", estrelas: "estrelas", recentes: "created_at", nome: "nome" },
    ordemPadrao: "captado",
    metrica: "captado",
  },
  armazens: {
    base: `
      SELECT w.id, w.name AS nome, w.location, split_part(w.location, ', ', 1) AS cidade, right(w.location, 2) AS uf,
             w.status AS situacao, w.created_at, w.cnpj, w.capacidade_t, ${WAREHOUSE_STARS_SQL} AS estrelas,
             u.id AS user_id, u.name AS responsavel, u.email, u.phone, u.last_login_at,
             (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita') AS custodias,
             (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita' AND p.status NOT IN ('pago','arquivado')) AS custodias_ativas,
             (SELECT COUNT(*)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'pendente') AS pedidos_pendentes,
             (SELECT COUNT(DISTINCT p.farm_id)::int FROM plots p WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita') AS fazendas_atendidas,
             (SELECT COALESCE(SUM(v.quantidade), 0)::float8 FROM plot_validations v WHERE v.warehouse_id = w.id AND v.etapa = 'armazenagem' AND v.resultado = 'confirmado') AS armazenado,
             (SELECT COALESCE(SUM(v.quantidade * 0.06), 0)::float8 FROM plot_validations v JOIN plots p ON p.id = v.plot_id
                WHERE v.warehouse_id = w.id AND v.etapa = 'armazenagem' AND v.resultado = 'confirmado' AND p.unidade = 'saca') AS armazenado_t,
             (SELECT COALESCE(SUM(i.valor_investido), 0)::float8 FROM investments i JOIN plots p ON p.id = i.plot_id
                WHERE p.warehouse_id = w.id AND p.custodia_status = 'aceita' AND i.status IN ('ativo','pago')) AS valor_garantido,
             (SELECT COALESCE(SUM(t.amount), 0)::float8 FROM transactions t WHERE t.type = 'tarifa_armazem' AND t.user_id = w.owner_user_id) AS tarifas
      FROM warehouses w LEFT JOIN users u ON u.id = w.owner_user_id`,
    busca: ["nome", "location", "responsavel", "email", "cnpj"],
    ordens: { armazenado: "armazenado", garantido: "valor_garantido", custodias: "custodias", tarifas: "tarifas", estrelas: "estrelas", capacidade: "capacidade_t", recentes: "created_at", nome: "nome" },
    ordemPadrao: "armazenado",
    metrica: "armazenado",
    extras: (r) => ({ ...r, ocupacao_pct: r.capacidade_t ? (r.armazenado_t / r.capacidade_t) * 100 : null }),
  },
  fundo: {
    base: `
      SELECT u.id, u.name AS nome, u.email, u.phone, u.created_at, u.last_login_at, u.suspended_at,
             CASE WHEN u.suspended_at IS NOT NULL THEN 'suspenso' ELSE 'ativo' END AS situacao,
             (SELECT COUNT(*)::int FROM plots p WHERE p.aprovacao_por = u.id AND p.aprovacao_status = 'aprovado') AS talhoes_aprovados,
             (SELECT COUNT(*)::int FROM plots p WHERE p.aprovacao_por = u.id AND p.aprovacao_status = 'rejeitado') AS ajustes_pedidos,
             (SELECT COUNT(*)::int FROM harvest_requests h WHERE h.reviewed_by = u.id AND h.status = 'aprovado') AS pagamentos_aprovados,
             (SELECT COALESCE(SUM(t.amount), 0)::float8 FROM harvest_requests h JOIN transactions t ON t.plot_id = h.plot_id AND t.type = 'pagamento_investidor'
                WHERE h.reviewed_by = u.id AND h.status = 'aprovado') AS valor_pago
      FROM users u WHERE u.role = 'fundo' AND u.deleted_at IS NULL`,
    busca: ["nome", "email"],
    ordens: { pagamentos: "pagamentos_aprovados", talhoes: "talhoes_aprovados", valor: "valor_pago", acesso: "last_login_at", nome: "nome" },
    ordemPadrao: "pagamentos",
    metrica: "valor_pago",
  },
};

function montar(tipo, q) {
  const t = TIPOS[tipo];
  const where = [];
  const params = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (q.q && String(q.q).trim()) add(`(${t.busca.map((c) => `COALESCE(${c}::text, '') ILIKE ?`).join(" OR ")})`, `%${String(q.q).trim()}%`);
  if (q.situacao) add("situacao = ?", String(q.situacao));
  if (q.uf && /^[A-Za-z]{2}$/.test(q.uf)) add("upper(uf) = ?", String(q.uf).toUpperCase());
  if (q.desde && /^\d{4}-\d{2}-\d{2}$/.test(q.desde)) add("created_at >= ?::date", q.desde);
  if (q.ate && /^\d{4}-\d{2}-\d{2}$/.test(q.ate)) add("created_at < (?::date + interval '1 day')", q.ate);
  const metrica = t.metrica;
  if (q.min !== undefined && q.min !== "" && !Number.isNaN(Number(q.min))) add(`${metrica} >= ?`, Number(q.min));
  if (q.max !== undefined && q.max !== "" && !Number.isNaN(Number(q.max))) add(`${metrica} <= ?`, Number(q.max));
  if (q._id) add("id = ?", Number(q._id));
  const col = t.ordens[q.ordem] || t.ordens[t.ordemPadrao];
  const dir = col === "nome" ? "ASC" : "DESC NULLS LAST";
  return {
    sql: `SELECT * FROM (${t.base}) x ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    order: `ORDER BY ${col} ${dir}, nome ASC`,
    params,
  };
}

const somar = (rows, k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

function resumo(tipo, rows) {
  const base = { quantidade: rows.length };
  if (tipo === "investidores") return { ...base, investido: somar(rows, "investido"), em_andamento: somar(rows, "em_andamento"), recebido: somar(rows, "recebido"), unidades: somar(rows, "unidades"), com_investimento: rows.filter((r) => r.compras > 0).length };
  if (tipo === "fazendas") return { ...base, talhoes: somar(rows, "talhoes"), area_ativa: somar(rows, "area_ativa"), captado: somar(rows, "captado"), recebido: somar(rows, "recebido"), pendentes: rows.filter((r) => r.situacao === "pendente").length };
  if (tipo === "armazens") return { ...base, armazenado: somar(rows, "armazenado"), armazenado_t: somar(rows, "armazenado_t"), valor_garantido: somar(rows, "valor_garantido"), tarifas: somar(rows, "tarifas"), capacidade_t: somar(rows, "capacidade_t"), pendentes: rows.filter((r) => r.situacao === "pendente").length };
  return { ...base, pagamentos_aprovados: somar(rows, "pagamentos_aprovados"), talhoes_aprovados: somar(rows, "talhoes_aprovados"), valor_pago: somar(rows, "valor_pago") };
}

async function consultar(tipo, q, { limit } = {}) {
  const m = montar(tipo, q);
  const { rows } = await pool.query(`${m.sql} ${m.order}${limit ? ` LIMIT ${limit}` : ""}`, m.params);
  const ex = TIPOS[tipo].extras;
  return ex ? rows.map(ex) : rows;
}

router.get("/contagem", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM users WHERE role = 'investidor' AND deleted_at IS NULL) AS investidores,
    (SELECT COUNT(*)::int FROM farms) AS fazendas,
    (SELECT COUNT(*)::int FROM warehouses) AS armazens,
    (SELECT COUNT(*)::int FROM users WHERE role = 'fundo' AND deleted_at IS NULL) AS fundo`);
  res.json(rows[0]);
}));

router.get("/:tipo", asyncHandler(async (req, res) => {
  const tipo = req.params.tipo;
  if (!TIPOS[tipo]) return res.status(404).json({ error: "Tipo de usuário inválido." });
  const todos = await consultar(tipo, req.query);
  const pageSize = Math.min(100, Math.max(10, Number(req.query.page_size) || 25));
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json({
    linhas: todos.slice((page - 1) * pageSize, page * pageSize),
    total: todos.length, page, pageSize,
    resumo: resumo(tipo, todos),
    ranking: todos.slice(0, 10).map((r) => ({ id: r.id, nome: r.nome, valor: Number(r[TIPOS[tipo].ordens[req.query.ordem] || TIPOS[tipo].ordens[TIPOS[tipo].ordemPadrao]] || 0) })),
  });
}));

// ---------- ficha detalhada ----------
router.get("/:tipo/:id/detalhe", asyncHandler(async (req, res) => {
  const { tipo, id } = req.params;
  if (!TIPOS[tipo]) return res.status(404).json({ error: "Tipo inválido." });
  const linha = (await consultar(tipo, { _id: id })).find((r) => String(r.id) === String(id));
  if (!linha) return res.status(404).json({ error: "Não encontrado." });
  let itens = [];
  if (tipo === "investidores") {
    ({ rows: itens } = await pool.query(
      `SELECT i.id, i.cotas, i.valor_investido, i.status, i.created_at, p.id AS plot_id, p.nome AS plot_nome, p.grao, p.unidade, f.name AS farm_name
       FROM investments i JOIN plots p ON p.id = i.plot_id JOIN farms f ON f.id = p.farm_id WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT 50`, [id]));
  } else if (tipo === "fazendas") {
    ({ rows: itens } = await pool.query(
      `SELECT p.id AS plot_id, p.nome AS plot_nome, p.grao, p.variedade, p.status, p.area_ha, p.safra, p.unidade, p.cotas_totais, p.cotas_disponiveis, w.name AS warehouse_name,
              COALESCE((SELECT SUM(i.valor_investido) FROM investments i WHERE i.plot_id = p.id AND i.status IN ('ativo','pago')), 0)::float8 AS captado
       FROM plots p LEFT JOIN warehouses w ON w.id = p.warehouse_id WHERE p.farm_id = $1 ORDER BY p.created_at DESC LIMIT 50`, [id]));
  } else if (tipo === "armazens") {
    ({ rows: itens } = await pool.query(
      `SELECT p.id AS plot_id, p.nome AS plot_nome, p.grao, p.status, p.custodia_status, p.unidade, f.name AS farm_name,
              (SELECT v.quantidade FROM plot_validations v WHERE v.plot_id = p.id AND v.etapa = 'armazenagem' AND v.resultado = 'confirmado' ORDER BY v.created_at DESC LIMIT 1) AS armazenado
       FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.warehouse_id = $1 ORDER BY p.created_at DESC LIMIT 50`, [id]));
  } else {
    ({ rows: itens } = await pool.query(
      `SELECT h.id, h.status, h.reviewed_at AS created_at, p.id AS plot_id, p.nome AS plot_nome, p.grao, f.name AS farm_name
       FROM harvest_requests h JOIN plots p ON p.id = h.plot_id JOIN farms f ON f.id = p.farm_id WHERE h.reviewed_by = $1 ORDER BY h.reviewed_at DESC LIMIT 50`, [id]));
  }
  res.json({ linha, itens });
}));

// ---------- suspender / reativar acesso (investidores e fundo) ----------
router.patch("/conta/:userId/suspensao", asyncHandler(async (req, res) => {
  const suspender = !!req.body?.suspender;
  const motivo = String(req.body?.motivo || "").trim().slice(0, 300) || null;
  const { rows } = await pool.query(
    `UPDATE users SET suspended_at = CASE WHEN $2 THEN now() ELSE NULL END, suspended_reason = CASE WHEN $2 THEN $3 ELSE NULL END
     WHERE id = $1 AND role IN ('investidor', 'fundo') AND deleted_at IS NULL RETURNING id, suspended_at`,
    [req.params.userId, suspender, motivo]
  );
  if (!rows.length) return res.status(404).json({ error: "Conta não encontrada (só investidores e fundo são suspensos por aqui)." });
  limparCacheSuspensao(Number(req.params.userId));
  res.json({ ok: true, suspenso: !!rows[0].suspended_at });
}));

// ---------- exportação ----------
const COLUNAS_CSV = {
  investidores: [["nome", "Nome"], ["email", "E-mail"], ["phone", "Telefone"], ["cidade", "Cidade"], ["uf", "UF"], ["situacao", "Situação"], ["investido", "Investido (R$)"], ["em_andamento", "Em andamento (R$)"], ["recebido", "Recebido (R$)"], ["lucro_realizado", "Lucro realizado (R$)"], ["unidades", "Unidades"], ["compras", "Compras"], ["talhoes", "Talhões"], ["fazendas", "Fazendas"], ["ticket_medio", "Ticket médio (R$)"], ["created_at", "Cadastro"], ["ultima_compra", "Última compra"], ["last_login_at", "Último acesso"]],
  fazendas: [["nome", "Fazenda"], ["location", "Local"], ["situacao", "Situação"], ["responsavel", "Responsável"], ["email", "E-mail"], ["phone", "Telefone"], ["estrelas", "Estrelas"], ["talhoes", "Talhões"], ["talhoes_ativos", "Talhões ativos"], ["talhoes_pagos", "Talhões pagos"], ["area_ativa", "Área ativa (ha)"], ["captado", "Captado (R$)"], ["investidores", "Investidores"], ["unidades_vendidas", "Unidades vendidas"], ["recebido", "Comissão + performance (R$)"], ["custos", "Custos lançados (R$)"], ["commission_pct", "Comissão (%)"], ["created_at", "Cadastro"]],
  armazens: [["nome", "Armazém"], ["location", "Local"], ["cnpj", "CNPJ"], ["situacao", "Situação"], ["responsavel", "Responsável"], ["email", "E-mail"], ["estrelas", "Estrelas"], ["capacidade_t", "Capacidade (t)"], ["armazenado", "Armazenado (unidades)"], ["armazenado_t", "Armazenado (t, sacas)"], ["ocupacao_pct", "Ocupação (%)"], ["custodias", "Custódias"], ["custodias_ativas", "Custódias ativas"], ["pedidos_pendentes", "Pedidos pendentes"], ["fazendas_atendidas", "Fazendas atendidas"], ["valor_garantido", "Valor garantido (R$)"], ["tarifas", "Tarifas recebidas (R$)"], ["created_at", "Cadastro"]],
  fundo: [["nome", "Nome"], ["email", "E-mail"], ["situacao", "Situação"], ["talhoes_aprovados", "Talhões aprovados"], ["ajustes_pedidos", "Ajustes pedidos"], ["pagamentos_aprovados", "Pagamentos aprovados"], ["valor_pago", "Valor pago (R$)"], ["created_at", "Cadastro"], ["last_login_at", "Último acesso"]],
};

router.get("/:tipo/export.csv", asyncHandler(async (req, res) => {
  const tipo = req.params.tipo;
  if (!TIPOS[tipo]) return res.status(404).json({ error: "Tipo inválido." });
  const rows = await consultar(tipo, req.query);
  const cols = COLUNAS_CSV[tipo];
  const cel = (v) => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = "\ufeff" + [cols.map((c) => c[1]).join(";"), ...rows.map((r) => cols.map(([k]) => cel(r[k])).join(";"))].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${tipo}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(body);
}));

module.exports = router;
