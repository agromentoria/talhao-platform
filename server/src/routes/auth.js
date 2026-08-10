const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

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

// Cadastro público. Só permite os papéis "investidor" e "fazenda".
// Uma conta "fazenda" nasce vinculada a uma fazenda em status "pendente",
// que precisa ser aprovada por um administrador antes de publicar talhões.
router.post("/register", (req, res) => {
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
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(emailLower);
  if (existing) {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }

  const hash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    const userInfo = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(name, emailLower, hash, role);
    const userId = userInfo.lastInsertRowid;

    let farmId = null;
    if (role === "fazenda") {
      const farmInfo = db
        .prepare(
          "INSERT INTO farms (name, location, owner_user_id, status) VALUES (?, ?, ?, 'pendente')"
        )
        .run(farmName, farmLocation, userId);
      farmId = farmInfo.lastInsertRowid;
      db.prepare("UPDATE users SET farm_id = ? WHERE id = ?").run(farmId, userId);
    }

    return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  });

  const user = tx();
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
  res.json({ user: publicUser(user) });
});

module.exports = router;
