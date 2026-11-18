/* Demonstração completa, do zero (mantém só o administrador):
 *   1. limpa a base
 *   2. cria o gestor do fundo
 *   3. carga de um ano: 20 fazendas, armazéns, ~4.000 investidores e três ciclos
 *        · safra 2025/26 (soja): colhida, vendida e paga
 *        · safra 2026/27 (soja): em andamento no campo
 *        · safrinha 2027 (milho e sorgo): captação aberta
 *   4. fornecedores e tradings do marketplace
 *
 *   CONFIRMAR=APAGAR-TUDO node scripts/carga-demo.js
 * Senha de todas as contas de demonstração: senha12345 (ou SENHA_DEMO). */
require("dotenv").config();
const { execFileSync } = require("child_process");
const path = require("path");
const bcrypt = require("bcryptjs");

const rodar = (arq, env = {}) => execFileSync(process.execPath, [path.join(__dirname, arq)], { stdio: "inherit", env: { ...process.env, ...env } });

(async () => {
  if (process.env.CONFIRMAR !== "APAGAR-TUDO") {
    console.error("A demonstração começa apagando todos os dados (mantém só o administrador). Para confirmar:\n  CONFIRMAR=APAGAR-TUDO node scripts/carga-demo.js");
    process.exit(1);
  }
  const inicio = Date.now();
  console.log("\n1/4 Limpando a base…"); rodar("limpar-base.js");
  console.log("\n2/4 Criando o gestor do fundo…");
  {
    const { pool } = require("../src/db");
    const hash = await bcrypt.hash(process.env.SENHA_DEMO || "senha12345", 10);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, termos_aceitos_em, termos_versao) VALUES ('Gestor do Fundo', 'gestor@fundo-demo.meutalhao.com.br', $1, 'fundo', now(), '2026-10')
       ON CONFLICT (email) DO NOTHING`, [hash]);
    console.log("  ✓ gestor@fundo-demo.meutalhao.com.br");
  }
  console.log("\n3/4 Fazendas, armazéns, investidores e safras…"); rodar("carga-ano-completo.js");
  console.log("\n4/4 Fornecedores e tradings…"); rodar("carga-marketplace.js");
  {
    // regra de divisão gravada nos talhões da demonstração (a vigente: 20/75/5)
    const { pool } = require("../src/db");
    const { CUSTO } = require("../src/piso");
    await pool.query("UPDATE plots SET regra_lucro_investidor_pct = $1, regra_lucro_fazenda_pct = $2, regra_lucro_plataforma_pct = $3 WHERE modelo = 'custo' AND regra_lucro_investidor_pct IS NULL",
      [CUSTO.lucro_investidor_pct, CUSTO.lucro_fazenda_pct, CUSTO.lucro_plataforma_pct]);
    await pool.end();
  }
  console.log(`\nDemonstração pronta em ${Math.round((Date.now() - inicio) / 1000)} s.`);
})().catch((e) => { console.error("Erro:", e.message); process.exit(1); });
