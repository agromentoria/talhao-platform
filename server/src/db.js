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
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

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
  status TEXT NOT NULL DEFAULT 'captacao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- em versões anteriores "status" tinha uma lista fixa (captacao/em_andamento/
-- colhido/pago); removemos a checagem para permitir o status "arquivado"
-- (talhão pago que a fazenda excluiu, mas cujo histórico o investidor
-- ainda precisa ver) sem exigir migração toda vez. Validado na aplicação.
ALTER TABLE plots DROP CONSTRAINT IF EXISTS plots_status_check;

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

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('sistema','fazenda','admin')),
  farm_id INTEGER REFERENCES farms(id),
  plot_id INTEGER REFERENCES plots(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, created_at DESC);

-- em versões anteriores "type" tinha uma lista fixa de valores permitidos;
-- removemos a checagem para poder adicionar novos tipos de aviso (ex: pagamentos)
-- sem precisar de migração toda vez. A validação agora é feita na aplicação.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Modelo de conversas generalizado: qualquer par de usuários autorizado
-- (investidor↔fazenda, admin↔fazenda, admin↔investidor). Migra o formato
-- antigo (investor_user_id + farm_id) para participant_a_id/participant_b_id
-- caso o banco já tenha sido criado com o esquema anterior.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'investor_user_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_a_id INTEGER;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS participant_b_id INTEGER;
    UPDATE conversations c SET
      participant_a_id = LEAST(c.investor_user_id, f.owner_user_id),
      participant_b_id = GREATEST(c.investor_user_id, f.owner_user_id)
    FROM farms f
    WHERE f.id = c.farm_id AND c.participant_a_id IS NULL AND f.owner_user_id IS NOT NULL;
    DELETE FROM conversations WHERE participant_a_id IS NULL;
    ALTER TABLE conversations ALTER COLUMN participant_a_id SET NOT NULL;
    ALTER TABLE conversations ALTER COLUMN participant_b_id SET NOT NULL;
    ALTER TABLE conversations DROP COLUMN investor_user_id;
    ALTER TABLE conversations DROP COLUMN farm_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  participant_a_id INTEGER NOT NULL REFERENCES users(id),
  participant_b_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_a_id, participant_b_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  sender_user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

-- controla até quando cada participante já leu a conversa, para contar não lidas
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Cartões salvos pelo investidor para compras futuras.
-- IMPORTANTE: nunca armazenamos número completo do cartão nem CVV — apenas
-- os 4 últimos dígitos, bandeira e validade, para exibição. A cobrança real
-- (quando integrada a um gateway de verdade) usa um token gerado pelo
-- próprio gateway, nunca o número do cartão guardado aqui.
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('credito','debito')),
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  gateway_token TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);

-- Dados de recebimento: investidor (lucros), fazenda (repasse da comissão)
-- e administração (comissão da plataforma) usam a mesma estrutura.
CREATE TABLE IF NOT EXISTS payout_accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  pix_tipo TEXT CHECK (pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  pix_chave TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  titular TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Livro-razão de todas as movimentações financeiras da plataforma.
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- compra_cota | pagamento_investidor | repasse_fazenda | comissao_plataforma
  status TEXT NOT NULL DEFAULT 'aprovado', -- pendente | aprovado | recusado
  user_id INTEGER REFERENCES users(id),
  farm_id INTEGER REFERENCES farms(id),
  plot_id INTEGER REFERENCES plots(id),
  investment_id INTEGER REFERENCES investments(id),
  amount REAL NOT NULL,
  payment_method_type TEXT, -- pix | cartao_credito | cartao_debito
  payment_method_id INTEGER REFERENCES payment_methods(id),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);

-- Referência de mercado por commodity: unidade de comercialização (saca,
-- fardo ou arroba), preço de referência aproximado, e produtividade média
-- estimada por hectare. Editável pela administração — não é uma cotação
-- em tempo real, é um ponto de partida a ser atualizado periodicamente.
CREATE TABLE IF NOT EXISTS commodity_references (
  grao TEXT PRIMARY KEY,
  unidade TEXT NOT NULL,
  preco_unidade REAL NOT NULL,
  produtividade_ha REAL NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Configurações gerais da plataforma (linha única). Move a comissão da
-- Meu Talhão para o banco, para o administrador poder editar pelo app
-- em vez de depender de variável de ambiente fixa.
CREATE TABLE IF NOT EXISTS platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_commission_pct REAL NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

ALTER TABLE plots ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
`;

const COMMODITY_DEFAULTS = [
  // grao, unidade, preco_unidade (R$), produtividade_ha (unidades/hectare)
  // valores aproximados de referência — ajuste na administração conforme o mercado real
  ["Soja", "saca", 130, 60],
  ["Milho", "saca", 60, 100],
  ["Trigo", "saca", 75, 50],
  ["Arroz", "saca", 95, 110],
  ["Feijão", "saca", 220, 27],
  ["Algodão", "arroba", 140, 280],
];

async function ensureCommodityReferences() {
  for (const [grao, unidade, preco, produtividade] of COMMODITY_DEFAULTS) {
    await pool.query(
      `INSERT INTO commodity_references (grao, unidade, preco_unidade, produtividade_ha)
       VALUES ($1, $2, $3, $4) ON CONFLICT (grao) DO NOTHING`,
      [grao, unidade, preco, produtividade]
    );
  }
}

async function ensurePlatformSettings() {
  await pool.query(
    `INSERT INTO platform_settings (id, app_commission_pct) VALUES (1, 5) ON CONFLICT (id) DO NOTHING`
  );
}

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
  await ensureCommodityReferences();
  await ensurePlatformSettings();
}

module.exports = { pool, initDb };
