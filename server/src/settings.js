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

// mapa { fase: multiplicador } — usado para calcular o preço da cota
// conforme a fase atual do talhão
async function getFasePricingMap() {
  const { rows } = await pool.query("SELECT fase, multiplicador FROM fase_pricing ORDER BY fase");
  const map = {};
  for (const r of rows) map[r.fase] = Number(r.multiplicador);
  return map;
}

async function getFaseMultiplier(fase) {
  const map = await getFasePricingMap();
  // fase 5 (colheita) não é vendável, mas se for consultada usa o teto da fase 4
  return map[fase] ?? map[4] ?? 1;
}

async function setFaseMultiplier(fase, multiplicador) {
  const { rows } = await pool.query(
    `INSERT INTO fase_pricing (fase, multiplicador) VALUES ($1, $2)
     ON CONFLICT (fase) DO UPDATE SET multiplicador = $2 RETURNING *`,
    [fase, multiplicador]
  );
  return rows[0];
}

// dados da empresa nas páginas legais (LGPD e CVM)
const EMPRESA_CAMPOS = ["razaoSocial", "cnpj", "endereco", "encarregado", "emailPrivacidade", "emailCompliance", "emailOuvidoria", "plataformaCvm", "foro"];
const EMPRESA_PADRAO = {
  razaoSocial: "", cnpj: "", endereco: "", encarregado: "",
  emailPrivacidade: "privacidade@meutalhao.com.br", emailCompliance: "compliance@meutalhao.com.br", emailOuvidoria: "ouvidoria@meutalhao.com.br",
  plataformaCvm: "", foro: "",
};
async function getEmpresa() {
  const { rows } = await pool.query("SELECT legal_empresa, updated_at FROM platform_settings WHERE id = 1");
  return { ...EMPRESA_PADRAO, ...(rows[0]?.legal_empresa || {}) };
}
async function setEmpresa(dados) {
  const limpo = {};
  for (const k of EMPRESA_CAMPOS) limpo[k] = String(dados?.[k] ?? "").trim().slice(0, 300);
  await pool.query("UPDATE platform_settings SET legal_empresa = $1, updated_at = now() WHERE id = 1", [limpo]);
  return getEmpresa();
}

module.exports = {
  getEmpresa, setEmpresa, EMPRESA_CAMPOS,
  getAppCommissionPct, setAppCommissionPct,
  getFasePricingMap, getFaseMultiplier, setFaseMultiplier,
};
