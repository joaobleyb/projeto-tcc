// Rotas de autenticação: cadastro e login
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const router = express.Router();

// Cadastro de novo usuário
router.post('/registrar', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Preencha nome, email e senha.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    await db.query(
      'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
      [nome, email, senhaHash]
    );
    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Este email já está cadastrado.' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro no servidor.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const [linhas] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }
    const usuario = linhas[0];
    const ok = await bcrypt.compare(senha, usuario.senha_hash);
    if (!ok) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }
    // Guarda os dados essenciais na sessão
    req.session.usuario = { id: usuario.id, nome: usuario.nome, tipo: usuario.tipo };
    res.json({ mensagem: 'Login efetuado.', usuario: req.session.usuario });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro no servidor.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ mensagem: 'Sessão encerrada.' }));
});

// Descobrir quem está logado (usado pelo front)
router.get('/eu', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

module.exports = router;
