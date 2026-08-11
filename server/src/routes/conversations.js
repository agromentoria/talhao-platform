const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

async function canAccessConversation(conversation, user) {
  if (user.role === "admin") return true;
  if (user.role === "investidor") return conversation.investor_user_id === user.id;
  if (user.role === "fazenda") return conversation.farm_id === user.farm_id;
  return false;
}

// investidor: fazendas onde já investiu, com conversa existente (se houver)
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role === "investidor") {
    const { rows } = await pool.query(
      `SELECT f.id as farm_id, f.name as farm_name, f.location as farm_location,
              c.id as conversation_id,
              array_agg(DISTINCT p.grao) as graos,
              (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem,
              (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem_em
       FROM investments i
       JOIN plots p ON p.id = i.plot_id
       JOIN farms f ON f.id = p.farm_id
       LEFT JOIN conversations c ON c.farm_id = f.id AND c.investor_user_id = $1
       WHERE i.user_id = $1
       GROUP BY f.id, f.name, f.location, c.id
       ORDER BY f.name`,
      [req.user.id]
    );
    return res.json({ conversations: rows });
  }

  if (req.user.role === "fazenda") {
    const { rows } = await pool.query(
      `SELECT c.id as conversation_id, u.id as investor_id, u.name as investor_name, u.avatar_data as investor_avatar,
              array_agg(DISTINCT p.grao) FILTER (WHERE p.grao IS NOT NULL) as graos,
              (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem,
              (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as ultima_mensagem_em
       FROM conversations c
       JOIN users u ON u.id = c.investor_user_id
       LEFT JOIN investments i ON i.user_id = u.id
       LEFT JOIN plots p ON p.id = i.plot_id AND p.farm_id = c.farm_id
       WHERE c.farm_id = $1
       GROUP BY c.id, u.id, u.name, u.avatar_data
       ORDER BY ultima_mensagem_em DESC NULLS LAST`,
      [req.user.farm_id]
    );
    return res.json({ conversations: rows });
  }

  res.json({ conversations: [] });
}));

// investidor inicia (ou reabre) uma conversa com uma fazenda onde já investiu
router.post("/", requireAuth, requireRole("investidor"), asyncHandler(async (req, res) => {
  const { farm_id } = req.body || {};
  if (!farm_id) return res.status(400).json({ error: "Informe a fazenda." });

  const owns = await pool.query(
    `SELECT 1 FROM investments i JOIN plots p ON p.id = i.plot_id WHERE i.user_id = $1 AND p.farm_id = $2 LIMIT 1`,
    [req.user.id, farm_id]
  );
  if (!owns.rows.length) {
    return res.status(403).json({ error: "Você só pode conversar com fazendas onde já investiu." });
  }

  const existing = await pool.query(
    "SELECT * FROM conversations WHERE investor_user_id = $1 AND farm_id = $2",
    [req.user.id, farm_id]
  );
  if (existing.rows.length) return res.json({ conversation: existing.rows[0] });

  const { rows } = await pool.query(
    "INSERT INTO conversations (investor_user_id, farm_id) VALUES ($1, $2) RETURNING *",
    [req.user.id, farm_id]
  );
  res.status(201).json({ conversation: rows[0] });
}));

router.get("/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const { rows: convRows } = await pool.query("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
  const conversation = convRows[0];
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });
  if (!(await canAccessConversation(conversation, req.user))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }

  const { rows } = await pool.query(
    `SELECT m.*, u.name as sender_name, u.role as sender_role_actual
     FROM messages m JOIN users u ON u.id = m.sender_user_id
     WHERE m.conversation_id = $1 ORDER BY m.created_at`,
    [req.params.id]
  );
  res.json({ conversation, messages: rows });
}));

router.post("/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Escreva uma mensagem." });
  if (body.length > 2000) return res.status(400).json({ error: "Mensagem muito longa." });

  const { rows: convRows } = await pool.query("SELECT * FROM conversations WHERE id = $1", [req.params.id]);
  const conversation = convRows[0];
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada." });
  if (!(await canAccessConversation(conversation, req.user))) {
    return res.status(403).json({ error: "Você não tem acesso a esta conversa." });
  }

  const { rows } = await pool.query(
    "INSERT INTO messages (conversation_id, sender_user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [req.params.id, req.user.id, body.trim()]
  );
  res.status(201).json({ message: rows[0] });
}));

module.exports = router;
