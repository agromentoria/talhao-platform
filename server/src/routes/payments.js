const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { onlyDigits, validatePixKey } = require("../validators");

const router = express.Router();

const BRANDS_BY_PREFIX = [
  { prefix: /^4/, brand: "Visa" },
  { prefix: /^5[1-5]/, brand: "Mastercard" },
  { prefix: /^3[47]/, brand: "American Express" },
  { prefix: /^6(?:011|5)/, brand: "Elo" },
];

function detectBrand(number) {
  const match = BRANDS_BY_PREFIX.find((b) => b.prefix.test(number));
  return match ? match.brand : "Cartão";
}

// validação simples de Luhn — não garante que o cartão é válido de verdade,
// só filtra números obviamente errados antes de qualquer tentativa de cobrança
function passesLuhn(number) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = parseInt(number[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// ---------- cartões salvos (somente investidor) ----------

router.get("/methods", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, type, brand, last4, holder_name, exp_month, exp_year, is_default, created_at FROM payment_methods WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
    [req.user.id]
  );
  res.json({ methods: rows });
}));

router.post("/methods", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { type, number, holder_name, exp_month, exp_year, cvv } = req.body || {};

  if (!["credito", "debito"].includes(type)) {
    return res.status(400).json({ error: "Escolha se o cartão é crédito ou débito." });
  }
  const digits = String(number || "").replace(/\D/g, "");
  const brand = detectBrand(digits);
  const expectedLength = brand === "American Express" ? 15 : 16;
  if (digits.length !== expectedLength || !passesLuhn(digits)) {
    return res.status(400).json({ error: "Número de cartão inválido." });
  }
  if (!holder_name || !String(holder_name).trim()) {
    return res.status(400).json({ error: "Informe o nome impresso no cartão." });
  }
  const month = Number(exp_month);
  const year = Number(exp_year);
  const now = new Date();
  if (!month || month < 1 || month > 12 || !year || year < now.getFullYear() || year > now.getFullYear() + 20) {
    return res.status(400).json({ error: "Validade do cartão inválida." });
  }
  if (year === now.getFullYear() && month < now.getMonth() + 1) {
    return res.status(400).json({ error: "Este cartão está vencido." });
  }
  if (!cvv || !/^\d{3}$/.test(String(cvv))) {
    return res.status(400).json({ error: "Código de segurança (CVV) deve ter 3 dígitos." });
  }

  // A PARTIR DAQUI o número completo e o CVV já cumpriram seu papel (validação)
  // e são descartados — nunca chegam a ser gravados no banco. Em produção,
  // essa etapa aconteceria inteiramente no front-end via SDK do gateway de
  // pagamento, e nosso backend receberia apenas um token; mantemos aqui a
  // validação básica só porque ainda não há gateway conectado.
  const last4 = digits.slice(-4);
  const fakeToken = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const isFirst = (await pool.query("SELECT COUNT(*) as n FROM payment_methods WHERE user_id = $1", [req.user.id])).rows[0].n === "0";

  const { rows } = await pool.query(
    `INSERT INTO payment_methods (user_id, type, brand, last4, holder_name, exp_month, exp_year, gateway_token, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, type, brand, last4, holder_name, exp_month, exp_year, is_default, created_at`,
    [req.user.id, type, brand, last4, String(holder_name).trim(), month, year, fakeToken, isFirst]
  );

  res.status(201).json({ method: rows[0] });
}));

router.delete("/methods/:id", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "DELETE FROM payment_methods WHERE id = $1 AND user_id = $2 RETURNING id, is_default",
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Cartão não encontrado." });

  // se o cartão removido era o padrão, promove o mais recente que sobrou
  if (rows[0].is_default) {
    await pool.query(
      `UPDATE payment_methods SET is_default = true WHERE id = (
         SELECT id FROM payment_methods WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
       )`,
      [req.user.id]
    );
  }
  res.json({ ok: true });
}));

router.patch("/methods/:id/default", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const owns = await pool.query("SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  if (!owns.rows.length) return res.status(404).json({ error: "Cartão não encontrado." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE payment_methods SET is_default = false WHERE user_id = $1", [req.user.id]);
    await client.query("UPDATE payment_methods SET is_default = true WHERE id = $1", [req.params.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

// ---------- dados de recebimento (investidor, fazenda e admin) ----------

router.get("/payout-account", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM payout_accounts WHERE user_id = $1", [req.user.id]);
  res.json({ account: rows[0] || null });
}));

router.put("/payout-account", requireAuth, asyncHandler(async (req, res) => {
  const { pix_tipo, pix_chave, banco, agencia, conta, titular } = req.body || {};

  if (!titular || !String(titular).trim()) {
    return res.status(400).json({ error: "Informe o nome do titular da conta." });
  }
  const temPix = pix_tipo && pix_chave;
  const temBanco = banco && agencia && conta;
  if (!temPix && !temBanco) {
    return res.status(400).json({ error: "Preencha uma chave Pix ou os dados bancários completos." });
  }
  if (pix_tipo && !["cpf", "cnpj", "email", "telefone", "aleatoria"].includes(pix_tipo)) {
    return res.status(400).json({ error: "Tipo de chave Pix inválido." });
  }

  let chaveNormalizada = pix_chave;
  if (temPix) {
    const erro = validatePixKey(pix_tipo, pix_chave);
    if (erro) return res.status(400).json({ error: erro });
    // CPF, CNPJ e telefone ficam salvos só com os dígitos — sem pontuação
    if (["cpf", "cnpj", "telefone"].includes(pix_tipo)) {
      chaveNormalizada = onlyDigits(pix_chave);
    }
  }

  let agenciaNormalizada = agencia;
  let contaNormalizada = conta;
  if (temBanco) {
    const agenciaDigitos = onlyDigits(agencia);
    const contaDigitos = onlyDigits(conta);
    if (agenciaDigitos.length < 3 || agenciaDigitos.length > 5) {
      return res.status(400).json({ error: "Agência inválida — informe de 3 a 5 dígitos." });
    }
    if (contaDigitos.length < 4 || contaDigitos.length > 13) {
      return res.status(400).json({ error: "Conta inválida — informe de 4 a 13 dígitos (com o dígito verificador)." });
    }
    agenciaNormalizada = agenciaDigitos;
    contaNormalizada = contaDigitos;
  }

  const { rows } = await pool.query(
    `INSERT INTO payout_accounts (user_id, pix_tipo, pix_chave, banco, agencia, conta, titular, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (user_id) DO UPDATE SET
       pix_tipo = $2, pix_chave = $3, banco = $4, agencia = $5, conta = $6, titular = $7, updated_at = now()
     RETURNING *`,
    [req.user.id, pix_tipo || null, chaveNormalizada || null, banco || null, agenciaNormalizada || null, contaNormalizada || null, String(titular).trim()]
  );
  res.json({ account: rows[0] });
}));

// ---------- transações ----------

router.get("/transactions/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, f.name as farm_name, p.nome as plot_nome
     FROM transactions t
     LEFT JOIN farms f ON f.id = t.farm_id
     LEFT JOIN plots p ON p.id = t.plot_id
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT 200`,
    [req.user.id]
  );
  res.json({ transactions: rows });
}));

module.exports = router;
