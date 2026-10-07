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

-- Perfil estendido da fazenda: descrição livre escrita pelo próprio
-- produtor, e um campo separado para prêmios/reconhecimentos (o
-- investidor lê isso antes de decidir investir).
ALTER TABLE farms ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS premiacoes TEXT;

-- Dados legais/da propriedade — necessários para contratos futuros
-- (CPR, termos de investimento etc). tipo_pessoa define se a fazenda
-- opera no CPF do próprio produtor ("fisica") ou tem CNPJ próprio
-- ("juridica"). CNPJ e razão social são exibidos publicamente como
-- selo de confiança (dado público no Brasil); os demais campos
-- (endereço, CAR, matrícula) ficam visíveis só para o dono e o admin.
ALTER TABLE farms ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'fisica';
ALTER TABLE farms ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS car_numero TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS matricula_imovel TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS area_total_ha REAL;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;

-- Catálogo de características técnicas que uma fazenda pode ter
-- (irrigação, agricultura de precisão, maquinário, certificações etc).
-- Cada característica vale uma quantidade de pontos, e a nota em
-- estrelas da fazenda é calculada a partir de quantos pontos ela
-- acumula em relação ao total possível do catálogo. Editável pelo
-- admin (pontos e categoria), igual à referência de mercado.
CREATE TABLE IF NOT EXISTS farm_characteristics_catalog (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  categoria TEXT NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 1
);

-- quais características cada fazenda marcou ter
CREATE TABLE IF NOT EXISTS farm_characteristics (
  farm_id INTEGER NOT NULL REFERENCES farms(id),
  characteristic_key TEXT NOT NULL REFERENCES farm_characteristics_catalog(key),
  PRIMARY KEY (farm_id, characteristic_key)
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

-- Qualificação legal completa da pessoa — necessária para contratos
-- futuros (CPR, termos de investimento etc). tipo_pessoa permite que
-- mesmo um investidor seja uma pessoa jurídica (ex: um fundo pequeno),
-- embora o caso comum seja pessoa física. Todos esses campos são
-- sempre privados — nunca expostos em nenhuma rota pública.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT DEFAULT 'fisica';
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rg TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rg_orgao_emissor TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nacionalidade TEXT DEFAULT 'Brasileira';
ALTER TABLE users ADD COLUMN IF NOT EXISTS estado_civil TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profissao TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_cep TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_numero TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_complemento TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_bairro TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_cidade TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS endereco_uf TEXT;
-- exclusão de conta pelo próprio usuário (exigência da Apple e do Google):
-- os dados pessoais são apagados/anonimizados e a linha fica marcada, para
-- preservar o histórico financeiro exigido por lei.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
-- ainda precisa ver) e "aguardando_aprovacao" (finalização solicitada
-- pela fazenda, esperando revisão do admin) sem exigir migração toda
-- vez. Validado na aplicação.
ALTER TABLE plots DROP CONSTRAINT IF EXISTS plots_status_check;

-- preço estimado de venda por unidade na colheita (o "alvo"). O preço da
-- cota (cota_valor) sobe conforme a fase avança, aproximando-se deste
-- valor — isso é o que faz o investidor que compra cedo pagar menos e
-- ter mais espaço de lucro do que quem compra mais perto da colheita.
ALTER TABLE plots ADD COLUMN IF NOT EXISTS preco_venda_estimado REAL;
UPDATE plots SET preco_venda_estimado = cota_valor WHERE preco_venda_estimado IS NULL;

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

-- Solicitação de finalização de colheita. A fazenda não paga direto:
-- ela pede, anexando um comprovante, e o pagamento só acontece depois
-- que um administrador revisa e aprova. Reduz (não elimina) o risco de
-- a fazenda declarar um resultado sem nenhuma verificação independente.
CREATE TABLE IF NOT EXISTS harvest_requests (
  id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(id),
  farm_id INTEGER NOT NULL REFERENCES farms(id),
  retorno_final REAL NOT NULL,
  comprovante_texto TEXT NOT NULL,
  comprovante_imagem TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo_rejeicao TEXT,
  requested_by INTEGER REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_harvest_requests_plot ON harvest_requests(plot_id);
CREATE INDEX IF NOT EXISTS idx_harvest_requests_status ON harvest_requests(status);

-- preço unitário efetivamente pago naquela compra (registro histórico —
-- não muda mesmo que o preço do talhão suba depois em fases seguintes)
ALTER TABLE investments ADD COLUMN IF NOT EXISTS preco_unitario REAL;
UPDATE investments SET preco_unitario = valor_investido / NULLIF(cotas, 0) WHERE preco_unitario IS NULL;

-- Multiplicador de preço por fase da safra (0 = Preparo do solo, mais
-- barato; 4 = Ponto de colheita, mais caro e mais perto do preço de
-- venda estimado). A fase 5 (Colheita) não é vendável. Editável pela
-- administração.
CREATE TABLE IF NOT EXISTS fase_pricing (
  fase INTEGER PRIMARY KEY,
  multiplicador REAL NOT NULL
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

-- Fotos da fazenda (perfil, vitrine de confiança) e do talhão (lavoura/safra
-- daquele ciclo). Mesma estratégia de avatar_data/comprovante_imagem: base64
-- direto no Postgres, sem serviço de storage externo. Cada linha pertence a
-- exatamente uma fazenda OU um talhão, nunca aos dois.
CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id),
  plot_id INTEGER REFERENCES plots(id),
  data TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (farm_id IS NOT NULL AND plot_id IS NULL) OR
    (farm_id IS NULL AND plot_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_photos_farm ON photos(farm_id, position);
CREATE INDEX IF NOT EXISTS idx_photos_plot ON photos(plot_id, position);

-- ===================== Armazéns (garantidores) =====================
-- O armazém é o 4º perfil da plataforma: valida, de forma independente,
-- que a fazenda plantou, colheu e armazenou o que declarou. Para o
-- investidor, o armazém é o garantidor físico da commodity.
CREATE TABLE IF NOT EXISTS warehouses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  location TEXT NOT NULL,
  capacidade_t REAL,
  descricao TEXT,
  owner_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','suspenso')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','fazenda','investidor','armazem'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_sender_role_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_sender_role_check CHECK (sender_role IN ('sistema','fazenda','admin','armazem'));

-- custódia: a fazenda indica o armazém ao publicar o talhão; o armazém
-- aceita (passa a validar e garantir) ou recusa (com motivo)
ALTER TABLE plots ADD COLUMN IF NOT EXISTS warehouse_id INTEGER REFERENCES warehouses(id);
ALTER TABLE plots ADD COLUMN IF NOT EXISTS custodia_status TEXT;      -- pendente | aceita | recusada
ALTER TABLE plots ADD COLUMN IF NOT EXISTS custodia_motivo TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS custodia_em TIMESTAMPTZ;

-- validações do armazém, uma por etapa (refazer a validação substitui a anterior)
CREATE TABLE IF NOT EXISTS plot_validations (
  id SERIAL PRIMARY KEY,
  plot_id INTEGER NOT NULL REFERENCES plots(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  etapa TEXT NOT NULL CHECK (etapa IN ('plantio','colheita','armazenagem')),
  resultado TEXT NOT NULL CHECK (resultado IN ('confirmado','divergente')),
  quantidade REAL,
  observacao TEXT,
  foto TEXT,
  validated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plot_id, etapa)
);
CREATE INDEX IF NOT EXISTS idx_plots_warehouse ON plots(warehouse_id);

-- ===================== Culturas, ciclo e aprovação de talhões =====================
-- "grao" continua sendo o nome da cultura (Soja, Bovinos de corte…) para não
-- quebrar dados e filtros existentes; a variedade e o tipo de produção
-- (lavoura, pecuária, produção animal) definem nomes de fases e unidades.
ALTER TABLE plots ADD COLUMN IF NOT EXISTS variedade TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS tipo_producao TEXT NOT NULL DEFAULT 'lavoura';
ALTER TABLE plots ADD COLUMN IF NOT EXISTS plantio_ate DATE;          -- prazo do plantio / entrada dos animais
ALTER TABLE plots ADD COLUMN IF NOT EXISTS colheita_prevista DATE;    -- data prevista da colheita / venda

-- controle da administração: talhão novo só aparece para investidores
-- depois de aprovado pela administração E com a custódia aceita pelo armazém
ALTER TABLE plots ADD COLUMN IF NOT EXISTS aprovacao_status TEXT;     -- pendente | aprovado | rejeitado
ALTER TABLE plots ADD COLUMN IF NOT EXISTS aprovacao_motivo TEXT;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS aprovacao_em TIMESTAMPTZ;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS exige_garantia BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE plots ADD COLUMN IF NOT EXISTS publicado_em TIMESTAMPTZ;
-- talhões criados antes desta regra continuam publicados como estavam
UPDATE plots SET aprovacao_status = 'aprovado', publicado_em = COALESCE(publicado_em, created_at) WHERE aprovacao_status IS NULL;

-- unidades novas (kg, litro, dúzia…) para produção animal
ALTER TABLE plots DROP CONSTRAINT IF EXISTS plots_unidade_check;
ALTER TABLE commodity_references DROP CONSTRAINT IF EXISTS commodity_references_unidade_check;

-- ===================== Pontuação dos armazéns =====================
-- Mesmo modelo das fazendas: o armazém marca o que tem, cada item vale
-- pontos (editáveis pela administração) e a nota vira 0–5 estrelas.
-- A capacidade estática soma pontos automaticamente por faixa.
CREATE TABLE IF NOT EXISTS warehouse_characteristics_catalog (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  categoria TEXT NOT NULL,
  pontos INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS warehouse_characteristics (
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  characteristic_key TEXT NOT NULL REFERENCES warehouse_characteristics_catalog(key),
  PRIMARY KEY (warehouse_id, characteristic_key)
);
`;

// referências de mercado de cada cultura (ver culturas.js)
const COMMODITY_DEFAULTS = require("./culturas").REFERENCIAS;

const WAREHOUSE_CHARACTERISTICS_DEFAULTS = [
  // key, label, categoria, pontos
  ["silo_metalico", "Silos metálicos", "Estrutura", 2],
  ["armazem_graneleiro", "Armazém graneleiro", "Estrutura", 1],
  ["camara_fria", "Câmara fria / armazenagem refrigerada", "Estrutura", 2],
  ["balanca_rodoviaria", "Balança rodoviária aferida", "Estrutura", 2],
  ["secador", "Secador de grãos", "Estrutura", 1],
  ["acesso_ferroviario", "Acesso ferroviário ou hidroviário", "Estrutura", 1],
  ["termometria", "Termometria nos silos", "Tecnologia", 2],
  ["aeracao_automatica", "Aeração automática", "Tecnologia", 1],
  ["laboratorio", "Laboratório de classificação", "Tecnologia", 2],
  ["sistema_rastreio", "Sistema de controle de estoque e rastreabilidade", "Tecnologia", 2],
  ["monitoramento_cftv", "Monitoramento por câmeras 24 h", "Segurança", 2],
  ["vigilancia", "Vigilância patrimonial", "Segurança", 1],
  ["seguro_estoque", "Seguro do estoque armazenado", "Segurança", 3],
  ["brigada_incendio", "Prevenção e combate a incêndio (AVCB)", "Segurança", 2],
  ["certificado_mapa", "Certificado no MAPA (Lei 9.973/2000)", "Certificações", 3],
  ["armazem_geral", "Armazém geral (emite CDA/WA)", "Certificações", 3],
  ["iso_9001", "ISO 9001", "Certificações", 1],
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

async function ensureWarehouseCharacteristics() {
  for (const [key, label, categoria, pontos] of WAREHOUSE_CHARACTERISTICS_DEFAULTS) {
    await pool.query(
      `INSERT INTO warehouse_characteristics_catalog (key, label, categoria, pontos)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [key, label, categoria, pontos]
    );
  }
}

async function ensurePlatformSettings() {
  await pool.query(
    `INSERT INTO platform_settings (id, app_commission_pct) VALUES (1, 5) ON CONFLICT (id) DO NOTHING`
  );
}

// preço sobe conforme a safra avança: quem compra na fase 0 paga o preço
// mais baixo (mais risco, mais espaço de lucro); quem compra na fase 4
// (ponto de colheita) paga mais perto do preço de venda estimado.
// Calibrado para que, num cenário normal de colheita (retorno_final na
// faixa do previsao_retorno cadastrado, tipicamente 10-20%), TODAS as
// fases ainda dêem lucro ao investidor — só que menor quanto mais tarde
// a compra. Ajuste com cautela: multiplicadores altos demais na última
// fase podem deixar quem compra por último sempre no prejuízo.
const FASE_PRICING_DEFAULTS = [
  [0, 1.00], // Preparo do solo
  [1, 1.03], // Plantio
  [2, 1.06], // Germinação
  [3, 1.10], // Manejo e combate a pragas
  [4, 1.15], // Ponto de colheita
];

async function ensureFasePricing() {
  for (const [fase, multiplicador] of FASE_PRICING_DEFAULTS) {
    await pool.query(
      `INSERT INTO fase_pricing (fase, multiplicador) VALUES ($1, $2) ON CONFLICT (fase) DO NOTHING`,
      [fase, multiplicador]
    );
  }
}

// catálogo inicial de características técnicas que uma fazenda pode
// destacar — pontos ilustrativos, ajustáveis pelo admin depois
const FARM_CHARACTERISTICS_DEFAULTS = [
  // key, label, categoria, pontos
  ["irrigacao_pivo", "Área irrigada com pivô central", "Infraestrutura e irrigação", 3],
  ["irrigacao_gotejamento", "Irrigação por gotejamento", "Infraestrutura e irrigação", 2],
  ["armazenagem_propria", "Armazenagem própria (silos)", "Infraestrutura e irrigação", 2],
  ["agricultura_precisao", "Agricultura de precisão (GPS, piloto automático)", "Tecnologia", 3],
  ["monitoramento_satelite", "Monitoramento por satélite ou drone", "Tecnologia", 2],
  ["sensores_solo_clima", "Sensores de solo e clima", "Tecnologia", 2],
  ["plantio_direto", "Plantio direto", "Tecnologia", 1],
  ["maquinario_recente", "Maquinário de última geração (menos de 5 anos)", "Maquinário", 2],
  ["frota_propria", "Frota própria de colheitadeiras", "Maquinário", 1],
  ["certificacao_ambiental", "Certificação ambiental / manejo sustentável", "Sustentabilidade", 2],
  ["energia_solar", "Energia solar na propriedade", "Sustentabilidade", 1],
  ["premiacoes_recebidas", "Prêmios ou reconhecimentos recebidos", "Reconhecimento", 3],
  ["certificacao_qualidade", "Certificação de qualidade/rastreabilidade", "Reconhecimento", 2],
  ["experiencia_10anos", "Mais de 10 anos de atuação", "Experiência", 1],
  ["sucessao_familiar", "Sucessão familiar consolidada", "Experiência", 1],
];

async function ensureFarmCharacteristics() {
  for (const [key, label, categoria, pontos] of FARM_CHARACTERISTICS_DEFAULTS) {
    await pool.query(
      `INSERT INTO farm_characteristics_catalog (key, label, categoria, pontos)
       VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [key, label, categoria, pontos]
    );
  }
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
  await ensureFasePricing();
  await ensureFarmCharacteristics();
  await ensureWarehouseCharacteristics();
}

module.exports = { pool, initDb };
