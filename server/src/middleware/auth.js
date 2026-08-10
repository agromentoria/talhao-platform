const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Faça login para continuar." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, name, email, role, farm_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
  }
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

module.exports = { requireAuth, requireRole };
