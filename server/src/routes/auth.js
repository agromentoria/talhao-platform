const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, farm_id: user.farm_id || null },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

router.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, role, farmName, farmLocation } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Preencha nome, e-mail, senha e tipo de conta." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 8 caracteres." });
  }
  if (!["investidor", "fazenda"].includes(role)) {
    return res.status(400).json({ error: "Tipo de conta inválido." });
  }
  if (role === "fazenda" && (!farmName || !farmLocation)) {
    return res.status(400).json({ error: "Informe o nome e a localização da fazenda." });
  }

  const emailLower = email.toLowerCase();
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [emailLower]);
  if (existing.rows.length) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, emailLower, hash, role]
    );
    let user = userResult.rows[0];

    if (role === "fazenda") {
      const farmResult = await client.query(
        "INSERT INTO farms (name, location, owner_user_id, status) VALUES ($1, $2, $3, 'pendente') RETURNING id",
        [farmName, farmLocation, user.id]
      );
      const farmId = farmResult.rows[0].id;
      await client.query("UPDATE users SET farm_id = $1 WHERE id = $2", [farmId, user.id]);
      user = { ...user, farm_id: farmId };
    }

    await client.query("COMMIT");

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

router.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [String(email).toLowerCase()]);
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}));

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json({ user: publicUser(rows[0]) });
}));

module.exports = router;
