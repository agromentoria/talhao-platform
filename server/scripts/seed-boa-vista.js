#!/usr/bin/env node
/*
 * Carga de talhões diversificados da Fazenda Boa Vista (Rio Verde, GO), com
 * preços, produtividades, custos e ciclos de mercado (referência: out/2026).
 * Usa a API (funciona no local e no servidor publicado) e pode ser rodado
 * mais de uma vez: talhões com o mesmo nome são pulados.
 *
 *   API_URL=https://SUA-API.onrender.com/api \
 *   FAZENDA_EMAIL=carlos@boavista.demo.com FAZENDA_SENHA=senha12345 \
 *   APROVADOR_EMAIL=admin@meutalhao.com.br APROVADOR_SENHA=... \
 *   ARMAZEM_EMAIL=armazem@demo.com ARMAZEM_SENHA=senha12345 \
 *   COM_COMPRAS=1 node scripts/seed-boa-vista.js
 *
 * Milho safrinha e algodão ficam aguardando aprovação do fundo: em ciclos longos
 * a captação deve abrir perto do plantio, senão o dinheiro fica parado e o
 * ganho da safra perde para a LCA no mesmo prazo.
 *
 * COM_COMPRAS=1 simula compras dos investidores de demonstração
 * (ana.cedo@demo.com etc., mesma senha de INVESTIDOR_SENHA). Sem ela, só os
 * talhões, orçamentos, custos e andamento são criados.
 *
 * Referências de preço (out/2026): soja safra nova ~R$ 120/sc (Rio Verde
 * disponível ~R$ 135); milho Rio Verde R$ 45–57/sc (B3 jul/27 ~R$ 78, base
 * Campinas); feijão carioca Goiás ~R$ 300/sc (Cepea); algodão em pluma
 * ~R$ 135/@ (Cepea, SP); boi gordo Goiás R$ 349–365/@.
 */
const API = (process.env.API_URL || "http://localhost:4000/api").replace(/\/$/, "");
const env = (k, d) => process.env[k] || d;

async function call(method, path, body, token) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${data.error || ""}`);
  return data;
}
const login = async (email, password) => (await call("POST", "/auth/login", { email, password })).token;
const porHa = (ha, itens) => Object.fromEntries(Object.entries(itens).map(([k, v]) => [k, Math.round(v * ha)]));

// ---------- os talhões ----------
const TALHOES = [
  {
    nome: "Talhão 14 – Soja Precoce", grao: "Soja", variedade: "Intacta 2 Xtend", tipo_producao: "lavoura", unidade: "saca",
    area_ha: 250, produtividade: 64, cotas_totais: 11000, preco: 120, meta: 9,
    plantio_ate: "2026-11-10", colheita_prevista: "2027-02-28", safra: "2026/27",
    arm: { arm_pagador: "dividido", arm_investidor_pct: 50, arm_quinzenas_previstas: 2 }, perf: 50,
    orcamento: { preparo_solo: 350, sementes: 540, fertilizantes: 1450, plantio: 180, defensivos: 1100, manejo: 250, colheita: 300, frete: 200, mao_obra: 150, maquinas: 280, seguro: 120 },
    custos: [["preparo_solo", "Calcário e gessagem em 250 ha", 84000, "2026-09-25"], ["sementes", "Sementes Intacta 2 Xtend tratadas", 135000, "2026-10-08"],
      ["fertilizantes", "MAP + KCl, 380 kg/ha", 362500, "2026-10-15"], ["plantio", "Plantio de 250 ha", 45000, "2026-11-08"]],
    andamento: [[1, 12, "Plantio concluído nos 250 ha entre 1º e 8/11, com chuva regular."]],
    validacoes: [["plantio", null, "Visita em 12/11: 250 ha plantados, estande uniforme."]],
    vender: 0.62,
  },
  {
    nome: "Talhão 23 – Milho Safrinha", grao: "Milho", variedade: "Híbrido transgênico", tipo_producao: "lavoura", unidade: "saca",
    area_ha: 300, produtividade: 110, cotas_totais: 20000, preco: 58, meta: 8,
    plantio_ate: "2027-02-28", colheita_prevista: "2027-07-10", safra: "2027 safrinha",
    arm: { arm_pagador: "dividido", arm_investidor_pct: 50, arm_quinzenas_previstas: 2 }, perf: 40,
    orcamento: { sementes: 900, fertilizantes: 1300, plantio: 160, defensivos: 650, manejo: 200, colheita: 280, frete: 220, mao_obra: 120, maquinas: 250, seguro: 90 },
    custos: [], andamento: [], validacoes: [],
    vender: 0, publicar: false, // ciclo longo: a captação abre perto do plantio (fev/27)
  },
  {
    nome: "Pivô 2 – Feijão Carioca Irrigado", grao: "Feijão", variedade: "Carioca BRS Estilo", tipo_producao: "lavoura", unidade: "saca",
    area_ha: 120, produtividade: 45, cotas_totais: 3600, preco: 280, meta: 7,
    plantio_ate: "2026-11-20", colheita_prevista: "2027-02-18", safra: "2026/27",
    arm: { arm_pagador: "fazenda", arm_quinzenas_previstas: 1 }, perf: 50,
    orcamento: { preparo_solo: 300, sementes: 1200, fertilizantes: 1500, plantio: 200, defensivos: 1600, manejo: 400, colheita: 450, frete: 150, mao_obra: 250, maquinas: 300, seguro: 150 },
    custos: [["sementes", "Sementes certificadas BRS Estilo", 144000, "2026-10-20"]], andamento: [], validacoes: [],
    vender: 0.45,
  },
  {
    nome: "Talhão 30 – Algodão", grao: "Algodão", variedade: "FiberMax (transgênico)", tipo_producao: "lavoura", unidade: "arroba",
    area_ha: 200, produtividade: 115, cotas_totais: 14000, preco: 130, meta: 9,
    plantio_ate: "2026-12-15", colheita_prevista: "2027-06-15", safra: "2026/27",
    arm: { arm_pagador: "dividido", arm_investidor_pct: 50, arm_quinzenas_previstas: 2 }, perf: 50,
    orcamento: { preparo_solo: 450, sementes: 1300, fertilizantes: 3200, plantio: 250, defensivos: 4200, manejo: 700, colheita: 1100, frete: 500, mao_obra: 400, maquinas: 600, seguro: 300 },
    custos: [], andamento: [], validacoes: [],
    vender: 0, publicar: false, // ciclo longo: a captação abre perto do plantio (dez/26)
  },
  {
    nome: "Confinamento 1 – Engorda Nelore", grao: "Bovinos de corte", variedade: "Nelore", tipo_producao: "pecuaria", unidade: "arroba",
    area_ha: 40, produtividade: null, cotas_totais: 6000, preco: 350, meta: 8,
    plantio_ate: "2026-11-05", colheita_prevista: "2027-02-25", safra: "Lote 2026/27",
    arm: { arm_pagador: "fazenda", arm_quinzenas_previstas: 1 }, perf: 40, // pecuária: sem custo de armazenagem para o investidor
    // 1.000 bois: aquisição (13 @ x R$ 330), dieta (~R$ 15/dia x 110 dias), sanidade e operação
    orcamentoTotal: { aquisicao_animais: 4290000, alimentacao: 1650000, sanidade: 60000, mao_obra: 80000, frete: 50000, outros: 40000 },
    custos: [["aquisicao_animais", "Compra de 1.000 bois magros (13 @ a R$ 330)", 4290000, "2026-11-03"], ["sanidade", "Protocolo sanitário de entrada", 22000, "2026-11-06"]],
    andamento: [[1, 15, "Entrada dos 1.000 animais concluída em 05/11; adaptação à dieta iniciada."]],
    validacoes: [["plantio", 1000, "Conferência na entrada: 1.000 cabeças, peso médio 13 @."]],
    vender: 0.7,
  },
];

const INVESTIDORES = ["ana.cedo@demo.com", "bruno.tardio@demo.com", "carla.diversa@demo.com", "diego.concentrado@demo.com", "elisa.historico@demo.com", "fabio.misto@demo.com"];

(async () => {
  console.log(`[boa-vista] API: ${API}`);
  const tFaz = await login(env("FAZENDA_EMAIL", "carlos@boavista.demo.com"), env("FAZENDA_SENHA", "senha12345"));
  const tApr = await login(env("APROVADOR_EMAIL", "admin@meutalhao.com.br"), env("APROVADOR_SENHA", "admin12345"));
  const tArm = await login(env("ARMAZEM_EMAIL", "armazem@demo.com"), env("ARMAZEM_SENHA", "senha12345"));
  const me = (await call("GET", "/auth/me", null, tFaz)).user;
  if (!me.farm_id) throw new Error("A conta da fazenda não tem fazenda vinculada.");
  const wid = (await call("GET", "/warehouses/mine", null, tArm)).warehouse.id;
  const existentes = new Set((await call("GET", "/plots/farm/mine", null, tFaz)).plots.map((p) => p.nome));
  const invTokens = process.env.COM_COMPRAS ? await Promise.all(INVESTIDORES.map((e) => login(e, env("INVESTIDOR_SENHA", "senha12345")).catch(() => null))) : [];

  for (const t of TALHOES) {
    if (existentes.has(t.nome)) { console.log(`  · ${t.nome}: já existe, pulado`); continue; }
    const { plot } = await call("POST", "/plots", {
      farm_id: me.farm_id, nome: t.nome, area_ha: t.area_ha, grao: t.grao, variedade: t.variedade, tipo_producao: t.tipo_producao,
      plantio_ate: t.plantio_ate, colheita_prevista: t.colheita_prevista, unidade: t.unidade, preco_venda_estimado: t.preco,
      cotas_totais: t.cotas_totais, safra: t.safra, previsao_retorno: t.meta, warehouse_id: wid, perf_excedente_pct: t.perf, ...t.arm,
    }, tFaz);
    await call("POST", `/warehouses/plots/${plot.id}/custody`, { decisao: "aceitar" }, tArm);
    if (t.publicar !== false) await call("POST", `/admin/plot-approvals/${plot.id}/approve`, {}, tApr);
    await call("PUT", `/plots/${plot.id}/orcamento`, { itens: t.orcamentoTotal || porHa(t.area_ha, t.orcamento) }, tFaz);
    for (const [categoria, descricao, valor, data] of t.custos) await call("POST", `/plots/${plot.id}/custos`, { categoria, descricao, valor, data }, tFaz);

    // compras antes de avançar a fase (a maior parte entra na primeira fase)
    let vendidas = 0;
    if (invTokens.length && t.publicar !== false) {
      const alvo = Math.floor(t.cotas_totais * t.vender);
      const pesos = [0.38, 0.06, 0.18, 0.26, 0.04, 0.08];
      for (let i = 0; i < invTokens.length && vendidas < alvo; i++) {
        if (!invTokens[i]) continue;
        const q = Math.max(1, Math.min(alvo - vendidas, Math.round(alvo * pesos[i])));
        await call("POST", "/investments", { plot_id: plot.id, cotas: q, payment_method_type: "pix" }, invTokens[i]);
        vendidas += q;
      }
    }
    for (const [fase, progresso, nota] of t.andamento) await call("PATCH", `/plots/${plot.id}/progress`, { fase_atual: fase, progresso, nota }, tFaz);
    for (const [etapa, quantidade, observacao] of t.validacoes) {
      await call("POST", `/warehouses/plots/${plot.id}/validations`, { etapa, resultado: "confirmado", quantidade, observacao }, tArm);
    }
    const captado = vendidas * t.preco;
    const situacao = t.publicar === false ? "aguardando aprovação do fundo" : vendidas ? `${Math.round((vendidas / t.cotas_totais) * 100)}% vendido (R$ ${captado.toLocaleString("pt-BR")})` : "na vitrine, sem compras";
    console.log(`  ✓ ${t.nome}: ${t.cotas_totais.toLocaleString("pt-BR")} ${t.unidade}s a R$ ${t.preco} · meta ${t.meta}% · ${situacao}`);
  }
  console.log("[boa-vista] pronto.");
})().catch((e) => { console.error("[boa-vista] erro:", e.message); process.exit(1); });
