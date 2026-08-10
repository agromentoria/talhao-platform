require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

function upsertFarmOwner(name, email, password) {
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    const hash = bcrypt.hashSync(password, 10);
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'fazenda')")
      .run(name, email, hash);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  }
  return user;
}

function upsertFarm(name, location, ownerId, commission) {
  let farm = db.prepare("SELECT * FROM farms WHERE name = ?").get(name);
  if (!farm) {
    const info = db
      .prepare(
        "INSERT INTO farms (name, location, owner_user_id, commission_pct, status) VALUES (?, ?, ?, ?, 'aprovada')"
      )
      .run(name, location, ownerId, commission);
    farm = db.prepare("SELECT * FROM farms WHERE id = ?").get(info.lastInsertRowid);
    db.prepare("UPDATE users SET farm_id = ? WHERE id = ?").run(farm.id, ownerId);
  }
  return farm;
}

function upsertPlot(farmId, nome, grao, area, safra, cotaValor, cotasTotais, retorno) {
  const exists = db.prepare("SELECT * FROM plots WHERE farm_id = ? AND nome = ?").get(farmId, nome);
  if (exists) return exists;
  const info = db
    .prepare(
      `INSERT INTO plots (farm_id, nome, grao, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(farmId, nome, grao, area, safra, cotaValor, cotasTotais, Math.round(cotasTotais * 0.7), retorno);
  return db.prepare("SELECT * FROM plots WHERE id = ?").get(info.lastInsertRowid);
}

const boaVistaOwner = upsertFarmOwner("Carlos Bittencourt", "contato@fazendaboavista.com.br", "senha12345");
const boaVista = upsertFarm("Fazenda Boa Vista", "Rio Verde, GO", boaVistaOwner.id, 12);
upsertPlot(boaVista.id, "Talhão 04", "Soja", 180, "2026/27", 240, 900, 18);
upsertPlot(boaVista.id, "Talhão 07", "Trigo", 140, "2026/27", 155, 500, 12);

const santaLuziaOwner = upsertFarmOwner("Marina Ferreira", "contato@santaluzia.com.br", "senha12345");
const santaLuzia = upsertFarm("Fazenda Santa Luzia", "Sorriso, MT", santaLuziaOwner.id, 15);
upsertPlot(santaLuzia.id, "Talhão 11", "Milho", 260, "2026/27", 190, 700, 15);
upsertPlot(santaLuzia.id, "Talhão 19", "Feijão", 90, "2026/27", 130, 400, 16);

console.log("[seed] fazendas e talhões de exemplo criados.");
console.log("[seed] login de exemplo (fazenda): contato@fazendaboavista.com.br / senha12345");
