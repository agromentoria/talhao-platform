// Catálogo inicial do marketplace (v4.0): itens padronizados que fornecedores
// ofertam e fazendas usam no plano de compras, com doses de referência por
// cultura. As doses são REFERÊNCIAS para alertar desvios — a dose real vem da
// análise de solo e da recomendação do agrônomo. A administração edita tudo.
//
// unidade_dose: unidade em que a dose é lançada por hectare (t, kg, L, ha, saca)
// fator_t: 1 unidade_dose em toneladas (sólidos) ou m³ (líquidos); 0 para serviços
const ITENS = [
  // categoria, nome, detalhe, unidade_dose, unidade_compra, fator_t, exige_receita
  ["corretivo", "Calcário dolomítico", "PRNT 80–90%", "t", "t (granel)", 1, false],
  ["corretivo", "Gesso agrícola", "Sulfato de cálcio", "t", "t (granel)", 1, false],
  ["fertilizante", "NPK 02-20-18", "Formulado de plantio", "t", "big bag 1 t", 1, false],
  ["fertilizante", "MAP 11-52-00", "Fosfato monoamônico", "t", "big bag 1 t", 1, false],
  ["fertilizante", "Cloreto de potássio (KCl)", "60% K2O", "t", "big bag 1 t", 1, false],
  ["fertilizante", "Ureia", "45% N", "t", "big bag 1 t", 1, false],
  ["fertilizante", "Superfosfato simples", "18% P2O5", "t", "big bag 1 t", 1, false],
  ["nutritivo", "Boro foliar", "Micronutriente", "L", "galão 20 L", 0.001, false],
  ["nutritivo", "Cobalto + molibdênio", "Tratamento de semente / foliar", "L", "galão 5 L", 0.001, false],
  ["nutritivo", "Manganês foliar", "Micronutriente", "L", "galão 20 L", 0.001, false],
  ["defensivo", "Herbicida glifosato", "Dessecação e pós-emergência", "L", "galão 20 L", 0.001, true],
  ["defensivo", "Herbicida pré-emergente", "Controle residual", "L", "galão 5 L", 0.001, true],
  ["defensivo", "Fungicida triazol + estrobilurina", "Ferrugem e doenças foliares", "L", "galão 5 L", 0.001, true],
  ["defensivo", "Inseticida para lagartas", "Controle de lagartas", "L", "galão 5 L", 0.001, true],
  ["defensivo", "Inseticida para percevejos", "Controle de percevejos", "L", "galão 5 L", 0.001, true],
  ["semente", "Semente de soja", "Cultivar certificada", "kg", "saco 40 kg", 0.001, false],
  ["semente", "Semente de milho híbrido", "Híbrido para safrinha", "kg", "saco 20 kg (60 mil sementes)", 0.001, false],
  ["semente", "Semente de feijão carioca", "Certificada", "kg", "saco 40 kg", 0.001, false],
  ["semente", "Inoculante", "Bradyrhizobium (soja)", "L", "frasco 1 L", 0.001, false],
  ["combustivel", "Diesel S10", "Operações da lavoura", "L", "litro", 0.001, false],
  ["servico", "Colheita terceirizada", "Por hectare colhido", "ha", "serviço", 0, false],
  ["servico", "Aplicação aérea", "Por hectare aplicado", "ha", "serviço", 0, false],
  ["servico", "Frete do grão até o armazém", "Por saca transportada", "saca", "serviço", 0, false],
];
// doses de referência por hectare: [item, cultura, mín, ref, máx, aplicações, safras de efeito]
const DOSES = [
  ["Calcário dolomítico", "Soja", 1, 2, 4, 1, 3], ["Calcário dolomítico", "Milho", 1, 2, 4, 1, 3], ["Calcário dolomítico", "Feijão", 1, 2, 4, 1, 3],
  ["Gesso agrícola", "Soja", 0.5, 1, 2, 1, 3], ["Gesso agrícola", "Milho", 0.5, 1, 2, 1, 3], ["Gesso agrícola", "Feijão", 0.5, 1, 2, 1, 3],
  ["NPK 02-20-18", "Soja", 0.3, 0.4, 0.5, 1, 1], ["MAP 11-52-00", "Soja", 0.1, 0.15, 0.2, 1, 1], ["Cloreto de potássio (KCl)", "Soja", 0.08, 0.12, 0.18, 1, 1],
  ["NPK 02-20-18", "Milho", 0.25, 0.3, 0.4, 1, 1], ["Ureia", "Milho", 0.1, 0.15, 0.25, 1, 1], ["Cloreto de potássio (KCl)", "Milho", 0.05, 0.08, 0.12, 1, 1],
  ["NPK 02-20-18", "Feijão", 0.25, 0.35, 0.45, 1, 1], ["Ureia", "Feijão", 0.05, 0.1, 0.15, 1, 1],
  ["Boro foliar", "Soja", 0.5, 1, 2, 1, 1], ["Cobalto + molibdênio", "Soja", 0.1, 0.15, 0.3, 1, 1], ["Manganês foliar", "Soja", 0.5, 1, 2, 1, 1],
  ["Manganês foliar", "Milho", 0.5, 1, 2, 1, 1], ["Boro foliar", "Feijão", 0.5, 1, 2, 1, 1],
  ["Herbicida glifosato", "Soja", 2, 3, 4, 2, 1], ["Herbicida pré-emergente", "Soja", 1, 1.5, 2, 1, 1], ["Fungicida triazol + estrobilurina", "Soja", 0.3, 0.5, 0.8, 3, 1],
  ["Inseticida para lagartas", "Soja", 0.1, 0.2, 0.4, 2, 1], ["Inseticida para percevejos", "Soja", 0.5, 1, 1.5, 2, 1],
  ["Herbicida glifosato", "Milho", 2, 3, 4, 1, 1], ["Herbicida pré-emergente", "Milho", 1, 2, 3, 1, 1], ["Fungicida triazol + estrobilurina", "Milho", 0.3, 0.5, 0.8, 1, 1],
  ["Inseticida para lagartas", "Milho", 0.1, 0.2, 0.4, 2, 1],
  ["Herbicida glifosato", "Feijão", 2, 3, 4, 1, 1], ["Fungicida triazol + estrobilurina", "Feijão", 0.3, 0.5, 0.8, 2, 1], ["Inseticida para lagartas", "Feijão", 0.1, 0.2, 0.4, 2, 1],
  ["Semente de soja", "Soja", 45, 55, 70, 1, 1], ["Inoculante", "Soja", 0.1, 0.2, 0.3, 1, 1],
  ["Semente de milho híbrido", "Milho", 18, 20, 24, 1, 1], ["Semente de feijão carioca", "Feijão", 50, 60, 75, 1, 1],
  ["Diesel S10", "Soja", 30, 40, 55, 1, 1], ["Diesel S10", "Milho", 30, 40, 55, 1, 1], ["Diesel S10", "Feijão", 30, 45, 60, 1, 1],
  ["Colheita terceirizada", "Soja", 1, 1, 1, 1, 1], ["Colheita terceirizada", "Milho", 1, 1, 1, 1, 1], ["Colheita terceirizada", "Feijão", 1, 1, 1, 1, 1],
  ["Frete do grão até o armazém", "Soja", 50, 60, 70, 1, 1], ["Frete do grão até o armazém", "Milho", 100, 115, 130, 1, 1], ["Frete do grão até o armazém", "Feijão", 40, 47, 55, 1, 1],
];
async function seedCatalogo(pool) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM catalog_items");
  if (rows[0].n > 0) return false;
  const ids = {};
  for (const [categoria, nome, detalhe, ud, uc, fator, receita] of ITENS) {
    const r = await pool.query(
      `INSERT INTO catalog_items (categoria, nome, detalhe, unidade_dose, unidade_compra, fator_t, exige_receita)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (categoria, nome) DO UPDATE SET detalhe = EXCLUDED.detalhe RETURNING id`,
      [categoria, nome, detalhe, ud, uc, fator, receita]);
    ids[nome] = r.rows[0].id;
  }
  for (const [nome, cultura, mn, ref, mx, apl, safras] of DOSES) {
    await pool.query(
      `INSERT INTO reference_doses (catalog_item_id, cultura, uf, dose_min, dose_ref, dose_max, aplicacoes, safras_efeito)
       VALUES ($1,$2,'BR',$3,$4,$5,$6,$7) ON CONFLICT (catalog_item_id, cultura, uf) DO NOTHING`,
      [ids[nome], cultura, mn, ref, mx, apl, safras]);
  }
  return true;
}
module.exports = { ITENS, DOSES, seedCatalogo };
