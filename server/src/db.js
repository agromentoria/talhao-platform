const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = process.env.DB_PATH || "./data/talhao.db";
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','fazenda','investidor')),
  farm_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (farm_id) REFERENCES farms(id)
);

CREATE TABLE IF NOT EXISTS farms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 10,
  owner_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','suspensa')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  grao TEXT NOT NULL,
  area_ha REAL NOT NULL,
  safra TEXT NOT NULL,
  fase_atual INTEGER NOT NULL DEFAULT 0,
  progresso INTEGER NOT NULL DEFAULT 0,
  cota_valor REAL NOT NULL,
  cotas_totais INTEGER NOT NULL,
  cotas_disponiveis INTEGER NOT NULL,
  previsao_retorno REAL NOT NULL,
  retorno_final REAL,
  status TEXT NOT NULL DEFAULT 'captacao' CHECK (status IN ('captacao','em_andamento','colhido','pago')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (farm_id) REFERENCES farms(id)
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plot_id INTEGER NOT NULL,
  fase_atual INTEGER NOT NULL,
  progresso INTEGER NOT NULL,
  nota TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (plot_id) REFERENCES plots(id)
);

CREATE TABLE IF NOT EXISTS investments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plot_id INTEGER NOT NULL,
  cotas INTEGER NOT NULL,
  valor_investido REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pago','cancelado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plot_id) REFERENCES plots(id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  investment_id INTEGER NOT NULL,
  valor_bruto REAL NOT NULL,
  comissao_fazenda REAL NOT NULL,
  comissao_app REAL NOT NULL,
  valor_liquido REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (investment_id) REFERENCES investments(id)
);

CREATE INDEX IF NOT EXISTS idx_plots_farm ON plots(farm_id);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_plot ON investments(plot_id);
`);

// garante que sempre exista um administrador da plataforma (mediador)
function ensureAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (existing) return;

  const name = process.env.ADMIN_NAME || "Administrador Talhão";
  const email = (process.env.ADMIN_EMAIL || "admin@meutalhao.com.br").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password === "troque-esta-senha-no-primeiro-acesso") {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[erro] defina ADMIN_PASSWORD no .env com uma senha real antes de rodar em produção."
      );
      process.exit(1);
    }
    console.warn(
      "[aviso] ADMIN_PASSWORD não definida — usando uma senha temporária apenas para ambiente local."
    );
  }

  const hash = bcrypt.hashSync(password || "mude-esta-senha-local", 10);

  db.prepare(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
  ).run(name, email, hash);

  console.log(`[setup] usuário administrador criado: ${email}`);
  console.log("[setup] troque a senha assim que fizer o primeiro login.");
}

ensureAdmin();

module.exports = db;
