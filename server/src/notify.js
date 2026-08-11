// Envia a mesma notificação para uma lista de usuários.
// Recebe um client de transação (ou o pool) para poder rodar dentro
// de uma transação já aberta (ex: junto da criação do talhão).
async function notifyUsers(db, recipientIds, { senderRole, farmId = null, plotId = null, type, title, body }) {
  const uniqueIds = [...new Set(recipientIds)].filter(Boolean);
  if (uniqueIds.length === 0) return 0;

  const values = [];
  const rowPlaceholders = uniqueIds.map((userId) => {
    values.push(userId, senderRole, farmId, plotId, type, title, body);
    const base = values.length - 7;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  });

  const sql = `
    INSERT INTO notifications (recipient_user_id, sender_role, farm_id, plot_id, type, title, body)
    VALUES ${rowPlaceholders.join(", ")}
  `;

  await db.query(sql, values);
  return uniqueIds.length;
}

// todos os investidores que já compraram cota em algum talhão dessa fazenda
async function getFarmInvestorIds(db, farmId) {
  const { rows } = await db.query(
    `SELECT DISTINCT i.user_id FROM investments i JOIN plots p ON p.id = i.plot_id WHERE p.farm_id = $1`,
    [farmId]
  );
  return rows.map((r) => r.user_id);
}

// investidores com cota especificamente naquele talhão
async function getPlotInvestorIds(db, plotId) {
  const { rows } = await db.query(`SELECT DISTINCT user_id FROM investments WHERE plot_id = $1`, [plotId]);
  return rows.map((r) => r.user_id);
}

module.exports = { notifyUsers, getFarmInvestorIds, getPlotInvestorIds };
