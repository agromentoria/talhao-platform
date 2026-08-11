const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

function pairKey(a, b) {
  return a < b ? [a, b] : [b, a];
}

// checa se req.user pode iniciar conversa com targetUser, conforme a relação de negócio
async function canMessage(requester, targetUser) {
  if (requester.id === targetUser.id) return false;

  if (requester.role === "admin") {
    return targetUser.role === "fazenda" || targetUser.role === "investidor";
  }

  if (requester.role === "investidor" && targetUser.role === "fazenda") {
    if (!targetUser.farm_id) return false;
    const { rows } = await pool.query(
      `SELECT 1 FROM investments i JOIN plots p ON p.id = i.plot_id
       WHERE i.user_id = $1 AND p.farm_id = $2 LIMIT 1`,
      [requester.id, targetUser.farm_id]
    );
    return rows.length > 0;
  }

  if (requester.role === "fazenda" && targetUser.role === "investidor") {
    const { rows } = await pool.query(
      `SELECT 1 FROM investments i JOIN plots p ON p.id = i.plot_id
       WHERE i.user_id = $1 AND p.farm_id = $2 LIMIT 1`,
      [targetUser.id, requester.farm_id]
    );
    return rows.length > 0;
  }

  return false;
}

async function getOtherUserInfo(otherId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.role, u.avatar_data, f.id as farm_id, f.name as farm_name, f.location as farm_location
     FROM users u LEFT JOIN farms f ON f.id = u.farm_id WHERE u.id = $1`,
    [otherId]
  );
  return rows[0] || null;
}

async function getSharedGraos(requesterRole, requesterId, requesterFarmId, other) {
  const farmId = other.role === "fazenda" ? other.farm_id : (requesterRole === "fazenda" ? requesterFarmId : null);
  const investorId = other.role === "investidor" ? other.id : (requesterRole === "investidor" ? requesterId : null);
  if (!farmId || !investorId) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT p.grao FROM investments i JOIN plots p ON p.id = i.plot_id WHERE i.user_id = $1 AND p.farm_id = $2`,
    [investorId, farmId]
  );
  return rows.map((r) => r.grao).filter(Boolean);
}

// conversas existentes + contatos disponíveis para iniciar uma nova
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { rows: convRows } = await pool.query(
    `SELECT c.id as conversation_id, c.participant_a_id, c.participant_b_id,
            (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem,
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem_em,
            (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_user_id != $1
               AND m.created_at > COALESCE(
                 (SELECT last_read_at FROM conversation_reads WHERE conversation_id = c.id AND user_id = $1),
                 'epoch'::timestamptz
               )
            ) as nao_lidas
     FROM conversations c
     WHERE c.participant_a_id = $1 OR c.participant_b_id = $1
     ORDER BY ultima_mensagem_em DESC NULLS LAST`,
    [userId]
  );

  const conversations = [];
  for (const c of convRows) {
    const otherId = c.participant_a_id === userId ? c.participant_b_id : c.participant_a_id;
    const other = await getOtherUserInfo(otherId);
    if (!other) continue;
    const graos = await getSharedGraos(req.user.role, userId, req.user.farm_id, other);
    conversations.push({
      conversation_id: c.conversation_id,
      other_user_id: other.id,
      other_name: other.name,
      other_role: other.role,
      other_avatar: other.avatar_data,
      farm_name: other.role === "fazenda" ? other.farm_name : null,
      farm_location: other.role === "fazenda" ? other.farm_location : null,
      graos,
      ultima_mensagem: c.ultima_mensagem,
      ultima_mensagem_em: c.ultima_mensagem_em,
      nao_lidas: Number(c.nao_lidas),
    });
  }

  const existingContactIds = new Set(conversations.map((c) => c.other_user_id));
  let startable = [];

  if (req.user.role === "investidor") {
    const { rows } = await pool.query(
      `SELECT f.owner_user_id as user_id, f.name as farm_name, f.location as farm_location,
              array_agg(DISTINCT p.grao) as graos
       FROM investments i
       JOIN plots p ON p.id = i.plot_id
       JOIN farms f ON f.id = p.farm_id
       WHERE i.user_id = $1 AND f.owner_user_id IS NOT NULL
       GROUP BY f.owner_user_id, f.name, f.location`,
      [userId]
    );
    startable = rows
      .filter((r) => !existingContactIds.has(r.user_id))
      .map((r) => ({ user_id: r.user_id, name: r.farm_name, role: "fazenda", farm_location: r.farm_location, graos: (r.graos || []).filter(Boolean) }));
  } else if (req.user.role === "fazenda") {
    const { rows } = await pool.query(
      `SELECT u.id as user_id, u.name, u.avatar_data, array_agg(DISTINCT p.grao) as graos
       FROM investments i
       JOIN plots p ON p.id = i.plot_id
       JOIN users u ON u.id = i.user_id
       WHERE p.farm_id = $1
       GROUP BY u.id, u.name, u.avatar_data`,
      [req.user.farm_id]
    );
    startable = rows
      .filter((r) => !existingContactIds.has(r.user_id))
      .map((r) => ({ user_id: r.user_id, name: r.name, role: "investidor", avatar: r.avatar_data, graos: (r.graos || []).filter(Boolean) }));
  } else if (req.user.role === "admin") {
    const { rows: farmRows } = await pool.query(
      "SELECT owner_user_id as user_id, name as farm_name, location as farm_location FROM farms WHERE owner_user_id IS NOT NULL"
    );
    const { rows: invRows } = await pool.query(
      "SELECT id as user_id, name, avatar_data FROM users WHERE role = 'investidor'"
    );
    startable = [
      ...farmRows.filter((r) => !existingContactIds.has(r.user_id)).map((r) => ({ user_id: r.user_id, name: r.farm_name, role: "fazenda", farm_location: r.farm_location })),
      ...invRows.filter((r) => !existingContactIds.has(r.user_id)).map((r) => ({ user_id: r.user_id, name: r.name, role: "investidor", avatar: r.avatar_data })),
    ];
  }

  res.json({ conversations, startable });
}));

// total de mensagens não lidas — usado no sininho/badge de navegação
router.get("/unread-count", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE (c.participant_a_id = $1 OR c.participant_b_id = $1)
       AND m.sender_user_id != $1
       AND m.created_at > COALESCE(
         (SELECT last_read_at FROM conversation_reads WHERE conversation_id = c.id AND user_id = $1),
         'epoch'::timestamptz
       )`,
    [req.user.id]
  );
  res.json({ count: Number(rows[0].n) });
}));

router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "Informe com quem deseja conversar." });

  const { rows: targetRows } = await pool.query("SELECT * FROM users WHERE id = $1", [user_id]);
  const target = targetRows[0];
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });

  const allowed = await canMessage(req.user, target);
  if (!allowed) {
    return res.status(403).json({ error: "Você só pode conversar com fazendas ou investidores com quem já tem uma relação de investimento." });
  }

  const [a, b] = pairKey(req.user.id, Number(user_id));
  const existing = await pool.query(
    "SELECT * FROM conversations WHERE participant_a_id = $1 AND participant_b_id = $2",
    [a, b]
  );
  if (existing.rows.length) return res.json({ conversation: existing.rows[0] });

  const { rows } = await pool.query(
    "INSERT INTO conversations (participant_a_id, participant_b_id) VALUES ($1, $2) RETURNING *",
    [a, b]
  );
  res.status(201).json({ conversation: rows[0] });
}));

router.get("/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const { rows: convRows } = await pool.query("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
  const conversation = convRows[0];
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });

  const isParticipant = conversation.participant_a_id === req.user.id || conversation.participant_b_id === req.user.id;
  if (!isParticipant && req.user.role !== "admin") {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }

  const { rows } = await pool.query(
    `SELECT m.*, u.name as sender_name, u.role as sender_role_actual
     FROM messages m JOIN users u ON u.id = m.sender_user_id
     WHERE m.conversation_id = $1 ORDER BY m.created_at`,
    [req.params.id]
  );

  if (isParticipant) {
    await pool.query(
      `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()`,
      [req.params.id, req.user.id]
    );
  }

  res.json({ conversation, messages: rows });
}));

router.post("/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Escreva uma mensagem." });
  if (body.length > 2000) return res.status(400).json({ error: "Mensagem muito longa." });

  const { rows: convRows } = await pool.query("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
  const conversation = convRows[0];
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });

  const isParticipant = conversation.participant_a_id === req.user.id || conversation.participant_b_id === req.user.id;
  if (!isParticipant) return res.status(403).json({ error: "Você não tem acesso a esta conversa." });

  const { rows } = await pool.query(
    "INSERT INTO messages (conversation_id, sender_user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [req.params.id, req.user.id, body.trim()]
  );

  // marca como lida por quem enviou, pra não contar a própria mensagem como pendente
  await pool.query(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_at) VALUES ($1, $2, now())
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = now()`,
    [req.params.id, req.user.id]
  );

  res.status(201).json({ message: rows[0] });
}));

module.exports = router;
