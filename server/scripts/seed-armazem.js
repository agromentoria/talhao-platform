// Cria um armazém de demonstração já credenciado e o coloca como garantidor
// dos talhões em aberto das fazendas de exemplo (rode depois do seed-demo-rico).
//
// Uso:
//   ADMIN_PASSWORD=... node scripts/seed-armazem.js
//   (API_URL padrão: http://localhost:4000/api)
//
// Login criado: armazem@demo.com / senha12345
const fetch = globalThis.fetch || require("node-fetch");

const API_URL = process.env.API_URL || "http://localhost:4000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@meutalhao.com.br";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const FAZENDAS = ["carlos@boavista.demo.com", "marina@santaluzia.demo.com"];

if (!ADMIN_PASSWORD) {
  console.error("[erro] defina ADMIN_PASSWORD para rodar este script.");
  process.exit(1);
}

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error || res.status}`);
  return data;
}
const login = async (email, password = "senha12345") => (await call("POST", "/auth/login", null, { email, password })).token;

(async () => {
  console.log(`[seed-armazem] usando API em ${API_URL}`);
  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  let wh;
  try {
    wh = await login("armazem@demo.com");
    console.log("[seed-armazem] armazém de demonstração já existe");
  } catch {
    const r = await call("POST", "/auth/register", null, {
      name: "Roberto Lima", email: "armazem@demo.com", password: "senha12345", role: "armazem",
      warehouseName: "Armazéns Gerais Sudoeste", warehouseCnpj: "11.444.777/0001-61", warehouseLocation: "Rio Verde, GO",
    });
    wh = r.token;
    console.log("[seed-armazem] armazém criado: Armazéns Gerais Sudoeste");
  }

  const { warehouse } = await call("GET", "/warehouses/mine", wh).catch(() => ({ warehouse: null }));
  const warehouseId = warehouse?.id || (await call("GET", "/auth/me", wh)).user.warehouse_id;
  await call("PATCH", `/warehouses/${warehouseId}/status`, admin, { status: "aprovado" });
  await call("PATCH", "/warehouses/mine", wh, {
    name: "Armazéns Gerais Sudoeste", location: "Rio Verde, GO", capacidade_t: 48000,
    descricao: "Complexo com 6 silos metálicos, balança rodoviária e laboratório de classificação. Credenciado no MAPA.",
    tarifa_recepcao: 1.4, tarifa_quinzena: 0.4, carencia_quinzenas: 1, quebra_quinzena_pct: 0.15,
  });

  let garantidos = 0;
  for (const email of FAZENDAS) {
    const farm = await login(email).catch(() => null);
    if (!farm) continue;
    const { plots } = await call("GET", "/plots/farm/mine", farm);
    for (const p of plots.filter((x) => ["captacao", "em_andamento"].includes(x.status) && !x.warehouse_id)) {
      await call("PATCH", `/plots/${p.id}/warehouse`, farm, { warehouse_id: warehouseId });
      await call("POST", `/warehouses/plots/${p.id}/custody`, wh, { decisao: "aceitar" });
      if (p.fase_atual >= 1) {
        await call("POST", `/warehouses/plots/${p.id}/validations`, wh, {
          etapa: "plantio", resultado: "confirmado", observacao: `Visita técnica: ${p.area_ha} ha plantados, estande uniforme.`,
        });
      }
      garantidos++;
      console.log(`[seed-armazem] ${p.nome} agora garantido`);
    }
  }
  console.log(`\n[seed-armazem] Concluído! ${garantidos} talhão(ões) com garantia. Login: armazem@demo.com / senha12345`);
})().catch((err) => {
  console.error("[seed-armazem] erro:", err.message);
  process.exit(1);
});
