/* Carga de demonstração do marketplace (v4.0): fornecedores aprovados com
 * ofertas em todo o catálogo (preços ilustrativos, entregues na fazenda) e
 * tradings aprovadas. Pode rodar quantas vezes quiser: apaga a carga anterior
 * (contas @fornecedores-demo e @tradings-demo) e recria.
 *   node scripts/carga-marketplace.js        (REMOVER=1 só apaga)
 * Senha de todas as contas: senha12345 (ou SENHA_DEMO). */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, initDb } = require("../src/db");

const SENHA = process.env.SENHA_DEMO || "senha12345";
const D_FOR = "fornecedores-demo.meutalhao.com.br", D_TRA = "tradings-demo.meutalhao.com.br";
// preço de referência por unidade da dose (R$/t, R$/kg, R$/L, R$/ha, R$/saca), entregue na fazenda — ilustrativo
const PRECO = {
  "Calcário dolomítico": 180, "Gesso agrícola": 210, "NPK 02-20-18": 3400, "MAP 11-52-00": 4300, "Cloreto de potássio (KCl)": 3100, "Ureia": 3200, "Superfosfato simples": 1900,
  "Boro foliar": 38, "Cobalto + molibdênio": 120, "Manganês foliar": 32,
  "Herbicida glifosato": 28, "Herbicida pré-emergente": 95, "Fungicida triazol + estrobilurina": 160, "Inseticida para lagartas": 290, "Inseticida para percevejos": 110,
  "Semente de soja": 9.5, "Semente de milho híbrido": 75, "Semente de feijão carioca": 12, "Inoculante": 45,
  "Diesel S10": 6.2, "Colheita terceirizada": 380, "Aplicação aérea": 85, "Frete do grão até o armazém": 3.5,
};
const FORNECEDORES = [
  { login: "agrocerrado", nome: "Agro Cerrado Insumos Ltda", resp: "Paulo Mendonça", cidade: "Rio Verde", uf: "GO", regioes: ["GO", "MT", "MG"], cats: ["corretivo", "fertilizante", "nutritivo", "defensivo"], marca: "Cerrado" },
  { login: "sementesplanalto", nome: "Sementes Planalto Ltda", resp: "Aline Duarte", cidade: "Cristalina", uf: "GO", regioes: ["GO", "MG", "MT", "MS"], cats: ["semente"], marca: "Planalto" },
  { login: "fertimax", nome: "Fertimax Centro-Oeste S.A.", resp: "Rodrigo Kuhn", cidade: "Sorriso", uf: "MT", regioes: ["MT", "MS", "GO"], cats: ["fertilizante", "corretivo"], marca: "Fertimax" },
  { login: "defensa", nome: "Defensa Agro Comércio Ltda", resp: "Camila Sato", cidade: "Dourados", uf: "MS", regioes: ["MS", "PR", "GO", "MT"], cats: ["defensivo", "nutritivo"], marca: "Defensa" },
  { login: "paranaagro", nome: "Paraná Agro Insumos Ltda", resp: "Leandro Bauer", cidade: "Cascavel", uf: "PR", regioes: ["PR", "MS", "MG"], cats: ["corretivo", "fertilizante", "nutritivo", "defensivo", "semente"], marca: "Paraná Agro" },
  { login: "postorural", nome: "Posto Rural Combustíveis Ltda", resp: "Edson Ribeiro", cidade: "Rio Verde", uf: "GO", regioes: ["GO", "MT", "MS", "MG"], cats: ["combustivel"], marca: "Posto Rural" },
  { login: "colheitacerta", nome: "Colheita Certa Serviços Agrícolas Ltda", resp: "Mauro Teles", cidade: "Jataí", uf: "GO", regioes: ["GO", "MT", "MS", "MG", "PR"], cats: ["servico"], marca: "Colheita Certa" },
];
const TRADINGS = [
  { login: "graosdobrasil", nome: "Grãos do Brasil Trading S.A.", resp: "Fernanda Lopes", cidade: "Rio Verde", uf: "GO", pracas: ["GO", "MT", "MS", "MG"], culturas: ["Soja", "Milho"] },
  { login: "cerealistasul", nome: "Cerealista Sul Comércio de Grãos Ltda", resp: "Henrique Wolff", cidade: "Cascavel", uf: "PR", pracas: ["PR", "MS", "MG"], culturas: ["Soja", "Milho", "Feijão"] },
];
function cnpj(seed) { // CNPJ válido determinístico
  const b = String(10000000 + seed * 7919).slice(0, 8).split("").map(Number).concat([0, 0, 0, 1]);
  const dv = (arr, pesos) => { const s = arr.reduce((t, n, i) => t + n * pesos[i], 0) % 11; return s < 2 ? 0 : 11 - s; };
  const d1 = dv(b, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]); const d2 = dv([...b, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...b, d1, d2].join("");
}
let semente = 7; const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);

async function remover(client) {
  const { rows } = await client.query("SELECT id FROM users WHERE email LIKE $1 OR email LIKE $2", [`%@${D_FOR}`, `%@${D_TRA}`]);
  const uids = rows.map((r) => r.id);
  if (!uids.length) return 0;
  await client.query("UPDATE users SET supplier_id = NULL, trader_id = NULL WHERE id = ANY($1)", [uids]);
  await client.query("DELETE FROM suppliers WHERE owner_user_id = ANY($1)", [uids]);
  await client.query("DELETE FROM traders WHERE owner_user_id = ANY($1)", [uids]);
  await client.query("DELETE FROM notifications WHERE recipient_user_id = ANY($1)", [uids]);
  await client.query("DELETE FROM users WHERE id = ANY($1)", [uids]);
  return uids.length;
}

(async () => {
  await initDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const apagadas = await remover(client);
    if (apagadas) console.log(`Carga anterior do marketplace removida: ${apagadas} contas.`);
    if (process.env.REMOVER === "1") { await client.query("COMMIT"); console.log("Pronto (só remoção)."); return; }
    const hash = await bcrypt.hash(SENHA, 10);
    const { rows: itens } = await client.query("SELECT id, nome, categoria FROM catalog_items WHERE ativo");
    let ofertas = 0;
    for (const [i, f] of FORNECEDORES.entries()) {
      const email = `${f.login}@${D_FOR}`;
      const { rows: u } = await client.query(
        "INSERT INTO users (name, email, password_hash, role, termos_aceitos_em, termos_versao) VALUES ($1,$2,$3,'fornecedor', now(), '2026-10') RETURNING id", [f.resp, email, hash]);
      const { rows: s } = await client.query(
        "INSERT INTO suppliers (owner_user_id, razao_social, cnpj, cidade, uf, regioes, categorias, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'aprovado') RETURNING id",
        [u[0].id, f.nome, cnpj(i + 1), f.cidade, f.uf, f.regioes, f.cats]);
      await client.query("UPDATE users SET supplier_id = $1 WHERE id = $2", [s[0].id, u[0].id]);
      for (const it of itens.filter((x) => f.cats.includes(x.categoria) && PRECO[x.nome])) {
        const preco = Math.round(PRECO[it.nome] * (0.92 + rnd() * 0.16) * 100) / 100;
        await client.query(
          `INSERT INTO supplier_offers (supplier_id, catalog_item_id, marca, embalagem, preco, regioes, prazo_dias, validade_ate)
           VALUES ($1,$2,$3,NULL,$4,$5,$6, CURRENT_DATE + 60)`, [s[0].id, it.id, f.marca, preco, f.regioes, 3 + Math.round(rnd() * 12)]);
        ofertas++;
      }
      console.log(`  ✓ ${f.nome} — ${email}`);
    }
    for (const [i, t] of TRADINGS.entries()) {
      const email = `${t.login}@${D_TRA}`;
      const { rows: u } = await client.query(
        "INSERT INTO users (name, email, password_hash, role, termos_aceitos_em, termos_versao) VALUES ($1,$2,$3,'trading', now(), '2026-10') RETURNING id", [t.resp, email, hash]);
      const { rows: tr } = await client.query(
        "INSERT INTO traders (owner_user_id, razao_social, cnpj, cidade, uf, pracas, culturas, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'aprovado') RETURNING id",
        [u[0].id, t.nome, cnpj(50 + i), t.cidade, t.uf, t.pracas, t.culturas]);
      await client.query("UPDATE users SET trader_id = $1 WHERE id = $2", [tr[0].id, u[0].id]);
      console.log(`  ✓ ${t.nome} — ${email}`);
    }
    await client.query("COMMIT");
    console.log(`\nPronto: ${FORNECEDORES.length} fornecedores (${ofertas} ofertas) e ${TRADINGS.length} tradings, todos aprovados. Senha: ${SENHA}`);
  } catch (e) {
    await client.query("ROLLBACK"); console.error("Erro — nada foi gravado:", e.message); process.exitCode = 1;
  } finally { client.release(); await pool.end(); }
})();
