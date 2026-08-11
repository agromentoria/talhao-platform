const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

if (!process.env.DATABASE_URL) {
  console.error(
    "[erro] defina DATABASE_URL no .env com a string de conexão do seu banco Postgres (ex: Neon)."
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // A maioria dos provedores gratuitos de Postgres (Neon, Supabase) exige SSL.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS farms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  commission_pct REAL NOT NULL DEFAULT 10,
  owner_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','suspensa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','fazenda','investidor')),
  farm_id INTEGER REFERENCES farms(id),
  avatar_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_farm_owner'
  ) THEN
    ALTER TABLE farms ADD CONSTRAINT fk_farm_owner
      FOREIGN KEY (owner_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS plots (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER NOT NULL REFERENCES farms(id),
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(id),
  fase_atual INTEGER NOT NULL,
  progresso INTEGER NOT NULL,
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  plot_id INTEGER NOT NULL REFERENCES plots(id),
  cotas INTEGER NOT NULL,
  valor_investido REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pago','cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  investment_id INTEGER NOT NULL REFERENCES investments(id),
  valor_bruto REAL NOT NULL,
  comissao_fazenda REAL NOT NULL,
  comissao_app REAL NOT NULL,
  valor_liquido REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plots_farm ON plots(farm_id);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_plot ON investments(plot_id);
`;

async function ensureAdmin() {
  const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (rows.length) return;

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
  await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    [name, email, hash]
  );

  console.log(`[setup] usuário administrador criado: ${email}`);
  console.log("[setup] troque a senha assim que fizer o primeiro login.");
}

async function initDb() {
  await pool.query(SCHEMA);
  await ensureAdmin();
}

module.exports = { pool, initDb };
