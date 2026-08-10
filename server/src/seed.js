require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool, initDb } = require("./db");

async function upsertFarmOwner(name, email, password) {
  const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (existing.rows.length) return existing.rows[0];

  const hash = bcrypt.hashSync(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'fazenda') RETURNING *",
    [name, email, hash]
  );
  return rows[0];
}

async function upsertFarm(name, location, ownerId, commission) {
  const existing = await pool.query("SELECT * FROM farms WHERE name = $1", [name]);
  if (existing.rows.length) return existing.rows[0];

  const { rows } = await pool.query(
    "INSERT INTO farms (name, location, owner_user_id, commission_pct, status) VALUES ($1, $2, $3, $4, 'aprovada') RETURNING *",
    [name, location, ownerId, commission]
  );
  const farm = rows[0];
  await pool.query("UPDATE users SET farm_id = $1 WHERE id = $2", [farm.id, ownerId]);
  return farm;
}

async function upsertPlot(farmId, nome, grao, area, safra, cotaValor, cotasTotais, retorno) {
  const existing = await pool.query("SELECT * FROM plots WHERE farm_id = $1 AND nome = $2", [farmId, nome]);
  if (existing.rows.length) return existing.rows[0];

  const disponiveis = Math.round(cotasTotais * 0.7);
  const { rows } = await pool.query(
    `INSERT INTO plots (farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [farmId, nome, grao, area, safra, cotaValor, cotasTotais, disponiveis, retorno]
  );
  return rows[0];
}

async function main() {
  await initDb();

  const boaVistaOwner = await upsertFarmOwner("Carlos Bittencourt", "contato@fazendaboavista.com.br", "senha12345");
  const boaVista = await upsertFarm("Fazenda Boa Vista", "Rio Verde, GO", boaVistaOwner.id, 12);
  await upsertPlot(boaVista.id, "Talhão 04", "Soja", 180, "2026/27", 240, 900, 18);
  await upsertPlot(boaVista.id, "Talhão 07", "Trigo", 140, "2026/27", 155, 500, 12);

  const santaLuziaOwner = await upsertFarmOwner("Marina Ferreira", "contato@santaluzia.com.br", "senha12345");
  const santaLuzia = await upsertFarm("Fazenda Santa Luzia", "Sorriso, MT", santaLuziaOwner.id, 15);
  await upsertPlot(santaLuzia.id, "Talhão 11", "Milho", 260, "2026/27", 190, 700, 15);
  await upsertPlot(santaLuzia.id, "Talhão 19", "Feijão", 90, "2026/27", 130, 400, 16);

  console.log("[seed] fazendas e talhões de exemplo criados.");
  console.log("[seed] login de exemplo (fazenda): contato@fazendaboavista.com.br / senha12345");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
