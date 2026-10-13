const jwt = require("jsonwebtoken");

// Conta suspensa pela administração perde o acesso na hora (não só no
// próximo login). A consulta é guardada por 30 s para não pesar no banco.
const cacheSuspensao = new Map();
const CACHE_MS = 30_000;

async function estaSuspenso(userId) {
  const agora = Date.now();
  const c = cacheSuspensao.get(userId);
  if (c && agora - c.t < CACHE_MS) return c.suspenso;
  const { pool } = require("../db");
  const { rows } = await pool.query("SELECT suspended_at, deleted_at FROM users WHERE id = $1", [userId]);
  const suspenso = !rows[0] || !!rows[0].suspended_at || !!rows[0].deleted_at;
  cacheSuspensao.set(userId, { t: agora, suspenso });
  return suspenso;
}

function limparCacheSuspensao(userId) {
  cacheSuspensao.delete(userId);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Faça login para continuar." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
  }
  req.user = payload; // { id, name, email, role, farm_id }
  estaSuspenso(payload.id)
    .then((suspenso) => {
      if (suspenso) return res.status(401).json({ error: "Sua conta está suspensa ou foi encerrada. Fale com a administração." });
      next();
    })
    .catch(next);
}

// permite acesso apenas a papéis específicos: requireRole('admin', 'fazenda')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Você não tem permissão para esta ação." });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, limparCacheSuspensao };
