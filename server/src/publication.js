// Publicação de talhões para investidores.
//
// Controle exigido pela plataforma: um talhão novo só aparece na vitrine e
// aceita investimento quando
//   1) a administração aprovou o cadastro do talhão, e
//   2) o armazém garantidor aceitou a custódia (talhões novos sempre exigem).
// Talhões antigos (anteriores a esta regra) seguem publicados como estavam.
const { pool } = require("./db");
const { notifyUsers, getFarmInvestorIds } = require("./notify");

// mesmo critério em SQL (alias "p" para a tabela plots)
const PUBLIC_SQL = "(p.aprovacao_status = 'aprovado' AND (NOT p.exige_garantia OR p.custodia_status = 'aceita'))";

function isPublic(plot) {
  return plot.aprovacao_status === "aprovado" && (!plot.exige_garantia || plot.custodia_status === "aceita");
}

// o que ainda falta para o talhão ir ao ar (para explicar à fazenda e ao investidor)
function pendencias(plot) {
  const faltam = [];
  if (plot.aprovacao_status === "pendente") faltam.push("aprovação da administração");
  if (plot.aprovacao_status === "rejeitado") faltam.push("correção pedida pela administração");
  if (plot.exige_garantia && plot.custodia_status !== "aceita") faltam.push("aceite do armazém garantidor");
  return faltam;
}

async function safeNotify(ids, payload) {
  try { await notifyUsers(pool, ids, payload); } catch (err) { console.error("[aviso não enviado]", err.message); }
}

// chamada sempre que a aprovação ou a custódia mudam; publica uma única vez
async function maybePublish(plotId) {
  const { rows } = await pool.query(
    "SELECT p.*, f.name AS farm_name, f.owner_user_id FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = $1",
    [plotId]
  );
  const plot = rows[0];
  if (!plot || plot.publicado_em || !isPublic(plot)) return false;

  const { rowCount } = await pool.query("UPDATE plots SET publicado_em = now() WHERE id = $1 AND publicado_em IS NULL", [plot.id]);
  if (!rowCount) return false;

  await safeNotify([plot.owner_user_id], {
    senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "talhao_publicado",
    title: `${plot.nome} está no ar`,
    body: "Aprovado pela administração e com armazém garantidor. Os investidores já podem comprar.",
  });
  const investorIds = await getFarmInvestorIds(pool, plot.farm_id);
  await safeNotify(investorIds, {
    senderRole: "sistema", farmId: plot.farm_id, plotId: plot.id, type: "novo_talhao",
    title: `Novo talhão em ${plot.farm_name}`,
    body: `${plot.farm_name} publicou ${plot.nome} (${plot.grao}${plot.variedade ? ` · ${plot.variedade}` : ""}), disponível para investimento.`,
  });
  return true;
}

module.exports = { PUBLIC_SQL, isPublic, pendencias, maybePublish };
