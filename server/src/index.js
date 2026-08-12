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
  const { startReminderScheduler } = require("./reminders");

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN || "*",
      credentials: true,
    })
  );
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
