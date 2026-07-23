// Rotas de salas
const express = require('express');
const db = require('../config/db');
const { exigirLogin, exigirAdmin } = require('../config/auth-middleware');
const router = express.Router();

// Listar todas as salas ativas (usado para montar/pintar a planta)
router.get('/', async (req, res) => {
  try {
    const [salas] = await db.query('SELECT * FROM salas WHERE ativa = TRUE ORDER BY nome');
    res.json(salas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar salas.' });
  }
});

// Criar sala (somente admin)
router.post('/', exigirLogin, exigirAdmin, async (req, res) => {
  try {
    const { nome, svg_id, capacidade, recursos } = req.body;
    await db.query(
      'INSERT INTO salas (nome, svg_id, capacidade, recursos) VALUES (?, ?, ?, ?)',
      [nome, svg_id, capacidade || 30, recursos || null]
    );
    res.status(201).json({ mensagem: 'Sala criada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar sala.' });
  }
});

module.exports = router;
