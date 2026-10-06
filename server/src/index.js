require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { initDb } = require("./db");

const DEFAULT_JWT_SECRET = "troque-este-valor-por-uma-chave-secreta-forte";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[erro] defina JWT_SECRET no .env com uma chave secreta forte antes de rodar em produção.\n" +
        "       gere uma com: openssl rand -hex 32"
    );
    process.exit(1);
  }
  console.warn("[aviso] JWT_SECRET não definida — usando um valor de exemplo apenas para ambiente local.");
  // sem isso o login quebrava com erro 500 ("secretOrPrivateKey must have a value")
  process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
}

// CLIENT_ORIGIN aceita uma lista separada por vírgula. Além do domínio web,
// os apps nativos (Capacitor) fazem requisições a partir de origens próprias:
// iOS usa "capacitor://localhost" e Android usa "https://localhost". Essas
// duas são liberadas automaticamente para o app das lojas funcionar.
// Barras no final ("https://site.app/") são ignoradas para evitar bloqueio
// por diferença de digitação.
function normalizeOrigin(o) {
  return String(o || "").trim().replace(/\/+$/, "").toLowerCase();
}

function buildCorsOptions() {
  const configured = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  if (configured.length === 0 || configured.includes("*")) {
    // mesmo comportamento da versão anterior: sem CLIENT_ORIGIN, qualquer site
    // pode chamar a API (a autenticação é por token, não por cookie)
    if (process.env.NODE_ENV === "production") {
      console.warn("[aviso] CLIENT_ORIGIN não definida — API aceitando qualquer origem. Defina o domínio do site para restringir.");
    }
    return { origin: true };
  }

  const allowed = new Set([...configured, "capacitor://localhost", "https://localhost", "http://localhost"]);
  console.log("[cors] origens liberadas:", [...allowed].join(", "));
  return {
    origin(origin, callback) {
      // requisições sem Origin (curl, health checks) passam
      if (!origin || allowed.has(normalizeOrigin(origin))) return callback(null, true);
      console.warn(`[cors] origem bloqueada: ${origin} — inclua em CLIENT_ORIGIN se for legítima`);
      return callback(null, false);
    },
  };
}

async function start() {
  await initDb(); // cria as tabelas (se não existirem) e o usuário admin inicial

  const authRoutes = require("./routes/auth");
  const farmRoutes = require("./routes/farms");
  const plotRoutes = require("./routes/plots");
  const investmentRoutes = require("./routes/investments");
  const adminRoutes = require("./routes/admin");
  const notificationRoutes = require("./routes/notifications");
  const conversationRoutes = require("./routes/conversations");
  const paymentRoutes = require("./routes/payments");
  const commodityRoutes = require("./routes/commodities");
  const fasePricingRoutes = require("./routes/fasePricing");
  const harvestRequestRoutes = require("./routes/harvestRequests");
  const trackRecordRoutes = require("./routes/trackRecord");
  const farmCharacteristicsRoutes = require("./routes/farmCharacteristics");
  const warehouseRoutes = require("./routes/warehouses");
  const { startReminderScheduler } = require("./reminders");

  const app = express();

  // Atrás de proxy (Render, Railway, Fly, Nginx) o IP real vem em
  // X-Forwarded-For. Sem isso todos os usuários "pareciam" ter o mesmo IP e
  // dividiam o mesmo limite de requisições — o app travava com pouco uso.
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: "2mb" })); // acomoda foto de perfil em base64

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(globalLimiter);

  app.get("/api/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/farms/track-record", trackRecordRoutes);
  app.use("/api/farms", farmRoutes);
  app.use("/api/plots", plotRoutes);
  app.use("/api/investments", investmentRoutes);
  app.use("/api/admin/harvest-requests", harvestRequestRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/commodities", commodityRoutes);
  app.use("/api/fase-pricing", fasePricingRoutes);
  app.use("/api/farm-characteristics", farmCharacteristicsRoutes);
  app.use("/api/warehouses", warehouseRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Erro interno. Tente novamente em instantes." });
  });

  app.use((req, res) => res.status(404).json({ error: "Rota não encontrada." }));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`[talhao-server] rodando em http://localhost:${PORT}`);
    startReminderScheduler();
  });
}

start().catch((err) => {
  console.error("[erro fatal ao iniciar o servidor]", err);
  process.exit(1);
});
