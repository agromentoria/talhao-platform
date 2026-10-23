#!/usr/bin/env node
/*
 * Carga de demonstração: UM ANO DO APP EM OPERAÇÃO (ago/2025 → out/2026)
 *
 *   Safra 2025/26 (soja) ........ colhida, vendida e paga
 *   Safrinha 2026 ............... colhida, vendida e paga
 *   Safra 2026/27 (soja) ........ plantada, captação quase esgotada, lista de espera
 *   Safrinha 2027 ............... captação recém-aberta
 *
 * 20 fazendas, 4 armazéns (o SIAP que já existe + 3 regionais), ~4.000
 * investidores pessoa física com compras pulverizadas, recompra entre safras e
 * indicação. Modelo "Custo + Lucro": o investidor paga o custo de produção por
 * saca e fica com 30% do lucro (mínimo de 90% do CDI); a fazenda, 65%. Preço do dia, pagamentos com a
 * mesma conta do app. Tudo gravado em lote numa única transação.
 *
 * Uso (pasta server):
 *   export DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
 *   node scripts/carga-ano-completo.js
 *
 * Opções: REMOVER=1 (só apaga a carga) · INVESTIDORES=2500 · SENHA_DEMO=senha12345
 * Rodar de novo apaga a carga anterior desta demonstração e recria do zero.
 * Pré-requisito: um armazém aprovado com "SIAP" no nome.
 */
const bcrypt = require("bcryptjs");
const { pool } = require("../src/db");
const { minimoPct, calcularPagamentoCusto, REGRAS, CUSTO } = require("../src/piso");
const { despesaPrevista } = require("../src/storageFees");

const D_FAZ = "carga-safrinha.meutalhao.com.br";      // mesmo domínio da carga anterior (é limpa junto)
const D_INV = "investidores-demo.meutalhao.com.br";
const D_ARM = "armazens-demo.meutalhao.com.br";
const SENHA = process.env.SENHA_DEMO || "senha12345";
const N_INV = Number(process.env.INVESTIDORES) || 4000;
const HOJE = new Date("2026-10-17T12:00:00Z");

// ---------- números previsíveis ----------
let semente = 20251017;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const entre = (a, b) => a + (b - a) * rnd();
const int = (a, b) => Math.floor(entre(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const arred = (v, m) => Math.round(v / m) * m;
const dia = (s) => new Date(s + "T12:00:00Z");
const maisDias = (d, n) => new Date(d.getTime() + n * 86400000);
const entreDatas = (a, b) => new Date(a.getTime() + (b.getTime() - a.getTime()) * rnd());
const iso = (d) => d.toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((b - a) / 86400000);
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
const c2 = (v) => Math.round(v * 100) / 100;

// ---------- armazéns: SIAP (existente) + 3 regionais ----------
const ARMAZENS_NOVOS = [
  { uf: ["MT"], nome: "Silos Norte Mato Grosso", local: "Lucas do Rio Verde, MT", cap: 180000, tar: [1.35, 0.40, 1, 0.12], resp: "Gustavo Brandão" },
  { uf: ["MS", "PR"], nome: "Armazéns Gerais Cone Sul", local: "Dourados, MS", cap: 140000, tar: [1.50, 0.45, 1, 0.15], resp: "Renata Okamoto" },
  { uf: ["MG"], nome: "Armazém Vale do Paranaíba", local: "Uberlândia, MG", cap: 95000, tar: [1.45, 0.42, 1, 0.13], resp: "Sérgio Lemos" },
];
const CARAC_ARM = ["silo_metalico", "armazem_graneleiro", "balanca_rodoviaria", "secador", "termometria", "aeracao_automatica", "laboratorio", "sistema_rastreio", "monitoramento_cftv", "vigilancia", "seguro_estoque", "brigada_incendio", "certificado_mapa", "armazem_geral"];

// ---------- culturas e preços (referência na abertura · realizado na venda) ----------
const CULT = {
  // custo = custo operacional efetivo por ha (Imea 2026/27; feijão e sorgo: faixas Conab)
  soja:    { grao: "Soja", variedade: "Intacta RR2 PRO", unidade: "saca", prod: [57, 64], custoHa: 6122 },
  milho:   { grao: "Milho", variedade: "Grão amarelo (comum)", unidade: "saca", prod: [108, 122], custoHa: 5508 },
  sorgo:   { grao: "Sorgo", variedade: "Granífero", unidade: "saca", prod: [68, 78], custoHa: 2900 },
  feijao:  { grao: "Feijão", variedade: "Carioca", unidade: "saca", prod: [43, 50], custoHa: 11500 },
  algodao: { grao: "Algodão", variedade: "Transgênico", unidade: "arroba", prod: [105, 120], custoHa: 12500 },
  trigo:   { grao: "Trigo", variedade: "Pão", unidade: "saca", prod: [50, 62], custoHa: 3600 },
};
// janelas das quatro safras do ano
const SAFRAS = [
  { id: "s25", safra: "2025/26", nome: "Soja Verão", pub: ["2025-08-18", "2025-09-12"], plantio: ["2025-10-10", "2025-11-08"], colheita: ["2026-02-08", "2026-03-12"],
    preco: { soja: 121 }, venda: [0.93, 1.12], paga: true, fill: [0.92, 1] },
  { id: "m26", safra: "2026 safrinha", nome: "Safrinha", pub: ["2026-01-05", "2026-01-25"], plantio: ["2026-02-12", "2026-03-08"], colheita: ["2026-06-15", "2026-07-25"],
    preco: { milho: 56, sorgo: 46, feijao: 300 }, venda: [0.88, 1.18], paga: true, fill: [0.9, 1] },
  { id: "s26", safra: "2026/27", nome: "Soja Verão", pub: ["2026-08-18", "2026-09-15"], plantio: ["2026-10-08", "2026-11-12"], colheita: ["2027-02-10", "2027-03-15"],
    preco: { soja: 120 }, paga: false, fill: [0.82, 1], fase: [1, 2] },
  { id: "m27", safra: "2027 safrinha", nome: "Safrinha", pub: ["2026-09-28", "2026-10-14"], plantio: ["2027-02-15", "2027-03-08"], colheita: ["2027-06-20", "2027-07-20"],
    preco: { milho: 57, sorgo: 46, feijao: 305 }, paga: false, fill: [0.05, 0.3], fase: [0, 0] },
];
const RATEIO = { preparo_solo: 0.04, sementes: 0.18, fertilizantes: 0.30, plantio: 0.04, defensivos: 0.22, manejo: 0.05, colheita: 0.07, frete: 0.04, mao_obra: 0.02, maquinas: 0.03, seguro: 0.01 };

// ---------- 20 fazendas ----------
const FAZENDAS = [
  ["Fazenda Santa Clara", "Sorriso, MT", "Rogério Albuquerque", ["milho", "algodao"]],
  ["Fazenda Três Lagoas", "Lucas do Rio Verde, MT", "Helena Kowalski", ["milho", "sorgo"]],
  ["Fazenda Bom Jardim", "Sinop, MT", "Márcio Teixeira", ["milho", "feijao"]],
  ["Fazenda Rio Claro", "Nova Mutum, MT", "Patrícia Bortolini", ["milho", "milho"]],
  ["Fazenda Chapadão Verde", "Campo Novo do Parecis, MT", "Eduardo Fontana", ["algodao", "milho"]],
  ["Fazenda Primavera", "Primavera do Leste, MT", "Carla Menegotto", ["milho", "feijao"]],
  ["Fazenda Água Limpa", "Rio Verde, GO", "Antônio Rezende", ["milho", "sorgo"]],
  ["Fazenda Boa Esperança", "Jataí, GO", "Luciana Carvalho", ["milho", "feijao"]],
  ["Fazenda Serra Azul", "Mineiros, GO", "Fernando Moura", ["milho", "sorgo"]],
  ["Fazenda Planalto", "Cristalina, GO", "Juliana Prado", ["feijao", "trigo"]],
  ["Fazenda Cabeceira", "Chapadão do Sul, MS", "Ricardo Vendruscolo", ["milho", "algodao"]],
  ["Fazenda São Miguel", "Maracaju, MS", "Sandra Rizzi", ["milho", "milho"]],
  ["Fazenda Itaquiraí", "Dourados, MS", "Paulo Hashimoto", ["milho", "trigo"]],
  ["Fazenda Campo Alegre", "São Gabriel do Oeste, MS", "Vera Lúcia Dalla Costa", ["milho", "sorgo"]],
  ["Fazenda Sol Nascente", "Toledo, PR", "Gilberto Stein", ["milho", "trigo"]],
  ["Fazenda Ouro Verde", "Cascavel, PR", "Adriana Schmitt", ["milho", "feijao"]],
  ["Fazenda Cachoeira", "Assis Chateaubriand, PR", "José Carlos Bettio", ["milho", "milho"]],
  ["Fazenda Vereda Grande", "Unaí, MG", "Mariana Lacerda", ["feijao", "milho"]],
  ["Fazenda Morro Alto", "Paracatu, MG", "Otávio Guimarães", ["milho", "trigo"]],
  ["Fazenda Retiro", "Uberlândia, MG", "Cristina Furtado", ["milho", "sorgo"]],
];
const CARAC_FAZ = ["plantio_direto", "agricultura_precisao", "monitoramento_satelite", "maquinario_recente", "frota_propria", "armazenagem_propria", "experiencia_10anos", "sucessao_familiar", "certificacao_ambiental", "irrigacao_pivo", "energia_solar", "sensores_solo_clima"];

// ---------- investidores ----------
const NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Rafaela", "Samuel", "Tatiane", "Vinícius", "Amanda", "Rodrigo", "Letícia", "Thiago", "Camila", "Gustavo", "Larissa", "Matheus", "Beatriz", "Diego", "Fernanda", "Marcelo", "Patrícia", "Ricardo", "Juliana", "André", "Priscila", "Leandro", "Vanessa", "Fábio", "Renata", "Alexandre", "Sílvia", "Roberto", "Débora", "Paulo", "Aline", "Cristiano", "Simone", "Márcio"];
const SOBRENOMES = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas", "Cardoso", "Ramos", "Gonçalves", "Santana", "Teixeira", "Araújo", "Pinto", "Correia", "Batista", "Moura"];
const CIDADES = [["São Paulo", "SP", 18], ["Campinas", "SP", 5], ["Ribeirão Preto", "SP", 4], ["Belo Horizonte", "MG", 7], ["Uberlândia", "MG", 4], ["Curitiba", "PR", 6], ["Londrina", "PR", 3], ["Maringá", "PR", 3], ["Goiânia", "GO", 7], ["Rio Verde", "GO", 3], ["Cuiabá", "MT", 5], ["Sorriso", "MT", 2], ["Campo Grande", "MS", 4], ["Porto Alegre", "RS", 5], ["Florianópolis", "SC", 3], ["Rio de Janeiro", "RJ", 7], ["Brasília", "DF", 6], ["Salvador", "BA", 3], ["Recife", "PE", 2], ["Fortaleza", "CE", 2]];
const pesoCidades = CIDADES.reduce((s, c) => s + c[2], 0);
const cidade = () => { let r = rnd() * pesoCidades; for (const c of CIDADES) { r -= c[2]; if (r <= 0) return c; } return CIDADES[0]; };
// valor de uma compra: maioria pequena, poucos grandes (pessoa física)
// 75% até R$ 1.200, média perto de R$ 2 mil (o saldo típico no Tesouro Direto é R$ 2,8 mil)
const ticket = () => { const r = rnd(); return r < 0.75 ? entre(100, 1200) : r < 0.94 ? entre(1200, 5000) : r < 0.995 ? entre(5000, 20000) : entre(20000, 60000); };

async function bulk(client, table, cols, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk), params = [];
    const vals = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`).join(",");
    await client.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${vals}`, params);
  }
}
async function ids(client, seq, n) {
  if (!n) return [];
  const { rows } = await client.query(`SELECT nextval('${seq}')::int AS id FROM generate_series(1, $1)`, [n]);
  return rows.map((r) => r.id);
}

async function limpar(client) {
  const { rows: us } = await client.query("SELECT id FROM users WHERE email LIKE $1 OR email LIKE $2 OR email LIKE $3", [`%@${D_FAZ}`, `%@${D_INV}`, `%@${D_ARM}`]);
  const uids = us.map((u) => u.id);
  const { rows: fs } = await client.query("SELECT id FROM farms WHERE owner_user_id = ANY($1)", [uids]);
  const fids = fs.map((f) => f.id);
  const { rows: ps } = await client.query("SELECT id FROM plots WHERE farm_id = ANY($1)", [fids]);
  const pids = ps.map((p) => p.id);
  const { rows: ws } = await client.query("SELECT id FROM warehouses WHERE owner_user_id = ANY($1)", [uids]);
  const wids = ws.map((w) => w.id);
  await client.query("DELETE FROM payouts WHERE investment_id IN (SELECT id FROM investments WHERE plot_id = ANY($1) OR user_id = ANY($2))", [pids, uids]);
  await client.query("DELETE FROM referral_rewards WHERE referrer_id = ANY($1) OR referred_id = ANY($1)", [uids]);
  await client.query("DELETE FROM transactions WHERE plot_id = ANY($1) OR user_id = ANY($2) OR farm_id = ANY($3)", [pids, uids, fids]);
  await client.query("DELETE FROM investments WHERE plot_id = ANY($1) OR user_id = ANY($2)", [pids, uids]);
  for (const t of ["plot_costs", "plot_budget", "progress_updates", "plot_validations", "plot_waitlist", "photos", "harvest_requests"]) await client.query(`DELETE FROM ${t} WHERE plot_id = ANY($1)`, [pids]);
  await client.query("DELETE FROM plot_waitlist WHERE user_id = ANY($1)", [uids]);
  await client.query("DELETE FROM notifications WHERE plot_id = ANY($1) OR recipient_user_id = ANY($2) OR farm_id = ANY($3)", [pids, uids, fids]);
  await client.query("DELETE FROM plots WHERE id = ANY($1)", [pids]);
  await client.query("DELETE FROM farm_characteristics WHERE farm_id = ANY($1)", [fids]);
  await client.query("DELETE FROM warehouse_characteristics WHERE warehouse_id = ANY($1)", [wids]);
  await client.query("UPDATE users SET farm_id = NULL, warehouse_id = NULL WHERE id = ANY($1)", [uids]);
  await client.query("DELETE FROM farms WHERE id = ANY($1)", [fids]);
  await client.query("DELETE FROM warehouses WHERE id = ANY($1)", [wids]);
  await client.query("UPDATE users SET indicado_por = NULL WHERE indicado_por = ANY($1)", [uids]);
  await client.query("DELETE FROM users WHERE id = ANY($1)", [uids]);
  return { fazendas: fids.length, talhoes: pids.length, usuarios: uids.length };
}

(async () => {
  const t0 = Date.now();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const antes = await limpar(client);
    if (antes.usuarios) console.log(`Carga anterior removida: ${antes.fazendas} fazendas, ${antes.talhoes} talhões, ${antes.usuarios} contas.`);
    if (process.env.REMOVER) { await client.query("COMMIT"); console.log("Pronto (só remoção)."); return; }

    const { rows: siap } = await client.query("SELECT * FROM warehouses WHERE name ILIKE '%SIAP%' AND status = 'aprovado' ORDER BY id LIMIT 1");
    if (!siap[0]) throw new Error('Não encontrei armazém aprovado com "SIAP" no nome.');
    const { rows: adm } = await client.query("SELECT id FROM users WHERE role IN ('fundo', 'admin') AND deleted_at IS NULL ORDER BY role = 'fundo' DESC, id LIMIT 1");
    const aprovador = adm[0]?.id || null;
    const hash = await bcrypt.hash(SENHA, 10);

    // ---- armazéns ----
    const armazens = [{ ...siap[0], uf: ["GO"] }];
    for (const a of ARMAZENS_NOVOS) {
      const { rows: u } = await client.query("INSERT INTO users (name, email, password_hash, role, created_at) VALUES ($1,$2,$3,'armazem','2025-07-20') RETURNING id",
        [a.resp, `${slug(a.nome)}@${D_ARM}`, hash]);
      const { rows: w } = await client.query(
        `INSERT INTO warehouses (name, cnpj, location, capacidade_t, owner_user_id, status, created_at, tarifa_recepcao, tarifa_quinzena, carencia_quinzenas, quebra_quinzena_pct, descricao)
         VALUES ($1,$2,$3,$4,$5,'aprovado','2025-07-25',$6,$7,$8,$9,$10) RETURNING *`,
        [a.nome, String(int(10, 99)) + String(int(100000, 999999)) + "0001" + int(10, 99), a.local, a.cap, u[0].id, ...a.tar, `Armazém geral com silos metálicos e laboratório próprio em ${a.local}.`]);
      await client.query("UPDATE users SET warehouse_id = $1 WHERE id = $2", [w[0].id, u[0].id]);
      const ks = [...CARAC_ARM].sort(() => rnd() - 0.5).slice(0, int(8, 12));
      await bulk(client, "warehouse_characteristics", ["warehouse_id", "characteristic_key"], ks.map((k) => [w[0].id, k]));
      armazens.push({ ...w[0], uf: a.uf });
    }
    const armazemDe = (uf) => armazens.find((a) => a.uf.includes(uf)) || armazens[0];

    // ---- fazendas ----
    const fazendas = [];
    for (const [i, [nome, local, dono, safrinha]] of FAZENDAS.entries()) {
      const uf = local.slice(-2);
      const { rows: u } = await client.query("INSERT INTO users (name, email, password_hash, role, phone, created_at) VALUES ($1,$2,$3,'fazenda',$4,$5) RETURNING id",
        [dono, `${slug(nome).replace(/^fazenda\./, "").replace(/\./g, "-")}@${D_FAZ}`, hash, `(${int(11, 99)}) 9${int(1000, 9999)}-${int(1000, 9999)}`, iso(entreDatas(dia("2025-07-01"), dia("2025-08-10")))]);
      const area = arred(entre(1800, 9500), 50);
      const { rows: f } = await client.query(
        `INSERT INTO farms (name, location, owner_user_id, status, commission_pct, descricao, tipo_pessoa, area_total_ha, created_at)
         VALUES ($1,$2,$3,'aprovada',10,$4,'pj',$5,'2025-08-01') RETURNING *`,
        [nome, local, u[0].id, `Grãos em plantio direto, rotação soja e safrinha. ${area.toLocaleString("pt-BR")} ha em ${local}.`, area]);
      await client.query("UPDATE users SET farm_id = $1 WHERE id = $2", [f[0].id, u[0].id]);
      const ks = [...CARAC_FAZ].sort(() => rnd() - 0.5).slice(0, int(5, 10));
      await bulk(client, "farm_characteristics", ["farm_id", "characteristic_key"], ks.map((k) => [f[0].id, k]));
      fazendas.push({ ...f[0], uf, safrinha, armazem: armazemDe(uf), owner: u[0].id });
    }

    // ---- investidores (entram ao longo do ano; mais gente no fim) ----
    const invIds = await ids(client, "users_id_seq", N_INV);
    const invs = [], usados = new Set();
    for (let k = 0; k < N_INV; k++) {
      const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}${rnd() < 0.4 ? " " + pick(SOBRENOMES) : ""}`;
      let email = `${slug(nome)}@${D_INV}`; let n = 2; while (usados.has(email)) email = `${slug(nome)}${n++}@${D_INV}`; usados.add(email);
      const entrada = new Date(dia("2025-08-15").getTime() + (HOJE - dia("2025-08-15")) * Math.pow(rnd(), 1.25)); // a base cresce ao longo do ano
      const [cid, uf] = cidade();
      const indicador = k > 50 && rnd() < 0.16 ? invs[int(0, invs.length - 1)] : null;
      invs.push({ id: invIds[k], nome, email, entrada, cid, uf, indicador: indicador && indicador.entrada < entrada ? indicador.id : null, compras: 0 });
    }
    await bulk(client, "users", ["id", "name", "email", "password_hash", "role", "created_at", "endereco_cidade", "endereco_uf", "last_login_at", "codigo_indicacao", "indicado_por"],
      invs.map((v) => [v.id, v.nome, v.email, hash, "investidor", v.entrada.toISOString(), v.cid, v.uf, maisDias(HOJE, -int(0, 40)).toISOString(), `MT${v.id}${slug(v.email).slice(0, 3).toUpperCase()}`, null]));
    for (const v of invs.filter((x) => x.indicador)) await client.query("UPDATE users SET indicado_por = $1 WHERE id = $2", [v.indicador, v.id]);
    const { rows: ana } = await client.query("SELECT id FROM users WHERE email = 'ana.cedo@demo.com' AND deleted_at IS NULL");
    if (ana[0]) invs.push({ id: ana[0].id, nome: "Ana", entrada: dia("2025-08-20"), compras: 0, ana: true });

    // ---- talhões das quatro safras ----
    let seqTal = 0; const resumo = { gmv: 0, pagos: 0, invRecebido: 0, invAplicado: 0, fazAlta: 0, fazCusto: 0, compras: 0, talhoes: 0, plataforma: 0, armazem: 0 };
    const compradoresAnteriores = new Set();
    const novasRecompensas = new Set();
    for (const S of SAFRAS) {
      for (const fz of fazendas) {
        const sem = (k) => (k === "algodao" ? "milho" : k === "trigo" ? "feijao" : k); // margem insuficiente hoje
        const safr = fz.safrinha.map(sem);
        const culturas = S.id.startsWith("s") ? ["soja"] : S.id === "m27" ? [safr[0]] : safr.slice(0, rnd() < 0.5 ? 2 : 1);
        for (const chave of culturas) {
          const c = CULT[chave];
          // preço esperado de venda (milho em MT tem preço menor: base ~R$ 50)
          const P = c2((chave === "milho" && fz.uf === "MT" ? 50 : (S.preco[chave] || 100)) * entre(0.97, 1.03));
          const prodHa = Math.round(entre(c.prod[0], c.prod[1]) * 10) / 10;
          const custoHa = Math.round(c.custoHa * entre(0.95, 1.05));
          const custoSaca = c2(custoHa / prodHa);
          const pub = entreDatas(dia(S.pub[0]), dia(S.pub[1])), plantio = entreDatas(dia(S.plantio[0]), dia(S.plantio[1])), colheita = entreDatas(dia(S.colheita[0]), dia(S.colheita[1]));
          const dias = Math.max(30, diasEntre(pub, maisDias(colheita, REGRAS.dias_pos_colheita)));
          const piso = minimoPct(dias); // mínimo do investidor: 90% do CDI no prazo
          const capital = Math.exp(entre(Math.log(80000), Math.log(360000)));
          const cotas = Math.max(500, arred(capital / custoSaca, 50));
          const prod = prodHa;
          const area = Math.max(20, arred(cotas / (prodHa * entre(0.6, 0.9)), 5)); // investidores financiam 60% a 90% da produção
          const nome = `Talhão ${String(10 + (seqTal++ % 80)).padStart(2, "0")} – ${c.grao} ${S.nome}${S.paga ? ` ${S.safra.slice(0, 4)}` : ""}`;
          const arm = fz.armazem;
          const fase = S.paga ? 5 : int(S.fase[0], S.fase[1]);
          const progresso = S.paga ? 100 : fase === 0 ? int(2, 8) : fase === 1 ? int(12, 20) : int(22, 32);
          const vendaFator = S.paga ? entre(S.venda[0], S.venda[1]) : null;
          const precoVenda = S.paga ? c2(P * vendaFator) : null;
          const retorno = S.paga ? Math.round((vendaFator - 1) * 100 * 1e6) / 1e6 : null;
          const { rows: np } = await client.query(
            `INSERT INTO plots (farm_id, nome, grao, variedade, tipo_producao, plantio_ate, colheita_prevista, area_ha, safra, cota_valor, cotas_totais, cotas_disponiveis,
               previsao_retorno, unidade, preco_venda_estimado, warehouse_id, custodia_status, custodia_em, aprovacao_status, aprovacao_em, aprovacao_por, exige_garantia,
               publicado_em, arm_pagador, arm_quinzenas_previstas, perf_excedente_pct, arm_tarifa_recepcao, arm_tarifa_quinzena, arm_carencia, arm_quebra_pct,
               modelo, piso_pct, piso_dias, status, fase_atual, progresso, retorno_final, arm_entrada_em, created_at, custo_ha, produtividade_ha, custo_saca, indice_referencia)
             VALUES ($1,$2,$3,$4,'lavoura',$5,$6,$7,$8,$27,$10,$10,$11,$12,$9,$13,'aceita',$14,'aprovado',$14,$15,true,$14,'fazenda',2,0,$16,$17,$18,$19,
               'custo',$11,$20,$21,$22,$23,$24,$25,$26,$28,$29,$27,$30) RETURNING *`,
            [fz.id, nome, c.grao, c.variedade, iso(plantio), iso(colheita), area, S.safra, P, cotas, piso, c.unidade, arm.id, pub.toISOString(), aprovador,
             arm.tarifa_recepcao, arm.tarifa_quinzena, arm.carencia_quinzenas, arm.quebra_quinzena_pct, dias,
             S.paga ? "pago" : fase === 0 ? "captacao" : "em_andamento", fase, progresso, retorno, S.paga ? maisDias(colheita, 3).toISOString() : null, maisDias(pub, -int(3, 10)).toISOString(),
             custoSaca, custoHa, prodHa, require("../src/culturas").indiceDe(c.grao)]);
          const plot = np[0]; resumo.talhoes++;

          // orçamento e custos lançados
          await bulk(client, "plot_budget", ["plot_id", "categoria", "valor"], Object.entries(RATEIO).map(([k, f]) => [plot.id, k, Math.round(area * custoHa * f)]));
          const lancadas = S.paga ? Object.keys(RATEIO) : fase >= 1 ? ["preparo_solo", "sementes", "fertilizantes", "plantio"] : ["preparo_solo"];
          await bulk(client, "plot_costs", ["plot_id", "categoria", "descricao", "valor", "data", "created_by"], lancadas.map((k) => [plot.id, k, `Lançamento de ${k.replace("_", " ")}`,
            Math.round(area * custoHa * RATEIO[k] * entre(0.93, 1.07)), iso(k === "colheita" ? colheita : k === "preparo_solo" ? maisDias(plantio, -20) : plantio), fz.owner]));

          // diário e validações do armazém
          const diario = [[0, 5, "Planejamento e compra de insumos.", maisDias(pub, 5)]];
          if (fase >= 1) diario.push([1, 15, `Plantio concluído em ${area} ha.`, maisDias(plantio, 2)]);
          if (fase >= 2) diario.push([2, 28, "Germinação uniforme, sem replantio.", maisDias(plantio, 14)]);
          if (S.paga) diario.push([3, 60, "Lavoura bem desenvolvida; manejo de pragas em dia.", maisDias(plantio, 50)], [5, 100, `Colheita encerrada: ${prod} ${c.unidade}s por ha.`, colheita]);
          await bulk(client, "progress_updates", ["plot_id", "fase_atual", "progresso", "nota", "created_at"], diario.map(([f, p, n, d]) => [plot.id, f, p, n, d.toISOString()]));
          const val = [];
          if (fase >= 1) val.push(["plantio", null, `${area} ha plantados; estande uniforme.`, maisDias(plantio, 6)]);
          if (S.paga) val.push(["colheita", arred(area * prod, 10), `Colheita conferida: ${prod} por ha.`, colheita], ["armazenagem", cotas, `${cotas.toLocaleString("pt-BR")} ${c.unidade}s dos investidores recebidas.`, maisDias(colheita, 3)]);
          if (val.length) await bulk(client, "plot_validations", ["plot_id", "warehouse_id", "etapa", "resultado", "quantidade", "observacao", "created_at"], val.map(([e, q, o, d]) => [plot.id, arm.id, e, "confirmado", q, o, d.toISOString()]));

          // compras pulverizadas: entre a abertura e o plantio (ou até hoje)
          const fimCaptacao = new Date(Math.min(plantio.getTime(), HOJE.getTime()));
          const alvo = Math.floor(cotas * entre(S.fill[0], S.fill[1]));
          const compras = []; let vendidas = 0, tentativas = 0;
          while (vendidas < alvo && tentativas++ < 60000) {
            const quando = entreDatas(pub, fimCaptacao);
            const elegiveis = invs.length;
            let v = null;
            for (let tries = 0; tries < 8 && !v; tries++) {
              const cand = rnd() < 0.5 && compradoresAnteriores.size ? invs[int(0, elegiveis - 1)] : invs[int(0, elegiveis - 1)];
              if (cand.entrada <= quando && (compradoresAnteriores.has(cand.id) || rnd() < 0.7)) v = cand;
            }
            if (!v) continue;
            const preco = c2(custoSaca * Math.pow(1 + piso / 100, Math.min(1, diasEntre(pub, quando) / dias))); // preço do dia sobre o custo
            let q = Math.max(1, Math.round((v.ana ? entre(1500, 6000) : ticket()) / preco));
            q = Math.min(q, alvo - vendidas); if (q <= 0) break;
            compras.push({ user: v.id, q, preco, valor: c2(q * preco), quando, v });
            vendidas += q; v.compras++;
          }
          const iids = await ids(client, "investments_id_seq", compras.length);
          compras.forEach((x, k) => { x.id = iids[k]; });
          await bulk(client, "investments", ["id", "user_id", "plot_id", "cotas", "valor_investido", "preco_unitario", "status", "created_at"],
            compras.map((x) => [x.id, x.user, plot.id, x.q, x.valor, x.preco, S.paga ? "pago" : "ativo", x.quando.toISOString()]));
          await bulk(client, "transactions", ["type", "status", "user_id", "farm_id", "plot_id", "investment_id", "amount", "payment_method_type", "description", "created_at"],
            compras.map((x) => ["compra_cota", "aprovado", x.user, fz.id, plot.id, x.id, x.valor, rnd() < 0.85 ? "pix" : "cartao", `Compra de ${x.q} ${c.unidade}s de ${c.grao} em ${nome}`, x.quando.toISOString()]));
          await client.query("UPDATE plots SET cotas_disponiveis = cotas_totais - $1 WHERE id = $2", [vendidas, plot.id]);
          // ENTRADA: taxa de sucesso da plataforma sobre cada compra (paga pela fazenda)
          await bulk(client, "transactions", ["type", "status", "user_id", "farm_id", "plot_id", "investment_id", "amount", "description", "created_at"],
            compras.map((x) => ["taxa_estruturacao", "aprovado", null, fz.id, plot.id, x.id, c2(x.valor * CUSTO.estruturacao_pct / 100),
              `Taxa de entrada do app: ${CUSTO.estruturacao_pct}% sobre a captação de ${nome} (paga pela fazenda)`, x.quando.toISOString()]));
          resumo.entrada = (resumo.entrada || 0) + compras.reduce((s, x) => s + x.valor, 0) * CUSTO.estruturacao_pct / 100;
          resumo.compras += compras.length; resumo.gmv += compras.reduce((s, x) => s + x.valor, 0);
          // indicação: a 1ª compra de quem foi indicado gera o bônus
          const rec = [];
          for (const x of compras) if (x.v.indicador && !novasRecompensas.has(x.user)) { novasRecompensas.add(x.user); rec.push(x); }
          if (rec.length) await bulk(client, "referral_rewards", ["referrer_id", "referred_id", "investment_id", "valor_indicador", "valor_indicado", "created_at"],
            rec.map((x) => [x.v.indicador, x.user, x.id, 20, 20, x.quando.toISOString()]));
          for (const x of compras) compradoresAnteriores.add(x.user);

          // safras fechadas: pagamento com a mesma conta do app
          if (S.paga && compras.length) {
            const pagoEm = maisDias(colheita, int(28, 40));
            const desp = despesaPrevista(plot, { unidades: vendidas, precoVenda }).total;
            const r = calcularPagamentoCusto(plot, compras.map((x) => ({ id: x.id, user_id: x.user, cotas: x.q, valor_investido: x.valor })), precoVenda, { despesaArmazenagem: desp });
            await client.query(`INSERT INTO harvest_requests (plot_id, farm_id, retorno_final, comprovante_texto, status, requested_by, reviewed_by, created_at, reviewed_at)
              VALUES ($1,$2,$3,$4,'aprovado',$5,$6,$7,$8)`, [plot.id, fz.id, retorno, `Venda de ${vendidas.toLocaleString("pt-BR")} ${c.unidade}s a R$ ${precoVenda.toFixed(2).replace(".", ",")} (nota fiscal anexada).`,
              fz.owner, aprovador, maisDias(pagoEm, -5).toISOString(), pagoEm.toISOString()]);
            await bulk(client, "payouts", ["investment_id", "valor_bruto", "comissao_fazenda", "comissao_app", "valor_liquido", "despesa_armazem", "perf_fazenda", "valor_piso", "aporte_fazenda", "created_at"],
              r.linhas.map((l) => [l.inv.id, c2(l.valorVenda), c2(l.fazendaExcedente), c2(l.plataforma), c2(l.investidor), 0, 0, c2(l.valorPiso), c2(l.aporteFazenda), pagoEm.toISOString()]));
            await bulk(client, "transactions", ["type", "status", "user_id", "farm_id", "plot_id", "investment_id", "amount", "description", "created_at"],
              r.linhas.map((l) => ["pagamento_investidor", "aprovado", l.inv.user_id, fz.id, plot.id, l.inv.id, c2(l.investidor),
                `Pagamento da colheita de ${nome}: ${l.minimoAtivo ? `mínimo garantido (${piso}%)` : "custo + 30% do lucro"}`, pagoEm.toISOString()]));
            const extras = [
              r.fazendaLiquido >= 0 ? ["repasse_fazenda", fz.owner, r.fazendaLiquido, `${nome}: lucro da fazenda (65%) menos taxas e armazenagem`] : ["aporte_fazenda", fz.owner, -r.fazendaLiquido, `${nome}: aporte para garantir o piso, taxas e armazenagem`],
              ["comissao_plataforma", null, r.plataforma, `${nome}: saída — 5% do lucro da safra`],
              ["tarifa_armazem", arm.owner_user_id, r.armazem, `${nome} em ${arm.name}: custódia + armazenagem, pagas pela fazenda`],
              ["gestao_fundo", null, r.fundo, `${nome}: gestão do fundo`],
            ].filter((e) => e[2] > 0.004);
            await bulk(client, "transactions", ["type", "status", "user_id", "farm_id", "plot_id", "amount", "description", "created_at"], extras.map((e) => [e[0], "aprovado", e[1], fz.id, plot.id, c2(e[2]), e[3], pagoEm.toISOString()]));
            const porUser = {};
            for (const l of r.linhas) porUser[l.inv.user_id] = (porUser[l.inv.user_id] || 0) + l.investidor;
            await bulk(client, "notifications", ["recipient_user_id", "sender_role", "farm_id", "plot_id", "type", "title", "body", "read_at", "created_at"],
              Object.entries(porUser).map(([u, v]) => [Number(u), "sistema", fz.id, plot.id, "pagamento_recebido", "Você recebeu um pagamento",
                `A colheita de ${nome} foi paga. Você recebeu R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`, rnd() < 0.85 ? pagoEm.toISOString() : null, pagoEm.toISOString()]));
            resumo.pagos++; resumo.invRecebido += r.investidores; resumo.invAplicado += r.captado; resumo.fazAlta += r.fazendaExcedente;
            resumo.fazCusto += r.fazendaLiquido - r.captado * CUSTO.estruturacao_pct / 100; resumo.plataforma += r.plataforma; resumo.armazem += r.armazem;
            resumo.fazLucroBanco = (resumo.fazLucroBanco || 0) + (r.valorVenda - r.captado - r.captado * (Math.pow(1.18, dias / 365) - 1)) - r.armazenagem;
          }
          // safra atual quase esgotada: lista de espera
          if (S.id === "s26" && vendidas >= cotas * 0.98) {
            const fila = [...new Set(Array.from({ length: int(15, 60) }, () => invs[int(0, invs.length - 1)].id))];
            await bulk(client, "plot_waitlist", ["plot_id", "user_id", "cotas", "created_at"], fila.map((u) => [plot.id, u, int(5, 80), entreDatas(maisDias(HOJE, -20), HOJE).toISOString()]));
          }
        }
      }
      console.log(`  ✓ ${S.safra}: talhões e compras gravados`);
    }
    await client.query("COMMIT");

    const f = (v) => Math.round(v).toLocaleString("pt-BR");
    const ativos = invs.filter((v) => v.compras > 0).length, recompra = invs.filter((v) => v.compras > 1).length;
    console.log(`\nPronto em ${Math.round((Date.now() - t0) / 1000)} s.`);
    console.log(`Armazéns: ${armazens.map((a) => a.name).join(" · ")}`);
    console.log(`Fazendas: 20 · talhões: ${resumo.talhoes} (${resumo.pagos} colhidos e pagos) · compras: ${f(resumo.compras)} · GMV do ano: R$ ${f(resumo.gmv)}`);
    console.log(`Investidores: ${f(invs.length)} cadastrados, ${f(ativos)} compraram, ${f(recompra)} compraram mais de uma vez · ${novasRecompensas.size} chegaram por indicação`);
    console.log(`Safras pagas: investidores aplicaram R$ ${f(resumo.invAplicado)} e receberam R$ ${f(resumo.invRecebido)} (+${((resumo.invRecebido / resumo.invAplicado - 1) * 100).toFixed(2)}%)`);
    console.log(`Fazendas: lucro de R$ ${f(resumo.fazCusto)} nas sacas financiadas (com crédito bancário a 18% a.a. seria R$ ${f(resumo.fazLucroBanco)}) · plataforma: entrada R$ ${f(resumo.entrada || 0)} (todas as safras) + saída R$ ${f(resumo.plataforma)} (safras pagas) · armazéns R$ ${f(resumo.armazem)}`);
    console.log(`Logins de demonstração (senha ${SENHA}): fazendas <nome>@${D_FAZ} · investidores <nome.sobrenome>@${D_INV} · armazéns <nome>@${D_ARM}`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Erro — nada foi gravado:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
