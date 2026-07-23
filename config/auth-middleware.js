// Middlewares de proteção de rotas

// Exige que o usuário esteja logado
function exigirLogin(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }
  next();
}

// Exige que o usuário logado seja administrador
function exigirAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { exigirLogin, exigirAdmin };
