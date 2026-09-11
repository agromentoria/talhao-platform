// Registra uma transação no livro-razão. Aceita client de transação ou o pool.
async function recordTransaction(db, {
  type, status = "aprovado", userId, farmId = null, plotId = null, investmentId = null,
  amount, paymentMethodType = null, paymentMethodId = null, description,
}) {
  const { rows } = await db.query(
    `INSERT INTO transactions (type, status, user_id, farm_id, plot_id, investment_id, amount, payment_method_type, payment_method_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [type, status, userId, farmId, plotId, investmentId, amount, paymentMethodType, paymentMethodId, description]
  );
  return rows[0];
}

module.exports = { recordTransaction };
