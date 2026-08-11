const { pool } = require("./db");
const { notifyUsers } = require("./notify");

const DIAS_SEM_ATUALIZACAO_PARA_LEMBRAR = 5;
const HORAS_ENTRE_VERIFICACOES = 6;

// Verifica talhões em captação/andamento cuja fase não é atualizada há
// muitos dias, e avisa a fazenda responsável. Evita repetir o aviso com
// muita frequência usando last_reminder_at como controle.
async function checkStalePlots() {
  try {
    const { rows: stalePlots } = await pool.query(
      `SELECT p.id, p.nome, p.fase_atual, f.owner_user_id, f.name as farm_name,
              GREATEST(p.created_at, COALESCE(
                (SELECT MAX(created_at) FROM progress_updates WHERE plot_id = p.id), p.created_at
              )) as ultima_atualizacao
       FROM plots p
       JOIN farms f ON f.id = p.farm_id
       WHERE p.status IN ('captacao', 'em_andamento')
         AND f.owner_user_id IS NOT NULL
         AND GREATEST(p.created_at, COALESCE(
               (SELECT MAX(created_at) FROM progress_updates WHERE plot_id = p.id), p.created_at
             )) < now() - interval '${DIAS_SEM_ATUALIZACAO_PARA_LEMBRAR} days'
         AND (p.last_reminder_at IS NULL OR p.last_reminder_at < now() - interval '${DIAS_SEM_ATUALIZACAO_PARA_LEMBRAR} days')`
    );

    for (const plot of stalePlots) {
      const dias = Math.floor((Date.now() - new Date(plot.ultima_atualizacao).getTime()) / 86400000);
      await notifyUsers(pool, [plot.owner_user_id], {
        senderRole: "sistema",
        plotId: plot.id,
        type: "lembrete_fase",
        title: "Atualize o andamento do talhão",
        body: `${plot.nome} está há ${dias} dias sem atualização de fase/progresso. Mantenha os investidores informados sobre o andamento da safra.`,
      });
      await pool.query("UPDATE plots SET last_reminder_at = now() WHERE id = $1", [plot.id]);
    }

    if (stalePlots.length) {
      console.log(`[lembretes] ${stalePlots.length} talhão(ões) avisado(s) sobre atualização de fase pendente.`);
    }
  } catch (err) {
    console.error("[erro] falha ao verificar talhões sem atualização:", err);
  }
}

function startReminderScheduler() {
  // roda uma vez ao subir o servidor, e depois periodicamente
  checkStalePlots();
  setInterval(checkStalePlots, HORAS_ENTRE_VERIFICACOES * 60 * 60 * 1000);
}

module.exports = { startReminderScheduler, checkStalePlots };
