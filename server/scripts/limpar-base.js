/* Limpa a base: apaga TODOS os dados (fazendas, talhões, investidores, armazéns,
 * fornecedores, tradings, compras, pagamentos, conversas, avisos, documentos) e
 * mantém só as contas de administração e as configurações da plataforma
 * (catálogo de itens, doses de referência, preços de referência, preço por fase,
 * catálogos de características, dados da empresa, limites e chaves).
 *
 * Por segurança só roda com confirmação explícita:
 *   CONFIRMAR=APAGAR-TUDO node scripts/limpar-base.js
 */
require("dotenv").config();
const { pool, initDb } = require("../src/db");

// ordem: primeiro quem depende, depois de quem se depende
const TABELAS = [
  "purchase_order_items", "purchase_orders", "plot_plan_items", "supplier_offers",
  "payouts", "transactions", "referral_rewards", "plot_waitlist", "investments",
  "plot_costs", "plot_budget", "plot_validations", "progress_updates", "photos", "harvest_requests", "plot_documents",
  "notifications", "messages", "conversation_reads", "conversations",
  "payment_methods", "payout_accounts", "admin_audit_log",
  "farm_characteristics", "warehouse_characteristics",
];

(async () => {
  if (process.env.CONFIRMAR !== "APAGAR-TUDO") {
    console.error("Isto apaga todos os dados e mantém só o administrador. Para confirmar, rode:\n  CONFIRMAR=APAGAR-TUDO node scripts/limpar-base.js");
    process.exit(1);
  }
  await initDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: existentes } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tem = new Set(existentes.map((r) => r.table_name));
    for (const t of TABELAS) if (tem.has(t)) await client.query(`DELETE FROM ${t}`);
    // desliga os vínculos das contas de administração antes de apagar fazendas, armazéns etc.
    await client.query(`UPDATE users SET farm_id = NULL, warehouse_id = NULL, supplier_id = NULL, trader_id = NULL, indicado_por = NULL WHERE role = 'admin'`);
    await client.query("UPDATE users SET indicado_por = NULL");
    await client.query("DELETE FROM plots");
    for (const t of ["suppliers", "traders"]) if (tem.has(t)) { await client.query(`UPDATE users SET ${t === "suppliers" ? "supplier_id" : "trader_id"} = NULL`); await client.query(`DELETE FROM ${t}`); }
    await client.query("UPDATE users SET farm_id = NULL, warehouse_id = NULL");
    await client.query("DELETE FROM farms");
    await client.query("DELETE FROM warehouses");
    const { rowCount } = await client.query("DELETE FROM users WHERE role <> 'admin'");
    await client.query("COMMIT");
    const { rows } = await pool.query("SELECT email FROM users ORDER BY id");
    console.log(`Base limpa: ${rowCount} contas apagadas. Contas mantidas: ${rows.map((r) => r.email).join(", ")}`);
  } catch (e) {
    await client.query("ROLLBACK"); console.error("Erro — nada foi apagado:", e.message); process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})();
