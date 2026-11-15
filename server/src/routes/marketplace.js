// Marketplace (v4.0): catálogo de itens, fornecedores e suas ofertas, tradings.
const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const CATEGORIAS = ["corretivo","fertilizante","nutritivo","defensivo","semente","combustivel","servico"];
const CULTURAS = ["Soja","Milho","Feijão","Algodão","Trigo","Café","Arroz","Sorgo"];
const listaUF = (v) => [...new Set((Array.isArray(v) ? v : String(v || "").split(/[,\s]+/)).map((x) => String(x).trim().toUpperCase()).filter((x) => UFS.includes(x)))];
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

// ---------------- catálogo (qualquer usuário logado) ----------------
router.get("/catalog/items", requireAuth, asyncHandler(async (req, res) => {
  const cultura = req.query.cultura ? String(req.query.cultura) : null;
  const { rows: itens } = await pool.query("SELECT * FROM catalog_items WHERE ativo ORDER BY array_position($1::text[], categoria), nome", [CATEGORIAS]);
  const { rows: doses } = await pool.query(
    "SELECT * FROM reference_doses WHERE ($1::text IS NULL OR cultura = $1) ORDER BY cultura", [cultura]);
  res.json({ categorias: CATEGORIAS, itens: itens.map((i) => ({ ...i, doses: doses.filter((d) => d.catalog_item_id === i.id) })) });
}));

// ofertas ativas de um item numa UF (base da escolha de fornecedor no plano da fazenda — v4.1)
router.get("/catalog/offers", requireAuth, asyncHandler(async (req, res) => {
  const uf = req.query.uf ? String(req.query.uf).toUpperCase() : null;
  const item = req.query.item ? Number(req.query.item) : null;
  const { rows } = await pool.query(
    `SELECT o.*, s.razao_social AS fornecedor, s.cidade, s.uf AS fornecedor_uf, c.nome AS item, c.unidade_dose, c.categoria
       FROM supplier_offers o JOIN suppliers s ON s.id = o.supplier_id JOIN catalog_items c ON c.id = o.catalog_item_id
      WHERE o.ativo AND s.status = 'aprovado' AND (o.validade_ate IS NULL OR o.validade_ate >= CURRENT_DATE)
        AND ($1::text IS NULL OR $1 = ANY(o.regioes)) AND ($2::int IS NULL OR o.catalog_item_id = $2)
      ORDER BY c.nome, o.preco`, [uf, item]);
  res.json({ ofertas: rows });
}));

// ---------------- fornecedor ----------------
async function meuFornecedor(userId) {
  const { rows } = await pool.query("SELECT s.* FROM suppliers s JOIN users u ON u.supplier_id = s.id WHERE u.id = $1", [userId]);
  return rows[0] || null;
}
router.get("/suppliers/me", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  if (!s) return res.status(404).json({ error: "Cadastro de fornecedor não encontrado." });
  const { rows } = await pool.query("SELECT COUNT(*)::int AS ofertas FROM supplier_offers WHERE supplier_id = $1 AND ativo", [s.id]);
  res.json({ fornecedor: s, resumo: rows[0] });
}));
router.put("/suppliers/me", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  if (!s) return res.status(404).json({ error: "Cadastro de fornecedor não encontrado." });
  const regioes = req.body?.regioes !== undefined ? listaUF(req.body.regioes) : s.regioes;
  const categorias = Array.isArray(req.body?.categorias) ? req.body.categorias.filter((c) => CATEGORIAS.includes(c)) : s.categorias;
  const { rows } = await pool.query("UPDATE suppliers SET regioes = $1, categorias = $2, telefone = COALESCE($3, telefone) WHERE id = $4 RETURNING *",
    [regioes, categorias, req.body?.telefone || null, s.id]);
  res.json({ fornecedor: rows[0] });
}));
router.get("/suppliers/me/offers", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  if (!s) return res.status(404).json({ error: "Cadastro de fornecedor não encontrado." });
  const { rows } = await pool.query(
    `SELECT o.*, c.nome AS item, c.categoria, c.unidade_dose, c.unidade_compra, c.exige_receita
       FROM supplier_offers o JOIN catalog_items c ON c.id = o.catalog_item_id WHERE o.supplier_id = $1 AND o.ativo
      ORDER BY array_position($2::text[], c.categoria), c.nome`, [s.id, CATEGORIAS]);
  res.json({ ofertas: rows, fornecedor: s });
}));
function validarOferta(b, fornecedor) {
  const preco = num(b?.preco);
  if (!(preco > 0)) return { erro: "Informe o preço por unidade (maior que zero)." };
  const regioes = listaUF(b?.regioes?.length ? b.regioes : fornecedor.regioes);
  if (!regioes.length) return { erro: "Informe pelo menos um estado de entrega." };
  const prazo = Math.max(0, Math.min(120, Math.round(num(b?.prazo_dias) ?? 7)));
  const validade = b?.validade_ate && /^\d{4}-\d{2}-\d{2}$/.test(b.validade_ate) ? b.validade_ate : null;
  return { preco, regioes, prazo, validade, marca: b?.marca ? String(b.marca).slice(0, 80) : null, embalagem: b?.embalagem ? String(b.embalagem).slice(0, 80) : null, estoque: num(b?.estoque) };
}
router.post("/suppliers/me/offers", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  if (!s) return res.status(404).json({ error: "Cadastro de fornecedor não encontrado." });
  const item = Number(req.body?.catalog_item_id);
  const { rows: it } = await pool.query("SELECT id FROM catalog_items WHERE id = $1 AND ativo", [item]);
  if (!it[0]) return res.status(400).json({ error: "Escolha um item do catálogo." });
  const v = validarOferta(req.body, s);
  if (v.erro) return res.status(400).json({ error: v.erro });
  const { rows } = await pool.query(
    `INSERT INTO supplier_offers (supplier_id, catalog_item_id, marca, embalagem, preco, regioes, prazo_dias, validade_ate, estoque)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [s.id, item, v.marca, v.embalagem, v.preco, v.regioes, v.prazo, v.validade, v.estoque]);
  res.status(201).json({ oferta: rows[0] });
}));
router.put("/suppliers/me/offers/:id", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  const v = validarOferta(req.body, s || { regioes: [] });
  if (v.erro) return res.status(400).json({ error: v.erro });
  const { rows } = await pool.query(
    `UPDATE supplier_offers SET marca=$1, embalagem=$2, preco=$3, regioes=$4, prazo_dias=$5, validade_ate=$6, estoque=$7, updated_at=now()
      WHERE id = $8 AND supplier_id = $9 RETURNING *`, [v.marca, v.embalagem, v.preco, v.regioes, v.prazo, v.validade, v.estoque, req.params.id, s?.id]);
  if (!rows[0]) return res.status(404).json({ error: "Oferta não encontrada." });
  res.json({ oferta: rows[0] });
}));
router.delete("/suppliers/me/offers/:id", requireAuth, requireRole("fornecedor"), asyncHandler(async (req, res) => {
  const s = await meuFornecedor(req.user.id);
  const { rowCount } = await pool.query("UPDATE supplier_offers SET ativo = false, updated_at = now() WHERE id = $1 AND supplier_id = $2", [req.params.id, s?.id]);
  if (!rowCount) return res.status(404).json({ error: "Oferta não encontrada." });
  res.json({ ok: true });
}));

// ---------------- trading ----------------
async function minhaTrading(userId) {
  const { rows } = await pool.query("SELECT t.* FROM traders t JOIN users u ON u.trader_id = t.id WHERE u.id = $1", [userId]);
  return rows[0] || null;
}
router.get("/traders/me", requireAuth, requireRole("trading"), asyncHandler(async (req, res) => {
  const t = await minhaTrading(req.user.id);
  if (!t) return res.status(404).json({ error: "Cadastro de trading não encontrado." });
  res.json({ trading: t });
}));
router.put("/traders/me", requireAuth, requireRole("trading"), asyncHandler(async (req, res) => {
  const t = await minhaTrading(req.user.id);
  if (!t) return res.status(404).json({ error: "Cadastro de trading não encontrado." });
  const pracas = req.body?.pracas !== undefined ? listaUF(req.body.pracas) : t.pracas;
  const culturas = Array.isArray(req.body?.culturas) ? req.body.culturas.filter((c) => CULTURAS.includes(c)) : t.culturas;
  const { rows } = await pool.query("UPDATE traders SET pracas = $1, culturas = $2, telefone = COALESCE($3, telefone) WHERE id = $4 RETURNING *",
    [pracas, culturas, req.body?.telefone || null, t.id]);
  res.json({ trading: rows[0] });
}));
// produção em andamento (prévia da mesa de vendas, v4.3): só tradings aprovadas
router.get("/traders/producao", requireAuth, requireRole("trading", "admin", "fundo"), asyncHandler(async (req, res) => {
  if (req.user.role === "trading") {
    const t = await minhaTrading(req.user.id);
    if (!t || t.status !== "aprovado") return res.status(403).json({ error: "Seu cadastro ainda está em análise. A produção aparece depois da aprovação." });
  }
  const { rows } = await pool.query(
    `SELECT p.grao AS cultura, split_part(f.location, ', ', 2) AS uf, COUNT(*)::int AS talhoes, ROUND(SUM(p.area_ha))::int AS area_ha,
            ROUND(SUM(p.area_ha * COALESCE(p.produtividade_ha, 0)))::int AS sacas_previstas, MIN(p.colheita_prevista) AS primeira_colheita, MAX(p.colheita_prevista) AS ultima_colheita
       FROM plots p JOIN farms f ON f.id = p.farm_id
      WHERE p.status IN ('captacao','em_andamento') AND p.aprovacao_status = 'aprovado'
      GROUP BY 1, 2 ORDER BY 1, 2`);
  res.json({ producao: rows });
}));

// ---------------- administração ----------------
router.get("/admin/marketplace/cadastros", requireAuth, requireRole("admin", "fundo"), asyncHandler(async (req, res) => {
  const { rows: fornecedores } = await pool.query(
    `SELECT s.*, u.name AS responsavel, u.email, (SELECT COUNT(*)::int FROM supplier_offers o WHERE o.supplier_id = s.id AND o.ativo) AS ofertas
       FROM suppliers s LEFT JOIN users u ON u.id = s.owner_user_id ORDER BY (s.status = 'pendente') DESC, s.razao_social`);
  const { rows: tradings } = await pool.query(
    "SELECT t.*, u.name AS responsavel, u.email FROM traders t LEFT JOIN users u ON u.id = t.owner_user_id ORDER BY (t.status = 'pendente') DESC, t.razao_social");
  res.json({ fornecedores, tradings });
}));
router.post("/admin/marketplace/:tipo/:id/status", requireAuth, requireRole("admin", "fundo"), asyncHandler(async (req, res) => {
  const tabela = req.params.tipo === "fornecedor" ? "suppliers" : req.params.tipo === "trading" ? "traders" : null;
  const status = req.body?.status;
  if (!tabela || !["aprovado", "suspenso", "pendente"].includes(status)) return res.status(400).json({ error: "Pedido inválido." });
  const { rows } = await pool.query(`UPDATE ${tabela} SET status = $1 WHERE id = $2 RETURNING *`, [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Cadastro não encontrado." });
  try {
    const { notifyUsers } = require("../notify");
    if (rows[0].owner_user_id) await notifyUsers(pool, [rows[0].owner_user_id], { senderRole: "admin", type: "cadastro",
      title: status === "aprovado" ? "Cadastro aprovado" : status === "suspenso" ? "Cadastro suspenso" : "Cadastro em análise",
      body: status === "aprovado" ? (tabela === "suppliers" ? "Suas ofertas já aparecem para as fazendas da sua região." : "Você já pode acompanhar a produção em andamento.") : "Fale com a administração para mais detalhes." });
  } catch (e) { console.error("[aviso] status marketplace:", e.message); }
  res.json({ cadastro: rows[0] });
}));
router.put("/admin/catalog/items/:id", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE catalog_items SET nome = COALESCE($1, nome), detalhe = COALESCE($2, detalhe), unidade_compra = COALESCE($3, unidade_compra),
            exige_receita = COALESCE($4, exige_receita), ativo = COALESCE($5, ativo) WHERE id = $6 RETURNING *`,
    [b.nome || null, b.detalhe ?? null, b.unidade_compra ?? null, typeof b.exige_receita === "boolean" ? b.exige_receita : null, typeof b.ativo === "boolean" ? b.ativo : null, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Item não encontrado." });
  res.json({ item: rows[0] });
}));
router.post("/admin/catalog/items", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!CATEGORIAS.includes(b.categoria) || !b.nome || !["t","kg","L","ha","saca","un"].includes(b.unidade_dose)) return res.status(400).json({ error: "Informe categoria, nome e unidade da dose." });
  const fator = { t: 1, kg: 0.001, L: 0.001, ha: 0, saca: 0, un: 0 }[b.unidade_dose];
  const { rows } = await pool.query(
    "INSERT INTO catalog_items (categoria, nome, detalhe, unidade_dose, unidade_compra, fator_t, exige_receita) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
    [b.categoria, String(b.nome).slice(0, 120), b.detalhe || null, b.unidade_dose, b.unidade_compra || null, fator, b.categoria === "defensivo" || !!b.exige_receita]);
  res.status(201).json({ item: rows[0] });
}));
router.put("/admin/catalog/doses", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const ref = num(b.dose_ref);
  if (!b.catalog_item_id || !b.cultura || !(ref > 0)) return res.status(400).json({ error: "Informe item, cultura e dose de referência." });
  const { rows } = await pool.query(
    `INSERT INTO reference_doses (catalog_item_id, cultura, uf, dose_min, dose_ref, dose_max, aplicacoes, safras_efeito)
     VALUES ($1,$2,COALESCE($3,'BR'),$4,$5,$6,COALESCE($7,1),COALESCE($8,1))
     ON CONFLICT (catalog_item_id, cultura, uf) DO UPDATE SET dose_min = EXCLUDED.dose_min, dose_ref = EXCLUDED.dose_ref, dose_max = EXCLUDED.dose_max,
       aplicacoes = EXCLUDED.aplicacoes, safras_efeito = EXCLUDED.safras_efeito RETURNING *`,
    [b.catalog_item_id, b.cultura, b.uf || null, num(b.dose_min), ref, num(b.dose_max), num(b.aplicacoes), num(b.safras_efeito)]);
  res.json({ dose: rows[0] });
}));

module.exports = router;
module.exports.UFS = UFS;
module.exports.CATEGORIAS = CATEGORIAS;
