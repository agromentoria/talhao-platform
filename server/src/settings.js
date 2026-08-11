const { pool } = require("./db");

async function getAppCommissionPct() {
  const { rows } = await pool.query("SELECT app_commission_pct FROM platform_settings WHERE id = 1");
  return rows[0] ? Number(rows[0].app_commission_pct) : 5;
}

async function setAppCommissionPct(pct) {
  const { rows } = await pool.query(
    "UPDATE platform_settings SET app_commission_pct = $1, updated_at = now() WHERE id = 1 RETURNING *",
    [pct]
  );
  return rows[0];
}

module.exports = { getAppCommissionPct, setAppCommissionPct };
