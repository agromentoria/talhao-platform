// Script de demonstração rica: cria 2 fazendas, 8 talhões diversificados
// (4 por fazenda, em fases diferentes) e 6 investidores com compras
// diversificadas, incluindo 2 talhões já colhidos e pagos.
//
// Roda inteiramente via chamadas HTTP à API real — usa a mesma lógica de
// negócio (preços por fase, comissões, pagamentos) que qualquer usuário
// real usaria, então os números gerados são 100% confiáveis para análise.
//
// Uso:
//   API_URL=https://sua-api.onrender.com/api ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/seed-demo-rico.js
//   (sem variáveis, usa http://localhost:4000/api e as credenciais do .env local)

// Node 18+ já tem fetch nativo; em versões mais antigas (ex: Node 16,
// usado em Macs mais antigos que não suportam o Node mais recente),
// usamos o pacote node-fetch como alternativa.
const fetch = globalThis.fetch || require("node-fetch");

const API_URL = process.env.API_URL || "http://localhost:4000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@meutalhao.com.br";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error("[erro] defina ADMIN_PASSWORD (a mesma senha configurada no servidor) para rodar este script.");
  process.exit(1);
}

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

async function registerOrLogin(payload) {
  try {
    return await call("POST", "/auth/register", null, payload);
  } catch (err) {
    if (String(err.message).includes("já está cadastrado")) {
      return await call("POST", "/auth/login", null, { email: payload.email, password: payload.password });
    }
    throw err;
  }
}

async function main() {
  console.log(`[seed-rico] usando API em ${API_URL}`);

  const admin = await call("POST", "/auth/login", null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const adminToken = admin.token;
  console.log("[seed-rico] login admin OK");

  // ---------- fazendas ----------
  const farmAOwner = await registerOrLogin({
    name: "Carlos Bittencourt", email: "carlos@boavista.demo.com", password: "senha12345",
    role: "fazenda", farmName: "Fazenda Boa Vista", farmLocation: "Rio Verde, GO",
  });
  const farmBOwner = await registerOrLogin({
    name: "Marina Ferreira", email: "marina@santaluzia.demo.com", password: "senha12345",
    role: "fazenda", farmName: "Fazenda Santa Luzia", farmLocation: "Sorriso, MT",
  });
  const farmAToken = farmAOwner.token;
  const farmBToken = farmBOwner.token;
  const farmAId = farmAOwner.user.farm_id;
  const farmBId = farmBOwner.user.farm_id;

  await call("PATCH", `/farms/${farmAId}/status`, adminToken, { status: "aprovada" });
  await call("PATCH", `/farms/${farmBId}/status`, adminToken, { status: "aprovada" });
  await call("PATCH", `/farms/${farmAId}/commission`, farmAToken, { commission_pct: 12 });
  await call("PATCH", `/farms/${farmBId}/commission`, farmBToken, { commission_pct: 15 });
  console.log("[seed-rico] fazendas aprovadas: Boa Vista (comissão 12%), Santa Luzia (comissão 15%)");

  // ---------- investidores ----------
  const investorDefs = [
    { name: "Ana Cedo",         email: "ana.cedo@demo.com" },
    { name: "Bruno Tardio",     email: "bruno.tardio@demo.com" },
    { name: "Carla Diversa",    email: "carla.diversa@demo.com" },
    { name: "Diego Concentrado",email: "diego.concentrado@demo.com" },
    { name: "Elisa Historico",  email: "elisa.historico@demo.com" },
    { name: "Fabio Misto",      email: "fabio.misto@demo.com" },
  ];
  const investors = {};
  for (const inv of investorDefs) {
    const data = await registerOrLogin({ name: inv.name, email: inv.email, password: "senha12345", role: "investidor" });
    investors[inv.name] = data.token;
  }
  console.log("[seed-rico] 6 investidores prontos");

  // ---------- talhões ----------
  // cada talhão nasce na fase 0; usamos /progress pra avançar antes de cada
  // rodada de compras, simulando o avanço real da safra ao longo do tempo
  async function createPlot(farmId, farmToken, nome, grao, area, safra, previsaoRetorno) {
    const data = await call("POST", "/plots", farmToken, {
      farm_id: farmId, nome, grao, area_ha: area, safra, previsao_retorno: previsaoRetorno,
    });
    return data.plot;
  }
  async function advance(farmToken, plotId, fase, progresso, nota) {
    await call("PATCH", `/plots/${plotId}/progress`, farmToken, { fase_atual: fase, progresso, nota });
  }
  async function buy(token, plotId, cotas) {
    return call("POST", "/investments", token, { plot_id: plotId, cotas, payment_method_type: "pix" });
  }
  async function finalize(farmToken, plotId, retornoFinal, comprovanteTexto) {
    // 1) fazenda solicita a finalização com o comprovante da colheita
    await call("POST", `/plots/${plotId}/finalize`, farmToken, {
      retorno_final: retornoFinal,
      comprovante_texto: comprovanteTexto || `Colheita concluída, retorno de ${retornoFinal}% confirmado com o comprador.`,
    });
    // 2) admin revisa e aprova — só depois disso os investidores são pagos
    const pending = await call("GET", "/admin/harvest-requests?status=pendente", adminToken);
    const request = pending.requests.find((r) => r.plot_id === plotId);
    return call("POST", `/admin/harvest-requests/${request.id}/approve`, adminToken);
  }

  // === Fazenda Boa Vista ===

  // Talhão 1: Soja — bem diversificado em fases, ativo (Germinação)
  const p1 = await createPlot(farmAId, farmAToken, "Talhão 04 - Soja Norte", "Soja", 180, "2026/27", 18);
  await buy(investors["Ana Cedo"], p1.id, 400);
  await buy(investors["Carla Diversa"], p1.id, 150);
  await advance(farmAToken, p1.id, 1, 25, "Plantio concluído dentro da janela ideal.");
  await buy(investors["Fabio Misto"], p1.id, 300);
  await advance(farmAToken, p1.id, 2, 45, "Germinação uniforme, boa umidade no solo.");
  await buy(investors["Bruno Tardio"], p1.id, 200);
  console.log("[seed-rico] Talhão 04 (Soja, Boa Vista) — captação em andamento, fase Germinação");

  // Talhão 2: Milho — início de captação, pouco vendido ainda
  const p2 = await createPlot(farmAId, farmAToken, "Talhão 09 - Milho Safrinha", "Milho", 150, "2026/27", 14);
  await buy(investors["Diego Concentrado"], p2.id, 3000);
  console.log("[seed-rico] Talhão 09 (Milho, Boa Vista) — início de captação");

  // Talhão 3: Trigo — safra anterior, JÁ COLHIDO E PAGO (retorno bom)
  const p3 = await createPlot(farmAId, farmAToken, "Talhão 12 - Trigo Inverno", "Trigo", 100, "2025/26", 12);
  await buy(investors["Elisa Historico"], p3.id, 2000);
  await advance(farmAToken, p3.id, 1, 30);
  await buy(investors["Ana Cedo"], p3.id, 1000);
  await advance(farmAToken, p3.id, 3, 70);
  await buy(investors["Bruno Tardio"], p3.id, 800);
  await advance(farmAToken, p3.id, 5, 100, "Colheita finalizada.");
  const p3final = await finalize(farmAToken, p3.id, 14, "Nota fiscal 88401, venda para Bunge, 5.950 sacas entregues no armazém de Rio Verde em 12/07."); // safra dentro do esperado
  console.log(`[seed-rico] Talhão 12 (Trigo, Boa Vista) — COLHIDO, ${p3final.investidoresPagos} investidores pagos`);

  // Talhão 4: Algodão — em manejo, bem capitalizado (alto valor por arroba)
  const p4 = await createPlot(farmAId, farmAToken, "Talhão 21 - Algodão Cerrado", "Algodão", 120, "2026/27", 20);
  await buy(investors["Diego Concentrado"], p4.id, 8000);
  await advance(farmAToken, p4.id, 1, 20);
  await buy(investors["Carla Diversa"], p4.id, 3000);
  await advance(farmAToken, p4.id, 3, 55, "Aplicação de defensivos concluída, lavoura sadia.");
  console.log("[seed-rico] Talhão 21 (Algodão, Boa Vista) — fase de manejo");

  // === Fazenda Santa Luzia ===

  // Talhão 5: Soja — em plantio
  const p5 = await createPlot(farmBId, farmBToken, "Talhão 03 - Soja Vargem", "Soja", 200, "2026/27", 16);
  await buy(investors["Fabio Misto"], p5.id, 500);
  await advance(farmBToken, p5.id, 1, 20, "Plantio em andamento.");
  await buy(investors["Carla Diversa"], p5.id, 400);
  console.log("[seed-rico] Talhão 03 (Soja, Santa Luzia) — fase de plantio");

  // Talhão 6: Arroz — início de captação
  const p6 = await createPlot(farmBId, farmBToken, "Talhão 14 - Arroz Irrigado", "Arroz", 80, "2026/27", 13);
  await buy(investors["Elisa Historico"], p6.id, 2500);
  console.log("[seed-rico] Talhão 14 (Arroz, Santa Luzia) — início de captação");

  // Talhão 7: Feijão — safra anterior, JÁ COLHIDO E PAGO (retorno abaixo do esperado, pra mostrar cenário realista)
  const p7 = await createPlot(farmBId, farmBToken, "Talhão 07 - Feijão Sequeiro", "Feijão", 60, "2025/26", 16);
  await buy(investors["Ana Cedo"], p7.id, 300);
  await advance(farmBToken, p7.id, 2, 40);
  await buy(investors["Diego Concentrado"], p7.id, 500);
  await advance(farmBToken, p7.id, 4, 85);
  await buy(investors["Bruno Tardio"], p7.id, 250);
  await advance(farmBToken, p7.id, 5, 100, "Colheita concluída.");
  const p7final = await finalize(farmBToken, p7.id, 8, "Nota fiscal 22190, venda para cooperativa local, 1.150 sacas entregues — safra abaixo do esperado por chuva irregular em fevereiro."); // safra abaixo do esperado (chuva irregular)
  console.log(`[seed-rico] Talhão 07 (Feijão, Santa Luzia) — COLHIDO (safra fraca), ${p7final.investidoresPagos} investidores pagos`);

  // Talhão 8: Milho — perto da colheita (fase 4), preço já mais alto
  const p8 = await createPlot(farmBId, farmBToken, "Talhão 18 - Milho Safrinha", "Milho", 140, "2026/27", 13);
  await buy(investors["Fabio Misto"], p8.id, 4000);
  await advance(farmBToken, p8.id, 1, 20);
  await buy(investors["Carla Diversa"], p8.id, 3000);
  await advance(farmBToken, p8.id, 4, 88, "Lavoura no ponto, colheita prevista para os próximos dias.");
  await buy(investors["Bruno Tardio"], p8.id, 2000);
  console.log("[seed-rico] Talhão 18 (Milho, Santa Luzia) — ponto de colheita, preço no teto da fase");

  console.log("\n[seed-rico] Concluído! 2 fazendas, 8 talhões, 6 investidores, 2 colheitas já pagas.");
  console.log("[seed-rico] Login das fazendas: carlos@boavista.demo.com / marina@santaluzia.demo.com (senha12345)");
  console.log("[seed-rico] Login dos investidores: ana.cedo@demo.com, bruno.tardio@demo.com, etc (senha12345)");
}

main().catch((err) => {
  console.error("[seed-rico] erro:", err.message);
  process.exit(1);
});
