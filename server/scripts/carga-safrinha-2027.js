#!/usr/bin/env node
/*
 * Carga de demonstração: SAFRINHA 2027 — 20 fazendas e ~60 talhões em preparo
 * do solo ou plantio, com valores de mercado (referência out/2026), no produto
 * com renda mínima (piso). Grava direto no banco usando as regras do app:
 * piso, custódia do armazém SIAP, aprovação do fundo/administração e publicação.
 *
 * Uso (no seu computador, na pasta server):
 *   DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
 *     node scripts/carga-safrinha-2027.js
 *
 * Opções:
 *   SENHA_FAZENDAS=senha12345   senha das 20 contas de fazenda criadas
 *   SEM_COMPRAS=1               não registrar compras da Ana
 *   REMOVER=1                   apaga tudo o que esta carga criou
 *
 * Pode rodar de novo: fazendas e talhões que já existem são pulados.
 * Requisitos na base: investidora ana.cedo@demo.com e um armazém aprovado
 * com "SIAP" no nome.
 */
const bcrypt = require("bcryptjs");
const { pool } = require("../src/db");
const { prazoDias, pisoPct } = require("../src/piso");

const DOMINIO = "carga-safrinha.meutalhao.com.br"; // marca as contas desta carga
const SENHA = process.env.SENHA_FAZENDAS || "senha12345";

// ---------- culturas da safrinha (preços de referência para jul/2027) ----------
// produtividade por ha · preço por unidade · custo por ha · plantio e colheita
const CULTURAS = {
  milho:   { grao: "Milho", variedade: "Grão amarelo (comum)", unidade: "saca", prod: [100, 125], preco: 58, custoHa: 3900, plantio: "2027-02-20", colheita: "2027-07-10", peso: 0.62 },
  sorgo:   { grao: "Sorgo", variedade: "Granífero", unidade: "saca", prod: [70, 85], preco: 47, custoHa: 2500, plantio: "2027-03-05", colheita: "2027-07-05", peso: 0.12 },
  feijao:  { grao: "Feijão", variedade: "Carioca", unidade: "saca", prod: [32, 42], preco: 280, custoHa: 5600, plantio: "2027-02-25", colheita: "2027-05-30", peso: 0.10 },
  algodao: { grao: "Algodão", variedade: "Transgênico", unidade: "arroba", prod: [105, 120], preco: 128, custoHa: 12500, plantio: "2027-01-25", colheita: "2027-07-20", peso: 0.10 },
  trigo:   { grao: "Trigo", variedade: "Pão", unidade: "saca", prod: [50, 62], preco: 76, custoHa: 3600, plantio: "2027-03-01", colheita: "2027-06-25", peso: 0.06 },
};
// divisão do custo por categoria (soma 1)
const RATEIO = { preparo_solo: 0.04, sementes: 0.18, fertilizantes: 0.30, plantio: 0.04, defensivos: 0.22, manejo: 0.05, colheita: 0.07, frete: 0.04, mao_obra: 0.02, maquinas: 0.03, seguro: 0.01 };

// ---------- 20 fazendas do cinturão da safrinha ----------
const FAZENDAS = [
  ["Fazenda Santa Clara", "Sorriso, MT", "Rogério Albuquerque", ["milho", "milho", "algodao"]],
  ["Fazenda Três Lagoas", "Lucas do Rio Verde, MT", "Helena Kowalski", ["milho", "milho", "sorgo"]],
  ["Fazenda Bom Jardim", "Sinop, MT", "Márcio Teixeira", ["milho", "feijao"]],
  ["Fazenda Rio Claro", "Nova Mutum, MT", "Patrícia Bortolini", ["milho", "milho", "milho", "algodao"]],
  ["Fazenda Chapadão Verde", "Campo Novo do Parecis, MT", "Eduardo Fontana", ["algodao", "milho", "milho"]],
  ["Fazenda Primavera", "Primavera do Leste, MT", "Carla Menegotto", ["milho", "feijao", "sorgo"]],
  ["Fazenda Água Limpa", "Rio Verde, GO", "Antônio Rezende", ["milho", "sorgo", "milho"]],
  ["Fazenda Boa Esperança", "Jataí, GO", "Luciana Carvalho", ["milho", "milho", "feijao"]],
  ["Fazenda Serra Azul", "Mineiros, GO", "Fernando Moura", ["milho", "sorgo"]],
  ["Fazenda Planalto", "Cristalina, GO", "Juliana Prado", ["feijao", "trigo", "milho"]],
  ["Fazenda Cabeceira", "Chapadão do Sul, MS", "Ricardo Vendruscolo", ["milho", "algodao", "milho"]],
  ["Fazenda São Miguel", "Maracaju, MS", "Sandra Rizzi", ["milho", "milho", "milho"]],
  ["Fazenda Itaquiraí", "Dourados, MS", "Paulo Hashimoto", ["milho", "sorgo", "trigo"]],
  ["Fazenda Campo Alegre", "São Gabriel do Oeste, MS", "Vera Lúcia Dalla Costa", ["milho", "milho"]],
  ["Fazenda Sol Nascente", "Toledo, PR", "Gilberto Stein", ["milho", "trigo", "milho"]],
  ["Fazenda Ouro Verde", "Cascavel, PR", "Adriana Schmitt", ["milho", "milho", "feijao"]],
  ["Fazenda Cachoeira", "Assis Chateaubriand, PR", "José Carlos Bettio", ["milho", "milho", "milho"]],
  ["Fazenda Vereda Grande", "Unaí, MG", "Mariana Lacerda", ["feijao", "milho", "sorgo"]],
  ["Fazenda Morro Alto", "Paracatu, MG", "Otávio Guimarães", ["milho", "feijao", "trigo"]],
  ["Fazenda Retiro", "Uberlândia, MG", "Cristina Furtado", ["milho", "sorgo", "milho"]],
];

// gerador previsível (mesmos números em toda execução)
let semente = 20270101;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const entre = (a, b) => a + (b - a) * rnd();
const arred = (v, m) => Math.round(v / m) * m;
const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const CARACTERISTICAS = ["plantio_direto", "agricultura_precisao", "monitoramento_satelite", "maquinario_recente", "frota_propria", "armazenagem_propria", "experiencia_10anos", "sucessao_familiar", "certificacao_ambiental", "irrigacao_pivo", "energia_solar", "sensores_solo_clima"];
const DESC = [
  "Grãos em plantio direto há mais de 15 anos, com rotação soja e milho safrinha.",
  "Empresa familiar na segunda geração, com agricultura de precisão em toda a área.",
  "Produção de grãos e fibras com monitoramento por satélite e frota própria.",
  "Fazenda com armazém próprio e histórico de produtividade acima da média regional.",
];

async function remover(client) {
  const { rows: farms } = await client.query(`SELECT f.id FROM farms f JOIN users u ON u.id = f.owner_user_id WHERE u.email LIKE $1`, [`%@${DOMINIO}`]);
  const ids = farms.map((f) => f.id);
  if (!ids.length) { console.log("Nada a remover."); return; }
  const { rows: plots } = await client.query("SELECT id FROM plots WHERE farm_id = ANY($1)", [ids]);
  const pids = plots.map((p) => p.id);
  for (const t of ["transactions", "investments", "plot_costs", "plot_budget", "progress_updates", "plot_validations", "plot_waitlist", "photos", "notifications", "harvest_requests"]) {
    await client.query(`DELETE FROM ${t} WHERE plot_id = ANY($1)`, [pids]).catch(() => {});
  }
  await client.query("DELETE FROM plots WHERE id = ANY($1)", [pids]);
  await client.query("DELETE FROM farm_characteristics WHERE farm_id = ANY($1)", [ids]);
  await client.query("DELETE FROM notifications WHERE farm_id = ANY($1)", [ids]).catch(() => {});
  await client.query("UPDATE users SET farm_id = NULL WHERE farm_id = ANY($1)", [ids]);
  await client.query("DELETE FROM farms WHERE id = ANY($1)", [ids]);
  await client.query("DELETE FROM users WHERE email LIKE $1", [`%@${DOMINIO}`]);
  console.log(`Removidas ${ids.length} fazendas e ${pids.length} talhões da carga.`);
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (process.env.REMOVER) { await remover(client); await client.query("COMMIT"); return; }

    // pré-requisitos
    const { rows: wh } = await client.query("SELECT * FROM warehouses WHERE name ILIKE '%SIAP%' AND status = 'aprovado' ORDER BY id LIMIT 1");
    if (!wh[0]) throw new Error('Não encontrei armazém aprovado com "SIAP" no nome. Confira em Administração › Armazéns.');
    const armazem = wh[0];
    const { rows: ana } = await client.query("SELECT id FROM users WHERE email = 'ana.cedo@demo.com' AND deleted_at IS NULL");
    if (!ana[0] && !process.env.SEM_COMPRAS) throw new Error("Não encontrei a investidora ana.cedo@demo.com. Rode com SEM_COMPRAS=1 ou cadastre-a antes.");
    const { rows: adm } = await client.query("SELECT id FROM users WHERE role IN ('fundo', 'admin') AND deleted_at IS NULL ORDER BY role = 'fundo' DESC, id LIMIT 1");
    const aprovador = adm[0]?.id || null;
    const hash = await bcrypt.hash(SENHA, 10);
    console.log(`Armazém garantidor: ${armazem.name} · aprovador: ${aprovador ? `usuário ${aprovador}` : "—"}`);

    let nFaz = 0, nTal = 0, captado = 0, comprasAna = 0, valorAna = 0, nCompra = 0;
    for (const [i, [nome, local, dono, culturas]] of FAZENDAS.entries()) {
      const email = `${slug(nome).replace(/^fazenda-/, "")}@${DOMINIO}`;
      let { rows: u } = await client.query("SELECT id, farm_id FROM users WHERE email = $1", [email]);
      let farmId = u[0]?.farm_id;
      if (!u[0]) {
        const { rows: nu } = await client.query(
          "INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, 'fazenda', $4) RETURNING id",
          [dono, email, hash, `(${[66, 65, 67, 45, 34][i % 5]}) 9${String(80000000 + i * 37171).slice(0, 8)}`]
        );
        const area = arred(entre(1800, 9500), 50);
        const { rows: nf } = await client.query(
          `INSERT INTO farms (name, location, owner_user_id, status, commission_pct, descricao, tipo_pessoa, area_total_ha)
           VALUES ($1, $2, $3, 'aprovada', 10, $4, 'pj', $5) RETURNING id`,
          [nome, local, nu[0].id, DESC[i % DESC.length] + ` ${area.toLocaleString("pt-BR")} ha em ${local}.`, area]
        );
        farmId = nf[0].id;
        await client.query("UPDATE users SET farm_id = $1 WHERE id = $2", [farmId, nu[0].id]);
        await client.query("UPDATE users SET codigo_indicacao = 'MT' || id || upper(substr(md5(email), 1, 3)) WHERE id = $1 AND codigo_indicacao IS NULL", [nu[0].id]).catch(() => {});
        const qtd = 5 + Math.floor(rnd() * 6);
        const escolhidas = [...CARACTERISTICAS].sort(() => rnd() - 0.5).slice(0, qtd);
        for (const k of escolhidas) {
          await client.query("INSERT INTO farm_characteristics (farm_id, characteristic_key) VALUES ($1, $2) ON CONFLICT DO NOTHING", [farmId, k]).catch(() => {});
        }
        nFaz++;
      }

      for (const [j, chave] of culturas.entries()) {
        const c = CULTURAS[chave];
        const tnome = `Talhão ${String(10 + j * 7 + (i % 5)).padStart(2, "0")} – ${c.grao} Safrinha`;
        const { rows: ex } = await client.query("SELECT 1 FROM plots WHERE farm_id = $1 AND nome = $2", [farmId, tnome]);
        if (ex.length) continue;

        const area = arred(entre(chave === "algodao" ? 180 : 120, chave === "feijao" ? 260 : 480), 10);
        const prod = Math.round(entre(c.prod[0], c.prod[1]));
        let cotas = arred(area * prod * entre(0.55, 0.7), 100);           // parte da produção vendida aos investidores
        cotas = Math.min(cotas, Math.floor(2400000 / c.preco / 100) * 100);  // até R$ 2,4 mi por talhão (teto CVM PF)
        const preco = Math.round(c.preco * entre(0.96, 1.04) * 100) / 100;   // variação regional de preço
        const dias = prazoDias(c.colheita);
        const piso = pisoPct(dias);
        const fase = rnd() < 0.7 ? 0 : 1;
        const progresso = fase === 0 ? Math.round(entre(2, 8)) : Math.round(entre(10, 14));
        const { rows: np } = await client.query(
          `INSERT INTO plots (farm_id, nome, grao, variedade, tipo_producao, plantio_ate, colheita_prevista, area_ha, safra,
             cota_valor, cotas_totais, cotas_disponiveis, previsao_retorno, unidade, preco_venda_estimado,
             warehouse_id, custodia_status, custodia_em, aprovacao_status, aprovacao_em, aprovacao_por, exige_garantia, publicado_em,
             arm_pagador, arm_quinzenas_previstas, perf_excedente_pct, arm_tarifa_recepcao, arm_tarifa_quinzena, arm_carencia, arm_quebra_pct,
             modelo, piso_pct, piso_dias, status, fase_atual, progresso)
           VALUES ($1,$2,$3,$4,'lavoura',$5,$6,$7,'2027 safrinha', $8,$9,$9,$10,$11,$8, $12,'aceita',now(),'aprovado',now(),$13,true,now(),
             'fazenda',2,0,$14,$15,$16,$17, 'piso',$10,$18,'captacao',$19,$20) RETURNING id`,
          [farmId, tnome, c.grao, c.variedade, c.plantio, c.colheita, area, preco, cotas, piso, c.unidade,
           armazem.id, aprovador, armazem.tarifa_recepcao, armazem.tarifa_quinzena, armazem.carencia_quinzenas, armazem.quebra_quinzena_pct,
           dias, fase, progresso]
        );
        const pid = np[0].id;
        // orçamento da lavoura por categoria
        const custoHa = c.custoHa * entre(0.95, 1.06);
        for (const [cat, f] of Object.entries(RATEIO)) {
          await client.query("INSERT INTO plot_budget (plot_id, categoria, valor) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [pid, cat, Math.round(area * custoHa * f)]);
        }
        await client.query("INSERT INTO progress_updates (plot_id, fase_atual, progresso, nota) VALUES ($1, $2, $3, $4)", [pid, fase, progresso,
          fase === 0
            ? `Área hoje em soja. Planejamento da safrinha e compra de insumos em andamento; plantio do ${c.grao.toLowerCase()} previsto logo após a colheita da soja.`
            : `Sementes e fertilizantes adquiridos e entregues. Plantio do ${c.grao.toLowerCase()} previsto para ${new Date(c.plantio).toLocaleDateString("pt-BR", { month: "long" })}, logo após a soja.`]);
        nTal++; captado += cotas * preco;

        // compras da Ana em parte dos talhões (valores de pessoa física)
        if (ana[0] && !process.env.SEM_COMPRAS && rnd() < 0.3) {
          const q = Math.max(5, Math.round(entre(800, 6000) / preco));
          const valor = Math.round(q * preco * 100) / 100;
          const { rows: inv } = await client.query(
            "INSERT INTO investments (user_id, plot_id, cotas, valor_investido, preco_unitario, status) VALUES ($1, $2, $3, $4, $5, 'ativo') RETURNING id",
            [ana[0].id, pid, q, valor, preco]
          );
          await client.query("UPDATE plots SET cotas_disponiveis = cotas_disponiveis - $1 WHERE id = $2", [q, pid]);
          await client.query(
            `INSERT INTO transactions (type, status, user_id, farm_id, plot_id, investment_id, amount, payment_method_type, description)
             VALUES ('compra_cota', 'aprovado', $1, $2, $3, $4, $5, 'pix', $6)`,
            [ana[0].id, farmId, pid, inv[0].id, valor, `Compra de ${q} ${c.unidade}s de ${c.grao} em ${tnome}`]
          );
          nCompra++; comprasAna += q; valorAna += valor;
        }
      }
    }
    await client.query("COMMIT");
    console.log(`Pronto: ${nFaz} fazendas novas, ${nTal} talhões novos, R$ ${Math.round(captado).toLocaleString("pt-BR")} em captação aberta.`);
    if (nCompra) console.log(`Ana: ${nCompra} compras, ${comprasAna.toLocaleString("pt-BR")} unidades, R$ ${valorAna.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
    console.log(`Contas das fazendas: <nome>@${DOMINIO} · senha: ${SENHA}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Erro — nada foi gravado:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
