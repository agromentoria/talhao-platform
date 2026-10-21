// Gestão financeira da administração: todas as transações com filtros,
// resumo, série mensal, relatórios agrupados, exportação CSV e o "zerar dados".
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
router.use(requireAuth, requireRole("admin", "fundo"));

const TIPOS = {
  compra_cota: { label: "Compra de cotas", sentido: "entrada" },
  pagamento_investidor: { label: "Pagamento a investidor", sentido: "saida" },
  repasse_fazenda: { label: "Comissão da fazenda", sentido: "saida" },
  performance_fazenda: { label: "Performance da fazenda", sentido: "saida" },
  aporte_fazenda: { label: "Aporte da fazenda para o piso", sentido: "entrada" },
  gestao_fundo: { label: "Gestão do fundo", sentido: "saida" },
  taxa_estruturacao: { label: "Taxa de entrada (1% do captado)", sentido: "receita" },
  tarifa_armazem: { label: "Tarifa de armazenagem", sentido: "saida" },
  comissao_plataforma: { label: "Comissão da plataforma", sentido: "receita" },
};

// Base comum: transação + pessoa + fazenda + talhão + armazém do talhão
const FROM = `
  FROM transactions t
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN farms f ON f.id = t.farm_id
  LEFT JOIN plots p ON p.id = t.plot_id
  LEFT JOIN warehouses w ON w.id = p.warehouse_id
`;
const COLS = `
  t.id, t.type, t.status, t.amount, t.description, t.created_at, t.payment_method_type,
  t.user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role,
  t.farm_id, f.name AS farm_name, t.plot_id, p.nome AS plot_nome, p.grao, p.unidade,
  p.warehouse_id, w.name AS warehouse_name, t.investment_id
`;

function parseList(v) {
  if (!v) return [];
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}

// Monta o WHERE a partir dos filtros da tela (mesmos filtros em lista,
// resumo, gráfico, relatório e exportação)
function buildFilters(q) {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace("?", `$${params.length}`)); };

  const tipos = parseList(q.type).filter((t) => TIPOS[t]);
  if (tipos.length) add("t.type = ANY(?)", tipos);
  if (q.status) add("t.status = ?", String(q.status));
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) add("t.created_at >= ?::date", q.from);
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) add("t.created_at < (?::date + interval '1 day')", q.to);
  if (q.user_id) add("t.user_id = ?", Number(q.user_id));
  if (q.farm_id) add("t.farm_id = ?", Number(q.farm_id));
  if (q.plot_id) add("t.plot_id = ?", Number(q.plot_id));
  if (q.warehouse_id) {
    params.push(Number(q.warehouse_id));
    const i = params.length;
    where.push(`(p.warehouse_id = $${i} OR t.user_id = (SELECT owner_user_id FROM warehouses WHERE id = $${i}))`);
  }
  if (q.payment) add("t.payment_method_type = ?", String(q.payment));
  if (q.min !== undefined && q.min !== "" && !Number.isNaN(Number(q.min))) add("t.amount >= ?", Number(q.min));
  if (q.max !== undefined && q.max !== "" && !Number.isNaN(Number(q.max))) add("t.amount <= ?", Number(q.max));
  if (q.q && String(q.q).trim()) {
    const termo = String(q.q).trim();
    params.push(`%${termo}%`);
    const i = params.length;
    params.push(termo.replace(/^#/, ""));
    const j = params.length;
    where.push(`(t.description ILIKE $${i} OR u.name ILIKE $${i} OR u.email ILIKE $${i} OR f.name ILIKE $${i}
      OR p.nome ILIKE $${i} OR w.name ILIKE $${i} OR CAST(t.id AS TEXT) = $${j})`);
  }
  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", params, precisaJoin: !!(q.q && String(q.q).trim()) || !!q.warehouse_id };
}

const SORTS = { recentes: "t.created_at DESC, t.id DESC", antigas: "t.created_at ASC, t.id ASC", maior: "t.amount DESC", menor: "t.amount ASC" };

async function summary(filters) {
  // sem busca por texto nem filtro de armazém, o resumo só precisa da tabela
  // de transações: evita juntar 4 tabelas a cada consulta
  const from = filters.precisaJoin ? FROM : "FROM transactions t";
  const { rows } = await pool.query(
    `SELECT t.type, COUNT(*)::int AS n, COALESCE(SUM(t.amount), 0)::float8 AS total ${from} ${filters.sql} GROUP BY t.type`,
    filters.params
  );
  const porTipo = Object.fromEntries(Object.keys(TIPOS).map((k) => [k, { count: 0, total: 0, label: TIPOS[k].label }]));
  for (const r of rows) porTipo[r.type] = { ...porTipo[r.type], count: r.n, total: r.total };
  const soma = (tipos) => tipos.reduce((s, t) => s + (porTipo[t]?.total || 0), 0);
  return {
    porTipo,
    quantidade: rows.reduce((s, r) => s + r.n, 0),
    entradas: soma(["compra_cota", "aporte_fazenda"]),
    saidas: soma(["pagamento_investidor", "repasse_fazenda", "performance_fazenda", "tarifa_armazem", "gestao_fundo"]),
    receitaPlataforma: soma(["comissao_plataforma", "taxa_estruturacao"]),
    receitaEntrada: soma(["taxa_estruturacao"]),
    receitaSaida: soma(["comissao_plataforma"]),
  };
}

// ---------- lista ----------
router.get("/transactions", asyncHandler(async (req, res) => {
  const filters = buildFilters(req.query);
  const pageSize = Math.min(200, Math.max(10, Number(req.query.page_size) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const order = SORTS[req.query.sort] || SORTS.recentes;
  const [{ rows }, resumo] = await Promise.all([
    pool.query(
      `SELECT ${COLS} ${FROM} ${filters.sql} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      filters.params
    ),
    summary(filters),
  ]);
  res.json({ transactions: rows, page, pageSize, total: resumo.quantidade, resumo, tipos: TIPOS });
}));

// ---------- detalhe ----------
router.get("/transactions/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLS} ${FROM} WHERE t.id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Transação não encontrada." });
  const t = rows[0];
  let payout = null;
  if (t.investment_id) {
    const r = await pool.query(
      `SELECT i.cotas, i.valor_investido, i.preco_unitario, i.status, po.valor_bruto, po.comissao_fazenda, po.comissao_app, po.despesa_armazem, po.perf_fazenda, po.valor_liquido
       FROM investments i LEFT JOIN payouts po ON po.investment_id = i.id WHERE i.id = $1`,
      [t.investment_id]
    );
    payout = r.rows[0] || null;
  }
  res.json({ transaction: t, investimento: payout, tipo: TIPOS[t.type] });
}));

// ---------- série mensal (gráfico) ----------
router.get("/series", asyncHandler(async (req, res) => {
  const filters = buildFilters(req.query);
  const { rows } = await pool.query(
    `SELECT to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS mes, t.type, COALESCE(SUM(t.amount), 0)::float8 AS total
     ${FROM} ${filters.sql} GROUP BY 1, 2 ORDER BY 1`,
    filters.params
  );
  const meses = [...new Set(rows.map((r) => r.mes))];
  const series = meses.map((mes) => {
    const linha = { mes };
    for (const k of Object.keys(TIPOS)) linha[k] = 0;
    rows.filter((r) => r.mes === mes).forEach((r) => { linha[r.type] = r.total; });
    return linha;
  });
  res.json({ series });
}));

// ---------- relatórios agrupados ----------
const GROUPS = {
  investidor: {
    label: "Investidores",
    select: "u.id AS chave, u.name AS nome, u.email AS detalhe",
    where: "u.role = 'investidor'",
    group: "u.id, u.name, u.email",
    cols: {
      investido: "SUM(CASE WHEN t.type = 'compra_cota' THEN t.amount ELSE 0 END)",
      recebido: "SUM(CASE WHEN t.type = 'pagamento_investidor' THEN t.amount ELSE 0 END)",
    },
  },
  fazenda: {
    label: "Fazendas",
    select: "f.id AS chave, f.name AS nome, f.location AS detalhe",
    where: "t.farm_id IS NOT NULL",
    group: "f.id, f.name, f.location",
    cols: {
      captado: "SUM(CASE WHEN t.type = 'compra_cota' THEN t.amount ELSE 0 END)",
      pago_investidores: "SUM(CASE WHEN t.type = 'pagamento_investidor' THEN t.amount ELSE 0 END)",
      comissao_fazenda: "SUM(CASE WHEN t.type = 'repasse_fazenda' THEN t.amount ELSE 0 END)",
      performance_fazenda: "SUM(CASE WHEN t.type = 'performance_fazenda' THEN t.amount ELSE 0 END)",
      custos_lancados: "(SELECT COALESCE(SUM(c.valor), 0) FROM plot_costs c JOIN plots pp ON pp.id = c.plot_id WHERE pp.farm_id = f.id)",
      armazenagem: "SUM(CASE WHEN t.type = 'tarifa_armazem' THEN t.amount ELSE 0 END)",
      comissao_plataforma: "SUM(CASE WHEN t.type = 'comissao_plataforma' THEN t.amount ELSE 0 END)",
      taxa_estruturacao: "SUM(CASE WHEN t.type = 'taxa_estruturacao' THEN t.amount ELSE 0 END)",
    },
  },
  armazem: {
    label: "Armazéns",
    select: "w.id AS chave, w.name AS nome, w.location AS detalhe",
    where: "w.id IS NOT NULL",
    group: "w.id, w.name, w.location",
    cols: {
      captado_garantido: "SUM(CASE WHEN t.type = 'compra_cota' THEN t.amount ELSE 0 END)",
      tarifas: "SUM(CASE WHEN t.type = 'tarifa_armazem' THEN t.amount ELSE 0 END)",
    },
  },
  talhao: {
    label: "Talhões",
    select: "p.id AS chave, p.nome AS nome, f.name AS detalhe",
    where: "p.id IS NOT NULL",
    group: "p.id, p.nome, f.name",
    cols: {
      captado: "SUM(CASE WHEN t.type = 'compra_cota' THEN t.amount ELSE 0 END)",
      custos_lancados: "(SELECT COALESCE(SUM(c.valor), 0) FROM plot_costs c WHERE c.plot_id = p.id)",
      pago_investidores: "SUM(CASE WHEN t.type = 'pagamento_investidor' THEN t.amount ELSE 0 END)",
      comissao_fazenda: "SUM(CASE WHEN t.type = 'repasse_fazenda' THEN t.amount ELSE 0 END)",
      performance_fazenda: "SUM(CASE WHEN t.type = 'performance_fazenda' THEN t.amount ELSE 0 END)",
      armazenagem: "SUM(CASE WHEN t.type = 'tarifa_armazem' THEN t.amount ELSE 0 END)",
      comissao_plataforma: "SUM(CASE WHEN t.type = 'comissao_plataforma' THEN t.amount ELSE 0 END)",
      taxa_estruturacao: "SUM(CASE WHEN t.type = 'taxa_estruturacao' THEN t.amount ELSE 0 END)",
    },
  },
  mes: {
    label: "Meses",
    select: "to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS chave, to_char(date_trunc('month', t.created_at), 'MM/YYYY') AS nome, NULL AS detalhe",
    where: "TRUE",
    group: "1, 2",
    cols: {
      entradas: "SUM(CASE WHEN t.type = 'compra_cota' THEN t.amount ELSE 0 END)",
      saidas: "SUM(CASE WHEN t.type IN ('pagamento_investidor','repasse_fazenda','performance_fazenda','tarifa_armazem') THEN t.amount ELSE 0 END)",
      receita_plataforma: "SUM(CASE WHEN t.type IN ('comissao_plataforma', 'taxa_estruturacao') THEN t.amount ELSE 0 END)",
    },
  },
};
const COL_LABEL = {
  investido: "Investido", recebido: "Recebido", captado: "Captado", pago_investidores: "Pago a investidores",
  comissao_fazenda: "Comissão da fazenda", performance_fazenda: "Performance da fazenda", custos_lancados: "Custos lançados", armazenagem: "Armazenagem", comissao_plataforma: "Comissão da plataforma",
  captado_garantido: "Captação garantida", tarifas: "Tarifas recebidas", entradas: "Entradas", saidas: "Saídas",
  receita_plataforma: "Receita da plataforma", quantidade: "Transações",
};

async function buildReport(query) {
  const g = GROUPS[query.group] || GROUPS.fazenda;
  const filters = buildFilters(query);
  const extra = filters.sql ? `${filters.sql} AND ${g.where}` : `WHERE ${g.where}`;
  const colsSql = Object.entries(g.cols).map(([k, v]) => `COALESCE(${v}, 0)::float8 AS ${k}`).join(", ");
  const firstCol = Object.keys(g.cols)[0];
  const { rows } = await pool.query(
    `SELECT ${g.select}, ${colsSql}, COUNT(*)::int AS quantidade ${FROM} ${extra} GROUP BY ${g.group}
     ORDER BY ${query.group === "mes" ? "1" : `${firstCol} DESC`}`,
    filters.params
  );
  const colunas = [...Object.keys(g.cols), "quantidade"];
  const totais = Object.fromEntries(colunas.map((c) => [c, rows.reduce((s, r) => s + Number(r[c] || 0), 0)]));
  return { grupo: query.group in GROUPS ? query.group : "fazenda", titulo: g.label, colunas, rotulos: COL_LABEL, linhas: rows, totais };
}

router.get("/report", asyncHandler(async (req, res) => {
  res.json(await buildReport(req.query));
}));

// ---------- exportação CSV (abre direto no Excel em português) ----------
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const num = (n) => Number(n || 0).toFixed(2).replace(".", ",");
const dataBR = (d) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

function sendCsv(res, filename, header, lines) {
  const body = "\ufeff" + [header, ...lines].map((l) => l.map(csvCell).join(";")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
}

router.get("/export/transactions.csv", asyncHandler(async (req, res) => {
  const filters = buildFilters(req.query);
  const { rows } = await pool.query(`SELECT ${COLS} ${FROM} ${filters.sql} ORDER BY t.created_at DESC LIMIT 50000`, filters.params);
  sendCsv(res, `transacoes-${new Date().toISOString().slice(0, 10)}.csv`,
    ["ID", "Data", "Tipo", "Situação", "Valor (R$)", "Pessoa", "E-mail", "Perfil", "Fazenda", "Talhão", "Cultura", "Armazém", "Forma de pagamento", "Descrição"],
    rows.map((t) => [t.id, dataBR(t.created_at), TIPOS[t.type]?.label || t.type, t.status, num(t.amount), t.user_name, t.user_email, t.user_role,
      t.farm_name, t.plot_nome, t.grao, t.warehouse_name, t.payment_method_type, t.description]));
}));

router.get("/export/report.csv", asyncHandler(async (req, res) => {
  const r = await buildReport(req.query);
  sendCsv(res, `relatorio-${r.grupo}-${new Date().toISOString().slice(0, 10)}.csv`,
    ["Nome", "Detalhe", ...r.colunas.map((c) => r.rotulos[c] || c)],
    [...r.linhas.map((l) => [l.nome, l.detalhe, ...r.colunas.map((c) => (c === "quantidade" ? l[c] : num(l[c])))]),
     ["TOTAL", "", ...r.colunas.map((c) => (c === "quantidade" ? r.totais[c] : num(r.totais[c])))]]);
}));

// ---------- opções dos filtros ----------
router.get("/filter-options", asyncHandler(async (req, res) => {
  const [inv, faz, arm, tal] = await Promise.all([
    pool.query("SELECT id, name, email FROM users WHERE role = 'investidor' AND deleted_at IS NULL ORDER BY name"),
    pool.query("SELECT id, name, location FROM farms ORDER BY name"),
    pool.query("SELECT id, name, location FROM warehouses ORDER BY name"),
    pool.query("SELECT p.id, p.nome, f.name AS farm_name FROM plots p JOIN farms f ON f.id = p.farm_id ORDER BY p.nome"),
  ]);
  res.json({ investidores: inv.rows, fazendas: faz.rows, armazens: arm.rows, talhoes: tal.rows, tipos: TIPOS });
}));

// ---------- zerar dados ----------
// Para começar a operação real depois dos testes. Exige senha do
// administrador e a palavra ZERAR, registra quem fez e pode ser desligado
// em produção com DISABLE_DATA_RESET=true.
const ESCOPOS = {
  financeiro: "Movimentação financeira: transações, investimentos, pagamentos, solicitações de colheita e custos lançados. Talhões, contas e cadastros ficam.",
  talhoes: "Financeiro + todos os talhões, com validações do armazém, fotos de talhão, andamento e avisos ligados a eles. Contas ficam.",
  tudo: "Tudo, exceto as contas de administração e as configurações (catálogos, comissão, preço por fase, referências).",
};

router.get("/reset/info", (req, res, next) => (req.user.role === "admin" ? next() : res.status(403).json({ error: "Somente a administração pode zerar dados." })), asyncHandler(async (req, res) => {
  const count = async (t) => (await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n;
  res.json({
    habilitado: process.env.DISABLE_DATA_RESET !== "true",
    escopos: ESCOPOS,
    contagem: {
      transacoes: await count("transactions"), investimentos: await count("investments"), talhoes: await count("plots"),
      fazendas: await count("farms"), armazens: await count("warehouses"),
      usuarios: (await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role <> 'admin'")).rows[0].n,
    },
    historico: (await pool.query(
      "SELECT a.created_at, a.escopo, a.detalhes, u.name AS admin FROM admin_audit_log a LEFT JOIN users u ON u.id = a.admin_id WHERE a.acao = 'zerar_dados' ORDER BY a.created_at DESC LIMIT 10"
    )).rows,
  });
}));

router.post("/reset", (req, res, next) => (req.user.role === "admin" ? next() : res.status(403).json({ error: "Somente a administração pode zerar dados." })), asyncHandler(async (req, res) => {
  if (process.env.DISABLE_DATA_RESET === "true") {
    return res.status(403).json({ error: "O zerar dados está desligado neste servidor (DISABLE_DATA_RESET=true)." });
  }
  const { escopo, senha, confirmacao } = req.body || {};
  if (!ESCOPOS[escopo]) return res.status(400).json({ error: "Escolha o que deseja zerar." });
  if (String(confirmacao || "").trim().toUpperCase() !== "ZERAR") return res.status(400).json({ error: "Digite ZERAR para confirmar." });
  const { rows: me } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!me[0] || !(await bcrypt.compare(String(senha || ""), me[0].password_hash))) {
    return res.status(403).json({ error: "Senha incorreta." });
  }

  const client = await pool.connect();
  const removidos = {};
  const run = async (label, sql, params = []) => {
    const r = await client.query(sql, params);
    removidos[label] = (removidos[label] || 0) + (r.rowCount || 0);
  };
  try {
    await client.query("BEGIN");
    // 1) financeiro
    await run("pagamentos", "DELETE FROM payouts");
    await run("transacoes", "DELETE FROM transactions");
    await run("investimentos", "DELETE FROM investments");
    await run("solicitacoes_colheita", "DELETE FROM harvest_requests");
    await run("custos_lancados", "DELETE FROM plot_costs");
    if (escopo === "financeiro") {
      // talhões voltam a ter todas as cotas disponíveis
      await client.query("UPDATE plots SET cotas_disponiveis = cotas_totais");
      await client.query("UPDATE plots SET status = 'em_andamento' WHERE status = 'aguardando_aprovacao'");
    }
    // 2) talhões
    if (escopo === "talhoes" || escopo === "tudo") {
      await run("validacoes", "DELETE FROM plot_validations");
      await run("andamentos", "DELETE FROM progress_updates");
      await run("fotos_talhao", "DELETE FROM photos WHERE plot_id IS NOT NULL");
      await run("avisos", "DELETE FROM notifications WHERE plot_id IS NOT NULL");
      await run("talhoes", "DELETE FROM plots");
    }
    // 3) tudo (menos administração)
    if (escopo === "tudo") {
      await run("leituras", "DELETE FROM conversation_reads");
      await run("mensagens", "DELETE FROM messages");
      await run("conversas", "DELETE FROM conversations");
      await run("avisos", "DELETE FROM notifications");
      await run("cartoes", "DELETE FROM payment_methods");
      await client.query("DELETE FROM payout_accounts WHERE user_id IN (SELECT id FROM users WHERE role <> 'admin')");
      await run("fotos", "DELETE FROM photos");
      await client.query("DELETE FROM farm_characteristics");
      await client.query("DELETE FROM warehouse_characteristics");
      await client.query("UPDATE users SET farm_id = NULL, warehouse_id = NULL WHERE role <> 'admin'");
      await client.query("UPDATE farms SET owner_user_id = NULL");
      await client.query("UPDATE warehouses SET owner_user_id = NULL");
      await run("fazendas", "DELETE FROM farms");
      await run("armazens", "DELETE FROM warehouses");
      await run("usuarios", "DELETE FROM users WHERE role <> 'admin'");
    }
    await client.query(
      "INSERT INTO admin_audit_log (admin_id, acao, escopo, detalhes) VALUES ($1, 'zerar_dados', $2, $3)",
      [req.user.id, escopo, JSON.stringify(removidos)]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  console.warn(`[zerar dados] admin ${req.user.id} zerou "${escopo}":`, removidos);
  res.json({ ok: true, escopo, removidos });
}));

module.exports = router;
